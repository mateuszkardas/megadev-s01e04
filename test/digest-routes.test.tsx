import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

function jobsFromDigestHtml(html: string): string[] {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbody) return [];
  const rows = [...tbody[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
  const jobs: string[] = [];
  for (const row of rows) {
    const firstCell = row[1].match(/<td>([^<]*)<\/td>/);
    if (firstCell) jobs.push(firstCell[1]);
  }
  return jobs;
}

describe('digest routes', () => {
  let runsDir!: string;

  beforeAll(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));

    const nightWithJobs = '2026-05-01';
    writeFileSync(
      join(runsDir, `${nightWithJobs}.jsonl`),
      [
        JSON.stringify({
          at: '2026-05-01T10:00:00+02:00',
          job: 'zebra/run',
          status: 'ok',
          owner: 'lane-07',
        }),
        JSON.stringify({
          at: '2026-05-01T09:00:00+02:00',
          job: 'alpha/run',
          status: 'ok',
          owner: null,
        }),
      ].join('\n'),
    );

    writeFileSync(join(runsDir, '2026-05-03.jsonl'), '');

    writeFileSync(
      join(runsDir, '2026-05-04.jsonl'),
      [
        JSON.stringify({
          at: '2026-05-04T08:00:00+02:00',
          job: 'good/two',
          status: 'ok',
          owner: 'rook',
        }),
        'not valid json',
        JSON.stringify({
          at: '2026-05-04T07:00:00+02:00',
          job: 'good/one',
          status: 'retry',
          owner: null,
          error: 'later ok',
        }),
      ].join('\n'),
    );
  });

  afterAll(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  const config = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    get runsDir(): string {
      return runsDir;
    },
  };

  it('GET /digest/:night and GET /api/digest/:night return 200 with jobs sorted by job', async () => {
    const app = createApp(config);
    const night = '2026-05-01';

    const htmlRes = await app.request(`/digest/${night}`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain('zebra/run');
    expect(html).toContain('alpha/run');
    const jobsFromPage = jobsFromDigestHtml(html);
    expect(jobsFromPage).toEqual(['alpha/run', 'zebra/run']);

    const jsonRes = await app.request(`/api/digest/${night}`);
    expect(jsonRes.status).toBe(200);
    const body = (await jsonRes.json()) as Night;
    expect(body.rows.map((r) => r.job)).toEqual(jobsFromPage);
  });

  it('GET /digest/:night and GET /api/digest/:night return 404 when the file is missing', async () => {
    const app = createApp(config);
    const night = '2026-05-02';

    const htmlRes = await app.request(`/digest/${night}`);
    expect(htmlRes.status).toBe(404);
    expect(await htmlRes.text()).toContain('not found');

    const jsonRes = await app.request(`/api/digest/${night}`);
    expect(jsonRes.status).toBe(404);
    expect(await jsonRes.json()).toEqual({ error: 'no such night' });
  });

  it('empty file: page shows nothing ran; JSON has rows [] and badLines 0', async () => {
    const app = createApp(config);
    const night = '2026-05-03';

    const htmlRes = await app.request(`/digest/${night}`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain('nothing ran');

    const jsonRes = await app.request(`/api/digest/${night}`);
    expect(jsonRes.status).toBe(200);
    expect(await jsonRes.json()).toEqual({ night, rows: [], badLines: 0 });
  });

  it('bad line: page shows good rows and notice; JSON has badLines 1', async () => {
    const app = createApp(config);
    const night = '2026-05-04';

    const htmlRes = await app.request(`/digest/${night}`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(jobsFromDigestHtml(html)).toEqual(['good/one', 'good/two']);
    expect(html).toContain('1 line(s) could not be read');

    const jsonRes = await app.request(`/api/digest/${night}`);
    expect(jsonRes.status).toBe(200);
    const body = (await jsonRes.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['good/one', 'good/two']);
  });

  it('invalid night returns 404 for HTML and JSON', async () => {
    const app = createApp(config);
    const night = 'not-a-date';

    const htmlRes = await app.request(`/digest/${night}`);
    expect(htmlRes.status).toBe(404);

    const jsonRes = await app.request(`/api/digest/${night}`);
    expect(jsonRes.status).toBe(404);
    expect(await jsonRes.json()).toEqual({ error: 'no such night' });
  });
});
