from __future__ import annotations

import os
from typing import List, Optional

from pydantic import BaseModel, Field

from agents import Agent

from . import prompts
from .tools_repo import (
    list_files,
    read_file,
    search_repo,
    write_file,
    apply_patch,
    run_task,
    git_status,
    git_diff,
    git_create_branch,
    git_commit_all,
)

def _model_from_env(key: str) -> Optional[str]:
    v = os.getenv(key)
    return v.strip() if v and v.strip() else None


class RepoMap(BaseModel):
    stack_guess: str = Field(..., description="Frameworks/languages likely used")
    key_entrypoints: List[str] = Field(default_factory=list)
    core_domains: List[str] = Field(default_factory=list, description="Key directories/modules and their purpose")
    scripts_and_tasks: List[str] = Field(default_factory=list, description="Commands to run and where")
    risks: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)


class PlanStep(BaseModel):
    title: str
    details: str
    files_to_touch: List[str] = Field(default_factory=list)
    verification: str = Field(..., description="How we will verify this step")


class Plan(BaseModel):
    goal: str
    assumptions: List[str] = Field(default_factory=list)
    steps: List[PlanStep]
    acceptance_criteria: List[str] = Field(default_factory=list)
    rollback_plan: str = Field(..., description="How to revert safely")


class Review(BaseModel):
    issues: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    security_notes: List[str] = Field(default_factory=list)
    missing_tests: List[str] = Field(default_factory=list)
    confidence: float = Field(..., ge=0.0, le=1.0)


class DebugAdvice(BaseModel):
    diagnosis: str
    likely_files: List[str] = Field(default_factory=list)
    fix_plan: List[str] = Field(default_factory=list)
    proposed_patch_summary: str


class JudgeDecision(BaseModel):
    done: bool
    rationale: str
    next_actions: List[str] = Field(default_factory=list)


def build_repo_mapper_agent() -> Agent:
    return Agent(
        name="Repo Mapper",
        instructions=prompts.REPO_MAP_INSTRUCTIONS,
        output_type=RepoMap,
        # Keep read-only:
        tools=[list_files, read_file, search_repo, git_status],
        model=_model_from_env("RELIALIMO_MODEL_FAST"),
    )


def build_planner_agent() -> Agent:
    return Agent(
        name="Planner",
        instructions=prompts.PLANNER_INSTRUCTIONS,
        output_type=Plan,
        tools=[list_files, read_file, search_repo],
        model=_model_from_env("RELIALIMO_MODEL_MAIN"),
    )


def build_coder_agent() -> Agent:
    return Agent(
        name="Coder",
        instructions=prompts.CODER_INSTRUCTIONS,
        tools=[
            list_files,
            read_file,
            search_repo,
            write_file,
            apply_patch,
            run_task,
            git_status,
            git_diff,
        ],
        model=_model_from_env("RELIALIMO_MODEL_MAIN"),
    )


def build_reviewer_agent() -> Agent:
    return Agent(
        name="Reviewer",
        instructions=prompts.REVIEWER_INSTRUCTIONS,
        output_type=Review,
        tools=[git_diff, read_file, search_repo],
        model=_model_from_env("RELIALIMO_MODEL_FAST"),
    )


def build_debugger_agent() -> Agent:
    return Agent(
        name="Debugger",
        instructions=prompts.DEBUGGER_INSTRUCTIONS,
        output_type=DebugAdvice,
        tools=[read_file, search_repo, git_diff],
        model=_model_from_env("RELIALIMO_MODEL_MAIN"),
    )


def build_judge_agent() -> Agent:
    return Agent(
        name="Judge",
        instructions=prompts.JUDGE_INSTRUCTIONS,
        output_type=JudgeDecision,
        tools=[],
        model=_model_from_env("RELIALIMO_MODEL_FAST"),
    )


def build_git_ops_agent() -> Agent:
    """
    Optional agent with git write capabilities (branch/commit). Kept separate for safety.
    """
    return Agent(
        name="Git Ops",
        instructions="You perform git operations (branch creation and committing) when asked. Be careful and conservative.",
        tools=[git_create_branch, git_commit_all, git_status],
        model=_model_from_env("RELIALIMO_MODEL_FAST"),
    )
