import { err, ok, Result } from '../result/result';

export const APP_CONFIG = Symbol('APP_CONFIG');

export type NodeEnv = 'development' | 'test' | 'production';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly corsOrigins: readonly string[];
  readonly trustProxy: boolean;
  readonly aws: { readonly region: string; readonly dynamoEndpoint?: string };
  readonly tables: {
    readonly products: string;
    readonly customers: string;
    readonly transactions: string;
    readonly deliveries: string;
  };
  readonly fees: { readonly baseFeeInCents: number; readonly deliveryFeeInCents: number };
  readonly gateway: {
    readonly baseUrl: string;
    readonly publicKey: string;
    readonly privateKey: string;
    readonly integritySecret: string;
    /** Optional: without it every webhook event is rejected. */
    readonly eventsSecret?: string;
    readonly timeoutMs: number;
    readonly pollMaxMs: number;
    readonly pollIntervalMs: number;
  };
}

export type Env = Readonly<Record<string, string | undefined>>;

/** The three gateway secrets may come from env or from an SSM SecureString (`<NAME>_PARAM`). */
export const SECRET_ENV_NAMES = [
  'PAYMENT_GATEWAY_PRIVATE_KEY',
  'PAYMENT_GATEWAY_INTEGRITY_SECRET',
  'PAYMENT_GATEWAY_EVENTS_SECRET',
] as const;

class EnvReader {
  readonly problems: string[] = [];

  constructor(private readonly env: Env) {}

  optional(name: string): string | undefined {
    const value = this.env[name]?.trim();
    return value === undefined || value === '' ? undefined : value;
  }

  required(name: string): string {
    const value = this.optional(name);
    if (value === undefined) {
      this.problems.push(`${name} is required`);
      return '';
    }
    return value;
  }

  oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
    const value = this.optional(name);
    if (value === undefined) {
      return fallback;
    }
    if (!allowed.includes(value as T)) {
      this.problems.push(`${name} must be one of ${allowed.join(', ')}`);
      return fallback;
    }
    return value as T;
  }

  integer(name: string, fallback: number, min: number, max: number): number {
    const value = this.optional(name);
    if (value === undefined) {
      return fallback;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      this.problems.push(`${name} must be an integer between ${min} and ${max}`);
      return fallback;
    }
    return parsed;
  }

  boolean(name: string, fallback: boolean): boolean {
    const value = this.optional(name)?.toLowerCase();
    if (value === undefined) {
      return fallback;
    }
    if (value !== 'true' && value !== 'false') {
      this.problems.push(`${name} must be true or false`);
      return fallback;
    }
    return value === 'true';
  }

  httpUrl(name: string, required: boolean): string | undefined {
    const value = required ? this.required(name) : this.optional(name);
    if (!value) {
      return undefined;
    }
    if (!/^https?:\/\/[^\s]+$/.test(value)) {
      this.problems.push(`${name} must be an http(s) URL`);
      return undefined;
    }
    return value.replace(/\/+$/, '');
  }
}

const MAX_CENTS = 1_000_000_000_00;

/**
 * Validates the environment and builds the typed configuration. Error messages name variables
 * only — values (possibly secret) are never echoed.
 */
export function parseConfig(env: Env): Result<AppConfig, string[]> {
  const read = new EnvReader(env);

  const config: AppConfig = {
    nodeEnv: read.oneOf('NODE_ENV', ['development', 'test', 'production'], 'development'),
    port: read.integer('PORT', 3000, 1, 65535),
    logLevel: read.oneOf('LOG_LEVEL', ['debug', 'info', 'warn', 'error'], 'info'),
    corsOrigins: (read.optional('CORS_ORIGIN') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
    trustProxy: read.boolean(
      'TRUST_PROXY',
      read.optional('AWS_LAMBDA_FUNCTION_NAME') !== undefined,
    ),
    aws: {
      region: read.optional('AWS_REGION') ?? 'us-east-1',
      dynamoEndpoint: read.httpUrl('DYNAMODB_ENDPOINT', false),
    },
    tables: {
      products: read.required('TABLE_PRODUCTS'),
      customers: read.required('TABLE_CUSTOMERS'),
      transactions: read.required('TABLE_TRANSACTIONS'),
      deliveries: read.required('TABLE_DELIVERIES'),
    },
    fees: {
      baseFeeInCents: read.integer('BASE_FEE_IN_CENTS', 250_000, 0, MAX_CENTS),
      deliveryFeeInCents: read.integer('DELIVERY_FEE_IN_CENTS', 800_000, 0, MAX_CENTS),
    },
    gateway: {
      baseUrl: read.httpUrl('PAYMENT_GATEWAY_BASE_URL', true) ?? '',
      publicKey: read.required('PAYMENT_GATEWAY_PUBLIC_KEY'),
      privateKey: read.required('PAYMENT_GATEWAY_PRIVATE_KEY'),
      integritySecret: read.required('PAYMENT_GATEWAY_INTEGRITY_SECRET'),
      eventsSecret: read.optional('PAYMENT_GATEWAY_EVENTS_SECRET'),
      timeoutMs: read.integer('PAYMENT_GATEWAY_TIMEOUT_MS', 8000, 100, 25_000),
      pollMaxMs: read.integer('PAYMENT_POLL_MAX_MS', 9000, 0, 20_000),
      pollIntervalMs: read.integer('PAYMENT_POLL_INTERVAL_MS', 1500, 50, 10_000),
    },
  };

  return read.problems.length > 0 ? err(read.problems) : ok(config);
}

export type SecretFetcher = (parameterNames: string[]) => Promise<Record<string, string>>;

/**
 * Resolves `<SECRET>_PARAM` references through the given fetcher (SSM in Lambda). A value
 * present in the environment always wins and its parameter is not fetched.
 */
export async function resolveSecrets(env: Env, fetchSecrets: SecretFetcher): Promise<Env> {
  const pending = SECRET_ENV_NAMES.map((name) => ({
    name,
    value: env[name]?.trim(),
    parameter: env[`${name}_PARAM`]?.trim(),
  })).filter(
    (
      entry,
    ): entry is {
      name: (typeof SECRET_ENV_NAMES)[number];
      value: string | undefined;
      parameter: string;
    } => !entry.value && !!entry.parameter,
  );

  if (pending.length === 0) {
    return env;
  }

  const fetched = await fetchSecrets(pending.map((entry) => entry.parameter));
  const resolved: Record<string, string | undefined> = { ...env };
  for (const entry of pending) {
    resolved[entry.name] = fetched[entry.parameter];
  }
  return resolved;
}

export class ConfigurationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid configuration: ${problems.join('; ')}`);
    this.name = 'ConfigurationError';
  }
}

/** Boot-time entry point: resolve secrets, validate, or fail fast. */
export async function loadConfig(env: Env, fetchSecrets: SecretFetcher): Promise<AppConfig> {
  let resolved: Env;
  try {
    resolved = await resolveSecrets(env, fetchSecrets);
  } catch {
    throw new ConfigurationError(['gateway secrets could not be read from the parameter store']);
  }
  return parseConfig(resolved).match(
    (config) => config,
    (problems) => {
      throw new ConfigurationError(problems);
    },
  );
}
