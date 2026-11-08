// Contract for the morning digest (plan.md § 1, § Decisions). Types only: the reader and the
// counting file implement these signatures, the page, the JSON and the board consume them.

/** Status of one line in a night's run log. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's night, folded from all of its lines in `runs/<night>.jsonl`. */
export type DigestRow = {
  job: string;
  /** `null` in the log is kept; views render it as `—`. */
  owner: string | null;
  /** Number of lines the job has in the night. */
  runs: number;
  /** Number of the job's lines with status `retry`. */
  retries: number;
  /** Number of the job's lines with status `fail` */
  fails: number;
  /** Status of the job's last line. */
  lastStatus: RunStatus;
  /** Last `error` seen for the job in the night, even when its last line is `ok`; `null` → `—`. */
  lastError: string | null;
  /** `at` of the job's first line, full ISO 8601 with the log's offset. */
  firstAt: string;
  /** `at` of the job's last line, full ISO 8601 with the log's offset. */
  lastAt: string;
};

export type ReadNightResult = {
  rows: DigestRow[];
  /** Lines that are not valid JSON or do not match the row schema. Blank lines are not counted. */
  badLinesCount: number;
};

/**
 * Reads `<runsDir>/<night>.jsonl`. A bad line is counted, never thrown.
 * `night` matches `^\d{4}-\d{2}-\d{2}$`.
 */
export type ReadNight = (runsDir: string, night: string) => ReadNightResult;

/** Counts per job, not per line (plan.md § Decisions, Routes). */
export type NightCounts = {
  /** Jobs whose last status is `ok`. */
  ok: number;
  /** Jobs with at least one `retry` line. */
  retried: number;
  /** Jobs whose last status is `fail`. */
  fail: number;
};

export type CountNight = (rows: DigestRow[]) => NightCounts;

/** One night on disk with its per-job counts; `counts` is `null` when the night can't be loaded. */
export type NightSummary = {
  night: string;
  counts: NightCounts | null;
};
