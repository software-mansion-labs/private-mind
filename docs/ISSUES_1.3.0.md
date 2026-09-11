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

## 2. The last message jumps when the keyboard opens

**Reported:** opening the keyboard makes the last message jump around before it
settles.

**Status:** reproduced and measured on a Pixel 10.

### Measurement

Screen recording at 30 fps, content displacement recovered by correlating the
message area between frames. Negative is upward; the resting position is 0 and
the settled position is −149 px.

| frame | displacement |     step |
| ----: | -----------: | -------: |
|   106 |         0 px |     rest |
|   107 |      −134 px |     −134 |
|   108 |      −194 px |      −60 |
|   109 |  **+128 px** | **+322** |
|   110 |       +45 px |      −83 |
|   111 |        −8 px |      −53 |
|   112 |       −33 px |      −25 |
|   113 |      −137 px |     −104 |
|   114 |      −147 px |      −10 |
|   115 |      −149 px |  settled |

The content needs to travel 149 px. It travels 522 px — 3.5× the distance — and
frame 109 moves 322 px in a single 33 ms frame, ending 128 px _below_ where it
started. The whole excursion lasts 267 ms, which is why it reads as a jump
rather than a slide.

The end state is correct: the gap between the last message and the input bar is
0.106 of screen height before the keyboard and 0.105 after. Only the path is
wrong.

### Where it comes from

`handleBarLayoutForPadding` in `components/chat-screen/ChatBar.tsx` re-captures
the bar's baseline height whenever the bottom inset changes:

```ts
if (baselineInset.current !== inset) {
  defaultBarHeight.current = height;
  baselineInset.current = inset;
}
```

Opening the keyboard changes `theme.insets.bottom`, so the baseline is
re-captured mid-animation and reported through `onHeightChange`. That feeds
`chatBarInset` → `listBottomPadding` in `Messages.tsx`, so the list's bottom
padding changes while the keyboard lift is still running, and the content drops.

The comment on that branch explains why the re-capture exists — a stale baseline
across an Android navigation-mode change or a rotation reads as "the bar grew".
The fix has to keep that without letting a keyboard-driven inset change trigger
it.

An Android-only workaround for the mirror-image problem already exists further
down `Messages.tsx`, for scroll bounce on keyboard **dismiss**. This is the
open path, which that workaround does not cover.

---

## Found during the same round, not user-reported

- **A currency-conversion follow-up answers in the original currency.** "How
  much is that in EUR?" after a USD gold price returns `$4,342.10` — the USD
  figure — with the caveat "No real conversion rate was found in the sources".
  Correct answer is about €3,738. The trace shows retrieval found the right
  pages (`bullionbypost.eu`, `goldrate24.com`); the synthesis is what fails. The
  caveat means the answer is flagged rather than silently wrong.

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
