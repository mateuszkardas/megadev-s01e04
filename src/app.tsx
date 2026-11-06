import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestPage } from './views/digest.js';
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

  app.get('/digest/:night', (c) => {
    const nightParam = c.req.param('night');
    const data = readNight(config.runsDir, nightParam);
    if (data === null) {
      return c.html(
        <Layout title={`digest · ${nightParam}`} lane={lane()}>
          <h1>digest · {nightParam}</h1>
          <p class="mute">not found</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${data.night}`} lane={lane()}>
        <DigestPage night={data} />
      </Layout>,
    );
  });

  return app;
}
