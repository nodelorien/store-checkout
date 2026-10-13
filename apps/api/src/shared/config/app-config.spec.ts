import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import { validEnv } from '../../../test/helpers/test-config';
import { ConfigurationError, loadConfig, parseConfig, resolveSecrets } from './app-config';
import { createSsmSecretFetcher } from './ssm-secret.fetcher';

const noSecrets = async (): Promise<Record<string, string>> => ({});

describe('parseConfig', () => {
  it('AC-5: builds a typed configuration with defaults', () => {
    const result = parseConfig(validEnv());

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(undefined)).toMatchObject({
      nodeEnv: 'test',
      port: 3000,
      logLevel: 'info',
      corsOrigins: [],
      trustProxy: false,
      rateLimitPerMinute: 60,
      aws: { region: 'us-east-1', dynamoEndpoint: undefined },
      fees: { baseFeeInCents: 250000, deliveryFeeInCents: 800000 },
      cache: { redisUrl: undefined, catalogueTtlSeconds: 60, reportsTtlSeconds: 30 },
      gateway: {
        baseUrl: 'https://gateway.test/v1',
        timeoutMs: 8000,
        pollMaxMs: 9000,
        pollIntervalMs: 1500,
      },
    });
  });

  it('AC-5: reads explicit values and normalises them', () => {
    const config = parseConfig(
      validEnv({
        NODE_ENV: 'production',
        PORT: '8080',
        LOG_LEVEL: 'debug',
        CORS_ORIGIN: 'http://localhost:5173, https://shop.test ,',
        TRUST_PROXY: 'TRUE',
        AWS_REGION: 'us-west-2',
        DYNAMODB_ENDPOINT: 'http://localhost:8000/',
        BASE_FEE_IN_CENTS: '100',
        DELIVERY_FEE_IN_CENTS: '0',
        PAYMENT_GATEWAY_BASE_URL: 'https://gateway.test/v1//',
        PAYMENT_GATEWAY_TIMEOUT_MS: '500',
      }),
    ).unwrapOr(undefined);

    expect(config).toMatchObject({
      nodeEnv: 'production',
      port: 8080,
      logLevel: 'debug',
      corsOrigins: ['http://localhost:5173', 'https://shop.test'],
      trustProxy: true,
      aws: { region: 'us-west-2', dynamoEndpoint: 'http://localhost:8000' },
      fees: { baseFeeInCents: 100, deliveryFeeInCents: 0 },
      gateway: { baseUrl: 'https://gateway.test/v1', timeoutMs: 500 },
    });
  });

  it('023 AC-7: reads the cache and rate limit settings', () => {
    const config = parseConfig(
      validEnv({
        REDIS_URL: 'rediss://default:pw@cache.test:6380',
        CACHE_TTL_CATALOGUE_SECONDS: '120',
        CACHE_TTL_REPORTS_SECONDS: '5',
        RATE_LIMIT_PER_MINUTE: '5000',
      }),
    ).unwrapOr(undefined);

    expect(config).toMatchObject({
      rateLimitPerMinute: 5000,
      cache: {
        redisUrl: 'rediss://default:pw@cache.test:6380',
        catalogueTtlSeconds: 120,
        reportsTtlSeconds: 5,
      },
    });
  });

  it('023 AC-7: rejects an invalid cache or rate limit setting without echoing it', () => {
    const problems = parseConfig(
      validEnv({
        REDIS_URL: 'http://user:hunter2@cache.test',
        CACHE_TTL_CATALOGUE_SECONDS: '0',
        CACHE_TTL_REPORTS_SECONDS: '3601',
        RATE_LIMIT_PER_MINUTE: '0',
      }),
    ).match(
      () => [],
      (list) => list,
    );

    expect(problems).toEqual([
      'RATE_LIMIT_PER_MINUTE must be an integer between 1 and 100000',
      'REDIS_URL must be a redis:// or rediss:// URL',
      'CACHE_TTL_CATALOGUE_SECONDS must be an integer between 1 and 3600',
      'CACHE_TTL_REPORTS_SECONDS must be an integer between 1 and 3600',
    ]);
    expect(problems.join(' ')).not.toContain('hunter2');
  });

  it('AC-5: trusts the proxy by default when running in Lambda', () => {
    const config = parseConfig(validEnv({ AWS_LAMBDA_FUNCTION_NAME: 'api' })).unwrapOr(undefined);

    expect(config?.trustProxy).toBe(true);
  });

  it('AC-5: allows a missing events secret', () => {
    const config = parseConfig(validEnv({ PAYMENT_GATEWAY_EVENTS_SECRET: ' ' })).unwrapOr(
      undefined,
    );

    expect(config?.gateway.eventsSecret).toBeUndefined();
  });

  it('AC-5: lists every problem at once', () => {
    const result = parseConfig({
      NODE_ENV: 'staging',
      PORT: 'abc',
      TRUST_PROXY: 'yes',
      DYNAMODB_ENDPOINT: 'localhost',
      BASE_FEE_IN_CENTS: '-1',
      PAYMENT_GATEWAY_BASE_URL: 'ftp://nope',
      PAYMENT_GATEWAY_PRIVATE_KEY: '',
    });

    const problems = result.match(
      () => [],
      (list) => list,
    );
    expect(problems).toEqual(
      expect.arrayContaining([
        'NODE_ENV must be one of development, test, production',
        'PORT must be an integer between 1 and 65535',
        'TRUST_PROXY must be true or false',
        'DYNAMODB_ENDPOINT must be an http(s) URL',
        'TABLE_PRODUCTS is required',
        'TABLE_CUSTOMERS is required',
        'TABLE_TRANSACTIONS is required',
        'TABLE_DELIVERIES is required',
        'BASE_FEE_IN_CENTS must be an integer between 0 and 100000000000',
        'PAYMENT_GATEWAY_BASE_URL must be an http(s) URL',
        'PAYMENT_GATEWAY_PUBLIC_KEY is required',
        'PAYMENT_GATEWAY_PRIVATE_KEY is required',
        'PAYMENT_GATEWAY_INTEGRITY_SECRET is required',
      ]),
    );
  });

  it('AC-5: never echoes a value in a problem', () => {
    const problems = parseConfig(validEnv({ PORT: 'super-secret-value' })).match(
      () => [],
      (list) => list,
    );

    expect(problems.join(' ')).not.toContain('super-secret-value');
  });
});

describe('resolveSecrets', () => {
  it('AC-6: fetches only the secrets missing from env', async () => {
    const fetcher = jest.fn(async () => ({ '/app/integrity': 'from-ssm' }));
    const env = validEnv({
      PAYMENT_GATEWAY_PRIVATE_KEY: 'from-env',
      PAYMENT_GATEWAY_PRIVATE_KEY_PARAM: '/app/private',
      PAYMENT_GATEWAY_INTEGRITY_SECRET: undefined,
      PAYMENT_GATEWAY_INTEGRITY_SECRET_PARAM: '/app/integrity',
    });

    const resolved = await resolveSecrets(env, fetcher);

    expect(fetcher).toHaveBeenCalledWith(['/app/integrity']);
    expect(resolved.PAYMENT_GATEWAY_PRIVATE_KEY).toBe('from-env');
    expect(resolved.PAYMENT_GATEWAY_INTEGRITY_SECRET).toBe('from-ssm');
  });

  it('AC-6: does not call the fetcher when nothing is pending', async () => {
    const fetcher = jest.fn(noSecrets);

    await resolveSecrets(validEnv(), fetcher);

    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('loadConfig', () => {
  it('AC-6: returns the configuration with secrets resolved from parameters', async () => {
    const config = await loadConfig(
      validEnv({
        PAYMENT_GATEWAY_EVENTS_SECRET: undefined,
        PAYMENT_GATEWAY_EVENTS_SECRET_PARAM: '/app/events',
      }),
      async () => ({ '/app/events': 'events-from-ssm' }),
    );

    expect(config.gateway.eventsSecret).toBe('events-from-ssm');
  });

  it('023 AC-7: reads the Redis URL from a parameter, and runs without cache when it is absent', async () => {
    const env = validEnv({ REDIS_URL_PARAM: '/app/redis-url' });

    const found = await loadConfig(env, async () => ({ '/app/redis-url': 'redis://cache:6379' }));
    const missing = await loadConfig(env, noSecrets);

    expect(found.cache.redisUrl).toBe('redis://cache:6379');
    expect(missing.cache.redisUrl).toBeUndefined();
  });

  it('AC-5: throws a ConfigurationError listing the problems', async () => {
    await expect(loadConfig(validEnv({ TABLE_PRODUCTS: undefined }), noSecrets)).rejects.toThrow(
      new ConfigurationError(['TABLE_PRODUCTS is required']),
    );
  });

  it('AC-6: fails when a referenced parameter does not exist', async () => {
    const env = validEnv({
      PAYMENT_GATEWAY_PRIVATE_KEY: undefined,
      PAYMENT_GATEWAY_PRIVATE_KEY_PARAM: '/app/missing',
    });

    await expect(loadConfig(env, noSecrets)).rejects.toThrow(
      'PAYMENT_GATEWAY_PRIVATE_KEY is required',
    );
  });

  it('AC-6: fails with a safe message when the parameter store is unreachable', async () => {
    const env = validEnv({
      PAYMENT_GATEWAY_PRIVATE_KEY: undefined,
      PAYMENT_GATEWAY_PRIVATE_KEY_PARAM: '/app/private',
    });
    const failing = async (): Promise<Record<string, string>> => {
      throw new Error('AccessDenied for arn:aws:ssm:secret-detail');
    };

    const failure = loadConfig(env, failing);

    await expect(failure).rejects.toBeInstanceOf(ConfigurationError);
    await expect(failure).rejects.not.toThrow(/secret-detail/);
  });
});

describe('createSsmSecretFetcher', () => {
  it('AC-6: requests decrypted parameters and maps them by name', async () => {
    const ssm = mockClient(SSMClient);
    ssm.on(GetParametersCommand).resolves({
      Parameters: [{ Name: '/app/private', Value: 'prv' }, { Name: '/app/empty' }],
    });

    const values = await createSsmSecretFetcher(new SSMClient({ region: 'us-east-1' }))([
      '/app/private',
      '/app/empty',
    ]);

    expect(values).toEqual({ '/app/private': 'prv' });
    expect(ssm.commandCalls(GetParametersCommand)[0].args[0].input).toEqual({
      Names: ['/app/private', '/app/empty'],
      WithDecryption: true,
    });
  });

  it('AC-6: returns an empty map when the store answers nothing', async () => {
    const ssm = mockClient(SSMClient);
    ssm.on(GetParametersCommand).resolves({});

    expect(await createSsmSecretFetcher(new SSMClient({ region: 'us-east-1' }))(['/x'])).toEqual(
      {},
    );
  });
});
