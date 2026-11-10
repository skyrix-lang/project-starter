#!/bin/sh
# yarn dev: the BFF (restarting on change) and the Vite dev server together.
# Open PUBLIC_URL (http://localhost:3000): Vite forwards /api and /auth to the BFF.
# Ctrl-C stops both.
set -e

yarn workspace @booking/bff dev &
bff=$!
trap 'kill $bff 2>/dev/null' EXIT INT TERM

yarn workspace @booking/web dev
