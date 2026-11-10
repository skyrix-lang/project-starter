# Feature specs

A spec is written before a feature that's bigger than one screen, changes the
database, or has open product questions. It's how a person and an agent agree on
the result before code exists. Small changes don't need one.

- One file per feature: `docs/specs/<feature>.md`, from the template below.
- An agent drafts it from the request, lists what it doesn't know under **Open
  questions**, and waits for answers before building.
- Keep it updated while building. When the feature ships, keep the file: it
  explains why the code is the way it is.

## Template

```md
# <Feature>

Status: draft | agreed | built

## Goal

What a user can do afterwards that they can't now, in one or two sentences.

## Users and access

Who uses it. Signed in? Is the data per user or shared? Anything only some
users may do?

## Behaviour

What happens, step by step, including the empty state and each failure (bad
input, missing record, someone else's record, the database being down).

## Data

New tables or columns, and what happens to existing rows in the migration.

## Pages and API

Each new or changed route: public or app page in `apps/web`, and each API route
in `apps/bff` (method, path, who may call it, error statuses).

## Out of scope

What this deliberately doesn't do yet.

## Tests

The cases that prove it works, as test names.

## Open questions

What must be decided before or while building.
```
