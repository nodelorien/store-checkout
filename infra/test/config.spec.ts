import { loadDeploymentConfig, originOf, secretParameterNames } from '../lib/config';

const paths = { apiCodePath: '/tmp/api', webDistPath: '/tmp/web' };
const baseEnv = {
  PAYMENT_GATEWAY_BASE_URL: 'https://gateway.test/v1',
  PAYMENT_GATEWAY_PUBLIC_KEY: 'pub_test_key',
};

describe('loadDeploymentConfig', () => {
  it('AC-8: reads gateway settings from deploy-time variables and applies defaults', () => {
    expect(loadDeploymentConfig(baseEnv, paths)).toEqual({
      stage: 'prod',
      gatewayBaseUrl: 'https://gateway.test/v1',
      gatewayPublicKey: 'pub_test_key',
      baseFeeInCents: 250_000,
      deliveryFeeInCents: 800_000,
      ...paths,
    });
  });

  it('honours stage and fee overrides', () => {
    const config = loadDeploymentConfig(
      { ...baseEnv, STAGE: 'dev', BASE_FEE_IN_CENTS: '100', DELIVERY_FEE_IN_CENTS: '0' },
      paths,
    );

    expect(config).toMatchObject({ stage: 'dev', baseFeeInCents: 100, deliveryFeeInCents: 0 });
  });

  it.each(['PAYMENT_GATEWAY_BASE_URL', 'PAYMENT_GATEWAY_PUBLIC_KEY'])(
    'fails fast when %s is missing',
    (name) => {
      expect(() => loadDeploymentConfig({ ...baseEnv, [name]: ' ' }, paths)).toThrow(name);
    },
  );

  it.each(['-1', '1.5', 'abc'])('rejects the invalid fee "%s"', (value) => {
    expect(() => loadDeploymentConfig({ ...baseEnv, BASE_FEE_IN_CENTS: value }, paths)).toThrow(
      'BASE_FEE_IN_CENTS',
    );
  });

  it('treats an empty fee as not provided', () => {
    expect(loadDeploymentConfig({ ...baseEnv, BASE_FEE_IN_CENTS: '' }, paths).baseFeeInCents).toBe(
      250_000,
    );
  });

  it('rejects a gateway URL that is not https', () => {
    expect(() =>
      loadDeploymentConfig(
        { ...baseEnv, PAYMENT_GATEWAY_BASE_URL: 'http://gateway.test/v1' },
        paths,
      ),
    ).toThrow('https');
  });
});

describe('originOf', () => {
  it('keeps scheme and host only', () => {
    expect(originOf('https://gateway.test/v1/tokens')).toBe('https://gateway.test');
  });
});

describe('secretParameterNames', () => {
  it('namespaces the parameters by stage', () => {
    expect(secretParameterNames('prod')).toEqual({
      prefix: '/checkout/prod/payment-gateway',
      privateKey: '/checkout/prod/payment-gateway/private-key',
      integritySecret: '/checkout/prod/payment-gateway/integrity-secret',
      eventsSecret: '/checkout/prod/payment-gateway/events-secret',
    });
  });
});
