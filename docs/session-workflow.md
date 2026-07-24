# Session Workflow

Work may continue across different Codex sessions, branches, and pull requests,
so each session should rebuild enough context before implementation begins.

## Sources Of Truth

- `AGENTS.md` defines repository-wide agent instructions.
- `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` define package
  manager, scripts, dependency policy, and approved package build scripts.
- `README.md` is starter documentation unless it has been deliberately updated.
- `app/` and `components/` define current product behavior.
- Older attachments, handoffs, brainstorms, and chat history are context, not
  authority, unless the user explicitly promotes a decision into tracked docs or
  code.

## Start Substantial Sessions This Way

Before editing files for anything larger than a tiny mechanical change:

1. Read `AGENTS.md`, this workflow, and `docs/model-effort-workflow.md`.
2. Recommend the lowest adequate effort level for the current task when the
   task is broad, risky, or ambiguous.
3. Confirm the current branch and worktree state.
4. Identify the directories likely to change and read every applicable nested
   `AGENTS.md` from the repository root down to those directories.
5. Confirm the current unit of work with the user when scope is not obvious.
6. Debrief the work:
   - intended user-visible outcome;
   - explicit non-goals and stopping point;
   - technical approach and decisions still open;
   - expected files, services, dependencies, and environment variables;
   - verification commands and manual QA;
   - commit and PR boundary;
   - proportional review gate.
7. Break the work into sequential tasks when the change is more than one
   coherent edit.
8. Propose the intended commit sequence when the work naturally divides into
   multiple reviewable commits.
9. Wait for explicit approval before broadening scope, installing new
   dependencies, committing, pushing, or taking GitHub actions.

Repository-wide workflow files establish the process and approval boundaries.
Nested guidance may refine instructions for its subtree but may not weaken
repository-wide scope, privacy, security, approval, or review requirements. Stop
and resolve conflicting guidance before editing.

## Work Planning Checklist

Before writing non-trivial code, agree on:

- unit goal and acceptance criteria;
- user-visible outcome;
- effort recommendation when useful;
- technical approach;
- dependency or service changes;
- data, storage, and migration effects;
- environment-variable names without secret values;
- assets to copy or generate;
- automated verification and manual QA;
- commit strategy and PR boundary;
- review strategy.

Explain and obtain agreement before choosing a new framework, dependency,
external service, datastore, or foundational pattern.

## Implementation Rules

- Keep work within the agreed unit.
- Do not begin the next unit without a new debrief when scope changes
  materially.
- Do not install dependencies until their purpose is understood and accepted.
- Do not start a development server unless the user expects a preview or it is
  required for verification.
- Preserve `.env` and other ignored local configuration.
- Use conventional commit messages.
- Keep tracked documentation generic: never record credentials, developer
  machine paths, local infrastructure topology, private operational details, or
  real user data.
- Keep wallet authentication and membership authorization server-validated; UI
  checks may improve experience but must not become the only guard.
- Keep S3 credentials and signed URL generation server-side.

## Verification

Use the narrowest verification that proves the change, then broaden for shared
or security-sensitive behavior.

Common checks:

- `pnpm lint`
- `pnpm build`

Notes:

- This project uses pnpm. The workspace file also stores pnpm settings such as
  approved package build scripts.
- `pnpm build` may need network access because `next/font/google` fetches
  Titillium Web during the build.
- If the shell can run `pnpm` but not package binaries, confirm `node` is on
  `PATH` before treating script failures as project failures.

## Review And Closeout

Before declaring work complete or preparing a pull request:

1. Run the agreed verification commands.
2. Review the diff for correctness, regressions, accessibility,
   maintainability, unnecessary complexity, and scope compliance.
3. Perform a privacy and security pass:
   - confirm local environment files and secrets are ignored;
   - confirm no credentials, private hostnames, local absolute paths, private
     URLs, internal notes, or real user data are tracked;
   - confirm public UI copy does not expose implementation details;
   - confirm authentication, membership checks, storage, signed URLs, and
     external calls are intentional and approved.
4. Use the proportional review gate below for consequential changes.
5. Resolve accepted findings and rerun affected verification.
6. For UI changes, perform user-facing QA when feasible and approved,
   including browser inspection for responsive layout and wallet-related states
   that can be safely exercised.
7. Summarize what changed, verification and QA evidence, deviations, and
   remaining work.
8. Keep the PR boundary narrow enough to review comfortably.

Read `docs/pr-review-workflow.md` before opening or updating a pull request, or
before responding to review feedback.

## Review Gate

Use a fresh review pass after implementation and automated verification are
complete, but before publication, for consequential changes.

### Reviewer Count

- Use one fresh-context, read-only reviewer for a normal commit or PR-sized
  unit when review is warranted.
- Use two reviewers with distinct specialties when work materially changes
  authentication, authorization, privacy, security, storage, data integrity,
  foundational architecture, or external integrations.
- Add reviewers only when they have clearly different responsibilities.

Useful specialties include:

- **Technical:** correctness, failure modes, tests, architecture, runtime
  behavior, dependencies, unnecessary complexity, and scope compliance.
- **Security and privacy:** wallet signatures, authorization, secrets, data
  handling, S3 access, signed URLs, external calls, and trust boundaries.
- **Experience:** user-visible behavior, accessibility, responsive layout,
  keyboard and touch operation, and control clarity.

### Review Procedure

1. Finish implementation and its verification.
2. Freeze implementation edits while reviewers inspect the work.
3. Give each reviewer the approved goal, acceptance criteria, stopping point,
   relevant docs, and complete diff from the intended base.
4. Keep reviewers read-only. They report findings but do not edit, commit,
   push, merge, or broaden scope.
5. Require evidence-based findings with severity, tight file and line
   references when applicable, the violated contract or risk, and a concise
   correction direction. Reviewers explicitly report when no actionable issue
   exists.
6. Classify findings:
   - **P0:** catastrophic or unsafe; blocks acceptance immediately.
   - **P1:** material correctness, security, privacy, or data-loss risk; blocks
     merge.
   - **P2:** important scope, maintainability, testing, accessibility, or
     operational issue; normally fix before merge.
   - **P3:** minor improvement that may be fixed or explicitly deferred.
7. Evaluate every finding rather than accepting it automatically.
8. Apply agreed fixes and rerun affected verification.
9. Request focused re-review of material fixes and disputed findings.
10. Report material deferred or unresolved findings to the user and record them
    in durable docs only when approved.

Independent review supplements rather than replaces automated tests, runtime
verification, privacy and security checks, and user acceptance. If independent
agents are unavailable, perform a distinct fresh-context review pass and clearly
disclose that it was not independently delegated.
