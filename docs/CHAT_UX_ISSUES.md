# Chat UX issues found around web search

Problems that surfaced while testing web search on a physical Pixel 10
(Gemma 4 - 2B, branch `web-search-compact`, 2026-09-02/03, two more reported
2026-09-04) but whose cause
lives outside the retrieval pipeline: model lifecycle, the composer, the
message list, the dev toolchain. Anything that is about what gets searched,
read or answered stays in [WEB_SEARCH_RAG_STATUS.md](WEB_SEARCH_RAG_STATUS.md).

Markers: ✅ fixed and guarded · 🔧 fixed, guard pending · ⚠️ diagnosed, open ·
🔁 has come back before · ❔ reported, not yet reproduced under instrumentation.

## ✅ The embedding-download sheet opens although the model is on disk

Symptom: turning web search on right after entering a chat shows "download
the search model" even though the model was downloaded long ago. Dismissing
it and toggling again shows nothing.

Mechanism: [`embeddingModelStore`](../store/embeddingModelStore.ts) starts at
`status: 'unknown'` and stays there until
[`VectorStoreContext`](../context/VectorStoreContext.tsx) finishes its
initialise chain — migration, keyword index, `isEmbeddingModelDownloaded()`,
then a `runWithModelOffloaded` round trip that unloads the LLM, warms the
vector store and loads the LLM back. On the Pixel that is several seconds,
and the cleanup on every `db` change resets the status to `'unknown'` again.
The toggle handler in [`ChatBar`](../components/chat-screen/ChatBar.tsx)
tested `status !== 'ready'`, so `'unknown'` counted as "missing" and the
sheet opened during that window.

Fix (`f56cbf1`): `whenEmbeddingStatusKnown()` resolves the first non-unknown
status (or whatever is there after `EMBEDDING_STATUS_WAIT_MS`), and
`embeddingModelNeedsDownloadPrompt(status)` is the single predicate for "offer
the download" — true for `not_downloaded | downloading | error`, false for
`ready` and `unknown`. A toggle sequence counter drops an offer that resolves
after the user has already toggled web search off.

Guarded by [__tests__/embeddingModelStore.test.ts](../__tests__/embeddingModelStore.test.ts)
(the waiter, the predicate) and
[__tests__/ChatBar.test.tsx](../__tests__/ChatBar.test.tsx) — "does not offer
the download while the model turns out to be on disk" and "drops a pending
offer when web search is toggled off meanwhile" are red without the fix.

## ⚠️ "Unable to resolve worklet with hash …" (development builds only)

Symptom: a red box naming a worklet hash, seen on the Pixel after editing and
again when sending a message; it reappeared after a Fast Refresh.

Mechanism: `babel.config.js` runs react-native-worklets with
`bundleMode: true`. In that mode worklet bodies are looked up by a hash
computed at bundle time; Fast Refresh replaces the JS module that defined
them — here [`useKeyboardLift.ts`](../components/chat-screen/useKeyboardLift.ts),
changed in `3accc5f` — but the UI-thread runtime still holds handlers
registered under the old hash. The next keyboard event resolves a hash that
no longer exists. Nothing in the app is wrong; the release bundle never
hot-swaps modules.

Procedure, not a code fix: after editing any file that contains `'worklet'`
functions, do a full JS reload (`r` in Metro or `debugger-reload-metro`), not
a Fast Refresh. If the error shows up on a device that was *not* just edited
against, that is a different bug and worth a report.

## ⚠️ Native crash at 16:09 — `SIGSEGV` inside `LLM::generate`

Symptom: the app died on the Pixel at 16:09 while a web-search turn was in
progress; the two preceding "Jaka jest jego cena?" turns (message ids 349
and 350 in chat 55) have no answer row at all.

Evidence: the tombstone puts the fault in
`executorch::runtime::Method::outputs_size()` ←
`TextPrefiller::prefill_chunk` ← `LLM::generate`. Metro, in the same
minute: `generateUtility failed` → the reduced-prompt retry → `Chat
sendMessage failed (RnExecutorchError forward)`. So the JS side saw the
native forward fail twice and reported it, and the process went down on a
later `generate` against a `Method` that was no longer valid.

Mechanism (probable, not proven): [`llmStore`](../store/llmStore.ts)
serialises loads and offloads through `waitForModelToBecomeIdle`, but
`markGenerationFailed` calls `unloadLLM()` — `llmInstance.delete()` — the
moment a JS-side error arrives, while the native `generate` that produced
the error may still be unwinding. The user had navigated back and reopened
the keyboard between the failed turns, which is exactly when a stale
instance gets a fresh `generate`.

Guard to build: `unloadLLM` must not `delete()` while a native generate is in
flight — interrupt, await the in-flight promise, then delete; and a
`generate` must not start on an instance that is being torn down (a
tearing-down flag checked in `sendMessage` before the native call). Both are
JS-side and testable with a mocked `LLMModule`.

Next time it happens, capture before relaunching: the crash buffer
(`adb logcat -b crash -d`, which carries the tombstone summary without
root), the last 200 lines of Metro, and the message rows of the chat from
the on-device database.

## ⚠️ The screen jumps when the keyboard opens during a running search

Symptom: with a search running and the trace panel expanding row by row,
tapping the composer opens the keyboard and the conversation jumps — the
panel and the last messages move by more than the keyboard height, then
settle.

What is known: three things change the list's content height at once — the
keyboard lift ([`useKeyboardLift`](../components/chat-screen/useKeyboardLift.ts),
UI-thread), the trace panel growing as rows arrive (JS-thread state), and
the scroll-to-end that follows new rows. The lift is a derived value; the
other two are layout passes that land whenever the JS thread is free, which
during a search is late and bursty.

To measure: record with `screen-recording-start` while tapping the composer
mid-search, then read the trace-panel height and the list's content offset
across the jump (`debugger-evaluate` on the list ref). If the offset
overshoots and returns, it is the scroll-to-end racing the keyboard; if the
panel height steps, it is the row stagger. Do not fix without that reading.

## ⚠️ Animations stutter on send

Symptom: pressing send, the composer collapse and the user bubble's entrance
drop frames; the rest of the app animates smoothly.

What is known: the send path does prompt assembly, the small-talk gate, and
— with web search on — the planner call, all on the JS thread, in the same
tick as the state update that mounts the bubble. Reanimated animations
driven from the UI thread survive that; any layout animation or `entering`
that needs a JS-side callback does not.

To measure: `react-profiler-start` around one send, then `profiler-cpu-query`
for the 300 ms after the tap. The first thing to try if the JS thread is the
bottleneck: defer the planner and prompt build by one frame
(`requestAnimationFrame` / `InteractionManager.runAfterInteractions`) so the
mount animation gets its frames first.

## ❔ Text typed by autocorrect is invisible in the user bubble

Symptom: the user typed "OLED", the keyboard's autocorrect replaced or
confirmed it, and the sent bubble shows the sentence with a gap where the
word should be. The word is present in the persisted message row.

Not reproduced under instrumentation yet. Two hypotheses worth ruling out in
order: the bubble renders the composer's last *displayed* text rather than
its committed value (a stale state from `onChangeText` vs. the composing
region Android keyboards use for suggestions), or the word is rendered but
in the bubble's background colour because a `Text` style is applied to a
span that autocorrect marked. Reproduce with a screenshot of the bubble and
`describe` on the same screen — if `describe` lists the word, it is drawn
and the colour hypothesis stands; if not, it never reached the render.

## ⚠️ Corrupted first word of an answer

Symptom: three of the fourteen answers in chat 55 open with a damaged first
word — "Zgodnieć z" (twice, ids 338 and 348) and "Zgodniewniałem się" (id
342). The rest of each answer is clean. All three are the same stock opener,
"Zgodnie z informacjami zawartymi w źródłach", with an extra fragment glued
to the end of "Zgodnie"; the ten answers that open differently are intact.

What is known: the damage is in the token stream as delivered by the native
side — the persisted row already carries it, and `normalizeModelText` does
not touch word interiors. Sampling is not the explanation: grounded answers
run with `GROUNDED_REPETITION_PENALTY = 1`
([constants/default-models.ts](../constants/default-models.ts)), so nothing
pushes the model off " z" after "Zgodnie". Two hypotheses remain: the
tokenizer splits "Zgodnie" + " z" differently from how the model was trained
to produce it, so the second token is a rare subword ("ć", "wniałem") rather
than " z"; or the first two tokens are detokenised separately at the
streaming boundary and a multi-byte sequence is cut. The first hypothesis
predicts the fault follows this one word regardless of position; the second
predicts it follows the *first* token whatever the word.

Next step: collect the raw token callbacks for the first five tokens of ten
answers (log them from the token callback in
[`llmStore`](../store/llmStore.ts) behind a dev flag, do not persist), and
see which prediction holds. Then file the samples with
react-native-executorch. A JS-side patch that repairs the first word would be
guessing at the model's intent; the fix belongs where the tokens are decoded.

## 🔧 The answer flickers when generation ends

Symptom: the finished answer is replaced for a moment by a different text and
then comes back, or is swapped for the second text.

Mechanism: `nudgeOnce` in [`llmStore`](../store/llmStore.ts) re-generates
when one of the answer checks fires (wrong language, question echo, a refusal
over evidence it has, a circular non-answer, a dangling list). The retry
streams into the same bubble and is discarded if it is still broken, so the
user sees the retry's text appear and vanish. The fix is planned as P2.6 in
the web-search document: generate the retry with streaming suppressed, show a
refining state, swap once only if the retry is accepted.

## ❔ Grounding-caveat badges overflow their border on Android

Symptom: a long caveat label draws past the rounded border of its badge on
the Pixel; the border itself is placed correctly.

Hypothesis: the badge row in
[`GroundingCaveatBadges`](../components/chat-screen/GroundingCaveatBadges.tsx)
wraps (`flexWrap: 'wrap'`) but the label `Text` has no `flexShrink`, so a
label wider than the remaining row width keeps its intrinsic width and paints
over the badge padding instead of wrapping inside it. `flexShrink: 1` on the
label plus `numberOfLines` would confirm it in one build. Not yet verified on
the device.

## ⚠️ The first line of a streaming answer is clipped; only the lower part shows

Reported 2026-09-04, intermittent: while an answer streams, the top of the
assistant bubble sits above the viewport — the first line is cut and the
reader sees the answer from its second line down. It must not happen at all:
the pinned layout exists so that the user's question and the start of the
answer are the two things always in view.

What is known. After send, [`Messages`](../components/chat-screen/Messages.tsx)
pins the new user row at the top of the viewport with an inflated bottom
inset (`blankSpace`), measures the assistant row
(`handleLastAssistantLayout` → `applyPendingPin`) and scrolls to `pinOffset`
once the content height reaches `pinOffset + containerHeight` minus a slack.
Two things then move the answer's top edge without moving the scroll offset:

1. **The model-name header mounts on the first token.** While the prompt is
   processed, the slot above the answer holds `AnimatedChatLoading`, which is
   absolutely positioned on purpose so it contributes no height. When the
   first token arrives, [`MessageItem`](../components/chat-screen/MessageItem.tsx)
   renders `modelName` in flow (`entering={FadeIn}`), one `xs` line tall, and
   the answer text below it shifts down by exactly that height. The pin was
   computed against the zero-height label, so the bubble's top now sits one
   small line above the offset the list is holding. A one-line clip is the
   signature of this path.
2. **The assistant measurement lags the stream.** `lastAssistantHeight` is
   refreshed from layout events on the JS thread, which during generation is
   busy in bursts; `applyPendingPin` may run against a height that is
   already stale, and the inset it derives lands the offset a few lines past
   the bubble's top. A clip taller than one line, or one that varies between
   runs, is this path.

To measure: `screen-recording-start` on a fresh chat, send a question, stop
after ~20 tokens. Read `contentOffset.y` from the scroll handler (a temporary
`console.log` in `handleScroll`) and the assistant row's `layout.y` from
`handleLastAssistantLayout` at the first token and 500 ms later. If the
offset is constant and `layout.y` grows by one `xs` line at the first token,
it is (1); if `layout.y` and the pin disagree by more and the gap changes
with token rate, it is (2). Fix for (1) without waiting for the reading:
reserve the header's height from the start — render the model-name slot with
a fixed `minHeight` equal to the `xs` line (or keep `AnimatedChatLoading` in
flow at that height) so the first token causes no layout shift. Fix for (2):
recompute the pin from the assistant row's `onLayout` after every growth
while streaming, not only once, and clamp the offset so the bubble's top can
never rise above the viewport's top edge.

## 🔁 The keyboard is gone but the composer stays lifted

Reported again 2026-09-04: the keyboard dismisses, the composer bar and the
list keep the keyboard's height under them, and the bottom of the screen is
empty until something else moves the keyboard. This came back after
[`useKeyboardLift`](../components/chat-screen/useKeyboardLift.ts) moved the
"keyboard gone" flag to a UI-thread `useKeyboardHandler`, which was the fix
for the same symptom on send (JS-side `keyboardDidHide` listeners could not
land while the JS thread was busy generating).

What is known. The lift is `keyboardGone ? 0 : height + progress·inset`,
all shared values from `react-native-keyboard-controller`. A stranded bar
therefore means the controller never delivered the hide: no `onEnd` with
height 0 and no `height`/`progress` update to 0. That happens when the IME is
hidden by something other than an animated dismissal the controller tracks —
a system dialog or sheet taking the window (permission prompt, share sheet,
notification shade), the app going to background and back, a Fast Refresh or
red box that remounts under `KeyboardProvider`, or the composer losing focus
while an overlay is presented with `freeze` set. Which of those it was this
time is not recorded.

To measure: at the next occurrence, before touching anything, run
`adb -s 56211FDCR005KT shell dumpsys input_method | grep -E 'mInputShown|mImeWindowVis'`
to confirm the IME is really hidden, and note what happened just before
(dialog, background, reload). Then add a temporary `runOnJS(console.log)` in
the hook's `onMove`/`onEnd` and reproduce that trigger; if the log shows no
`onEnd` for the hide, the controller missed it and the fix is a watchdog, not
a listener: on the UI thread, when `progress` has been 0 for a few frames
while `height` is non-zero, treat the keyboard as gone; on the JS side, reset
`keyboardGone` on `AppState` → active and on `Keyboard` `keyboardDidHide` as a
belt-and-braces path for the cases where the JS thread is free. If the log
does show `onEnd(0)` and the bar still stays, the derived value is not being
re-evaluated and the bug is in how the lift is consumed by
[`ChatScreen`](../components/chat-screen/ChatScreen.tsx) and `Messages`.

## What was not investigated this round

- The camera screen's back button reacting late on Android — reported
  earlier, no measurement taken.
- The conversation going blank white mid-generation — documented with its
  capture procedure under "Trace-panel regressions that keep coming back" in
  the web-search document; no new occurrence.
