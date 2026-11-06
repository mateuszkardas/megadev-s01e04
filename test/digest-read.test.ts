import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('gives 5 jobs sorted by job and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries for fixtures/refresh', () => {
    expect(night?.rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps the last error for notes/backup', () => {
    const row = night?.rows.find((r) => r.job === 'notes/backup');
    expect(row?.lastStatus).toBe('fail');
    expect(row?.lastError).toBe('quota exceeded');
  });

  it('keeps a null owner', () => {
    expect(night?.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
  });
});

describe('readNight edge cases', () => {
  it('returns null for a missing file', () => {
    expect(readNight(tmp, '2026-01-01')).toBeNull();
  });

  it('returns null for an invalid night', () => {
    writeFileSync(join(tmp, 'x.jsonl'), '');
    expect(readNight(tmp, 'x')).toBeNull();
    expect(readNight(tmp, '../runs/2026-10-28')).toBeNull();
    expect(readNight(tmp, '2026-10-28.jsonl')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    writeFileSync(join(tmp, '2026-02-01.jsonl'), '');
    expect(readNight(tmp, '2026-02-01')).toEqual({ night: '2026-02-01', rows: [], badLines: 0 });
  });

  it('keeps null owners, offsets and the last owner; counts bad shapes', () => {
    const lines = [
      { at: '2026-02-02T23:00:00-05:00', job: 'b/job', status: 'retry', owner: null, error: 'boom' },
      { at: '2026-02-03T01:00:00+09:30', job: 'b/job', status: 'ok', owner: 'lane-07' },
      { at: '2026-02-03T02:00:00+02:00', job: 'a/job', status: 'ok', owner: null },
      { at: '2026-02-03T03:00:00+02:00', job: 'a/job', status: 'skipped', owner: null },
      { at: '2026-02-03T03:00:00+02:00', job: 'a/job', status: 'ok' },
      { at: 1, job: 'a/job', status: 'ok', owner: null },
    ].map((l) => JSON.stringify(l));
    writeFileSync(join(tmp, '2026-02-03.jsonl'), [...lines, '[]', 'not json', '', ''].join('\n'));

    const night = readNight(tmp, '2026-02-03');
    expect(night?.badLines).toBe(5);
    expect(night?.rows).toEqual([
      {
        job: 'a/job',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-02-03T02:00:00+02:00',
        lastAt: '2026-02-03T02:00:00+02:00',
      },
      {
        job: 'b/job',
        owner: 'lane-07',
        runs: 2,
        retries: 1,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-02-02T23:00:00-05:00',
        lastAt: '2026-02-03T01:00:00+09:30',
      },
    ]);
  });
});
