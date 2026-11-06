# Contributing

## Code comments

Code added to this repository carries no explanatory comments. Put the
reasoning in the commit message, where it stays attached to the change.
The exceptions are comments the toolchain reads (`eslint-disable`,
`@ts-expect-error`, pragmas) and a single line that stops a future reader from
silently undoing a non-obvious invariant or ordering constraint. The same rule
applies to test files.
