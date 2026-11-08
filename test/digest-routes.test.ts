import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Route tests for the digest page (§2a) and the JSON (§2b), written against the plan, not the
// implementation. They stay red until both land (plan.md § Decisions, Work order).

const NIGHT = '2026-10-28';
const EMPTY_NIGHT = '2026-10-30';
const BAD_LINES_NIGHT = '2026-10-31';
const MISSING_NIGHT = '2026-11-01';

// Written out of job order on purpose: the page sorts by job (§2a).
const nightLines = [
  { at: '2026-10-28T23:00:02+01:00', job: 'zeta/rotate-logs', status: 'ok', owner: 'lane-07' },
  { at: '2026-10-29T01:30:00+01:00', job: 'mid/refresh', status: 'retry', owner: 'rook', error: 'upstream 503' },
  { at: '2026-10-29T01:37:00+01:00', job: 'mid/refresh', status: 'ok', owner: 'rook' },
  { at: '2026-10-29T04:00:01+01:00', job: 'alpha/backup', status: 'fail', owner: null, error: 'quota exceeded' },
];
const jobsSortedByJob = ['alpha/backup', 'mid/refresh', 'zeta/rotate-logs'];

const badLinesNight = [
  JSON.stringify({ at: '2026-10-31T23:00:00+01:00', job: 'only/job', status: 'ok', owner: 'rook' }),
  '{not json at all',
  JSON.stringify({ at: '2026-10-31T23:05:00+01:00', job: 'only/job', status: 'meh', owner: 'rook' }),
  '',
].join('\n');

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(runsDir, `${NIGHT}.jsonl`), nightLines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  writeFileSync(join(runsDir, `${EMPTY_NIGHT}.jsonl`), '');
  writeFileSync(join(runsDir, `${BAD_LINES_NIGHT}.jsonl`), badLinesNight);
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

type DigestJson = { rows: { job: string }[]; badLinesCount: number };

async function page(night: string) {
  const res = await app.request(`/digest/${night}`);
  return { res, html: await res.text() };
}

async function api(night: string) {
  const res = await app.request(`/api/digest/${night}`);
  return { res, body: res.status === 200 ? ((await res.json()) as DigestJson) : null };
}

// Position of each job name in the HTML, in the given order. Markup-independent: it holds for
// any table shape, as long as every job is on the page and they come in this order.
function positionsIn(html: string, jobs: string[]) {
  return jobs.map((job) => html.indexOf(job));
}

describe('GET /digest/:night', () => {
  it('renders a night with a file: 200, every job, null owner shown as —', async () => {
    const { res, html } = await page(NIGHT);
    expect(res.status).toBe(200);
    for (const job of jobsSortedByJob) expect(html).toContain(job);
    expect(html).toContain('—');
  });

  it('is 404 for a night with no file', async () => {
    const { res } = await page(MISSING_NIGHT);
    expect(res.status).toBe(404);
  });

  it.each(['latest', '2026-1-5', '20261028', '2026-10-28.jsonl'])(
    'is 404 for a :night that is not YYYY-MM-DD (%s)',
    async (night) => {
      const { res } = await page(night);
      expect(res.status).toBe(404);
    },
  );

  it('renders the empty night as "nothing ran"', async () => {
    const { res, html } = await page(EMPTY_NIGHT);
    expect(res.status).toBe(200);
    expect(html).toMatch(/nothing ran/i);
  });

  it('still renders a night with bad lines and reports their count', async () => {
    const { res, html } = await page(BAD_LINES_NIGHT);
    expect(res.status).toBe(200);
    expect(html).toContain('only/job');
    expect(html).toMatch(/2 bad lines/i);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the rows sorted by job and the bad-line count', async () => {
    const { res, body } = await api(NIGHT);
    expect(res.status).toBe(200);
    expect(body?.rows.map((row) => row.job)).toEqual(jobsSortedByJob);
    expect(body?.badLinesCount).toBe(0);
  });

  it('is 404 for a night with no file', async () => {
    const { res } = await api(MISSING_NIGHT);
    expect(res.status).toBe(404);
  });

  it.each(['latest', '2026-1-5'])('is 404 for a :night that is not YYYY-MM-DD (%s)', async (night) => {
    const { res } = await api(night);
    expect(res.status).toBe(404);
  });

  it('returns no rows for the empty night', async () => {
    const { res, body } = await api(EMPTY_NIGHT);
    expect(res.status).toBe(200);
    expect(body?.rows).toEqual([]);
    expect(body?.badLinesCount).toBe(0);
  });

  it('counts invalid JSON and a bad schema as bad lines, skips the blank line', async () => {
    const { res, body } = await api(BAD_LINES_NIGHT);
    expect(res.status).toBe(200);
    expect(body?.rows.map((row) => row.job)).toEqual(['only/job']);
    expect(body?.badLinesCount).toBe(2);
  });
});

describe('page and JSON agree (ADR 0001)', () => {
  it('list the same jobs in the same order', async () => {
    const [{ html }, { body }] = await Promise.all([page(NIGHT), api(NIGHT)]);

    const jobs = body?.rows.map((row) => row.job) ?? [];
    expect(jobs).toEqual(jobsSortedByJob);
    
    const positions = positionsIn(html, jobs);
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });
});
