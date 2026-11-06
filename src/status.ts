import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: { night: string; counts: { ok: number; retry: number; fail: number } | null }[];
};

function countsForNight(runsDir: string, night: string): { ok: number; retry: number; fail: number } | null {
  const data = readNight(runsDir, night);
  if (data === null) return null;
  let ok = 0;
  let retry = 0;
  let fail = 0;
  for (const row of data.rows) {
    if (row.lastStatus === 'ok') ok++;
    else if (row.lastStatus === 'retry') retry++;
    else fail++;
  }
  return { ok, retry, fail };
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir).map((night) => ({
    night,
    counts: countsForNight(config.runsDir, night),
  }));
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
  };
}
