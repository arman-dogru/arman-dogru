# Cloudflare portfolio backend

`grok-relay/worker.js` serves the portfolio's public-professional Q&A agent and the Istanbul Park leaderboard.

The browser never receives the xAI key or private moderation corpus.

## Morpheus: source-driven, not example-driven

Morpheus is intentionally **not** scoped by a hand-written set of sample questions. The scope is semantic: questions about Arman Doğru's public professional identity, education, career, research, publications, skills, public repositories/projects, engineering choices, career trajectory and professional fit are in scope even when the wording has never been anticipated by the site author.

For each chat request the Worker can assemble context from:

- `portfolio-context.json` — the canonical bundled public professional knowledge base;
- live public GitHub user/repository metadata and, when a repository matches the question, a targeted public README;
- curated page state sent by the browser: active tab, selected public career event, race state, theme and public paddock entries; and
- the public race leaderboard stored in KV.

LinkedIn is a navigation link only. The Worker does not scrape or authenticate to LinkedIn. Morpheus does not receive arbitrary DOM access, a shell, filesystem access, private GitHub data, browser secrets or private environment variables.

A master resume is useful, but do not expose the raw document by default. The preferred workflow is to use it to update `portfolio-context.json` after removing anything that should not be public. That gives the agent a richer canonical source without turning a private resume into a public asset.

## Worker variables and secrets

Configure these on the `arman-dogru-chat` Worker:

- `XAI_API_KEY` — secret, required for chat.
- `XAI_MODEL` — optional, defaults to `grok-4.3`.
- `ALLOWED_ORIGIN` — production portfolio origin, e.g. `https://arman-dogru.arman-dogru.workers.dev`.
- `PROFANITY_BLOCKLIST_GZ_B64` — secret, required for global score submissions.

The chat uses one model request per visitor question. Conversation history stays in the visitor's browser; only recent turns and the curated current page state are sent with a request. The Worker does not persist chat transcripts.

The relay treats retrieved source blocks as data, not instructions, to reduce prompt-injection risk from public repository text.

## Leaderboard storage

Create a Cloudflare KV namespace and bind it to the Worker with the binding name:

```text
LEADERBOARD
```

The Worker exposes:

```text
GET  /leaderboard
POST /leaderboard
GET  /leaderboard.svg
```

The browser posts scores directly to the Worker. The Worker recomputes the score from elapsed time and finishing position, validates the race/track protocol, validates the display name, applies the private moderation corpus, rate-limits submissions, and keeps the best score for each normalized display name.

`/leaderboard.svg` renders the same board as an SVG so the GitHub profile can display it without committing leaderboard updates back into the repository.

If the KV binding is missing, chat continues to work and the race falls back to a local browser board.

## Private moderation corpus

Create a local `blocklist.txt`, one term per line, then encode it without committing the source file:

```bash
gzip -c blocklist.txt | base64 | tr -d '\n'
```

Paste the result into the Cloudflare secret `PROFANITY_BLOCKLIST_GZ_B64`. The public repository contains normalization and validation logic, but no profanity corpus.

## Deployment note

Changing `grok-relay/worker.js` in GitHub updates the source of truth, but the running Worker must also be deployed (or connected to an automatic Git deployment) before new retrieval behavior is live.
