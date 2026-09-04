# Web Search RAG — Status

Regression-tracking status of the web-search RAG pipeline (branch
`feat/web-search-intent-mvp`), from live-device QA on iOS Simulator, by
category. Each item lists a concrete scenario, its status, and how to verify
it — either an automated test or a manual repro — so a regression can be
caught without re-discovering the original bug from scratch.

Status legend: ✅ verified working / 🔧 known issue, in progress / 💡 proposed
fix, not yet implemented. Untested categories are omitted rather than
guessed at.

## Search frequency / query planning

✅ **Biggest limiter found and fixed: the query planner was misconfigured for
the default model**
Diagnosis: web search only runs when the per-chat "Web" toggle is on AND the
query planner decides `needs_search: true` — that decision (and, in `'llm'`
mode, the actual search query) is itself made by a small on-device LLM call
before the real search happens. For **Qwen 3 - 1.7B** (the app's default
model), that planner call was configured to `webPlanner: 'llm'` in
[constants/model-profiles.ts](../constants/model-profiles.ts) —
**despite this exact model's own recorded benchmark evidence in the same
file** (`PLANNER_EVIDENCE`) saying that setting actively hurts: only 11 of
72 benchmark items produced a parseable plan, and the 2 that were actually
used mutated the entity ("Boeing 747-8" → "Boeing 749") and were both wrong,
while the other 70 — which fell back to `'verbatim'` (always search, using
the user's own wording) because the plan failed to parse — got 100%
retrieval and 85% correct answers. In other words: **this model already hit
its own better fallback path ~97% of the time**, and the 3% where its own
plan was actually used made things worse, not better. A plan that DOES
parse can also silently set `needs_search: false` for a genuine product/
price question, or hand back a query that no longer matches what the user
asked — this is what most directly throttled "search more often for
product questions", since it happens silently (no error, no toast) before
search ever runs.
Fix: `WEB_PLANNER_MATRIX['Qwen 3 - 1.7B']` changed from `'llm'` to
`'verbatim'`, matching the 3 other profiled models (`Qwen 3 - 0.6B`,
`Qwen 2.5 - 0.5B`, `LFM 2.5 VL - 450M`) whose matrix entry already agreed
with their own evidence. This also skips an extra on-device generation call
per search, so it's a latency win too.
Verify: [**tests**/modelProfiles.test.ts](../__tests__/modelProfiles.test.ts)
(F13) — a general check that fails for ANY model whose evidence says
verbatim outperformed it while the matrix still says `'llm'`, not just this
one. Confirmed live: the in-progress "Searching '...'" line now shows the
literal user question verbatim (previously it showed a separate, sometimes
mutated, LLM-generated query).
✅ **Status note (resolved)**: this fix kept disappearing from disk across
rounds — re-derived, re-staged, then found reverted to `'llm'` again in the
working tree, the index, and identical to HEAD, with no corresponding action
taken from the session that had just applied it. It was re-applied once more
(`WEB_PLANNER_MATRIX['Qwen 3 - 1.7B']: 'llm' → 'verbatim'`) and F13 passes.
Nothing in this repo has been shown to revert it; the most likely cause
remains an out-of-band editor "discard changes" on that one file. If F13
starts failing again with no matching edit in the session log, check
`git diff constants/model-profiles.ts` first rather than re-deriving the
reasoning above.

⚠️ **This fix trades away query reformulation — verbatim is a fallback, not a
strictly better replacement**
`webPlanner: 'llm'` exists for a real reason the `'verbatim'` switch above
doesn't remove: a direct lookup ("cena RTX 4070") searches fine word-for-word,
but a complex or indirect question — one that names no clear search term
("czy warto teraz kupować kartę graficzną, czy ceny jeszcze spadną?", a
multi-part question, a follow-up that only makes sense against earlier
turns — "a ten drugi model?") — needs an actual reformulation step to become
a good query at all; verbatim just fires the user's raw wording at the search
engine and hopes it resembles a query. The fix above is correct specifically
for `Qwen 3 - 1.7B`, because _this model's own_ planner implementation is
broken (89% unparseable, and the 11% that parsed made things worse) — not
because query planning as a concept is unnecessary. Switching it to
`'verbatim'` was choosing the reliably-mediocre path over the rarely-good/
usually-bad one for indirect questions specifically, in exchange for fixing
direct-lookup questions (the large majority of what this round's shopping/
finance testing covered). The real fix — for this model and for every
`'llm'`-mode model below with no evidence at all — is making the planner
call itself reliable (a tighter output schema, few-shot examples matched to
this model's actual failure modes, a smaller/stricter JSON contract) so it
can be trusted with `'llm'` again without the 89% parse-failure tax. That's
a benchmarking effort, not a one-line config change, so it's listed as
proposed work below rather than attempted this round.

💡 **Proposed / to monitor**

- The other `'llm'`-planner models (`Qwen 2.5 - 1.5B`, `Qwen 2.5 - 3B`,
  `LLaMA 3.2` family, `LFM 2.5 - 1.2B`, `LFM 2.5 VL - 1.6B`, `Bielik - v3.0`,
  `Gemma 4` family) have no `PLANNER_EVIDENCE` entry at all — meaning nobody
  has actually benchmarked whether `'llm'` mode helps or hurts for them. The
  same silent-under-search failure mode found here could be present for any
  of them; each deserves the same benchmark `Qwen 3 - 1.7B` got before being
  trusted with `webPlanner: 'llm'`.
- Improve `PLANNER_SYSTEM_PROMPT` / its parsing so `Qwen 3 - 1.7B` (and any
  model that benchmarks the same way) can go back to `'llm'` mode without the
  89% parse-failure rate — regaining good query reformulation for complex/
  indirect questions instead of permanently accepting verbatim's ceiling on
  them.
- `hasMemoryForWebSearch`/`isMemoryConstrained`
  ([utils/modelCompatibility.ts](../utils/modelCompatibility.ts)) is a
  second, separate gate (device RAM headroom) that silently disables search
  with only a toast, no persistent indicator — not investigated this round,
  but worth checking on a memory-constrained device if search still feels
  under-triggered after this fix.

✅ **`'llm'`-mode planner too willing to say `needs_search: false` on
specific, checkable questions — fixed, confirmed live; entity/role-list
backstop replaced with a general intent-validation mechanism**
Scenario: with Web search on, `Gemma 4 - 2B` (`webPlanner: 'llm'`) answered
"ile dzieci ma elon musk" (how many children does Elon Musk have) straight
from stale pretrained knowledge — `needs_search: false`, "Elon Musk ma
cztery dzieci" (four) — a confidently wrong number for a person the
`PLANNER_SYSTEM_PROMPT`'s own "true" bucket explicitly names ("specific
people, places or organisations"). The model just doesn't reliably apply
its own stated rule under uncertainty, and the prompt's own fallback line
— "If the message is conversational and you are unsure, choose false" —
was actively pushing it the wrong way whenever it hesitated.
Fix, two layers:

- Prompt: reworded the unsure-fallback to bias toward `true` ("search is
  cheap, a confident wrong or stale answer is not"), narrowing the
  false-by-default case to clearly conversational messages only.
- Deterministic backstop, v1 (superseded, see below): first shipped as
  `asksAboutFactualEntity`, reusing `hasOwnEntity` (two capitalized words
  in a row) and `REFERENT_ROLE_MARKERS` (prezydent/premier/king/pope/CEO/…)
  — override to a real search when the planner says `false` but the query
  names a capitalized entity or a bare office/title. Flagged in review as
  too narrow: a hardcoded role/title word list only ever covers the
  entity _types_ someone thought to enumerate (president, CEO, king, …),
  not the general shape of the problem — any specific, checkable claim
  the planner waves off, not just ones about a named person's role.
- Deterministic backstop, v2 (current): `isConversationalIntent`
  ([utils/web/buildSearchQuery.ts](../utils/web/buildSearchQuery.ts))
  validates the override against the planner's own returned `intent`
  field instead of pattern-matching the question. The planner prompt
  already defines a closed set of categories that legitimately justify
  `needs_search: false` (greetings, thanks, chit-chat, opinions, advice,
  math, coding, translation, rewriting/paraphrasing, creative writing,
  timeless/general knowledge) — `isConversationalIntent` matches the
  model's stated `intent` against exactly that closed set. In
  `planWebSearch`, whenever the planner returns `needsSearch: false`, the
  override now checks `isConversationalIntent(parsed.intent)`: if the
  model's own reasoning falls inside the defined conversational set, the
  `false` is trusted; if it doesn't (e.g. `intent: "elon musk children"`
  or `"president children"` — a factual claim the model itself didn't
  even attempt to classify as conversational), the answer is treated as
  unsure and a real search runs anyway (`verbatim(parsed.intent)`). This
  generalizes past "does the text look like it names a person/role" to
  "did the model's own classification actually earn the skip" — covers
  every kind of specific/checkable claim, not just person-plus-title
  ones, without hardcoding entity types. `carryReferentIntoQuery`/
  `hasOwnEntity`/`REFERENT_ROLE_MARKERS` remain in place for their
  original, unrelated job (carrying a referent into a follow-up query),
  just no longer doing double duty as the needs_search override.
  Caveat: `isConversationalIntent` trusts the planner's self-reported
  `intent` string rather than re-deriving it from the question text — if the
  model mislabels its own intent (e.g. calls a factual lookup "general
  knowledge"), the override won't catch it. This is a smaller, more general
  failure surface than the old per-entity-type list, but not a zero-risk one.
  Verify: [**tests**/buildSearchQuery.test.ts](../__tests__/buildSearchQuery.test.ts)
  — `isConversationalIntent` unit cases (each defined category, an empty
  string, and a factual-sounding intent that must NOT match), plus
  `planWebSearch` override tests using mock `intent` values including the
  exact captured live query (`"elon musk children"`), a bare-role follow-up
  (`"president children"`), and a plain-greeting control confirming
  `needs_search: false` still stands when the intent is genuinely
  conversational. Confirmed live on Pixel 10, same model, same lowercase-typed
  query, re-tested after the v2 switch: "ile dzieci ma elon musk" searches
  ("Searching 'Elon Musk's children'…") and answers correctly in Polish
  ("Elon Musk miał 14 dzieci"), with the trace showing "Deciding what to
  search for" → "Searching…" → "Reading the pages" → "Done".

✅ **Follow-up query planning ignored conversation context far more often than
it needed to — `carryReferentIntoQuery`'s trigger widened from "one specific
pronoun/role word literally in the query" to also cover Polish's dropped
subject, the single most common way a Polish follow-up carries no context
of its own**
Scenario/request: the user flagged, in general terms, that follow-up
questions weren't taking the recent conversation into account well enough
before the query planner decided what to search for. Investigation
confirmed this is real and has a precise cause: for `webPlanner: 'verbatim'`
(the mode nearly every shipped model in `WEB_PLANNER_MATRIX` actually uses,
including the default), the search query is the literal current message
plus, optionally, one entity name spliced in by `carryReferentIntoQuery`
([utils/web/buildSearchQuery.ts](../utils/web/buildSearchQuery.ts)) — but
only when the query contains one specific pronoun ("he"/"ona"/"jego"/…) or
role word ("prezydent"/"CEO"/…) from a fixed list (`NEEDS_REFERENT`). Polish
freely drops the subject pronoun entirely in a way English doesn't — "Kiedy
się urodził?" ("[he] was born when?") has no pronoun token anywhere — so
this exact, very common follow-up shape fell through the trigger completely
and searched with zero context, a gap already independently observed twice
this session (see Citations/Sources and Sports above) but never fixed at
the query-planning layer itself.
Design choice: presented two directions — broaden the trigger to fire on
any short, entity-less query (simpler, more general, but a naive version of
this was caught live breaking an existing, correct case: "jaka jest cena
bitcoina?" is short and names no entity, but is a genuinely new,
self-contained topic — appending an unrelated prior entity to it would be
wrong) versus a narrower Polish-specific dropped-subject pattern. Chose the
broadening direction as requested, but refined it after the regression was
found: instead of firing on brevity alone, the new signal is the reflexive
marker **"się"** — a single, reliable token that a Polish sentence's
grammatical subject may be implicit, present regardless of which specific
pronoun or role word (if any) is missing. This is a real generalization
(catches "Gdzie się wychował?", "Jak się nazywał?", "Co się stało?",
"Dlaczego się poddał?" — any zero-subject construction, not one specific
question) while staying precise enough not to fire on an unrelated
short-but-self-contained question, since those don't happen to contain
"się".
Fix: `looksLikeDroppedSubject`
([utils/web/buildSearchQuery.ts](../utils/web/buildSearchQuery.ts)) — a
short query (≤6 words) containing "się" — is now OR'd alongside the
existing `NEEDS_REFERENT` check in `carryReferentIntoQuery`, so either
signal independently triggers referent-carrying. Caught its own bug while
implementing: a plain `/\bsię\b/` silently never matched, because JS's
`\b` is ASCII-only and doesn't treat "ę" as a word character — same class
of bug already fixed once this session in `humanizeSourceReferences` and
`questionLanguage.ts`'s tie-break, now fixed a third time here with the
same `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` Unicode-aware lookaround pattern
instead of a bare `\b`.
Verify: [**tests**/buildSearchQuery.test.ts](../__tests__/buildSearchQuery.test.ts)
(F31) — the exact motivating case ("a kiedy się urodził?" → carries the
entity), the regression guard for the naive brevity-only version (the
bitcoin question, left untouched), and "się" appearing deep inside an
otherwise long, self-contained sentence (left untouched, since the ≤6-word
bound excludes it). Confirmed live on iOS Simulator: asked "Kto jest
obecnym prezydentem Francji?" (correctly answered Emmanuel Macron), then
the exact zero-anaphora follow-up "A kiedy się urodził?" — the trace now
shows `Searching "A kiedy się urodził? Emmanuel Macron"` (previously this
would have searched the bare question with no name at all), and the answer
correctly reads "Urodził się 21 grudnia 1977 roku." — Macron's real
birthdate.
💡 **Scope note, not fixed this round**: this closes the single largest,
most-repeatedly-observed gap (Polish zero-subject follow-ups), but
`carryReferentIntoQuery` still only ever carries one _entity_ (a
capitalized proper noun), not a general topic/object referent — "a ten
drugi model?" ("and that other model?", Sports section above) or "w tym
meczu" ("in that game") still carry nothing, since there's no proper noun
to extract. Those remain out of scope for this mechanism, per the existing
Sports-section note that this class of gap was addressed at the
retrieval-filtering layer instead (`EVENT_SCOPE_MARKERS`), not at
query-building.

✅ **Unrelated, pre-existing regression found and fixed while testing the
above: `WEB_PLANNER_MATRIX['Qwen 3 - 1.7B']` had reverted back to `'llm'`
on disk**
This is the same regression already flagged with a ⚠️ status note earlier
in this section ("this fix was re-derived and re-staged during this
round's git-history cleanup, then the `constants/model-profiles.ts` edit
itself reverted back to `'llm'` on disk") — confirmed still present
(`F13` failing) while testing the referent-carrying fix above, which only
matters when the model is actually in `'verbatim'` mode. Fixed the same way
as before: `WEB_PLANNER_MATRIX['Qwen 3 - 1.7B']: 'llm' → 'verbatim'`. F13
passes again; full suite (1491 tests) and `tsc` clean.

## Unreadable pages (fetch failure → informed fallback)

✅ **A page the reader can’t fetch used to vanish silently; it now says what
went wrong and searches somewhere else instead**
Scenario/request: the user asked for the flow Claude’s own web search has
around a failed fetch — tell the user, then take a substitute action (their
example: if a shop page can’t be read, go look the product up on the
manufacturer’s own site) so the turn still comes back with usable context.
Before this, `enrichWebResults`’s `enrichOne` caught **every** failure into a
single `ok: false` boolean: a 403 bot wall, a 404, a PDF, a timeout and a
page that simply had no text were indistinguishable, the reason was thrown
away at the catch site, the trace drew a failed page exactly like a
successfully read one, and the only reaction was the existing adaptive
widening — read _more of the same SERP_. Once that SERP was exhausted the
search just ended with whatever snippets it had.

Three layers, each independently tested:

1. **Classification** — `utils/web/fetchFailure.ts` turns the errors
   `security/outboundFetch.ts` actually throws into a
   `FetchFailureReason` (`blocked` | `not-found` | `server-error` | `timeout`
   | `unsupported` | `too-large` | `empty` | `network` | `aborted`), plus the
   content-side verdict (`looksLikeBotWall` → `blocked`, too short →
   `empty`). The tests assert against the literal message strings
   `outboundFetch` produces, so a reworded throw there fails the suite
   rather than silently degrading every reason to `network`. `aborted` is
   deliberately **not** recoverable — a user who stopped the generation
   should not trigger a second round of searching on their way out.
2. **Propagation** — `EnrichPageEvent` and `WebSearchProgressEvent` carry the
   reason; `runWebSearch` accumulates `telemetry.fetchFailures`.
3. **Recovery** — `utils/web/fetchRecovery.ts` plans a second round, run
   through the _existing_ `runQueries`/`groundAndEvaluate` machinery as
   `round: 2` (the `rounds` array and the `round` parameter were already
   there, anticipating exactly this). Results from both rounds are merged
   and re-scored together, so a recovered page competes with round 1 on
   retrieval rather than replacing it.

The recovery strategies, in order:

- `primary-source` — re-search the **subject** with the dead hosts excluded
  (`Samsung Galaxy S25 -site:shop.example`). This is the "go to the
  manufacturer instead" behaviour, built **without a brand→domain table**:
  the subject is the query's own named entity (or its content words), the
  `-site:` exclusion guarantees a genuinely different SERP, and
  `promotePrimarySources` then floats results whose registrable domain
  carries a subject token (`samsung.com`, `zalando.pl`) to the front of
  their group — where `rankByListingRelevance`'s "keep the group's first
  result in the top 2" rule keeps them. Deliberately **not** a hardcoded
  vendor list and **not** an "official site" phrase appended per language:
  both are the shape of mechanism this doc has already been burned by
  (`REFERENT_ROLE_MARKERS` doing double duty, see Search frequency above).
- `alternate-page` — `site:<host> <subject>`, but only for _page_-level
  failures (`not-found`, `unsupported`, `too-large`, `empty`), where a
  different page on the same host plausibly works. A host that returned
  `blocked` or `server-error` is recorded in `deadHosts` and excluded from
  the recovery SERP entirely, so the second round never spends a fetch on a
  site that just refused us.
- `restate` — the planner's own `intent` as a query, which only exists in
  `'llm'` planner mode.
  Capped at `WEB_RECOVERY_MAX_QUERIES = 2` and gated on
  `needsMore` (no usable content, or `evaluation.shouldCorrect`) **and** at
  least one recoverable failure — a merely-weak search with no failed fetch
  does not buy an extra scrape round.

**Deliberately not done: nothing is injected into the model's context about
the failed sources.** Telling the model "source X could not be read" is the
exact shape of prompt-side addition that the Real estate section above
records causing a _worse_ regression (the "sandwiched" instruction that made
the model echo an unrelated question back five times). The failure
information is user-facing and telemetry-only.

**Two bugs found by the tests while building this:**

1. **`PROPER_NOUN_RUN` truncated every model number** — the run allowed only
   letters inside a token (`[\p{L}'-]*`), so `Samsung Galaxy S25` was read as
   the entity "Samsung Galaxy S", `RTX 4070` lost its number, and so on.
   This was never a recovery-only bug: `carryReferentIntoQuery` uses the same
   regex, so a follow-up about a phone has been carrying a truncated product
   name into the search query all along. Fixed by allowing digits _inside_ a
   capitalized token (`[\p{L}\p{N}'-]*`). Deliberately **not** extended to
   swallow a following standalone number — that would turn "Elon Musk ma 14
   dzieci" into the entity "Elon Musk 14"; both the fix and that boundary are
   pinned by tests in
   [**tests**/buildSearchQuery.test.ts](../__tests__/buildSearchQuery.test.ts).
2. **The first recovery design produced no strategies at all in its most
   important case.** With only a `blocked` host, `alternate-page` was
   correctly suppressed, `restate` needs an intent that verbatim mode never
   has, and the `primary-source` query was byte-identical to the query
   already tried — so it was deduped away and the recovery silently did
   nothing, in exactly the "the shop blocked us" scenario the feature exists
   for. Caught by the unit test before any of it ran on a device; fixed by
   making `primary-source` carry the `-site:` exclusions, which by
   construction differ from anything already tried.

Verify: [**tests**/fetchFailure.test.ts](../__tests__/fetchFailure.test.ts),
[**tests**/fetchRecovery.test.ts](../__tests__/fetchRecovery.test.ts),
the `when a page cannot be read` block in
[**tests**/runWebSearch.test.ts](../__tests__/runWebSearch.test.ts)
(end-to-end: blocked host → second SERP → vendor page read → context, and
the negative cases: no failures → no extra round, dead host never re-fetched),
`enrichWebResults — why a page could not be read` in
[**tests**/enrichResults.test.ts](../__tests__/enrichResults.test.ts), and
`buildRows — pages that could not be read` in
[**tests**/webSearchTrace.test.ts](../__tests__/webSearchTrace.test.ts).

💡 **Not yet verified live.** All of the above is unit- and integration-tested
against mocked SERPs and a mocked `extractArticle`; none of it has been run
against a real bot wall on a device. The specific things a live pass should
confirm: that the scrape engines in `SCRAPE_ENGINES` actually honour the
`-site:` and `site:` operators the recovery queries rely on (DuckDuckGo,
Brave and Mojeek all document them, but the app reads them through the
HTML-scraping provider, not an API), and that a second scrape round stays
inside `WEB_SEARCH_OVERALL_TIMEOUT_MS` on a real device with
`SCRAPE_MIN_DELAY_MS` between engine hits.

## Live QA round — iOS simulator (iPhone 17 Pro, Qwen 3 - 1.7B, verbatim planner)

Everything below was run on the iPhone 17 Pro simulator against the real web,
with `Qwen 3 - 1.7B` — which is on `'verbatim'` planner mode again after the
F13 re-fix, so this round finally exercises the verbatim path the two features
below were built for and that earlier rounds could not reach.

✅ **Fetch-failure classification and the failure line are real, not just
unit-tested**
First query, `"ile kosztuje Samsung Galaxy S25"`: the trace showed
`mediaexpert.pl` read normally, **two `allegro.pl` results struck through with
"blocked the reader"**, an `oix.pl` result struck through with "page too big",
and the summary note **"Couldn't read 3 pages — blocked the reader"**. Real bot
walls, correctly classified, with the reason on the row. Recovery correctly did
**not** run: one page was readable, so `needsMore` was false — the extra scrape
round is spent only when the retrieval is actually short.

✅ **The recovery round fires live and lands on the manufacturer's own site —
the behaviour this feature was asked for**
Second query, `"ile kosztuje używana Toyota Corolla 2018"`: round 1 read
`otomoto.pl` and `autouncle.pl`, lost `allegro.pl` to a bot wall and `olx.pl`
twice to "page too big", and the retrieval came back short. The trace then
showed, in order:

- `Couldn't read those — looking for another source`
- `Searching "Toyota Corolla -site:allegro.pl"` → **`toyota.pl`** (plus
  `autocentrum.pl`, `autoplac.pl`)
- `Searching "site:olx.pl Toyota Corolla"`
  Both strategies behaved exactly as designed, and — the point of the exercise —
  excluding the host that blocked us surfaced the vendor's own page. It also
  confirms the open question from the section above: **the scrape engines do
  honour `-site:` and `site:` through the HTML-scraping provider**, not just
  through an API. Answer generation for that turn then failed on the pre-existing
  `isQuestionEchoAnswer` guard (the model echoed the question); the search itself
  was healthy, and the log confirmed the error was
  `The model echoed the question back with no actual answer`, not anything from
  the recovery path.

🔧 **Live-found and fixed: a host that keeps failing the same way kept eating
the fetch budget**
In that same run `olx.pl` failed **four times** with `page too big`, and still
got an `alternate-page` recovery query (`site:olx.pl Toyota Corolla`) spent on
it, which returned more `olx.pl` pages that also failed. `deadHosts` only
covered `blocked`/`server-error`, on the theory that a page-level failure means
another page might work — true in principle, empirically false for a site whose
pages are uniformly too big. Fix: `WEB_RECOVERY_HOST_FAILURE_LIMIT = 2` — a
host with two or more recoverable failures in a run is dead **whatever the
reason**, so it is excluded from the recovery SERP and never gets a same-host
retry. Covered by two tests in
[**tests**/fetchRecovery.test.ts](../__tests__/fetchRecovery.test.ts) (two
misses → dead and excluded; one miss → still gets its second chance). The fix
is in the running bundle but was not re-run against a live SERP this round.

✅ **The conversation digest is written per turn on a real device, and its
fallback reaches a live search query** — the two things the section above
listed as unverified. `chatSettings.digest` gained a row after every completed
turn across five real chats, and a follow-up with a dropped subject
(`"a ile się ja parzy?"`, no entity anywhere in the history) produced the trace
line `Searching "A ile się ja parzy? <digest>"`. Without the digest that query
would have gone out as four context-free words.

🔧 **Live-found and fixed: the digest was written for a prompt, but it is
spliced into a search query**
The digest the model produced was meta-commentary about the conversation —
_"The user is asking about the process of making a good cup of coffee in a
café. The key entities are coffee and café."_ — 120 characters of English
framing, for a Polish conversation. Appended to the follow-up it made the live
search query `A ile się ja parzy? The user is asking about the process of…`,
and retrieval drifted to **English** sources (`en.wikipedia.org` "Coffee
preparation", `coffeeplusthree.com`, `tasteofhome.com`) for a Polish question:
the useful terms were diluted by "the user is asking about", and the digest's
language overrode the question's. Fix, at the root rather than at the splice:
`DIGEST_SYSTEM_PROMPT` now asks for **the topic as a short noun phrase that
reads like a search phrase**, in the conversation's language, with an explicit
counter-example (`"parzenie kawy w kawiarce, stopień zmielenia"`, never
`"The user is asking about..."`), plus `stripMetaFrame` as a deterministic
cleanup for when the model writes the framing anyway (it also drops a trailing
"The key entities are …" inventory, and never strips a digest to nothing).
Re-run live on the same question after the fix: the stored digest became
**`"zaporanie kawy w kawiarce"`** (25 chars, Polish, query-shaped — the
model's own typo for "zaparzanie" included), the search line became
`Searching "A ile się ja parzy? zaporanie kawy w kawia…"`, and retrieval moved
to **`coffeepolska.pl` "Jak parzyć kawę w kawiarce?" and `inpostfresh.pl`
"Jak parzyć kawę…"** — the right language, the right topic, on a query that
carries no context of its own.

🔧 **Live-found and fixed: the digest parroted the answer back instead of
summarizing, and persisted a fabricated figure**
Across twelve stored chats the pattern was consistent: **English** digests were
real summaries, **Polish** ones were the answer's opening sentence copied
verbatim. The worst case is not cosmetic — chat 177's digest was
`"Cena Samsunga Galaxy S25 wynosi 299 zł."`, i.e. the model's own hallucinated
price (the answer that produced it was flagged by the grounding badge as
unverifiable) promoted into durable per-chat state that a later follow-up
splices straight into a search query. Fix: `looksLikeAnswerEcho` rejects a
digest that is contained in the answer or opens with the answer's own first
words, and falls back to the user's question — which names the topic and
carries no invented numbers.

🔧 **Open: the digest stops accumulating after the first turn**
In a three-turn conversation the digest set on turn 1 was still byte-identical
after turn 2 (polled for two minutes), even though turn 2 introduced a new
sub-topic (which coffee to grind). Whether the model returns the previous
summary unchanged or the update never runs was not separated this round —
distinguishing them needs instrumentation on `updateConversationDigest`'s
return value, not another live run. Consequence: the digest tracks the
conversation's **opening** topic, not its current one, so anaphora pointing at
a later sub-topic ("a ten drugi?") still resolves to the wrong thing. Not
fixed; this is the next thing to look at on the digest.

⚠️ **Answer quality on this model/language is the limiting factor, not
retrieval.** Three of the six live turns this round ended in
`Failed to generate a response.` from the existing `isQuestionEchoAnswer`
guard — `Qwen 3 - 1.7B` echoed the Polish follow-up back instead of answering
it, on turns where the search itself had returned correct, on-topic Polish
sources. The guard is doing its job (a non-answer is rejected rather than
shown), but it means this round could verify **retrieval** end-to-end and could
not verify the **answers** built on it. That is a model-capability limit on the
simulator's smallest downloaded model, not a regression in anything above.

## "Failed to generate a response." — one real regression, one long-standing rough edge

✅ **Regression on this branch: the widened loop detector was destroying good
answers — found by measuring against HEAD on 60 real device answers, fixed**
The non-adjacent repetition widening added to `utils/loopDetection.ts` cut the
answer at the **first** occurrence of _any_ clause that appeared twice
anywhere. Measured by running HEAD's `truncateAtRepeatedClause` and the working
tree's side by side over the 60 assistant messages actually stored on the test
device: **8 of 60 were truncated harder than HEAD**, several catastrophically —
a chocolate-cake recipe went from 986 characters to **158**, a packing list
from 495 to 133, a weather answer from 382 to 105. Inspecting what repeated in
those eight settled the design: **every false positive was a clause appearing
exactly twice** — `"cocoa powder"` and `"baking powder"` (named once in the
ingredients and again in the steps), `"zgodnie z źródłami"`, `"**Ochłonienie**
– np"` — while the one genuine loop in the sample repeated its clauses
**four to six times**. Six of the eight had **no repeated whole line at all**;
the damage was entirely the clause rule firing on `x2` fragments.
Fix, straight from that data:

- clause rule: a repeat counts as a loop only from **three** occurrences
  (`CLAUSE_REPEAT_LIMIT`), and cuts at the **second** occurrence, so the first
  legitimate use of the phrase survives;
- line rule: a repeated **whole line** still counts at two occurrences
  (`LINE_REPEAT_LIMIT`) — that is the padded-list shape this widening was for —
  keeping HEAD's adjacent-duplicate behaviour and adding the non-adjacent case,
  again cutting at the second occurrence.
  Re-measured over the same 60 answers afterwards: **59 identical to HEAD, 0
  where it now keeps less than HEAD except one — the genuine padded list, which
  goes from untouched to 277/495 with its four distinct items intact.** So the
  detector is never more destructive than HEAD on real data and still gains the
  case it was widened for. Verify: the false-positive shape is pinned as its own
  test (`does not cut an answer that merely names the same thing twice`), as is
  the three-occurrence threshold and the cut-at-the-repeat rule, in
  [**tests**/loopDetection.test.ts](../__tests__/loopDetection.test.ts).
  Live-confirmed on the simulator: a genuinely looping coffee answer (items 6-12
  all `"Zapar zimną wodą"`) is still cut and still persists as an answer.

✅ **Not a regression, but fixed anyway: an echoed question ended the turn
instead of getting one retry**
The remaining `Failed to generate a response.` turns were all
`The model echoed the question back with no actual answer` — `Qwen 3 - 1.7B`
restating the Polish follow-up instead of answering it. That detector
(`isQuestionEchoAnswer`) and the gate that fails the turn on it are **byte-for-
byte HEAD code**; this branch changed neither, and the doc above already
records this echo shape as a reliable model tendency. So it is a long-standing
rough edge, not something this branch introduced — but the user-visible outcome
was still wrong: the search had succeeded and returned correct, on-topic Polish
sources, and the turn ended on a red error with a Retry button.
Fix: the same treatment the dangling-list case already had — one nudge and one
retry (`QUESTION_ECHO_RETRY_PROMPT`, anchored to the question's language),
before falling back to the failure. A turn now spends **at most one** nudge:
`nudged` gates the dangling-list retry, so a reply that is both an echo and a
dangling list gets the echo nudge and not both. If the retry echoes as well,
the turn fails exactly as it did before.
Verify: three cases in [**tests**/llmStore.test.ts](../__tests__/llmStore.test.ts)
— recovery, failure when the retry echoes too, and "echo nudge not list nudge"
for a reply that is both. Live-confirmed: `"ile kosztuje używana Toyota
Corolla 2018"`, which failed this way twice earlier in the session, now
persists an answer with its Sources row.
⚠️ The recovered answer is still weak (_"kosztuje od 2026-09-01 do
2026-09-02"_ — the model handed back dates instead of a price). The retry
converts a hard failure into a poor answer; it does not make the model better.

## Follow-up round: digest accumulation, prompt injection, circular non-answers

✅ **Root cause of "the digest stops accumulating" found by instrumenting the
device — it was never the model refusing to update**
The previous round left this open with two competing hypotheses (the model
returns the previous topic unchanged, or the update never runs). A temporary
probe logging the raw `generateUtility` output settled it in two turns:

```
[digest-probe] prev=null rawLen=52 raw="<think>\n\nrowery górskie dla początkujących" ... stripped="rowery górskie dla początkujących"
[digest-probe] prev="rowery górskie dla początkujących" rawLen=32 raw="<think>\n\nhamulce tarczowe lepsze" stripped=""
```

The model wrote **the correct new topic** — `"hamulce tarczowe lepsze"` — and
then ran out of budget **before closing its `<think>` tag**. `stripThinkBlocks`
treats an unterminated block as reasoning all the way to the end, so it
returned `""`, and `updateConversationDigest` fell back to the previous digest.
The digest was not freezing; it was being thrown away every turn after the
first.
Fix: `visibleDigestText` — when stripping leaves nothing and the raw output has
an **unterminated** think block, take the text inside it, but only when it is
short enough to be a topic phrase (`≤ DIGEST_MAX_CHARS`), so a genuine
reasoning ramble still falls back to the previous digest. Deliberately local to
the digest: changing `stripThinkBlocks` itself would start surfacing
unterminated reasoning as answer text everywhere.
Live-confirmed: the same two-turn bike conversation that previously left the
digest on turn 1's topic now moves to `"hamulce tarczowe vs szczekowe"` after
turn 2. Note it _replaces_ rather than accumulates — for referent resolution
the current topic is what matters, and it is bounded at 200 characters, but it
does mean the opening topic is dropped once the conversation moves on.

✅ **Second live-found bug in the same probe: the echo guard was eating good
digests**
The probe also showed `prev="Jaki jest najlepszy rower górski dla
poczatkujacego"` — the **question**, not turn 1's digest
(`"najlepszy rower górski dla początkujących"`). `looksLikeAnswerEcho` was
firing on a legitimate topic phrase, because the answer opened by restating the
subject (`"Najlepszy rower górski dla początkujących to rower z…"`) — completely
normal Polish phrasing, and the digest is a substring of it.
Fix: containment now only counts as an echo when the digest covers most of the
answer (`ECHO_COVERAGE_RATIO = 0.6`), and the lead-words rule needs a full
eight-word window. This keeps both cases the guard exists for — the fabricated
`"Cena Samsunga Galaxy S25 wynosi 299 zł."` (the digest _was_ the whole answer,
ratio 1.0) and the long coffee-recipe copy (17 words, lead-word match) — while
leaving a short topic phrase alone.

✅ **`prepareMessagesForLLM` takes an options object**
It had grown to twelve positional parameters and adding the digest would have
made thirteen. Now `(messages, context, settings, model, options)` with a
`PrepareMessagesOptions` interface; the four genuinely required arguments stay
positional. The 47 test call sites and both `llmStore` call sites were
converted by a codemod that parses balanced arguments and drops the ones that
were `undefined`, so the diff is mechanical; the suite is the verification.

✅ **The digest now also reaches the model's prompt, but only where it replaces
something that was actually lost**
`prepareMessagesForLLM` already trims old turns against a character budget.
When — and only when — that trimming actually dropped turns, the digest is
appended to the system prompt as `Conversation so far: <topic>`. A short
conversation is untouched. The digest's length is counted into `mandatoryChars`
**before** the trimming loop, so it is paid for out of the history budget
rather than added on top of it; the test asserts the prompt can only ever grow
by at most the digest line itself. Deliberately gated this way because of the
⚠️ lesson recorded under Real estate: a prompt-side addition that is always
present is exactly the shape that caused a worse regression there.
⚠️ Not yet observed live — reaching the gate needs a conversation long enough
for the budget to drop turns, which the simulator session did not produce.

✅ **`isCircularNonAnswer` restored — but wired into the retry, not into a hard
failure**
The plan called this "a straight revert of the two deletions in `9d3476a`". A
straight revert would have re-introduced exactly the outcome that was just
fixed: an answer that only talks about its sources would end the turn on
`Failed to generate a response.` Restored the detector and its persistence
gate, but routed it through the same one-nudge retry as the question echo and
the dangling list. The three near-identical retry blocks are now one
`nudgeOnce(reason, prompt, stillBroken)` helper, and a turn still spends **at
most one** nudge in total.
While restoring it, its marker regex turned out not to match `"źródeł"` — the
genitive plural, and the most natural form in exactly the phrasing this
detector is for (`"ze źródeł podanych wyżej"`). Widened `źródł\w*` to
`źród\w*`; low risk now that a hit means a retry rather than a failed turn.

✅ **Dead-host recovery confirmed live** — the fix that was implemented but
unverified last round. Re-running `"ile kosztuje używana Toyota Corolla 2018"`:
`olx.pl` failed twice (`took too long`), `allegro.pl` once (`blocked the
reader`), and the recovery query came back as
**`Searching "Toyota Corolla -site:olx.pl -site:allegro.pl"`** — both hosts
excluded, and, unlike the previous round, **no `site:olx.pl` retry was spent at
all**. The freed budget went to readable hosts (`toyota.pl` twice,
`autocentrum.pl`, `autoplac.pl`) and the turn persisted an answer with its
Sources row.

## Test harness

✅ **The jest run was silently loading a second, stale copy of the repo — two
suites failed for reasons that had nothing to do with their code, and every
reported test count on this branch was inflated**
Symptom: `__tests__/useKeyboardLift.test.ts` failed with
`useAnimatedReaction is not a function` even though
`__mocks__/react-native-reanimated.ts` plainly exports it, and
`__tests__/WebFavicon.test.tsx` failed its retry assertions. Probing the
resolved module showed it was missing exactly the exports that the root mock
has and an older revision of that file did not (`useAnimatedReaction`,
`FadeInUp`, `FadeOutDown`, `FadeOutUp`, the `useRef`-backed `useSharedValue`).
Cause: a leftover agent git worktree at
`.claude/worktrees/agent-a5ab2d870064da294` (branch
`fix/chat-input-first-paste-clears`) sits **inside** the project root, so it
contains a full second checkout — including its own
`__mocks__/react-native-reanimated.ts` from before that mock was extended.
jest-haste-map saw two manual mocks under the same name and resolved the stale
one; it also collected that worktree's `__tests__/**` as real suites, which is
why the run reported 161 suites / 2340 tests (and, in an earlier round, 1491)
instead of this project's actual 98 suites / 1534 tests, with every duplicated
suite listed twice.
Fix: `modulePathIgnorePatterns: ["<rootDir>/.claude/worktrees/"]` in the jest
config in `package.json`. This is deliberately a pattern, not a one-off
cleanup — the worktree directory is created by tooling and will come back;
the worktree itself was left alone because its branch is not merged.
Verify: `npx jest` reports 98 suites / 1534 tests with no duplicated suite
names, and both suites above pass. A regression here looks like a test failing
on an export that demonstrably exists in the file it is supposed to be reading.

## Conversation digest (cross-turn context for referent resolution)

✅ **Per-chat rolling "digest" now backs `carryReferentIntoQuery`'s fallback
for non-entity topic anaphora — the scope gap noted directly above ("a ten
drugi model?", "w tym meczu")**
Entity-carrying only ever solves referents that are proper nouns. General
topic anaphora ("the other one", "in that match") has no proper noun to
extract at all — closing that gap requires knowing what the conversation is
currently _about_, which needs a real summary, not a regex. Chosen approach
(confirmed with the user, weighed against `PLANNER_EVIDENCE`'s documented
small-model unreliability at structured tasks): run one cheap on-device
`generateUtility` summarization **per completed turn**, not per query —
`utils/conversationDigest.ts`'s `updateConversationDigest(generate,
previousDigest, question, answer)` builds an incremental prompt (`previous
digest + latest exchange → updated digest`, capped at `DIGEST_MAX_CHARS =
200`) so the prompt stays bounded regardless of conversation length. Stored
per-chat in a new `chatSettings.digest` column (`database/db.ts` schema +
migration, `getChatDigest`/`setChatDigest` in `database/chatRepository.ts`),
mirrored in `store/llmStore.ts` as `activeChatDigest: string | null` (loaded
in `setActiveChatId`, updated fire-and-forget right after
`persistMessage`/`updateChatStateForGeneration('complete', ...)` in
`sendChatMessage`, guarded by `!get().isGenerating` so it can't collide with
a new turn starting — `llmInstance.generate()` isn't reentrant).
`carryReferentIntoQuery(query, history, digest?)`: when a query looks
referentially incomplete and no entity is found in history, falls back to
appending the digest instead of leaving the query bare; `buildConversation`
also prepends `Conversation summary so far: {digest}` to the LLM-planner's
own prompt. The same `carryReferentIntoQuery` call is reused (not
reimplemented) inside `utils/messageSources.ts`'s `buildMessageSources` for
the local-document RAG retrieval query, wired through
`components/chat-screen/useSendChatMessage.ts`'s existing `messageHistory`/
`activeChatDigest` — same mechanism, same fallback rule, both call sites.

Two real bugs found live while verifying this (both fixed, both regression-
tested):

1. **`PROPER_NOUN_RUN` matched capital letters mid-word, not just at word
   start** — "iPhone Air" was misread as the two-word proper-noun run "Phone
   Air" (the regex had no boundary anchor, so it happily started matching at
   the capital "P" inside "iPhone"), which meant `mostRecentEntity` returned
   garbage and the digest fallback never even got a chance to run — the
   entity branch always "won" first, incorrectly. Fixed with a
   `(?<!\p{L})` lookbehind before the first capital. Live-repro: compared
   "iPhone 17 Pro" vs "iPhone Air" by weight, then asked "A ile on kosztuje,
   ten pierwszy?" — before the fix, the query became "...ten pierwszy? Phone
   Air"; after, this correctly falls through to the digest.
2. **Raw `<think>...</think>` tags leaking into the stored digest** —
   `updateConversationDigest` never stripped the model's think block before
   clamping/storing, so a thinking-capable model's reasoning wrapper (even
   an empty `<think>\n\n</think>`) got persisted verbatim into
   `chatSettings.digest` and would have been spliced straight into a live
   search query. Caught by inspecting the actual persisted SQLite row
   (`chatSettings` table) after a real on-device turn, not by the unit
   suite. Fixed by running the generated text through the existing
   `stripThinkBlocks` (`utils/thinking.ts`) — the same utility already used
   elsewhere in this file for `isQuestionEchoAnswer`/answer-language
   detection, not a new mechanism.

Live-verified end-to-end: schema migration applies cleanly to an existing
on-device database (no crash across two real chats), `chatSettings.digest`
rows are written after real turns, and after both fixes above the persisted
digest is clean (`"iPhone 17 Pro and iPhone Air weight comparison."`, no
leaked tags). 💡 **Scope note**: full live verification of the
verbatim-mode digest-append specifically (i.e. seeing `"<query> <digest>"`
in an actual on-device search trace) was blocked by an orthogonal,
already-known, user-accepted condition — the only downloaded models on the
test device (`Qwen 3 - 1.7B`, `Gemma 4 - 2B`) are currently pinned to
`'llm'` planner mode, which dominates query construction before the
verbatim fallback path would engage; the LLM planner's own hallucination
risk in that mode is the pre-existing, documented `F13` regression, not a
digest bug. `carryReferentIntoQuery`'s digest fallback itself is covered
directly and thoroughly by unit tests (entity found → digest ignored; no
entity, digest present → appended; no entity, no digest → unchanged;
end-to-end through `planWebSearch` and through `buildMessageSources`). The
local-document RAG side of this (`buildMessageSources`) was not live-tested
with an attached document this round (would require downloading the
embedding model + attaching a file) — verified via unit tests asserting the
exact `prompt` string reaching `hybridRetrieve`, reusing the digest pipeline
already proven live on the web-search side.

## Cross-feature: web search vs. local document RAG (mutual exclusion)

✅ **Web search and local document RAG could previously run simultaneously
and blend their retrieval into one context block — changed so local
documents take priority and web search is skipped whenever they're active,
behind an easy-to-flip switch**
Scenario/request: with both a document attached (or already enabled for the
chat) and the "Web" toggle on, the app previously ran both retrieval
mechanisms unconditionally and concatenated their output —
[components/chat-screen/useSendChatMessage.ts](../components/chat-screen/useSendChatMessage.ts)
built the doc-RAG context first, then ran web search regardless of whether
doc-RAG already found anything, appending its context and sources onto the
same flat list with no signal to the model about which source should win on
conflict. Changed by explicit request: only one retrieval mechanism should
run per message, with local documents taking priority — reasoning being
that mixing an attached document's content with unrelated web results in
one prompt is more likely to confuse a small model than help it, and a
user who explicitly attached a document almost certainly wants answers
grounded in it, not diluted by a web search running in parallel.
Fix: `RAG_PRIORITY_OVER_WEB_SEARCH`
([constants/web.ts](../constants/web.ts)) — a single boolean, the same
UPPER_SNAKE_CASE constant-in-`constants/*.ts` pattern already used for
every other feature gate in this codebase (`WEB_SEARCH_ENABLED`,
`WEB_QUERY_GATE`, etc.), defaulting to `true`. When on, `useSendChatMessage.ts`
computes `hasRagSources` (documents attached or already enabled for this
chat) before deciding whether to run web search at all — if RAG sources
exist, `shouldRunWebSearch` is forced `false` regardless of the per-chat
Web toggle, and a toast explains why ("Using your documents for this chat —
web search is off while they're active."), the same UX pattern already
used for the two other reasons a search can be silently skipped (model
compatibility, low memory). Flipping the constant to `false` restores the
exact previous behavior (both run, doc context first) with no other code
changes needed — this is the "easy to turn off in the next version"
requirement, verified by actually flipping it live (see below), not just
by code inspection.
Verify: confirmed live on iOS Simulator (iPhone 17 Pro, `Qwen 3 - 1.7B`).
With the flag on: attached a test document (a fictitious "secret
verification code" fact no web source or pretrained knowledge could
supply) with Web also on, asked a question only the document could answer
— got the correct answer, **no "Searched the web" trace appeared at all**,
and the Sources sheet showed only the local document. With the flag
flipped to `false` and reloaded: the identical question **did** show a web
search trace alongside the document answer, confirming the toggle
genuinely restores simultaneous retrieval rather than just suppressing the
UI indicator. Flag restored to `true` (the shipped default) afterward.

⚠️ **Known trade-off, observed live, not a bug relative to what was asked
for: once any document is enabled for a chat, web search stays off for
every later message in that chat, even ones with nothing to do with the
document**
Scenario: after attaching a document and asking it a question, a
completely unrelated follow-up in the same chat ("Jaka jest dzisiejsza
pogoda w Warszawie?" — today's weather in Warsaw) also skipped web search,
because `hasRagSources` is based on whether the chat has any RAG sources
_enabled_ — which, per the existing (pre-dating this change) "enable this
source for the chat" behavior in `useSendChatMessage.ts`, persists for
every future message once a document has been attached and used once, not
just the turn it was attached on. The model answered the weather question
anyway, from stale pretrained knowledge, exactly as it would with Web fully
off — no crash, no error, just a wrong/fabricated answer to a question that
would have benefited from a real search. This is the direct, mechanical
consequence of "only one option can run, local documents take priority" as
requested — not a bug in the implementation — but worth flagging clearly
since it means attaching one document to a chat quietly disables web
search for that entire chat going forward, not just for document-related
turns. No topic-relevance check was added (the request was for a simple,
blunt priority rule, easy to reason about and easy to disable — a smarter
"only prioritize docs when the question is actually about them" version
would need its own design and is a natural next step if this trade-off
proves too broad in practice).
No dedicated unit test: `useSendChatMessage.ts` has no existing test file
in this codebase (confirmed before implementing — the whole send-message
flow is only ever covered by live/manual QA here, consistent with how
`buildSources`, `runWebSearch`, and the rest of this hook's logic are
already tested elsewhere in this doc), so this fix is verified live only,
per the existing convention for this file.

## Language detection (question-language routing)

✅ **General class of bug: short, coincidentally-exclusive words could make
`detectQuestionLanguage` misjudge or, worse, silently return the wrong
language — found via one live instance, fixed as a class, not a
single-case patch**
Scenario, live-caught on Pixel 10: "ile dzieci ma elon musk" (Polish, "how
many children does Elon Musk have") got answered **in English**. The
answer-language guard (`isWrongLanguageAnswer` in
[utils/messageSources.ts](../utils/messageSources.ts)) exists specifically
to catch and retry this shape of failure — but it never fired, because
`detectQuestionLanguage` couldn't name the _question's_ language at all
(`null`), and the guard is a no-op without an expected language to compare
against.
Root cause, and why this is a **class** of bug, not one word: each
language in [utils/questionLanguage.ts](../utils/questionLanguage.ts) is
scored from a hand-curated marker-word list. A word absent from every
_other_ language's list scores as if it were exclusive to its own language
— regardless of whether it's actually distinctive. "ma" (a common Polish
verb, "has") isn't in the Polish list, but happens to also be an exclusive
French marker ("my", possessive) — so a Polish sentence containing "ma"
picked up a phantom French vote. Here it tied the genuine Polish signal
("ile") exactly, and the old tie-break gave up (`null`) the moment any two
languages tied on raw score, without asking whether that tie was between
two _real_ signals or one real signal and one coincidence. With close to
25 languages each contributing a marker list, this exact shape of
collision — some short, ordinary word that one list-author didn't think to
add — can happen between any pair, not just Polish/French. Audited the
actual word lists (a one-off script, not committed) for every word under 3
characters that is exclusive to exactly one Latin-script language: **54
such words** across the current language set.
Fix: `pickCandidate`'s tie-break
([utils/questionLanguage.ts](../utils/questionLanguage.ts)) no longer
treats every raw-score tie as unresolvable. A tie is now broken in favor
of whichever tied candidate has genuine _decisive_ evidence (a marker word
of 3+ characters, or one carrying a language-specific diacritic) — and
only when exactly one of the tied candidates has that; if two languages
both have decisive evidence, or neither does, it still abstains (`null`)
rather than guess. Nothing in the fix references "ma", French, or Polish
specifically — it's a property of the scoring, so it applies uniformly to
every language pair sharing the list-completeness gap.
Verify: [**tests**/questionLanguage.test.ts](../__tests__/questionLanguage.test.ts)
— the original captured case, plus a systematic audit test that
cross-pairs all 24 identified short-exclusive words against 13 other
languages' own decisive markers (276 synthetic sentence pairs) and asserts
the _safety_ invariant that actually matters: a short-word collision must
never make the detector confidently name the wrong language — landing on
the correct language or abstaining are both acceptable, being _confidently
wrong_ is not. All 276 pairs pass that bar (a handful abstain via `null`
instead of naming the technically-correct language — safe, just not
maximally precise, and out of scope for this fix). The existing 500+ item
multilingual corpus regression suite
([**tests**/fixtures/multilingualQueries.ts](../__tests__/fixtures/multilingualQueries.ts))
still reports 100% per-language accuracy with zero cross-language
misnamings — confirming the tie-break change doesn't trade the new safety
property for the old precision. Confirmed live: reloaded, re-asked the
identical "ile dzieci ma elon musk" question — this time it correctly
detected the question as Polish and (combined with the citation/search
fixes above) returned a well-grounded Polish answer.

## Finance / crypto (prices, comparisons)

✅ **Cross-asset confusion filtered**
Scenario: asking for BTC's price alone must not resolve to a BTC-ETH pair
page.
Verify: `excludeCrossAssetIfAlternatives` in
[utils/web/listingRelevance.ts](../utils/web/listingRelevance.ts).

✅ **Trend claims without supporting data get a caveat**
Scenario: "which asset gained more this month" when the context has no
period-matched change data.
Verify: `withTrendGroundingCaveat` in
[utils/messageSources.ts](../utils/messageSources.ts).

✅ **Multi-asset comparisons keep figures attributed to the right asset**
Scenario: "bitcoin vs ethereum" — each context block is now labeled with the
query it answers.
Verify: `sourceQuery` / `[Answers: ...]` tagging in
[utils/web/webResultsToContext.ts](../utils/web/webResultsToContext.ts).

✅ **Figure whitelist can no longer list numbers the model never actually saw**
Scenario: a long source page gets hard-truncated to the prompt's character
budget — the "real figures" whitelist shown to the model must never include
a figure that got sliced out of the actual `<context>` block.
Root cause (fixed): `getFiguresInstruction`'s whitelist used to be built
once from `safeContext` (the pre-truncation text), while the actual
`<context>` block sent to the model was separately hard-sliced to a
character budget afterwards ([utils/promptUtils.ts:511-551](../utils/promptUtils.ts#L511-L551),
`hardSlice`/`finalContext`) — so the whitelist could list figures never
present in what the model actually read, and `findUngroundedFigures`
(checking against the full prompt, whitelist text included) would then
treat such a figure as self-confirmed.
Fix: `wrap()` now derives the figures whitelist from whatever `ctx` it is
called with, instead of a fixed outer value — since `finalContext` is
always a truncated _prefix_ of `safeContext`, the whitelist is now
guaranteed to be a subset of what the model actually sees, for every call
site.
Verify: [**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts) —
"never whitelists a price figure that truncation cut out of the context
(F9)"; confirmed live via debug log (see Shopping below) — the whitelist
sent to the model now exactly matches the figures present in the truncated
context, no more and no less.

✅ **Currency exchange rate — clean, new sub-category**
Scenario: today's EUR/PLN rate. Answer: "4,3037 PLN", sourced from three
real, on-topic currency sites (waluty.com.pl, internetowykantor.pl,
mybank.pl). Plausible figure, single clean value, no issues — the existing
grounding machinery (built mostly around asset prices) generalizes fine to
an exchange-rate question without any new failure mode.

🔧 **Follow-up currency conversion loses the anchor figure — a prevention
instruction alone was not enough, added a deterministic detection backstop
on top**
Scenario: asked the gold price ($1573, itself already correctly flagged
unverified), then asked the natural follow-up "And how much is that in
euros?". Two things went wrong:

1. The fresh web search built from the follow-up alone has no way to
   resolve "that" — it retrieved three generic USD/EUR converter pages
   (calculator.net, wise.com ×2, themoneyconverter.com), nothing tied to
   the actual gold figure.
2. The answer never touched the anchor figure at all: "The price of 1 USD
   in euros is 1.00." / on a repeat run, "1 USD is equivalent to 1 EUR." —
   both a wrong general rate (not the true USD/EUR rate) and not the
   conversion the question actually asked for, despite the model's own
   previous answer (with the real number) being right there in the same
   conversation's history.
   Added `getFollowUpConversionInstruction` (marker: "how much is that/it in
   X", "convert that to X", Polish equivalents) telling the model to use the
   exact figure from its own previous answer as the conversion base. Verify:
   [**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts) (F21).
   Confirmed wired correctly live, but the instruction alone did not change
   the answer on re-test ("The price of 1 USD in euros is 1.00." again) — the
   same class of gap as "weak retrieval, model answers anyway" under
   Beauty/cosmetics below: this asks the 1.7B model to locate a number
   several turns back and do arithmetic on it, which a prompt instruction
   alone doesn't reliably fix.
   Added a second, deterministic layer instead of relying on compliance:
   `hasGenuineConversionRate`/`isUngroundedConversionClaim`
   ([utils/web/figureGrounding.ts](../utils/web/figureGrounding.ts)) — the
   same "detect after the fact, append a visible caveat" pattern already
   proven for price and trend figures
   (`withFigureGroundingCaveat`/`withTrendGroundingCaveat`), now extended with
   `withConversionGroundingCaveat`
   ([utils/messageSources.ts](../utils/messageSources.ts), wired into
   [store/llmStore.ts](../store/llmStore.ts)). `findUngroundedFigures` alone
   does not catch this case: a converter page's own title/snippet almost
   always carries its normalization baseline as boilerplate ("1 USD to EUR",
   "1 Euro to US dollars") — plain text that trivially "confirms" any
   fabricated answer figure of exactly 1, which is exactly what tripped up
   the existing figure-grounding check on the live failure above. A genuine
   exchange rate is virtually never exactly 1 between two different
   currencies, so `hasGenuineConversionRate` requires a context figure other
   than a bare 1 before trusting that any conversion is actually grounded.
   Verify: [**tests**/figureGrounding.test.ts](../__tests__/figureGrounding.test.ts)
   and [**tests**/messageSources.test.ts](../__tests__/messageSources.test.ts),
   both asserting against the literal captured failure text ("The price of 1
   USD in euros is 1.00.").
   Live status (superseded — see the two follow-ups directly below): confirmed
   the caveat pipeline is wired end to end (full suite/tsc/eslint clean, no
   regressions), but several live re-tests this round did not reproduce the
   exact original wrong-figure text again — the model's output for this
   question shape is highly non-deterministic run to run (seen instead: an
   honest "no specific price found" refusal, a different fabricated figure not
   shaped like "1:1", and once a raw instruction-text leak unrelated to
   conversion at all — see the note below). So this was unit-verified against
   the exact captured failure, and wired correctly, but not live-reconfirmed
   to the same standard as the blank-screen fix below at the time.

✅ **Root cause of "not live-reconfirmed" found and fixed: `groundingCaveats`
was persisted to the DB correctly but never reached the live, currently-open
chat's rendered message — the ENTIRE caveat-badge feature (figure/trend/
conversion) was silently invisible in-session since it shipped**
Found while live-testing the RAG-priority feature below on iOS Simulator: a
follow-up currency-conversion question (see the new finding directly below)
produced a clearly-wrong figure and a debug log confirming
`detectGroundingCaveats` correctly returned `["conversion"]` — but no badge
ever appeared on screen. Root cause:
`updateChatStateForGeneration`'s `'complete'` phase
([store/llmStore.ts](../store/llmStore.ts)) merges the freshly-generated
`assistantMessage` into `activeChatMessages` field-by-field (`id`,
`content`, `sourceDocuments`, `timeToFirstToken`, `tokensPerSecond`) —
`groundingCaveats` was simply missing from that list, even though the
object being merged FROM (`data.assistantMessage`) always carried it
correctly. `persistMessage` writes it to SQLite correctly (confirmed
correct in the DB), so the badge would only ever appear after the chat was
reloaded from the database (app restart, navigating away and back) — never
during the live turn that actually produced it, which is the one moment a
caveat matters most. This explains why every "confirmed live" or
"not live-reconfirmed" note for `withFigureGroundingCaveat`/
`withTrendGroundingCaveat`/`withConversionGroundingCaveat` throughout this
whole doc was checking a channel that, in the live in-session case, could
never have shown the badge in the first place — any apparent live
confirmation for those either happened via a reload/restart in between (a
believable, easy-to-miss step) or was actually checking something else (the
answer text itself, before caveats moved into badges).
Fix: added `groundingCaveats: data.assistantMessage?.groundingCaveats ??
msg.groundingCaveats` to that merge, mirroring the existing
`sourceDocuments` line right next to it. One-line fix, but the entire
badge feature was affected by its absence.
Verify: confirmed live — the exact repro below now shows the
"No real conversion rate was found in the sources" badge immediately, in
the same turn that produced the wrong figure, with no reload needed.

✅ **New finding while re-testing: a follow-up conversion figure can be
wrong not just by "losing the anchor," but by copying an unrelated
currency pair's example output — plausibility check added against the
anchor figure**
Scenario, captured live on iOS Simulator: asked "Jaka jest aktualna cena
bitcoina w dolarach?" (correctly answered "77 493 USD", well-sourced),
then the natural follow-up "A ile to jest w euro?" ("And how much is that
in euros?"). The answer: "23,19 EUR" — sourced to a real currency-converter
page (money.pl), but that page's actual content was a **PLN→EUR**
calculator example ("100,00 PLN = 23,19 EUR"), not a USD→EUR conversion at
all. The model copied the calculator's example output figure verbatim,
producing a "grounded-looking" but nonsensical answer (77 493 USD does not
convert to 23.19 EUR by any real exchange rate — off by a factor of
~3,342×). This passed the existing `hasGenuineConversionRate` check because
the context genuinely did contain a non-`1` currency figure — just not one
that had anything to do with the actual question.
Fix: `isImplausibleConversionFigure`
([utils/web/figureGrounding.ts](../utils/web/figureGrounding.ts)) adds a
plausibility band on top of the existing "is there a real rate at all"
check — `FOLLOWUP_CONVERSION_MARKERS` only ever fires for conversions
between major, stable currencies (euro/dolar/funt/złoty/frank), and a real
rate between any pair of those never leaves roughly a 0.1×–6× band. When
the ratio between the answer's figure and the anchor figure (the largest
currency figure in the model's own immediately-preceding answer, extracted
via `activeChatMessages`) falls outside that band, the conversion is
flagged regardless of whether the retrieved page had a genuine-looking rate
on it. `isUngroundedConversionClaim` now takes an optional `priorAnswerText`
parameter for this; wired through `detectGroundingCaveats` from
[store/llmStore.ts](../store/llmStore.ts), which locates the previous
assistant turn by dropping the in-progress placeholder
(`activeChatMessages.slice(0, -1).findLast(...)`) rather than trusting the
array's last element, since that's always the still-generating placeholder
at this point in the flow.
Verify: [**tests**/figureGrounding.test.ts](../__tests__/figureGrounding.test.ts)
— the exact captured live text (77 493 USD anchor, 23,19 EUR answer,
flagged), a plausible conversion against the same anchor (not flagged), and
the case with no prior answer to anchor against (not flagged, consistent
with the existing behavior when nothing can be verified). Confirmed live:
re-ran the identical two-question sequence twice; the caveat correctly
fired both times the model produced an implausible figure (once "23,19
EUR" from the PLN-calculator mixup above, once a different fabricated
figure), and correctly did NOT fire on the leg of testing where the model
answered the price question itself (no conversion question asked, marker
doesn't match).

🔧 **New, unrelated finding along the way: raw instruction text leaking
into a visible answer**
While repeatedly re-testing the conversion follow-up above, one run
produced: _"$1. 366 stands far apart from the other figures found — that
is more likely a filter default, shipping cost, financing installment, or
an unrelated listing than this product's actual price. Do not use it as
the low (or high) end of a range, or as "the" price, unless the source
text explicitly ties it to this exact product..."_ — this is the model
echoing back the shape of `getOutlierNote`'s own instruction text
(the price-outlier grounding instruction, `utils/promptUtils.ts`) as if it
were the answer, rather than following it. Not reproduced a second time,
not investigated further, and not the same failure as the "1:1 rate"
pattern above — flagged here only so it isn't lost; worth a dedicated
look if it recurs.

## Sports (football, basketball)

✅ **All-time record vs current-season scoping**
Scenario: "who scored the most goals this year" must not resolve to an
all-time/career leaderboard.
Verify: retrieval-side `excludeAllTimeIfPeriodScoped` (no fallback — an
empty result is treated as safer than a wrong one) in
[utils/web/listingRelevance.ts](../utils/web/listingRelevance.ts); planner
side, `PLANNER_SYSTEM_PROMPT` injects the concrete year into the query
([utils/web/buildSearchQuery.ts](../utils/web/buildSearchQuery.ts)) —
confirmed live, the model started appending `2026`/`site:...` on its own.

✅ **No fabrication when search genuinely returns nothing**
Verify: `getWebSearchFailedInstruction` in
[utils/promptUtils.ts](../utils/promptUtils.ts) — confirmed live.

✅ **Site-restricted search**
Scenario: naming a domain in the question restricts search to it via the
`site:` operator plus a hard host filter on the fetcher side.
Verify: `extractSiteRestriction` / `matchesSiteRestriction` — confirmed
live, results came exclusively from transfermarkt.pl after naming it.

✅ **Competition/league scope mismatch**
Scenario: Champions League stats answering a domestic-league question.
Verify: unconditional `getScopeIntegrityInstruction` in
[utils/promptUtils.ts](../utils/promptUtils.ts) — tells the model to name
the narrower scope (specific competition, region, category) explicitly
instead of stating the figure as a general answer. Deliberately generalized
rather than enumerating competition names. Confirmed live in basketball
(LeBron James, NBA 2025–26 season) — sources correctly scoped to the exact
competition asked about.

🔧 **Suspected cross-sport data contamination (unconfirmed)**
Scenario: "Patryk Krezolek (F)" answer read like hockey scouting notation
for a football question, with zero Sources. Probably covered by the two
Sources fixes below (Citations / Sources), but not reproduced 1:1 again to
confirm.

🔧 **Imprecise phrasing on a season-total question (distinct from the above)**
Scenario: asked for LeBron James's points this NBA season, the answer read
"over 60 points in individual games" instead of a clear season total —
sources were correctly scoped (NBA season-stats pages), so this looks like
the model conflating "single-game high" with "season total," not a
retrieval or grounding bug. Low severity — not a factual error, just unclear
phrasing. Not yet root-caused.

🔧 **Live match result — plausible but thin (new sub-category: very recent
events, distinct from season-stats questions above) — partially improved**
Scenario: "what was the score of Real Madrid's last match" answered "2-0",
backed by 5 real live-score sources (aiscore.com, flashscore.pl ×2,
legalsport.pl, goal.pl) — the score itself is plausible and well-sourced,
but the answer never named the opponent or the date, which a "last match"
question implicitly asks for. Not a grounding bug (nothing false was
stated) — an answer-completeness gap distinct from anything fixed so far.
Fix: `getRecentEventCompletenessInstruction` (`utils/promptUtils.ts`),
triggered by "last/latest match/game" markers, tells the model to include
who else was involved and when, not just the headline figure, when the
sources name that. Verify:
[**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts) (F19).
Confirmed live, but only a partial win: re-asked the identical question, the
answer grew from a bare "2-0" to "Ostatni mecz Realu Madryt [...] mecz w
Międzyklubowe towarzyskie, w którym Real Madryt wygrał 4-2" — now names the
competition/context, but still never names the actual opponent. The
instruction can only surface what the sources contain; if the fetched pages
themselves never name the opponent (plausible for a live-score widget page),
no instruction fixes that — worth re-checking with a question where the
sources are more likely to name both teams explicitly.

✅ **Wrong (anachronistic) player named as a follow-up answer — fixed at
the retrieval layer, extending the existing all-time-page guard**
Scenario: asked "what was the score of the latest Lakers game" (correctly
answered "99–93, Houston Rockets winning," sourced to a real
basketball-reference.com/ESPN page for that exact game), then asked "who
was the top scorer in that game" as a follow-up. The answer: "Wilt
Chamberlain" — a player who last played in 1973 and died in 1999, decades
before this game.
Sources for the second answer: a single basketball-reference.com page
titled "NBA Single Game Leaders and Records for Points" — an all-time
single-game records page (the page Chamberlain's famous 100-point game
lives on), not a boxscore for the Rockets-Lakers game just discussed.
Root cause: the existing ✅ "All-time record vs current-season scoping"
guard above (`excludeAllTimeIfPeriodScoped`,
[utils/web/listingRelevance.ts](../utils/web/listingRelevance.ts)) only
gates on an explicit period marker like "this year"/"w tym roku" — "in
that game" is a different shape of scoping (a specific just-discussed
EVENT, not a time window) that matched no existing marker, so the all-time
records page was never excluded and the model read the record-holder's
name off it as if he'd played in the just-discussed game.
Fix: added `EVENT_SCOPE_MARKERS` (anaphoric "in that/this game/match", "w
tym/tamtym meczu", etc.), OR'd into the same `isPeriodScopedRecordQuery`
gate the period markers already use — the exclusion logic itself needed no
change, only what counts as "scoped." Also widened `ALL_TIME_PAGE_PATTERN`
to catch "single game leaders and records"-style titles (previously it only
recognized "all-time"/"career"/"record scorers" phrasing, not "single game
leaders"). This is a retrieval-side fix; the actual root under-specification
— `verbatim`-mode query building (the default planner — see
[constants/model-profiles.ts](../constants/model-profiles.ts)) has no
access to conversation history to resolve "that game" into the real
teams/date, so the search query itself stays under-specified — is
untouched and out of scope; this fix only stops an all-time page from being
used to answer that under-specified query, same as the existing period-
scope guard does for "this year" questions. Verify:
[**tests**/listingRelevance.test.ts](../__tests__/listingRelevance.test.ts)
— the exact captured Basketball-Reference title dropped alone, dropped
alongside a real boxscore page (keeping only the boxscore), and NOT dropped
for a plain all-time question with no event/period scope. Confirmed live:
reloaded, re-ran the identical two-question sequence (latest Warriors game
→ "who was the top scorer in that game") — the follow-up now names Klay
Thompson (a real, current-era player) with no all-time-records page in
Sources, instead of a decades-anachronistic name. Honest caveat: that
second answer also carried no visible Sources despite naming a specific
player and point total — a separate, already-documented "weak retrieval,
model answers anyway" gap (see Beauty above), not the anachronism bug this
fix targets; the anachronism itself did not recur.

## Shopping (prices, product variants, electronics, fashion)

✅ **Component/electronics pricing with a plausible market narrative**
Scenario: asked for the price of 32GB DDR5 RAM, the answer ($392) tracked a
genuinely retrieved "DDR5 prices up 110%" market-crisis narrative across
five sources (tech-insider.org, rampricechecker.com, Newegg, etc.) —
initially looked suspiciously high until the sources confirmed a real
current price spike. No fabrication; correctly grounded in a volatile-price
scenario.

🔧 **Product-variant mixups (partially mitigated)**
Scenario: a 128GB listing's price attributed to the 256GB variant.
Verify: `getVariantGroundingInstruction` in
[utils/promptUtils.ts](../utils/promptUtils.ts) — prompt-side warning only,
no hard retrieval-side filter yet.

✅ **Wrong price picked from a page dominated by other products' prices — fixed**
Scenario: asked for the price of an iPhone 17 Pro 256GB listing, the answer
was **3,698.96–3,746.00 zł** across two separate live runs; the real price
(independently verified, and present verbatim in the scraped page) is
**~5,099–5,187 zł**. The source (Ceneo.pl) was the correct listing, so this
was never a variant-selection bug.

- Whitelist/truncation-order bug (see Finance/crypto above): this was
  suspected to be the root cause and is fixed and verified — the whitelist
  sent to the model is confirmed (via live debug log) to always match the
  figures actually present in the truncated context. Fixing it alone did
  **not** fix the live answer, though — it just proved the whitelist was
  consistent with a context that was itself already wrong.
- **Real root cause (confirmed live, now fixed)**: the truncation itself
  was cutting the correct price out of context entirely. Ceneo's scraped
  page layout puts a "customers also viewed" carousel of _other_ iPhone
  models/variants (iPhone Air, iPhone 17, iPhone 17 Pro Max, other colors)
  — each with its own `od X zł` price — **before** the actual target
  listing's own price in the page's linear text. The old truncation kept a
  blind character prefix of the scraped page, so on a long page the correct
  price (e.g. "Apple iPhone 17 Pro 256GB Głębinowy błękit od 5 099,00 zł")
  sat past the cutoff and was dropped entirely, while several decoy prices
  earlier in the carousel survived. The model then picked the
  closest-looking survivor instead of admitting the real figure wasn't in
  what it was shown.
  - Fix, upstream (`utils/web/contextBudget.ts`): `webContextCharBudget`'s
    overhead estimate was a flat, stale `1400`-char guess dating from
    before this session's system prompt grew past a kilobyte with new
    unconditional instructions (scope-integrity, no-leaked-jargon,
    weak-retrieval, variant-grounding, etc.) — so it kept handing web
    search far more room than the model's real prompt budget had left.
    Fixed by measuring the actual current system prompt length instead of
    guessing. Verify:
    [**tests**/contextBudget.test.ts](../__tests__/contextBudget.test.ts)
    (F12).
  - Fix, downstream / defense-in-depth (`utils/promptUtils.ts`): when
    truncation is still unavoidable and a web source is present, the
    emergency slice no longer takes a blind prefix — `smartTrimContextBlocks`
    reuses the same query-term/money-anchor relevance scoring web search
    already applies when assembling context
    (`selectRelevantContent` in `webResultsToContext.ts`), but runs it at
    THIS layer's true final budget instead of an upstream estimate. It only
    touches well-formed, self-closed `--- <label>: <name> --- ... --- End
of <label> ---` blocks, so every kept block stays fully attributed and
    closed; anything else falls back to the original naive-slice path
    unchanged. Verify:
    [**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts) (F11).
  - Confirmed live on-device: the same question ("Ile kosztuje iPhone 17
    Pro 256GB w Polsce?") now answers "5099,00 zł" — the real price — with
    Sources still correctly populated.
- `findUngroundedFigures`'s price-statement extraction
  ([utils/web/figureGrounding.ts](../utils/web/figureGrounding.ts)) prefers
  figures actually governed by the word "price"/"cena" over any currency
  figure in context — real and tested
  ([**tests**/figureGrounding.test.ts](../__tests__/figureGrounding.test.ts)),
  but wasn't the fix here: Polish e-commerce pages write "od X zł" ("from
  X zł"), not "cena: X zł", so the tight extraction found nothing and fell
  back to the loose match — which can't distinguish the target product's
  price from a decoy's on its own. Still useful for pages that DO write
  "cena: X zł" directly.

✅ **Fabricated figure-verification caveat, confirmed on a live Amazon case**
Scenario: asked for the price of Sony WH-1000XM5 headphones on Amazon, the
answer stated **$278** — a number not present in any retrieved source (the
sources say $150 "lowest price ever" and "nearly 40% off"). The
⚠️ _"A figure in this answer could not be verified against the retrieved
sources"_ caveat correctly fired, with Sources still populated so the user
can check the real figure themselves.
Verify: `withFigureGroundingCaveat` in
[utils/messageSources.ts](../utils/messageSources.ts) — this is the same
mechanism documented under Finance/crypto's original ✅ item, now confirmed
working on a genuinely fabricated e-commerce price it wasn't specifically
tuned for.

✅ **Raw price list dumped instead of a synthesized answer/range — fixed**
Scenario: asked for the price of Nike Air Max 90 shoes, the answer was
"Buty Nike Air Max 90 kosztują: $145, $108.97, $121.97, $160, $165, $150,
$108.97, $65." — every price found on Nike's own category listing page
(which naturally lists many colorways/sizes at different prices), dumped
verbatim with no synthesis, no mention of which price applies to what, and
no range framing. Not a grounding bug — every figure is genuinely on the
page — but a real answer-quality gap distinct from fabrication; no existing
instruction targeted "the source is a listing page with many valid prices
for different variants," only single-figure grounding.
Fix: `getFiguresInstruction` (`utils/promptUtils.ts`) now adds a range hint
whenever 3+ distinct figures are found for one unlabeled product: _"These
are prices for different variants or listings of the same product, not one
figure to quote directly — do not list them out. Respond with ONLY a range
(lowest to highest) or ONLY the single most relevant one."_ Two figures
(e.g. current vs. previous price) don't trigger it, since stating both is
usually the right answer there.

- First attempt used softer wording ("state a range... not every one as a
  list") — live-tested, and the model added a range but ALSO kept the full
  list ("...$65, $64, $102, ... The lowest price is $64 and the highest is
  $160."). Strengthened to the imperative "do not list them out... ONLY a
  range" above, which live-tested clean: "The prices for Nike Air Max 90
  shoes on Nike.com range from $65 to $160." — no list, no caveat.
  Verify: [**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts)
  (F14 and the two-figure negative case); confirmed live on-device with the
  exact scenario above.

✅ **Refusal answered in the wrong language — not reproduced, not a bug**
Scenario: asked (in Polish) for the price of an RTX 4070 GPU on Allegro,
sources came back without the specific figure and the model correctly
refused rather than fabricate — but the refusal itself was written in
**English** once. The same refusal shape on a different question (Nivea Q10
cream, beauty category below) came back correctly in Polish. Two different
outcomes for the same question, both otherwise correct, points to ordinary
small-model/live-search variability rather than a reproducible instruction
gap — left unfixed, consistent with not adding case-by-case patches for a
single, unreproduced instance.

✅ **Suspiciously low outlier price stated as the low end of a range — fixed**
Scenario: re-testing the RTX 4070 question above (after the query-planner
fix) got a _different_ third outcome: a Polish, sourced-looking answer —
"...najniższe ceny mogą być dostępne w zakresie od 399 zł" (from 399 zł) —
but 399 zł is roughly 5-8x below any real price for that card. Real prices
cluster in the 2,000-3,000 zł range; a figure that far outside the cluster is
far more likely to be a "Cena od / Cena do" price-filter widget's default
bound, a financing installment, a shipping fee, or a decoy listing that a
scraped page mixes in with the genuine variant prices — not the same shape of
bug as the earlier Nike Air Max range fix (there, every figure found was
genuinely a valid price for some listing; here, one of them almost certainly
isn't a price for this product at all).
Fix: `splitPriceOutliers` (`utils/web/figureGrounding.ts`) partitions the
whitelist of figures found by median-relative distance — anything below 1/3
or above 3x the median is flagged. `getFiguresInstruction`
(`utils/promptUtils.ts`) now names the outlier explicitly and tells the model
not to use it as the low/high end of a range or as "the" price unless the
source text explicitly ties it to this exact product. Median-relative rather
than a fixed threshold, since normal price variance differs by product
category (compare: Nike Air Max colorways cluster within ~2.5x of each other
and correctly trigger no outlier flag).
Verify: [**tests**/figureGrounding.test.ts](../__tests__/figureGrounding.test.ts)
(F15 — `splitPriceOutliers`, both a low and a high outlier, and the Nike
listing as a true-negative); [**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts)
(same scenario end-to-end through `prepareMessagesForLLM`, plus a
true-negative for a normally-clustered listing). Re-tested live twice after
the fix (identical and reworded RTX 4070 questions): neither run produced a
low-outlier figure again — both times the model said the sources don't state
a definite price rather than anchoring on one, which is the safe outcome
either way. Given this question's already-documented variability across
runs, that's supporting evidence rather than a byte-for-byte repro of "399 zł
→ a clean range," but the whitelist mechanism itself is directly covered by
the unit tests above using the exact real-world figures.

💡 **Proposed**

- Consider a retrieval-side filter analogous to
  `excludeCrossAssetIfAlternatives` for product variants if the prompt-side
  warning proves insufficient under further testing.

✅ **Structured product data — extract the offer's own price/name/
availability instead of inferring it from scraped prose**
Every price-grounding bug fixed this round before this one — the variant
mixup, the carousel-of-decoys truncation bug, the raw Nike listing dump, and
the RTX 4070 outlier above — was a downstream symptom of the same root gap:
once a page is fetched, the pipeline reduced it to plain prose and then had
to _infer_ which number in that prose was the actual price, with layered
regex heuristics (`extractPriceStatementTokens`, `splitPriceOutliers`,
`getVariantGroundingInstruction`, the range hint, …) doing the inferring.
Most e-commerce pages already state the answer unambiguously in a form
built for computers, not just humans, to read.

Pipeline before this fix: `WebViewScrapeProvider`
([utils/web/scrape/webViewScrapeProvider.ts](../utils/web/scrape/webViewScrapeProvider.ts))
navigates a real search engine in a hidden WebView and returns real result
links (already, generally the specific listing page a search engine ranked —
not a synthetic "search results" URL), so link precision was mostly already
there. The gap was downstream: `enrichWebResults` →
[extractArticle](../utils/web/url/extractArticle.ts) fetches that URL's full
HTML, but `heuristicExtractText` stripped it down to generic readable prose
— the same shape of extraction a news-reader mode would use, blind to
whether the page is an article or a product listing. `extractArticle`
already parsed `<script type="application/ld+json">` blocks for generic
`articleBody`/`description`/`text`/`headline` keys, as a low-priority
fallback — but ignored `@type: "Product"` / `"Offer"` JSON-LD entirely,
even though that's exactly the block a storefront uses to declare `name`,
`offers.price`, `offers.priceCurrency`, `offers.availability` — the fields
every downstream price-grounding heuristic was trying to reconstruct by
guesswork from prose.
Fix: `extractStructuredProduct`
([utils/web/url/extractArticle.ts](../utils/web/url/extractArticle.ts))
parses JSON-LD `Product`/`Offer` nodes (including ones nested in `@graph`),
falling back to Open Graph product meta tags
(`product:price:amount`/`product:price:currency`) when there's no JSON-LD
Product. `ExtractedArticle`/`WebSearchResult`
([utils/web/types.ts](../utils/web/types.ts)) now carry an optional
`product` field, propagated through `enrichWebResults`
([utils/web/enrichResults.ts](../utils/web/enrichResults.ts)).
`webResultsToContext.ts` prepends a `[Verified product data]`-marked block
ahead of the usual passage when present; `getVerifiedProductInstruction`
(`utils/promptUtils.ts`) tells the model to trust that figure over any other
price in the same or a different source. Deliberately conservative about
when to trust the page at all: a page naming more than one `Product` node
(a category/listing page) or one `Product` whose `offers` disagree on price
(several sellers/variants bundled under one node) leaves `product` unset
rather than guessing which one — the same "which one" ambiguity this exists
to resolve, not reintroduced in a new form — and falls back to exactly the
existing heuristic pipeline unchanged. This is additive, not a replacement:
a page with no structured markup at all gets no `[Verified product data]`
block and behaves exactly as before.
Verify: [**tests**/extractArticle.test.ts](../__tests__/extractArticle.test.ts)
(single Product/Offer with normalized availability, array-wrapped offer,
multiple disagreeing offers, a multi-product category page, OG-tag fallback,
no structured data at all, a `Product` nested in `@graph`);
[**tests**/enrichResults.test.ts](../__tests__/enrichResults.test.ts)
(propagation onto the enriched result);
[**tests**/webResultsToContext.test.ts](../__tests__/webResultsToContext.test.ts)
(the marker line renders only with a price present);
[**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts) (F16 — the
trust instruction appears only when a source actually carries structured
data). Confirmed live: asked for the current price of an iPhone 17 Pro from
Apple's own Polish store, the answer was a single clean figure — "5799 zł"
— sourced from apple.com and thinkapple.pl, with no raw list, no range hint,
and no outlier caveat. That's the expected shape of a working structured-
data hit (a clean, unhedged, correctly-sourced figure) rather than direct
proof the `[Verified product data]` block itself fired (the raw prompt
wasn't inspected this round) — good supporting evidence, not a byte-for-byte
confirmation.
💡 **Still open**: microdata (`itemprop="price"` etc., a third common markup
style alongside JSON-LD and Open Graph) is not parsed — not observed
blocking any live scenario yet, so left out of this pass; add it if a real
site turns out to rely on it exclusively.

✅ **Fabricated price when every source fetch fails entirely — a gap in
`findUngroundedFigures` itself, not a scraping/extraction bug — fixed**
Scenario: asked for the price of a Lenovo Legion 5 Pro laptop on x-kom.pl,
all 4 sources came back `"from the search listing only"` (no page content
fetched, no price data anywhere in context) — the model answered "0 zł"
anyway, and no ⚠️ caveat was appended.
Root cause: `findUngroundedFigures`
([utils/web/figureGrounding.ts](../utils/web/figureGrounding.ts)) computed
`contextFigures` (real currency figures found in context) and, when that
list came back empty, returned `[]` — "nothing to compare against" was
being treated as "nothing to flag." That's backwards: context existing but
containing zero currency figures at all is the _strongest_ ungrounded case,
not a reason to wave a stated figure through. Every earlier fix in this
file targeted "wrong figure among several real ones in context"
(installment vs. price, a filter-widget default, a different asset); this
is the first case of "context has no price data whatsoever, yet the model
still states one."
Fix: `contextFigures.length === 0` now returns every figure the answer
states, instead of `[]`. Verify:
[**tests**/figureGrounding.test.ts](../__tests__/figureGrounding.test.ts)
(replaces the old "returns nothing" test, which asserted the previous,
backwards behavior, with one asserting the answer's figure is flagged; a
second test covers the still-correct "answer states no figure either" case
alongside it);
[**tests**/messageSources.test.ts](../__tests__/messageSources.test.ts)
confirms `withFigureGroundingCaveat`'s two closest existing tests are
unaffected (an answer whose figure matches context, and an answer with no
currency figure at all — neither passes through the new zero-context
branch). Confirmed live: reloaded, re-asked the identical question with a
different product (Dell XPS 15, then Asus ROG, on Media Expert) —
subsequent runs either answered with a real, sourced price or an honest
"price not stated" refusal; did not reproduce the exact "0 zł" text again
(the underlying trigger — every source fetch failing — is itself
non-deterministic), so this is unit-verified against the exact captured
failure rather than live-reconfirmed on the same output.

## Real estate

🔧 **Honest refusal on rental pricing — but leaks the Polish word for
"context"**
Scenario: asked for the rent on a 40m² Warsaw apartment, sources were only
OLX category/search-listing pages with no actual price stated — the model
correctly refused rather than fabricate a figure. But the refusal itself
read "Szukane informacje nie są zatwierdzone w kontekście dostępnym" —
leaking **"kontekście"** (context), the same internal-jargon-leak shape
already fixed for English (see User-facing communication below).
Root cause, precisely: `noLeakedJargon` in
[utils/promptUtils.ts](../utils/promptUtils.ts) already reads "Never say the
word \"context\" **(or its translation)**" — the instruction already
anticipated this, so this is not a coverage gap in the instruction text like
the original English leak was. It's the small model not fully complying
with an instruction it was given, in a language it may weight less
consistently. One observed instance — consistent with this doc's own
principle of not writing a case-by-case patch for a single, unreproduced
occurrence.

⚠️ **Attempted fix caused a worse regression — reverted; a real lesson about
instruction cost on a small model**
Tried repeating `noLeakedJargon` a second time, right next to the user's
question (the same "sandwich" pattern `getLanguageReminder` already uses
successfully — see its rationale above). Live-tested on the exact same rent
question: instead of fixing the jargon leak, the model produced a completely
degenerate answer — it echoed the question verbatim back as its entire
response, with no refusal, no jargon leak, no content at all. **Reproduced
5 times in a row** (two phrasings, retried after an unrelated hardening fix
below). Confirmed via "Sources": both retrieved OLX pages were
`"from the search listing only"` — meaning enrichment never fetched real
page content, only a generic SERP title/snippet ("sprawdź kategorię
Mieszkania" — "check the [Apartments] category," itself just an OLX
redirect stub, not listing data). So the actual context handed to the model
here was already close to empty. Isolated the cause by elimination: turning
web search off for the identical question got a full, coherent (if
hallucinated, ungrounded) answer — proving the failure was specific to the
web/RAG prompt-assembly path, not the model or question in general. The
newly-added reminder was the only _unconditional_ new instruction line this
round (the comparison/recent-event instructions above only add text when
their question markers match, which they don't here) — the working theory
is that stacking one more instruction onto an already near-empty, low-
information context tipped a 1.7B model from "produce a plausible-if-thin
answer" into "nothing to synthesize, so echo the input" — the general
Text quality lesson worth remembering. Reverted (`utils/promptUtils.ts`);
re-tested the identical question immediately after and got a coherent,
honest answer again: "Nie ma jednej konkretnej liczby [...] warto
skonsultować się z ogłoszeniami na OLX" — no echo, no jargon leak either.
Net effect: the original jargon-leak instruction (with "or its translation")
stays as the only defense — not strengthened this round, since the
strengthening attempt cost far more than the one-off leak it targeted.
Verify: [**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts) —
the sandwiched-reminder test and its assertion were added and then reverted
together with the code; `git diff` shows no net change to `wrap()`'s output
shape. This is a documented dead end, not a shipped fix — kept here so a
future attempt at the same idea doesn't have to rediscover the failure mode
from scratch.

💡 **Unrelated hardening added along the way, not the fix for the above**
While investigating, added `declaresNonProductPage` (`og:type` check) to
`extractStructuredProduct` (`utils/web/url/extractArticle.ts`): a category/
listing page can still carry exactly one clean `Product`/`Offer` JSON-LD
node (e.g. one featured listing marked up for rich snippets while dozens of
others aren't marked up at all), which the existing "exactly one Product
node" safeguard can't tell apart from a genuine single-offer page. Now
requires the page's own `og:type` to agree (or be silent) before trusting
that one node. This is a legitimate, independently-justified correctness
fix — verified with its own tests — but it did **not** turn out to explain
the echo regression above (the OLX pages here never got far enough to have
their JSON-LD parsed at all — enrichment itself found nothing usable).
Verify: [**tests**/extractArticle.test.ts](../__tests__/extractArticle.test.ts)
(F20).

## Beauty / cosmetics

✅ **Honest refusal, no fabrication**
Scenario: asked for the price of Nivea Q10 anti-wrinkle cream, sources had
no pricing data — the model correctly said so in Polish ("Źródła nie
dostarczają informacji o cenach...") instead of inventing a figure.

🔧 **Weak retrieval, model answers anyway**
Scenario: sources don't carry enough data, but the model still builds a
full-confidence answer.
Verify: `getWeakRetrievalInstruction` — partial mitigation.

## Travel / legal

✅ Vietnam visa question — correct, well-grounded answer. No issues found.

✅ **Circular non-answer to a "which X" follow-up — new failure class,
distinct from both fabrication and literal repetition — fixed via a new
detector, same treatment as the question-echo fix below**
Scenario: after a correctly-answered flight-price question (Warsaw→London
on Skyscanner, "128 zł–181 zł," well-sourced), asked the natural follow-up
"which airline offers the cheapest ticket?" The answer, in full: "Najtańszy
bilet oferuje linia lotnicza, która jest przedstawiana w źródle 2 jako
'dziesiątk[a] linii lotniczych'. Źródło 1 nie podaje konkretnego nazwiska
linii lotniczych, ale źródło 2 podaje, że porównuje ceny linii lotniczych.
Dlatego, że źródło 2 opisuje, że porównuje ceny linii lotniczych, to linia
lotnicza, która oferuje najtańszy bilet, jest przedstawiona w źródle 2." —
five sentences that only ever restate "source 2 exists and compares
airline prices," in slightly different phrasing each time, without ever
naming an actual airline. Not a fabrication (nothing false is stated) and
not caught by any of the three loop detectors (the repeated idea is
reworded each time — "jest przedstawiana," "podaje," "opisuje,"
"przedstawiona" — never the same clause, word run, or short phrase
verbatim, which is exactly what `truncateAtRepeatedClause` requires).
This looks like the model failing to extract a specific entity (an airline
name) from a source that likely only presents it in a table/list structure
the scraped prose flattened, and instead of admitting that or picking a
name, it loops on restating the source's existence as if that were
progress toward an answer. Related to, but distinct from, the honest-
refusal pattern this file documents working correctly elsewhere (Beauty,
Real estate) — a refusal states plainly that the data isn't there; this
instead simulates reasoning toward an answer that never arrives.
Fix: `isCircularNonAnswer`
([utils/messageSources.ts](../utils/messageSources.ts)) counts mentions of
"źródł*"/"source(s)" in the visible (outside-`<think>`) answer text — a
genuine answer in this app essentially never says "source" inline at all
(citations surface through the separate Sources sheet), so 3+ mentions is a
strong, conservative signal of this exact failure shape rather than real
content. Routed through the same `store/llmStore.ts` gate as the
question-echo check below — a match is treated as a failed generation
(`markGenerationFailed` → "Failed to generate a response." with Retry)
instead of being persisted as a real reply. Verify:
[**tests**/messageSources.test.ts](../__tests__/messageSources.test.ts) —
the exact captured live text, an English-language version of the same
shape, a genuine answer that names a real entity (not flagged), a single
ordinary "source" mention (not flagged), two mentions — below the
threshold (not flagged), and mentions inside a `<think>` block only counted
if outside it. Confirmed live: reloaded, re-asked the identical follow-up
in the same thread — this run produced a different-shaped but similarly
empty hedge ("the sources do not provide specific information... the
cheapest ticket is likely offered by one of the major airlines," never
naming one) instead of the exact original circular text (model
non-determinism), and `debugger-log-registry` confirms the detector caught
it: `Chat sendMessage failed Error: The model produced a circular
non-answer with no actual content` — shown to the user as "Failed to
generate a response." with Retry, not persisted as if it answered the
question.
⚠️ **Status note (this round)**: `isCircularNonAnswer` and both its call
sites in `store/llmStore.ts` (`describeGenerationFailure` and the
persistence gate) were removed in the tip commit on this branch, `9d3476a
"feat(web): move grounding caveats out of the answer text into badges"` —
apparently collateral damage from that refactor, since the two are
unrelated (that commit moved _caveats_ — figure/trend/conversion warnings
appended to answer text — into separate badge components; the circular
detector was a _reject-and-retry_ gate, not a caveat). Live testing this
round reproduced exactly this failure shape again on Pixel: literal
"źródło 2" phrases in the answer, and no Sources shown underneath (see
Citations / Sources below for why the latter half also happens on a
related-but-distinct path). Deliberately left unfixed this round — out of
scope per direct instruction, tracked for a future PR. Re-adding it is a
straight revert of the two deletions in that commit.

## Entertainment (movies / TV)

✅ Current-year Emmy nominees question — correct, well-grounded in a current
source. No issues found.

✅ **Review-score grounding — a new numeric modality, works cleanly**
Scenario: Oppenheimer's Rotten Tomatoes score. Answer: "93%", sourced
directly from two rottentomatoes.com pages for the film itself. Confirms the
existing figure-grounding machinery (built mostly around currency prices)
generalizes to a percentage review score without a new failure mode.

## Health / medicine

✅ **Vitamin D dosage question — clean after fixes below**
Answer is concise, correctly grounded, with "Sources" correctly populated
(two real English-language medical sources: Endocrine Society, MDPI).

🔧 **This category surfaced three general fixes**, documented under
Citations/Sources, Text quality, and User-facing communication below — all
confirmed live on this same question before/after the fix.

✅ **Comparative question retrieves correctly but synthesizes poorly — fixed**
Scenario: asked how flu and cold symptoms differ, retrieval was good (a
single, correctly on-topic, reputable source — mp.pl) and no figure was
fabricated, but the synthesis doesn't cleanly separate the two symptom
lists, includes an odd clinically-unnatural phrase ("gorączkę, która rośnie
liniowo" — "a fever that rises linearly"), and closes with a non-sequitur
that mixes cold's viral causes into a sentence about flu-vaccine efficacy.
Confirmed live (verbatim, after an unrelated app restart): "Grypa i
przeziębienie różnią się objawami. Grypa ma ostry początek [...] Przeziębienie
jest powodowane różnymi wirusami, a szczepionka przeciwko grypie jest
skuteczna." Not a grounding bug — a comparison-synthesis quality gap. Same
shape of gap as the LeBron "single-game vs. season" phrasing issue under
Sports — small-model synthesis of correctly-retrieved facts, not retrieval
or fabrication.
Fix: `getComparisonStructureInstruction` (`utils/promptUtils.ts`), triggered
by "how do X and Y differ" / "czym się różni" markers, tells the model to
address each side under its own clear heading or point rather than blending
them into one paragraph. Verify:
[**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts) (F18).
Confirmed live on the identical question: the answer now opens with "Grypa
i przeziębienie różnią się objawami i przebiegiem," then presents **Grypa:**
and **Przeziębienie:** as two clearly separated bulleted sections, closing
with a plain one-line summary — no blending, no non-sequitur.

## Food / recipes (how-to, non-price) — new category

🔧 **Severe repetition loop, invisible to all three existing loop detectors
— found, fix prototyped and live-verified, then deferred (out of scope for
this round)**
Scenario: asked for a simple no-bake cheesecake recipe. Retrieval was
correct — 5 real "sernik na zimno" recipe pages. Generation was not: the
ingredient list included "cebula" (onion) and "czarny cukier" (not a real
ingredient), and the numbered method fell into a long loop alternating
between two near-identical sentence templates across 18+ numbered steps
before truncation, including a garbled, vulgar-sounding word.
Root cause of why this slipped through: `findRepeatedWordRun` and
`findRepeatedPhraseRun`
([utils/loopDetection.ts](../utils/loopDetection.ts)) catch a word or a
short (2–5-word) phrase repeated back-to-back with no punctuation between
copies — this loop's repeating unit is a full ~12+-word sentence, and each
copy sits inside its OWN numbered list item (i.e. separated by list-item
punctuation/numbering, not glued together with no separator), which is
exactly the shape those two detectors were built to catch the _absence_ of
punctuation for, not a _presence_ of structural separators between longer
repeated units. `truncateAtRepeatedClause` operates at the clause level and
likewise wasn't built for a unit this long recurring across structurally
distinct list items — a genuine fourth granularity in the loop-detection
family, not a variant of an already-covered case.
A candidate fix (`findRepeatedClauseCycle`, generalizing the existing
single-clause check to a _cycle_ of 2–4 distinct clauses repeating 3+
times) was prototyped and confirmed live to cut the loop cleanly after step
2 instead of running to 18+ steps. Decision: this is being tracked as a
separate task rather than shipped in this round — reverted out of
`utils/loopDetection.ts` for now. The ingredient hallucination itself
("mleko z kwasem fosforowym" — nonsense) is also a separate, still-open
generation-quality gap, unrelated to repetition.

## Weather / current conditions

✅ **Honest refusal, no fabrication**
Scenario: asked for current weather in Kraków with no matching source —
model correctly states it doesn't know rather than inventing a temperature.

🔧 **This category surfaced two general fixes**: see User-facing
communication (internal-jargon leak) and Citations/Sources
(`NO_ANSWER_PATTERNS_PL` gaps) below.

## General knowledge / current events

✅ UN Secretary-General question — correct answer (António Guterres),
Sources present. No issues found.

## Technology / AI

✅ Latest OpenAI GPT model question — accurate answer, two real, on-topic
sources (openai.com, developers.openai.com). No issues found.

## Network reliability / offline detection

✅ **Transient false-offline reads no longer block search**
`NetInfo.isInternetReachable` could momentarily report `false` across app
state transitions, silently skipping search as "offline" while the network
was fine.
Verify: `isDeviceOnline` with a single retry after a short delay in
[utils/network.ts](../utils/network.ts).

## Text quality (loops / repetition)

✅ **Clause-level repetition loop**
Scenario: "...accident in Sweden, accident in Sweden..." repeated.
Verify: `truncateAtRepeatedClause` in
[utils/loopDetection.ts](../utils/loopDetection.ts) — cuts before the first
repeat.

✅ **Word-level repetition loop with no punctuation between copies**
Scenario: a single word repeated dozens of times with no separating
punctuation (observed live on the vitamin D answer, ran effectively
forever) — the old detector split on clause punctuation only, so an
unpunctuated run was "one clause" and slipped through entirely.
Verify: `findRepeatedWordRun` in
[utils/loopDetection.ts](../utils/loopDetection.ts) — flags the same word
repeated 4+ times in a row (2–3 repeats is normal emphasis/stutter, not a
loop) and cuts before the first copy. Covered by
[**tests**/loopDetection.test.ts](../__tests__/loopDetection.test.ts);
confirmed live — the same question stopped looping after the fix.

✅ **Multi-word phrase loop with no punctuation between copies**
Scenario: the single-word fix generalized one level up — a model can just
as easily loop on a short _phrase_ ("bardzo dobrze bardzo dobrze bardzo
dobrze...") with no punctuation between repeats, which neither the
clause-level nor the single-word check can see (each word alone isn't
repeating — the pair is).
Verify: `findRepeatedPhraseRun` in
[utils/loopDetection.ts](../utils/loopDetection.ts) — scans 2–5-word
windows and flags one repeated 3+ times back-to-back, gated by a minimum
combined phrase length so short connector pairs ("no i", "tak jak") can't
trip it on ordinary prose. Covered by
[**tests**/loopDetection.test.ts](../__tests__/loopDetection.test.ts)
(F10 and adjacent cases).

🔧 **A fourth granularity found, prototyped, but deferred: long
(~12+-word) units cycling across structurally-separated list items** — see
Food / recipes above. Distinct from all three fixes above, which target
unpunctuated runs of a word or a short phrase; this loop's copies ARE
separated (by numbered-list structure), just too long for the phrase
detector's 2–5-word window, and alternate between 2+ distinct clauses
rather than repeating one clause back-to-back. Tracked as a separate task,
not shipped this round.

✅ **A degenerate "just echo the question back" response persisted as if it
were a real answer — new failure class, a non-answer rather than a wrong or
looping one — fixed**
Scenario: asked a two-part follow-up ("Jaka jest jego waga i wymiary?" —
what's its weight and dimensions?) after a correctly-answered price
question, in a web-search thread. The raw model output, captured via
temporary instrumentation, was literally
`<think>\n\n</think>\n\nJaka jest jego waga i wymiary?` — an empty think
block followed by nothing but the question restated verbatim. Persisted
as-is, this reads to the user as a completely broken, do-nothing reply.
Reproduced 4 times in a row across two different products (Dell XPS 15,
Lenovo Legion 5 Pro) and two phrasings ("Jaka jest jego waga i wymiary?",
"Ile wazy i jakie ma wymiary?") — a reliable failure mode for this specific
two-part question shape, not a one-off. This is the same underlying
degenerate shape the Real estate section above already documented once (a
"sandwiched" instruction attempt caused the model to echo an unrelated
question back 5 times in a row) — that occurrence was fixed by reverting
the instruction that triggered it, with no general detection added at the
time. This round's occurrences happen on unmodified code, confirming the
underlying model tendency exists independent of that specific instruction
and needed a systematic answer, not just another one-off revert.
None of the existing grounding caveats apply — there's no currency figure
or comparative claim to check, just an answer that never actually answers.
Fix: `isQuestionEchoAnswer`
([utils/messageSources.ts](../utils/messageSources.ts)) strips the
`<think>` block and compares what's left, normalized, against the user's
own last question; `store/llmStore.ts` now routes a match through the same
"failed generation" path as a genuinely empty response (`markGenerationFailed`
→ visible "Failed to generate a response." with a Retry button) instead of
persisting the echo as if it were a real reply. Verify:
[**tests**/messageSources.test.ts](../__tests__/messageSources.test.ts) —
the exact captured raw text, a plain echo with different trailing
punctuation, case-insensitivity, a genuine answer (not flagged), no
question to compare against (not flagged), and an unclosed `<think>` block
(empty visible answer — correctly not flagged as an echo, since that's a
different failure, plain emptiness, already handled by the existing
empty-response path). Confirmed live: the exact question that previously
persisted as a broken-looking echoed reply now shows "Failed to generate a
response." with a working Retry button instead — tapping Retry re-runs
generation cleanly (and, honestly, sometimes echoes again on this specific
question shape and fails gracefully a second time, since the underlying
model tendency itself isn't fixed — only its user-facing consequence is:
never again silently masquerading as a real answer).

✅ **`isQuestionEchoAnswer` widened: an echo with a leaked per-turn language
reminder tacked on evaded the exact-match check**
Scenario, found live on iOS Simulator while testing an (accidentally
malformed) follow-up: `answerLanguageAnchor`
([utils/promptUtils.ts](../utils/promptUtils.ts)) appends a short reminder
— `(Answer in Polish.)`, translated by the model into whatever language it's
answering in — directly onto the raw text of the outgoing user turn, with
no framing that visually separates it from the user's own words. A model
that falls back to echoing its input (the exact failure `isQuestionEchoAnswer`
exists to catch) can echo this reminder right along with the question,
translated: the captured answer was `A kiedy się urodził? (Odpowiedź w
polskim.)` — the (near-)echoed question plus the leaked, translated
reminder — which the old exact-match comparison missed entirely, since the
trailing text made it not equal to the raw question.
Fix: `isQuestionEchoAnswer` now also strips one trailing parenthetical
clause from the visible answer before comparing — if what's left matches
the question, it's still an echo, just with a leaked reminder riding along.
This doesn't require recognizing the reminder's text in any specific
language, since it only cares about the parenthetical's position, not its
content. Verify: [**tests**/messageSources.test.ts](../__tests__/messageSources.test.ts)
— the captured shape (echo + leaked reminder, flagged) and a genuine answer
that happens to end in an unrelated parenthetical clause (not flagged,
since the part before it doesn't match the question). Caveat: the original
live capture used input mangled by an unrelated typing-tool glitch during
testing (a duplicated word fragment), so the model's echo wasn't a clean
match even after stripping the reminder — re-tested with clean input and
did not reproduce the leak at all, meaning this is confirmed as a real,
narrow failure shape (garbled input → leaked reminder in an echo) rather
than a common one; the fix is unit-verified against the clean version of
that shape, not live-reconfirmed with the exact original garbled text.

🔧 **A third non-answer shape found live: commits to a list, delivers zero
items — fixed in code, not yet re-verified live**
Scenario, captured on Pixel 10 in a real thread: "ile dzieci ma prezydent
usa i jak nazywa się jego żona" got a correct, complete answer ("Prezydent
ma dwie córki, a jego żona nazywa się Melania Trump."). The natural
follow-up in the same thread, "wypisz imiona wszystkich dzieci prezydenta"
(list the names of all the president's children), triggered `needs_search:
false` — the planner judged this answerable from the conversation already
in progress rather than as a fresh lookup — and the reply was, in full:
"Prezydent ma dwie córki. Ich imiona to:" — a correct recap followed by a
list intro and then nothing. Distinct from both the question-echo shape
above (this one is not a repeat of the question) and the circular
non-answer above (this one does not restate itself — it just stops). Root
cause is upstream of generation: with no fresh `<context>` this turn (the
planner's `needs_search: false` means `runWebSearch` returns empty and
`prepareMessagesForLLM` takes the no-context branch — see
[utils/promptUtils.ts](../utils/promptUtils.ts)), the model has nothing
grounding the daughters' names and, rather than saying so, commits to a
list format it can't fill in.
Fix: `isDanglingListAnswer`
([utils/messageSources.ts](../utils/messageSources.ts)) flags a visible
answer (outside `<think>`) that ends on a bare colon — a genuine answer
essentially never does. Routed through the same `store/llmStore.ts` gate as
the other two non-answer shapes (`markGenerationFailed` → "Failed to
generate a response." with Retry). This does not fix the planner's
`needs_search: false` misjudgment itself (a small model deciding a specific
named-entity fact is "already known" is a planner-quality problem, not
something a text-shape detector can correct) — it only stops the resulting
dangling-list reply from being persisted as if it were a complete answer.
Verify:
[**tests**/messageSources.test.ts](../__tests__/messageSources.test.ts) —
the exact captured text, an English equivalent, a filled-in list (not
flagged), an ordinary answer with no trailing colon (not flagged), and a
colon left inside `<think>` only (not flagged). Live re-attempt on Pixel
10 (same thread shape, same model) did not reproduce the exact dangling
colon this round — the planner's `needs_search` call is non-deterministic
and this time chose `true` for the follow-up, so it searched and answered
("Prezydent USA, Donald Trump, ma syna o imieniu Barron Trump.") instead
of hitting the no-context path at all. No regression either way. Still 🔧,
not ✅ — the fix has not yet been seen to actually catch a live dangling
answer.
Update (same day, after the `needs_search`-too-eager fix above): a second
live round asked a same-thread pronoun-only follow-up ("a kiedy się
urodził?", no entity or role marker at all) specifically to try to land on
the no-search precondition again — it searched anyway and returned a
fully filled-in answer (a bulleted list of dates, each item complete, no
dangling colon). Consistent with the same explanation as the sibling entry
above: the `needs_search` fix is shrinking exposure to this detector's
trigger condition, which is a good outcome for users but still leaves this
specific detector unconfirmed against a real dangling answer. Left at 🔧.

## Citations / Sources

✅ **Regression: removing the `namedCitation` prompt line for the
`DominantSourceBadge` left every multi-source answer citing "Source N"
literally — found live, first patched with a prompt instruction, then
replaced with a deterministic post-processing fix per explicit direction**
Scenario: earlier this round, the old `namedCitation` instruction ("name
the page in your own words... instead of a vague 'the sources say'") was
deleted from [utils/promptUtils.ts](../utils/promptUtils.ts) and replaced
with `DominantSourceBadge` — a deterministic UI pill shown when exactly one
web source ends up cited. That works well for the single-source case, but
the badge is computed _after_ generation from the final answer's citation
overlap, so it can't be known while the prompt is being built, and it
never fires at all for 0 or 2+ cited sources. Removing the instruction
outright meant those cases — which turned out to be the common ones —
had **no guidance at all**, and the model fell back to its rawest habit:
repeating the `<context>` block's own header labels ("Source 1", "Source
2"...) straight into the answer. Live-caught on a real 4-source "ile
dzieci ma elon musk" answer: "...he has fathered 14 children (Source 1),
and welcomed 14 children over 20 years (Source 2)... (Source 3)... (Source
4)." with no badge (four sources used, not one) — exactly the shape from
the user's own earlier report ("w ostatniej wiadomosci sa source 4 i
source 2 zmiast badge").
First fix attempted (reverted): restored `namedCitation` in
`getContextInstruction`, asking the model to name the page in its own
words instead of writing "Source N". Live-tested clean at the time — but
this is exactly the shape of fix the project has already decided against
elsewhere in this doc (the `DominantSourceBadge` switch itself was a move
_away_ from trusting prompt-instruction compliance toward a deterministic
mechanism, for the single-source case). Re-adding an LLM-compliance
instruction for the multi-source case was flagged as solving one instance
rather than the class, and reverted per explicit instruction to replace it
with something deterministic instead.
Fix (current): `humanizeSourceReferences`
([utils/messageSources.ts](../utils/messageSources.ts)) is a deterministic
post-processing pass, not a prompt instruction — it runs on every answer
after generation, regardless of language or how the model chose to phrase
the citation, and replaces any literal `Source N` / `źródł* N` match with
that source's real name (`sourceDocuments[N-1].name`, the same 1-based
numbering `sourceBlock`/`webResultsToContext` assign when building the
`<context>` block, so the index the model copies verbatim always resolves
correctly against the original, unfiltered source list). Matching is
Unicode-aware (`(?<![\p{L}\p{N}])` instead of a bare `\b`, since JS's `\b`
does not treat accented letters like "ź" as word characters, so a bare
`\b` misses "źródła 2"), and covers English and Polish today
(`sources?`/`źródł\w*`). Wired into `store/llmStore.ts` right after the
success gate opens: the humanized text — not the raw model output — is
what gets used for citation-picking, grounding-caveat detection,
persistence, and the in-memory chat state, so every downstream consumer
sees the cleaned-up answer, not just what's rendered on screen.
Verify: [**tests**/messageSources.test.ts](../__tests__/messageSources.test.ts)
— the exact captured live 4-source text, a Polish "źródła 2" case, and a
no-op case (no source documents, text left untouched). Confirmed live on
Pixel 10 as part of the same round's language-detection re-test: the humanizer
did not need to intervene on that particular answer (the model's Polish
reply named no sources at all, literal or humanized), so this run is
supporting evidence that no regression was introduced, not a fresh catch of
the original literal-"Source N" text — that exact shape was previously
confirmed working under the reverted `namedCitation` version, which is
what originally established the underlying detection was correct; the
mechanism producing the fix has since changed, this specific text pattern
has not yet been re-caught live under the new deterministic version.

✅ **Two independent root causes found and fixed for "successful search,
zero Sources"**

- **Cause 1**: `webResultsToContext.ts` stored only the short SERP snippet
  in `sourceDocuments[i].passage`, while the model actually saw a much
  longer fetched-content fragment. Fix: `passage` now holds the same text
  that was placed in the model's context.
- **Cause 2 (deeper, more general)**: citation attribution
  (`overlapWithAnswer`/`flagUsedWebDocuments` in
  [utils/messageSources.ts](../utils/messageSources.ts)) is pure lexical
  (shared word stems) matching, with **no cross-language bridge**. When the
  answer is in Polish and the source is in English (common for
  medical/technical topics), overlap is zero for every source, so all of
  them get `used: false` and "Sources" disappears entirely — despite a
  fully successful, real search. Confirmed live via debug log: two
  English-language medical sources, `overlap: 0` for both, against a Polish
  vitamin D answer.
  Fix: when lexical overlap is zero for **all** sources simultaneously,
  treat that as an uninformative signal (not evidence the model ignored the
  sources) and default to trusting sources that actually made it into
  context (`presentNames`) instead of hiding all of them. This checks
  whether the heuristic has any signal at all — not any specific language.
  Verify: new cases in
  [**tests**/messageSources.test.ts](../__tests__/messageSources.test.ts);
  full suite (1343 tests) passes; confirmed live — the same vitamin D
  question now correctly shows both sources under "Sources".
- **Supporting fix — refusal-detection gaps**
  (`NO_ANSWER_PATTERNS_PL`/`_EN` in
  [constants/citations.ts](../constants/citations.ts)) that interact with
  the above: the "no [noun]" pattern didn't tolerate an adjective between
  them ("no **exact** information"), and the Polish verb list had no
  equivalent of English "provide" ("**dostarczają** informacji"). Both
  generalized (a short, bounded character gap instead of one optional word;
  added `dostarcza*`/`oferuje*` for parity with English) — completing an
  existing pattern, not adding another special case.

🔧 **"Source N" cited on a follow-up with no fresh context — fixed in code,
not yet re-verified live**
Scenario, captured on Pixel 10: in an "ile dzieci ma Elon Musk" thread that
had already searched and answered correctly once, a later message in the
same thread was answered by `needs_search: false` (no fresh `<context>`
this turn), yet the reply still contained literal "Source 4" and "Source 2"
— and, consistently with that no-context turn, "Sources" was empty
underneath. Root cause: each `<context>` block is headed `Source 1: <page
title>`, `Source 2: ...` (see `sourceBlock` in
[utils/contextUtils.ts](../utils/contextUtils.ts)) — a model that searched
one turn ago has that exact citation pattern in its own immediately-prior
reply in the conversation history, and a small model on a no-context
follow-up imitates its own recent style rather than noticing there is
nothing to cite this time. This is a different mechanism from the
`namedCitation`→`DominantSourceBadge` switch elsewhere in this round (that
one only ever applied when a fresh context block existed this turn, so it
never covered this no-context-follow-up path either, before or after the
switch) — the empty "Sources" here isn't a bug in isolation, it's the
_correct_ half of an inconsistent pair; the bug is the model still act like
sources exist when this turn has none.
Fix: `getNoFreshContextInstruction`
([utils/promptUtils.ts](../utils/promptUtils.ts)) — when a turn has no
`<context>` block but an earlier assistant message in the same thread did
cite a web source, add an explicit reminder that this turn has no context
block and the model must not invent "Source N" numbers, answering from the
conversation in its own words instead. Scoped to threads that have actually
searched before (not added unconditionally to every prompt), following this
doc's documented lesson that stacking an unconditional instruction onto a
small model risks new regressions of its own (see Real estate, above).
Verify: [**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts) —
the exact captured shape (a president-follow-up thread reused as the
fixture, since it is the same no-context-after-web-turn pattern) gets the
warning, and an ordinary thread that never searched does not. Live
re-attempt on Pixel 10 (fresh "ile dzieci ma Elon Musk" thread) also didn't
land on the triggering condition this round — the planner chose
`needs_search: false` on the very first message this time (no search ran
at all, so no earlier web-cited turn existed to test the follow-up
reminder against), where the original captured bug had a successful first
search. Still 🔧, not ✅ — the fix has not yet been seen to actually
suppress a live "Source N" hallucination.
Update (same day, after the `needs_search`-too-eager fix above and the
citation-humanizer work): a second live round on Pixel 10 never landed
on the no-context precondition either — every follow-up tried this round,
including a bare pronoun-only one with no explicit entity or role marker
("a kiedy się urodził?"), triggered a real search rather than a
memory-only answer. That's a reasonable side effect of the same-day
`needs_search` fix shrinking how often the no-context branch is reached at
all, not evidence this specific instruction works — its trigger condition
just keeps not coming up. Left at 🔧 until it's actually seen to fire.

💡 **Proposed / to monitor**

- Watch whether "trust present sources on zero overlap" starts showing
  sources on genuine refusals in languages other than PL/EN (the refusal
  regex only covers those two) — needs more live testing.
- A refusal phrasing using the participle "zapisan-" (e.g. "nie jest
  zapisana w...") was observed slipping past `looksLikeNoAnswer` during
  weather-category testing; not added to the regex list yet — avoiding
  further case-by-case regex whack-a-mole in favor of a more general
  refusal-detection approach if this keeps recurring.

✅ **Unread ("search listing only") sources removed from the Sources sheet
entirely, per explicit direction**
Previously `useMessageSources`'s `displayedSources` filter kept a web
source whose page was never actually fetched (`read === false`) as long as
it was flagged `used: true` — i.e. the citation-attribution heuristic
matched it against the answer text even though only the SERP snippet, not
the real page, was ever read. Those rows showed "· from the search listing
only" ([SourceRow.tsx](../components/chat-screen/SourceRow.tsx)) to signal
the caveat. Per direct instruction, the Sources sheet should never surface
a source that was never actually read, used or not — so the filter now
drops any web source with `read === false` unconditionally
([hooks/useMessageSources.ts](../hooks/useMessageSources.ts)). The
"from the search listing only" label and its style became dead code as a
result (nothing reaches `SourceRow` with `read === false` anymore) and
were removed. `webResults` (used for the search-trace panel and the
`DominantSourceBadge` computation) is unaffected — unread pages still show
up in the "Searched the web" trace, just not in the Sources sheet.
Verify: [**tests**/useMessageSources.test.ts](../__tests__/useMessageSources.test.ts)
— updated the case that used to assert an unread-but-used source was kept
to assert it's now excluded. Confirmed live on Pixel 10: a recipe question
("jaki jest przepis na sernik nowojorski") that searched multiple pages
opened a Sources sheet showing only the sources with real fetched content,
no unread-listing entries and no italic caveat text.

## Search trace UI (the "Searching the web…" expandable panel)

✅ **Completed trace steps stayed a bare dot instead of getting a checkmark
like "Done" — fixed**
Scenario: while a search trace is running or after it finishes, each step
row ("Deciding what to search for", "Searching '...'", "Reading the
pages") is rendered by `buildRows`
([components/chat-screen/webSearchTrace.ts](../components/chat-screen/webSearchTrace.ts))
as a `StepRow` with an optional `done` flag driving the checkmark vs. plain
dot. Most step rows were only ever pushed with `done` unset — a step got a
checkmark solely via a few call sites that happened to set `done: true`
explicitly (mainly the final "Done"/weak-results row), so a completed
"Searching '...'" step stayed a bare dot forever, inconsistent with the
checkmark "Done" gets right below it in the same list.
Fix: replaced the old `withPhaseState`/`markActive` helpers with a single
`finalizeSteps` pass that runs once over the assembled row list right
before it's returned, from every code path that builds rows. While a
search is still running, every step before the last not-yet-`done` one is
finished by definition (the trace already moved past it) and gets `done:
true`; the last incomplete one gets `active: true` (the pulsing state).
Once nothing is running anymore, every step that made it into the trace at
all is done — a finished trace has no such thing as a still-pending step.
Verify: [**tests**/webSearchTrace.test.ts](../__tests__/webSearchTrace.test.ts)
— a mid-search case (checkmarks on every step before the active one, no
checkmark on the active one) and a fully-completed case (checkmarks on
every step). Confirmed live on Pixel 10: expanded the "Searched the web"
panel after a completed search — "Deciding what to search for",
"Searching 'Elon Musk's children'", "Reading the pages", and "Done" all
show a checkmark, none left as a plain dot.

## Trace-panel regressions that keep coming back

These three have now been reported more than once each, which means they are
being reintroduced rather than merely missed. They are written down here with
the mechanism, not just the symptom, so the next change to the panel can be
checked against them before it ships.

All three were reported from the physical Pixel 10.

🔁 **The running trace collapses to a single row when "Reading the pages"
appears**
Symptom: a search is running with the panel expanded. The moment the trace
reaches the reading phase, every row above it disappears — the search steps
and the pages found so far — and "Reading the pages" is left alone on screen.
Mechanism: while `isSearching`,
[WebSearchBlock](../components/chat-screen/WebSearchBlock.tsx) renders the
trace as two separate pieces. The last row goes into its own always-mounted
slot (`currentRow`), and everything before it (`historyRows =
rows.slice(0, -1)`) is rendered by `WebSearchTraceList` — but only when
`listMounted` is true. `handleCollapsed` sets `listMounted` back to false
whenever the list finishes its collapse animation while a search is still
running. So any state change that flips `expanded` to false for even one
frame mid-search tears the history half down and leaves exactly the current
row, which at that point is "Reading the pages". Nothing in `buildRows` drops
those rows; they are still in the array.
Why it comes back: the panel keeps its expanded flag in two places —
`traceExpanded` in the store when the block is live, `localExpanded` when it
is a saved one — and `expanded` picks between them via `isLiveBlock =
isSearching || trace.length > 0`. Any change to what counts as "live" quietly
changes which flag drives the panel, and the tear-down is a side effect two
hops away from that decision.
Guarded by: [__tests__/webSearchTrace.test.ts](../__tests__/webSearchTrace.test.ts)
— "keeps every earlier row when the reading phase starts" holds the pure
half, so a future failure localises straight to the component.

🔁 **The panel replays its opening animation when generation finishes**
Symptom: the answer finishes streaming and the whole panel animates as if the
user had just expanded it. The user did nothing; only the message finished
and the state changed.
Mechanism: `isSearching` flipping to false swaps the entire subtree. The
running branch renders a history list plus a separate current-row slot; the
finished branch renders a single `WebSearchTraceList` over the full row set,
with `animateRows` going from true to false. React cannot reconcile those
two shapes, so the list unmounts and remounts and every row plays its
`entering` animation again.
Row keys are *not* the cause — measured, not assumed: the regression test
below builds the same trace with `isSearching` true and false and the key
lists come out identical, so `seenKeys` still recognises every row and
`enterDelay` correctly hands out zero. The replay survives that, which is
what pins it on the remount.
Why it comes back: the running and finished states are two hand-written
subtrees rather than one list told whether a search is still going. Any
edit that changes the shape of either branch reintroduces the remount, and
the stagger bookkeeping cannot suppress an animation on a view that has
just been created.
Guarded by: [__tests__/webSearchTrace.test.ts](../__tests__/webSearchTrace.test.ts)
— "keeps row keys stable when the search stops running". That test rules
out the cheap explanation; it cannot catch the remount itself.

🔁 **The conversation goes blank white mid-generation and stays blank**
Symptom: on the physical Pixel 10, the question and the partial answer both
vanish and the conversation is an empty white screen. Generation is
demonstrably still running — the stop button is there and works. When
generation ends the screen stays blank.
Mechanism: not established. Worth noting what it is *not*: a render throw
would surface a red box, not a blank list, and the trace panel cannot blank
the messages above it. That points at the message list's data or its
measured height rather than at any one message.
Next time it appears, capture before touching anything: `adb logcat` around
the moment, the message rows for that chat straight from the device
database, and whether the answer was persisted despite never being drawn.
Without that the cause stays a guess.
Guarded by: nothing. This one has no reproduction under instrumentation
yet, and a test written against a guessed mechanism would be worse than
none.

## User-facing communication

✅ **Internal-jargon leak fixed**
Scenario: on a question with no source coverage, the answer literally
repeated the internal word **"context"** — the `<context>` block's
implementation name, meaningless to a user who never sees it. Observed
live: "The current weather in Kraków isn't recorded in the available
context." — a sentence with zero value to a user who doesn't know what
"context" refers to.
Root cause: several instructions in `getContextInstruction`
([utils/promptUtils.ts](../utils/promptUtils.ts)) taught the model to say
"if the context doesn't contain X, say so" — the model then echoed the word
"context" verbatim into its answer.
Fix: a new, always-active `noLeakedJargon` rule in the same place forbids
the model from saying "context" to the user, directing it to describe the
gap in plain language instead ("I couldn't find...", "no current
information about..."). "Sources" stays allowed — it's already used
elsewhere and matches the visible "Sources" button in the UI, so it's
meaningful to the user.
Verify: new case in
[**tests**/promptUtils.test.ts](../__tests__/promptUtils.test.ts);
confirmed live — the same Kraków weather question now says "source"
instead of "context".

🔧 **The same leak recurred once in Polish, despite the instruction already
covering translations** — see Real estate above (`kontekście`). Not a
regression in the instruction text itself (`noLeakedJargon` already says
"or its translation"); flagged as a model-compliance gap to watch, not
re-patched off a single instance.

## Out of scope for this doc: a UI rendering bug found along the way

✅ **A finished answer could render as a fully blank screen — root cause
was an upstream `react-native-keyboard-controller` race, not a
web-search/RAG bug, but severe enough to flag (and now fix) here since this
round found and pinned it down**
Scenario: tap "New chat", send a web-search question, the answer completes
— the message area (question bubble, "Searched the web" block, answer text,
action row) renders as a fully blank screen. `debugger-component-tree`
confirmed every element is mounted with correct real content at normal
coordinates (`text-bubble`, `WebSearchBlock`, `EnrichedMarkdownText`,
`message-actions`) — this is a paint/visibility bug, not data loss.
Scrolling did not recover it. `restart-app` did recover it (same chat,
same answer, renders fine) — confirming only the live in-memory paint
state was affected.
Root cause, confirmed via `debugger-log-registry`: every "New chat" tap
(`NewChatHeaderButton` → `startPhantomChat(db, 'replace')` →
`router.replace()` to a new `/chat/${id}` route) logs, in this exact order,
`Can not attach worklet handlers for react-native-keyboard-controller
because view tag can not be resolved. Be sure that KeyboardProvider is
fully mounted before registering handlers.` The new chat screen's
`KeyboardChatScrollView` (in [components/chat-screen/Messages.tsx](../components/chat-screen/Messages.tsx))
mounts and tries to register its Reanimated worklet handlers before the
app-root `KeyboardProvider` ([app/_layout.tsx](../app/_layout.tsx)) has
caught up with the fast `router.replace()` screen swap. When that
attach fails, the UI-thread worklet driver never binds to the new screen's
scroll view at all — so `Messages.tsx`'s reveal mechanism (`opacity`/
`revealTranslateY` shared values, plus its `REVEAL_FALLBACK_MS` safety-net
timer) keeps setting the right values on the JS side, but none of it ever
paints, because the native view was never wired up to receive Reanimated
updates in the first place. That's also why the fallback timer doesn't
save it: the fallback still goes through the same broken binding.
Same navigation also logs a second, separate symptom of the identical
fast-navigation race: `useChatSettings`/`useChatBranching`
([hooks/useChatSettings.tsx](../hooks/useChatSettings.tsx),
[hooks/useChatBranching.ts](../hooks/useChatBranching.ts)) throw "Access to
closed resource" fetching chat settings / branch markers for the outgoing
screen — caught and logged safely, not itself the cause of the blank
screen, but corroborating that this is a general fast-navigation teardown
race, not something specific to Reanimated.
This is a confirmed, currently-unresolved upstream bug —
[kirillzyusko/react-native-keyboard-controller#1411](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1411),
reported against the same "event propagation rewrite" era as our installed
1.21.1 (latest is 1.22.4; the issue reporter says a later version did not
fix it, and their `patch-package` attempt didn't help either). No known
working fix exists upstream, so rather than patch the library (or
restructure the whole "new chat" navigation — both higher-risk, and this
exact area has already broken twice before from subtle timing changes,
#295 and #272), the fix targets the race's actual trigger: `'replace'`
mode unmounts the outgoing chat screen and mounts the new one in the same
tick, which is what lets the new screen's `KeyboardChatScrollView` start
registering handlers before `KeyboardProvider` has caught up.
Fix: [utils/startPhantomChat.ts](../utils/startPhantomChat.ts) now awaits a
50ms `setTimeout` before the `router.replace()` call (only for `'replace'`
mode — `'push'` keeps the outgoing screen mounted underneath, so it was
never subject to this race), giving the outgoing screen's teardown a
macrotask to settle first. This is the single call site behind every
"new chat" entry point (header button, drawer nav, drawer empty state), so
one change covers all of them.
Verify: [**tests**/startPhantomChat.test.ts](../__tests__/startPhantomChat.test.ts)
— asserts `router.replace` is not called before the delay elapses, and
that `'push'` is unaffected. Confirmed live: reproduced the original
failure signature 5 times in a row post-fix (tap "New chat" → immediately
send a web-search question) — `debugger-log-registry` showed zero
`Can not attach worklet handlers` warnings and zero "Access to closed
resource" errors across all 5 navigations, and all 3 attempts that
actually reached "send" (2 were lost to unrelated test-harness timing, not
app bugs) rendered their finished answers correctly. Previously this
reproduced on effectively the first or second attempt.

⚠️ **Status note (this round): recurred live, root cause not yet
re-established — likely a different trigger than the fixed `router.replace`
race**
Scenario: the blank-screen symptom (message area fully invisible,
`restart-app` recovers it) reappeared live on the Pixel 10 during this
round's testing. Not yet root-caused to the same standard as the fix above
— the 50ms `startPhantomChat` delay fix targets one specific race
(`KeyboardProvider` not caught up before `KeyboardChatScrollView` attaches
its worklet handlers on a `'replace'`-mode "new chat" navigation) and
nothing in this round's `git diff` touches `startPhantomChat.ts` or that
navigation path, so a straight regression of that exact fix is unlikely.
Log signature captured this time was similar but not identical: `Can not
attach worklet handlers for react-native-keyboard-controller...`,
`Failed to fetch chat settings: ...Access to closed resource`, `Failed to
load branch markers: ...Access to closed resource`, `Database not
initialized`, and an uncaught `Access to closed resource` promise
rejection. Working theory, not confirmed: this round involved many rapid
Fast-Refresh reloads from live file edits landing while the app was mid-
navigation, on a Metro instance a second device ("iPhone 17 Pro") was also
connected to — plausible that a Fast-Refresh-triggered remount hits the
same class of "provider not caught up yet" race the original bug was, but
via a different trigger than a plain `'replace'` navigation, or that it's
a distinct SQLite-connection-closure issue coincidentally sharing several
log lines with the original bug. Recovered via `restart-app` (data intact,
no loss), but the underlying trigger for this round's recurrence remains
open — needs a dedicated repro attempt outside an active Fast-Refresh
session (a built/installed app, not a live Metro dev session) before it
can be root-caused or ruled distinct from the fixed race above.

✅ **A sent message could get permanently lost off-screen when sent from
scrolled-up in a long thread — root cause found and fixed, a plain JS
logic bug, not a library race this time**
Scenario: scroll up several screens into a long thread, send a new
message — instead of the composer's v0-style "pin the new message near
the top of the viewport while it streams" behavior, the view stayed
exactly where it was scrolled, with the new message and its answer never
appearing, not even after generation finished. Reproduced consistently in
`components/chat-screen/Messages.tsx`'s message-pin mechanism (flagged but
not root-caused in an earlier round of this doc).
Root cause, confirmed by temporarily instrumenting the pin code path and
reading `debugger-log-registry` output live: `applyPendingPin` computes
`pinOffset` right after the new message first renders, then either scrolls
immediately if enough content already exists, or defers via
`pinScrollPendingRef.current = true` for `handleContentSizeChange` to
catch once the streaming answer grows content past
`pinOffset + containerHeight`. Two things combined to break this:

1. That growth check (`h >= pinOffset.current + containerHeight.current`)
   is an exact floating-point comparison between two independently-derived
   layout measurements — observed live failing by a razor-thin margin
   (`h=4337` vs a needed `4337.000084`) even though, visually, more than
   enough content existed.
2. Worse, independent of (1): once generation finishes, the pin-release
   effect unconditionally cleared `pinScrollPendingRef.current` to end the
   pin — discarding the deferred scroll instead of ever completing it. If
   the final answer was short (or rendered taller mid-stream then settled
   shorter), the growth check might never once come true during
   streaming, and this silent clear was the only thing that ever ran —
   the view was abandoned wherever it happened to be, permanently, since
   nothing else was left to trigger the scroll.
   Fix: the pin-release effect now performs the deferred `scrollToPin()`
   itself if it's still pending when generation ends, instead of discarding
   it — generation finishing is treated as a hard deadline to honor the
   scroll against the final, settled content, not a reason to give up.
   Also added a 1px tolerance (`PIN_READY_SLACK_PX`,
   [constants/chat-screen.ts](../constants/chat-screen.ts)) to both threshold
   checks so the fast path succeeds more often without needing the fallback.
   Verify: `npx tsc`/`eslint` clean, full suite unaffected (this exact
   component has no dedicated unit tests — it depends on native
   ScrollView/Reanimated layout events that aren't practical to mock here;
   this was tested live, consistent with how this area has always been
   verified in this repo). Confirmed live twice: scrolled several screens up
   in a long thread, sent a message — the composer jumps to top immediately
   on send (this part already worked), and where the answer previously
   vanished with the view frozen in place, it now reliably becomes visible
   once generation completes. One honest caveat: the final settled position
   sometimes sits just short of the literal last pixel (the scroll-to-bottom
   chevron can still show), which looks like a separate, pre-existing, minor
   quirk in how the pin position relates to "distance from absolute bottom"
   for a short final answer — not the same failure as the one fixed here (the
   message and its full answer are visible either way, nothing is lost or
   hidden anymore).

✅ **Follow-up: the pin-scroll above animated instead of jumping instantly**
User feedback after the fix above: the pinned message should land at the
top instantly, not animate/scroll into place. `scrollToPin()` (same
function, [components/chat-screen/Messages.tsx](../components/chat-screen/Messages.tsx))
was calling `scrollRef.current?.scrollTo({ y: pinOffset.current, animated:
true })`. Changed to `animated: false`. Confirmed live twice: sending from
a scrolled-up position now shows the new message already at the top on the
very next frame, no visible scroll motion.

---

*Based on live-device QA on iOS Simulator (iPhone 17 Pro), branch
`feat/web-search-intent-mvp` merged with `origin/feat/web-search`. Code
changes from this QA round are uncommitted. The Shopping category's
"wrong price picked from a page dominated by other products' prices" —
this round's highest-priority item — is now fixed at both its layers (an
accurate upstream context budget, and relevance-aware truncation as a
downstream safety net) and confirmed live. This round broadened Shopping
coverage to electronics (RAM, GPU), Amazon, and fashion, confirmed the
figure-verification caveat catches fabricated e-commerce prices live (not
just the case it was built for), fixed the raw-price-list-dump quality gap
found along the way, and — on a later round of the same RTX 4070 question —
found and fixed a second, distinct shape of the same underlying problem: a
single price figure that is a real number on the page but not actually a
price for the product at all (a filter-widget default, an installment, a
decoy), flagged now by median-relative outlier detection rather than a
raw-list nudge. The biggest finding of the round: the default model's query
planner (`webPlanner: 'llm'`) directly contradicted its own recorded
benchmark evidence in the same file, which said the fallback (`'verbatim'`)
already outperformed it — fixed, and this is the most likely lever behind
"search doesn't trigger often enough," since a bad plan can silently skip or
mutate a search before it ever runs, with no error and no toast. That fix is
a trade, not a strict improvement, though: `'verbatim'` gives up query
reformulation for complex/indirect questions in exchange for reliability on
the direct-lookup questions this round mostly tested — the durable fix is
making the planner call itself reliable enough to trust with `'llm'` again,
which is future benchmarking work, not done here. The one other open item —
a refusal that answered in English once — did not reproduce on a second
identical run and was left alone. Remaining open items are all low-severity
and unconfirmed: the LeBron season-total phrasing issue and the suspected
cross-sport contamination case.

A later round implemented structured-product-data extraction (JSON-LD
`Product`/`Offer`, Open Graph product tags — see Shopping above) so a price
question can be grounded in a page's own machine-readable data instead of
scraped prose, and then broadened coverage into six categories not tested
before: currency exchange, movie/TV review scores, and live sports results
all came back clean, confirming the existing figure-grounding machinery
generalizes past currency prices. Real estate rental pricing correctly
refused to fabricate but leaked the Polish translation of "context." Health-
symptom comparison retrieved correctly but synthesized the two-sided
comparison poorly — the same shape of gap as the LeBron phrasing issue. The
most severe new finding was in an entirely untested category, recipes/
how-to: a repetition loop on long (~12+-word) sentence units cycling across
separate numbered-list items, invisible to all three existing loop
detectors. This round also surfaced and confirmed a general chat-rendering
bug unrelated to web search (a finished answer can paint as fully blank
after the Sources sheet is opened and dismissed, recoverable only by a full
app restart) — out of this doc's scope, but noted so it isn't lost.

A final round fixed two of those four findings — the comparison-synthesis
gap (`getComparisonStructureInstruction`) and the live-match completeness
gap (`getRecentEventCompletenessInstruction`, partial — it can only surface
what the sources actually name) — both confirmed live on the exact
scenarios that found them. The recipe repetition loop was prototyped (a
fourth loop-detection granularity, `findRepeatedClauseCycle`) and also
confirmed live, but deferred to a separate task rather than shipped here.
The fourth, the Polish jargon leak, produced the round's most important
negative result instead: repeating the existing `noLeakedJargon` rule a second time, right
next to the question (the same pattern that already works for the language
reminder), was tried and reverted after it caused something far worse on a
near-empty-context question — a fully degenerate answer that just echoed
the question back, reproduced 5 times straight, only going away once the
extra reminder was removed. The lesson generalizes past this one line:
on a small model, an unconditional instruction added to every prompt is not
free even when each individual addition looks harmless, and the cost shows
up hardest exactly when the retrieved context is already thin — which is
when the model most needs its remaining capacity for reasoning, not for
holding more rules in mind. The chat-rendering bug was investigated further
(traced to `Messages.tsx`'s message-pin/`blankSpace` release, a chain of
three nested timers that must all fire to fully clear — see that file
around `MESSAGE_PIN_SETTLE_MS`/`PIN_RELEASE_MS`/`PIN_RELEASE_FALLBACK_MS`)
but not fixed with confidence, since this exact area has broken from subtle
timing races twice before per this repo's history; flagged with that
pointer for whoever picks it up next, rather than guessed at blind.*

_A later round fixed the blank-screen bug above with confidence (the 50ms
`startPhantomChat` delay) and, separately, root-caused and fixed the
message-pin bug as a plain JS logic error rather than a library race — a
floating-point epsilon on the "has enough content streamed yet" check,
combined with the pin-release effect silently discarding a still-pending
scroll instead of completing it. A follow-up request then made the pin
jump instant rather than animated. This round also went looking for new
findings across three previously-tested categories, on sites not tried
before (x-kom.pl, Media Expert, ESPN, Skyscanner) and with longer,
topic-then-follow-up conversations rather than single questions — a shape
that turned out to surface things single-shot questions hadn't. Two
fixes shipped, both scoped tighter than they might first look: a
one-line-but-backwards conditional in `findUngroundedFigures` (a context
with zero currency figures at all was treated as "nothing to check
against" instead of the strongest ungrounded case there is — fabricated a
"0 zł" price when every x-kom.pl source fetch failed), and a new
`isQuestionEchoAnswer` detector that routes a model literally echoing the
user's own question back — reproduced 4 times straight on a specific
two-part phrasing ("waga i wymiary") — through the same failed-generation/
Retry path as a genuinely empty response, rather than letting it persist
as if it were a real reply. That echo shape had been seen once before in
this file (Real estate, above) but only ever fixed by reverting the
instruction that triggered it — this is the first systematic detector for
the shape itself, independent of what triggers it. Two further findings
were flagged but deliberately not fixed this round, since both are a
different kind of problem than anything the existing grounding machinery
targets (which is entirely currency-figure-shaped) and each deserves
dedicated design rather than a same-pass guess: a follow-up question about
a specific recent game returned an all-time-records page instead of that
game's boxscore, and the model named the record-holder (decades removed
from the actual game) as if he'd played in it; and a "which airline"
follow-up produced a five-sentence answer that only ever restated "a
source exists and compares prices," in different phrasing each time, never
naming an actual airline — circular in a way none of the three loop
detectors catch, since no exact clause, word, or phrase repeats verbatim._

_A later round fixed both findings flagged above. The anachronistic-player
bug was fixed at the retrieval layer: `EVENT_SCOPE_MARKERS` (Sports,
above) extends the existing all-time-page exclusion to anaphoric
event-scoped follow-ups ("in that game") alongside the period-scoped ones
("this year") it already handled, so the all-time records page that named
Wilt Chamberlain is now excluded the same way an all-time page already was
for a "this year" question — confirmed live, the same follow-up now names
a real current-era player instead. The circular-non-answer bug got a new
detector, `isCircularNonAnswer` (Travel/legal, above), mirroring
`isQuestionEchoAnswer`'s "treat as a failed generation, not a real reply"
approach rather than a caveat — the specific captured text never recurred
(model non-determinism, same as everywhere else in this file), but a
live-recreated run produced a different-shaped hedge that the new detector
still caught, confirmed via the exact error string in
`debugger-log-registry`. Both fixes stayed narrowly scoped to their exact
captured failures rather than attempting the general named-entity-grounding
or anti-circularity systems the earlier round's flags gestured at — the
lesson from this file's own history (the reverted "sandwiched instruction"
attempt above) is that broad, ambitious fixes on a small model tend to cost
more than they're worth; the narrow, testable pattern this file has used
throughout keeps winning._

_A later round, prompted by two fresh live-caught bugs on the same "ile
dzieci ma elon musk" thread shape, fixed: (1) a dangling list-intro answer
("Prezydent USA ma następujące dzieci:" with nothing after the colon) on a
`needs_search: false` follow-up — `isDanglingListAnswer`
(Text quality, above); (2) a `needs_search: false` follow-up in an
already-searched thread hallucinating "Source N" citations with no Sources
shown — `getNoFreshContextInstruction` (Citations/Sources, above). Neither
has yet been seen to actually catch a live recurrence of its exact trigger
condition (both remain 🔧). Along the way, the `needs_search`-too-eager
problem got a second design pass: the first backstop
(`asksAboutFactualEntity`, a hardcoded entity/role-word list) was flagged
as solving one entity shape rather than the general problem, and replaced
with `isConversationalIntent` — validating the planner's own `needs_search:
false` against the closed set of conversational categories its own prompt
already defines, rather than pattern-matching the question text (Search
frequency, above). Separately, the `namedCitation` prompt-instruction
citation fix (confirmed working two paragraphs above) was itself flagged as
the wrong *kind* of fix — reintroducing LLM-compliance dependence right
after the project had moved away from it for the single-source case — and
replaced with `humanizeSourceReferences`, a deterministic post-generation
pass that resolves any literal "Source N"/"źródło N" the model writes
against the real source name, in any language, regardless of prompt
compliance (Citations/Sources, above). A `questionLanguage.ts` tie-break bug
was also found and fixed as a general class rather than a one-word patch: a
short, coincidentally cross-language-exclusive marker word ("ma" scoring as
both Polish and French) could make the language detector abstain or,
combined with the old tie-break, contribute to a wrong-language answer;
fixed by only trusting a tie-break in favor of *decisive* (3+ character or
diacritic-bearing) evidence, verified against a 276-pair synthetic audit of
every short cross-language collision found in the current marker lists
(Language detection, above). A UI consistency bug — completed search-trace
steps staying a bare dot instead of getting a checkmark like "Done" — was
fixed with a single `finalizeSteps` pass replacing the old ad hoc
`done`-flag wiring (Search trace UI, above). An unrelated first-paste-into-
a-fresh-chat-input bug (pasted text flashes in then clears, first attempt
only) was fixed by a background agent on a separate branch/worktree,
`fix/chat-input-first-paste-clears` — not yet merged, pending manual
on-device verification. And the blank-screen bug (fixed with confidence
two rounds ago) recurred live under circumstances that don't obviously
implicate the same fix (see the status note above) — recovered via
`restart-app`, root cause of the recurrence left open for a future round
with a non-Fast-Refresh repro environment._

## Corpus round: the guards measured, and the follow-ups that never reached a search

✅ **The digest prompt injection is now confirmed live — three times, and it
fires far earlier than expected**
The previous round left this as the one unverified piece ("reaching the gate
needs a conversation long enough for the budget to drop turns"). A temporary
probe in `prepareMessagesForLLM` settled it on **turn 2** of a web-search
conversation:

```
turn 1  budget 4667  system 3697  last  881  digest  0  history 0  kept 0  dropped false
turn 2  budget 4733  system 3239  last 1401  digest 55  history 2  kept 0  dropped TRUE  injected TRUE
turn 4  budget 4694  system 3697  last  888  digest 62  history 8  kept 1  dropped TRUE  injected TRUE
```

The system prompt alone is ~3.7k of a ~4.7k character budget, and a `<context>`
block pushes the last message past 1.4k — so in web-search mode **the whole
history is dropped from turn 2 onwards**. The digest is not a nice-to-have for
long conversations; it is the _only_ cross-turn memory the model gets on this
model profile. The probe was removed after verification.

✅ **A corpus of real device answers, checked in, so guard changes are measured
instead of argued**
`__tests__/fixtures/deviceConversations.json` — 175 conversations / 518 turns /
254 assistant answers pulled from the simulator's own database, covering every
category this doc tests. `__tests__/deviceAnswerCorpus.test.ts` asserts what
each guard does to them:

| guard                      | fires on | verdict                     |
| -------------------------- | -------- | --------------------------- |
| `truncateAtRepeatedClause` | 12 / 254 | every one is a genuine loop |
| `isQuestionEchoAnswer`     | 9 / 254  |                             |
| `isCircularNonAnswer`      | 4 / 254  |                             |
| `isDanglingListAnswer`     | 0 / 254  | never fires on real traffic |

The four largest cuts were read end to end before the numbers were frozen —
`4822→107` ("Lecie w przestrzeni, pośród gwiazd i planet." ×105), `3852→151`
("dostosowanego" ×261), `5609→116` (a Turkish phrase block ×76) and
`2608→453` (the same list item renumbered 2–5). This answers the open worry
from the plan: the detector is not eating real answers, and a change that
starts eating them now fails a test instead of needing another 60-answer
manual comparison.

❌ **Live-found: a follow-up whose subject is dropped never reached a usable
search at all**
`"A jaki ma aparat?"` after a Samsung Galaxy S25 turn produced
`Failed to generate a response.` The chain, read off the trace and the log:
the search went out as the bare `"A jaki ma aparat?"` (no entity), retrieval
came back with nothing about a camera, the history was dropped by the budget,
so the model had a digest line and useless context — and echoed the question
back. The echo nudge fired, echoed again, and the turn failed.
`carryReferentIntoQuery` only recognised a query as incomplete when it carried
a pronoun, a bare role ("prezydent"), or reflexive `się`. Measured against the
corpus, that caught **7 of 64** real follow-ups.
Fix — two rules, both chosen by measuring candidates against the corpus rather
than by reasoning about grammar:

- **anaphora**: `tego|tej|tym|tych|tamt*|je|ich|that|those|these`, but _not_
  when the next word is a time noun — `"w tym tygodniu"`, `"w tym miesiącu"`
  are dates, not pointers. Catches `"Porównaj je i daj mi wyniki"`,
  `"Who was the top scorer in that game?"`, `"A jaką kawę do tego zmielić"`.
- **elided subject**: an interrogative _immediately_ followed by a possession
  verb — `jaki ma`, `ile ma`, `jakie ma`, `czy jest` — capped at 8 words.
  The adjacency is what makes it safe: `"Ile kalorii ma banan?"` has a noun
  between the two and is left alone, while `"A jaki ma aparat?"` and
  `"Ile ma pamięci RAM i jakiego ma procesora?"` are not.
  Result on the corpus: **7 → 22 of 64**, with the self-contained questions
  (`"Ile kosztuje aktualnie cyna?"`, `"A ile to jest 10 razy 10?"`,
  `"Jaka jest dzisiejsza pogoda w Warszawie?"`) still untouched. Both boundaries
  are pinned by tests.
  Live: the same question now searches `"A jaki ma aparat? …"` and answers
  `"Aparat Samsunga Galaxy S25 to 48MP"` with a source;
  `"Ile ma pamięci RAM i jakiego ma procesora?"` answers
  `"Samsung Galaxy S25 ma pamięć RAM 16 GB…"` off fonio.pl and telepolis.pl.

✅ **Live-found in the same run: the carried entity was `"Cena Samsunga
Galaxy"`**
`mostRecentEntity` walks history backwards and takes the last proper-noun run,
which on the assistant's own sentence `"Cena Samsunga Galaxy S25 w Polsce
wynosi…"` swallows the capitalised sentence opener. Dropping a leading token is
not safe (it would turn `"Samsung Galaxy S25 to flagowiec."` into
`"Galaxy S25"`), so instead the entity is now taken from the **user's** turns
when they name one, falling back to the assistant's. The user names the subject;
the assistant's prose is where sentence-initial noise comes from. Every existing
case still resolves — including the ones where only the assistant ever named the
entity (`"Prezydentem USA jest obecnie Donald Trump."`).

✅ **The echo fallback no longer throws the subject away**
The probe caught the digest degrading from `"cena samsung Galaxy S25 w Polsce"`
to `"A jaki ma aparat?"`: the echo guard fired and fell back to the question,
which for a follow-up names nothing at all. Now the fallback is only taken when
it does not lose ground — if the question names no entity and the previous
digest does, the previous digest stands.

✅ **A wrong-language answer gets a nudge instead of a hard failure**
Live: `"Ile wazy i jakie ma wymiary?"` came back as
`The model answered in the wrong language` — a red error, with all the search
work thrown away. Wrong-language was the one non-answer shape with no recovery,
and it also _suppressed_ the other three nudges (each is guarded by
`!isWrongLanguageAnswer`). It now takes the first nudge slot, re-asking for the
same answer in the question's language; the one-nudge-per-turn budget is
unchanged.

⚠️ **Still failing: the model echoes when the context genuinely lacks the fact**
`"Ile wazy i jakie ma wymiary?"` now searches with the right entity, but the
pages retrieved do not state a weight, and the 1.7B echoes the question rather
than following the "say the sources contain no information about it"
instruction. The echo nudge fires, echoes again, and the turn ends on
`Failed to generate a response.` — losing the search that did work. Worth
deciding separately whether a second failed nudge should fall back to an honest
"not found in the sources" reply instead of a red error; that is a product-voice
call, not a bug fix.

## Stabilisation round: why "Failed to generate a response." kept appearing

✅ **The guards were accurate; the failure _policy_ was the bug**
Measured on the 254-answer device corpus, both remaining failure guards are
clean: `isQuestionEchoAnswer` fires 9 times and every one is a verbatim echo;
`isWrongLanguageAnswer` fires 5 times and every one is real (a Polish question
answered in English or Turkish). Zero false positives.
The corpus, though, only contains answers that **succeeded and were stored** —
failed turns are never persisted, so it systematically under-counts. Live, on
Qwen 3 1.7B, roughly a third of web-search turns tripped one of these shapes.
The damage was the policy: a tripped guard **erased the whole turn** — answer,
sources, and the search trace — and left a red banner with a Retry button. The
search had worked; the user lost all of it.
New rule: **a turn fails only when there is nothing to show.** Every guard still
fires its one nudge; if the retry does not help, the answer is kept along with
its sources. `describeGenerationFailure` collapses to the single honest case,
an empty response.

✅ **A well-cited answer was being classified as a circular non-answer**
The context labels every passage `--- Source 1: … ---` and the system prompt
asks the model to name its sources; `humanizeSourceReferences` exists to turn
`Source 1` into the page title afterwards. Widening
`isCircularNonAnswer` to `\bsources?\b` on this branch therefore made an answer
that cites Source 1, Source 2 and Source 3 — the exact style the pipeline sets
up — score three "source" mentions and fail. On the corpus, **3 of its 4 fires
were false positives**, including
`Aktualne ceny miedzi i cyny … **684,80 zł** (źródło 1)`. Numbered citations are
now stripped before counting (4 fires → 2), and neither remaining fire can end a
turn.

✅ **`Node.js` was being read as a website (live-found by the user)**
`extractSiteRestriction` accepted any `\.[a-z]{2,}` suffix as a TLD, so
"What is the latest version of Node.js?" searched `… site:node.js`, matched
nothing, and the turn fell back to "couldn't find anything online" plus a
from-memory answer (`20.12.0`). The TLD is now checked against a list of real
ones, so `Node.js`, `Next.js`, `Vue.js` and `main.py` are left alone while
`allegro.pl`, `nike.com` and a pasted URL still restrict the search.
Live: the same question now reads pages and answers `Node.js 24.11.0 LTS` with
sources.

✅ **The recovery round is one query, chosen by what actually failed**
It used to build a list of strategies and truncate it. Now it picks a single
one from the failure shape: whole-site failures (blocked, 5xx) → search the
subject away from those hosts (`-site:`); page-level failures on a host that
still answers → `site:<host> <subject>`; nothing else usable → restate the
planner's intent. The recovery round is also capped to one enrichment wave and
three results, so it can no longer widen its own budget the way round 1 can.
Cost measured over four English queries before the change: 1 provider call, 5
SERP results, **2 pages fetched**, 4.8–13.5 s per query — and the recovery round
did not fire once, including on a query with three failed fetches. The "very
many pages" impression comes from the trace panel listing every SERP hit and
fetch attempt, not from the number of pages actually read.

✅ **Results in a foreign script are dropped before they are fetched**
No search engine in `SCRAPE_ENGINES` receives a language or region parameter —
`html.duckduckgo.com/html/?q=`, Brave and Mojeek all get a bare `q`, so the
engine guesses from the IP. Rather than guess at per-engine locale parameters
that cannot be verified offline, a result whose title and snippet are written in
a different **script** than the question is now discarded before enrichment. An
English page still answers a Polish question (same script); an Arabic-titled one
does not. A mixed title whose Latin brand name dominates is kept.
⚠️ The original report could not be reproduced — the probe was added after the
fact and no non-Latin title appears in this session's logs. The mechanism is
structural, the filter is tested, but the specific sighting is unconfirmed.

✅ **The answer no longer opens by restating the question**
`stripEchoedQuestionPrefix` removes a verbatim question prefix (including from
behind a `<think>` block) when something substantive follows. A pure echo is
left intact so the echo guard still sees it.

✅ **The sent message stays at the top of the screen**
`Messages` already pinned the question to the top during generation, then
deliberately released the pin when generation ended: `blankSpace` collapsed and
`settlePinRelease` scrolled back, dropping the finished exchange to the bottom,
under the chat bar. The pin is now held until the user scrolls, which is what
releases it.

✅ **The empty-state gradient could stay on screen behind a conversation**
Reproducible on a slow first turn in a freshly created chat: `isEmpty` flips to
false and the 900 ms fade runs, but the animated value could be left showing.
The gradient node is now unmounted once the fade has had time to finish, so a
stuck value cannot keep it painted.

⚠️ **Superseded — see "The `1 zł` case, diagnosed properly" below. The
direction was right but the mechanism named here was wrong.**
**Trimming drops the source block that holds the real price**
`"The Samsung Galaxy S25 costs 1 zł in Poland."` survives every figure guard
because the guards are working on the wrong input. A probe on the figures
whitelist showed two lists built in a single turn:

```
full context     tokens=["3199 PLN"]
trimmed context  tokens=["1 zł"]
```

Context trimming kept a passage carrying a financing teaser and dropped the one
with the actual price, and the whitelist then faithfully offered the only figure
left. Zero-valued figures are now never offered and outliers are removed from
the list rather than listed with a warning, but neither helps when the good
block is already gone. The fix belongs in `smartTrimContextBlocks` /
`selectRelevantContent` and has not been made.

## The "1 zł" case, diagnosed properly

The previous section blamed trimming for dropping a block containing
`3199 PLN`. That was inferred from two figure-whitelist probe lines that came
from **different turns**, not from a full/trimmed pair of the same one. A probe
over the whole trimming path gave the actual chain:

```
budget 4655   system prompt 3698   left for context + question: 957
context 2947 chars → trimmed to 566

block 1  Media Expert (category listing)
   [1400 zł] … CENA zł _ zł DOSTĘPNOŚĆ … PROMOCJE Bonus do 1400 zł w Programie Odkup
   [1 zł]    … Drugi -30% lub piąty za 1 zł!  … RATY Do 40 rat 0%
block 2  Allegro (category listing)      — no money at all
block 3  euro.com.pl
   [3199 PLN] … [Verified product data] name="Samsung Galaxy S25 12/128GB…", price=3199 PLN, availability=in stock

FINAL money  []
```

1. **`1 zł` is a promotion slogan, not a price** — `Drugi -30% lub piąty za 1 zł!`
   on a Media Expert _category_ page. `1400 zł` next to it is a trade-in bonus,
   and `CENA zł _ zł` is an empty price filter. Two of the four blocks carry no
   money token at all: these are listing pages, not product pages.
2. **The real price was fetched and parsed correctly.** Block 3 carries
   `[Verified product data] … price=3199 PLN` — the structured-data path works.
3. **The system prompt takes 3698 of 4655 characters — 79% of the budget** —
   leaving 957 for the context block and the question together.
4. **`smartTrimContextBlocks` allocates by position**, weight `1/(index+1)`. The
   junk listing is Source 1 and takes the largest share; the block holding
   `price=3199 PLN` is Source 3 and takes the smallest, which at 566 characters
   is not even enough for that one line. In this run **no money token survived
   into the prompt at all**.

Two fixes, both aimed at the chain above:

- `promoteVerifiedProducts` moves any result whose price came from structured
  data to the front, so it becomes Source 1 and gets the largest share of the
  budget — the same shape as the existing `promoteTitleConsensus` and
  `promotePrimarySources` steps.
- `smartTrimContextBlocks` now keeps a `[Verified product data]` line whole and
  trims only the prose after it, so a tight budget can no longer cut the ground
  truth out of a block it did keep.

Live: the same question now answers **"The Samsung Galaxy S25 costs 4 199 zł in
Poland."** with sources.

⚠️ **The 79% figure is the real structural finding.** On a 2048-token profile the
accumulated instruction stack leaves a fifth of the prompt for evidence. Every
grounding guard in this document is working on whatever survives that split.
That is a bigger change than a promotion step and has not been made.

## Prompt budget round: making room for evidence

Starting point, measured on device for a price question:
`2048 window − 768 reserve = 1280 prompt tokens ≈ 4655 chars`, of which the
system prompt took **3698 (79%)**, leaving 957 for the retrieved block and the
question together.

✅ **Generation reserve 768 → 512, chosen from the real answer distribution**
Token length of 254 stored device answers: p50 **34**, p75 74, p90 122, p95 156,
p99 698, max 1527.

| reserve   | answers it would cut | tokens freed |
| --------- | -------------------- | ------------ |
| 768 (was) | 3 / 254 (1.2%)       | 0            |
| 640       | 4 / 254 (1.6%)       | 128          |
| **512**   | **4 / 254 (1.6%)**   | **256**      |
| 448       | 6 / 254 (2.4%)       | 320          |
| 384       | 7 / 254 (2.8%)       | 384          |

512 is where the curve bends — the same coverage as 640 for twice the saving,
and the three answers already over 768 are the degenerate loops
`truncateAtRepeatedClause` cuts anyway. The budget tests no longer hard-code
1280/3840; they read `getPromptTokenBudget` so the next change to the profile
cannot leave them asserting a stale number.
`getPromptCharBudget` also gained a one-token safety margin: the density is
measured over the whole sample, but a _prefix_ can be denser, and at the new
budget that produced a 1537-token slice for a 1536-token budget.

✅ **`<context>` renamed to `<sources>`, and the rule about it deleted**
233 characters of the system prompt existed only to stop the model saying the
word "context" to the user — a word that was in the prompt only because the
wrapper tag was called that. The tag is now `<sources>`, the header is
`IMPORTANT SOURCE INFORMATION:`, every instruction says "the sources", and the
leak rule is gone: there is nothing left to leak. A test asserts the assembled
prompt contains no "context" at all. The sanitiser that strips wrapper tags out
of untrusted page text now strips **both** names, so a page cannot smuggle in
either.

✅ **Three always-on instructions are now conditional**

- `getScopeIntegrityInstruction` (329 chars) was the only instruction added
  unconditionally on every web turn. It is about totals and counts scoped
  narrower than the question, so it now fires on the same kind of marker its
  neighbours already use — a total/count word or a superlative.
- The `[Answers: <query>]` sentence (~180 chars) is only meaningful when the
  block actually carries two or more of those tags, which is known while the
  prompt is being built.
- The weekday table (~200 chars in Polish) and the "resolve today/tomorrow"
  line are only added when the question is actually about time
  (`mentionsTime`), instead of on every turn that has a web source.

**Result** (same scenario, measured locally):

|                                                            | before | after           |
| ---------------------------------------------------------- | ------ | --------------- |
| system prompt, price question                              | 2857   | **2312** (−19%) |
| system prompt, worst case (comparison + variant + opinion) | 3949   | **3073** (−22%) |
| prompt char budget                                         | 4655   | **5823** (+25%) |
| left for the retrieved block + question                    | 1798   | **3511** (+95%) |

Live check, no quality loss on either shape: the Samsung price question answers
`2662.21 PLN.` off a real product page, and `Jaka będzie jutro pogoda w
Warszawie?` answers `Jutro będzie słonecznie z szansą opadów 47%.` — the
weekday gate keeps the table where it is needed.

⏭️ **Not done: the duplicated instructions.** The language rule appears three
times (system prompt, a line beside the question, and the anchor appended to the
question itself) and the source-conflict rule twice — about 360 characters. The
repetition may well be deliberate, since a small model follows an instruction
that sits next to the question better than one 3000 characters earlier. Removing
the right copy needs an A/B, not an assumption.

## Research: better extraction for a small context window

Grounded in what the pipeline does today, not in what a larger model could do.

**The stack that decides what the model sees, in order:**

1. `extractArticle` + structured product data — page text and typed fields.
2. `retrieveWebPassages` — chunks of `WEB_RETRIEVAL_CHUNK_CHARS` (500) with 80
   overlap, each embedded with LFM 2.5 350M, cosine similarity, term coverage,
   reciprocal-rank fusion of a vector and a keyword ranking, MMR for diversity,
   `WEB_RETRIEVAL_TOP_K` (6), at most 3 per page, 40 chunks total.
3. `selectRelevantContent` — a **second, entirely different** relevance model:
   IDF-weighted needle matching, a money/digit bonus, a lead-position bonus, a
   percentile cutoff and neighbour gluing, applied when a source block has to fit
   its share of the budget.
4. `smartTrimContextBlocks` — allocates that share by **position**, weight
   `1/(index+1)`.

**Finding 1 — the last word goes to the layer with the least information.**
Layer 2 knows semantic similarity. Layer 3 re-derives relevance lexically,
ignoring layer 2's scores. Layer 4 then decides how much of each source survives
using neither, only its position in the list. The `1 zł` case is exactly this:
the block holding `price=3199 PLN` was Source 3 and was starved by a rule that
never looked at its content.

**Finding 2 — the embedding scores are computed and thrown away.**
`chunk.similarity` exists per chunk and never leaves `retrieveWebPassages`.
Carrying it into the context assembly would let layer 4 allocate by evidence
density instead of position, and would let layer 3 stop guessing — it would be
trimming passages whose relevance is already known.

**Finding 3 — extraction already beats summarisation here, and it is measured.**
`[Verified product data] name=…, price=3199 PLN, availability=in stock` is about
100 characters that answer a price question completely. The 1500 characters of
scraped prose from the same category page answered nothing — its money tokens
were `Bonus do 1400 zł w Programie Odkup` and `piąty za 1 zł`. On a 2048-token
window, one typed fact is worth more than fifteen times its length in prose.

**Finding 4 — the retrieval layer produces far more than can ever fit.**
Top-K 6 × 500 chars ≈ 3000 characters of chunks, against a context budget that
was 957 before this round and is ~3500 now for _all_ sources plus the question.
The surplus is discarded downstream by layers 3 and 4. Deriving `topK` from the
remaining character budget would move that decision back to the layer that can
actually judge relevance.

**Finding 5 — boilerplate is scored, not filtered.**
`scorePassage` already computes a `proseRatio` from the ratio of words to
digits, and uses it only to _scale a bonus_. The Media Expert passage
(`CENA zł _ zł DOSTĘPNOŚĆ Dostępny natychmiast PROMOCJE … RATY Do 40 rat 0%`) is
navigation chrome with a very low prose ratio and it still reached the prompt.
The same signal used as a filter at chunk level would have dropped it.

**Proposed order of work, cheapest and most certain first:**

1. **Budget-aware `topK`** — compute how many chunks can fit before retrieving,
   so the semantic layer decides what survives instead of the positional one.
2. **Carry `similarity` into the context blocks** and allocate the trimming
   budget by evidence density rather than `1/(index+1)`.
3. **Generalise `[Verified product data]` into a typed-fact header.** The
   planner already produces an `intent`, and `figureGrounding` already has the
   primitives (currency tokens, price statements, period-matched change data).
   A deterministic per-intent extractor — price, date, version, score,
   temperature — would give every source a compact answer-candidate line, with
   no extra model call.
4. **Use `proseRatio` as a chunk-level filter**, not only as a bonus.
5. **Only then consider LLM summarisation of a page.** It costs a full
   generation pass on a 1.7B — the same budget this whole round was spent
   freeing — and the model that would do the summarising is the one whose
   grounding failures this document is full of. Extraction first is not a
   compromise here; it is the better fit for the constraint.

## Retrieval sized to the budget, compaction, and what a bigger window actually did

✅ **`topK` is derived from the remaining character budget**
`retrieveWebPassages` always asked for `WEB_RETRIEVAL_TOP_K` (6) chunks of 500
characters — about 3000 characters — no matter how much room was left. The
surplus was discarded downstream by `selectRelevantContent` and
`smartTrimContextBlocks`, the two layers least able to judge it. `topKForBudget`
now derives k from `contextCharBudget`, clamped between
`WEB_RETRIEVAL_MIN_TOP_K` (2) and the model profile's value.
`webContextCharBudget` was fixed at the same time: it used the flat
character-density fallback (no sample) and reserved a 1200-character margin for
an instruction stack that actually measures ~2600. Both errors happened to
cancel; now it takes the question as a density sample — so a CJK question gets
less room than a Latin one — and reserves `ASSEMBLED_INSTRUCTION_CHARS`.

Measured on device, same reference query, before and after this round:

|                               | before  | after    |
| ----------------------------- | ------- | -------- |
| prompt char budget            | 4655    | 5595     |
| system prompt                 | 3698    | 2964     |
| room for the block + question | 957     | **2631** |
| retrieved context             | 2947    | 2352     |
| **discarded by trimming**     | **81%** | **19%**  |
| evidence reaching the model   | 566     | **1912** |

The answer went from `The Samsung Galaxy S25 costs 1 zł in Poland.` to
`The price of the Samsung Galaxy S25 in Poland is 2662.21 PLN.`

✅ **Long conversations: 27 tests, and compaction instead of dropping turns**
`__tests__/longConversation.test.ts` runs 1–64 turns and asserts the invariants
that had none: the assembled prompt stays inside the token budget, the system
prompt and the latest question are always kept, the kept history is an unbroken
**suffix**, it never opens on an assistant reply whose question was cut, the
digest appears once turns are dropped, and the prompt stops growing once
saturated.
The measurement those tests made possible: with a realistic ~1900-character
retrieved block, history saturated at **3 turns**. Older assistant replies are
now shortened to a sentence-boundary head of 220 characters — the most recent
reply is always kept verbatim — before any turn is dropped. On the real corpus
**27.6% of replies exceed 220 characters and shortening them frees 48.6% of all
reply characters** (reply length p50 117, p75 266, p90 453). Replayed with real
reply lengths, kept turns went 1 → 4 at four turns and 2 → 4 at sixteen.
Worth recording: the first synthetic fixture had 187-character replies, below
the threshold, and showed no gain at all. The corpus is what corrected it.

❌ **A 4096-token window works, and makes the answers worse**
`contextWindowTokens` is a flat 2048 for every model — `PROFILE_BY_FAMILY` is
empty and `PROFILE_BY_MODEL` overrides only search readiness. The React Native
ExecuTorch API exposes no sequence-length setting, so the ceiling lives in the
exported `.pte` and can only be found by trying it.
Tried: Qwen 3 1.7B at 4096. It runs — no error, no truncation, generation
completes normally, so **the export supports it**. But the same price question
that answers `2662.21 PLN` at 2048 answers **`1400 zł` at 4096, twice in a
row** — `Bonus do 1400 zł w Programie Odkup`, the trade-in bonus from the
listing page that the tighter budget used to trim away.
More context made the answer worse. The extra room was filled by the
lowest-quality evidence, because the layer that decides what fills it ranks by
position. Reverted. The window increase is unlocked but blocked on the selection
work in #306 — capacity is not the bottleneck, selection is.

🔎 **`getPromptTokensCount()` is available and unused**
The runtime reports the real prompt token count after every generation
([LLMModule](node_modules/react-native-executorch)); the app only reads
`getGeneratedTokenCount()`. Every budget decision in this document rests on
`estimatePromptTokens`, a character-density heuristic that has never been
checked against the tokenizer. Comparing the two over a few turns would say
whether the budget is leaving window unused — and unlike raising the window, it
cannot make answers worse. It needs a numeric probe in `llmStore`, which is why
it has not been done here.

## One model is not every model, and shards are not evidence

❌ **Every number in this document came from one model**
The corpus is 178 conversations and 259 answers, and a join against the `chats`
table says all of them are **Qwen 3 - 1.7B**. The reserve, the reply-length
threshold and the instruction-overhead margin were all derived from that single
distribution and then applied to every model in the catalogue.
Fixed structurally rather than by adjusting a number:

- `__tests__/fixtures/deviceConversations.json` now records the `model` that
  produced each conversation, and a test asserts the corpus reports exactly one
  — so the limitation is visible in the fixture instead of living in a commit
  message.
- `generationReserveTokens` is no longer a measured constant applied everywhere.
  `scaledGenerationReserve` derives it as `GENERATION_RESERVE_SHARE` (0.25 — the
  Qwen measurement expressed as a share of its window) with a floor of 256, and
  `getModelProfile` applies it to any model without an explicit override. A
  bigger window therefore gets a proportionally bigger reserve.
- `GENERATION_RESERVE_EVIDENCE` follows the existing `PLANNER_EVIDENCE` /
  `WEB_ANSWER_EVIDENCE` convention: it carries the Qwen distribution and states
  in as many words that every other model is **UNCONFIRMED**.
- `__tests__/generationReserve.test.ts` checks every shipped model still gets a
  positive prompt budget and a reserve above the floor, so a future per-model
  override cannot silently starve one.

**To confirm on Gemma 4 - 2B and the weaker models:** run a session, pull the
device DB, re-export the fixture (it now carries the model name), and read the
answer-length percentiles per model. If a model's p95 exceeds its scaled
reserve, give it an explicit `generationReserveTokens` in `PROFILE_BY_MODEL`
plus an evidence entry. Gemma is the one to watch — `WEB_ANSWER_EVIDENCE`
already records it as verbose and prone to LaTeX-wrapped numbers.

✅ **A source trimmed to a shard is dropped instead of passed off as evidence**
`smartTrimContextBlocks` would keep a block with as little as one character of
passage, and the hard-slice fallback could leave a partial trailing block of
similar size. A shard still reads as evidence, and what gets cut first is
usually the qualifier that gave a figure its meaning — `Bonus do`, `rata`,
`od`, `piąty za`. That is the ideal substrate for a confident wrong answer.
Now a block is dropped unless it keeps `MIN_USEFUL_PASSAGE_CHARS` (160) of
passage — checked on the **selected text**, not on the budget, because
`selectRelevantContent` can return less than it was given — and the hard-slice
path drops a trailing block below `MIN_USEFUL_BLOCK_CHARS` (200) rather than
closing it. A block carrying a `[Verified product data]` line is exempt: those
~100 characters are the answer, not a fragment of one.

✅ **A conversation that shows every grounding badge**
Seeded on the simulator as _"Grounding badges — all cases"_: a clean grounded
answer with no badge, then one turn each for `conversion` ("No real conversion
rate was found in the sources"), `figure` ("A number here couldn't be confirmed
against the sources") and `trend` ("No data on the change over time was found in
the sources"), and a final turn carrying all three at once. Each turn has real
`sourceDocuments`, so the source chips and the Sources sheet render too. Useful
for reviewing the copy and the layout without having to provoke each caveat
through a live search.

## The prompt was overflowing the window, silently

`getPromptTokensCount()` is now read after every generation in dev and compared
against `estimatePromptTokens` for the same prompt. Four turns on device,
Qwen 3 - 1.7B, prompt token budget 1536:

| question language | estimated | **actual** | ratio     |
| ----------------- | --------- | ---------- | --------- |
| Polish            | 1324      | 1421       | 0.932     |
| Polish            | 1382      | 1440       | 0.960     |
| English           | 1528      | 1456       | 1.049     |
| Polish            | 1508      | **1716**   | **0.879** |

The estimator **under-counts Polish by 4–14%** and over-counts English by 5%.
The fourth turn assembled **1716 real tokens against a 1536 budget** — 180 over,
with no error and no sign in the UI. Its answer was the generic
_"Tak, w Polsce są aktualne promocje w sklepach. Gazetki promocyjne dostarczane
przez Gazetkowo.pl…"_ — a confident non-answer produced from a prompt whose
evidence had been squeezed out from underneath it.
This is the concrete mechanism behind "the context runs out, so it hallucinates",
and it had been invisible because nothing ever compared the estimate with the
tokenizer.

Fix: `PROMPT_TOKEN_SAFETY = 0.85` holds the character budget below what the
estimate alone would allow, sized from the worst measured ratio. Same question
after the change: 1280 estimated / **1342 actual**, inside the budget, and the
answer became _"Cena Samsung Galaxy S25 w Polsce wynosi 2499 złotych w ramach
urodzinowej promocji w sklepie Proshop, która potrwa do 6 września 2026 roku."_
— a price, a named shop, an end date and a source, answering both halves of the
question.
The proper fix is a per-language density coefficient rather than a flat safety
factor; the harness to derive one now exists, and the same probe will size it
for Gemma and the other models tomorrow.

✅ **One badge, not three**
The combined case stacked all three caveats under a single answer. The DB still
stores every caveat the detectors found; `leadingCaveat` picks one for display,
most specific first — `conversion`, then `trend`, then `figure` — because a
conversion or trend caveat already implies an unconfirmed number, so printing
the general line on top of it adds nothing and buries the one worth reading.

## Sources attached per section, and what that actually changes

`attributeSourcesByBlock` ([utils/attributeSources.ts](utils/attributeSources.ts))
splits the visible answer into markdown **blocks** — paragraphs, but a list, a
table and a fenced code block each stay whole — scores every sentence in a block
against each used web source with the existing stem-overlap helper, and gives
the block the source most of its sentences point at. A block below
`CITATION_MIN_MATCH_SCORE` gets nothing rather than a guess, a block with no
match of its own inherits the previous one's source, and neighbouring blocks
that land on the same source are merged so a four-sentence answer from one page
does not sprout four identical chips.

Measured over 252 stored answers that carry their `sourceDocuments`:

|                                                      |              |
| ---------------------------------------------------- | ------------ |
| answers with at least one used web source            | 208          |
| **today: one chip** (exactly one used source)        | 97           |
| **today: no chip at all** (two or more used sources) | **111**      |
| of those, would now show attribution                 | **92** (83%) |
| of those, with more than one chip                    | 2            |

The framing this started from — "two sentences, two sources, a chip under each"
— turns out to be about **1% of real answers**, because current answers are
short (p50 117 characters) and the merge rule collapses same-source neighbours.
The real gain is elsewhere: `dominantWebSource` only ever showed a badge when
exactly **one** source was used, so an answer resting on two pages showed
nothing. 92 answers move from no attribution at all to an attributed block.
The bottom badge is suppressed only when block attribution actually produced
something, so every answer that shows a chip today still shows exactly one.

❌ **Smoke test caught a real one: an answer that was only a think block**
`A ile bitcoina mogę kupić za 5000 dolarów po tej cenie?` produced
`<think>\n\n</think>` and nothing else. The success gate checked
`finalResponse?.trim()` on the **raw** string, which contains the think markers,
so the turn counted as successful and an empty bubble was persisted — no text,
no error, no retry. It now checks the **visible** text. This one predates the
"only empty fails" rule (the old guards also returned false on empty visible
text); removing the other guards is what made it reachable.

✅ **`w źródle 1` was not being humanized**
`humanizeSourceReferences` matched `źródł\w*` — but Polish declines
_źródło_ → _w źródle_, with `l`, not `ł`. The locative slipped through and the
model's numbered citation reached the user verbatim. Widened to `źród[łl]\w*`.

Prompt-token accuracy over the smoke-test turns, with `PROMPT_TOKEN_SAFETY` in
place: 1.022, 0.981, 0.970, 1.012 — all inside the budget, no overflow.

## A twelve-turn shopping conversation, and what it broke

Driven on device as a user would: one topic (buying a Galaxy S25), follow-ups
in Polish and English mixed, referents left implicit. What came back:

| turn             | result                                                               |
| ---------------- | -------------------------------------------------------------------- |
| price            | ✅ `2499 złotych w ramach urodzinowej promocji`                      |
| camera           | ⚠️ answered for the **S25+**, not the S25                            |
| RAM / CPU        | ⚠️ S25+ again — `16 GB, Snapdragon 8 Elite`                          |
| vs iPhone 17 Pro | ⚠️ gave the iPhone price instead of comparing                        |
| buy now or wait  | ❌ **the question, echoed back, stored as the answer**               |
| cheapest shop    | ❌ **echoed back again**                                             |
| summarise        | ⚠️ `12 GB RAM` — contradicts the `16 GB` it said three turns earlier |

❌ **Two turns stored the user's own question as the answer**
This is what "only an empty response fails the turn" bought: an echo is not
empty, so it was shown. On screen it reads as a broken app.
Root cause of the miss, though, was elsewhere: `normalizeForEchoCompare`
lowercased and stripped punctuation but **did not fold diacritics**. The user
typed `Czy warto go kupic teraz` and the model wrote back
`Czy warto go kupić teraz` — the same sentence to a reader, two different
strings to the detector. This is the normal case in Polish, where people type
without diacritics and the model puts them back. Now folded through
`foldForMatching`, the same helper the rest of the retrieval code uses.
And when a retry still comes back as an echo, the reply is replaced with a
plain `Nie udało mi się odpowiedzieć na to pytanie na podstawie znalezionych
źródeł.` (or its English form, picked by the question's language) instead of the
echo. The sources and the search trace stay — the search that worked is not
thrown away, and the user is not shown their own words as an answer.
Live after the fix: `A gdzie kupię ten telefon najtaniej?` →
`Najtańsze oferty na telefonach komórkowych znajdziesz na Ceneo.pl.` with the
Ceneo chip attached.

✅ **The `figure` badge was blind to bare amounts**
`Cena Bitcoin i Ethereum w dolarach (USD) obecnie wynosi 30 000 i 100 000` drew
no caveat: the currency is named once at the start of the sentence and the
figures themselves carry no currency token, so `extractCurrencyFigures` found
nothing to check. `extractBareAmounts` now reads those numbers when the reply
names a currency somewhere, skipping years and values under 100 so counts and
model numbers are not mistaken for amounts.
Kept deliberately unchanged: the context pool still prefers price-statement
figures over every figure on the page. Widening it to the union made a synthetic
test pass and broke F8 — a real case where a page's `3 746,00 zł` is the total
interest on an instalment plan, not the price. The evidence-backed rule wins
over the invented fixture.

**Prompt-token accuracy across the twelve turns** (safety factor in place):
1.098, 0.973, 1.065, 1.029, 0.959, 0.937, 0.949, 0.964 — Polish still runs
denser than the estimator thinks, but every turn stayed inside the window.

⚠️ **Still open, and it is model quality, not plumbing:** the S25/S25+ variant
confusion, a comparison question answered with one side's price, and a summary
that contradicts an earlier turn. The retrieval fed the right pages each time;
the 1.7B is what turns them into those answers.

## Session summary — what today actually established

**The measurements that changed decisions, not the ones that confirmed them:**

- **The prompt was overflowing the context window and nothing noticed.** A Polish
  turn assembled 1716 real tokens against a 1536 budget. `estimatePromptTokens`
  under-counts Polish by 4–14% and over-counts English by 5%, and until today
  nothing had ever compared it with `getPromptTokensCount()`, which the runtime
  exposes and the app never read. This is the concrete mechanism behind "it runs
  out of context and hallucinates" — the overflowing turn answered with generic
  filler, the same question inside the budget answered with a price, a shop and
  a date.
- **A bigger window made answers worse.** Qwen 3 1.7B runs fine at 4096 — the
  `.pte` supports it — but the same price question answered `1400 zł` (a trade-in
  bonus) instead of `2662.21 PLN`, twice. The extra room filled with the
  lowest-quality evidence, because the layer that decides what fills it ranks by
  position. **Capacity is not the bottleneck; selection is.** Reverted, and the
  reasoning is now issue #306.
- **The system prompt was 79% of the budget.** Cutting it to ~2300 characters —
  by renaming `<context>` to `<sources>` (which deleted the rule that existed
  only to stop the model leaking the word), and by gating three always-on
  instructions — plus lowering the generation reserve from a measured answer
  distribution took the room for evidence from 957 characters to 2631.
- **Retrieval produced three times what could fit.** `topKForBudget` now derives
  k from the remaining budget: context discarded by trimming fell from **81% to
  19%**, evidence reaching the model rose from 566 to 1912 characters.

**The guards were the problem more often than the model was:**

- `isCircularNonAnswer`, widened on this branch to match `\bsources?\b`, was
  killing answers that cited `Source 1`, `Source 2`, `Source 3` — the exact
  citation style the pipeline sets up. 3 of its 4 fires on the corpus were false
  positives.
- The failure policy erased the whole turn — answer, sources and trace — for any
  tripped guard. Now only an answer with no visible text fails; everything else
  is shown. The one exception is a pure question echo, which is replaced with a
  plain "I could not answer this from the sources I found", because showing the
  user their own question reads like a broken app.
- The echo detector was diacritic-blind: users type `kupic`, the model writes
  `kupić`, and two turns in a twelve-turn conversation stored the question as the
  answer.

**Discipline that kept paying off:**

- Every number in this document came from **one model**, Qwen 3 - 1.7B — all 178
  corpus conversations. That is now recorded in the fixture and in
  `GENERATION_RESERVE_EVIDENCE`, and the reserve scales from the window rather
  than being one measured constant applied everywhere. Gemma and the weaker
  models still need their own run.
- Two fixes were nearly shipped on synthetic fixtures that real data then
  contradicted: reply compaction looked worthless against 187-character test
  replies (real p75 is 266, and shortening frees 48.6% of history characters),
  and widening the figure-grounding pool passed an invented test while breaking
  F8, a case observed live. **When a synthetic test and the corpus disagree, the
  corpus is right.**
- The per-section source attribution was justified by the wrong argument. The
  "two sentences, two sources" case is 1% of real answers. The actual gain is
  that 111 answers rest on two or more sources and therefore showed **no**
  attribution at all; 92 of them now show one.

**Still open, and honestly out of reach of the plumbing:** S25 vs S25+ variant
confusion, comparison questions answered with one side's figure, and a summary
contradicting an earlier turn in the same conversation. Retrieval fed the right
pages every time.

## Extraction round: records, time scope, and two races

Driven from a live QA session on a physical Pixel 10 (Android 16), after the
compact round was committed. The question that started it: "Jaka będzie pogoda
w nowym Sączu jutro" answered with "nie posiadam wystarczających informacji".

✅ **Retrieval was never the problem — extraction was flattening the table**
Diagnosis, from the device's own DB rather than a guess: the INTERIA page was
fetched with `similarity 1.0`, `read: true`, `used: true`, and its stored
passage contained `Pogoda Jutro, Nowy Sącz Czwartek, 3 Września` along with the
hourly rows. The prompt was reconstructed with the app's own code and came to
**1203 tokens against a 1536 budget** — no truncation, 333 tokens spare. The
date block was correct (`Tomorrow: Thursday, 3 September 2026` plus the Polish
weekday map). The weak-retrieval hedge could not have fired either: with
`maxSimilarity ≥ 0.4` and two pages the floor is 0.5, and
`WEB_AGREEMENT_SINGLE_HOST_FACTOR` is 0.85, so the label was at worst
`ambiguous` and `webWeak` needs `incorrect`.
What the model actually saw was `Jutro 22°C 12°C Piątek 24°C 18°C` — one run
with no boundary. `extractArticle` turned every block tag into a newline, then
`coalesceLines` glued the short lines back together **with a plain space**. The
row structure the extractor preserved was destroyed one step later, and the
model answered with Friday's numbers.
Fix: extraction now rebuilds the block tree and decides whether siblings form a
record. `<tr>` is always a record; any other parent qualifies only with 2–16
leaf children, each within the cell length limit, and no text of its own.
Verify: `__tests__/extractArticle.test.ts` — div grids, `li` grids, a long cell
in a row, prose, a bare menu, and a facet rail.
Confirmed against the **live page**, not a fixture: the boundary now falls
between the days — `Jutro 22°C 12°C | Piątek 24°C 18°C`.

⚠️ **The menu filter is what constrains the rule, and it is easy to break**
Joining a nav run into one long line would push it past `MENU_LINE_MAX_CHARS`
and hide it from `dropMenuRuns`. A record therefore has to satisfy the same
`MENU_LINE_KEEP` predicate that filter uses, after facet counts and promo
badges are discounted — so a record is exactly what the menu filter would have
kept anyway. Anyone loosening the grouping rule has to re-check that pairing,
or filter rails start reaching the model.

🔧 **Fixing the representation did not fix the answer**
Three post-fix runs on device, all with correct retrieval and all wrong:
Qwen 3 - 1.7B said "24°C na dołu i 18°C na górze" (Friday's row, plus phrasing
that is not Polish), then on another page took the _current_ conditions and
presented them as tomorrow's. This is the model, not the plumbing — the same
conclusion the twelve-turn shopping conversation reached.

✅ **A question about a named day is now told the "now" reading is off-limits**
`getTimeScopeInstruction` fires when the question names a day other than the
present. `namesAnotherDay` is deliberately narrower than `mentionsTime`, which
matches "now", "current" and bare years — right for deciding whether to state
the date, wrong for deciding whether the current reading is off-limits.
Verify: `__tests__/promptUtils.test.ts`.

🔧 **…and on device it did not help, which located the real cause**
Same question, `Qwen 3 - 1.7B`, instruction live: "Pogoda w Nowym Sączu jutro
będzie idealna na trening… Odczuwalna temperatura: 25°C". The passage it drew
from says **"Pogoda jest dziś idealna na trening… Odczuwalna temperatura:
25°C | Szansa opadów: 0% 12:00"** — today's block, presented as tomorrow's.
The instruction cannot be blamed alone, because of what the source list shows:
of five results, **one** was used. Onet (similarity 1.0) was used and
contributed only its "dziś" section; **INTERIA was fetched and `read: true`
but `used: false`** — and INTERIA is the page carrying `Jutro 22°C 12°C`.
So the page that answers the question was retrieved, read, and dropped before
the prompt was built. No prompt instruction can recover from that.
The failure is in selection, at two levels: which sources reach the context,
and which passage within a page is kept. Neither is aware of the day the
question asks about, while `selectRelevantContent` scores on query terms that
the "today" block matches just as well.
Not attempted here: this is the source-ranking layer, and F8 above records
what happened the last time that pool was widened on a hunch.

✅ **A bare temporal follow-up reached the search with no subject at all**
Found by testing a long conversation that changes subject halfway, which
nothing had covered: the corpus median is one user turn and only five of its
178 conversations reach four. `A pojutrze?` matched none of the incompleteness
rules — no pronoun, no dropped subject, no elision — so
`carryReferentIntoQuery` passed it through and the search ran on the literal
string. A short query naming only a day now counts as needing its referent.
Verify: `__tests__/longConversation.test.ts`.

✅ **The chat header could show one model while another answered**
`llmStore.loadModel` awaited `NetInfo.fetch()` **before** extending
`modelLoadChain`, so a send waiting on that chain could not see a selection
made moments earlier. Observed on device: header `Gemma 4 - 2B`, stored
`modelName` `Qwen 3 - 1.7B`. Worse than a label bug — `sendChatMessage`
captures the model up front and later reloads it, so the stale model was
actively restored. The network check now runs inside the queued task.
Confirmed on device after the fix: sending mid-load is answered and stamped by
the newly selected model.

⚠️ **`Software caused connection abort` — hardened, not reproduced**
Twelve aborts in 2.84 s with shrinking gaps, from the `catch` in
`modelStore.downloadModel`. The code is a locally closed socket — a
cancellation, not a network failure — and `ModelCard.handlePress` awaits
`NetInfo.fetch()` before the state flips to `Downloading`, so repeated entry
starts parallel fetches of the same URLs. A guard now lives in `downloadModel`
so it covers every call site. **The original burst was never reproduced**; a
single tap downloads cleanly. Treat this as consistent-with-evidence
hardening, not a confirmed fix.

✅ **Resolved, and not an app bug: "one tap downloaded a model nobody asked
for"**
Tapping download on Qwen 3 - 1.7B appeared to also fetch Qwen 3 - 0.6B
(505 MB): 1.7B `.pte` complete 11:40:19, family tokenizer 11:40:21, a second
`ResourceFetcher.fetch` at 11:40:26 with no screen interaction of mine, 0.6B
`.pte` complete 11:40:49. No JS path explained it — the only callers of
`downloadModel` are `ModelCard`, and `editModel` is reachable only from the
edit modal.
Tested directly: both variants deleted, then **only** 0.6B downloaded. Only
0.6B's three files appeared. The app does not pull sibling variants.
The real explanation is that **someone else was using the same physical phone
at the same time**, which the rest of the session corroborates: the
`adb reverse` tunnel was re-pointed to another checkout's Metro, and the APK
was replaced with a build from that checkout at 12:26. The 11:40 download was
their tap, not the app's doing.
Worth keeping as a method note: on a shared device, "no interaction" means no
interaction _from this session_. Confirm the installed build and the tunnel
before attributing an unexplained event to the code.

🔧 **Open: Gemma's `'llm'` planner sent a good question to unusable pages**
Same question, same device, `Gemma 4 - 2B`: the planner reformulated the query
and retrieval landed on meteoblue and AccuWeather with **`used: 0`** — nothing
extractable. Its refusal was correct _given those sources_, which also means
the run is not comparable to the verbatim-planner runs above. `Gemma 4 - 2B`
still has no `PLANNER_EVIDENCE` entry at all, and this is exactly the silent
under-retrieval the planner section warns about.

⚠️ **Device note: the Pixel stopped running this checkout mid-session**
Two separate ways, both worth knowing before trusting any device result:
the `adb reverse` tunnel was re-pointed from `tcp:8081→8081` to `8081→8090`
(checkout B's Metro), and then the app itself was replaced — installed
`versionCode` went from the 65 built here at 11:15 to 68 at 12:26, from a
checkout with no `expo-web-browser`, which red-boxes this bundle with
`Cannot find native module 'ExpoWebBrowser'`. The fastest tell is that red box;
the second fastest is `dumpsys package … | grep lastUpdateTime`. Verify both
the tunnel and the installed build before reading anything into a device run.

## Device round: what web search does to a real conversation

A sixteen-turn Polish conversation driven through the UI on a physical Pixel 10
(Android 16, `Gemma 4 - 2B`, `webPlanner: 'llm'`, 2048-token window), twelve
turns with web search on and four with it off, plus a planner corpus run and an
attachment round. Every turn was read back from the device's own `messages`
table — question, answer, per-source `read`/`used`, `timeToFirstToken` — not
from the screen.

🔧 **Web search made this conversation worse, not better**
Four of four web-off turns were correct. Four of twelve web-on turns were.
The failures were not the model running out of context: turn 15 summarised all
fourteen preceding turns accurately under the same 2048-token window, and turn
11 resolved "the city I asked about in my first message" back to Kraków ten
turns later. Conversation state holds. Retrieval is what breaks.

🔧 **The planner rewrites non-English questions into English**
59-item corpus (8 languages) run through `planWebSearch` on device: 0 parse
failures, but **25 of 47 non-English items came back as English queries**.
Split by script: non-Latin 16/18 (hi 10/10, ur 6/8), Latin 9/29.
`PLANNER_SYSTEM_PROMPT` never states what language a query should be in — its
"in ANY language" clause governs `needs_search` only — and all eight
`PLANNER_EXAMPLES` are English question _and_ English query. The Tokyo example
(`"whats the weather in tokyo right now"` → `"Tokyo weather today"`) is the
template the model reproduced verbatim for Delhi, Lahore, Berlin and Kraków.
Nothing downstream compensates: `webViewScrapeProvider` concatenates
`engine.url + query` with no region or language parameter, so query language is
the only locality signal there is.
Live consequence, turn 4: "Jak daleko jest z Krakowa do Zakopanego?" planned as
`distance between Krakow and Zakopane`, returned two English Rome2rio pages and
answered "nie jest możliwe podanie konkretnej odległości" — a distance every
Polish page states outright.

🔧 **Translation plus the foreign-script filter discards almost every result**
`runWebSearch.ts:433` drops any result whose dominant script differs from the
**question**'s, and `:219` searches only `plan.queries` when the plan is
non-empty — the original question is never searched. So a non-Latin question
produces an English query, English results, and a filter that rejects them.
Measured, not reasoned: the same engine the app uses
(`html.duckduckgo.com`, first entry in `SCRAPE_ENGINES`) was queried with the
plan text, and each result's title+snippet run through the repo's own
`isForeignScript` against the original question.

- Hindi `दिल्ली में आज का मौसम कैसा है` → plan `weather in Delhi today`
  (the plan the corpus actually produced for this item): **1 of 10 results
  survives** — the single page whose title carries Devanagari.
- Russian `какая сегодня погода в Москве` → `current weather in Moscow`:
  **0 of 10 survive.**
  Two caveats on the method. The fetch was made from the host rather than through
  the device's WebView, so region and personalisation may differ slightly. And the
  Russian plan text is a reconstruction — the corpus run stopped before its
  Russian block — while the Hindi one is measured output.
  The earlier form of this note claimed zero results outright. Hindi shows that is
  too strong: the failure is 90% of retrieval discarded, and total only when no
  returned page happens to carry the question's script.

🔧 **Ranking matches sentence shape, not the entity**
Turn 7, "Kiedy odbył się pierwszy w pełni udany lot Starship?": of five results,
three were about a heart transplant and a V-2 rocket — pages matching the Polish
frame "pierwszy udany … odbył się", not Starship. The heart-transplant page
ranked **first** and was marked `used`. The answer invented a date, 24 July 2026.
`rankingQuery` is `query + intent`, i.e. the Polish question, so Polish pages on
an unrelated topic outscore the on-topic English SpaceX page the search returned.

🔧 **Evidence is retrieved and then not used**
Turn 9, cost of a Falcon 9 launch: five relevant results, one titled
"SpaceX Increases Falcon 9 Launch Prices to $74M", `used: 0` across all five,
answer "nie ma informacji". That title was rank 3 and `WEB_FETCH_TOP_N_CONTENT`
is 2, so its body was never fetched — but the title is in the prompt via
`sourceBlock` and carried the answer on its own.
Turn 16, "Jaki jest kurs euro do złotego?": query stayed Polish, retrieval
returned exactly one source — **NBP**, the authoritative one — `read: true`,
`used: 0`, answer "nie jest możliwe określenie aktualnego kursu". Query and
retrieval were both right here; selection alone lost it.

🔧 **The planner never declines a search**
0 of 59 corpus items returned `needs_search: false`. Recorded initially as a
strength — no silent disabling, unlike LFM 2.5 VL 450M's 37/72 — the corpus
could not show the other side, because it contained only searchable questions.
Turn 12 did: "Dzięki, to bardzo pomocne." was planned verbatim as a query,
fetched five pages about how to thank people, marked three of them `used`, and
spent 43 seconds answering "Dziękuję bardzo." The prompt lists "greetings,
thanks, chit-chat" as `false` cases and Gemma ignores them.

⚠️ **Conversation history leaks into the query**
Turn 13 asked about tomorrow's weather in Zakopane and was planned as
`weather in Zakopane tomorrow Statistical Office` — "Statistical Office" came
from the sources of turn 10, six turns earlier. The date scoping itself worked
(the answer correctly said 3 September 2026), so `getTimeScopeInstruction` is
holding; the contamination is separate and needs its own guard.

🔧 **The planner costs 27 seconds before a search begins**
Corpus latency: p50 27.5 s, p90 32.7 s, max 70.3 s per planner call, on top of
retrieval and generation. End-to-end `timeToFirstToken` in the conversation ran
30–73 s. `verbatim` pays none of this. The corpus ran while other models were downloading
in the background, so the figure was checked for contention: median 27.6 s over
the first half of the run against 27.5 s over the second. The cost is the
model's, not the download's.

✅ **Documents work, and they switch web search off**
`raport-kwartalny.txt` attached to a fresh chat, asked for net profit and
headcount: "3 630 000 zł … 148 osób", both exact. `RAG_PRIORITY_OVER_WEB_SEARCH`
is visible in the UI as a disabled Web toggle rather than only the coded toast.

⚠️ **An image replaces an attached document**
With `Gemma 4 VL - 2B` loaded, attaching an image to a chat that already had the
report attached produced a message row with `imagePath` set and `documentName`
NULL, and `chatSources` for that chat empty. The document was dropped, not
combined. A question spanning both — "does the chart agree with the report?" —
cannot currently be asked.

⚠️ **The image question never produced an answer, but the run is not clean**
The same question on `Gemma 4 VL - 2B` was still at ~79% CPU with no first token
when the run was abandoned, against 30–70 s for the text sibling. It is not a
usable measurement: partway through, the phone's screen timed out and the app
went to the background, so an unknown share of that time was spent throttled.
`stay_on_while_plugged_in` is now set on the device; the case needs re-running
with the screen held awake before any latency claim is made about it.

## Fix round: language, a fallback query, a floor, and an anchor

Five of the six fixes the device round pointed at, implemented and measured.
The chit-chat gate was left out deliberately. Verification of the prompt change
is a paired re-run: the same 27 corpus items, same model, same device, compared
against their own earlier output rather than against a fresh sample.

✅ **Telling the planner to keep the question's language fixed 10 of 14 cases**
`PLANNER_SYSTEM_PROMPT` now states the query must be in the user's language and
script, and `PLANNER_EXAMPLES` carries a Polish and a Hindi example beside the
eight English ones. On the 25 non-English items of the paired subset,
translation into English fell from **14 to 4**, with no item newly translated.
`jaka jest pogoda w Krakowie dzisiaj` → `pogoda Kraków dzisiaj`;
`दिल्ली में आज का मौसम कैसा है` → `दिल्ली मौसम आज`.
Two further rules went into the same prompt, aimed at defects with the same
root: keep the names and numbers the user gave (the `kurs euro` →
`euro to dollar exchange rate today` swap is gone — it now returns
`kurs euro dzisiaj`), and never pull a name in from an earlier unrelated turn.

⚠️ **Non-Latin scripts still translate half the time**
The four survivors are all Devanagari or Arabic: `पेट्रोल की कीमत आज कितनी है` →
`petrol price today`, `ڈالر کا آج کا ریٹ کیا ہے` → `current dollar exchange rate`.
Latin-script languages are now clean (de, pt, pl, es, fr: 7 before, 0 after).
The instruction is not enough on its own for a script the model has less of;
the fallback query below is what stops those turns from failing outright.

⚠️ **The longer prompt costs 5.5 s per search**
Median planner latency on the same items went from **28.3 s to 33.8 s**. That is
a real regression and the rules are what bought it. It is worth paying only
because the alternative was retrieval that misses the question's language
entirely — and it sharpens the case for not running the planner on every turn.

✅ **The question is now always searched alongside the plan**
`withVerbatimFallback` appends the user's own words to the planned queries,
deduplicated and capped at four. Before, `baseQueries = plan.queries.length ?
plan.queries : [query]` meant that whenever the planner produced anything, the
question itself was never sent to the engine — so a single bad plan decided the
whole turn. Verify: `__tests__/verbatimFallback.test.ts`.

✅ **The foreign-script filter no longer empties the result set**
It now discards foreign-script results only while at least one same-script
result survives. Measured beforehand against the real engine: a Cyrillic
question left 0 of 10, a Hindi one 1 of 10.
A first attempt set the floor at three same-script results, and the existing
`never fetches a result written in another script` test caught it — with one
good English result and an Arabic one, that threshold fed the Arabic page to the
model. The floor is one: prefer the question's script whenever anything in it
came back, and keep foreign results only when nothing did.
Verify: `__tests__/scriptFloor.test.ts`.

✅ **Ranking anchors on the question's subject, not its sentence frame**
`anchorTerms` picks out the words that carry the subject — a name away from the
opening word, or any token with a digit. A result matching them is boosted, one
matching none is penalised, and the engine's own top result is no longer pulled
back up when it matches no anchor. On the turn-7 fixture the Starship page now
ranks first and the heart-transplant page falls below second.
A result whose **title** carries a figure gets a further bonus: that is evidence
already in hand, costing no fetch, and it is what the Falcon 9 turn threw away
by ranking `SpaceX Increases Falcon 9 Launch Prices to $74M` third against a
fetch budget of two. Short anchors ("9" in "Falcon 9") match as whole tokens
only, or they would hit inside 1999 and 2029.
Verify: `__tests__/entityAnchor.test.ts`.

🔧 **What these fixes do not touch**
The planner still never returns `needs_search: false` — 0 of 27, unchanged, as
the gate was deliberately left alone. The NBP case (right query, right source,
fetched, `used: 0`) is untouched and still needs its prompt context dumped
before a fix can be designed. And none of this has been re-run as a
conversation: the paired subset measures the planner, not the answers.

## Re-test round: what the fixes moved, and where the failure went

The sixteen-turn conversation was re-run on device against the fixed pipeline.
It is **not** a clean A/B: the answer prompt was changed after turn 7, once the
turns kept pointing at the same defect, so turns 1–7 and anything after them ran
on different code. The per-turn comparisons below stand on their own; the
aggregate "web on 4/12" figure does not yet have a matching re-measurement.

✅ **The language fix reaches the answer**
Turn 4, "Jak daleko jest z Krakowa do Zakopanego?", previously answered "nie jest
możliwe podanie konkretnej odległości" off two English Rome2rio pages. It now
answers "około 100-110 kilometrów" from Polish route pages. The chain the
corpus predicted — Polish query, Polish sources, usable answer — holds
end-to-end.

✅ **A figure in the title now gets the page read**
Turn 1 went from a truncated reply, and before that "Kraków ma 4 000
mieszkańców" taken from a medieval population table, to "804 237 … 816 614 (GUS)"
with both figures attributed. The ranking change is visible in the source order:
`Kraków Population 2026 — 804,237 People` moved from rank 5 to rank 1 and
`Statistical Office in Krakow` — a voivodship bulletin with no answer in it —
fell from rank 1 to rank 5. Under a fetch budget of two, that is the difference
between reading the answer and reading a bulletin.

✅ **Anchoring removed the off-subject sources entirely**
Turn 7 previously retrieved three pages about a heart transplant and a V-2
rocket, ranked the transplant first, and invented a launch date. All five
results are now genuinely about Starship.

🔧 **The bottleneck moved from retrieval to the answer step**
That same turn 7 then answered "nie ma informacji o pierwszym w pełni udanym
locie Starshipa" with `used: 0` — while holding a fetched page whose stored
passage reads "Starship zaliczył pierwszy w pełni udany lot … 27 SIE 2025 …
z 26 na 27 sierpnia … dziesiąty lot testowy". The evidence was in the prompt, in
plain Polish, and was refused. The same shape appeared on turn 2 (five relevant
Polish pages, three marked used, "źródła nie zawierają konkretnej listy") and in
the earlier round on the NBP and Falcon 9 turns. No further retrieval work
addresses this.
Diagnosis: three separate instructions in `sourceGroundingInstructions` push
toward declaring absence — the figures rule, the fallback rule, and the
per-turn subject rule. They are what stops invention, and on a 2B model they
also stop recognition. A counterweight was added: re-read the whole block,
titles included, before declaring something missing.
Effect, same question re-asked on a fresh chat: `used` went 0 → 1 and the
refusal became a substantive answer — but it described the flight instead of
dating it, so the "when" still went unanswered. Partial, not fixed. The page's
own date is a byline ("27 SIE 2025") and the in-text date ("z 26 na 27
sierpnia") carries no year, which makes this a harder case than it first looked.

⚠️ **One regression found and fixed inside this round**
Searching the user's words beside the plan meant results always arrived under two
different `sourceQuery` values, so the `[Answers: …]` sub-question tag started
firing on every turn — and Gemma copied it verbatim into its reply on turn 2.
The tag is now emitted only for a plan that really asked more than one thing.
The first attempt at that defaulted the flag off and broke every other caller;
the existing `webResultsToContext` test caught it, and the default is on.
Verify: `__tests__/subQueryLabel.test.ts`.

⚠️ **Turns that came out worse**
Turn 2 answered well before and refuses now. Turn 6 named Gwynne Shotwell before
— correct for "president of SpaceX" — and now names Elon Musk off a Polish page
titled "SpaceX - kto jest właścicielem?", because the language fix moved
retrieval onto Polish pages that frame the question as ownership. Neither is
attributable to a single change with one sample; both need the clean re-run.

🔧 **An unrelated bug the fixtures exposed**
`CROSS_ASSET_PATTERN` carried `/i`, so its currency-pair half
(`[A-Z]{2,6}[/-][A-Z]{2,6}`) matched ordinary URL path segments — `com/Krak`,
`com/cities` — and charged legitimate results the converter-page penalty
depending on how long their first path segment happened to be. The pair half is
now case-sensitive, which is what currency codes are.

🔧 **A diagnostic that was lost**
Source rows now record the user's question rather than the joined retrieval
query, which is right for the sources UI but means the planner's actual query is
no longer visible in the database. Reading `telemetry.plannedQueries` is the
only way to see it now, and it is not persisted.

## Controlled re-run: 4/12 → 6/12, and what still fails

Sixteen turns on device, same script, same model, same web-on/off pattern, and
**no code changed during the run** — the condition the previous round could not
meet. Three further fixes went in before it started: the answer prompt now says
to lead with the value the question asks for; passage selection rewards a
specific date when the question asks "when"; and the retrieval query is stored
beside the user's question again, after the display change hid it.

**Web on: 4 of 12 correct before, 6 of 12 after, plus one partial.**
**Web off: 4 of 4 before, 3 of 4 after, plus one partial.**
One conversation, one model, one run. The direction is consistent with the
per-turn evidence below, but nobody should read 6/12 as a stable rate.

✅ **Four turns that failed before now answer**

- Turn 4, distance to Zakopane: "około 100-110 kilometrów" off Polish route
  pages, against "nie jest możliwe podanie konkretnej odległości" off English
  aggregators.
- Turn 9, Falcon 9: "$74M (około $3,246/kg do LEO)" with the page named,
  against "nie ma informacji" with 0 of 5 sources used while `$74M` sat in a
  title.
- Turn 1, Kraków: "804 237 … 816 614 (GUS)" with both figures attributed,
  against a truncated reply — and, the run before that, "4 000 mieszkańców"
  lifted from a medieval population table.
- Turn 7, Starship: a date at last ("5 maja 2021, SN15"), against an invented
  "24 lipca 2026" in the baseline and a flat refusal mid-round. The
  lead-with-the-value instruction is what moved it.
  Turn 13 also improved without changing category: all five weather sources are
  now Polish rather than meteoblue and AccuWeather, and the "Statistical Office"
  leak from six turns earlier did not recur.

🔧 **Refusal on top of correct retrieval is still the main failure**
Turn 14 fetched `Cennik skipassów - Polana Szymoszkowa` and `Ceny skipassów
Zakopane - Kasprowy Wierch` — the official price lists — and answered "nie jest
podana informacja o cenie", `used: 0`. Turn 16 held NBP, Walutomat and
InternetowyKantor and said the same. Both are price tables, which suggests the
extractor is handing over navigation rather than rows, but that is a hypothesis:
the passages were not dumped for those two turns.
The prompt counterweight helps and does not solve it. It is worth noting the
baseline had the same shape on the same kind of page, so this is unfixed rather
than newly broken.

⚠️ **Two turns came out worse than the baseline**
Turn 10 answered "the current population of Warsaw is 1." — a number cut off
mid-figure, against 1,863,578 / 1,866,729 before. The page carrying
`Warsaw Population 2026 — 1,862,402 People` in its title ranked fourth and was
never read, so the title-figure bonus did not decide this one.
Turn 6 names Elon Musk as president of SpaceX where the baseline named Gwynne
Shotwell, who actually holds the title. This reproduced across two runs, so it
is not noise: the language fix moves retrieval onto Polish pages that frame the
question as ownership ("SpaceX - kto jest właścicielem?"), and the Polish
Wikipedia page on Shotwell sits in the results unused. A correctness cost of the
language change, and the clearest argument that it needs a follow-up.

⚠️ **Untouched by design**
The planner still never returns `needs_search: false`: turn 12, "Dzięki, to
bardzo pomocne", again fetched five pages about how to thank people and spent
46 s answering "Dziękuję". The chit-chat gate was excluded from this round of
fixes deliberately.

## The refusals, split apart

The controlled run left two turns refusing on top of good retrieval — the ski
pass and the euro rate. They looked like one defect. Dumping the stored passages
showed they are two, with opposite conclusions.

✅ **The ski-pass refusal was the pipeline's fault, and is fixed**
Both fetched passages contained **no amount at all**: the model was handed a
resort roll-call and an intro blurb, so "nie jest podana informacja o cenie" was
the correct answer to what it was given.
Traced layer by layer against the live page:

- the raw HTML holds the prices (`150,00 PLN`, `285,00 PLN`, `410,00 PLN`);
- `heuristicExtractText` keeps them — 13 355 characters including every figure;
- `selectRelevantContent` drops all of them.
  The reason is the same shape as the ranking defect one layer up. The term score
  is unbounded — every question word that appears adds twice its IDF weight — so
  the roll-call ("Tatry Super **Ski** … **ZAKOPANE**: Polana Szymoszkowa") matching
  six of the question's words beats a `150,00 PLN` cell that matches none.
  A bonus alone could not fix it: at 4 points it changed nothing, and only an
  absurd 50 flipped the selection. So passages carrying no figure are damped
  instead when the question asks a price, which puts the two on comparable footing
  without a magic constant.
  On device, the same question now answers "170 zł dla osoby dorosłej i 160 zł
  ulgowy" with the page named.
  Verify: `__tests__/questionShape.test.ts`, against a fixture trimmed from the
  real szymoszkowa.pl page rather than an invented one.

🔧 **The euro-rate refusal is not the pipeline's**
Its passage does contain the answer — "Kurs kupna EUR InternetowyKantor.pl
**4,3327**" — and the model still said the sources hold no rate. Retrieval,
extraction and selection all did their job. This one sits with the answer step,
alongside the cases the prompt counterweight only partly moved.

⚠️ **One source of the ski-pass failure is nobody's bug**
The second page, skiinfo.pl, has no prices in its HTML at all — they are drawn
by JavaScript. The scraper fetches HTML, so that page can never contribute a
figure, and ranking it highly wastes one of the two fetch slots. Worth a
follow-up: a page whose fetched text contains none of what the question asks for
could release its slot to the next candidate.

🔧 **A stateful-regex bug, caught before it shipped**
The first version of the price check called `MONEY_ANCHOR.test(...)`. That regex
carries the `g` flag, so `.test` advances `lastIndex` and would have answered
differently for every other passage — a scoring function that silently alternates.
It uses `.match` now, as `hasMoneyAnchor` already did.

`heuristicExtractText` is now exported. It was the only way to tell "extraction
lost it" from "selection lost it" without guessing, and that distinction decided
which layer to change.

## Pixel round: a fifteen-turn OLED conversation, read from the database

Physical Pixel 10, Gemma 4 - 2B, branch `web-search-compact`, 2026-09-02,
chat 55 (message ids 335–362). The user rated the conversation as the best the
feature has produced so far, and it is exported verbatim as the reference
example (`web-search-przyklad-oled-tv.md` / `.json` on the desktop; the
exporter lives in the session scratchpad as `export_chat.py`). What follows is
what the same conversation looks like from the planner's side: for each turn,
what the user asked, what was actually sent to the search engine, and what
came back. Every finding below was measured against the persisted rows, not
recalled from the screen.

| # | User asked | Planner sent | What went wrong |
|---|---|---|---|
| 335 | jaki jest najlepszy tv OLED? | `najlepszy tv OLED` | ✅ |
| 337 | Jaki jest najlepszy w stosunku do ceny? | `najlepszy telewizor OLED w stosunku do ceny` | ✅ topic carried |
| 339 | Ile kosztuje? | `cena LG OLED65B65LA` | ✅ referent carried |
| 341 | …wypisz jakie ma funkcje i parametry techniczne oraz powiedz czy sprawdzi się w salonie z dużymi oknami | `best TV for large living room features` + `TV technical specifications` + `TV suitability for large windows` | ⚠️ three English queries for a Polish question; no referent (LG OLED65B65LA), no OLED; US sources; the answer covered one aspect of three |
| 343 | A co z parametrami technicznymi? | `parametry techniczne Samsung QN90D` | ⚠️ referent jumped to a model the *previous answer* had introduced; passages were marketing copy, the "specs" in the answer were not specs |
| 345 | Podaj parametry techniczne tv samsung QE65QN90D | `parametry techniczne telewizora Samsung QE65QN90D` | ✅ |
| 347 | Jeszcze raz wyszukaj tv do mojego salonu najlepszy tylko oled | `najlepszy oled tv dla salonu` | ✅ |
| 349, 350 | Jaka jest jego cena? | — | ⚠️ no answer at all, twice (native crash, see [CHAT_UX_ISSUES.md](CHAT_UX_ISSUES.md)) |
| 351 | Jaka jest jego cena? | `cena samsung QE65S99H` | ✅ third attempt |
| 353 | Trochę za drogi znajdź tańszy spełniający moje wymagania | `tańszy telewizor podobny` | ⚠️ every constraint dropped (OLED, large room, windows, "cheaper than QE65S99H"); five "cheap TV" rankings; refusal |
| 355 | Czego dotyczy ta konwersacja? | — | ✅ correct recap without a search |
| 357 | Znajdź najlepszy model tv spełniający te wymagania | `najlepszy model telewizora OLED` | ✅ OLED recovered; ⚠️ badge shown, no Sources button |
| 359 | Dlaczego ten model najlepiej spełnia moje wymagania? | `Samsung QE65S99H benefits` | ⚠️ English; UK sources |
| 361 | W czym jest lepszy od innych modeli? | `Samsung QE65S99H vs other models` | ⚠️ English; UK sources |

Three of the fourteen answers open with a corrupted first word ("Zgodnieć z",
"Zgodniewniałem się") — that is native generation, not the prompt, and it is
tracked in the UX document.

### What the table says about the planner

⚠️ **The planner drifts into English when the question is long.** Both drifts
(#341, #359/#361) happen on questions that are either long or refer to an
entity by pronoun. The planner prompt is English, the few-shot examples are
English, and nothing in the pipeline checks that the query shares a language
with the question — `isLeakedQuery` and `regroundYears` look at content, not
language. A language-agnostic check is available: stem overlap between the
query's non-entity tokens (≥4 chars) and the question plus recent turns. Zero
overlap means the query was written in a language the conversation never
used; one planner retry with that correction, then the verbatim keyword
fallback that already exists.

⚠️ **The referent machinery is a word list, and it has gaps.**
[`DEMONSTRATIVE_MARKERS`](../utils/web/buildSearchQuery.ts) knows
tego/tej/tym/tych/that/those but not "jego", so "Jaka jest jego cena?" is a
literal search until the LLM planner happens to expand it — the user called
it a lottery, and #349–#351 shows why. The same list-based approach is what
produces #343: `mostRecentEntity` scans user turns first, then assistant
turns, and picks the *first* proper-noun run it finds in the last answer,
which was a model the assistant had mentioned in passing. The fix that does
not grow the list: the conversation subject is the entity most repeated in
the last answer (fallback: the last user-turn entity), an entity being a
capitalised run *or* a letters-plus-digits model token (`QE65S99H`,
`OLED65B65LA`). If neither the question nor the planner's queries contain
any entity or number and a subject exists, the subject is appended to every
query. That rule fires on "jego", on "cena", on "parametry" and on any
language, because it never looks at the words — only at the absence of a
referent.

⚠️ **The topic anchor is lost after one detour.** "OLED" is in turns 335,
337, 347 and 357, and the digest names it, but #341 and #353 send queries
without it and land on generic "best TV" and "cheap TV" pages. A
distinctive token — acronym, capitals, number shape — that recurs in two or
more user turns or in the digest is a topic anchor; when the planner's query
lacks every anchor, append them. This is the same shape of rule as the
subject rule above and shares its language independence.

⚠️ **Intent exists in the prompt but not in the pipeline.**
[`getIntentInstruction`](../utils/promptUtils.ts) already tells the model
"answer every one of them" for multi-part questions, and the planner returns
an `intent` string. Nothing downstream reads it. `selectRelevantContent`
decides what a "relevant" passage is with
[`PRICE_QUESTION` / `WHEN_QUESTION`](../utils/web/webResultsToContext.ts),
two Polish/English regexes — which is why #343's specs question was fed
marketing paragraphs: nothing asked the selector for number-and-unit
density. A closed intent enum from the planner
(`price | specs | comparison | recommendation | news | fact | howto | recap`)
would drive passage anchors (specs → number+unit density, price → money
anchor, comparison → two entities present) and the answer checks, and would
replace the two regexes with one language-neutral field.

⚠️ **Multi-aspect questions are answered on one aspect.** #341 asked for
features, technical parameters and suitability for a bright room; the answer
named three TVs and their prices. The planner's three sub-queries are the
aspect list. A coverage check — for each sub-query, do its stems appear in
the answer — is cheap, language-agnostic, and gives `nudgeOnce` a precise
instruction ("the answer does not address: …") instead of a generic retry.
Per-source relevance should use that source's own `sourceQuery` plus the
question, not the joined label `baseQueries.join(' + ')` that
`webResultsToContext` currently receives.

### Two UI inconsistencies with a mechanism

🔁 **A source badge with no Sources button.** #357 shows "Ranking Telewizorów
OLED 2026…" as the dominant-source badge and no Sources action on the
message. [`useMessageSources`](../hooks/useMessageSources.ts) builds
`displayedSources` by dropping web sources with `read === false`, then
`documentSources` as displayed ∩ used — while `dominantWebSource` is picked
from the *unfiltered* list. When the source the answer actually used was a
snippet-only hit (`read: false`, `used: true`), the badge sees it and the
button does not: [`canShowSourcesAction`](../components/chat-screen/MessageItem.tsx)
requires `documentSources.length > 0`. The fix is one predicate: a used
source is displayed regardless of `read`. Guard with a test that builds a
message whose only used source is unread and asserts both the badge and the
button agree.

🔁 **"3 searches become 5 pages" after re-entering the chat.** While the
search runs, the trace shows the real steps: one "Searching “…”" per planner
query, then the pages read. After leaving and re-entering, the saved block is
rebuilt by [`savedSteps()`](../components/chat-screen/webSearchTrace.ts) from
the persisted sources only: it takes the *first* source's `query` and emits a
single "Searching “<display question>”" step, then every source — read or
not — becomes a page row. The persisted rows do carry `sourceQuery` per
result and `searchedQuery` on the document, so the information is not lost,
only unused. Rebuild one step per distinct `sourceQuery`, page rows only for
`read: true`, failures as a note, and pass `animateRows: false` on a DB
replay so the entering animation does not fire for rows that were never new.
This is the same family as the two 🔁 entries under "Trace-panel regressions
that keep coming back": the live and saved shapes are hand-written twice.

### Plan, in the order it should be built

Each item lands with a test that is red without the fix; each is
language-agnostic by construction — no word lists, no per-language branches.

1. **P1.1 conversation subject** — most-repeated entity of the last answer,
   appended when the query has no entity/number. If the existing
   `NEEDS_REFERENT` / `DEMONSTRATIVE_MARKERS` / `ELIDED_*` tests all pass
   under the new rule, the regex lists go.
2. **P1.2 language-drift guard** — stem overlap between query and
   conversation; zero → one corrected planner pass → verbatim fallback.
3. **P3.7 badge ↔ Sources button** — used sources are always displayed.
4. **P2.6 nudge flicker** — the retry generates with streaming suppressed
   (`suppressUtilityStreaming` already exists for utility calls), the bubble
   shows a refining state, and the text is swapped once, only if accepted.
5. **P1.3 topic anchors** — recurring distinctive tokens appended when
   missing.
6. **P1.4 intent enum** — planner emits it, passage selection and answer
   checks consume it, `PRICE_QUESTION` / `WHEN_QUESTION` are retired.
7. **P2.5 aspect coverage** — one nudge naming the missing sub-queries;
   per-source relevance from `sourceQuery`.
8. **P3.8 trace rebuild** — steps from distinct `sourceQuery`, pages only for
   read sources, no replayed animations.

What is *not* in this list, on purpose: the five-source cap and the
`similarity` rank placeholder (`1 - index / used.length`) are known
approximations and documented as such; they are not what the conversation
tripped over.

## Content round: what a 300-character excerpt actually carried

The previous round looked at the planner's side of chat 55. This one looks
at the other end of the pipe: given the pages the Pixel conversation
actually read, what did `selectRelevantContent` put in front of the model?
The HTML of ten of those pages was saved (x-kom product page, jtk and p2p
spec pages, two ranking pages, SamMobile, DisplayRatings, MediaExpert ×2,
kitele) and replayed offline through `extractArticle` →
`selectRelevantContent` at two budgets: 700 chars, and 300 chars — the
per-source floor (`MIN_SOURCE_EXCERPT_CHARS`) that the 2048-token default
leaves once the system prompt, the history and the generation reserve are
taken out. At 2048 the 300-char case is not an edge case; it is what every
source gets.

| Page (turn) | Before, first 300 chars | After |
|---|---|---|
| x-kom product page (#339 "Ile kosztuje?") | "Kod producenta / OLED65B65LA / Kod x-kom / 1510638 / Rekomendowane akcesoria / Silver Monkey UT-800 / Cena: 229,00 zł / 229 / 00 zł Seagate Expansion … 159,00 zł …" — accessory prices, the TV's price absent | product header, "Przekątna ekranu : 65" Rozdzielczość : UHD 4K 3840 x 2160 Typ telewizora : OLED Klasa energetyczna : F", description lead; price from the verified JSON-LD line |
| jtk "Samsung QN90D: specyfikacja techniczna" (#343) | marketing lead, no spec row | lead sentence + "Częstotliwość odświeżania: 120Hz (do 144Hz) Rozdzielczość: 4K … Moc RMS: 70W … HDMI (High Frame Rate): 4K 144Hz" |
| p2p "QE65QN90D - parametry i specyfikacje" (#345) | prose about the series | "Częstotliwość odświeżania panelu \| 144 Hz", "Liczba wejść HDMI \| 4", "Przybliżona cena \| 6 100 zł" |
| prorankingi "Ranking Telewizorów OLED 2026" (#347) | only the first of five `<article>`s was ever extracted (1 482 of 15 598 chars) | all five items extracted; at 700 chars the excerpt opens with "Najlepszy telewizor OLED to Samsung QE65S99H…"; at 300 chars it is the "salon z dużymi oknami" paragraph about the LG G4 — on topic, but the #1 pick is gone (see below) |
| SamMobile S95H vs S99H (#361) | "Best Samsung Watch in 2026" (the related-links rail) then the lead | the lead |
| zestawienie ranking (#347) | comparison table rows | the same rows plus "Jaki rozmiar telewizora OLED wybrać do salonu?…" |

The gap between the two columns came from six defects, each of them
reproducible offline and each now guarded by a test that is red without the
fix (`__tests__/webResultsToContext.test.ts`, `__tests__/extractArticle.test.ts`):

1. **Price hunting was entity-blind.** `PRICE_QUESTION` turned on a bonus
   for *any* money anchor, so on a shop page the accessory rail (six prices
   in 300 chars) out-scored the product. When JSON-LD verified the product
   price, the excerpt still hunted. Now a verified price switches hunting
   off and any passage naming a *different* amount (0.5 % tolerance) scores
   zero. Guard: "stops hunting prices in the body once the product price is
   verified" / "still hunts the price in the body when nothing verified it".
2. **Spec rows could not win.** "Rozdzielczość: 4K" contains none of the
   query's stems, and its digits were penalised as non-prose. Record-shaped
   lines (`key: value`, `key | value`) in a run of at least two, whose key
   repeats at most twice on the page, are credited with the needles the
   *page title* carries and scored as prose — only when the title names the
   subject, so a generic news page gets no credit. Guard: "brings the spec
   rows of a page titled after the subject into the excerpt" / "leaves the
   spec rows out when the page title says nothing about the subject".
3. **Title words were paid twice.** On "Samsung QN90D: specyfikacja
   techniczna" every passage mentions Samsung, so the needle discriminated
   nothing and drowned the rarer ones. Needles present in the title are
   worth half inside passages.
4. **The lead bonus went to metadata.** Shop pages open with a run of
   one-word lines (brand, model, "Zobacz recenzje", "100 %"); coalesced into
   one passage it took the full `LEAD_BONUS`. Only a passage that ends like
   a sentence takes it. Guard: "does not hand the lead bonus to a metadata
   run at the top of the page".
5. **Sentences were cut mid-word** every 320 chars ("eleme"), which the
   model then completed from its prior. The cut moves back to the last
   space when that keeps at least half the slice. Guard: "cuts an over-long
   sentence at a word boundary".
6. **The snippet was free and often redundant.** The SERP snippet was
   appended on top of the budget, and on most pages it is the meta
   description — a sentence the excerpt already contains. It now counts
   against the source budget, is dropped when 60 % of its distinctive
   tokens (and every figure) already appear in the excerpt, and the share
   reserved for a dropped snippet goes back to the excerpt.

And one upstream of the selector, in `extractArticle`:

7. **Main-content isolation was first-`<article>`-or-everything.** A
   ranking page with one `<article>` per item lost items 2–5; a shop page
   with no landmark at all started at the promo rail; `role="main"` was
   ignored. Order now: a single `<article>`, `<main>`, `role="main"`, all
   articles joined, and for a bare body a cut at the first `<h1>` when at
   least 20 % of the visible text follows it. Guards in
   `extractArticle.test.ts` under "main-content isolation on pages without a
   single landmark".

### What is still weak, and why it was left

⚠️ **Ranking items are prose, not records.** "Miejsce 1 / Samsung QE65S99H"
is two short lines with no query stem in them; the paragraph that follows
says "najlepszy" — a needle so common on a ranking page that idf makes it
worthless — and the one that mentions "salon" wins. At 300 chars the
prorankingi excerpt therefore names the LG G4 paragraph and not the winner.
The fix is not a bigger lead window; it is the `recommendation` intent from
P1.4 anchoring on ordinal + entity ("1.", "Miejsce 1", "#1", "TOP") so a
ranked headline and its first sentence form one credited unit, the same way
spec rows do for `specs`.

⚠️ **The planner's language, not the page, decided #341/#359/#361.** Three
English queries for a Polish question returned US/UK pages; no amount of
excerpt selection turns those into a Polish answer about the LG B6. That is
P1.2 and is untouched here.

⚠️ **Split price markup produces phantom amounts.** x-kom renders "6 999,00
zł" as `6 999` + `00 zł` in two spans; the extractor emits them as two lines
and `MONEY_ANCHOR` reads "6 999\n00 zł" as 699 900. With a verified price the
passage is dropped (it names an "other" amount), which is the right outcome
for the wrong reason; without one it is a wrong figure in the context. A
language-agnostic join — a digits-only line followed by a `NN <currency>`
line is one amount — belongs in the extractor.

⚠️ **Fillers accept any score above zero.** After the scored passages, the
budget is topped up with the next passages in reading order; on x-kom that
put "Logitech K270 Wireless Keyboard" into the 300-char excerpt because it
contained a digit. A filler floor (at least one needle, or a credited
record) is a one-line change waiting for a test that shows it matters.

⚠️ **Per-source relevance still uses the joined label.** `webResultsToContext`
scores every page against `baseQueries.join(' + ')`; for #341 that is three
English sub-queries glued together, and the idf weights are computed over
that union. The persisted `sourceQuery` per result is the right query for
that result (P2.5).

⚠️ **Sources that were never read are still marked used** (#346, #358 —
snippet-only hits with `read: false, used: true`), which is what produces the
badge-without-button inconsistency (P3.7). The content round did not touch
attribution.

How to keep this from regressing: the ten saved pages are not in the repo
(they are copyrighted shop and review pages), but every defect above is
reproduced by a synthetic fixture in the two test files, and the fixture
shapes — accessory rail, metadata run, spec table with `:` and `|`
separators, ranking with several `<article>`s, promo rail before the `<h1>`
— are the shapes to reach for when a new page misbehaves. Add the page's
shape as a fixture; do not tune the constants to the page.

## Landing round: the plan above, built

Every item of the plan is on `web-search-compact`, each as its own commit
with a test that fails without it. Where the build deviated from the plan,
the deviation and its reason are here so nobody "fixes" it back.

| Plan item | Commit | Test |
|---|---|---|
| P1.1 conversation subject | `881f27c` | `__tests__/conversationDigest.test.ts` |
| P1.2 language-drift guard | `f2a89e6` | `__tests__/runWebSearch.test.ts` |
| P1.3 topic anchors | `8e9c598` | `__tests__/buildSearchQuery.test.ts` |
| P1.4 intent kind | `04f0bf2` | `__tests__/webResultsToContext.test.ts` |
| split-price join | `6360228` | `__tests__/extractArticle.test.ts` |
| filler floor | `9bc8108` | `__tests__/webResultsToContext.test.ts` |
| P2.5 per-source relevance | `fb0c77d` | `__tests__/webResultsToContext.test.ts` |
| P2.5 aspect coverage nudge | `2e0433d` | `__tests__/aspectCoverage.test.ts`, `__tests__/llmStore.test.ts` |
| P3.7 badge ↔ Sources button | `6384d12` | `__tests__/useMessageSources.test.ts`, `__tests__/MessageItem.test.tsx` |
| P2.6 nudge flicker | `996636d` | `__tests__/llmStore.test.ts`, `__tests__/MessageItem.test.tsx` |
| P3.8 trace rebuild | `dffd8dc`, `a675171` | `__tests__/chatRepository.test.ts`, `__tests__/webSearchTrace.test.ts` |

**P2.6 — the retry's metrics are thrown away.** With streaming suppressed
the store's `firstTokenTime` still belongs to the first generation, so the
retry's TTFT would come out negative. The bubble keeps the first answer's
ttft/tps: they describe the generation the user watched. The dangling-list
continuation still streams — there, appending is the point.

**P3.8 — `searchedQuery` is gone; `sourceQuery` is on the row.** The
earlier entry above says the persisted rows "carry `sourceQuery` per result
and `searchedQuery` on the document". Half true: `sourceQuery` lived on the
in-memory result only, and `searchedQuery` (the ' + '-joined label) was
dropped by `parseSourceDocuments` on reload and read by nobody. Each source
row now records the query that found it, the parser keeps it, and
`savedSteps()` emits one step per distinct value in saved order.

**P3.8 — "pages only for `read: true`" became "not both unopened and
unused".** P3.7 made a listing-only source the model cited (`read: false,
used: true`) a displayed source; the trace follows the same rule so the
badge, the Sources sheet and the trace name the same pages. Rows saved
before the `read` flag existed keep showing. Fetch failures are not
persisted, so a replayed trace carries no failure note — only the live one
can say why a page could not be read. `animateRows={false}` on replay was
already in place.

**P2.5 — the coverage nudge is the last in the chain.** Wrong language,
question echo, missing evidence and circular answer still take precedence;
one nudge per turn. The nudge names the sub-queries whose distinctive stems
appear in the context but not in the answer; a sub-query with no stem of its
own (`pogoda Kraków` vs `pogoda Kraków weekend`) is judged on the stems it
does not share, and stopwords (`jutro`) are not stems, so a fixture that
relies on one silently tests nothing.

What to watch on the Pixel, in order: (1) a two-part question
("porównaj kurs bitcoina i ethereum") — the trace shows two searches, both
pages, and the answer covers both or a single "Refining…" pass appears
under the first answer without the text doubling; (2) leave the chat and
come back — the trace still shows the two searches and only the pages that
were read or cited; (3) a source badge always comes with a Sources button;
(4) a shop page at the 2048 default — the excerpt carries the price line,
not an accessory rail.


## Pixel round on the landing round: S8 on the reference model, and what it moved

Run on 2026-09-04 by a separate test session (plan and results are untracked
working sheets: `docs/WEAK_MODEL_TEST_PLAN.md`, `docs/WEAK_MODEL_TEST_RESULTS.md`,
evidence in `docs/test-evidence/gemma-4-2b/`). Pixel 10, Gemma 4 - 2B, build
versionCode 68, HEAD `ee8005a`. S1–S5 (20 graded turns) plus the S8 gate;
the ten weak models were not started because S8 went red on the reference,
which is what the plan says to do.

### S8 on Gemma 4 - 2B

| # | Fix | Result | What was actually wrong |
|---|---|---|---|
| 1 | P1.1 conversation subject | pass | — |
| 2 | P1.2 language-drift guard | fail (partial) | the *query* stayed German; the *answer* came back English — a generation drift past the guard, see below |
| 3 | P1.3 topic anchors | pass | — |
| 4 | P1.4 intent kind | fail | nothing was ever logged; the feature had no dev-log line, so the row could not be graded |
| 5 | split-price join | pass | — |
| 6 | filler floor | pass | — |
| 7 | P2.5 per-source relevance | pass | — |
| 8 | P2.5 aspect coverage | pass | first draft already covered both coins; no nudge, correctly |
| 9 | P2.6 refining without flicker | pass | four nudged turns, one swap each |
| 10 | P3.7 badge ↔ Sources | pass | — |
| 11 | P3.8 trace rebuild | fail | the rebuild never ran: the previous search's live trace survived the chat switch and rendered every surfaced result |

### Shared-code findings from S1–S5, and the commits that answer them

| Finding (results file §"Znaleziska") | Commit |
|---|---|
| needs-search gate wrong both ways: S1.4 skipped a spec question naming a model code; S2.6/S5.2 searched recap questions with the raw question as the query | `a7a3642` — a code-like token or a ≥3-digit number forces the search; recap / previous-answer intents count as conversational, with two planner examples |
| no `intent:` log line (S8.4) | `f06f389` — one dev-only "Web search plan" line: needs_search, kind, intent, queries, expects |
| `groundingCaveats: ["figure"]` false positive on an exact match (S1.5, S8.7) | `0c9a6b2` — a page figure without a currency token beside it still grounds the answer |
| our own plumbing in the answer: "według Ile mieszkańców ma Warszawa…," (S4.1) and "[Answers: …] -" (S3.1) | `c50f811` — a cited web source is named by host; copied block labels are stripped |
| ten page rows on reopen (S8.11) | `98ec275` — the live trace is cleared when another chat opens, unless a search is running |
| evasive price answer with the amount on the page (S1.8), refusal in a language no phrase list covers | `74d8def` — the absence claim is structural: figure wanted, figure in context, none in the answer |

### The rest of this round, driven by the same evidence and the intent research

| Change | Commit | Why |
|---|---|---|
| `place`, `person`, `event` intent kinds; "search when" list names model codes, position holders, versions, hours | `5bede3d` | the Li & Roth classes we lacked (LOC, HUM, ENTY:event) are where a 2B model answers from memory |
| listing ranking by intent kind and scoped year — the nine-language quantity list, the period/superlative markers and the all-time page pattern are gone | `ddb0a4b` | the last per-language rules in the search path; the year the planner writes into its queries carries the period scope instead |
| `expects`: the plan names 1–4 things a complete answer must contain; their stems join the passage needles | `0ea625d` | a kind names the shape of the evidence, not the thing; "data premiery" credits the launch-date sentence the question never named |
| refined answer crossfades; `isRefining` clears at the complete/failed phase | `2a79253` | the single swap read as a glitch |
| loop guard extracted to its own PR | [#311](https://github.com/software-mansion-labs/private-mind/pull/311), issue #255 reopened | not web-search work; #289 named it as the follow-up to the penalty revert |

### Still open after this round

⚠️ **S8.2 — German question, English answer, German sources.** `sourceQuery`
stayed German, the used source was German Statista, and the answer was
English. `isWrongLanguageAnswer` compares detected languages and should
have nudged; the dev log for that turn was lost with a debugger teardown,
so whether the nudge fired and the retry stayed English is unknown. Next:
reproduce with the log intact; if the retry also drifts, the wrong-language
retry needs the target language named in the prompt (`answerLanguageAnchor`
already does when detection succeeds — check what it detected).

⚠️ **Verbatim query for a conversational question.** When the gate fires on
a question that only refers to the conversation, the query is the raw
question. The recap intents now short-circuit that path; a question about
the conversation that the planner does not label as such still reaches
search. No language-agnostic lexical test separates "what did you say" from
a genuine topic change; the planner is the right tool, and the two examples
are the lever.

⚠️ **Price conflicts across shops (S1.1).** Ceneo 6299 PLN (`read: false,
used: true`) vs MediaMarkt 6999 zł (`read: true`). The answer took the
listing's figure. Whether a "[Verified product data]" passage should count
as read for the retrieval-hit rule is a plan question, not a code one, and
is left to the next test round.

⚠️ **S3.2 — the coverage nudge made the answer shorter.** Three aspects asked,
one answered, the retry answered one differently. The nudge names the
missing aspects; the model's retry dropped the one it had. Whether keeping
the first draft when the retry covers *fewer* distinctive stems is the
right rule is worth a fixture from msg 396.

The window stays at 2048: the note in `constants/model-profiles.ts` and the
"A 4096-token window works, and makes the answers worse" section above
still hold, and this round changed nothing there.

## Minimal round on the landing round: the toggle, the empty search, the first token

The eleven-turn minimal test (`docs/WEAK_MODEL_TEST_MINIMAL.md`, results in
the tester's file) came back 9/11 FAIL with one headline: the planner logged
"Web search plan" twice in the whole session and never again. Read from the
database snapshots and the device, that is two separate things, neither a
gate limit.

### Seven of the nine were the Web toggle

The Web toggle is per chat, in memory, default off
(`useWebSearchStore.enabledByChat`, `isEnabled(chatId) ?? false`), and the
tester enabled it once, in chat 64, before T1. T3–T11 each opened a new
chat and never touched it — `chatSettings` for chats 65–72 carry no web
state, and the tester's own screenshot of T11 shows the slashed globe. With
the toggle off, `shouldRunWebSearch` is false before the planner exists, so
no plan line, no "Searching the web…", no sources. The minimal test now says
so in its rules: **Web on in every new chat, and again after any JS reload**
(a reload drops the in-memory map — this session lost it to a Fast Refresh).

Whether the toggle should follow the user across chats instead is a product
question and is left as one; the code does what it was written to do.

### T1 and T2: the plan ran, the search found nothing, and nobody said so

T1 (`Jaką częstotliwość odświeżania ma Samsung QE65QN90D?`) reproduced on
the Pixel with the new JSON logs:

```
Web search plan {"needsSearch":true,"kind":"comparison","intent":"find refresh rate for TV",
  "queries":["Jaka czestotliwosc odswiezania ma Samsung QE65QN90D"],"expects":["refresh rate in Hz"]}
Web search outcome {"results":0,"withContent":0,"confidence":0,"label":"incorrect",
  "rounds":[{"queries":["Jaka czestotliwosc odswiezania ma Samsung QE65QN90D"],"results":0,...}],"fetchFailures":[]}
```

The planner wrote English queries for a Polish question, the language guard
threw them out, the retry drifted too, and the plan degraded to the verbatim
question — a full sentence with a model code, which the engine answered with
zero results. The verbatim rescue in round 1 does not apply (the verbatim
query *was* the plan), fetch recovery has nothing to recover from without
results, so the turn ended with an empty context and a refusal. Three
changes:

- `WebSearchPlan.fallbackQueries` — the planner's own queries that the
  language guard or the leak filter discarded, grounded through the same
  pipeline (years, referent, topic anchor, site restriction), minus any
  already planned. Attached whenever they differ from the plan.
- a zero-result rescue in round 1: when the planned queries (verbatim rescue
  included) find nothing, the fallback queries run before grounding. The
  script filter still applies, so a Latin-script English page for a Polish
  question is kept, a Cyrillic one is not. Test: `runWebSearch` "searches the
  planner's discarded queries when the verbatim question finds nothing".
- the two dev log lines are JSON strings, not objects — the RN console
  flattens an object to `Object`, which is why the tester could read
  neither the plan nor why T1 came back empty. `Web search outcome` adds
  results, content count, confidence/label, per-round counts and fetch
  failures as `host:reason`.

T2 (`Czego dotyczyła ta rozmowa?`) searched because the planner did not
label it and `isAboutTheConversation` did not match; the recap was correct
anyway because the context was empty. Same open item as before: the planner
examples are the lever, not a phrase list.

### The first token, measured

Three recorded sends found no clipped first line but a deterministic jump at
the first token, different in each path; the mechanism and the fix are in
`docs/CHAT_UX_ISSUES.md` ("The first line of a streaming answer starts under
another component"). In short: model name from the start of the turn,
"Thinking…" in flow where the answer will start, trace block kept on the last
message while its live trace exists.

### Seen once, not chased

- **French answer to a Polish question typed without diacritics**, three
  out of three sends (`Jaka czestotliwosc odswiezania ma Samsung QE65QN90D?`
  → "Je suis désolé…", "Je n'ai pas d'informations…", "La fréquence de
  rafraîchissement…"), with and without sources, never a wrong-language
  line in the log. Mechanism: `detectQuestionLanguage` finds no Latin
  candidate in an ASCII-only Polish sentence and returns null, and
  `isWrongLanguageAnswer` returns false on a null expectation — so there is
  no language anchor in the prompt and no check on the answer. Real users
  type diacritics (the tester's German T8 answered in German first time),
  so this is filed, not fixed. A language-agnostic route when the question
  is undetermined: expect the thread's last detected language, and failing
  that treat a confidently detected answer language that shares no
  function words with the question as wrong. Fixture: the three answers
  above against the ASCII question.
- **`kind: "comparison"` for a single-model spec question.** Wrong class,
  harmless here (no results to rank), but the ranking would have skipped
  the figure bonus that `specs` gets.

