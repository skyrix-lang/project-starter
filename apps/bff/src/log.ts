import { AsyncLocalStorage } from "node:async_hooks";
import { env, logLevels, type LogLevel } from "./env";

// The BFF's log: one line per event on stdout (stderr for warnings and errors),
// which is where a container's logs are collected from. JSON in production, so
// the platform can filter by level or request id; readable text otherwise.
// Use `log`, never `console` (lint refuses it), and never put a secret, a token
// or a query string in a field. Errors are reduced to what explains them.

type Fields = Record<string, unknown>;

const context = new AsyncLocalStorage<Fields>();

/** Adds `fields` to every line logged while `run` is in progress. */
export function withLogContext<T>(fields: Fields, run: () => T): T {
  return context.run({ ...context.getStore(), ...fields }, run);
}

type ErrorSummary = {
  name: string;
  message: string;
  code?: string | number;
  stack?: string;
  cause?: ErrorSummary;
};

/**
 * What explains an error, and nothing it happens to carry. Libraries attach
 * data to errors: Drizzle ends its message with the query's parameters, and the
 * OIDC client puts the token response or the ID token's claims in `cause`. So
 * only the name, the message without parameters, the `code`, the stack frames
 * and a `cause` that is itself an Error are kept.
 */
function summarize(error: Error, depth = 0): ErrorSummary {
  const message = error.message.split("\nparams: ")[0]!;
  const frames = (error.stack ?? "")
    .split("\n")
    .filter((line) => /^\s+at /.test(line));
  const code: unknown = "code" in error ? error.code : undefined;
  return {
    name: error.name,
    message,
    ...(typeof code === "string" || typeof code === "number" ? { code } : {}),
    stack: [`${error.name}: ${message}`, ...frames].join("\n"),
    ...(error.cause instanceof Error && depth < 5
      ? { cause: summarize(error.cause, depth + 1) }
      : {}),
  };
}

const plain = (value: unknown) =>
  value instanceof Error ? summarize(value) : value;

/** Never throws: a value that can't be written must not hide the event. */
function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    );
  } catch {
    return '"[unserializable]"';
  }
}

function text(level: LogLevel, message: string, fields: Fields): string {
  const stacks: string[] = [];
  const pairs = Object.entries(fields).map(([key, value]) => {
    if (value instanceof Error) {
      let error: ErrorSummary | undefined = summarize(value);
      const summary = error.message;
      for (; error; error = error.cause) {
        stacks.push(`${stacks.length ? "Caused by: " : ""}${error.stack}`);
      }
      return `${key}=${stringify(summary)}`;
    }
    return `${key}=${typeof value === "string" ? value : stringify(value)}`;
  });
  return [`${level.toUpperCase()} ${message}`, ...pairs]
    .join(" ")
    .concat(...stacks.map((stack) => `\n${stack}`));
}

export function createLogger(options: {
  level: LogLevel;
  json: boolean;
  write?: (line: string, level: LogLevel) => void;
}) {
  const write =
    options.write ??
    ((line, level) => {
      const stream =
        level === "warn" || level === "error" ? process.stderr : process.stdout;
      stream.write(`${line}\n`);
    });
  const threshold = logLevels.indexOf(options.level);

  const at =
    (level: LogLevel) =>
    (message: string, fields: Fields = {}) => {
      if (logLevels.indexOf(level) < threshold) return;
      const all = { ...context.getStore(), ...fields };
      if (!options.json) return write(text(level, message, all), level);
      const head = { time: new Date().toISOString(), level, message };
      const rest = Object.entries(all)
        // A field can't replace the line's own time, level or message.
        .filter(([key]) => !(key in head))
        .map(
          ([key, value]) =>
            `,${JSON.stringify(key)}:${stringify(plain(value))}`,
        );
      write(`${JSON.stringify(head).slice(0, -1)}${rest.join("")}}`, level);
    };

  return {
    debug: at("debug"),
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
  };
}

type Logger = ReturnType<typeof createLogger>;
let cached: Logger | undefined;

/** Configured from the environment on first use, like env() itself. */
function logger(): Logger {
  const { LOG_LEVEL, NODE_ENV } = env();
  cached ??= createLogger({
    level: LOG_LEVEL,
    json: NODE_ENV === "production",
  });
  return cached;
}

export const log: Logger = {
  debug: (message, fields) => logger().debug(message, fields),
  info: (message, fields) => logger().info(message, fields),
  warn: (message, fields) => logger().warn(message, fields),
  error: (message, fields) => logger().error(message, fields),
};
