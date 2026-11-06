// Plan morning-digest § 1. The contract the reader, page, JSON, board link and route tests share.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// Times keep the log's offset as written; never converted to UTC.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  // Error of the last run; null when the last run had none.
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// Rows sorted by job. An empty file gives rows: [] (renders "nothing ran").
export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// null: no file for this night (404). Never throws on a bad line; it is counted in badLines.
export type ReadNight = (runsDir: string, night: string) => Night | null;
