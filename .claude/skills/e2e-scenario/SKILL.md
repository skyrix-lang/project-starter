---
name: e2e-scenario
description: Write an end-to-end scenario in this project, a Playwright test that plays one person's whole journey through a feature (sign up, use it, change it, come back), and check what it covers. Use when asked for a scenario, a user journey, a playthrough, an end-to-end test of a whole workflow, or to raise coverage through the e2e tests.
---

# Write an end-to-end scenario

A scenario plays one whole journey, as a person would live it, in one test.
The feature's other tests check each behaviour on its own. A scenario checks
that the steps work one after the other, with the state each step leaves
behind: what a person does on Monday is still there on Tuesday.
`e2e/bookings.scenario.spec.ts` is the reference: copy its shape. A project
that removed the demo bookings feature removed it too: copy one of its own
`e2e/*.scenario.spec.ts` instead, or follow the steps below.

## 1. Write the journey first, in words

List the steps from the person's side, before any code. One scenario is one
person with one goal, for example "a new user books, confirms, finds and
cancels a meeting", or in a game "a player creates a game, plays a full round
and sees the score". Include:

- the **start** a new person sees (an empty list, a first screen);
- **one mistake** they're likely to make, and how the app shows it;
- each **main step**, in order, each checked by what's on screen;
- **coming back**: a reload, or a second visit, shows what they did;
- the **end**: the state the journey leaves (a result, a score, a list).

Several goals make several scenarios. If two steps can't follow each other
(different people, different starting data), they're separate scenarios.

## 2. Write it

- File: `e2e/<feature>.scenario.spec.ts`. Import `test` and `expect` from
  `./support`, never from `@playwright/test`. Then console errors and axe
  violations fail it, and `yarn test:coverage` records its coverage.
- One `test(...)` named after the journey. Inside it, one `test.step(...)` per
  step from the list, named in the person's words. The report then reads like
  the journey, and a failure names the step.
- **Its own data, nothing shared.** Start with `test.use(signedOut)` and
  `signInAsNewUser(context, baseURL!)`, so the person starts empty, and use a
  unique value (`Date.now()`, `randomUUID()`) for what they create. Tests run
  in parallel on one database and never change seed data.
- **Only what a person does.** Click, type, read the screen, using role-based
  locators (`getByRole`, `getByLabel`), with `data-testid` only for repeated
  cards. Don't set up the middle of the journey through the API or the
  database: that's what the journey tests. A failure you can't cause from the
  page (the server down, a slow answer) is a `page.route` in the feature's
  other tests, not here.
- **Wait for the screen, never for time.** `await expect(...).toBeVisible()`
  waits on its own, so never use `waitForTimeout`. For a step that depends on
  the client, open the page with `gotoHydrated`.
- **Assert after each step**, so a failure stops at the step that broke, not
  three steps later.
- **Randomness and time.** If the app draws something at random (a deck, a
  dice roll, a shuffled board), the scenario must not depend on what it
  draws. Read what the screen shows and act on it: loop until the end,
  answering whatever each screen asks. If the journey needs one particular
  draw, control `Math.random` from the test with `page.addInitScript`, never
  from the app. A seed in the URL or a setting is fine only if people use it
  too (a shareable game). Never add a test-only route or a test-only code
  path (AGENTS.md, "Tests"). For time, use `page.clock`.

## 3. Check it

1. Run it, then run it again: `yarn test e2e/<feature>.scenario.spec.ts`. It
   must pass twice, so it doesn't depend on what the first run left behind.
2. Run it with no retries, as the nightly does:
   `E2E_RETRIES=0 yarn test e2e/<feature>.scenario.spec.ts --repeat-each 5`.
   A scenario that passes 4 times out of 5 is flaky: fix the wait, don't add
   a retry.
3. Break the code once (comment out the save, or invert the check) and see
   the scenario fail at the right step. Then put the code back.
4. See what it covers:
   `yarn test:coverage e2e/<feature>.scenario.spec.ts` (that file alone,
   minimums not checked), then open
   `coverage/report/index.html`. The files it covers well are the journey. The
   files it misses are other journeys, or behaviour for a unit test.

## 4. Coverage

`yarn test:coverage` counts the unit tests and the e2e tests together, and
fails below `coverage-minimums.json`. When a scenario raises coverage, raise
the minimums in the same pull request, to the new level rounded down. Never
lower them to make a run pass. Code that only a scenario can reach (a whole
screen, a flow across pages) belongs in a scenario. Logic with many cases (a
score, a rule, a parser) belongs in a unit test next to it, where each case
is quick to write.

## 5. Done

`yarn verify` and `yarn test` pass; the scenario failed once when the code was
broken; the minimums are updated if coverage went up. Report what the
scenario plays and what coverage it added.
