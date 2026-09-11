# Field reports — 1.3.0

Issues reported from hands-on use of the 1.3.0 build, with what measurement
found behind each one. Devices are named by model; a report that could not be
reproduced says so rather than guessing.

This file is for defects. Limitations we ship knowingly belong in
`KNOWN_ISSUES.md`, which arrives with the `cr/phase1-security` port.

---

## 1. Web search is refused on a model the device can otherwise run

**Reported:** on an iPhone 17 with `Gemma 4 VL - 2B` selected, the Web toggle
cannot be turned on.

**Status:** confirmed by code analysis; the device measurement is outstanding
(see _Open question_).

### What blocks it

`hasMemoryForWebSearch` has three exits. Two of them clear this combination:

| check            | value                                        | result                |
| ---------------- | -------------------------------------------- | --------------------- |
| `webSearchReady` | `true` (only `Qwen 2.5 - 0.5B` is `false`)   | passes                |
| memory budget    | `3.0 + 0.3 + 0.3 = 3.6 GB` against `4.06 GB` | passes, 0.46 GB spare |

The budget is `8 × 0.6 (jetsam share) × 0.95 (safety) − 0.5 (app runtime)`. The
model is 3.0 GB on iOS, not 4.0 — `catalog/model-catalog.json` carries it per
platform and `resolveCatalogEntry` resolves it correctly.

That leaves one line, in `constants/model-profiles.ts`:

```ts
'Gemma 4 VL - 2B': { webSearchMinDeviceMemoryGB: 8 },
```

tested as `getTotalMemoryGB() < 8`.

### Why the floor is wrong

It sits exactly on the nominal RAM of the device class it is meant to admit.
An iPhone 17 has exactly 8 GB, so the comparison is decided by rounding.

On Android it is not a matter of rounding. `DeviceInfo.getTotalMemorySync()`
returns `ActivityManager.totalMem`, which is always well under the nominal
figure. Measured:

| device        | nominal |  reported | ratio |
| ------------- | ------: | --------: | ----: |
| Pixel 10      |   12 GB | 11.29 GiB |  0.94 |
| Galaxy S20 FE |    6 GB |  5.50 GiB |  0.92 |

At that ratio a phone sold as 8 GB reports roughly 7.4–7.5 GB and fails a floor
of 8. Five models carry this floor — `Gemma 4 - 2B`, `Gemma 4 VL - 2B`,
`Qwen 2.5 - 3B`, `LLaMA 3.2 - 3B - QLoRa`, `LLaMA 3.2 - 3B - SpinQuant` — so
web search is off for every larger model on the whole 8 GB Android class, while
the budget arithmetic would have allowed it.

### Second defect in the same place

The two guards in `components/chat-screen/useChatScreenActions.ts` give
opposite instructions:

```
capability floor → "This model cannot use web results reliably — pick a larger one."
memory floor     → "…already fills this phone's memory… Pick a smaller model."
```

A user who meets both is told to pick a larger model and a smaller one.

### Open question

The iPhone was off the cable when this was investigated and iOS exposes no
`physicalMemory` reading over `devicectl`, so what that handset actually reports
was never measured. The diagnosis is by elimination: the other two exits pass
with room to spare, so only the flat floor can produce the refusal. The toast
text distinguishes them — "already fills this phone's memory" confirms the
memory branch.

---

## 2. The input bar appears at the top instead of riding the keyboard up

**Reported:** opening the keyboard makes the last message jump around before it
settles; the input bar and the conversation come apart while it happens. Refined
after a closer look: the bar does not ride up with the keyboard at all — it
appears at the top. The ask is to restore the earlier behaviour, where it
tracked the keyboard.

**Status:** reproduced and measured on a Pixel 10. The measurement agrees with
the refined report: 91% of the movement lands in the first frame.

### Measurement

Screen recording at 30 fps, content displacement recovered by correlating a
crop of the message area between frames. The crop stays above where the
keyboard reaches, or the keyboard sliding in is read as content movement.
Negative is upward; rest is 0 and the settled position is −148 px.

| frame | displacement |    step |
| ----: | -----------: | ------: |
|   106 |         0 px |    rest |
|   107 |      −135 px |    −135 |
|   108 |      −115 px |     +20 |
|   109 |      −142 px |     −27 |
|   110 |      −148 px |      −6 |
|   111 |  **−178 px** |     −30 |
|   112 |  **−126 px** |     +52 |
|   113 |      −136 px |     −10 |
|   114 |      −146 px |     −10 |
|   115 |      −148 px | settled |

**The first frame is the defect.** The content covers 135 of its 148 px in one
33 ms frame — 91% of the travel before the keyboard has gone anywhere. It does
not ride the keyboard up; it is already at the top when the keyboard starts
moving, and what follows is a ±30 px ring (30 px past the target at frame 111,
22 px short at 112) damping out by frame 115.

This was first written up the other way round, with the ring as the defect and
the snap as background. The report that the bar "appears at the top instead of
sliding up with the keyboard" is the same measurement read correctly: a single
frame carrying 91% of the movement is a pop, not a slide.

The estimator reads exactly −148 on every static frame from 116 on, so the
±30 px during the animation is signal, not noise.

The end state is correct: the gap between the last message and the input bar is
0.106 of screen height before the keyboard and 0.105 after. Only the path is
wrong.

### Where it comes from

The bottom inset is accounted for twice while the keyboard moves, by two
mechanisms running on different clocks.

`useKeyboardLift` returns `height.value + progress.value * insetsBottom`, so it
feeds the inset in smoothly as `progress` runs 0 → 1. Meanwhile the keyboard
covers the navigation bar, `theme.insets.bottom` drops to 0, and
`handleBarLayoutForPadding` in `components/chat-screen/ChatBar.tsx` re-captures
the bar's baseline:

```ts
if (baselineInset.current !== inset) {
  defaultBarHeight.current = height;
  baselineInset.current = inset;
}
```

The new baseline goes out through `onHeightChange` to `chatBarInset` →
`listBottomPadding` in `Messages.tsx` — a layout change that lands whole on one
frame. One source removes the inset in a step, the other adds it along a curve,
and the difference between them is the ring. Its amplitude matches the
navigation-bar inset.

The re-capture itself is deliberate; the comment above it explains that a stale
baseline across an Android navigation-mode change or a rotation reads as "the
bar grew". A fix has to settle which of the two owns the inset during a keyboard
transition rather than remove the re-capture.

An Android-only workaround for the mirror-image problem already exists further
down `Messages.tsx`, for scroll bounce on keyboard **dismiss**. This is the
open path, which that workaround does not cover.

---

## 3. "Didn't find much" shows up too often

**Reported:** the warning appears frequently, including on answers that look
fine.

**Status:** explained; two paths in the confidence score make it near-unavoidable.

The note is emitted when `evaluation.shouldCorrect` is true, and
`retrievalEvaluator.ts` defines that as `label !== 'correct'`, i.e. confidence
below `WEB_EVAL_CONFIDENCE_HIGH` (0.6).

**The non-embedded path cannot reach the threshold at all.** When the retrieval
embedder did not run, `rawConfidence` returns a flat lean:

```ts
if (!retrieval || !retrieval.embedded) {
  return input.contentCount > 0 ? LEAN_WITH_CONTENT : LEAN_SNIPPETS_ONLY;
}
```

`LEAN_WITH_CONTENT` is 0.5 and `LEAN_SNIPPETS_ONLY` is 0.3, both under 0.6. So a
search that fetched and read pages successfully is still labelled "didn't find
much", because its ceiling is 0.5.

**A single-host answer is penalised into the same place.** `independenceFactor`
multiplies the score by `WEB_AGREEMENT_SINGLE_HOST_FACTOR` (0.85) whenever fewer
than `WEB_AGREEMENT_MIN_HOSTS` (2) independent hosts corroborate. With one host
the raw score has to reach 0.706 to clear 0.6 — on the weighted sum that means
near-perfect similarity _and_ coverage _and_ three qualified chunks. Plenty of
correct one-source answers land below it.

The threshold itself may be right; what the two paths above show is that the
score cannot express "read one good page and got the answer", which is the
common case.

---

## 4. The bubble lands hard at the top after sending

**Reported:** after sending, the message lands at the top of the screen very
abruptly. A small amount of easing — not a full animated scroll, just enough to
read as movement — would settle it.

**Status:** cause identified, not yet measured.

`scrollToPin` in `components/chat-screen/Messages.tsx` jumps with no animation
at all:

```ts
scrollRef.current?.scrollTo({ y: pinOffset.current, animated: false });
```

`animated: false` is deliberate — the pin has to be in place before the
assistant's reply starts filling the space below it, and a full animated scroll
over that distance would be slow and would fight the incoming content. What the
report asks for is the middle option: land instantly near the target and animate
only the last stretch, so the eye sees movement without waiting for a long
scroll.

### Same rewrite, second symptom

**Reported, alongside the hard landing:** the empty space under the message
animates oddly on the way out; going back to how it behaved on `main` before
this would be acceptable.

That reading is right about the history. The pin was rewritten in #320, the web
search merge — `git diff b3aa96f 9a15bfd -- components/chat-screen/Messages.tsx`
shows `scrollToPinnedQuestion`, which moved a single animated `blankSpace`
shared value, replaced by three mechanisms that run at once:

| mechanism                                            | driver        | clock              |
| ---------------------------------------------------- | ------------- | ------------------ |
| `pinFloor` as `minHeight` on the content container   | layout        | instant, one frame |
| `scrollTo({ animated: true })` in `settlePinRelease` | native scroll | platform curve     |
| `blankSpace.set(withTiming(0, { duration: 200 }))`   | Reanimated    | 200 ms timing      |

The release path fires the last two together and the first whenever `pinAnchor`
changes. Three curves that never agreed on a duration are what the report is
describing, and it is the same two-clock shape as §2.

Reverting is a real option: the pre-#320 pin was one shared value with one
curve. What it cannot do is hold the question in place while the reply streams
in below, which is why it was replaced. Whichever way this goes, it should be
decided against a recording of both, not from memory of how the old one felt.

---

## 5. Currency conversion questions are not answered

**Reported:** the model does not cope with "how much is that in another
currency".

**Status:** reproduced on a Pixel 10.

"How much is that in EUR?" after a USD gold price returns `$4,342.10` — the USD
figure, with a dollar sign, against a question about euros. The correct answer
is about €3,738 at 0.86088.

The trace shows retrieval is not what fails: the query carried the context
forward and found EUR-denominated pages (`bullionbypost.eu` "Gold Price in EUR",
`goldrate24.com` "per Ounce in Europe in Euro"). The synthesis step is what
returns the original figure.

The answer does carry the caveat "No real conversion rate was found in the
sources", so it is flagged rather than silently wrong. `cr/phase1-security`
carries a conversion resolver that reads the ECB reference rate instead of
hoping a scraped page states one; it is not on `main`.

---

## 6. One attached document turns web search off for the rest of the chat

**Reported:** attaching a document stops web search from working. A document
being present in the conversation should not change anything — web search is
about the message being sent, not about the chat.

**Status:** confirmed in code. The scope is the chat, exactly as reported.

`useSendChatMessage.ts`:

```ts
const hasRagSources =
  enabledSources.length > 0 || attachmentSourceIds.length > 0;

const skippedForDocPriority = RAG_PRIORITY_OVER_WEB_SEARCH && hasRagSources;
```

`attachmentSourceIds` is per message — that part is right. `enabledSources` is
not: it is `chat.enabledSources`, and `chatStore.ts` only ever appends to it:

```ts
enabledSources: [...(chat.enabledSources || []), sourceId];
```

So one document attached once is in that list for the life of the chat, and
`RAG_PRIORITY_OVER_WEB_SEARCH` is a constant `true`. Every later message in that
chat skips web search, whatever it asks about. The toast even says the quiet
part — "web search is off **while they're active**" — where "active" turns out
to mean "ever attached".

The priority rule itself is defensible: if this message is asking about the
document, the document should win. What is wrong is deciding that from the
chat's history rather than from the message. `attachmentSourceIds` already
carries the per-message answer.

---

## 7. Toggles keep their state when the model can no longer honour it

**Reported:** switching models can leave Web or Think unavailable, and the
toggles do not reset to off when that happens.

**Status:** confirmed in code. Both toggles guard the moment they are pressed
and nothing reconciles them afterwards.

`ChatBarActions.tsx` renders each pill straight from chat settings:

```tsx
<ChatBarToggle label="Think" enabled={thinkingEnabled} … />
<ChatBarToggle label="Web"   enabled={webSearchEnabled} … />
```

Neither value is ever compared against the model now loaded. The guards exist,
but only on the press path:

- `useChatScreenActions.ts:48` refuses to turn Think on for a model without
  `thinking`, with "Thinking cannot be enabled for this model."
- `handleWebSearchToggle` in the same file refuses Web on the capability floor
  or the memory floor.

So the sequence that breaks it is: turn a toggle on with a model that supports
it, then switch models. The setting is stored per chat, the new model is never
consulted, and the pill goes on showing **on**. The lie holds until the message
is sent, where `useSendChatMessage.ts` re-runs the same checks and shows
"answering without it".

The checks needed already exist and are pure functions of the model —
`isWebSearchReady`, `hasMemoryForWebSearch`, `model.thinking`. What is missing is
running them when the model changes rather than only when a finger lands on the
pill.

Worth deciding as part of it: whether an unavailable toggle should be forced
off, or shown disabled while remembering the user's choice for when they switch
back. Forcing it off is simpler and cannot mislead; remembering is kinder to
someone trying two models on the same question.

---

## 8. Crash on iPhone 17 after asking a question

**Reported:** the app crashed at 13:27 on an iPhone 17, after a question was
sent. Conditions: `Qwen 3 - 1.7B`, Think on, Web on, and speech input in use.

**Status:** report read. **It is not a jetsam.** `PrivateMind-2026-09-11-132656.ips`
is a `SIGABRT` raised from inside ExecuTorch, on app 1.3.0 / iOS 26.6.2. The
only `JetsamEvent` on the device is from 10 September, a different day.

### What the report says

Faulting thread 5, `asi: {"libsystem_c.dylib": ["abort() called"]}`:

```
libsystem_c.dylib   abort
ExecutorchLib       et_pal_abort
ExecutorchLib       executorch::runtime::pal_abort()
ExecutorchLib       executorch::runtime::runtime_abort()
ExecutorchLib       ThreadPool::run(FunctionRef<void (unsigned long)>, unsigned long)
ExecutorchLib       thread_parallelize_1d
ExecutorchLib       thread_main
```

A worker thread in the same pool shows what was being computed:

```
ExecutorchLib  torch::executor::native::custom_sdpa_out_impl(...)
ExecutorchLib  cpu_flash_attention<float, 32ll, 512ll>(...)
ExecutorchLib  executorch::extension::parallel_for(...)
```

So the abort came out of the attention kernel, not out of allocation. This is a
deliberate `runtime_abort` — a failed runtime check inside ExecuTorch — which
means the app handed the runtime something it refused, rather than the system
reclaiming memory.

The unanswered memory question from §1 therefore stays open: this crash is not
evidence either way about the floor.

### Timeline from the device database

`Documents/SQLite/executorch.db`, chat 8, local time:

| time         | message                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| 13:25:17     | user: "What's the current price of Bitcoin and Ethereum?"                |
| 13:26:04     | assistant: 1689 chars, web search                                        |
| **13:26:51** | user: "Give me a big pint of prices in US dollars with euros."           |
| **13:26:56** | **crash — five seconds later**                                           |
| 13:27:58     | user: same question again — **no answer persisted, and no crash logged** |
| 13:29:29     | user: "Who is Polish president?" — answered normally                     |

The crash lands five seconds into a turn that followed a long web-search answer,
which is consistent with it happening while the prompt was being processed
rather than during generation.

### The budget does not know about the speech model

Speech input loads a second ExecuTorch model. `store/sttStore.ts`:

```ts
SpeechToTextModule.fromModelName(WHISPER_TINY_EN, …)
```

It is loaded on first use and **never released** — there is no unload, dispose
or delete in the store or in `hooks/useSpeechInput.tsx`, and `ensureLoaded`
returns early once `isReady`. So after one dictation it stays resident for the
life of the process.

Nothing in `modelCompatibility.ts` accounts for it. The only additive term in
the whole budget is `WEB_SEARCH_MEMORY_GB` (0.3):

```ts
return cost + WEB_SEARCH_MEMORY_GB <= getModelBudgetGB();
```

The codebase does know how to make room — the attachment picker calls
`runWithModelOffloaded` before opening, and the retrieval embedder runs inside
one — but the microphone path takes part in none of that.

Against the iPhone 17's 4.06 GB model budget, the reported combination is:

|                                                  |           GB |
| ------------------------------------------------ | -----------: |
| `Qwen 3 - 1.7B` + overhead                       |         2.46 |
| web search allowance                             |         0.30 |
| thinking — longer generation, larger KV cache    | not modelled |
| Whisper Tiny, resident since the first dictation | not modelled |
| **budget**                                       |     **4.06** |

Two of the four terms are absent from the arithmetic, which is enough to explain
a jetsam without any code being wrong in itself.

This bears on §1. The memory floor was loosened by 10% on this branch on the
grounds that it was too strict for the class of device. If 13:27 turns out to be
a jetsam, the floor was not too strict — it was carrying weight for terms the
budget never counted, and the right change is to count them rather than to lower
the bar.

To retrieve it, with the phone cabled and unlocked:

```
xcrun devicectl device info files --device <core-device-id> \
  --domain-type systemCrashLogs
xcrun devicectl device copy from --device <core-device-id> \
  --domain-type systemCrashLogs --source <Name>.ips --destination <abs path>
```

The directory holds both `PrivateMind-<date>.ips` and
`JetsamEvent-<date>.ips`, and which of the two carries 13:27 decides the
question:

- **A `JetsamEvent`** means the system reclaimed the app for memory. On an 8 GB
  handset that is the budget arithmetic in `modelCompatibility.ts` being
  optimistic, not a code fault, and it bears directly on §1 — the memory floor
  was just loosened by 10%, and a jetsam here is evidence for the floor rather
  than against it. The `.ips` names the phase and the footprint at kill time.
- **A `PrivateMind` crash** means a signal in the app. The build on that phone
  carries the restored pod versions, so it is not the `#291` scroll-worklet
  `SIGABRT`.

Until the report is read, this is a report, not a diagnosis. The build on that
handset is also the catalog-test build — it points at a test manifest — which
changes nothing about memory but should be stated when the trace is read.

---

## 9. An earlier subject is appended to a later, unrelated search

**Reported:** a conversation asked about the US president, then later about the
Polish one. "US" was appended to the search query, and the results got worse.

**Status:** reproduced against the real code. The appended token and the
condition that appends it are both confirmed.

### What happens

`utils/web/topicAnchors.ts` collects acronyms — two or more capital letters —
mentioned at least `ANCHOR_MIN_MENTIONS` (2) times across the conversation,
keeps the top `ANCHORS_MAX` (2), and appends them:

```ts
return `${query} ${anchors.join(' ')}`;
```

"US" clears that bar after two mentions. Running the real `topicAnchorer` over a
four-turn US-president conversation:

```
anchors: ["US"]
"Who is the president of Poland?"  =>  "Who is the president of Poland? US"
"What about Poland?"               =>  unchanged
"And the Polish one?"              =>  unchanged
"Kto jest prezydentem Polski?"     =>  unchanged
```

The fully explicit question is the one that inherits the wrong country. The
vague ones are left alone.

### Why the guards let it through

Two guards are meant to stop this, and both miss.

**`standsAlone` never fires here.** It asks whether the new message names
something of its own, via `namedEntitiesIn`, which matches `PROPER_NOUN_RUN`:

```
/(?<!\p{L})\p{Lu}[\p{L}\p{N}'-]*(?:\s+\p{Lu}[\p{L}\p{N}'-]*)+/gu
```

The trailing `+` requires **two or more consecutive capitalised words**, so a
one-word country never qualifies. Measured:
`namedEntitiesIn('Who is the president of Poland?')` returns `[]`.

**The stem guard is backwards.** With `standsAlone` out, the only remaining test
is `sharedStemCount(query, topicText) === 0`. Measured on the same history:

| question                        | shared stems | anchored |
| ------------------------------- | -----------: | -------- |
| Who is the president of Poland? |            1 | **yes**  |
| What about Poland?              |            0 | no       |
| And the Polish one?             |            0 | no       |
| Who leads Poland?               |            0 | no       |

The test reads "does this look like the same topic?" and answers it from word
overlap. But a question about the same role in a different country is maximum
word overlap and maximum subject change — the one case where carrying the old
entity forward does the most damage. The guard is most likely to fail exactly
where it matters most.

### What not to break fixing it

The anchoring is not wrong in itself; it is what lets "how much is that in EUR?"
carry its subject forward, and §5 shows the query doing that correctly. The
defect is that "is this still the same subject?" is answered from wording
similarity rather than from whether the new message names a different one.
Recognising a single-word place or organisation would fix the reported case
without touching the follow-up behaviour that works.

---

## 10. A correct answer is discarded as "Failed to generate a response"

**Reported:** on an iPhone, the question "who is winning, Ukraine or Russia?"
was read back as "q-crime". It was nevertheless interpreted correctly, web
search ran, and the answer on screen was right — but the turn ended with
"Failed to generate a response". Called out as serious.

**Reported again**, with the consequence named: same conditions — thinking on,
web search correct, reasoning correct, answer correct — asking "who is president
of Ukraine". **Leaving the chat and coming back makes the answer disappear.**

**Status:** fixed. The disappearance confirmed the diagnosis below: the reply
was never written to the database. The "q-crime" reading is still unexplained
and waiting on the artifact from the device.

### Why a correct answer is thrown away

`store/llmStore.ts` decides success on one condition:

```ts
if (finalResponse && stripThinkBlocks(finalResponse).trim()) {
  // persist, show, done
} else {
  markGenerationFailed(new Error(describeGenerationFailure()));
}
```

`outsideThinkSegments` in `utils/thinking.ts` bails out when a `<think>` opens
and never closes:

```ts
const close = source.indexOf(THINK_CLOSE, open + THINK_OPEN.length);
if (close === -1) return segments;
```

Everything from the unterminated tag onwards is dropped. Measured on the real
function:

| response                                           | kept       | treated as failure |
| -------------------------------------------------- | ---------- | ------------------ |
| `<think>…</think>Neither side is clearly winning.` | the answer | no                 |
| `<think>… Neither side is clearly winning.`        | `""`       | **yes**            |
| `Neither side…<think>still pondering`              | the answer | no                 |
| `<think>reasoning that hit the token limit`        | `""`       | **yes**            |

Row 2 is the report: the model answered inside its own reasoning block and never
emitted `</think>`, so the gate saw an empty string. Thinking was on and
`Qwen 3` is a thinking model, so this is the path that combination takes.

### Why it looks worse than a plain error

The text was already on screen — the message renders think and normal segments
as they stream, so the user watched a correct answer arrive and was then told it
had failed. Worse, `markGenerationFailed` runs `unloadLLM()`, and the success
branch is where `persistMessage` lives, so the answer is **not saved**. It is
gone from the chat, not merely mislabelled.

A neighbouring test, `__tests__/loopTruncationKeepsAnswer.test.ts`, exists
because the same gate once ate a usable sentence after loop truncation. This is
that surface reached by another route: anything that empties `stripThinkBlocks`
turns a produced answer into a lost one.

The gate asks "is there anything outside the reasoning?" when what it needs to
know is "did the model produce an answer?". A missing `</think>` means the
closing tag is absent, not the answer.

### The fix

`hasAnswerText` in `utils/thinking.ts` accepts either: text outside the
reasoning, or text inside a block that never closed. The gate calls that
instead.

Nothing else moves. The persisted payload was always the raw `finalResponse`
including the markup, so the message renders after a reload exactly as it did
while it streamed. A closed block with nothing after it still fails the turn —
that is the case where the model really did say nothing, and its existing test
still passes.

### "q-crime" was a mis-transcription, and it is stored that way

The device database settles it. The user message is persisted verbatim as:

```
who is winning Q-crime or Russia?
```

Whisper Tiny EN heard "Ukraine" as "Q-crime", and the same chat is full of the
same thing: "How many children has Ilon?" answered as "Lions Musk has 14
children", and "with about the temperature and London do a cant." Nothing in
the app mangled the question — speech input did, and what the model received is
what was dictated.

That is its own issue, and a bigger one than it looks: a mis-transcribed proper
noun becomes the search query. `WHISPER_TINY_EN` is the smallest English model
in the family, which buys the memory footprint in §8 at the cost of exactly this.

### Four lost answers, and only one of them is the crash

Every user message in the database with no assistant reply after it:

| chat | time     | message                                                  | crash at that moment |
| ---- | -------- | -------------------------------------------------------- | -------------------- |
| 8    | 13:26:51 | "Give me a big pint of prices in US dollars with euros." | **yes**, 13:26:56    |
| 8    | 13:27:58 | the same question again                                  | no                   |
| 9    | 13:33:40 | "who is winning Q-crime or Russia?"                      | no                   |
| 9    | 13:36:41 | "Who is President of Ukraine?"                           | no                   |

One crash, four lost answers. Three of them have no crash behind them, which is
the gate in this section and the turn race in §11.

Supporting evidence for the gate: of 35 persisted assistant messages, 16 carry a
think block and **none** carries an unterminated one. That is what a gate that
drops exactly those messages looks like from the database side.

---

## 11. An answer lands under the wrong question, and the current turn fails

**Reported:** the model sometimes hangs, then answers the _previous_ question
instead of the current one, while the current one shows "Failed to generate a
response". Asked for a thorough investigation.

**Status:** investigated. Nothing in the completion path checks which turn it
belongs to, and the identity it would need is already on every message and
unused.

### No turn owns its message

`sendChatMessage` builds a placeholder with a unique `localId`:

```ts
const assistantPlaceholder = buildAssistantPlaceholder(chatId, currentModel);
// → { role: 'assistant', content: '', id: -1, localId: nextMessageLocalId() }
```

That `localId` is then never used again. All three write paths address the
message by **position** instead:

| path          | how it finds the message                                                    |
| ------------- | --------------------------------------------------------------------------- |
| `flushStream` | `activeChatMessages.at(-1)?.role === 'assistant'`                           |
| `'complete'`  | `index === state.activeChatMessages.length - 1 && msg.role === 'assistant'` |
| `'failed'`    | drops the trailing empty placeholder                                        |

So whichever assistant message is last receives the tokens and the final
content, regardless of which generation produced them.

### How two turns come to overlap

The send guard looks right at first — `useSendChatMessage` refuses while
`isGenerating`, and the button becomes Pause while `isGenerating ||
isProcessingPrompt`. The route in is `interrupt`:

```ts
interrupt: () => {
  sendAbortController?.abort();
  if ((state.isGenerating || utilityGenerating) && llmInstance) {
    llmInstance.interrupt();
  }
  …
  set({ isGenerating: false, isProcessingPrompt: false, generatingForChatId: null });
}
```

It clears the flags immediately, which unblocks the UI, but the `sendChatMessage`
promise it interrupted is still running. Abort sets a signal; it does not make
the native generate return. When that call eventually resolves rather than
throws, execution walks straight into the success branch — which has **no check
that this turn is still the current one** — and writes its answer into
`activeChatMessages.at(-1)`, by then the new turn's placeholder.

That is both halves of the report at once: the old question's answer appears
under the new question, and the new turn is left to fail.

### Three more single-slot pieces of state

Each is module-level and owned by whichever turn wrote last:

```ts
let sendAbortController: AbortController | null = null;
let failedGenerationRequest: FailedGenerationRequest | null = null;
let streamBuffer = '';
```

`sendChatMessage` ends with `finally { sendAbortController = null }`, so a turn
finishing **clears the controller belonging to the turn that replaced it** —
after which the newer turn can no longer be interrupted at all. That is a
plausible source of the "hangs" in the report, rather than a symptom of it.
`resetStreamState()` in the `'generating'` phase likewise wipes a buffer the
older generation is still filling.

### What a fix looks like

Carry the placeholder's `localId` through the turn and make every write address
the message by it: `flushStream`, the `'complete'` branch and
`markGenerationFailed` all become no-ops when the message they own is no longer
in `activeChatMessages`. The field exists and is already unique per message, so
this is threading it through rather than inventing identity.

The single-slot module variables want the same treatment — keyed by turn, or
compared against the turn that owns them before being cleared.

This is the core send path, so it should land on its own, with tests for the
overlap rather than only for the happy path, and not folded in with the
cosmetic fixes in this file.

**Asked:** whether badges like "A number here couldn't be confirmed against the
sources" stay in the production build.

Three exist, in `components/chat-screen/GroundingCaveatBadges.tsx`:

```
conversion → "No real conversion rate was found in the sources"
trend      → "No data on the change over time was found in the sources"
figure     → "A number here couldn't be confirmed against the sources"
```

Only the highest-priority one renders per message.

They are the difference between an answer that is wrong and an answer that is
wrong _and says so_ — the currency case in §5 is exactly that. Against
that: they appear next to answers users believe, and a badge on a correct number
teaches people to ignore all three. The `figure` badge is the widest net of the
three and so the most likely to cry wolf; `conversion` fires on a condition the
code actually established.

No recommendation here without knowing how often each fires in practice. That is
measurable — the caveat kind is already persisted per message — and worth
measuring before the decision, rather than deciding on taste.

---

## Found during the same round, not user-reported

- **Answer accuracy varies with model size.** Same question, same minute:
  Pixel 10 / `Qwen 3 - 1.7B` returned $4,342.10 (0.05% from reference), Galaxy
  S20 FE / `LFM 2.5 - 1.2B` returned $4,302.92 (0.90%). Both cite a source;
  neither is fabricated.

- **Three source links open without a scheme check** —
  `SourceRow.tsx`, `WebSearchBlock.tsx` and `DominantSourceBadge.tsx` hand
  `source.url` straight to `WebBrowser.openBrowserAsync`. The markdown link
  handler in `MessageItem.tsx` is guarded; these are not. Fixed on
  `cr/phase1-security`, not yet on `main`.

## Verified working

Recorded so a regression is visible: What's New card at v1.3.0 with all five
highlights; the remote model catalog adding and removing entries; the model
compatibility gate matching its computed budget on both a 12 GB and a 6 GB
device; the web-search memory floor refusing with an explanation and allowing a
smaller model on the same handset; search trace, source sheet and source links;
first-run onboarding and in-place upgrade. No app crash on either device across
the round.
