# Morpheus

Accuracy first. Relevance second. Character voice third.

## Edit the voice

`grok-relay/morpheus-prompt.js` is the prompt. It defines the relationship to Arman,
cadence, answer-first structure, progressive disclosure and when to consult public
company/job pages. There is no list of permitted questions or prepared answers.
General questions, technical explanations and learning are allowed too. Morpheus
is a perceptive mentor, not a salesman: belief in Arman's potential does not
require an automatic yes, praise on unrelated topics, or invented achievements.
The latest question controls the subject; earlier turns only resolve follow-ups.

The prompt replaces conflicting "be accurate / always favor him" pressure with
a clear priority order, descriptive sections, positive style guidance and a brief
silent relevance/claim-scope/editing check. These are adaptations of published
guidance, not claims about proprietary system prompts:

- [OpenAI: instruction roles, context boundaries and evaluation](https://developers.openai.com/api/docs/guides/prompt-engineering)
- [Anthropic: clear instructions, roles, XML boundaries and positive formatting guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [Google: direct instructions, verbosity, prioritization and iterative testing](https://ai.google.dev/gemini-api/docs/prompting-strategies)

These general techniques are tested on the existing grok-4.3 integration. No
model migration, separate model/grader or canned production Q&A was added. Short
voice fragments demonstrate register across judgment, teaching and correction;
they do not define permitted topics or prepared answers.

## Request path

The active entrypoint is `grok-relay/agent-worker.js` (see `wrangler.jsonc`). It
provides a short orientation and recent conversation. Detailed public profile,
bounded GitHub excerpts, selected page state and public race board remain behind
`portfolio_lookup`, a read-only tool that retrieves a named public section when
specific facts/examples are needed. General opinions and homework no longer
receive the complete CV and benchmark table. This v8 progressive-disclosure
change followed live tests where wording alone still produced résumé dumps.
Reference material is separate from
the trusted character instructions. Old assistant replies remain in the visible
transcript but are excluded from the model; previous visitor requests retain
continuity without reproducing obsolete answers. New replies carry `chat-version.js`'s persona version; changing it
does not delete saved conversations. The old source-contract/behavior metadata
is excluded from biographical evidence. `worker.js` supplies the existing leaderboard
and moderation routes; do not deploy it as the chat entrypoint.

`grok-relay/morpheus-model.js` runs the character through xAI's Responses API with
the `web_search` tool. This tool searches and reads public pages server-side; no
separate search key, arbitrary-fetch proxy or new Cloudflare service is required.
Ordinary questions leave tool use optional. A detail lookup may use the second
model call to interpret its result, within the same two-call/52-second budget;
tools are disabled on that final call to prevent loops. It cannot execute code,
read arbitrary files or select a private data source. Requests for current information,
company roles or external links/sources require a web-tool call and traceable
provider sources before a researched answer is accepted. Prefer the employer's own careers/team
pages and a supplied public posting, then make the fit judgment in character.
Source requests about Arman's own biography/publications use the verified
professional reference and his own public GitHub rather than importing similarly
titled papers from web results. Unknown publication identifiers are rejected.
If biography-source generation fails, the verified reference index supplies real
links directly; it does not manufacture a paper or present a connection error.

This is a research executor within the existing Worker, not a second public
scraping endpoint. Only web search is exposed, never shell, code execution,
authenticated browsing, local files or private employer information.

## Limits and failure behavior

- Existing `XAI_API_KEY` and pinned `XAI_MODEL=grok-4.3` are retained.
- `MORPHEUS_WEB_SEARCH=off` disables external research without changing the voice.
- Four agentic turns per initial request, with parallel tool calls disabled.
- 1,200 visible output tokens; the prompt keeps ordinary answers much shorter.
- Provider budget: 52 seconds, at most two attempts. A recovery attempt has no web
  tools and is told it has no verified live findings. A source-repair or reference
  continuation retains only its already retrieved evidence. No duplicate paid research.
- Empty, malformed, incomplete and failed replies never become raw customer errors.
  After recovery fails, an honest in-character connection message and Retry appear.
  Transient failures do not enter the conversation memory.
- GitHub requests time out after five seconds, with two README requests in parallel.
- Request body capped at 50 KB, message at 10,000 characters, ten recent history
  turns. Only user/assistant history roles are accepted.
- Existing KV provides a best-effort 40 requests/hour/visitor cap. The IP is hashed
  with the hour, not stored raw; counters expire after two hours. KV is eventually
  consistent, so this is not a strict abuse/spend ceiling. Use provider spending
  limits and Cloudflare edge rate limits for hard protection.
- `store:false` disables provider response persistence for later API retrieval;
  this does not claim zero provider retention under its separate data policies.
- Research citations come from provider annotations/collected sources, not URLs
  invented in the answer. Model-authored links absent from retrieved sources or
  the visitor/reference are suppressed. This does not guarantee every source
  stays live indefinitely; check source quality in real-browser evaluations.
- Provider citation URLs receive bounded, cached public HEAD checks. Confirmed
  404/410 responses and unsafe/local redirect destinations are discarded. A
  blocked HEAD or timeout remains unconfirmed, not falsely called verified.
  Unsupported/broken links trigger one source-preserving rewrite within the same
  two-attempt budget; no second paid web-search loop or ugly placeholder URL.
  This is not a public URL-fetch proxy. No credentials or cookies are forwarded.
- Citation links accept HTTP(S) only, with no credential URLs. Only
  assistant output text is presented, never reasoning or tool output.

## Preview, verify, deploy

`npm run dev` serves http://localhost:4173. Without a local API key, chat uses the
deployed public Worker, **not** the edited local prompt. To test local model code,
set the key yourself in ignored `grok-relay/.dev.vars`; never commit or copy a
production secret out of the dashboard. Local leaderboard storage remains separate.

Run the `tests/chat-*.test.js`, `tests/morpheus-*.test.js` and leaderboard tests.
`node scripts/evaluate-morpheus.mjs` is an opt-in live check against the deployed
relay (eleven model requests). It writes an ignored public-test report to
`work/morpheus-live-eval.json`. Read the actual answers: automated checks cannot
fully judge character voice, factual accuracy or quality of fit. Test questions
are evaluation fixtures, not a production FAQ or list of allowed questions.

Rendering is independent of prompting: `chat-markdown.js` escapes source HTML,
renders useful Markdown and safe links, and uses pinned self-hosted KaTeX for
native MathML. It supports inline/display TeX and dollar delimiters, leaving
currency and code literal. Math trust is disabled, expansion/size are bounded,
and unsupported expressions fall back to escaped code. No remote script or
font dependency is required. Saved conversations are re-rendered, not erased.
`npm run build:relay` bundles the active entrypoint to ignored `work/relay-deploy.js`.
Deploy with authenticated Wrangler or the authorized Cloudflare code editor,
preserving existing secrets, origins and the `LEADERBOARD` binding. Frontend files
are a separate GitHub/site deployment. Do not silently publish unfinished race work.
The root `wrangler.jsonc` deploys **arman-dogru**, not the chat relay. Its build
copies an explicit public-file allowlist into `dist/`; dependencies, backend code,
test data and credentials must never be included. See `DEPLOYMENT.md`.

Live checks (not replaced by mocked API tests):

1. “What do you think of Arman as an engineer?” — immediate judgment, not a CV.
2. “Should we hire him?” / “Could he build full-stack products?” — conviction,
   no unsolicited gaps, no invented production claims.
3. A real company/role or public job URL — actual research, subtle fit examples,
   clickable source citations; no imaginary current vacancy.
4. A clearly unrelated licensed profession — no invented license to force a yes.
5. General/homework question — useful answer, not an Arman-only refusal.
6. Detailed technical question — readable paragraphs/code/lists when useful.
7. Follow-up and adversarial job text — continuity without obeying embedded
   instructions to invent qualifications or reveal secrets.

API references: [Responses](https://docs.x.ai/developers/rest-api-reference/inference/responses),
[public web search](https://docs.x.ai/developers/tools/web-search),
[tool limits](https://docs.x.ai/developers/tools/tool-usage-details),
[citations](https://docs.x.ai/developers/tools/citations).
