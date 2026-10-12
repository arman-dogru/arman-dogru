# Morpheus

Morpheus is Arman's portfolio guide. He speaks as a mentor with conviction, while keeping claims grounded. The character never justifies invented experience.

## Where to edit

- `grok-relay/morpheus-prompt.js`: intent planning, character instructions and final editorial review.
- `grok-relay/arman-knowledge.json`: reviewed professional facts from the master résumé; no private contacts or document instructions.
- `grok-relay/knowledge-context.js`: identity, source envelopes and exact profile links.
- `grok-relay/knowledge-search.js`: cross-section discovery, full record inventory and surfaced-evidence tracking.
- `grok-relay/morpheus-model.js`: bounded xAI orchestration, citations, recovery and review.
- `grok-relay/agent-worker.js`: active chat entrypoint, validation, history and visitor limits.
- `tests/fixtures/morpheus-full-suite.json`: evaluation scenarios, never production examples.
- `chat-version.js`: conversation version. Changing it preserves visible history but prevents obsolete assistant prose from priming the model.

## Sources

The internal knowledge defines Arman. The Matrix describes the external world.

INTERNAL facts take priority, followed by VERIFIED_EXTERNAL resources attached to established identifiers, independently checked MATRIX findings and then general snippets. INFERENCE is reasoning, not another source of biographical facts. UNKNOWN remains uncertain.

GitHub retrieval starts from the internal owner and checks API ownership, full name, public visibility and exact URL. A matching name does not verify a profile. An attributable repository does not verify every README claim. Visitor page state, job descriptions, web pages and race-board entries cannot amend identity or issue instructions.

Canonical publications retain their exact titles, venues and status. Unlinked papers must not acquire guessed URLs or identifiers. Source conflicts are resolved in favor of the internal record, without merging incompatible versions.

## Request flow

1. A short orientation and ordered recent dialogue establish the subject and current task.
2. A small independent `resolve_intent` pass classifies the requested deliverable before retrieval. Separate semantic components distinguish information about Arman, a standalone task in his name, and conversation feedback. Unknown facts remain valid portfolio questions; missing answers do not make them unrelated. Feedback and unrelated tasks receive dedicated character instructions, with no résumé retrieval or canned reply.
3. Planning inspects the bounded reviewed record inventory across experience, research, projects, skills, education and portfolio supplements, then selects validated record identifiers for the task. The answer writer sees those selected primary records and available public GitHub excerpts linked to them; the reviewer retains the wider, unabridged inventory to catch omissions. Lexical rankings are navigation aids, not semantic verdicts. Ordinary lookups omit unrequested quantitative fact bullets; detailed case studies and requested results can retain them.
4. The model answers the actual intent. Current opportunities, company requirements or relevant technical context can use public web research after consulting the internal record. Identity lookup cannot discover a new Arman.
5. For portfolio answers, one tool-free-in-the-external-world editorial pass records concrete defects and submits small exact-quote edits through `finalize_answer`. Nonexistent, ambiguous and overlapping quotes are rejected; satisfactory passages remain unchanged. The reviewer checks Arman facts against the full record without treating absence from his résumé as evidence against a separately researched job. It cannot search, execute code or mutate state. Conversation and boundary replies bypass this factual editor. This is an additional quality check, not a guarantee of correctness.
6. The same citation checks run on edited output. Broken or unsupported links trigger a bounded source-preserving rewrite. Resource-attribution turns carry explicit established/unverified states derived from canonical identifiers; an unsupported definitive yes/no triggers an uncertainty-preserving rewrite. Empty/failed output receives recovery or an honest connection message, never a fabricated answer.

“All,” “only,” corrections and “what else” require exhaustive cross-section inspection and coverage awareness. Related employment, project and publication facets can be grouped, not erased. Previously surfaced means mentioned, not exhausted. Truncation never proves completeness; no lexical match never proves inability.

A company-fit question compares demonstrated skills with external requirements; it does not ask whether the company already appears in his employment history. Learning potential is distinct from established domain expertise and unknown time to proficiency.

Scope follows the requested substance. A standalone exercise in Arman's name remains unrelated; synthesis, technical explanations of his actual work, career assessments and grounded hypothetical designs remain useful. Criticism, clarification and social reactions are conversation, not attacks. A genuine topic change resets the immediate frame.

## Safety and limits

- Existing `grok-4.3`, xAI secret, allowed origins and leaderboard binding are retained.
- Trusted instructions use a server-owned system role. Visitor history accepts only user/assistant roles.
- Ten recent messages, 1,800 characters each; visitor messages up to 10,000 characters; request bodies up to 50 KB.
- Overall generation budget remains 52 seconds, including a bounded intent call, at most three main attempts after successful lookup and one optional editorial call. Repair/recovery starts no new research.
- Editorial review is best effort under the deadline; unavailable review does not manufacture approval. The live runner records whether it completed.
- `MORPHEUS_WEB_SEARCH=off` disables external research. No arbitrary-fetch proxy, shell, private files or authenticated browsing is exposed.
- Existing best-effort KV limit remains 40 requests/hour/visitor. Provider spend limits and edge rate limits remain necessary hard boundaries.
- `store:false` disables later API response retrieval, not a promise of zero provider retention.
- Research citations must come from provider-collected sources. Public HEAD checks reject confirmed 404/410 responses and unsafe redirects; blocked/time-out checks remain unconfirmed. A live URL does not prove a vacancy remains open.
- Source HTML is escaped. Markdown, links and bounded self-hosted KaTeX rendering remain independent of prompting.
- Restart chat confirms, aborts pending work and clears only browser conversation/draft/sources. It does not erase race data or other preferences.

## Local verification

Run `npm run dev` for the checked-out Worker at http://127.0.0.1:4173/. Put the key only in ignored `grok-relay/.dev.vars`; never commit it. `/__preview` reports version/readiness without credentials. There is no silent production fallback.

Run `npm test`, `node scripts/build-site.mjs` and `npm run build:relay`.

The full local model evaluation is opt-in:

```sh
node scripts/evaluate-morpheus-full.mjs --live --suite=full --concurrency=2 --report=work/morpheus-full-eval.json
```

It runs 94 specification scenarios and 12 unseen variants through the production model path, isolated from the public chat and leaderboard. Reports contain actual answers, source metadata, tool arguments, timings, implementation fingerprint and rubric flags, never keys. Raw résumé files and private contacts are not sent. Reports stay under ignored `work/`.

Use `--suite=critical`, `--suite=variants` or `--cases=TC-014,GEN-004` for focused reruns. Multi-turn prerequisites stay with each scenario. Unknown IDs fail explicitly. Earlier runners remain available for UI/HTTP smoke tests.

Read every answer. Automated checks cannot establish factual accuracy, current availability or character quality. Keep failed runs, corrections and reruns separately; never relabel a partial run as a complete pass.

## Deploy

The root Worker is the website, not the chat relay. The active backend is `grok-relay/agent-worker.js`, configured by `grok-relay/wrangler.jsonc`.

Use authenticated `npm run deploy:relay`, preserving secrets, origins and the existing leaderboard KV. Pushing frontend code alone does not deploy a changed chat Worker. Public builds use an explicit asset allowlist; backend knowledge, reports, source documents, dependencies and credentials must stay excluded.

## References

The explicit instructions/context boundaries and human-reviewed regression process adapt [OpenAI prompting guidance](https://developers.openai.com/api/docs/guides/prompt-engineering) and [evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices). Provider behavior follows xAI's [Responses API](https://docs.x.ai/developers/rest-api-reference/inference/responses), [function calling](https://docs.x.ai/developers/tools/function-calling), [web search](https://docs.x.ai/developers/tools/web-search) and [citations](https://docs.x.ai/developers/tools/citations). These are public design principles, not claims about proprietary prompts.
