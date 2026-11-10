@AGENTS.md

# Claude Code

`AGENTS.md` (above) is the guide for every agent. This adds what's specific to
Claude Code, set up in `.claude/settings.json`:

- **Skills** in `.claude/skills/` load by name: `new-feature`, `new-page`,
  `seo-check`, `run-app`.
- **Review** with the `reviewer` subagent before calling work done. It reads the
  diff with fresh context, checks it against these rules, and runs `yarn verify`.
- **Hooks** format every file you edit with oxfmt, and refuse edits to committed
  migrations, generated files (`packages/api` output, `routeTree.gen.ts`), `.env`
  files and `yarn.lock`. A refusal says what to do instead.
- **Parallel work:** for independent tasks, use a worktree per agent, then
  `yarn install && yarn setup` in it.
