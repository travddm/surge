# CLAUDE.md

Read [AGENTS.md](AGENTS.md) first; it holds the rules, the commands and the
documentation index. Where this file and `AGENTS.md` disagree, `AGENTS.md`
wins. This file adds only what is particular to Claude Code:

- The mise tasks assume a POSIX shell. On Windows, run them through the Bash
  tool, which is Git Bash, not through PowerShell.
- Read a command's exit status, not its tail. `mise run ci | tail` reports
  the exit status of `tail`, which hides a failed step.
- The spell step checks `.git/COMMIT_EDITMSG`, the last commit message. A
  commit message with a word cspell does not know fails the next
  `mise run ci`, so write commit messages in words it knows, or add a real
  word to `cspell.json`.
- The transformer lives in `../rbxts-transformer-surge`. Push it before this
  repository when a change spans both.
