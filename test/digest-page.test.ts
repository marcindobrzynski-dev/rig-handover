import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Page-only behaviour of GET /digest/:night (issue #6): what the route tests from #5 do not
// pin down. Row marking, missing data, times and the bad-line count, through app.request().

const NIGHT = '2026-11-02';
const ONE_BAD_LINE_NIGHT = '2026-11-03';
const CLEAN_NIGHT = '2026-11-04';

const nightLines = [
  // Three retries, never failed: marked at the threshold.
  { at: '2026-11-02T01:00:00+01:00', job: 'flaky/sync', status: 'retry', owner: 'rook' },
  { at: '2026-11-02T01:05:00+01:00', job: 'flaky/sync', status: 'retry', owner: 'rook' },
  { at: '2026-11-02T01:10:00+01:00', job: 'flaky/sync', status: 'retry', owner: 'rook' },
  { at: '2026-11-02T01:15:00+01:00', job: 'flaky/sync', status: 'ok', owner: 'rook' },
  // Two retries: one below the threshold, not marked.
  { at: '2026-11-02T02:00:00+01:00', job: 'calm/pull', status: 'retry', owner: 'lane-07' },
  { at: '2026-11-02T02:05:00+01:00', job: 'calm/pull', status: 'retry', owner: 'lane-07' },
  { at: '2026-11-02T02:10:00+01:00', job: 'calm/pull', status: 'ok', owner: 'lane-07' },
  // A fail line followed by ok: still marked, "any fail line".
  {
    at: '2026-11-02T03:00:00+01:00',
    job: 'broken/backup',
    status: 'fail',
    owner: null,
    error: 'quota exceeded',
  },
  { at: '2026-11-02T03:30:00+01:00', job: 'broken/backup', status: 'ok', owner: null },
  // A clean job: no marking, no error.
  { at: '2026-11-02T04:00:00+01:00', job: 'clean/rotate', status: 'ok', owner: 'lane-07' },
];

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-page-'));
  writeFileSync(
    join(runsDir, `${NIGHT}.jsonl`),
    nightLines.map((line) => JSON.stringify(line)).join('\n') + '\n',
  );
  writeFileSync(
    join(runsDir, `${ONE_BAD_LINE_NIGHT}.jsonl`),
    [
      JSON.stringify({ at: '2026-11-03T01:00:00+01:00', job: 'a/b', status: 'ok', owner: 'rook' }),
      'not json',
    ].join('\n'),
  );
  writeFileSync(
    join(runsDir, `${CLEAN_NIGHT}.jsonl`),
    JSON.stringify({ at: '2026-11-04T01:00:00+01:00', job: 'a/b', status: 'ok', owner: 'rook' }),
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

async function pageHtml(night: string) {
  const res = await app.request(`/digest/${night}`);
  return res.text();
}

// The `<tr>…</tr>` that holds the given job name.
function rowOf(html: string, job: string) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) ?? [];
  const row = rows.find((candidate) => candidate.includes(job));
  if (row === undefined) throw new Error(`no row for ${job} in:\n${html}`);
  return row;
}

describe('row marking', () => {
  it('marks 3 retries with class warn and the text "3 retries"', async () => {
    const row = rowOf(await pageHtml(NIGHT), 'flaky/sync');
    expect(row).toMatch(/<tr[^>]*class="warn"/);
    expect(row).toContain('3 retries');
  });

  it('does not mark 2 retries', async () => {
    const row = rowOf(await pageHtml(NIGHT), 'calm/pull');
    expect(row).not.toMatch(/class="warn"/);
    expect(row).not.toMatch(/retries/);
  });

  it('marks any fail line, even if the last line is ok: class warn, text "fail"', async () => {
    const row = rowOf(await pageHtml(NIGHT), 'broken/backup');
    expect(row).toMatch(/<tr[^>]*class="warn"/);
    expect(row).toMatch(/<td[^>]*>[^<]*\bfail\b[^<]*<\/td>/);
  });

  it('does not mark a clean job', async () => {
    const row = rowOf(await pageHtml(NIGHT), 'clean/rotate');
    expect(row).not.toMatch(/class="warn"/);
  });
});

describe('cells', () => {
  it('shows the owner as — when the log has null', async () => {
    const row = rowOf(await pageHtml(NIGHT), 'broken/backup');
    expect(row).toContain('<td>—</td>');
    expect(row).not.toContain('null');
  });

  it('shows the last error, even when the last line is ok', async () => {
    const row = rowOf(await pageHtml(NIGHT), 'broken/backup');
    expect(row).toContain('quota exceeded');
  });

  it('shows — in the last error column for a job with no error', async () => {
    const html = await pageHtml(NIGHT);
    const headers = [...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((match) => match[1]);
    const cells = [...rowOf(html, 'clean/rotate').matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map(
      (match) => match[1].trim(),
    );
    expect(cells[headers.indexOf('last error')]).toBe('—');
  });

  it('shows the first and last time as full ISO with the log offset', async () => {
    const row = rowOf(await pageHtml(NIGHT), 'flaky/sync');
    expect(row).toContain('2026-11-02T01:00:00+01:00');
    expect(row).toContain('2026-11-02T01:15:00+01:00');
  });

  it('shows the number of runs and retries', async () => {
    const row = rowOf(await pageHtml(NIGHT), 'flaky/sync');
    expect(row).toContain('<td>4</td>');
    expect(row).toContain('<td>3</td>');
  });
});

describe('order', () => {
  it('sorts the table by job', async () => {
    const html = await pageHtml(NIGHT);
    const jobs = ['broken/backup', 'calm/pull', 'clean/rotate', 'flaky/sync'];
    const positions = jobs.map((job) => html.indexOf(job));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });
});

describe('bad line count', () => {
  it('says "0 bad lines" when there are none', async () => {
    expect(await pageHtml(CLEAN_NIGHT)).toMatch(/\b0 bad lines\b/);
  });

  it('says "1 bad line", singular, for one', async () => {
    const html = await pageHtml(ONE_BAD_LINE_NIGHT);
    expect(html).toMatch(/\b1 bad line\b(?!s)/);
  });
});
