# ReliaLimo Dev Orchestra (multi‑agent coding + debugging)

This is a **multi-agent coding & debugging “orchestra”** you can run locally against the `RELIALIMO` repo.
It is built on the **OpenAI Agents SDK (Python)** and is designed to:
- map the repo (stack, entrypoints, scripts)
- create an implementation plan
- implement changes via safe repo tools (read/write/search/patch)
- run lint/tests/build
- debug failures in a loop
- produce a clean change summary (and optional commit/PR)

> ✅ **No secrets are hard-coded.**
> ⚠️ Do **not** paste GitHub tokens into chat. Use environment variables / GitHub Secrets.

---

## Requirements

- Python 3.9+
- Git installed
- Access to the repo locally (SSH key or HTTPS)
- `OPENAI_API_KEY` exported in your shell

Agents SDK install (from PyPI):
```bash
pip install openai-agents
```

---

## Quickstart

### 1) Clone your repo

```bash
git clone git@github.com:ericbrustad/RELIALIMO.git
cd RELIALIMO
```

### 2) Create a venv and install this orchestrator

From **outside** the RELIALIMO repo, or inside a tools folder:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

(Or just run with `python -m relialimo_orchestra` without installing.)

### 3) Set environment variables

```bash
export OPENAI_API_KEY="sk-..."
# Optional:
export RELIALIMO_ORCHESTRA_SESSION="relialimo_dev"
```

### 4) Run an automated coding/debug loop

```bash
python -m relialimo_orchestra run --repo /path/to/RELIALIMO --goal "Fix the quote flow when tax is missing"
```

The orchestrator will:
1. Map the repo & detect build/test commands
2. Plan the change
3. Implement
4. Run lint/tests/build
5. Iterate on failures until green or max iterations

---

## Safe command execution

By default, the orchestra runs only a **fixed set of tasks**:
- install
- lint
- test
- typecheck
- build
- format

It chooses commands by inspecting your repo (e.g., `package.json` scripts or Python config).
You can override any command in a JSON config file.

Example config file (`.relialimo_orchestra.json`):
```json
{
  "tasks": {
    "install": ["npm", "ci"],
    "lint": ["npm", "run", "lint"],
    "test": ["npm", "test"],
    "build": ["npm", "run", "build"]
  }
}
```

Run with:
```bash
python -m relialimo_orchestra run --repo . --goal "..." --config .relialimo_orchestra.json
```

---

## Optional: Git branch + commit

```bash
python -m relialimo_orchestra run --repo . --goal "..." --create-branch --commit
```

This will:
- create a new branch `ai/<timestamp>`
- commit staged changes with a generated message

(Opening PRs is included as a stub; you can wire it to GitHub CLI or API.)

---

## Files

- `relialimo_orchestra/agents.py` – specialist agents
- `relialimo_orchestra/tools_repo.py` – safe repo tools (read/write/search/patch/run)
- `relialimo_orchestra/orchestrator.py` – deterministic outer loop
- `relialimo_orchestra/prompts.py` – domain + coding prompts

---

## Notes

This is intentionally **repo‑agnostic**: it can run on RELIALIMO and similar web apps
(Next.js/React, Python backends, etc.). It focuses on correctness, repeatability, and
making sure tests are green before it declares success.
