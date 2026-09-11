# About these documents

One rule holds the rest together: **a document is either living or dated,
never both.** A living document describes what is meant to be true today and
may be edited. A dated one records what was measured on a given day and never
changes once the round is closed. Mixing the two in one file is what rotted
the previous layout — the living half dragged the stale half along, and the
stale half undermined the living one.

## What is in here

| file                                     | what it is                                                |
| ---------------------------------------- | --------------------------------------------------------- |
| [RELEASE.md](RELEASE.md)                 | version bumping and the App Store / Play release flow     |
| [ANDROID_RELEASE.md](ANDROID_RELEASE.md) | building an AAB, locally and through CI                   |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md)       | open problems, what is known about each, how to settle it |

All three are living. Nothing else belongs in `docs/`.

## What is kept outside the repository

Working notes from a single test round — device transcripts, screenshots, raw
dumps pulled off phones, per-round plans and tester prompts — are kept out of
git through `.git/info/exclude` rather than `.gitignore`. A `.gitignore` entry
would be committed and would impose one person's working habits on everyone
else, and these files carry the contents of real conversations, which have no
reason to travel in the history of a public repository.

What survives a round is not the transcript but the conclusion: a fix with its
test, or an entry in `KNOWN_ISSUES.md`.

## Referring to a change

**Link a pull request number, not a short commit SHA.** Short SHAs do not
survive a rebase, a squash or a history rewrite; 153 such references had to be
remapped twice in a single day on one branch, and a squash merge would have
killed every one of them permanently.

When you need to point at a specific change:

- a PR number — `#312` — survives everything;
- a path and a symbol name — `webResultsToContext.ts` → `SENTENCE_END` —
  does not depend on history at all;
- a test name — the best of the three, because it is executable.
