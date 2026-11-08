import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, ReadNightResult, RunStatus } from './types.js';

// One definition of a night in the repo (plan.md § Decisions, Routes).
export const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/** One parsed, valid line of the run log. */
type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const STATUSES: ReadonlySet<string> = new Set<RunStatus>(['ok', 'retry', 'fail']);

function isRunStatus(value: unknown): value is RunStatus {
  return typeof value === 'string' && STATUSES.has(value);
}

/** A field that may be a string, `null`, or absent. */
function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

// The edge: everything after this trusts the types. A line is bad when it is not valid JSON or
// does not match the row schema (plan.md § Decisions, Reader). `owner` may be null or absent;
// `error` is optional. Any field of the wrong type makes the line bad.
function parseLine(line: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const parsedLine = value as Record<string, unknown>;
  if (typeof parsedLine.at !== 'string' || typeof parsedLine.job !== 'string') return null;
  if (!isRunStatus(parsedLine.status)) return null;
  if (!isOptionalString(parsedLine.owner) || !isOptionalString(parsedLine.error)) return null;

  return {
    at: parsedLine.at,
    job: parsedLine.job,
    status: parsedLine.status,
    owner: typeof parsedLine.owner === 'string' ? parsedLine.owner : null,
    error: typeof parsedLine.error === 'string' ? parsedLine.error : null,
  };
}

/** Folds the valid lines into one row per job, sorted by job. */
function foldLines(lines: Iterable<RunLine>): DigestRow[] {
  const rows = new Map<string, DigestRow>();
  for (const line of lines) {
    const row = rows.get(line.job);
    if (!row) {
      rows.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        fails: line.status === 'fail' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });

      continue;
    }

    row.runs += 1;
    if (line.status === 'retry') row.retries += 1;
    if (line.status === 'fail') row.fails += 1;
    row.lastStatus = line.status;
    row.lastAt = line.at;
    if (line.error !== null) row.lastError = line.error;
    if (row.owner === null) row.owner = line.owner;
  }

  return [...rows.values()].sort((left, right) => {
    if (left.job < right.job) return -1;
    if (left.job > right.job) return 1;
    return 0;
  });
}

/**
 * Reads `<runsDir>/<night>.jsonl` (plan.md § 1). Bad lines are counted, never thrown; blank
 * lines are skipped. A missing file throws the `fs` error (ENOENT): the route turns that into 404.
 */
export const readNight: ReadNight = (runsDir, night): ReadNightResult => {
  if (!NIGHT.test(night)) throw new RangeError(`not a night: ${night}`);

  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const validLines: RunLine[] = [];
  let badLinesCount = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.trim() === '') continue;

    const line = parseLine(rawLine);
    if (line === null) badLinesCount += 1;
    else validLines.push(line);
  }

  return { rows: foldLines(validLines), badLinesCount };
};
