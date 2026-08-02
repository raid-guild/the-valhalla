# Session Workflow

The Valhalla work may continue across multiple Codex sessions,
branches, and pull requests. Rebuild the working context deliberately before
editing, and keep each change bounded by an agreed outcome.

## Sources of Truth

Use these sources in order:

1. The user's current request, acceptance criteria, and explicit decisions.
2. The reviewed `main` branch as the implementation baseline.
3. The current repository code, `README.md`, and durable documents in `docs/`.
4. Reviewed local changes in the active worktree.

Older handoffs, attachments, brainstorms, and chat history are useful context,
but they are not authoritative when they conflict with the current request or
repository. Surface conflicts instead of silently choosing one.

## Start Every Session This Way

1. Confirm the repository, current branch, and worktree status. Preserve
   unrelated user changes.
2. Read every applicable `AGENTS.md` from the repository root down to the
   directories likely to change.
3. For Next.js work, read the relevant installed guide in
   `node_modules/next/dist/docs/` before editing. This repository may use APIs
   and conventions that differ from prior Next.js versions.
4. Read the durable workflow that applies to the task:
   - `docs/model-effort-workflow.md` for broad, ambiguous, or risky work;
   - `docs/pr-review-workflow.md` before handling PR review feedback.
5. Inspect the implementation, tests, configuration examples, and documentation
   directly related to the request.
6. Restate the goal, important non-goals, likely files or systems, and proposed
   verification when the task is broad or ambiguous.
7. Identify any decision that would materially change product behavior,
   architecture, dependencies, data, privacy, security, cost, or external
   state. Ask the user before making that decision.
8. Break substantial work into sequential tasks and keep the user informed
   while work is in progress.

Do not require a new planning round for a narrow, already-approved change.
Proceed with reasonable, reversible assumptions when the repository resolves
the details and the result remains within the agreed scope.

## Planning Checklist

Before substantial implementation, establish the relevant parts of:

- user-visible outcome and non-goals;
- technical approach and affected trust boundaries;
- data, storage, and compatibility requirements;
- environment variables and secret-handling requirements;
- external APIs, on-chain reads, membership checks, or storage behavior;
- dependencies or services that would be added;
- testing and verification commands;
- preview and manual-QA expectations;
- branch, commit, and PR boundary;
- proportional independent-review strategy.

Explain and obtain agreement before introducing a dependency, service,
foundational pattern, destructive data change, or material expansion of scope.

## Implementation Rules

- Keep changes within the agreed feature or fix.
- Treat `main` as the reviewed baseline and use a clearly named feature branch
  before publishing work.
- Preserve existing and unrelated worktree changes.
- Keep credentials, signatures, signed URLs, private endpoints, real user data,
  and internal-only notes out of source, tests, logs, screenshots, and
  documentation.
- Keep `.env` and other local secret files ignored. Read only the exact
  credential needed for an approved workflow, and never print or persist it.
- Do not install dependencies or agent tooling unless the task requires them
  and the choice has been agreed.
- Do not start or expose a development server unless implementation or
  expected QA requires it.
- Keep wallet authentication and membership authorization server-validated;
  client checks may improve the experience but are not an authorization
  boundary.
- Keep S3 credentials and signed URL creation server-side.
- Use conventional commit messages.
- Do not stage, commit, push, open or update a PR, post GitHub replies, resolve
  review threads, or change shared external state without explicit user
  approval.

## Verification

Verification should be proportional to the change and should exercise failure
paths as well as success paths.

Common checks are:

- `pnpm lint`
- `pnpm build`
- focused automated tests when the repository defines them
- `git diff --check`

Notes:

- This project uses pnpm, and `pnpm-workspace.yaml` also stores pnpm settings.
- `pnpm build` may need network access when `next/font/google` fetches fonts.
- If pnpm starts but package binaries report `node: not found`, confirm the
  shell's Node runtime before diagnosing the repository.

Apply additional scrutiny where appropriate:

- For UI changes, test the affected wallet and membership states and relevant
  mobile, tablet, and desktop viewports. Provide a focused manual-QA checklist
  when visual or interactive judgment is material.
- For wallet authentication, membership authorization, S3 access, signed URLs,
  and external APIs, test malformed input, rejection, replay, timeout,
  unavailable-source, and privacy behavior as applicable.
- For documentation-only changes, validate links, commands, file names, and
  repository-specific claims. Do not run unrelated expensive suites solely for
  ceremony.

Record exactly what passed, what was not run, and why.

## Sequential Commit Gates

When a feature is intentionally split into multiple commits:

1. Implement only the current commit's agreed scope.
2. Run proportional verification.
3. Freeze implementation edits and review the exact candidate diff against its
   intended parent.
4. Resolve findings and rerun affected checks.
5. Complete any meaningful manual QA.
6. Present the scope, evidence, review disposition, and QA disposition to the
   user.
7. Wait for explicit approval, stage only the reviewed files, inspect the
   staged diff, and create the approved commit.
8. Start the next commit only after the current boundary is complete.

If implementation accidentally spans several planned commits, preserve the
work but reconstruct and review each candidate boundary before describing it
as sequentially verified.

## Independent Review Gate

Run an independent review after a PR-sized implementation and its automated
verification are complete, but before staging it for publication or declaring
it ready to merge. Earlier narrow reviews do not replace a final integration
review when several changes combine into one feature.

### Reviewer Count

- Use one fresh-context, read-only reviewer for a normal PR-sized change.
- Use two reviewers with distinct specialties when work materially changes
  wallet authentication, membership authorization, privacy, S3 access, signed
  URLs, external integrations, or foundational architecture.
- Add an experience and accessibility reviewer when a change has a substantial
  user-interface surface.
- Avoid repeated general reviews that do not add a distinct perspective.

Useful Valhalla review specialties include:

- **Technical:** correctness, failure modes, Next.js behavior, tests, runtime
  behavior, dependencies, and maintainability.
- **Security and privacy:** wallet signatures, membership authorization,
  secrets, S3 access, signed URLs, external calls, and trust boundaries.
- **Experience and accessibility:** wallet and membership states, responsive
  layout, keyboard and touch behavior, loading and error states, and control
  clarity.

### Review Procedure

1. Finish implementation and run the agreed checks.
2. Freeze implementation edits while reviewers inspect the work.
3. Give reviewers the approved goal, acceptance criteria, non-goals, relevant
   repository guidance, and the complete diff from the intended baseline.
4. Keep reviewers read-only. They report findings but do not edit files,
   create commits, broaden scope, or publish anything.
5. Require evidence-based findings with severity, file and line references,
   the violated contract or risk, and a concise correction direction.
6. Classify findings as:
   - **P0:** catastrophic or unsafe; blocks acceptance immediately.
   - **P1:** material correctness, security, privacy, or data-loss issue;
     blocks merge.
   - **P2:** important maintainability, testing, accessibility, operational,
     or scope issue; normally fix before merge.
   - **P3:** minor improvement that may be fixed now or deliberately deferred.
7. Evaluate every finding rather than accepting it automatically.
8. Fix valid findings, rerun affected verification, and request focused
   re-review for material changes or disputed findings.
9. Present the final findings, fixes, deferred items, and verification evidence
   to the user. The user remains the merge authority.

When delegated reviewers are unavailable or not authorized, perform a
separate fresh-context review pass and disclose that the review was not
independently delegated.

Independent review supplements rather than replaces automated tests, runtime
verification, privacy and security checks, and user acceptance.

## Review and Closeout

Before asking to publish work:

1. Run the agreed verification.
2. Complete meaningful browser or manual QA.
3. Review correctness, regressions, accessibility, and maintainability.
4. Review privacy and security:
   - confirm secret files remain ignored;
   - confirm the diff contains no credentials, signatures, signed URLs, private
     endpoints, real user data, or internal-only notes;
   - confirm public UI and documentation expose only intended information;
   - confirm wallet authentication, membership checks, storage, signed URLs,
     and external calls are intentional.
5. Complete the proportional independent-review gate.
6. Summarize what changed and any deviation from the agreed approach.
7. State exactly which checks passed and any that were not run.
8. List remaining work, deferred findings, deployment notes, and manual-QA
   status.
9. Wait for explicit approval before staging, committing, pushing, or creating
   or updating a PR.

Before opening or updating a PR, or responding to PR review feedback, follow
`docs/pr-review-workflow.md`.
