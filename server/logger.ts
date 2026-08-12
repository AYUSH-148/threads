type Level = "info" | "warn" | "error";

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  /** A logger that stamps every line with the given fields — used to bind a request id. */
  child(fields: Record<string, unknown>): Logger;
}

/**
 * Two formats, because the two readers are different.
 *
 * In production the reader is a log aggregator, which needs one JSON object per
 * line to be able to filter on `requestId` at all. In development the reader is a
 * person watching a terminal, for whom JSON is strictly worse than a sentence.
 */
export function createLogger(opts: { json: boolean; bound?: Record<string, unknown> }): Logger {
  const bound = opts.bound ?? {};

  const emit = (level: Level, message: string, fields?: Record<string, unknown>) => {
    const all = { ...bound, ...fields };
    const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

    if (opts.json) {
      sink(JSON.stringify({ level, message, time: new Date().toISOString(), ...all }));
      return;
    }

    const suffix = Object.entries(all)
      .map(([key, value]) => `${key}=${format(value)}`)
      .join(" ");

    sink(`[api] ${message}${suffix ? ` ${suffix}` : ""}`);
  };

  return {
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
    child: (fields) => createLogger({ json: opts.json, bound: { ...bound, ...fields } }),
  };
}

function format(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value.includes(" ") ? JSON.stringify(value) : value;
  return String(value);
}

/** Discards everything. The default in tests, which assert on responses rather than logs. */
export const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};
