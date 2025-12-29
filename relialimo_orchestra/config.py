from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Literal, Any

TaskName = Literal["install", "format", "lint", "typecheck", "test", "build"]

@dataclass(frozen=True)
class TaskSpec:
    """
    A single runnable task (safe command).
    Store as argv list (shell=False).
    """
    argv: List[str]
    cwd: str = "."

@dataclass
class OrchestraConfig:
    """
    Configuration for repo tasks. The LLM can only trigger tasks by name,
    not arbitrary commands, to reduce risk.
    """
    tasks: Dict[TaskName, TaskSpec]

    @staticmethod
    def load(path: Path) -> "OrchestraConfig":
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        raw_tasks = data.get("tasks", {})
        tasks: Dict[TaskName, TaskSpec] = {}
        for k, v in raw_tasks.items():
            if k not in ("install", "format", "lint", "typecheck", "test", "build"):
                continue
            if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
                continue
            tasks[k] = TaskSpec(argv=list(v))
        return OrchestraConfig(tasks=tasks)

    def dump(self) -> Dict[str, Any]:
        return {"tasks": {k: v.argv for k, v in self.tasks.items()}}

def _read_text_if_exists(path: Path, max_bytes: int = 200_000) -> str:
    if not path.exists() or not path.is_file():
        return ""
    data = path.read_bytes()[:max_bytes]
    try:
        return data.decode("utf-8", errors="replace")
    except Exception:
        return ""

def detect_default_config(repo_dir: Path) -> OrchestraConfig:
    """
    Best-effort detection of safe commands for common stacks.
    You can override with `.relialimo_orchestra.json`.
    """
    tasks: Dict[TaskName, TaskSpec] = {}

    package_json = repo_dir / "package.json"
    if package_json.exists():
        # Detect package manager
        pm = "npm"
        if (repo_dir / "pnpm-lock.yaml").exists():
            pm = "pnpm"
        elif (repo_dir / "yarn.lock").exists():
            pm = "yarn"
        elif (repo_dir / "bun.lockb").exists() or (repo_dir / "bun.lock").exists():
            pm = "bun"

        pkg = {}
        try:
            pkg = json.loads(_read_text_if_exists(package_json))
        except Exception:
            pkg = {}
        scripts = (pkg.get("scripts") or {}) if isinstance(pkg.get("scripts"), dict) else {}

        # install
        if pm == "npm" and (repo_dir / "package-lock.json").exists():
            tasks["install"] = TaskSpec(argv=["npm", "ci"])
        elif pm == "yarn":
            tasks["install"] = TaskSpec(argv=["yarn", "install", "--frozen-lockfile"])
        elif pm == "pnpm":
            tasks["install"] = TaskSpec(argv=["pnpm", "install", "--frozen-lockfile"])
        elif pm == "bun":
            tasks["install"] = TaskSpec(argv=["bun", "install"])
        else:
            tasks["install"] = TaskSpec(argv=[pm, "install"])

        # standard scripts
        if "format" in scripts:
            tasks["format"] = TaskSpec(argv=[pm, "run", "format"])
        if "lint" in scripts:
            tasks["lint"] = TaskSpec(argv=[pm, "run", "lint"])
        if "typecheck" in scripts:
            tasks["typecheck"] = TaskSpec(argv=[pm, "run", "typecheck"])
        if "test" in scripts and scripts.get("test") and scripts.get("test") != 'echo "Error: no test specified" && exit 1':
            tasks["test"] = TaskSpec(argv=[pm, "test"])
        if "build" in scripts:
            tasks["build"] = TaskSpec(argv=[pm, "run", "build"])

        return OrchestraConfig(tasks=tasks)

    # Python fallback
    pyproject = repo_dir / "pyproject.toml"
    requirements = repo_dir / "requirements.txt"
    if pyproject.exists() or requirements.exists():
        # install is intentionally not auto-run for python since it varies a lot,
        # but we provide a conservative default if requirements.txt exists.
        if requirements.exists():
            tasks["install"] = TaskSpec(argv=["python", "-m", "pip", "install", "-r", "requirements.txt"])
        # common defaults
        tasks["test"] = TaskSpec(argv=["python", "-m", "pytest"])
        # If ruff is configured, this will work; otherwise it may fail and that's okay.
        tasks["lint"] = TaskSpec(argv=["python", "-m", "ruff", "check", "."])
        tasks["format"] = TaskSpec(argv=["python", "-m", "ruff", "format", "."])
        return OrchestraConfig(tasks=tasks)

    # Generic: no tasks detected
    return OrchestraConfig(tasks={})

def load_or_detect_config(repo_dir: Path, config_path: Optional[Path]) -> OrchestraConfig:
    if config_path and config_path.exists():
        return OrchestraConfig.load(config_path)
    # Auto-detect
    default_path = repo_dir / ".relialimo_orchestra.json"
    if default_path.exists():
        return OrchestraConfig.load(default_path)
    return detect_default_config(repo_dir)
