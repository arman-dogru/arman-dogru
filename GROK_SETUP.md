# Cloudflare portfolio backend

`grok-relay/worker.js` serves two small backend features for the portfolio:

1. the Grok Q&A panel; and
2. the Istanbul Park leaderboard.

The browser never receives the xAI key or the private moderation corpus.

## Worker variables and secrets

Configure these on the `arman-dogru-chat` Worker:

- `XAI_API_KEY` — secret, required for chat.
- `XAI_MODEL` — optional, defaults to `grok-4.3`.
- `ALLOWED_ORIGIN` — set to the production portfolio origin, for example `https://arman-dogru.arman-dogru.workers.dev`.
- `PROFANITY_BLOCKLIST_GZ_B64` — secret, required for global score submissions. It is a gzip-compressed, base64-encoded newline-separated moderation list.

The chat uses one model request per visitor question, `reasoning_effort: "none"`, `temperature: 0.15`, and a short output cap. It has no tools, browsing, recursive calls, or agent loop.

Conversation history is kept in the visitor's browser and only the most recent turns are sent with each chat request. The Worker does not persist chat transcripts.

## Leaderboard storage

Create a Cloudflare KV namespace and bind it to the Worker with the binding name:

```text
LEADERBOARD
```

In the Cloudflare dashboard this is under the Worker's **Settings → Bindings** section.

The Worker exposes:

```text
GET  /leaderboard
POST /leaderboard
GET  /leaderboard.svg
```

The browser posts scores directly to the Worker. The Worker recomputes the score from elapsed time and finishing position, validates the race/track version, validates the display name, applies the private moderation corpus, rate-limits submissions, and keeps the best score for each normalized display name.

`/leaderboard.svg` renders the same board as an SVG so the GitHub profile can display it without committing leaderboard updates back into the repository.

If the KV binding is missing, chat continues to work and the race falls back to a local browser board.

## Private moderation corpus

Create a local `blocklist.txt`, one term per line, then encode it without committing the source file:

```bash
gzip -c blocklist.txt | base64 | tr -d '\n'
```

Paste the result into the Cloudflare secret `PROFANITY_BLOCKLIST_GZ_B64`.

The public repository contains normalization and validation logic, but no profanity corpus.
