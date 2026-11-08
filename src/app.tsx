import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  // Contract stubs (issue #3): answer 501 until the page (§2a) and the JSON (§2b) land.
  app.get('/digest/:night', (c) => c.text('not implemented', 501));
  app.get('/api/digest/:night', (c) => c.json({ error: 'not implemented' }, 501));

  return app;
}
