export interface DeploymentConfig {
  /** Stage suffix used in resource names, e.g. `prod`. */
  stage: string;
  /** Payment gateway sandbox base URL (ends in `/v1`). Deploy-time variable, never hard-coded. */
  gatewayBaseUrl: string;
  /** Payment gateway public key. Not secret, but still supplied at deploy time. */
  gatewayPublicKey: string;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
  /**
   * Optional name of the SSM SecureString holding the Redis URL. Without it the API runs
   * without a cache. The URL itself is a secret (it may carry a password) and never appears here.
   */
  redisUrlParameter?: string;
  /** Directory holding the bundled Lambda code (`index.js` exporting `handler`). */
  apiCodePath: string;
  /** Directory holding the built SPA. */
  webDistPath: string;
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required deploy variable ${name}`);
  }
  return value;
}

function positiveInteger(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer, got "${raw}"`);
  }
  return value;
}

function parameterName(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  if (!value) {
    return undefined;
  }
  if (!/^\/[\w.\-/]+$/.test(value)) {
    throw new Error(`${name} must be an SSM parameter name starting with "/"`);
  }
  return value;
}

/** Origin (scheme + host) of the gateway, used in the Content-Security-Policy. */
export function originOf(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('The payment gateway URL must use https');
  }
  return parsed.origin;
}

export function loadDeploymentConfig(
  env: Env,
  paths: Pick<DeploymentConfig, 'apiCodePath' | 'webDistPath'>,
): DeploymentConfig {
  const gatewayBaseUrl = required(env, 'PAYMENT_GATEWAY_BASE_URL');
  originOf(gatewayBaseUrl);

  return {
    stage: env.STAGE?.trim() || 'prod',
    gatewayBaseUrl,
    gatewayPublicKey: required(env, 'PAYMENT_GATEWAY_PUBLIC_KEY'),
    baseFeeInCents: positiveInteger(env, 'BASE_FEE_IN_CENTS', 250_000),
    deliveryFeeInCents: positiveInteger(env, 'DELIVERY_FEE_IN_CENTS', 800_000),
    redisUrlParameter: parameterName(env, 'REDIS_URL_PARAM'),
    ...paths,
  };
}

/** SSM SecureString parameter names holding the gateway secrets for a stage. */
export function secretParameterNames(stage: string) {
  const prefix = `/checkout/${stage}/payment-gateway`;
  return {
    prefix,
    privateKey: `${prefix}/private-key`,
    integritySecret: `${prefix}/integrity-secret`,
    eventsSecret: `${prefix}/events-secret`,
  };
}
