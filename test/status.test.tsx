import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });

  it('links each night on disk to its digest, with per-job counts beside it', async () => {
    const html = await (await createApp(config).request('/')).text();

    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('4 ok · 2 retried · 1 fail');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
    expect(html).toContain('4 ok · 0 retried · 0 fail');
  });

  it('links every night on disk to a digest that renders', async () => {
    const app = createApp(config);
    const html = await (await app.request('/')).text();
    const links = [...html.matchAll(/href="(\/digest\/[^"]+)"/g)].map((match) => match[1]!);

    expect(links).toHaveLength(2);
    for (const link of links) {
      expect((await app.request(link)).status).toBe(200);
    }
  });

  // Two valid jobs among lines that are not jobs: broken JSON, a status outside the schema, a
  // line with no `job`, and a blank line.
  const badLinesNight = [
    JSON.stringify({ at: '2026-11-04T01:00:00+01:00', job: 'x/ok', status: 'ok', owner: 'rook' }),
    '{not json at all',
    JSON.stringify({ at: '2026-11-04T02:00:00+01:00', job: 'y/bad-status', status: 'meh' }),
    JSON.stringify({ at: '2026-11-04T03:00:00+01:00', status: 'fail', owner: 'rook' }),
    '',
    JSON.stringify({ at: '2026-11-04T04:00:00+01:00', job: 'z/retry', status: 'retry' }),
    '',
  ].join('\n');

  describe('counts per job, not per line', () => {
    let runsDir: string;

    beforeAll(() => {
      runsDir = mkdtempSync(join(tmpdir(), 'rig-status-'));
      const lines = [
        { at: '2026-11-02T01:00:00+01:00', job: 'a/retry-then-ok', status: 'retry', owner: 'rook' },
        { at: '2026-11-02T01:05:00+01:00', job: 'a/retry-then-ok', status: 'retry', owner: 'rook' },
        { at: '2026-11-02T01:10:00+01:00', job: 'a/retry-then-ok', status: 'ok', owner: 'rook' },
        { at: '2026-11-02T02:00:00+01:00', job: 'b/fail-then-ok', status: 'fail', owner: null },
        { at: '2026-11-02T02:10:00+01:00', job: 'b/fail-then-ok', status: 'ok', owner: null },
        { at: '2026-11-02T03:00:00+01:00', job: 'c/ok-then-fail', status: 'ok', owner: 'rook' },
        { at: '2026-11-02T03:10:00+01:00', job: 'c/ok-then-fail', status: 'fail', owner: 'rook' },
        { at: '2026-11-02T04:00:00+01:00', job: 'd/retry-last', status: 'retry', owner: 'rook' },
      ];
      writeFileSync(
        join(runsDir, '2026-11-02.jsonl'),
        lines.map((line) => JSON.stringify(line)).join('\n') + '\n',
      );
      writeFileSync(join(runsDir, '2026-11-03.jsonl'), '');
      writeFileSync(join(runsDir, '2026-11-04.jsonl'), badLinesNight);
    });

    afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

    it('counts jobs by last status, and a retry anywhere makes the job retried', async () => {
      const html = await (await createApp({ ...config, runsDir }).request('/')).text();

      // ok: a, b. fail: c. retried: a, d. Four jobs, eight lines.
      expect(html).toContain('2 ok · 2 retried · 1 fail');
    });

    it('a night with bad lines is linked and counts only its valid jobs', async () => {
      const html = await (await createApp({ ...config, runsDir }).request('/')).text();

      // ok: x. retried: z. The bad lines are not jobs, so no fail.
      expect(html).toContain('<a href="/digest/2026-11-04">2026-11-04</a>');
      expect(html).toContain('1 ok · 1 retried · 0 fail');
    });

    it('an empty night is still linked, with zero counts', async () => {
      const html = await (await createApp({ ...config, runsDir }).request('/')).text();

      expect(html).toContain('<a href="/digest/2026-11-03">2026-11-03</a>');
      expect(html).toContain('0 ok · 0 retried · 0 fail');
    });
  });
});
