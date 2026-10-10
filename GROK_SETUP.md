# Portfolio Worker and local development

## Edit Morpheus

The shared system prompt is **`grok-relay/morpheus-prompt.js`**.
Both entrypoints import it; there is no second prompt to keep in sync.

- `grok-relay/agent-worker.js`: active chat entrypoint; adds the bundled portfolio profile, public GitHub retrieval, recent conversation and selected page state.
- `portfolio-context.json`: public professional evidence. Update this to change resume facts.
- `grok-relay/worker.js`: health, display-name moderation and leaderboard routes.

The deployed Worker previously contained an older, narrower prompt. The checked-out prompt supports evidence-based professional judgments and job-description matching. Its wording has been preserved for Arman to edit.

Prompt/source edits need a Worker deployment; changing GitHub files alone does not change the running backend.

## Local preview

```sh
npm install
npm run dev
```

Open http://localhost:4173. Static files reload as they change. Local scores use separate, persistent development storage in ignored `work/dev-kv.json`; they do not pollute the public board.

Without a local model key, chat forwards to the deployed public Worker. To test prompt edits locally, copy `grok-relay/.dev.vars.example` to `grok-relay/.dev.vars`, enter the xAI key privately, then restart the server. Never commit that file.

## Cloudflare configuration

Worker: `arman-dogru-chat`. Entrypoint: `grok-relay/agent-worker.js`.

- `XAI_API_KEY`: encrypted secret, required for chat.
- `XAI_MODEL`: defaults to `grok-4.3`.
- `ALLOWED_ORIGINS`: comma-separated portfolio origins. The older singular `ALLOWED_ORIGIN` also works.
- `LEADERBOARD`: KV binding to `arman-portfolio-leaderboard`; its namespace ID is recorded in Wrangler configuration.
- `PROFANITY_BLOCKLIST_GZ_B64`: optional private, gzip/base64 moderation corpus. No corpus belongs in Git.

If the private corpus is absent, the existing model service checks public display names. Moderation failures fail closed and the browser retains the result for retry.

Deploy with an authenticated Cloudflare CLI:

```sh
npm run deploy:relay
```

Alternatively, build a single module using `npm run build:relay` and paste `work/relay-deploy.js` into the Cloudflare code editor, then deploy. Keep existing encrypted secrets and the KV binding.

## Leaderboard

Routes: `GET /health`, `GET /leaderboard`, `POST /leaderboard`, `GET /leaderboard.svg`.

The Worker validates names, race/track versions, elapsed time, position and recomputed score. Each submission has an independent KV key, so simultaneous players do not overwrite one shared array. The read path merges legacy data and keeps each normalized name's best score. KV propagation can be delayed; successful POST responses include the new entry immediately.

The browser distinguishes a confirmed global save, a pending local save, and rejected input. Pending results remain visible alongside global results and can be retried. Earlier v4 local results are migrated.

The public board is a casual client-reported game leaderboard, not a cheat-proof competition. Origin checks are not authentication. The submission rate limit is best-effort KV-based.

## Sources and privacy

The agent receives bundled public portfolio evidence, public GitHub metadata and targeted README excerpts, recent conversation, selected page/race state, and public leaderboard rows. LinkedIn is a navigation link, not a scraped data source. The browser never receives server credentials, a shell, arbitrary private files or private GitHub data.

Conversation history stays in the visitor's browser; only recent turns are sent to the model service. The Worker does not store chat transcripts.
