# PR Review Comment Workflow

Use this workflow when an agent is asked to handle GitHub PR review feedback.

## Safety

- Do not paste tokens, secrets, private data, or real user data into chat, logs,
  commits, tests, or GitHub replies.
- Prefer repository-scoped credentials with the minimum permissions needed.
- Use the connected GitHub app and repository-scoped credentials as directed by
  `AGENTS.md`; keep credentials in approved environment variables or ignored
  local files.
- Do not stage, commit, push, comment, dismiss reviews, or resolve GitHub
  threads without explicit user approval.

## Flow

1. Fetch all unresolved review threads first.
   - Preserve thread IDs, file paths, line anchors, resolution state, and
     whether comments are outdated.
   - Avoid relying only on flat comment lists when thread state matters.

2. Summarize the review map before editing.
   - List each actionable thread.
   - For each thread, state what it claims, whether it appears accurate, and
     the intended action.
   - Separate duplicate, outdated, informational, or ambiguous comments from
     actionable ones.

3. Validate each comment against the code.
   - Inspect the relevant code and surrounding behavior.
   - Do not assume the reviewer is correct.
   - If the comment is inaccurate, record the reason for the eventual reply.

4. Fix valid comments locally.
   - Keep changes traceable to the review thread.
   - Prefer cohesive local fixes over one commit or push per comment.
   - If a comment conflicts with product intent or another comment, pause and
     explain the tradeoff.

5. Verify after the selected fixes.
   - Run the smallest useful tests for narrow changes.
   - Run broader checks for shared behavior, wallet authentication, membership
     authorization, S3 access, signed URLs, external APIs, or UI flow.
   - Record exactly which checks passed or could not be run.

6. For PR-sized fixes, complete the independent-review gate from
   `docs/session-workflow.md` after automated verification and before staging
   or describing the changes as ready to merge.

7. Summarize local results to the user.
   - List fixed threads.
   - List intentionally unchanged threads and why.
   - List files changed and verification commands.
   - Ask before staging, committing, pushing, or posting GitHub replies.

8. Reply to GitHub threads only after approval.
   - Reply after code is pushed when a code fix was made.
   - Include the commit SHA or short SHA that contains the fix when one is
     available.
   - Keep replies concise and specific: what changed, what check supports it,
     or why it was left unchanged.
   - Leave thread resolution to the user unless they explicitly ask the agent
     to resolve threads.

## Reply Style

Good replies:

- `Addressed in abc1234 by validating the request body before creating a signed URL. Verified with pnpm lint and pnpm build.`
- `Leaving this unchanged: the route intentionally verifies membership server-side because the wallet UI check is not an authorization boundary.`
- `Partially addressed: the UI now blocks the invalid action, while the API route retains the server-side guard.`

Avoid:

- exposing secrets, wallet signatures, signed URLs, or private user data;
- vague replies like `Fixed`;
- resolving threads without the user's permission.
