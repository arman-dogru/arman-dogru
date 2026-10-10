# Grok portfolio chat setup

The browser never receives the xAI API key. `grok-relay/worker.js` is a minimal Cloudflare Worker-style relay that performs exactly one model request per visitor question.

## Model and cost controls

The relay defaults to `grok-4.3` with `reasoning_effort: "none"`, `temperature: 0.15`, and `max_tokens: 180`. There are no tools, searches, function calls, recursive agents, or follow-up model loops.

Environment variables / secrets:

- `XAI_API_KEY` — required secret.
- `XAI_MODEL` — optional override. Default: `grok-4.3`.
- `ALLOWED_ORIGIN` — strongly recommended; set it to the production portfolio origin.

For Cloudflare, also add an edge Rate Limiting rule for the worker route. A reasonable portfolio limit is 6–10 requests per IP per minute with a small daily budget/alert at the xAI account level.

## Scope guardrails

The system prompt allows answers only about Arman Doğru's public professional background, education, research, publications, and public projects. It explicitly blocks prompt override attempts, private-personal inference, unrelated questions, unpublished/confidential research claims, tool use, browsing, and chain-of-thought disclosure.

The relay additionally:

- accepts POST only;
- requires JSON;
- limits request bodies and question length;
- normalizes Unicode/control characters;
- restricts CORS when `ALLOWED_ORIGIN` is configured;
- does not return upstream error bodies to clients;
- sends one model request and returns one short text answer.

## Front-end configuration

After deployment, either define before `terminal.js` loads:

```html
<script>window.ARMAN_CHAT_ENDPOINT = "https://your-worker.example.workers.dev/";</script>
```

or use the terminal once in that browser:

```text
connect-chat https://your-worker.example.workers.dev/
```

Then:

```text
chat what did Arman work on at Huawei?
```
