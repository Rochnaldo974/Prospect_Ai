/**
 * Logging structuré (JSON en production, lisible en développement).
 *
 * Toute la traçabilité du pipeline repose dessus : chaque job, chaque appel de
 * source et chaque décision d'attribution doit être rattachable à un contexte.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Dérive un logger enrichi d'un contexte permanent (job_id, company_id, …). */
  child(context: LogContext): Logger;
}

function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function normalizeContext(context: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = value instanceof Error ? serializeError(value) : value;
  }
  return out;
}

export interface LoggerOptions {
  /** Seuil sous lequel les messages sont ignorés. Défaut : LOG_LEVEL, sinon 'info'. */
  level?: LogLevel;
  /** Contexte attaché à tous les messages. */
  context?: LogContext;
  /** Format lisible plutôt que JSON. Défaut : hors production. */
  pretty?: boolean;
}

function build(base: LogContext, minLevel: LogLevel, pretty: boolean): Logger {

  const emit = (level: LogLevel, message: string, context?: LogContext): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

    const merged = { ...base, ...(context ? normalizeContext(context) : {}) };
    const record = {
      level,
      time: new Date().toISOString(),
      msg: message,
      ...merged,
    };

    const line = pretty
      ? `${record.time} ${level.toUpperCase().padEnd(5)} ${message}` +
        (Object.keys(merged).length > 0 ? ` ${JSON.stringify(merged)}` : '')
      : JSON.stringify(record);

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };

  return {
    debug: (m, c) => emit('debug', m, c),
    info: (m, c) => emit('info', m, c),
    warn: (m, c) => emit('warn', m, c),
    error: (m, c) => emit('error', m, c),
    child: (context) => build({ ...base, ...normalizeContext(context) }, minLevel, pretty),
  };
}

function isLogLevel(value: string | undefined): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error';
}

/** Crée un logger indépendant — utile pour les tests et les contextes isolés. */
export function createLogger(options: LoggerOptions = {}): Logger {
  const envLevel = process.env['LOG_LEVEL'];
  return build(
    options.context ? normalizeContext(options.context) : {},
    options.level ?? (isLogLevel(envLevel) ? envLevel : 'info'),
    options.pretty ?? process.env['NODE_ENV'] !== 'production',
  );
}

/** Logger applicatif par défaut. */
export const logger: Logger = createLogger();
