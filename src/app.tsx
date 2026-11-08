import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { loadNight } from './digest/load-night.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

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
    const digest = loadNight(config.runsDir, night);
    if (!digest) return context.notFound();

    return context.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} digest={digest} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (context) => {
    const digest = loadNight(config.runsDir, context.req.param('night'));
    if (!digest) return context.notFound();

    return context.json(digest);
  });

  return app;
}
