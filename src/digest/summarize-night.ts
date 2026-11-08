import { countNight } from './count-night.js';
import { loadNight } from './load-night.js';
import type { NightSummary } from './types.js';

/** A night for the status board: its name and per-job counts, loaded the way the page loads it. */
export function summarizeNight(runsDir: string, night: string): NightSummary {
  const digest = loadNight(runsDir, night);

  return { night, counts: digest ? countNight(digest.rows) : null };
}
