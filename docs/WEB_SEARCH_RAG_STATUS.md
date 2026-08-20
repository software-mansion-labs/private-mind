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
Verify: [__tests__/modelProfiles.test.ts](../__tests__/modelProfiles.test.ts)
(F13) — a general check that fails for ANY model whose evidence says
verbatim outperformed it while the matrix still says `'llm'`, not just this
one. Confirmed live: the in-progress "Searching '...'" line now shows the
literal user question verbatim (previously it showed a separate, sometimes
mutated, LLM-generated query).

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
for `Qwen 3 - 1.7B`, because *this model's own* planner implementation is
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
always a truncated *prefix* of `safeContext`, the whitelist is now
guaranteed to be a subset of what the model actually sees, for every call
site.
Verify: [__tests__/promptUtils.test.ts](../__tests__/promptUtils.test.ts) —
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
[__tests__/promptUtils.test.ts](../__tests__/promptUtils.test.ts) (F21).
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
Verify: [__tests__/figureGrounding.test.ts](../__tests__/figureGrounding.test.ts)
and [__tests__/messageSources.test.ts](../__tests__/messageSources.test.ts),
both asserting against the literal captured failure text ("The price of 1
USD in euros is 1.00.").
Live status: confirmed the caveat pipeline is wired end to end (full
suite/tsc/eslint clean, no regressions), but several live re-tests this
round did not reproduce the exact original wrong-figure text again — the
model's output for this question shape is highly non-deterministic run to
run (seen instead: an honest "no specific price found" refusal, a
different fabricated figure not shaped like "1:1", and once a raw
instruction-text leak unrelated to conversion at all — see the note
below). So this is unit-verified against the exact captured failure, and
wired correctly, but not live-reconfirmed to the same standard as the
blank-screen fix below — flagged honestly rather than claimed as a full
live-verified fix.

🔧 **New, unrelated finding along the way: raw instruction text leaking
into a visible answer**
While repeatedly re-testing the conversion follow-up above, one run
produced: *"$1. 366 stands far apart from the other figures found — that
is more likely a filter default, shipping cost, financing installment, or
an unrelated listing than this product's actual price. Do not use it as
the low (or high) end of a range, or as "the" price, unless the source
text explicitly ties it to this exact product..."* — this is the model
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
[__tests__/promptUtils.test.ts](../__tests__/promptUtils.test.ts) (F19).
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
[__tests__/listingRelevance.test.ts](../__tests__/listingRelevance.test.ts)
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
  page layout puts a "customers also viewed" carousel of *other* iPhone
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
    [__tests__/contextBudget.test.ts](../__tests__/contextBudget.test.ts)
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
    [__tests__/promptUtils.test.ts](../__tests__/promptUtils.test.ts) (F11).
  - Confirmed live on-device: the same question ("Ile kosztuje iPhone 17
    Pro 256GB w Polsce?") now answers "5099,00 zł" — the real price — with
    Sources still correctly populated.
- `findUngroundedFigures`'s price-statement extraction
  ([utils/web/figureGrounding.ts](../utils/web/figureGrounding.ts)) prefers
  figures actually governed by the word "price"/"cena" over any currency
  figure in context — real and tested
  ([__tests__/figureGrounding.test.ts](../__tests__/figureGrounding.test.ts)),
  but wasn't the fix here: Polish e-commerce pages write "od X zł" ("from
  X zł"), not "cena: X zł", so the tight extraction found nothing and fell
  back to the loose match — which can't distinguish the target product's
  price from a decoy's on its own. Still useful for pages that DO write
  "cena: X zł" directly.

✅ **Fabricated figure-verification caveat, confirmed on a live Amazon case**
Scenario: asked for the price of Sony WH-1000XM5 headphones on Amazon, the
answer stated **$278** — a number not present in any retrieved source (the
sources say $150 "lowest price ever" and "nearly 40% off"). The
⚠️ *"A figure in this answer could not be verified against the retrieved
sources"* caveat correctly fired, with Sources still populated so the user
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
whenever 3+ distinct figures are found for one unlabeled product: *"These
are prices for different variants or listings of the same product, not one
figure to quote directly — do not list them out. Respond with ONLY a range
(lowest to highest) or ONLY the single most relevant one."* Two figures
(e.g. current vs. previous price) don't trigger it, since stating both is
usually the right answer there.
- First attempt used softer wording ("state a range... not every one as a
  list") — live-tested, and the model added a range but ALSO kept the full
  list ("...$65, $64, $102, ... The lowest price is $64 and the highest is
  $160."). Strengthened to the imperative "do not list them out... ONLY a
  range" above, which live-tested clean: "The prices for Nike Air Max 90
  shoes on Nike.com range from $65 to $160." — no list, no caveat.
Verify: [__tests__/promptUtils.test.ts](../__tests__/promptUtils.test.ts)
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
fix) got a *different* third outcome: a Polish, sourced-looking answer —
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
Verify: [__tests__/figureGrounding.test.ts](../__tests__/figureGrounding.test.ts)
(F15 — `splitPriceOutliers`, both a low and a high outlier, and the Nike
listing as a true-negative); [__tests__/promptUtils.test.ts](../__tests__/promptUtils.test.ts)
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
to *infer* which number in that prose was the actual price, with layered
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
Verify: [__tests__/extractArticle.test.ts](../__tests__/extractArticle.test.ts)
(single Product/Offer with normalized availability, array-wrapped offer,
multiple disagreeing offers, a multi-product category page, OG-tag fallback,
no structured data at all, a `Product` nested in `@graph`);
[__tests__/enrichResults.test.ts](../__tests__/enrichResults.test.ts)
(propagation onto the enriched result);
[__tests__/webResultsToContext.test.ts](../__tests__/webResultsToContext.test.ts)
(the marker line renders only with a price present);
[__tests__/promptUtils.test.ts](../__tests__/promptUtils.test.ts) (F16 — the
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
containing zero currency figures at all is the *strongest* ungrounded case,
not a reason to wave a stated figure through. Every earlier fix in this
file targeted "wrong figure among several real ones in context"
(installment vs. price, a filter-widget default, a different asset); this
is the first case of "context has no price data whatsoever, yet the model
still states one."
Fix: `contextFigures.length === 0` now returns every figure the answer
states, instead of `[]`. Verify:
[__tests__/figureGrounding.test.ts](../__tests__/figureGrounding.test.ts)
(replaces the old "returns nothing" test, which asserted the previous,
backwards behavior, with one asserting the answer's figure is flagged; a
second test covers the still-correct "answer states no figure either" case
alongside it);
[__tests__/messageSources.test.ts](../__tests__/messageSources.test.ts)
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
newly-added reminder was the only *unconditional* new instruction line this
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
Verify: [__tests__/promptUtils.test.ts](../__tests__/promptUtils.test.ts) —
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
Verify: [__tests__/extractArticle.test.ts](../__tests__/extractArticle.test.ts)
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
[__tests__/messageSources.test.ts](../__tests__/messageSources.test.ts) —
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
[__tests__/promptUtils.test.ts](../__tests__/promptUtils.test.ts) (F18).
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
exactly the shape those two detectors were built to catch the *absence* of
punctuation for, not a *presence* of structural separators between longer
repeated units. `truncateAtRepeatedClause` operates at the clause level and
likewise wasn't built for a unit this long recurring across structurally
distinct list items — a genuine fourth granularity in the loop-detection
family, not a variant of an already-covered case.
A candidate fix (`findRepeatedClauseCycle`, generalizing the existing
single-clause check to a *cycle* of 2–4 distinct clauses repeating 3+
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
[__tests__/loopDetection.test.ts](../__tests__/loopDetection.test.ts);
confirmed live — the same question stopped looping after the fix.

✅ **Multi-word phrase loop with no punctuation between copies**
Scenario: the single-word fix generalized one level up — a model can just
as easily loop on a short *phrase* ("bardzo dobrze bardzo dobrze bardzo
dobrze...") with no punctuation between repeats, which neither the
clause-level nor the single-word check can see (each word alone isn't
repeating — the pair is).
Verify: `findRepeatedPhraseRun` in
[utils/loopDetection.ts](../utils/loopDetection.ts) — scans 2–5-word
windows and flags one repeated 3+ times back-to-back, gated by a minimum
combined phrase length so short connector pairs ("no i", "tak jak") can't
trip it on ordinary prose. Covered by
[__tests__/loopDetection.test.ts](../__tests__/loopDetection.test.ts)
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
[__tests__/messageSources.test.ts](../__tests__/messageSources.test.ts) —
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

## Citations / Sources

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
  [__tests__/messageSources.test.ts](../__tests__/messageSources.test.ts);
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

💡 **Proposed / to monitor**
- Watch whether "trust present sources on zero overlap" starts showing
  sources on genuine refusals in languages other than PL/EN (the refusal
  regex only covers those two) — needs more live testing.
- A refusal phrasing using the participle "zapisan-" (e.g. "nie jest
  zapisana w...") was observed slipping past `looksLikeNoAnswer` during
  weather-category testing; not added to the regex list yet — avoiding
  further case-by-case regex whack-a-mole in favor of a more general
  refusal-detection approach if this keeps recurring.

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
[__tests__/promptUtils.test.ts](../__tests__/promptUtils.test.ts);
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
Verify: [__tests__/startPhantomChat.test.ts](../__tests__/startPhantomChat.test.ts)
— asserts `router.replace` is not called before the delay elapses, and
that `'push'` is unaffected. Confirmed live: reproduced the original
failure signature 5 times in a row post-fix (tap "New chat" → immediately
send a web-search question) — `debugger-log-registry` showed zero
`Can not attach worklet handlers` warnings and zero "Access to closed
resource" errors across all 5 navigations, and all 3 attempts that
actually reached "send" (2 were lost to unrelated test-harness timing, not
app bugs) rendered their finished answers correctly. Previously this
reproduced on effectively the first or second attempt.

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

*A later round fixed the blank-screen bug above with confidence (the 50ms
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
detectors catch, since no exact clause, word, or phrase repeats verbatim.*

*A later round fixed both findings flagged above. The anachronistic-player
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
throughout keeps winning.*
