from __future__ import annotations

import asyncio
import random
import openai
import datetime as _dt
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

from agents import Runner, SQLiteSession

from .agents import (
    build_repo_mapper_agent,
    build_planner_agent,
    build_coder_agent,
    build_reviewer_agent,
    build_debugger_agent,
    build_judge_agent,
)
from .config import load_or_detect_config, TaskName
from .context import RepoContext


TASK_ORDER: List[TaskName] = ["format", "lint", "typecheck", "test", "build"]

# These are the IMPORTANT fixes for your MaxTurnsExceeded problem.
# If you still hit MaxTurnsExceeded, increase these numbers.
REPO_MAP_MAX_TURNS = 30
PLAN_MAX_TURNS = 20
CODER_IMPLEMENT_MAX_TURNS = 60
DEBUGGER_MAX_TURNS = 20
CODER_FIX_MAX_TURNS = 40
REVIEW_MAX_TURNS = 20
JUDGE_MAX_TURNS = 20


@dataclass
class OrchestraRunResult:
    repo_map: Any
    plan: Any
    final_status: Dict[str, Any]
    review: Any
    judge: Any
    diff: str


def _branch_name_from_goal(goal: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in goal).strip("-")
    slug = "-".join([p for p in slug.split("-") if p])[:40]
    ts = _dt.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    return f"ai/{ts}_{slug or 'change'}"


def _run(argv: List[str], cwd: Path, timeout_sec: int = 900) -> Tuple[int, str]:
    try:
        proc = subprocess.run(
            argv,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_sec,
        )
    except Exception as e:
        # Always return a tuple so callers can unpack safely.
        return 1, f"ERROR running command {argv}: {e}"

    out = ""
    if proc.stdout:
        out += proc.stdout
    if proc.stderr:
        out += "\n" + proc.stderr

    # MUST be unindented at function level:
    return proc.returncode, out.strip()



def _git_status(repo_dir: Path) -> str:
    code, out = _run(["git", "status", "--porcelain=v1"], cwd=repo_dir, timeout_sec=60)
    if code != 0:
        return f"ERROR: git status failed\n{out}"
    return out or "(clean)"


def _git_diff(repo_dir: Path, staged: bool = False, max_chars: int = 8000) -> str:
    argv = ["git", "diff", "--staged"] if staged else ["git", "diff"]
    code, out = _run(argv, cwd=repo_dir, timeout_sec=60)
    if code != 0:
        return f"ERROR: git diff failed\n{out}"
    if len(out) > max_chars:
        return out[:max_chars] + "\n... (truncated)"
    return out or "(no diff)"


def _git_create_branch(repo_dir: Path, name: str) -> str:
    if any(x in name for x in ["..", "~", "^", ":", " ", "\\"]):
        return "ERROR: invalid branch name"
    code, out = _run(["git", "checkout", "-b", name], cwd=repo_dir, timeout_sec=60)
    if code != 0:
        return f"ERROR: git checkout -b failed\n{out}"
    return f"OK: on branch {name}"


def _git_commit_all(repo_dir: Path, message: str) -> str:
    if not message.strip():
        return "ERROR: empty commit message"
    code, out = _run(["git", "add", "-A"], cwd=repo_dir, timeout_sec=60)
    if code != 0:
        return f"ERROR: git add failed\n{out}"
    code, out = _run(["git", "commit", "-m", message.strip()], cwd=repo_dir, timeout_sec=60)
    if code != 0:
        return f"ERROR: git commit failed\n{out}"
    return "OK: committed"


def _run_tasks(ctx: RepoContext) -> Dict[str, Any]:
    status: Dict[str, Any] = {}
    for task in TASK_ORDER:
        spec = ctx.config.tasks.get(task)
        if not spec:
            status[task] = {"skipped": True}
            continue
        code, out = _run(spec.argv, cwd=ctx.repo_dir / spec.cwd, timeout_sec=900)
        tail = out[-4000:]
        ok = code == 0
        status[task] = {
            "ok": ok,
            "returncode": code,
            "cmd": " ".join(spec.argv),
            "output_tail": tail,
        }
        if not ok:
            break  # first failure
    return status


async def run_orchestra(
    repo_dir: Path,
    goal: str,
    config_path: Optional[Path] = None,
    session_id: str = "relialimo_dev",
    max_iterations: int = 4,
    create_branch: bool = False,
    commit: bool = False,
) -> OrchestraRunResult:
    repo_dir = repo_dir.resolve()
    config = load_or_detect_config(repo_dir, config_path)
    ctx = RepoContext(repo_dir=repo_dir, config=config, session_id=session_id)

    # Use in-memory session by default. For persistence, pass a db_path: SQLiteSession(session_id, "conversations.db")
    session = SQLiteSession(session_id)

    # Optional: create a working branch
    if create_branch:
        branch = _branch_name_from_goal(goal)
        _git_create_branch(repo_dir, branch)
        ctx.state["branch"] = branch

    # Build agents
    repo_mapper = build_repo_mapper_agent()
    planner = build_planner_agent()
    coder = build_coder_agent()
    debugger = build_debugger_agent()
    reviewer = build_reviewer_agent()
    judge = build_judge_agent()

    # 1) Repo map (tight prompt to avoid wandering)
    repo_map_prompt = (
        "Map this repo for a developer.\n"
        "Constraints:\n"
        "- Make at most 4 tool calls total.\n"
        "- Prefer: list_files (top-level), read README.md (if present), read package.json (if present).\n"
        "- Identify: stack, entrypoints, scripts/commands, and key directories.\n"
        "- Return your final repo map JSON and STOP.\n"
    )
    repo_map_result = await Runner.run(
        repo_mapper,
        repo_map_prompt,
        context=ctx,
        session=session,
        max_turns=REPO_MAP_MAX_TURNS,
    )

    # 2) Plan
    plan_prompt = (
        f"GOAL:\n{goal}\n\n"
        f"REPO_MAP_JSON:\n{repo_map_result.final_output.model_dump_json(indent=2)}\n\n"
        f"TASK_CONFIG_JSON:\n{config.dump()}\n\n"
        "Produce the best step-by-step implementation plan."
    )
    plan_result = await Runner.run(
        planner,
        plan_prompt,
        context=ctx,
        session=session,
        max_turns=PLAN_MAX_TURNS,
    )

    # 3) Implement + debug loop
    status: Dict[str, Any] = {}
    last_failure_output = ""
    for i in range(1, max_iterations + 1):
        implement_prompt = (
            f"ITERATION {i}/{max_iterations}\n"
            f"GOAL:\n{goal}\n\n"
            f"PLAN_JSON:\n{plan_result.final_output.model_dump_json(indent=2)}\n\n"
            f"CURRENT_GIT_STATUS:\n{_git_status(repo_dir)}\n\n"
            f"TASK_CONFIG_JSON:\n{config.dump()}\n\n"
        )
        if last_failure_output:
            implement_prompt += f"PREVIOUS_FAILURE_OUTPUT:\n{last_failure_output}\n\n"

        implement_prompt += (
            "Implement the plan now. Make the smallest correct change. "
            "Use apply_patch/write_file. Read files before editing. "
            "After edits, run the configured tasks via run_task."
        )

        await Runner.run(
            coder,
            implement_prompt,
            context=ctx,
            session=session,
            max_turns=CODER_IMPLEMENT_MAX_TURNS,
        )

        # Run tasks outside the model (fast + deterministic)
        status = _run_tasks(ctx)

async def _run_agent_with_backoff(
    label: str,
    agent,
    prompt: str,
    *,
    ctx: RepoContext,
    session: SQLiteSession,
    max_turns: int,
    max_attempts: int = 8,
) :
    # Exponential backoff with jitter
    delay = 0.5
    for attempt in range(1, max_attempts + 1):
        try:
            return await Runner.run(
                agent,
                prompt,
                context=ctx,
                session=session,
                max_turns=max_turns,
            )
        except openai.RateLimitError as e:
            # 429: back off and retry
            sleep_s = min(20.0, delay) * (1.0 + random.random() * 0.25)
            print(f"[rate-limit] {label}: retrying (attempt {attempt}/{max_attempts})")
            await asyncio.sleep(sleep_s)
            delay *= 2
        except openai.APIError as e:
            # Retry transient 5xx
            status = getattr(e, "status_code", None)
            if status is not None and status < 500:
                raise
            sleep_s = min(20.0, delay) * (1.0 + random.random() * 0.25)
            print(f"[openai-5xx] {label}: retrying (attempt {attempt}/{max_attempts})")
            await asyncio.sleep(sleep_s)
            delay *= 2

    # If we get here, retries are exhausted
    raise RuntimeError(f"{label}: exceeded retries after {max_attempts} attempts")

        # Detect first failure output
        last_failure_output = ""
        failed = False
        for t in TASK_ORDER:
            tinfo = status.get(t, {})
            if tinfo.get("skipped"):
                continue
            if not tinfo.get("ok", True):
                failed = True
                last_failure_output = f"{t}: {tinfo.get('cmd')}\n{tinfo.get('output_tail')}"
                break

        if not failed:
            break

        # Debug
        debug_prompt = (
            f"GOAL:\n{goal}\n\n"
            f"FAILURE_OUTPUT:\n{last_failure_output}\n\n"
            f"CURRENT_DIFF:\n{_git_diff(repo_dir)}\n\n"
            "Diagnose and propose minimal fix."
        )
        debug_result = await Runner.run(
            debugger,
            debug_prompt,
            context=ctx,
            session=session,
            max_turns=DEBUGGER_MAX_TURNS,
        )

        fix_prompt = (
            f"Apply this fix plan now:\n{debug_result.final_output.model_dump_json(indent=2)}\n\n"
            "Implement the smallest patch to address the failure."
        )
        await Runner.run(
            coder,
            fix_prompt,
            context=ctx,
            session=session,
            max_turns=CODER_FIX_MAX_TURNS,
        )

    # 4) Review + judge
    diff_text = _git_diff(repo_dir)
    review_prompt = f"Review this diff:\n\n{diff_text}"
    review_result = await Runner.run(
        reviewer,
        review_prompt,
        context=ctx,
        session=session,
        max_turns=REVIEW_MAX_TURNS,
    )

    judge_prompt = (
        f"GOAL:\n{goal}\n\n"
        f"DIFF:\n{diff_text}\n\n"
        f"STATUS_JSON:\n{status}\n\n"
        f"REVIEW_JSON:\n{review_result.final_output.model_dump_json(indent=2)}\n\n"
        "Is this done?"
    )
    judge_result = await Runner.run(
        judge,
        judge_prompt,
        context=ctx,
        session=session,
        max_turns=JUDGE_MAX_TURNS,
    )

    # Optional: commit
    if commit:
        msg = f"AI: {goal}".strip()
        _git_commit_all(repo_dir, msg)

    return OrchestraRunResult(
        repo_map=repo_map_result.final_output,
        plan=plan_result.final_output,
        final_status=status,
        review=review_result.final_output,
        judge=judge_result.final_output,
        diff=diff_text,
    )
