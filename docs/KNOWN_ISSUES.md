# Known issues

Open problems in web search and in the chat screen, as measured on physical
devices. Anything already fixed is left out — the commit history carries
those. An entry says what was seen, what is known about the cause, and what
would settle it; where the cause is a guess, it says so.

## Web search and grounded answers

### Client-rendered pages come back empty

A question reaches exactly the right page and gets nothing from it. Weather,
fixture lists and live scores are at once the most common questions asked of
the app and its weakest category:

| question                       | page that was read            | answer                                   |
| ------------------------------ | ----------------------------- | ---------------------------------------- |
| weather this weekend in a town | a weather site                | "there is no information on the weather" |
| the next match of a club       | that club's full fixture list | "the date cannot be determined"          |
| the last match result          | that club's live-results page | "the result cannot be determined"        |

The scraper fetches HTML; these pages insert their data with JavaScript after
load, so the extractor receives navigation, footer and an address. The
search-engine snippet is already used as a fallback, but a weather page's
snippet rarely carries the forecast itself.

Directions, cheapest first: read the WebView after `load` plus a short delay
instead of from raw HTML (measure what it adds to a time-to-first-token that
is already 30–40 s with web search on); detect an empty extraction and move
to the next result rather than answering from an empty context; prefer
sources that put the data in HTML. Until then no prompt or ranking change
helps — the text is not there.

### A request to write about a topic retrieves study guides

Asked to write a short school essay about a historical order of knights, the
app answered about the _novel_ of the same name, because the query carried the
word "essay" and study-guide portals are optimised for exactly that. With web
search off, the same model wrote a correct essay from its own knowledge.

The fix worth making is to separate the topic from the form: search for the
topic alone and leave the form to the answer instruction. That keeps working
for tasks that genuinely need the web ("write an article about yesterday's
match"), which a blanket "don't search for writing tasks" rule would break.

### The unconfirmed-figure caveat gives the reader nothing to do

When a figure in an answer has no support in the sources, a badge appears
saying so, and that is the end of it. The reader is told the number may be
invented and has no button — they have to retype the question.

Turning the badge into a control is straightforward on paper: the passages
that were read are persisted with the message, and the focused-retry prompts
already exist for the automatic nudge, so the turn can be re-answered from the
same evidence without searching again.

It should not be built yet. The detection itself is inconsistent: on one and
the same source and price, one model got the caveat and another, with an
equally unsupported figure, did not. A repair button on a badge that appears
at random sells the reader a false sense of control. Three things also need
deciding first: whether a corrected answer replaces the original or is
appended, what happens when the second attempt is unsupported too, and whether
the three caveat kinds share one prompt.

### Freshness is not measured on device

Deciding whether a question is about the present used to depend on a list of
Polish and English phrases, so it worked for two of the fourteen languages the
app ships to. It is now notation-based: a year or a Roman numeral in the
question means a time period is named, and a page carrying the current year
gets a ranking bonus that never penalises pages without one.

That is measured in tests but not on a device. The next device round should
repeat "who currently holds office" questions in several languages and check
that a page about the present still beats a historical roster without the year
being appended to the query.

### A list with no heading still needs the planner

A page is recognised as answering a list question by a heading ending in a
colon, three short lines under it, and a term from the question that the page
title does not already state. A page that dumps its list with no heading at
all, after a paragraph echoing the question, still needs `intent: 'howto'`
from the planner — so it does not work for models that run the verbatim path.

Measured over 155 distinct questions from devices: list questions are 12 of
271 turns (4.4%), but most never reach the web at all, because the planner
rejects them as general knowledge. Two reach passage selection — about **1.3%
of searching turns**.

A numeral in the question ("give me 5 things") looks like a free notational
signal and is not: on the same corpus it catches 15 questions of which 10 are
false ("iPhone 17 Pro 256GB", "Legion 5 Pro", "what is 10 times 10").

What to do instead of guessing: record, per round, the share of list-shaped
lines on a page and whether a heading was found — the trace does not capture
it today, so the size of the gap is unknown. If it turns out to be real, the
cheapest fix is budget reservation rather than question classification: when a
document has a clear list region, guarantee it a slice of the context next to
the prose and let the model choose. Asking the model whether a question wants
a list costs a whole extra generation on the phone, on every turn, to serve
one turn in a hundred.

### Smaller, unresolved

- **False "A number here couldn't be confirmed against the sources"** — still
  raised on figures the answer explicitly attributes to a cited page (2 of 20
  turns on an S25, repeated on a Pixel on fishing-rod prices).
- **A range instead of a list of prices** — with seven prices found, the model
  listed all seven, although the range hint asks for the range alone from
  three upwards.
- **Correcting the host of an event is allowed but not required** — the
  instruction to check year, place and line-up permits a correction and does
  not demand one; "a tournament in Brazil in 2026" passed without comment,
  the year right and the place wrong.

## Chat and app

### The app can crash inside `LLM::generate` after a failed turn

Seen once on a Pixel 10: the app died mid web-search turn and two preceding
questions have no answer row at all. The tombstone puts the fault in
`Method::outputs_size()` ← `TextPrefiller::prefill_chunk` ← `LLM::generate`,
and Metro shows the native forward failing twice in the same minute before it.

Probable, not proven: loads and offloads are serialised, but the failure path
calls `unloadLLM()` — `llmInstance.delete()` — as soon as a JS-side error
arrives, while the native `generate` that produced it may still be unwinding.
The user had navigated back and reopened the keyboard between the failed
turns, which is exactly when a stale instance gets a fresh `generate`.

The guard to build is JS-side and testable with a mocked module: never
`delete()` while a native generate is in flight, and never start a generate on
an instance that is being torn down. If it happens again, capture before
relaunching: `adb logcat -b crash -d`, the last 200 lines of Metro, and the
message rows of that chat from the on-device database.

### The conversation jumps when the keyboard opens during a search

With a search running and the trace panel expanding row by row, tapping the
composer moves the panel and the last messages by more than the keyboard
height, then settles. Three things change the list's content height at once:
the keyboard lift (UI thread), the trace panel growing as rows arrive (JS
thread), and the scroll-to-end that follows them.

Do not fix without a reading: record the tap mid-search and compare the trace
panel's height with the list's content offset across the jump. An offset that
overshoots and returns is the scroll racing the keyboard; a stepping panel
height is the row stagger.

### Send animations drop frames

The composer collapse and the user bubble's entrance stutter; the rest of the
app animates smoothly. The send path does prompt assembly, the small-talk gate
and — with web search on — the planner call on the JS thread, in the same tick
as the state update that mounts the bubble. If profiling confirms the JS
thread is the bottleneck, the first thing to try is deferring the planner and
prompt build by one frame so the mount animation gets its frames.

### The first word of an answer is sometimes corrupted

Three of fourteen answers in one chat opened with a damaged first word, always
the same stock opener and always the second token, with the rest of the answer
clean. The damage is already in the token stream as delivered by the native
side, and grounded answers run with no repetition penalty, so sampling does
not explain it.

Two hypotheses remain: the tokenizer splits the opener differently from how
the model was trained to produce it, so the second token is a rare subword; or
the first two tokens are detokenised separately at the streaming boundary and
a multi-byte sequence is cut. That it always follows this one word is
consistent with the first. The next step is to collect the raw token callbacks
for the first five tokens of ten answers behind a dev flag and file the
samples upstream — a JS-side repair of the first word would be guessing at the
model's intent, and the fix belongs where tokens are decoded.

### A retry can flicker into the finished answer

When an answer check fires — wrong language, the question echoed back, a
refusal over evidence the model has, a circular non-answer, a dangling list —
the turn is generated again into the same bubble and discarded if it is still
broken, so the reader sees the retry's text appear and vanish. The planned fix
is to generate the retry with streaming suppressed, show a refining state, and
swap once, only if the retry is accepted.

### The composer stays lifted after the keyboard hides

Recurring: the keyboard dismisses and the composer bar and list keep its
height under them. It has been seen again during a scripted round without the
trigger being caught, so the fix is belt-and-braces — the system's
`keyboardDidHide` / `keyboardDidShow` events and the foreground transition
flip the same flag the UI-thread handler owns, with the UI-thread path staying
primary for the send case. If it strands again, capture the trigger first.

### The message list can render white with the conversation in the tree

Seen once on a Pixel 10 after a dozen Fast Refresh rounds: the list stayed
white for minutes while the accessibility tree returned the question, the
trace block and the streamed answer at their normal frames. The list's
visibility is an animated opacity raised by the reveal timers; if that binding
stops applying, nothing else makes the list visible.

The fix landed — once a reveal has run its fade, the container switches to a
plain opaque style and no longer depends on the animated value — but the
trigger was never pinned, so the entry stays here. If white returns, prove the
tree is there first, then check whether the reveal flag flipped.

### Leaving a chat before the first search step drops the turn silently

Sent with web search on and left for another chat before any search step
appeared, the question sits there afterwards with no answer, no progress, no
Stop and no error, and the database has no assistant row. Leaving a chat
interrupts the turn by design, and an interrupt before the first token drops
the placeholder and the trace together. Leaving _after_ the first search step
let the turn finish.

The misleading toast is fixed. What is open is a product call: whether leaving
should interrupt at all, and if it should, whether the abandoned question
deserves a visible "stopped" state instead of silence.

### Reported, not reproduced under instrumentation

- **A word typed by autocorrect is invisible in the sent bubble**, while the
  persisted message row contains it. Either the bubble renders the composer's
  last displayed text rather than its committed value, or the word is drawn in
  the background colour. Reading the accessibility tree for that bubble tells
  the two apart: if it lists the word, the colour hypothesis stands.
- **Grounding-caveat badges overflow their border on Android.** The badge row
  wraps but the label has no `flexShrink`, so a label wider than the remaining
  row keeps its intrinsic width and paints over the padding. One build would
  confirm it.
- **The first line of a streaming answer is clipped.** The layout jumps that
  were measured around it are fixed; the clip itself was never reproduced. If
  it returns, read the scroll offset and the assistant row's layout at the
  first token and 500 ms later — a constant offset with a growing layout
  position is the pin holding a stale height.

## Development builds only

### "Unable to resolve worklet with hash …" after a Fast Refresh

Worklets are bundled in bundle mode, where bodies are looked up by a hash
computed at bundle time. Fast Refresh replaces the module that defined them
while the UI-thread runtime still holds handlers registered under the old
hash, so the next event resolves a hash that no longer exists.

This is a procedure, not a code fix: after editing any file containing
`'worklet'` functions, do a full JS reload rather than a Fast Refresh. Release
bundles never hot-swap modules. If the error appears on a device that was not
just edited against, that is a different bug and worth reporting.
