# ADR-0010: Layered AI context + spec-driven development

- Status: Accepted
- Date: 2026-10-09
- Drivers: "use of AI as coding assistant" is evaluated; three agent CLIs in use

## Context

The project is built with AI agents (Claude Code, Codex, opencode). A single large context file
is re-read on every turn, wastes tokens, and goes stale. Each CLI also has its own format for
instructions, skills and subagents, which invites three diverging copies.

## Decision

1. **Layered docs, component-scoped.** L0 `AGENTS.md` (router, always loaded, ≤ 80 lines) →
   L1 system (PRD, architecture) → L2 component `CONTEXT.md` → L3 topic deep dives → L4 feature
   specs. Agents load the lowest layer that answers the question. Size caps per layer.
2. **One source of truth, thin wrappers.**
   - Instructions: `AGENTS.md` (read natively by Codex and opencode); `CLAUDE.md` only imports it.
   - Skills: `.agents/skills/<name>/SKILL.md` (open Agent Skills format); `.claude/skills` is a symlink.
   - Subagents: per-tool files (`.claude/agents/*.md`, `.codex/agents/*.toml`,
     `.opencode/agents/*.md`) containing only identity + "load skill X". Role knowledge lives in the skill.
3. **Spec-driven development.** Every feature goes `spec.md` (what, acceptance criteria) →
   `plan.md` (how, files, contracts) → `tasks.md` (ordered, test-first checklist) → implementation
   → review against the spec. Requirements are traceable: PRD `FR-xx` → spec `AC-n` → test name.
4. **ADRs** record why; they are not part of the default reading path.

## Consequences

- Positive: a typical task loads L0 + one L2 + one or two L3 + one spec — a few hundred lines.
- Positive: the three CLIs behave consistently; changing a role means editing one skill.
- Negative: docs must be maintained in the same PR as code (enforced by the reviewer skill).
- Negative: symlinks need care on Windows checkouts (`core.symlinks`).

## Alternatives rejected

- One monolithic `CLAUDE.md` / `AGENTS.md` — token-heavy, stale quickly.
- Duplicated per-tool instructions — guaranteed drift.
- A spec framework CLI — extra tooling; plain markdown templates are enough here.
