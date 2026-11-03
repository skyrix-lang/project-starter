#!/bin/sh
# Starts Mailpit, a local SMTP server that catches every email the app sends
# (such as sign-in links), creating it on first use, and waits for it.
# Read the emails at http://localhost:8025.
set -e

docker start booking-mail >/dev/null 2>&1 || docker run -d --name booking-mail \
  -p 1025:1025 \
  -p 8025:8025 \
  axllent/mailpit:v1.33 >/dev/null

until curl -sf http://localhost:8025/readyz >/dev/null; do
  sleep 1
done
