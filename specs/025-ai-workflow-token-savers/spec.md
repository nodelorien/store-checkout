# Spec 025 — AI workflow in the README and token-saving skills

- Status: Done
- Component(s): docs, agent tooling
- Branch: `feat/025-ai-workflow-token-savers`
- Traces to: NFR-09, NFR-10
- Context to load: `AGENTS.md`, `docs/adr/0010-layered-ai-context.md`, `docs/adr/0014-token-saving-skills.md`
- Plan and tasks: folded into this file

## 1. Why

The project was built with coding agents and the repository carries the context they work from,
but the README did not say how. Two community skills that cut what an agent writes were also
missing: one for code, one for chat replies.

## 2. Scope

**In:**
- Two skills copied into `.agents/skills/`, unmodified and with their licences: `ponytail`
  (smallest change that fully solves the task) and `caveman` (terse chat replies).
- A rule in `AGENTS.md` that turns both on and states that the hard rules win over them.
- A closing README section: supported agents, context layers, skills and subagents, the
  spec-driven workflow, the decision records and the two token-saving skills.
- ADR-0014 with the reasons and the limits.

**Out:**
- The rest of either upstream project: proxies, hooks, CLIs, installers and the extra skills.
- Measuring the savings in this repository. The README says the figures are the authors'.
- Any change to application code.

## 3. Behaviour

An agent that follows `AGENTS.md` loads both skills at the start of a session. Chat replies are
terse; anything written to the repository (code, comments, commits, docs, specs, pull requests)
stays in full sentences. A change is the smallest one that satisfies the spec, and still carries
the tests, coverage and docs the hard rules require. Either skill is switched off for a session
by saying "stop caveman", "stop ponytail" or "normal mode".

## 4. Acceptance criteria

- **AC-1** — `.agents/skills/ponytail` and `.agents/skills/caveman` hold the upstream `SKILL.md`
  byte for byte, the upstream licence and a notice naming the source commit.
- **AC-2** — `AGENTS.md` stays within 80 lines, names both skills and says the hard rules,
  specs, tests and docs take precedence.
- **AC-3** — The README's last section explains the layers with their size caps, lists the three
  supported agents with the file each one reads, the skills with their subagents, and every ADR.
- **AC-4** — The README attributes any savings figure to its author and says it was not measured here.
- **AC-5** — The payment provider's name appears in none of the added files.

These criteria are checked by inspection and by `diff` against the upstream files; there is no
application code to test.

## 5. Contract changes

None.
