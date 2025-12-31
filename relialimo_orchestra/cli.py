from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv

from .orchestrator import run_orchestra


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="relialimo-orchestra", description="Multi-agent coding/debugging orchestra for RELIALIMO")
    sub = p.add_subparsers(dest="cmd", required=True)

    run = sub.add_parser("run", help="Run the orchestra on a repo with a goal")
    run.add_argument("--repo", required=True, help="Path to the local RELIALIMO repo")
    run.add_argument("--goal", required=True, help="What you want the orchestra to implement or debug")
    run.add_argument("--config", default=None, help="Optional path to .relialimo_orchestra.json")
    run.add_argument("--session-id", default=os.getenv("RELIALIMO_ORCHESTRA_SESSION", "relialimo_dev"), help="Session ID for memory")
    run.add_argument("--max-iterations", type=int, default=4, help="Max implement/debug loops")
    run.add_argument("--create-branch", action="store_true", help="Create a new ai/<timestamp> branch")
    run.add_argument("--commit", action="store_true", help="Commit changes at the end (stages all)")
    return p


def _print_block(title: str, body: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)
    print(body.strip() + "\n")


def main() -> None:
    load_dotenv()
    args = _build_parser().parse_args()

    if args.cmd == "run":
        repo_dir = Path(args.repo).expanduser().resolve()
        config_path = Path(args.config).expanduser().resolve() if args.config else None

        result = asyncio.run(
            run_orchestra(
                repo_dir=repo_dir,
                goal=args.goal,
                config_path=config_path,
                session_id=args.session_id,
                max_iterations=args.max_iterations,
                create_branch=args.create_branch,
                commit=args.commit,
            )
        )

        _print_block("REPO MAP", result.repo_map.model_dump_json(indent=2))
        _print_block("PLAN", result.plan.model_dump_json(indent=2))
        _print_block("TASK STATUS", str(result.final_status))
        _print_block("REVIEW", result.review.model_dump_json(indent=2))
        _print_block("JUDGE", result.judge.model_dump_json(indent=2))
        _print_block("DIFF", result.diff)


if __name__ == "__main__":
    main()
