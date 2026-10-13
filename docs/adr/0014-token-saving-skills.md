# ADR-0014: Token-saving skills for code and chat

- Status: Accepted
- Date: 2026-10-13
- Drivers: cost of agent sessions; "use of AI as coding assistant" is evaluated

## Context

ADR-0010 limits what an agent **reads**: layered docs, one source of truth. Nothing limited what
it **writes**. Agents tend to add abstractions nobody asked for and to wrap every answer in
ceremony, and output tokens are the expensive ones. Two community skills address exactly that:
`ponytail` (the smallest change that fully solves the task) and `caveman` (terse chat replies).

## Decision

1. Copy the base skill of each project into `.agents/skills/`, unmodified, with its licence and a
   notice naming the source commit: `ponytail` 5.2.0 (MIT) and `caveman` 3.2.0 (Apache-2.0).
   They sit next to the role skills, so the three supported agents find them the same way.
2. `AGENTS.md` turns both on for every session. The hard rules win: a spec, a test per acceptance
   criterion, the coverage gate and the docs are never "extra" work to skip.
3. `caveman` shapes chat only. Its own rules exempt everything persisted outside chat, so code,
   comments, commits, docs, specs and pull requests stay in full sentences.
4. Only the two `SKILL.md` files are taken. No proxy, hook, CLI or installer runs in this
   repository or in CI.

## Consequences

- Positive: smaller diffs to review and shorter sessions, with no new runtime dependency.
- Positive: the skills are plain text in the repository, so a reviewer can read what the agent
  is told. Updating one is a copy from upstream and a new commit hash in its `NOTICE`.
- Negative: each skill costs about a thousand input tokens per session to load.
- Negative: the savings are not measured here. The published figures are the authors' and come
  from their own benchmarks.
- Negative: `caveman`'s `ultra` and `wenyan` aliases point at skills that are not copied, so
  they do nothing here.

## Alternatives rejected

- The upstream installers or plugins: they add hooks and per-agent files outside the repository,
  which a reviewer cannot see and CI cannot reproduce.
- The `caveman` proxy, which compresses what the agent reads: it sits between the agent and the
  model provider with the user's credentials. Too much trust for the gain in a project this size.
- Writing our own brevity rules in `AGENTS.md`: it would grow the file every agent always loads.
