# Weak-model test plan — web search and RAG below 2B

Every number in [WEB_SEARCH_RAG_STATUS.md](WEB_SEARCH_RAG_STATUS.md) comes
from two models: the 178-conversation corpus is Qwen 3 - 1.7B, and the OLED
reference conversation is Gemma 4 - 2B on the Pixel 10. The catalogue ships
thirteen more, most of them smaller, and `WEB_PLANNER_MATRIX` gives nine of
them the `llm` planner on no evidence at all. This plan is how a model earns
(or loses) `webSearchReady`, its planner mode, and its generation reserve —
with the pass criteria written down before the run, so the result cannot be
argued into shape afterwards.

## Scope

**Under test** (≤ 2B, no entry or a thin one in `PLANNER_EVIDENCE` /
`WEB_ANSWER_EVIDENCE`):

| Model                      | Planner today                     | Evidence today                                 |
| -------------------------- | --------------------------------- | ---------------------------------------------- |
| Qwen 2.5 - 1.5B            | llm                               | none                                           |
| LLaMA 3.2 - 1B - QLoRa     | llm                               | none                                           |
| LLaMA 3.2 - 1B - SpinQuant | llm                               | none                                           |
| LFM 2.5 - 1.2B             | llm                               | none                                           |
| LFM 2.5 VL - 1.6B          | llm                               | none                                           |
| Bielik - v3.0              | llm                               | none                                           |
| Gemma 4 VL - 2B            | llm                               | none                                           |
| Qwen 3 - 0.6B              | verbatim                          | planner only (2/72 parsed)                     |
| LFM 2.5 VL - 450M          | verbatim                          | planner only (echoed the few-shot)             |
| Qwen 2.5 - 0.5B            | verbatim, `webSearchReady: false` | 33 % correct — re-run only to confirm the gate |

**Reference**: Gemma 4 - 2B — the best end-to-end run so far — runs the same
series once so every weaker model is read against the same bar on the same
day, the same SERP and the same build. Qwen 3 - 1.7B has its corpus and does
not need to run again unless a criterion below changes.

**Out of scope**: the 3B models (a different memory class, gated at 8 GB) and
anything the planner does with a _longer_ context window. Everything here
runs at the 2048-token default because that is what a weak model is shipped
with.

## Preconditions — before any conclusion is drawn from the device

The Pixel 10 (`56211FDCR005KT`) is shared between checkouts and both
contaminations below have already produced a wrong conclusion once.

1. The device is loading **this** checkout's bundle:
   `adb -s <serial> reverse --list` shows `tcp:8081 tcp:8081`, and Metro on
   8081 is the one started from this directory (see the memory note on
   parallel checkouts). A Fast Refresh that changes nothing on screen is the
   usual symptom of the other case.
2. The installed build is the one you think it is:
   `adb -s <serial> shell dumpsys package com.swmansion.privatemind | grep -E 'versionCode|lastUpdateTime'`.
3. Settings: context window at the 2048 default, the model under test
   selected and fully loaded (wait for the first token of a throwaway
   message), web search on, embedding model present so the "download search
   model" sheet cannot interrupt the first turn.
4. The LogBox banner is dismissed. It covers the Web toggle row and a tap
   meant for the toggle lands in the banner — the turn then runs without a
   search and looks like a planner failure.
5. Record the SERP: the engine is not deterministic across days. Every
   graded turn keeps its `sourceQuery` list and the URLs read, from the
   database, next to the grade. A failure is reproducible only with those.
6. One chat per series per model, started fresh. Never grade a turn that
   followed a native crash or a "Failed to generate a response." — the
   history it saw is not the history the spec assumes.

## The series

Same questions, same order, for every model. Questions are fixed strings;
do not paraphrase between models. The answer language must be the
question's language — that is graded, not assumed.

### S1 — single-hop facts, web on (8 turns, one chat)

| #   | Question                                                   | What is graded                                                                              |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Ile kosztuje LG OLED65B65LA?                               | a złoty amount within 10 % of the verified shop price in the sources                        |
| 2   | Jaki jest kurs euro do złotego?                            | a rate 4.0–4.6 that appears in the sources                                                  |
| 3   | Kiedy odbył się ostatni lot testowy Starship?              | a date present in the sources, not a pretraining-era one                                    |
| 4   | Jaką częstotliwość odświeżania ma Samsung QE65QN90D?       | 120 or 144 Hz with the unit                                                                 |
| 5   | What is the gold price per ounce in USD today?             | a USD amount present in the sources; a refusal is a fail                                    |
| 6   | Who is the current prime minister of the United Kingdom?   | the name the sources give, not the predecessor (stale-prior trap)                           |
| 7   | Jaka jest dziś pogoda w Krakowie?                          | temperature from the sources; "jutro" content is a known contaminant, so ask for today only |
| 8   | Ile kosztuje karnet dzienny w Zakopanem w sezonie 2026/27? | a PLN amount from the sources; refusal over evidence is the failure mode being measured     |

### S2 — follow-ups on one subject, web on (6 turns, one chat)

Replays the shape of the Pixel OLED conversation with the turns that broke.

| #   | Question                                           | What is graded                                                   |
| --- | -------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Jaki jest najlepszy telewizor OLED do salonu?      | at least one named model                                         |
| 2   | Ile kosztuje?                                      | the price of the model named in turn 1 — referent carried        |
| 3   | Jakie ma parametry techniczne?                     | ≥ 2 spec figures with units, about the same model                |
| 4   | Czy sprawdzi się w jasnym salonie z dużymi oknami? | an answer about brightness/reflections for that model, in Polish |
| 5   | Znajdź tańszy model spełniający te wymagania.      | a different, cheaper model; "OLED" still in the query sent       |
| 6   | Czego dotyczyła ta rozmowa?                        | correct recap, **no search fired**                               |

### S3 — multi-part (2 turns, one chat)

| #   | Question                                                       | What is graded                                          |
| --- | -------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | Podaj cenę iPhone 17 Pro w złotych i w euro.                   | both currencies present; a made-up conversion is a fail |
| 2   | Wypisz funkcje, parametry techniczne i wady Samsunga QE65S99H. | all three aspects present, not one                      |

### S4 — language fidelity (4 turns, one chat)

The same question in four languages; the answer must come back in the
language it was asked in, and the query sent must share a language with
the question (`sourceQuery` in the database).

1. Jaka jest populacja Warszawy?
2. What is the population of Warsaw?
3. Wie viele Einwohner hat Warschau?
4. ¿Cuál es la población de Varsovia?

### S5 — no search expected (2 turns, appended to S4's chat)

1. Dzięki, to wszystko.
2. Was the first answer you gave me in Polish?

Graded: no search fired, no sources attached, a sensible reply.

### S6 — pressure: sixteen mixed turns (only for models that pass S1–S5)

One chat, web on for twelve turns and off for four, containing on purpose: a
pronoun follow-up, a topic change mid-way, a question that refers to a turn
eight turns back, and a question that must not trigger a search. The point
is the digest and the trimming under 2048 tokens, not any single answer:
grade per turn whether the model still knows what the conversation is about,
and log every prompt overflow, every `smartTrimContextBlocks` drop and every
memory kill.

### S7 — document + image (VL models only: LFM 2.5 VL - 1.6B, Gemma 4 VL - 2B)

Materials on the device: `/sdcard/Download/raport-kwartalny.txt` (Q2
14 720 000 zł, Q1 11 340 000 zł, profit 3 630 000 zł, 148 people, margin
30.8 %) and `/sdcard/Pictures/wykres_q2.png` (the same figures as a bar
chart). Scenarios: document only, image only, document × image
cross-question, document + web (an internal figure against an external
fact), and optionally an image with a deliberately different figure to see
whether the model notices the conflict and attributes the source.

## What is recorded per turn

Everything below is read from the device database, not from the screen.
Debug build only:

```
adb -s <serial> exec-out run-as com.swmansion.privatemind cat files/SQLite/executorch.db     > live.db
adb -s <serial> exec-out run-as com.swmansion.privatemind cat files/SQLite/executorch.db-wal > live.db-wal
sqlite3 live.db "select id, role, modelName, timeToFirstToken, tokensPerSecond,
  sourceDocuments, groundingCaveats, content from messages where chatId=<id> order by id"
```

| Column                                                             | Source                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| searched / should have                                             | `sourceDocuments` non-empty vs the series table                                       |
| planner: parsed, used, mutated entity, silent `needs_search:false` | dev log for the turn                                                                  |
| `sourceQuery` list and URLs read                                   | `sourceDocuments[].sourceQuery`, `.url`, `.read`                                      |
| retrieval hit                                                      | does any `passage` contain the graded figure/name — decided before reading the answer |
| correct                                                            | the series table's criterion                                                          |
| in-language                                                        | answer language = question language (grade by eye; a script is optional)              |
| refusal over evidence                                              | answer refuses while retrieval hit is true                                            |
| loop / truncation                                                  | `truncateAtRepeatedClause` fired, or the answer ends mid-sentence                     |
| TTFT, tok/s                                                        | the two columns                                                                       |
| answer tokens                                                      | for the generation-reserve percentile                                                 |
| memory kill / crash / "Failed to generate"                         | logcat `lmkd`, the UX doc's symptoms                                                  |

A turn with retrieval hit = false is graded on retrieval, not on the
answer: a weak model cannot be blamed for a context that never carried the
fact, and that failure belongs to the planner or the selector, which are
shared code.

## Pass criteria — fixed before the run

Per model, over S1–S5 (22 graded turns):

| Decision                           | Rule                                                                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webPlanner: 'verbatim'`           | any of: plan parsed and used on < 50 % of searching turns; **any** entity mutation on a used plan; silent `needs_search: false` on > 5 % of turns that needed a search |
| `webSearchReady: false`            | correct < 50 % on turns where retrieval hit, **or** in-language < 75 %, **or** refusal-over-evidence on > 25 % of hit turns                                            |
| explicit `generationReserveTokens` | p95 answer tokens over all turns exceeds `scaledGenerationReserve(2048)` = 512                                                                                         |
| `webSearchMinDeviceMemoryGB`       | any lmkd kill during S1–S5 on the 12 GB Pixel → gate at 12; a kill on an 8 GB device only → gate at 8                                                                  |
| eligible for S6                    | none of the disqualifiers above                                                                                                                                        |

The reference model's numbers on the same day are recorded next to each
weak model's — if Gemma drops below its own previous run, the day is the
problem (SERP, network, build) and the weak-model numbers are discarded, not
interpreted.

## Where the results go

1. `constants/model-profiles.ts` — one entry per model in
   `PLANNER_EVIDENCE` and `WEB_ANSWER_EVIDENCE`, in the existing
   voice: counts, not adjectives ("11/22 correct where retrieval hit; refused
   over evidence on 4; answered #S4.3 in English"). Profile changes land in
   the same commit as the evidence that justifies them.
2. `__tests__/fixtures/deviceConversations.json` — export each series chat
   with its `model`. `deviceAnswerCorpus.test.ts` currently asserts the
   corpus holds exactly one model; adding a second one is a deliberate edit
   of that assertion into a per-model breakdown, and the guard-firing counts
   the test reports become per-model too.
3. `docs/WEB_SEARCH_RAG_STATUS.md` — a section per round: the table, the
   decisions taken, and every turn the shared code (planner, selector,
   digest) failed on, with `sourceQuery` and URLs, so it can be turned into
   an offline fixture.

## Known contaminants, and what to do with each

- **Day-unaware selection** — a "tomorrow" question answered from a
  "today" block. S1.7 asks for today only; time-scoped questions are
  known-failing and excluded until the selector is date-aware.
- **English planner queries for a Polish question** (P1.2 in the status
  doc) — grade the turn on the planner, mark the answer as not graded.
  It is the same defect on every model and must not be counted as a
  per-model weakness.
- **Unread sources marked used** (P3.7) — `read: false, used: true` rows
  are excluded from the retrieval-hit check.
- **Metro loss / red screen** — the run stops; the chat is discarded from
  the turn that failed onwards.
- **Native crash on a follow-up** (the OLED #349/#350 case) — the third
  attempt is graded, the two blanks are logged in the UX doc, not here.
- **Nudge retry** — a nudge that rewrites the answer counts as one turn
  with the nudge flagged; the un-nudged first draft is kept from the dev
  log so the nudge's own hit rate can be read later.

## Cost

Roughly 40 minutes per model for S1–S5 at Gemma-class speed (the planner
alone is ~26 s per call when it runs), less for the smaller models; S6 adds
~30 minutes; S7 ~45 minutes per VL model. Ten models, one reference run:
about a day of device time, which is why the series is 22 turns and not the
103-item planner corpus. The full corpus stays for the model whose planner
decision is in doubt after S1–S5.
