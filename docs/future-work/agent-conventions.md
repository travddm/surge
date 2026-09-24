# Future work: agent conventions

Part of the [surge](../architecture.md) design.

## What

Two conventions for an agent working in these repositories:

- A `PreToolUse` hook that blocks an agent's edits to the generated files
  [coding-standards.md](../coding-standards.md) lists.
- Task skills under `.claude/skills/`, one for each task an agent repeats.

## Why deferred

Neither has a reason yet. The hook would not see a write from a shell, so it
would guard only part of what it is for. A skill written before its task has
been done by hand would record a guess rather than a procedure.

## How, briefly

- Add the hook when a hand edit to a generated file gives it a reason.
- Write a skill only once its task has been done twice by hand, from the
  steps that were taken.
