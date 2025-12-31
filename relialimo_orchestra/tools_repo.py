from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, List, Optional

from agents import RunContextWrapper, function_tool

from .context import RepoContext
from .config import TaskName

# Directories to ignore when walking the repo (performance + noise).
DEFAULT_IGNORE_DIRS = {
    ".git",
    ".next",
    "node_modules",
    "dist",
    "build",
    "out",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
}

def _walk_repo(repo_dir: Path, max_depth: int, include_hidden: bool) -> List[Path]:
    repo_dir = repo_dir.resolve()
    out: List[Path] = []
    for root, dirs, files in os.walk(repo_dir):
        root_path = Path(root)

        rel_root = root_path.relative_to(repo_dir)
        depth = len(rel_root.parts)
        if depth > max_depth:
            dirs[:] = []
            continue

        # prune ignored dirs
        pruned = []
        for d in list(dirs):
            if d in DEFAULT_IGNORE_DIRS:
                pruned.append(d)
                continue
            if not include_hidden and d.startswith("."):
                pruned.append(d)
                continue
        for d in pruned:
            dirs.remove(d)

        for f in files:
            if not include_hidden and f.startswith("."):
                continue
            out.append(root_path / f)
    return out


@function_tool
def list_files(ctx: RunContextWrapper[RepoContext], path: str = ".", max_depth: int = 4, include_hidden: bool = False) -> str:
    """List files in the repo (breadth-first-ish), excluding common bulky directories.

    Args:
        path: Subdirectory to list from (relative to repo root).
        max_depth: Maximum directory depth from `path`.
        include_hidden: Whether to include dotfiles.
    """
    base = ctx.context.abs_path(path)
    if not base.exists():
        return f"ERROR: path does not exist: {path}"
    if base.is_file():
        return str(Path(path))

    repo_dir = base
    files = _walk_repo(repo_dir, max_depth=max_depth, include_hidden=include_hidden)
    # Return relative paths
    rels = [str(p.relative_to(ctx.context.repo_dir)) for p in files]
    rels.sort()
    if len(rels) > 2000:
        rels = rels[:2000] + ["... (truncated)"]
    return "\n".join(rels)


@function_tool
def read_file(ctx: RunContextWrapper[RepoContext], path: str, start_line: int = 1, end_line: int = 200) -> str:
    """Read a file from the repo with line numbers.

    Args:
        path: File path relative to repo root.
        start_line: 1-based start line (inclusive).
        end_line: 1-based end line (inclusive).
    """
    p = ctx.context.abs_path(path)
    if not p.exists() or not p.is_file():
        return f"ERROR: file not found: {path}"
    text = p.read_text(encoding="utf-8", errors="replace").splitlines()
    start = max(1, start_line)
    end = min(len(text), end_line)
    lines = []
    for i in range(start, end + 1):
        lines.append(f"{i:>6} | {text[i-1]}")
    header = f"FILE: {path} (lines {start}-{end} of {len(text)})"
    return header + "\n" + "\n".join(lines)


@function_tool
def write_file(ctx: RunContextWrapper[RepoContext], path: str, content: str, create_dirs: bool = True) -> str:
    """Write a file (overwrite) within the repo.

    Args:
        path: File path relative to repo root.
        content: Full file content.
        create_dirs: Create parent directories if missing.
    """
    p = ctx.context.abs_path(path)
    if create_dirs:
        p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return f"OK: wrote {path} ({len(content)} bytes)"


def _patch_is_safe(patch_text: str) -> tuple[bool, str]:
    # Disallow absolute paths and parent traversal in diff headers
    bad_markers = ["\n+++ /", "\n--- /", "diff --git /"]
    for m in bad_markers:
        if m in patch_text:
            return False, f"Unsafe patch: contains absolute path marker {m!r}"
    # A little stricter: disallow ../ in filenames in headers
    for line in patch_text.splitlines():
        if line.startswith("+++ ") or line.startswith("--- ") or line.startswith("diff --git "):
            if "../" in line or "..\\" in line:
                return False, "Unsafe patch: contains parent traversal in diff header"
    return True, "OK"


@function_tool
def apply_patch(ctx: RunContextWrapper[RepoContext], patch_text: str) -> str:
    """Apply a unified diff patch using `git apply`.

    Args:
        patch_text: Unified diff (e.g., from `git diff` format).
    """
    ok, msg = _patch_is_safe(patch_text)
    if not ok:
        return f"ERROR: {msg}"

    repo_dir = ctx.context.repo_dir
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".patch", encoding="utf-8") as f:
        f.write(patch_text)
        patch_path = f.name

    try:
        proc = subprocess.run(
            ["git", "apply", "--whitespace=nowarn", patch_path],
            cwd=str(repo_dir),
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            return "ERROR applying patch:\n" + (proc.stderr or proc.stdout or "")
        return "OK: patch applied"
    finally:
        try:
            os.remove(patch_path)
        except OSError:
            pass


@function_tool
def search_repo(ctx: RunContextWrapper[RepoContext], query: str, max_matches: int = 30) -> str:
    """Search for a substring in text files in the repo (simple, tool-safe).

    Args:
        query: Substring to search for.
        max_matches: Maximum matches returned.
    """
    repo_dir = ctx.context.repo_dir
    files = _walk_repo(repo_dir, max_depth=25, include_hidden=False)
    matches = []
    q = query
    for f in files:
        # only scan reasonably small text files
        try:
            if f.stat().st_size > 400_000:
                continue
        except OSError:
            continue
        try:
            text = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        if q not in text:
            continue
        rel = str(f.relative_to(repo_dir))
        # return first few line hits
        for idx, line in enumerate(text.splitlines(), start=1):
            if q in line:
                matches.append(f"{rel}:{idx}: {line.strip()}")
                if len(matches) >= max_matches:
                    return "\n".join(matches) + "\n... (truncated)"
    return "\n".join(matches) if matches else "NO MATCHES"


def _run(argv: List[str], cwd: Path, timeout_sec: int = 900) -> tuple[int, str]:
    proc = subprocess.run(
        argv,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout_sec,
    )
    out = ""
    if proc.stdout:
        out += proc.stdout
    if proc.stderr:
        out += "\n" + proc.stderr
    return proc.returncode, out.strip()


@function_tool
def run_task(ctx: RunContextWrapper[RepoContext], task: TaskName, timeout_sec: int = 900) -> str:
    """Run a configured task (install/lint/test/build/etc) in the repo.

    This is intentionally safer than an arbitrary shell tool: the LLM can only
    request a *named task* that you've configured/detected.

    Args:
        task: One of install/format/lint/typecheck/test/build.
        timeout_sec: Max seconds before killing the process.
    """
    spec = ctx.context.config.tasks.get(task)
    if not spec:
        return f"SKIP: task not configured: {task}"
    code, out = _run(spec.argv, cwd=ctx.context.repo_dir / spec.cwd, timeout_sec=timeout_sec)
    ctx.context.state[f"task:{task}"] = {"returncode": code, "output": out[-4000:]}
    status = "OK" if code == 0 else f"FAIL({code})"
    # Return last chunk (avoid huge outputs)
    tail = out[-4000:]
    return f"{status}: {' '.join(spec.argv)}\n{tail}"


@function_tool
def git_status(ctx: RunContextWrapper[RepoContext]) -> str:
    """Return `git status --porcelain=v1`."""
    code, out = _run(["git", "status", "--porcelain=v1"], cwd=ctx.context.repo_dir, timeout_sec=60)
    if code != 0:
        return f"ERROR: git status failed\n{out}"
    return out or "(clean)"


@function_tool
def git_diff(ctx: RunContextWrapper[RepoContext], staged: bool = False, max_chars: int = 8000) -> str:
    """Return git diff output (optionally staged)."""
    argv = ["git", "diff"]
    if staged:
        argv = ["git", "diff", "--staged"]
    code, out = _run(argv, cwd=ctx.context.repo_dir, timeout_sec=60)
    if code != 0:
        return f"ERROR: git diff failed\n{out}"
    if len(out) > max_chars:
        return out[:max_chars] + "\n... (truncated)"
    return out or "(no diff)"


@function_tool
def git_create_branch(ctx: RunContextWrapper[RepoContext], name: str) -> str:
    """Create and checkout a new git branch.

    Args:
        name: Branch name (e.g., ai/2025-12-27_fix_quote_flow)
    """
    # basic sanitization
    if any(x in name for x in ["..", "~", "^", ":", " ", "\\"]):
        return "ERROR: invalid branch name"
    code, out = _run(["git", "checkout", "-b", name], cwd=ctx.context.repo_dir, timeout_sec=60)
    if code != 0:
        return f"ERROR: git checkout -b failed\n{out}"
    ctx.context.state["branch"] = name
    return f"OK: on branch {name}"


@function_tool
def git_commit_all(ctx: RunContextWrapper[RepoContext], message: str) -> str:
    """Stage all changes and commit.

    Args:
        message: Commit message.
    """
    if not message.strip():
        return "ERROR: empty commit message"
    code, out = _run(["git", "add", "-A"], cwd=ctx.context.repo_dir, timeout_sec=60)
    if code != 0:
        return f"ERROR: git add failed\n{out}"
    code, out = _run(["git", "commit", "-m", message.strip()], cwd=ctx.context.repo_dir, timeout_sec=60)
    if code != 0:
        return f"ERROR: git commit failed\n{out}"
    return "OK: committed"
