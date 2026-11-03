#!/bin/sh
# Starts the dev server. `next dev` reads PORT from the environment but not from
# .env, so a PORT set there (as `yarn setup` does in a git worktree) is passed on.
set -e

port=""
if [ -f .env ]; then
  port=$(sed -n 's/^PORT=//p' .env | tail -n 1)
fi

exec next dev ${port:+--port "$port"} "$@"
