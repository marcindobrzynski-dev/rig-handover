import type { CountNight, NightCounts } from './types.js';

/** Per job, not per line (plan.md § Decisions, Routes). Views only render what this returns. */
export const countNight: CountNight = (rows): NightCounts => ({
  ok: rows.filter(row => row.lastStatus === 'ok').length,
  retried: rows.filter(row => row.retries > 0).length,
  fail: rows.filter(row => row.lastStatus === 'fail').length,
});
