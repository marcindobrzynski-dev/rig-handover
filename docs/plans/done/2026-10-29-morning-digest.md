---
plan: morning-digest
status: done
owner: rook
opened: 2026-10-29
closed: 2026-11-08
---

# Morning digest

The night's run log is a JSONL file nobody reads. By breakfast someone has to know what ran,
what retried, what failed, and whose it was, without opening `runs/`. rig already serves the
status board; the digest is one more page on it.

Out of scope: notifications, history across nights, auth (rig only listens on localhost).

## 1. Run log reader

Read `runs/<night>.jsonl` into one row per job: job, owner, runs, retries, last status, last
error, first and last time. One JSON object per line (`at`, `job`, `status`: `ok | retry | fail`,
`owner`, optional `error`).

- A line that doesn't parse is counted, never thrown. The night still renders.
- `owner` can be `null`. Keep the row; show the owner as `—`.
- Lives in `src/digest/`. Commit `src/digest/types.ts` first (the `DigestRow` type and the
  `readNight(runsDir, night)` signature), so every part of section 2 can start against it.

Done when: reader tests pass on `runs/2026-10-28.jsonl` (5 jobs, 1 bad line).

## 2. Digest page

Four small parts. Each needs only `src/digest/types.ts` from section 1, so once that is in they
can go to four workers at once. Small, well-specified work: a cheaper model is fine here.

### 2a. Page

`GET /digest/:night` renders the rows with the usual layout: one table, sorted by job, retries of
3 or more and any `fail` marked. A night with no file returns 404; an empty file renders
"nothing ran".

Done when: `/digest/2026-10-28` renders locally.

### 2b. JSON

`GET /api/digest/:night` returns the same rows as JSON. Agents read this one; the page and the
JSON must never disagree (ADR 0001).

Done when: the JSON for 2026-10-28 has the same jobs, in the same order, as the page.

### 2c. Board link

The status board links each night on disk to its digest, with its ok / retry / fail counts beside
it.

Done when: both nights on disk link to a digest that renders.

### 2d. Route tests

Route tests for 2a and 2b: 200, 404 for a night with no file, the empty night, a night with a bad
line. Use a temp runs dir; `runs/` is read-only.

Done when: `pnpm test` is green with the new tests.

## 3. Preview for review

The reviewer reads the page from a copy, not from the lane. Run rig and save `/digest/2026-10-28` as
one HTML file, lane banner included (a command, not a browser's "save as"; the page is
self-contained, ADR 0001). Put it on your own public host, one where you can upload over it later (any bucket
or static host, ADR 0003), so it opens from a public HTTPS link. Send the reviewer the link and the
issues for this plan.

Done when: the preview link is sent to the reviewer.

## 4. Clean up

The preview carries this lane's marker on a public link (ADR 0003). Take the marker off: save the
page again with `LANE_MARKER` unset (the banner reads "no marker set") and upload it over the same
link. Move this plan to `docs/plans/done/` with its issue list.

Done when: the preview link no longer shows the lane marker.

## Decisions

Settled 2026-11-07 by Marcin Dobrzyński before the split. They bind every issue of this plan.

### Reader (§1)

- `runs` = number of lines a job has in the night; `retries` = number of its lines with
  status `retry`.
- `lastError` = the last `error` seen for the job in the night, even when its last line is `ok`.
  No error in the night → `—`.
- A bad line = a line that is not valid JSON, or valid JSON that does not match the row schema
  (missing `at`/`job`, status outside `ok | retry | fail`). Blank lines are skipped, not counted.
- `readNight(runsDir, night)` returns `{ rows: DigestRow[], badLinesCount: number }`. The page
  shows the count; the JSON carries it.
- Counting lives in its own file in `src/digest/` (`countNight(rows): NightCounts`), signature
  in `types.ts`. Views only render what it returns.
- Times stay full ISO 8601 with the log's offset, e.g. `2026-10-29T05:00:04+01:00`.

### Routes (§2)

- One definition of a night in the repo: `^\d{4}-\d{2}-\d{2}$`. A `:night` that does not match
  → 404, same as a night with no file. No 400.
- Deviation from §1: the contract issue also adds `GET /digest/:night` and
  `GET /api/digest/:night` to `src/app.tsx` answering 501, so route tests can be written before
  the routes exist.
- Row marking: a row with any `fail` line, or `retries >= 3`, gets class `.warn` (red) **and**
  plain text in the cell (`fail`, `3 retries`), so an agent reading the HTML sees it too.
- Board counts are per job, not per line: `ok` = jobs whose last status is `ok`, `fail` = jobs
  whose last status is `fail`, `retried` = jobs with at least one `retry` line.
  2026-10-28 → `4 ok · 2 retried · 1 fail`.

### Work order

- §1 splits into two issues: contract (`types.ts` + 501 stubs; done when `pnpm typecheck` passes
  and both routes answer 501) and reader (+ counting file + reader tests).
- Route tests (§2d) are written right after the contract merges and are expected red until the
  page and the JSON land. The page (§2a) and the JSON (§2b) start only after the tests merge;
  they are done when those tests go green.
- Blocked by: reader ← contract; tests ← contract; page, JSON ← tests; board ← reader, page;
  preview ← page, JSON, board, tests; clean up ← preview.
- Branches: page and JSON will both touch `src/app.tsx`; rebase onto `develop` before the PR.
- Models: contract → Opus 5.5; reader and route tests → Fable 5.1 (tests must check business
  inputs and outputs, no tautological or characterisation tests); page, JSON, board, preview,
  clean up → Sonnet 5.5.
- Every issue: `Source: plan.md § <n>`, `Scope`, `Done when` (verbatim from the plan),
  `Blocked by`, `Read` (AGENTS.md, styleguide, cited ADRs, this section), `Model`; label
  `plan:morning-digest`; title `<area>: <what>`.

### Preview (§3, §4)

- Host: Netlify, one site, the page saved as `index.html`, so the link is the site root.
  `netlify deploy --prod --dir <folder> --no-build --site <name>`; the same command re-uploads
  over the same link in §4.
- The file is made by a command while rig runs:
  `curl -fsS http://localhost:8787/digest/2026-10-28 -o <folder>/index.html`, into a folder
  outside the repo (the OS temp dir). Nothing is added to `.gitignore`.
- Only the lane marker comes off in §4. Job names, owners and error texts stay public
  (ADR 0003 covers the marker only).
- Clean up moves this file to `docs/plans/done/2026-10-29-morning-digest.md`. Merging `develop`
  into `main` is the lead's release step, outside the issues.
- Every upload and every other outside action waits for the lead's yes.

## Issues

| # | Issue | Blocked by | Worker | Closed |
|---|-------|-----------|--------|--------|
| 3 | digest: contract types.ts + 501 stubs | — | claude-code · claude-opus-5-5 · medium | 2026-11-08 |
| 4 | digest: run log reader, counting, reader tests | #3 | claude-code · claude-fable-5-1 · medium | 2026-11-08 |
| 5 | digest: route tests for page and JSON (red first) | #3 | claude-code · claude-fable-5-1 · medium | 2026-11-08 |
| 6 | digest: GET /digest/:night page | #5 | claude-code · claude-sonnet-5-5 · high | 2026-11-08 |
| 7 | api: GET /api/digest/:night JSON | #5 | claude-code · claude-sonnet-5-5 · high | 2026-11-08 |
| 8 | board: link each night to its digest with per-job counts | #4, #6 | claude-code · claude-sonnet-5-5 · high | 2026-11-08 |
| 9 | preview: save /digest/2026-10-28 as HTML, publish on Netlify, send reviewer | #5, #6, #7, #8 | claude-code · claude-sonnet-5-5 · high | 2026-11-08 |
| 10 | clean up: re-upload without marker, archive plan | #9 | claude-code · claude-sonnet-5-5 · high | 2026-11-08 |
