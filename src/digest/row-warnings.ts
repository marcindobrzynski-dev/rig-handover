import type { DigestRow } from './types.js';

/** A job that retried this many times or more is marked (plan.md § Decisions, Routes). */
export const RETRY_WARN_AT = 3;

/**
 * Plain-text reasons a row is marked: `fail` for any fail line, `<n> retries` from
 * `RETRY_WARN_AT` up. Empty means the row is fine. The text is what an agent reading the HTML
 * sees, so it never depends on the `.warn` colour.
 */
export function rowWarnings(row: Pick<DigestRow, 'fails' | 'retries'>): string[] {
  const warnings: string[] = [];
  if (row.fails > 0) warnings.push('fail');
  if (row.retries >= RETRY_WARN_AT) warnings.push(`${row.retries} retries`);

  return warnings;
}
