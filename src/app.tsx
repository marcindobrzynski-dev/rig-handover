import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { NIGHT, readNight } from './digest/read-night.js';
import type { ReadNightResult } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

function isMissingFile(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (context) => context.json({ ok: true, lane: lane().id }));

  app.get('/', (context) =>
    context.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (context) => {
    const night = context.req.param('night');
    if (!NIGHT.test(night)) return context.notFound();

    let digest: ReadNightResult;
    try {
      digest = readNight(config.runsDir, night);
    } catch (error) {
      if (isMissingFile(error)) return context.notFound();
      throw error;
    }

    return context.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} digest={digest} />
      </Layout>,
    );
  });

  // Contract stub (issue #3): answers 501 until the JSON (§2b) lands.
  app.get('/api/digest/:night', (context) => context.json({ error: 'not implemented' }, 501));

  return app;
}
