# Keeping projects up to date with the starter

Projects are made from this starter with `yarn rename`, then grow their own
features. Two mechanisms keep them close to it afterwards:

| What changes                                                  | How it reaches the projects                                     |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| Dependency and image versions                                 | Renovate, in each repository, with the policy in `default.json` |
| Everything else: scripts, CI, Docker, configs, packages, docs | `yarn sync-from-starter`, run in the project when you choose    |

Both are recorded in `docs/decisions.md` ("Projects follow the starter").

## Versions: Renovate

`default.json`, at the root of the starter, is a
[Renovate preset](https://docs.renovatebot.com/config-presets/): the update
policy for every repository. Each repository, the starter included, has the
same `renovate.json`, which only extends it:

```json
{ "extends": ["github>skyrix-lang/project-starter"] }
```

The policy:

- Runs weekly (Monday morning, UTC), and opens a "Dependency Dashboard" issue
  listing what's pending.
- Only versions published at least 7 days ago, as `.yarnrc.yml` requires.
- npm minor and patch updates in one pull request; each major in its own, since
  it may need code changes. GitHub Actions in one pull request.
- Postgres and Keycloak images are updated everywhere they appear:
  `docker/compose.yaml` and the scripts that start them locally
  (`scripts/db-up.sh`, `scripts/keycloak-up.sh`).
- The Node base image digest is updated; Node major versions are never bumped
  (they're chosen on purpose: `.nvmrc`, `docker/Dockerfile`).
- The lockfile is refreshed weekly, for the dependencies of dependencies.

To change the policy for every project, change `default.json` in the starter
and merge it: Renovate reads it from the starter's default branch on its next
run. A project that needs an exception adds rules to its own `renovate.json`,
after the `extends`.

**Setup:** install the [Renovate GitHub app](https://github.com/apps/renovate)
on the starter and on each project's repository. Check the config with
`npx --package renovate renovate-config-validator default.json renovate.json`.

## Everything else: `yarn sync-from-starter`

Run it in a project, on a clean working tree, in a branch:

```bash
git switch -c sync-from-starter
yarn sync-from-starter --dry-run   # the starter's commits and what would change
yarn sync-from-starter             # apply it
yarn format && yarn verify && yarn test
git add -A && git commit -m "Sync from project-starter"
```

### What it does

`.starter.json`, committed in the project, records the starter commit of the
last sync, the project's names, and the paths the project owns:

```json
{
  "slug": "acme-portal",
  "title": "Acme Portal",
  "commit": "50965d53a90f08faa487a84cc550a3421ff46dee",
  "ignore": ["README.md", "packages/feature-bookings/**"]
}
```

For each file the starter changed between that commit and now, it takes three
versions, all with `yarn rename`'s rules applied (`@booking/*` becomes
`@acme-portal/*`, and so on): the starter's file at the last sync, the
starter's file now, and the project's file. Then:

| Situation                                              | Result                                                    |
| ------------------------------------------------------ | --------------------------------------------------------- |
| The project never changed the file                     | replaced by the starter's new version                     |
| Both changed it                                        | merged, like `git merge`; conflicts get `<<<<<<<` markers |
| New in the starter                                     | added                                                     |
| New in the starter, in a workspace the project removed | skipped (`packages/feature-bookings`, for example)        |
| Changed in the starter, deleted in the project         | skipped: the project's deletion stands                    |
| Deleted in the starter, unchanged in the project       | deleted                                                   |
| Deleted in the starter, changed in the project         | kept, and listed                                          |
| Matches a glob in `ignore`                             | skipped                                                   |

It never touches `yarn.lock`: when a `package.json` changed, it runs
`yarn install`, which rewrites it. The sync tooling itself
(`scripts/sync-from-starter.ts`, `scripts/rename.ts` and their tests) is always
the starter's version. When it's done, `.starter.json` records the new commit.

### Where it reads the starter

In order: `--from <dir>`, then `$STARTER_DIR`, then `../project-starter` (a
sibling checkout), and otherwise a fresh clone of the starter's repository.
It uses the checkout's current commit, so a local starter on a feature branch
syncs that branch: switch it to `main` and pull first, or pass `--ref main`
(`--ref origin/main` after a `git fetch`).

### Conflicts

A conflict means the starter and the project changed the same lines. The script
lists the files and exits with an error; `.starter.json` is updated anyway,
since the rest of the sync is done. Resolve the markers, then
`yarn install` (if a `package.json` was involved), `yarn format`, `yarn verify`.
To give up on the whole sync instead: `git checkout -- . && git clean -fd`.

A file that conflicts on every sync is one the project has made its own,
usually the README: add it to `ignore` and bring in what you want by hand.

### Starting with a project made before `.starter.json`

Find the starter commit it was made from (the starter's history around the
project's first commit; the files that differ least), then:

```bash
yarn sync-from-starter --base <commit> [--title "Display Name"] --dry-run
```

The sync script isn't in such a project yet: run the starter's copy from the
project's directory, `yarn tsx ../project-starter/scripts/sync-from-starter.ts --base <commit>`.
It brings the script in.

## Changing the starter so projects can follow

- **Merge pull requests into the starter with a merge commit**, not squash or
  rebase. Projects record starter commits in `.starter.json`; a squash leaves
  the recorded commit off `main`, and the next sync can't find it.
- Use the starter's names (`@booking/*`, `booking-platform`, `booking-db`, …)
  in new files, as the existing ones do: `yarn sync-from-starter` and
  `yarn rename` replace them. A new kind of name needs a rule in
  `scripts/rename.ts`, with a test.
- Small, focused commits sync better than large rewrites: a project that edited
  the same file conflicts on less.
- Put project-specific behaviour behind configuration rather than in files
  every project edits, when you can: fewer conflicts on every sync.
