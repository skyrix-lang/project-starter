#!/bin/sh
# Starts the local Postgres container, creating it on first use, and waits for it.
set -e

docker start booking-db >/dev/null 2>&1 || docker run -d --name booking-db \
  -e POSTGRES_USER=booking \
  -e POSTGRES_PASSWORD=booking \
  -e POSTGRES_DB=booking \
  -p 5432:5432 \
  -v booking-db:/var/lib/postgresql \
  postgres:18-alpine >/dev/null

# Over TCP: during first-time setup Postgres only listens on a local socket.
until docker exec booking-db pg_isready -q -h 127.0.0.1 -U booking; do
  sleep 1
done
