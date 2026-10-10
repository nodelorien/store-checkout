# Documentation map

Layered, component-scoped context. The loading protocol is in [`/AGENTS.md`](../AGENTS.md).

```
AGENTS.md                         L0  router + hard rules (always loaded)
docs/
  product/prd.md                  L1  what we build and why (requirements FR-*/NFR-*)
  architecture/overview.md        L1  system shape, component boundaries, payment sequence
  adr/                            --  decision records (load only to learn *why*)
  components/
    backend/   CONTEXT.md         L2  entry point for apps/api
               domain.md          L3  entities, state machines, business rules, errors
               api.md             L3  HTTP contract (shared with frontend)
               data-model.md      L3  DynamoDB tables, keys, atomic writes, seed
               payment-gateway.md L3  outbound gateway integration
               testing.md         L3  Jest strategy for the API
    frontend/  CONTEXT.md         L2  entry point for apps/web
               checkout-flow.md   L3  5-step flow, refresh recovery
               state.md           L3  Redux store shape, persistence rules
               ui.md              L3  MUI theme, responsive rules, components
               testing.md         L3  Jest + Testing Library strategy
    infra/     CONTEXT.md         L2  entry point for infra/ (AWS CDK), CI/CD, env
specs/
  README.md                       --  spec-driven workflow + roadmap
  _template/                      --  spec.md / plan.md / tasks.md templates
  NNN-slug/                       L4  one folder per feature
```

## Front-matter convention

Every L1–L3 doc starts with:

```yaml
---
layer: L2            # L1 | L2 | L3
component: backend   # backend | frontend | infra | system
read-when: one line telling an agent when this file is worth its tokens
---
```

## Ownership

| Doc | Updated by | When |
|---|---|---|
| PRD | `sdd-workflow` | scope changes (rare) |
| ADR | whoever changes a decision | new file, never edit an accepted ADR's decision |
| L2/L3 | role implementing the change | same PR as the code |
| specs | `sdd-workflow` then implementer ticks tasks | per feature |
