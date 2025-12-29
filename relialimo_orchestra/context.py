from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

from .config import OrchestraConfig

@dataclass
class RepoContext:
    """
    Shared context passed to tools and agents. This is the "world state" for the run.
    """
    repo_dir: Path
    config: OrchestraConfig
    session_id: str = "relialimo_dev"
    # Mutable runtime state:
    state: Dict[str, Any] = field(default_factory=dict)

    def abs_path(self, rel_path: str) -> Path:
        # Normalize path and ensure it stays inside repo_dir
        candidate = (self.repo_dir / rel_path).resolve()
        repo_root = self.repo_dir.resolve()
        if repo_root not in candidate.parents and candidate != repo_root:
            raise ValueError(f"Path escapes repo: {rel_path}")
        return candidate
