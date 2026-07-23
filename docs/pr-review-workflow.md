# Pull Request Review Workflow

Use this workflow when inspecting or addressing GitHub pull-request feedback.

## Safety And Authority

- Never expose credentials, private data, production records, local machine
  paths, or infrastructure details in chat, logs, commits, tests, or GitHub
  replies.
- Prefer repository-scoped credentials with the minimum required permissions.
- Keep authentication in approved local tooling, environment variables, or
  ignored files.
- Do not stage, commit, push, post GitHub comments, dismiss reviews, or resolve
  threads without explicit user approval.

## Flow

1. Fetch all unresolved review threads.
   - Preserve thread IDs, file paths, line anchors, resolution state, and
     outdated state.
   - Do not rely only on flat comment lists when thread state matters.

2. Summarize the review map before editing.
   - List each actionable thread.
   - Explain what it claims, whether it appears accurate, and the intended
     response.
   - Separate duplicates, outdated comments, informational notes, and ambiguous
     requests from actionable findings.

3. Validate each finding against the code and approved scope.
   - Inspect the relevant implementation and surrounding behavior.
   - Do not assume the reviewer is correct.
   - If a finding is inaccurate, preserve the evidence needed for a concise
     reply.

4. Fix approved findings locally.
   - Keep each change traceable to its review thread.
   - Prefer cohesive fixes and verification over one commit per comment.
   - Pause when feedback conflicts with product intent, another comment, the
     approved scope, or a safety boundary.

5. Verify the selected fixes.
   - Run focused checks for narrow changes.
   - Run broader checks for shared behavior, wallet authentication, membership
     authorization, S3 access, external APIs, or user flows.
   - Record exactly which checks passed and which could not run.

6. Report local results before publication.
   - List fixed threads.
   - List intentionally unchanged or partially addressed threads with reasons.
   - List changed files and verification evidence.
   - Ask before staging, committing, pushing, or replying on GitHub.

7. Reply only after approval and publication.
   - When code changed, reply after the fix is pushed.
   - Include the commit SHA when available.
   - State what changed and what verification supports it, or why no change was
     made.
   - Leave resolution to the user unless they explicitly delegate it.

## Reply Style

Good replies are brief and evidenced:

- `Addressed in abc1234 by validating the request body before creating a signed URL. Verified with pnpm lint and pnpm build.`
- `Leaving this unchanged because the approved behavior requires the current membership gate; the route still verifies the signed message server-side.`
- `Partially addressed: the UI now prevents the invalid action, while the server guard remains the source of truth.`

Avoid vague replies such as `Fixed`, unnecessary implementation narration,
sensitive values, and resolving threads without permission.
