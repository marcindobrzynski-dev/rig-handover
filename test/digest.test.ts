import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { countNight } from '../src/digest/count-night.js';
import { readNight } from '../src/digest/read-night.js';

// runs/ is read-only: real nights, used as they are (AGENTS.md).
describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const rowsByJob = Object.fromEntries(night.rows.map((row) => [row.job, row]));

  it('folds 16 lines into 5 jobs and counts the 1 bad line', () => {
    expect(night.rows).toHaveLength(5);
    expect(night.badLinesCount).toBe(1);
  });

  it('fixtures/refresh: 4 runs, 3 retries, last status ok, lastError kept from the retries', () => {
    expect(rowsByJob['fixtures/refresh']).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      fails: 0,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('notes/backup failed once; digest/render ran with no owner and no error', () => {
    expect(rowsByJob['notes/backup']).toMatchObject({ runs: 1, fails: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(rowsByJob['digest/render']).toMatchObject({ owner: null, lastStatus: 'ok', lastError: null });
  });

  it('rows come sorted by job', () => {
    expect(night.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('countNight: 4 ok · 2 retried · 1 fail, per job not per line', () => {
    expect(countNight(night.rows)).toEqual({ ok: 4, retried: 2, fail: 1 });
  });
});

describe('readNight edge rules (temp runs dir)', () => {
  const tempRunsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(tempRunsDir, { recursive: true, force: true }));

  function readTempNight(night: string, lines: string[]) {
    writeFileSync(join(tempRunsDir, `${night}.jsonl`), lines.join('\n') + '\n');
    return readNight(tempRunsDir, night);
  }

  it('skips blank lines without counting them, counts bad JSON and schema misses', () => {
    const result = readTempNight('2026-01-01', [
      '{"at":"2026-01-01T23:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '',
      '   ',
      '{not json',
      '{"at":"2026-01-01T23:01:00+01:00","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T23:02:00+01:00","job":"a","status":"skipped","owner":"x"}',
      '[1,2]',
    ]);
    expect(result.badLinesCount).toBe(4);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ job: 'a', runs: 1 });
  });

  it('keeps the last error even when the last line is ok, and keeps the log offset', () => {
    const result = readTempNight('2026-01-02', [
      '{"at":"2026-01-02T22:00:00-05:00","job":"b","status":"fail","owner":"y","error":"first"}',
      '{"at":"2026-01-02T22:10:00-05:00","job":"b","status":"retry","owner":"y","error":"second"}',
      '{"at":"2026-01-02T22:20:00-05:00","job":"b","status":"ok","owner":"y"}',
    ]);
    expect(result.rows[0]).toMatchObject({
      runs: 3,
      retries: 1,
      fails: 1,
      lastStatus: 'ok',
      lastError: 'second',
      firstAt: '2026-01-02T22:00:00-05:00',
      lastAt: '2026-01-02T22:20:00-05:00',
    });
  });

  it('an empty file is a night with no rows and no bad lines', () => {
    expect(readTempNight('2026-01-03', [])).toEqual({ rows: [], badLinesCount: 0 });
  });

  it('a night with no file throws, so the route can answer 404', () => {
    expect(() => readNight(tempRunsDir, '2026-01-04')).toThrow();
  });

  it('refuses a :night that is not YYYY-MM-DD', () => {
    expect(() => readNight(tempRunsDir, '../2026-01-01')).toThrow(RangeError);
  });

  it('countNight on no rows is all zeros', () => {
    expect(countNight([])).toEqual({ ok: 0, retried: 0, fail: 0 });
  });
});
