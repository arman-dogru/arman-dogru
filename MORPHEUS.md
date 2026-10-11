# Morpheus

Accuracy first. Relevance second. Character voice third.

## Edit the voice

`grok-relay/morpheus-prompt.js` is the prompt. It defines the relationship to Arman,
cadence, answer-first structure, progressive disclosure and when to consult public
company/job pages. There is no list of permitted questions or prepared answers.
Technical explanations are welcome when they help visitors understand his actual
work or suitability. Material relevance is assessed from the requested substance
and immediate conversation, not name-dropping or an allowlist. Unrelated tasks get
a short, context-aware boundary response, not a solution followed by a pitch or
an automatic redirect question. Obvious wrappers may get dry humor aimed at the
maneuver, never an insult or an explanation of internal detection mechanics.
Repeated attempts are recognized from supplied history, not a separate visitor
profile or persistent blacklist. Genuine portfolio questions resume normally.
This is model-led intent judgment, not a separate classifier/default-answer path.
Name-dropping and interview/roleplay wrappers do not change a task's purpose;
implicit follow-ups, grounded hypotheticals, project comparisons, career synthesis,
technical explanations and the relevant half of mixed requests still get answered.
Morpheus is a perceptive mentor, not a salesman: belief in Arman's potential does not
require an automatic yes, praise on unrelated topics, or invented achievements.
The latest question controls the subject within that purpose; earlier turns resolve follow-ups.

The prompt replaces conflicting "be accurate / always favor him" pressure with
a clear priority order, descriptive sections, positive style guidance and a brief
silent relevance/claim-scope/editing check. These are adaptations of published
guidance, not claims about proprietary system prompts:

- [OpenAI: instruction roles, context boundaries and evaluation](https://developers.openai.com/api/docs/guides/prompt-engineering)
- [Anthropic: clear instructions, roles, XML boundaries and positive formatting guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [Google: direct instructions, verbosity, prioritization and iterative testing](https://ai.google.dev/gemini-api/docs/prompting-strategies)

These general techniques are tested on the existing grok-4.3 integration. No
model migration, separate model/grader or canned production Q&A was added. Live
testing showed that sample voice fragments were being copied, so v9 removed them
in favor of cadence and relationship instructions. Embedded hostile instructions
are ignored without refusing the legitimate question around them.

## Request path

The active entrypoint is `grok-relay/agent-worker.js` (see `wrangler.jsonc`). It
provides a short orientation and recent conversation. Detailed public profile,
bounded GitHub excerpts, selected page state and public race board remain behind
`portfolio_lookup`, a read-only tool that retrieves a named public section when
specific facts/examples are needed. General opinions and redirections do not
receive the complete CV and benchmark table. This v8 progressive-disclosure
change followed live tests where wording alone still produced résumé dumps.
Reference material is separate from
the trusted character instructions. Old assistant replies remain in the visible
transcript but are excluded from the model; previous visitor requests retain
continuity without reproducing obsolete answers. Current history is quoted as
data, not replayed as assistant demonstrations, and the active visitor request
is repeated after a reference lookup. This prevents a previous homework answer
from becoming the answer to a new company question. Benchmark-heavy fact bullets
are omitted from ordinary lookups; `include_measurements` makes them available
when quantitative results are requested. New replies carry `chat-version.js`'s persona version; changing it
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
company roles or external links/sources are research hints, not forced tool calls:
the model first decides whether the task serves the portfolio purpose. Unrelated
search requests receive a boundary response without research. Portfolio lookup remains
available alongside a research hint so short follow-ups such as “Any examples
online?” can retrieve the actual preceding project's reference. Recent bounded
conversation also informs GitHub repository selection. Actual researched answers still need
traceable provider sources; unsupported generated links remain filtered. Prefer the employer's own careers/team
pages and a supplied public posting, then make the fit judgment in character.
Source requests about Arman's own biography/publications use the verified
professional reference and his own public GitHub rather than importing similarly
titled papers from web results. Unknown publication identifiers are rejected.
If biography-source generation fails, the verified reference index supplies real
links directly; it does not manufacture a paper or present a connection error.

This is a research executor within the existing Worker, not a second public
scraping endpoint. Only public web research and bounded portfolio lookup are exposed, never shell, code execution,
authenticated browsing, local files or private employer information.

## Limits and failure behavior

- Existing `XAI_API_KEY` and pinned `XAI_MODEL=grok-4.3` are retained.
- `MORPHEUS_WEB_SEARCH=off` disables external research without changing the voice.
- Four agentic turns per initial request, with parallel tool calls disabled.
- 3,000 output tokens including low-effort reasoning; the prompt keeps ordinary
  answers much shorter. The existing grok-4.3 model is unchanged.
- Provider budget: 52 seconds, at most two attempts. A recovery attempt has no web
  tools and is told it has no verified live findings. A source-repair or reference
  continuation retains only its already retrieved evidence. No duplicate paid research.
  Tool-free requests omit tool-choice and agent-loop options; live testing found
  the old empty-tool combination was rejected with HTTP 400, including on repair.
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

`npm run dev` serves http://localhost:4173 and uses the checked-out local prompt.
Set the key yourself in ignored `grok-relay/.dev.vars`; never commit or copy a
production secret out of the dashboard. Missing local credentials fail explicitly:
there is no silent production fallback. The oracle status reads LOCAL PREVIEW
or LOCAL KEY NEEDED, and `/__preview` reports the local version and readiness,
never the key. `npm run dev -- --public-chat` explicitly opts into the deployed
relay and is not a way to test local prompt edits. Local leaderboard storage
remains separate. Restart the development process after changing `.dev.vars`.

Run the `tests/chat-*.test.js`, `tests/morpheus-*.test.js` and leaderboard tests.
`node scripts/evaluate-morpheus.mjs` is an opt-in live check against the deployed
relay (one model request per case), defaulting to the local preview. It writes an ignored test report to
`work/morpheus-live-eval.json`. Read the actual answers: automated checks cannot
fully judge character voice, factual accuracy or quality of fit. Test questions
are evaluation fixtures, not a production FAQ or list of allowed questions.
Use `node scripts/evaluate-morpheus.mjs --suite=intent` for eight local checks of
wrappers, repetition, a legitimate hypothetical, contextual online examples,
project synthesis, technical explanation and legitimate criticism.
Use `node scripts/evaluate-morpheus.mjs http://localhost:4173/api/chat --suite=scope`
for the bounded scope/follow-up suite plus company-research and injection regressions.
This leaves room within the visitor cap for browser QA; the default runs all cases.

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
5. General/homework question — brief natural boundary response, no solution, pitch or policy template.
6. Detailed technical question — readable paragraphs/code/lists when useful.
7. Follow-up and adversarial job text — continuity without obeying embedded
   instructions to invent qualifications or reveal secrets.
8. Unrelated search, name-dropping, interview wrappers, repeated requests, and mixed
   tasks — no accidental general assistant; returning to his work resumes normally.

The visible Restart chat button asks for confirmation before clearing the browser's
conversation and draft. It aborts a pending request, clears displayed sources and
focuses a fresh input; late answers from the old chat cannot reappear. It does not
clear the theme, endpoint, race data, other browser settings or provider-side logs.
The existing `clear` command remains available.

API references: [Responses](https://docs.x.ai/developers/rest-api-reference/inference/responses),
[public web search](https://docs.x.ai/developers/tools/web-search),
[tool limits](https://docs.x.ai/developers/tools/tool-usage-details),
[citations](https://docs.x.ai/developers/tools/citations).
