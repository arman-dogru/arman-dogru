# Portfolio services

Two production services are used by this portfolio:

- `arman-dogru`: public frontend. Root `wrangler.jsonc`; automatic builds from
  `main`, deploy command `npx wrangler deploy`.
- `arman-dogru-chat`: chat, server-side public web research and leaderboard API.
  `grok-relay/wrangler.jsonc`; active entrypoint `agent-worker.js`.

The old account services named `web-search`, `websearch` and `openlink` are not
dependencies of this portfolio. Do not modify them as part of a portfolio release.

## Frontend release

`node scripts/build-site.mjs` prepares `dist/` from an explicit public-file
allowlist plus `assets/`. It rejects symlinks and oversized assets. The production
build starts from committed GitHub state, so uncommitted local race development
is not included. Do not run a manual frontend deployment from a dirty checkout.

Before pushing a release, run the chat, worker, leaderboard and site-build tests.
Check the deployed build's commit and success status in Cloudflare, then confirm
the live chat renders code and source links. Requesting `/grok-relay/worker.js`,
`/.env`, `/package.json` or `/node_modules/` must not expose repository files.

The former deployment failed because it inferred the entire repository as its
asset directory and tried to upload a 129 MiB `workerd` dependency. The explicit
`dist/` configuration prevents that failure and unintended file publication.

## Chat / research / leaderboard release

Run `npm run build:relay`. Deploy the bundle with authenticated Wrangler or the
authorized Cloudflare editor. Preserve the encrypted `XAI_API_KEY`, pinned
`XAI_MODEL=grok-4.3`, allowed portfolio origins and `LEADERBOARD` KV binding.
Never copy a production secret out of the dashboard.

Verify `/health`, a real `/chat` request, actual research with provider citations,
an allowed-origin preflight, rejected invalid requests, `/leaderboard` and
`/leaderboard.svg`. A production score-write test may reuse the existing zero-score
`Save Check` entry; do not fabricate a competitive score or delete real entries.

Health checks confirm configuration, not model quality. Read the answers, open
returned sources, and test the deployed frontend as well as the API.
