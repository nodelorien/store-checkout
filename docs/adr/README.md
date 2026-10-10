# Architecture Decision Records

Load an ADR only to learn **why** a decision was made or before proposing to change it.
*What to do* lives in the component docs.

| # | Title | Status |
|---|---|---|
| [0001](0001-monorepo-layout.md) | Monorepo with `apps/api`, `apps/web`, `infra` | Accepted |
| [0002](0002-hexagonal-backend.md) | Hexagonal architecture on NestJS | Accepted |
| [0003](0003-railway-oriented-use-cases.md) | ROP with an in-house `Result` type | Accepted |
| [0004](0004-dynamodb-persistence.md) | DynamoDB as the database | Accepted |
| [0005](0005-redux-toolkit-state.md) | Redux Toolkit + selective persistence | Accepted |
| [0006](0006-stock-reservation.md) | Reserve stock at PENDING, release on failure | Superseded by 0011 |
| [0007](0007-client-side-card-tokenization.md) | Tokenize cards in the browser | Accepted |
| [0008](0008-aws-serverless-deployment.md) | Serverless AWS deployment with CDK | Accepted |
| [0009](0009-jest-testing-strategy.md) | Jest everywhere, 80% enforced | Accepted |
| [0010](0010-layered-ai-context.md) | Layered AI context + spec-driven development | Accepted |
| [0011](0011-stock-update-on-approval.md) | Update stock only when the payment is approved | Accepted |

## Rules

- Format: Context → Decision → Consequences → Alternatives rejected. Max 60 lines.
- Accepted ADRs are immutable. To change one, add a new ADR with `Supersedes: NNNN` and flip the
  old status to `Superseded by NNNN`.
- Use [`_template.md`](_template.md).
