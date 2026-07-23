# AGENTS.md

These instructions apply to the entire repository.

## Workflow

- Follow `docs/session-workflow.md` for substantial work.
- Use `docs/model-effort-workflow.md` when recommending effort for broad,
  ambiguous, or risky tasks.
- Use `docs/pr-review-workflow.md` before inspecting, addressing, or replying
  to pull-request feedback.
- For tiny mechanical edits, keep the process lightweight, but still check the
  worktree, preserve user changes, and verify appropriately.

## Project Shape

- This is a Next.js 16 App Router app using React 19.
- Package manager is pnpm. Use `pnpm install`, `pnpm lint`, and `pnpm build`.
- `pnpm-workspace.yaml` is used for pnpm settings even though the repo has one
  root package. Keep `packages: ["."]` if the file remains present.
- UI is built with Chakra UI plus RainbowKit, Wagmi, Viem, TanStack Query, and
  React Icons.
- The main page gates access by connected wallet, Gnosis-chain token balance,
  and a signed message.
- API routes under `app/api/` verify the signed message server-side, fetch
  membership data from an external subgraph, and create S3 signed URLs.

## Repository Map

- `app/page.tsx`: client flow for wallet connection, balance check, message
  signing, file list fetching, and file link requests.
- `app/layout.tsx`: global providers, RainbowKit/Wagmi setup, Google font, and
  page frame.
- `app/api/files/route.ts`: verifies membership and returns available S3
  objects.
- `app/api/channel/route.ts`: verifies membership and returns a short-lived
  signed URL for one S3 object.
- `app/api/shared/memberAuth.ts`: shared request validation, message constant,
  member query, and membership error text.
- `app/config.ts`: server-side S3 client configuration from environment
  variables.
- `app/utils/requests.ts`: client request helpers and API error normalization.
- `components/ui/`: Chakra UI helper snippets.

## Security And Privacy

- Never commit `.env` files, credentials, private URLs, local machine paths, or
  real user data.
- Keep `S3_KEY`, `S3_SECRET`, `S3_ENDPOINT`, and related storage configuration
  server-side only.
- Do not move signed URL creation to the client.
- Treat wallet UI checks as experience improvements only; server routes must
  remain the authorization boundary.
- Preserve request-body validation before using signatures or S3 object keys.
- Avoid logging secrets, signatures, signed URLs, or sensitive response bodies.
- Discuss any change to the membership source, sign message, token threshold,
  chain, bucket, or external API before implementing it.

## Environment Variables

Known environment variable names:

- `NEXT_PUBLIC_PROJECT_ID`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_KEY`
- `S3_SECRET`
- `JWT_SECRET`

Document variable names when needed, but never document secret values.

## Verification

Run focused checks for the files you touch. Preferred repo-level checks:

- `pnpm lint`
- `pnpm build`

Build notes:

- `pnpm build` may need network access for `next/font/google`.
- If pnpm can start but package binaries fail with `node: not found`, fix the
  shell's Node runtime before diagnosing the repo.

## Style

- Follow existing Next App Router, React, TypeScript, and Chakra patterns.
- Keep changes small and reviewable.
- Prefer typed request validation at API boundaries.
- Use conventional commit messages.
- Do not introduce new dependencies, services, storage, or authentication
  patterns without explaining the tradeoff first.
