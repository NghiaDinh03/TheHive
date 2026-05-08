# CODING_GUIDELINES.md — Coding Rules & Self-Debate Protocol

> **Rules:** This file contains ALL coding rules, conventions, and the mandatory self-debate protocol. Before adding new rules, the agent MUST run the Self-Debate Protocol (§9) and get user approval.

---

## Table of Contents

0. [Three Integrated Solutions](#0-three-integrated-solutions)
1. [Karpathy Guidelines](#1-karpathy-guidelines)
2. [Project-Specific Conventions](#2-project-specific-conventions)
3. [Backend (Go) Rules](#3-backend-go-rules)
4. [Frontend (Next.js/TypeScript) Rules](#4-frontend-nextjstypescript-rules)
5. [Database & Migration Rules](#5-database--migration-rules)
6. [Testing Rules](#6-testing-rules)
7. [Git & Commit Rules](#7-git--commit-rules)
8. [Self-Debate Protocol](#8-self-debate-protocol)
9. [Rule Change Log](#9-rule-change-log)

---

## 0. Three Integrated Solutions (MANDATORY)

### 0.1 Caveman Protocol (Token Compression)
- All responses use Caveman terse style: bullet points, no filler, 100% technical accuracy
- Slash commands: `/caveman` (default), `/caveman lite`, `/caveman ultra`, `/caveman-commit`, `/caveman-review`, `/caveman-compress`
- Strip polite filler, omit obvious context, keep precision

### 0.2 Karpathy Guidelines
| Rule | Description |
|------|-------------|
| Think Before Coding | State assumptions, don't pick silently, push back when needed |
| Simplicity First | Minimum code, no speculative features, no over-engineering |
| Surgical Changes | Touch only what's needed, match existing style |
| Goal-Driven Execution | Define success criteria, verify after each step |

### 0.3 RTK (Rust Token Killer)
- Always prefix shell commands with `rtk`: `rtk go build ./...`, `rtk npm run build`
- Meta: `rtk gain`, `rtk gain --history`, `rtk discover`, `rtk proxy <cmd>`

---

## 1. Karpathy Guidelines

Adapted from [andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills). These are **non-negotiable behavioral rules**.

### 1.1 Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 1.2 Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 1.3 Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
- **Test:** Every changed line should trace directly to the user's request.

### 1.4 Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## 2. Project-Specific Conventions

### 2.1 Legacy Reference Rule

- Legacy code in `thehive/`, `frontend/`, `cortex/`, `misp/` is **read-only reference**.
- Never modify legacy files. Use them to understand domain behavior and UI/UX.
- New platform code in `platform/` must preserve TheHive 4 analyst workflows unless a difference is explicitly documented in `plan.md`.

### 2.2 Parity Rule

- Do not claim 100% parity until code comparison, runtime smoke, DB-backed tests, visual regression, and migration gates pass.
- Work in batches: compare legacy source → implement → validate → update plan files.

### 2.3 File Ownership

| File | Purpose | Edit Rule |
|------|---------|-----------|
| `agent_memory/MEMORY.md` | Append-only log | **NEVER delete entries. Only append.** |
| `agent_memory/STRUCTURE.md` | Project structure map | **Update immediately when structure changes.** |
| `agent_memory/CODING_GUIDE.md` | This file — all rules | **Must run Self-Debate Protocol before adding rules.** |
| `agent_memory/context.md` | Product/architecture context | Stable; update only for major architectural changes. |
| `agent_memory/plan.md` | Control plan | Clean plan; completed evidence goes to plan_done.md. |
| `agent_memory/plan_done.md` | Completed evidence | Only mark done with code/test evidence. |
| `agent_memory/plan_unfinish.md` | Unfinished backlog | Only unchecked/partially proven tasks. |

### 2.4 Read Before Write

- **Always read relevant files before making changes.** Never edit blindly.
- Read `agent_memory/context.md` and `agent_memory/plan.md` at the start of every session.
- Check `agent_memory/STRUCTURE.md` to find where things live.

---

## 3. Backend (Go) Rules

### 3.1 Layer Separation

```
HTTP Request → Echo Handler → Repository (read/write) → PostgreSQL
```

- **Handlers** (`internal/handler/`): Parse request, call repository, return response. No business logic in handlers.
- **Repositories** (`internal/repository/`): Business logic + DB queries. Split into read and write repos where practical.
- **Server/Routes** (`internal/server/`): Route registration, middleware setup.

### 3.2 Error Handling

- Use RFC7807-style errors from `internal/apierr/`.
- Never return raw SQL errors to the client.
- Log errors with zap structured fields before returning.

### 3.3 Naming

- Package names: lowercase, single word, no underscores.
- Exported functions: PascalCase.
- Unexported functions: camelCase.
- File names: snake_case.go.
- Test files: `*_test.go` alongside the source file.

### 3.4 Dependencies

- Use `sqlx` + `pgx stdlib` for DB access.
- Use `golang-migrate` for migrations.
- Use `zap` for logging.
- Use `echo/v4` for HTTP.
- No new dependencies without explicit user approval.

---

## 4. Frontend (Next.js/TypeScript) Rules

### 4.1 File Structure

- Pages: `src/app/[route]/page.tsx` (App Router).
- Components: `src/components/ComponentName.tsx`.
- Utilities: `src/lib/utilityName.ts`.
- Styles: `src/styles/globals.css` (single file for now; split later when needed).

### 4.2 Component Rules

- One component per file.
- Props interface defined inline or above the component.
- Use `"use client"` directive only when the component needs client interactivity.
- Prefer server components by default.

### 4.3 Styling

- Use Tailwind CSS classes + custom CSS tokens from `globals.css`.
- Preserve TheHive 4 AdminLTE skin-blue theme tokens:
  - Primary: `#3c8dbc`
  - Primary dark: `#367fa9`
  - Sidebar dark: `#222d32`
  - Body bg: `#ecf0f5`
  - Text: `#333`

### 4.4 Data Fetching

- Use `@tanstack/react-query` for client-side data fetching.
- Use native `fetch` wrapper from `src/lib/`.
- API base path: `/api/v1/`.

### 4.5 Naming

- Components: PascalCase (`Sidebar.tsx`, `ConfirmDialog.tsx`).
- Pages: lowercase with hyphens (`case-templates/page.tsx`).
- Hooks: `use` prefix (`useQuery`, `useMutation`).
- Types: PascalCase, defined in `src/types/`.

---

## 5. Database & Migration Rules

### 5.1 Migration Files

- Location: `platform/backend/migrations/`
- Naming: `{version}_{description}.up.sql` / `{version}_{description}.down.sql`
- Every migration MUST have both up and down.
- Never modify an already-applied migration. Create a new one.

### 5.2 Schema Conventions

- Table names: snake_case, plural (`cases`, `alerts`, `observables`).
- Primary keys: `id` (UUID or BIGSERIAL, as per existing pattern).
- Foreign keys: `{referenced_table_singular}_id`.
- Timestamps: `created_at`, `updated_at` with `TIMESTAMPTZ`.
- Soft deletes: `deleted_at TIMESTAMPTZ NULL` where applicable.

### 5.3 Seed Data

- Location: `platform/backend/migrations/seed/`
- Use for development/test data only.
- Never include seed data in production migrations.

---

## 6. Testing Rules

### 6.1 Backend Tests

- Unit tests: alongside source files (`*_test.go`).
- Integration/smoke tests: `platform/backend/internal/tests/`.
- Use `testify` for assertions.
- Test file naming: `smoke_{phase}_{feature}_test.go`.

### 6.2 Frontend Tests

- Visual regression: `platform/frontend/tests/visual/`.
- Use Playwright for visual tests.
- Screenshot baselines: `__screenshots__/` directory.

### 6.3 Test-First for Bugs

When fixing a bug:
1. Write a test that reproduces the bug (should fail).
2. Fix the bug (test should pass).
3. Verify no regressions (existing tests still pass).

---

## 7. Git & Commit Rules

### 7.1 Commit Messages

Format:
```
<type>(<scope>): <description>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`

### 7.2 Branch Strategy

- `main` — stable, production-ready.
- Feature branches: `feat/<description>` or `fix/<description>`.

### 7.3 What NOT to Commit

- `.env` files with secrets.
- `node_modules/`, `vendor/`.
- IDE-specific files (`.vscode/`, `.idea/`).
- Build artifacts not in `.gitignore`.

---

## 8. Self-Debate Protocol

> **MANDATORY:** Before adding any new rule, convention, or guideline to this file or to `MEMORY.md`, the agent MUST execute this protocol.

### 8.1 When to Trigger

- User asks to add a new coding rule or convention.
- Agent proposes a new pattern or architectural decision.
- Agent wants to add a lesson or decision to MEMORY.md.
- Any change that affects how future code is written.

### 8.2 The Debate Template

The agent must present the following structured debate **before** asking the user:

```markdown
## 🔄 Self-Debate: [Topic]

### 📌 Proposal
[Clear statement of what I want to add/change and why]

### ✅ Arguments FOR (Pro)
1. [Reason 1 — why this is beneficial]
2. [Reason 2 — supporting evidence or precedent]
3. [Reason 3 — alignment with existing patterns]

### ❌ Arguments AGAINST (Con)
1. [Reason 1 — risks, downsides, or tradeoffs]
2. [Reason 2 — alternative approaches that might be better]
3. [Reason 3 — potential conflicts with existing rules]

### 🔍 Alternatives Considered
1. [Alternative A] — [why rejected or worth considering]
2. [Alternative B] — [why rejected or worth considering]

### ⚖️ My Assessment
[Agent's honest recommendation after weighing both sides]
- Confidence level: [High/Medium/Low]
- Risk if wrong: [Low/Medium/High]
- Reversibility: [Easy/Moderate/Hard]

### ❓ Question for User
[Specific question — do you agree? Which option? Any modifications?]
```

### 8.3 Rules of Debate

1. **Be honest.** Don't strawman the "against" side. Steelman it.
2. **Be specific.** Vague pros/cons are useless. Give concrete examples.
3. **Consider the existing codebase.** Does this conflict with what's already here?
4. **Consider reversibility.** Easy-to-reverse changes need less debate. Hard-to-reverse changes need more.
5. **One question at a time.** Don't overwhelm the user with multiple decisions.
6. **Respect the user's answer.** If they say no, don't re-argue. Log the rejection reason in MEMORY.md.

### 8.4 Approval Flow

```
Agent proposes → Self-Debate → Present to user → User approves/rejects/modifies
                                                        ↓
                                              Approved? → Apply change
                                              Rejected? → Log reason in MEMORY.md, move on
                                              Modified? → Apply modified version
```

### 8.5 Quick-Path Exceptions

The self-debate can be skipped (with a brief note) for:
- **Trivial additions** (e.g., adding a file path to STRUCTURE.md).
- **User-explicit instructions** (user directly tells you to add a rule).
- **Bug-fix learnings** that are factual, not opinion-based.

For everything else: **debate first, then ask.**

---

## 9. Rule Change Log

| Date | Change | Approved By | Reason |
|------|--------|-------------|--------|
| 2026-05-07 | Initial creation of CODING_GUIDE.md | User (direct request) | Establish persistent coding rules + self-debate mechanism |
| 2026-05-07 | Adopted Karpathy guidelines (§1) | User (referenced repo) | Reduce LLM coding mistakes; source: andrej-karpathy-skills |
| 2026-05-07 | Added Self-Debate Protocol (§8) | User (direct request) | Agent must debate before adding new rules; user wants oversight |

---

> **Maintenance:** This file is the single source of truth for coding rules. All agents working on this project MUST read this file before making code changes. New rules require the Self-Debate Protocol (§8) unless they fall under quick-path exceptions.
