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

Feedback about Morpheus, clarification, corrections, style requests and social
reactions are valid conversation, not unrelated substantive tasks. This routing
remains model-led, without a keyword META classifier or canned acknowledgments.
It does not authorize an unrelated exercise hidden in feedback. Learning-potential
follow-ups resolve against the preceding role discussion: unsupported present
expertise does not imply inability to learn or establish a time to proficiency.
The mentor relationship and conviction that Arman is the One survive criticism;
they do not become invented credentials or a claim of domain readiness.
A silent semantic repetition check considers the previous two replies. A bounded
lexical near-duplicate guard additionally permits one context-aware regeneration
within the existing deadline/call budget, without fresh paid research or a default
replacement. Legitimately repeated facts and repeated exercises remain possible.

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

### Authoritative knowledge and the Matrix

`grok-relay/arman-knowledge.json` is the curated professional record derived from
**Arman_Dogru_master_resume.md**, organized September 23, 2026. Its source hash
records the exact input edition. Update this record when Arman supplies an
approved factual revision; do not let retrieval update it automatically. The raw
document, personal phone/email and document workflow instructions are not copied
into public assets or model context. Professional facts in this record are intended
for public portfolio answers; backend-only packaging does not make them confidential.
The original document remains outside the repository.

`knowledge-context.js` supplies labelled, read-only sections and the established
identity/account links. The precedence is internal résumé facts, attributable
linked resources, independently checked external findings, then search snippets.
Reviewed portfolio-only implementation notes retain the existing Skate 3 and race
explanations as subordinate supplements; they cannot replace biographical facts.
`portfolio-context.json` is now a legacy public snapshot, **not** the agent's fact
source. Its old publication URL is not imported as résumé evidence: the supplied
résumé names the paper but gives no exact arXiv identifier.

`github-context.js` queries only the résumé's GitHub owner, then verifies API
`owner.login`, `full_name` and `html_url` before admitting a public repository or
reading its README. It does not import remote profile bios, jobs, contact details
or discovered social accounts. A matching person's name never establishes identity.
README excerpts remain untrusted content even after account attribution succeeds.
Unavailable/mismatched retrieval is UNKNOWN, never a reason to substitute another
account. Fork status remains explicit.

Lookup results retain INTERNAL, VERIFIED_EXTERNAL, MATRIX or UNKNOWN provenance;
the prompt distinguishes INFERENCE for synthesis/fit judgments. Returned researched
citations carry source attribution metadata, not a blanket claim that every linked
sentence is true. Visitor page state and board entries are low-trust display context,
not biography. Ordinary answers do not print these labels or source hashes. Morpheus
may introduce current outside findings as something found “on the Matrix,” sparingly.
Outside conflicts do not silently replace or merge with the internal record.

The orientation is explicitly a summary, not an exhaustive record. A small,
data-derived project index exposes up to three relevant titles and exact links.
`knowledge-search.js` now scans all canonical sections before generation and ranks
up to six matching records with source attribution and actual evidence, omitting
unrequested measurements. Titles alone caused false “not recorded” answers in live
testing, so discovery includes matching facts, not just metadata. Ordinary opinion
queries without concrete subjects do not receive this factual shortlist.
Every named canonical lookup also returns ranked cross-section evidence; `search`
offers corpus-wide retrieval directly. Research, experience, projects, skills,
education and reviewed portfolio supplements are searched together. Visitor page
state, leaderboard entries and external biographies never enter that index.
Primary-subject coverage, term specificity and title matches drive the local lexical
ranker. The model can supply up to four semantic query expansions; they improve
recall but do not override the original subject or establish credentials. The prompt
compares direct work before adjacent experience, transfer and speculation. Ranking
signals are not confidence or proof of domain readiness. This adapts query rewriting
and relevance-ranking principles in [OpenAI Docs](https://developers.openai.com/api/docs/guides/retrieval),
without adding an embedding provider, remote vector store or domain-specific rules.
It does not decide scope or generate answers. Detailed explanations retain the
read-only lookup and explicit access to requested measurements.
Unknown attribution stays unknown; it does not establish either ownership or that
the resource definitely belongs to someone else. The server's UTC request date
helps distinguish current opportunities from stale program pages.

This uses the explicit context boundaries and regression-testing approach in
[OpenAI Docs](https://developers.openai.com/api/docs/guides/prompt-engineering),
with structured source boundaries informed by
[OpenAI's agent safety guidance](https://developers.openai.com/api/docs/guides/agent-builder-safety).
The hierarchy itself is this portfolio's design, not a claim about a proprietary prompt.

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
continuity without reproducing obsolete answers. Current-version dialogue is sent
as ordered user/assistant messages, separate from the reference material and
trusted instructions. The active visitor request is repeated after a reference
lookup. Once a legitimate new topic has been answered, neutral follow-ups stay
with that topic rather than reviving an older refused exercise. This follows
[OpenAI's conversation-state guidance](https://developers.openai.com/api/docs/guides/conversation-state)
and was verified with the eight-case local intent suite after a live regression
exposed that JSON-embedded history lost the immediate topic. Benchmark-heavy fact bullets
are omitted from ordinary lookups; `include_measurements` makes them available
when quantitative results are requested. New replies carry `chat-version.js`'s persona version; changing it
does not delete saved conversations. The old source-contract/behavior metadata
is excluded from biographical evidence. `worker.js` supplies the existing leaderboard
and moderation routes; do not deploy it as the chat entrypoint.

`grok-relay/morpheus-model.js` runs the character through xAI's Responses API with
the `web_search` tool. This tool searches and reads public pages server-side; no
separate search key, arbitrary-fetch proxy or new Cloudflare service is required.
Ordinary questions leave tool use optional. A detail lookup uses a continuation
to interpret its result. For current external requests, that continuation may
research the world after consulting the internal record; it cannot request another
portfolio tool. A first-generation batch can contain up to three read-only lookup
calls; outputs retain their individual call IDs and provenance. Larger batches,
duplicate call IDs and unknown functions are rejected. The overall deadline remains 52 seconds, with at most three calls
only after a successful lookup (two otherwise). Repair/recovery cannot start new
research.
For current/external requests, both tools remain available initially. Removing web
access until a lookup caused a live regression where the model incorrectly claimed
it could not access current pages, so that experimental restriction was discarded.
Scope is judged by the model: unrelated requests can decline naturally without
retrieving anything. Internal facts retain priority regardless of tool-call order.
An accessible page is not sufficient proof of current availability, and an unknown
identity connection is not proof that a resource belongs to a different person.
It cannot execute code,
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
- Four agentic turns per tool-enabled generation, with parallel tool calls disabled;
  web search is available in at most one generation per visitor request.
- 3,000 output tokens including low-effort reasoning; the prompt keeps ordinary
  answers much shorter. The existing grok-4.3 model is unchanged.
- Provider budget: 52 seconds, two attempts or at most three after a successful
  internal lookup. A recovery attempt has no web
  tools and is told it has no verified live findings. A source-repair or reference
  continuation retains its retrieved evidence and any earlier Matrix findings.
  A successful lookup can be followed by research for a current external question;
  research already performed is not repeated on continuation, repair or recovery.
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
  bounded request budget; no second paid web-search loop or ugly placeholder URL.
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
Use `node scripts/evaluate-morpheus.mjs --suite=knowledge` for eight checks of exact
profile links, namesake accounts, conflicting education dates, new résumé projects,
fabricated credentials, current Tesla requirements, inference and concise opinions.
Suite reports are saved separately under ignored `work/morpheus-live-eval-<suite>.json`.
For a focused rerun, add `--case="exact case name"` (repeatable); conversation
prerequisites are included automatically. Targeted reports use a `-targeted` suffix,
so the full-suite report is preserved. An unknown case name fails rather than
silently producing an empty success. Match checks are reviewed against real answers:
an uncertainty response need not echo a known account unless asked, and the correct
school year answers a conflicting-year question without compulsory discrepancy prose.
Unknown-person attribution, unsupported quality upgrades and past-dated cohorts
are checked explicitly. These tests remain evidence, not a guarantee of every answer.
Local verification on October 11, 2026 ran all sixteen knowledge/intent scenarios
and inspected their actual replies. Iteration corrected unfamiliar-project denial,
lost follow-up context, unjustified namesake exclusion, stale opportunity cohorts,
source jargon and missing example links. The final v25 targeted rerun passed all
five cases, including the complete boundary-to-legitimate-follow-up chain; the
full v24 reports remain preserved rather than relabelled as v25 results. All 104
automated checks and both builds passed on v25. Tesla research returned provider
citations, but direct source checks received HTTP 403, not independent confirmation
of vacancy availability. This combines task-specific checks with human review,
as recommended in [OpenAI's evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices).
Reports and diagnostic scripts stay ignored; nothing was pushed or deployed.
The subsequent v27 local candidate adds thirteen dialogue scenarios: direct versus
transfer evidence, paraphrased requirements, publications without file hints,
unfamiliar-domain learning and time uncertainty, feedback/clarification/persona,
social acknowledgment, self-correction and meta-wrapped unrelated work. All 29
knowledge/intent/dialogue scenarios ran on v26; nine affected cases were rerun on
v27, followed by two exact-context sequential replays. Behavioral failures were
cleared in those replays, but intermittent unusable upstream generations occurred
before retry; original failed reports remain visible rather than being overwritten
as clean passes. This is not a claim of production-grade availability or perfect
voice. The OSM/earlier-Morpheus checkpoint `a6312f7` was separately approved and
pushed; these new v27 changes remain local for Arman's adversarial testing. All 112
automated checks and both builds passed on this candidate.
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
