import { NIGHT, readNight } from './read-night.js';
import type { ReadNightResult } from './types.js';

function isMissingFile(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/**
 * The one way the page and the JSON get a night (ADR 0001: they must never disagree).
 * `null` means 404: a `night` that is not `YYYY-MM-DD`, or a night with no file. Any other
 * failure still throws.
 */
export function loadNight(runsDir: string, night: string): ReadNightResult | null {
  if (!NIGHT.test(night)) return null;

  try {
    return readNight(runsDir, night);
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}
