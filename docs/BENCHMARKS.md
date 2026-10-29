# Release benchmarks

One section per release, so the next one can be compared with the last.
Numbers come from two sources:

- the in-app dev benchmark (`EXPO_PUBLIC_DEV_TOOLS=1`, "Full" mode, fixed
  seed) run on a phone by `scripts/release-gate/run.mjs` from the
  `feat/release-gate` branch — load time, a speed probe, peak memory and
  scenario pass counts for every model the device can run;
- manual regression sessions on phones with the release build, where the
  stats line under each answer gives ttft and tok/s.

Speeds are per device and drift with heat and battery: on the Pixel 10 the
same model went from 17 tok/s to 5–9 tok/s inside one hour-long session.
Compare like with like (same device, same scenario, cold vs warm model).

## 1.3.5 (Android 173, iOS 25) — react-native-executorch 0.11.0

### LFM 3 by device, manual regression (release test builds, 2026-10-28)

| Device                      | RAM   | Model         | Think | tok/s | ttft      | Notes                                                                         |
| --------------------------- | ----- | ------------- | ----- | ----- | --------- | ----------------------------------------------------------------------------- |
| iPhone 17 (A19)             | 8 GB  | LFM 3 - 1.7B  | on    | 19–31 | 1.6–4.3 s | 10-turn multilingual chat; Urdu turn spiralled in reasoning (>7 min, stopped) |
| iPhone 17 (A19)             | 8 GB  | LFM 3 - 1.7B  | off   | 49    | 0.5 s     | short factual answer, no think block                                          |
| iPhone 17 (A19)             | 8 GB  | LFM 3 - 1.7B  | on    | 32    | 5.3 s     | document Q&A with a PDF attached                                              |
| iPhone 17 (A19)             | 8 GB  | LFM 3 VL - 2B | —     | —     | —         | photo question answered; OCR of documents unreliable                          |
| Pixel 10 (Tensor G5)        | 12 GB | LFM 3 - 1.7B  | on    | 7–17  | 0.7–8.4 s | drifted from 17 tok/s early to 5–9 tok/s late in the session                  |
| Pixel 10 (Tensor G5)        | 12 GB | LFM 3 - 1.7B  | off   | 18    | 0.7 s     |                                                                               |
| Samsung S20 FE (Exynos 990) | 6 GB  | LFM 3 - 1.7B  | on    | 10–15 | 1.3–7.5 s | PSS after a turn 1.7 GB; no low-memory kill in 9 scenarios                    |
| Samsung S20 FE (Exynos 990) | 6 GB  | LFM 3 VL - 2B | —     | —     | —         | not offered on 6 GB (below the 7 GB floor)                                    |

Stability across the three devices and the iPhone SE install: zero crashes,
zero low-memory kills, zero ANR / jetsam in the S1–S10 regression (Pixel 10,
iPhone 17) and the L1–L9 low-memory protocol (S20 FE).

Known model behaviour, not app bugs: Polish from LFM 3 - 1.7B is often
garbled (non-words, cut fragments) on every device; Think ON can loop in
reasoning for 7–13 minutes on story prompts (Stop works); Hindi/Urdu answers
can carry Latin or Cyrillic fragments.

### Dev benchmark, Pixel 10 (Android 17, 11.3 GB), seed 1016 — run 1

Gate build 172 (1.3.4 base + the LFM 3 stack, before the benchmark learned to
switch reasoning off). Scenario columns are passed/total turns for base chat,
short facts and document questions. A turn fails on any check (time budget,
cut-off, wrong fact, foreign script, list length), so the counts are a strict
regression signal, not a quality score. Interrupted after 14 of the 17 models the device offers.

| Model                                  | Size    | Load   | Probe tok/s | ttft  | Peak mem | Avg turn tok/s | Base chat | Short facts | Document Q&A |
| -------------------------------------- | ------- | ------ | ----------- | ----- | -------- | -------------- | --------- | ----------- | ------------ |
| LFM 2.5 VL - 450M                      | 0.65 GB | 0.9 s  | 68.6        | 0.3 s | 1.27 GB  | 60.5           | 3/6       | 4/5         | 3/4          |
| Qwen 2.5 - 0.5B                        | 0.81 GB | 3.5 s  | 35.9        | 0.7 s | 1.27 GB  | 24.7           | 2/6       | 2/5         | 0/4          |
| Bielik - v3.0                          | 0.86 GB | 10.2 s | 8.7         | 4.9 s | 1.89 GB  | 9.5            | 2/6       | 1/5         | 3/4          |
| Qwen 3 - 0.6B                          | 0.94 GB | 4.9 s  | 19.0        | 1.3 s | 1.52 GB  | 15.3           | 2/6       | 2/5         | 3/4          |
| LFM 2.5 - 1.2B                         | 1.14 GB | 4.1 s  | 22.9        | 1.2 s | 1.49 GB  | 22.1           | 5/6       | 2/5         | 3/4          |
| LLaMA 3.2 - 1B - SpinQuant             | 1.14 GB | 6.7 s  | 16.8        | 1.9 s | 1.78 GB  | 12.9           | 2/6       | 1/5         | 3/4          |
| LLaMA 3.2 - 1B - QLoRa                 | 1.18 GB | 7.0 s  | 15.2        | 1.9 s | 2.15 GB  | 13.3           | 1/6       | 0/5         | 3/4          |
| LFM 3 - 1.7B (reasoning on, see note)  | 1.25 GB | 8.3 s  | 7.6         | 2.3 s | 2.06 GB  | 11.4           | 3/6       | 2/5         | 3/4          |
| Qwen 2.5 - 1.5B                        | 1.76 GB | 6.7 s  | 13.5        | 2.3 s | 2.01 GB  | 11.1           | 2/6       | 1/5         | 3/4          |
| LFM 3 VL - 2B (reasoning on, see note) | 2.01 GB | 10.4 s | 7.4         | 2.4 s | 3.02 GB  | 12.5           | 4/6       | 4/5         | 3/4          |
| Qwen 3 - 1.7B                          | 2.16 GB | 7.7 s  | 9.8         | 2.2 s | 2.42 GB  | 9.9            | 2/6       | 4/5         | 2/4          |
| LFM 2.5 VL - 1.6B                      | 2.43 GB | 8.8 s  | 18.9        | 1.3 s | 3.49 GB  | 19.5           | 3/6       | 3/5         | 1/4          |
| Gemma 4 - 2B                           | 2.50 GB | 16.7 s | 5.6         | 6.7 s | 3.07 GB  | 5.3            | 2/6       | 3/5         | 3/4          |
| LLaMA 3.2 - 3B - SpinQuant             | 2.55 GB | 15.8 s | 6.0         | 5.1 s | 3.44 GB  | 5.0            | 2/5       | —           | —            |

Note on the LFM 3 rows: this build ran them with reasoning on, so most of
their failed turns are the 60 s budget spent inside `<think>`; the pass
counts are not comparable with the other rows. Run 2 below repeats the whole
set on a build that switches reasoning off for the benchmark.

No generation errors and no crashes in any model of this run.

### Dev benchmark, Pixel 10, seed 1016 — run 2 (gate build 173, reasoning off)

The release build plus the benchmark switching reasoning off through the chat
template. All 17 models the device offers, 2026-10-28 22:10 to 2026-10-29
02:47, no generation errors, no crashes. Same columns as run 1.

| Model                      | Size    | Load   | Probe tok/s | ttft  | Peak mem | Avg turn tok/s | Base chat | Short facts | Document Q&A |
| -------------------------- | ------- | ------ | ----------- | ----- | -------- | -------------- | --------- | ----------- | ------------ |
| LFM 2.5 VL - 450M          | 0.65 GB | 1.5 s  | 72.8        | 0.4 s | 1.36 GB  | 144.4          | 3/6       | 3/5         | 3/4          |
| Qwen 2.5 - 0.5B            | 0.81 GB | 3.0 s  | 48.0        | 0.7 s | 1.36 GB  | 66.9           | 2/6       | 2/5         | 1/4          |
| Bielik - v3.0              | 0.86 GB | 5.2 s  | 14.6        | 3.0 s | 1.83 GB  | 11.2           | 1/6       | 1/5         | 3/4          |
| Qwen 3 - 0.6B              | 0.94 GB | 4.3 s  | 23.3        | 1.1 s | 1.57 GB  | 18.6           | 4/6       | 2/5         | 3/4          |
| LFM 2.5 - 1.2B             | 1.14 GB | 4.1 s  | 23.0        | 1.2 s | 1.66 GB  | 22.0           | 4/6       | 3/5         | 3/4          |
| LLaMA 3.2 - 1B - SpinQuant | 1.14 GB | 6.3 s  | 17.2        | 1.6 s | 1.95 GB  | 15.3           | 1/6       | 1/5         | 3/4          |
| LLaMA 3.2 - 1B - QLoRa     | 1.18 GB | 6.9 s  | 15.8        | 1.6 s | 2.36 GB  | 14.3           | 1/6       | 2/5         | 1/4          |
| LFM 3 - 1.7B               | 1.25 GB | 8.2 s  | 14.0        | 2.1 s | 2.18 GB  | 12.4           | 2/6       | 1/5         | 3/4          |
| Qwen 2.5 - 1.5B            | 1.76 GB | 6.8 s  | 14.6        | 2.0 s | 2.17 GB  | 12.8           | 1/6       | 1/5         | 3/4          |
| LFM 3 VL - 2B              | 2.01 GB | 10.5 s | 14.8        | 2.1 s | 3.14 GB  | 14.1           | 5/6       | 5/5         | 3/4          |
| Qwen 3 - 1.7B              | 2.16 GB | 7.7 s  | 10.1        | 1.9 s | 2.55 GB  | 11.2           | 2/6       | 3/5         | 2/4          |
| LFM 2.5 VL - 1.6B          | 2.43 GB | 10.0 s | 23.4        | 1.1 s | 3.67 GB  | 20.5           | 3/6       | 3/5         | 2/4          |
| Gemma 4 - 2B               | 2.50 GB | 14.6 s | 5.7         | 6.7 s | 3.30 GB  | 5.3            | 3/6       | 3/5         | 3/4          |
| LLaMA 3.2 - 3B - SpinQuant | 2.55 GB | 14.5 s | 6.3         | 4.9 s | 3.78 GB  | 5.8            | 3/6       | 1/5         | 3/4          |
| LLaMA 3.2 - 3B - QLoRa     | 2.65 GB | 13.7 s | 7.3         | 3.5 s | 4.21 GB  | 5.4            | 1/6       | 1/5         | 3/4          |
| Qwen 2.5 - 3B              | 2.89 GB | 10.7 s | 8.7         | 3.7 s | 3.29 GB  | 7.2            | 1/6       | 1/5         | 2/4          |
| Gemma 4 VL - 2B            | 4.00 GB | 21.7 s | 5.7         | 6.5 s | 6.16 GB  | 5.3            | 4/6       | 5/5         | 3/4          |

LFM 3 - 1.7B still lost 6 of 15 turns to the 60 s budget with reasoning off:
the answer comes first and complete, then the model keeps writing
reasoning-like text ("Wait, let me finish correctly…", "Actually keep
simpler") instead of stopping. LFM 3 VL - 2B does not do this and fails only
on the two turns most models fail (seven-item Hindi list, Polish memo
question). Gemma 4 VL - 2B peaks at 6.16 GB, which is what the 7 GB floor
for the vision models is based on.

The fastest two rows carry an `unreal-speed` finding on three turns (tok/s
above what the probe measured), so read their average turn speed as an upper
bound.
