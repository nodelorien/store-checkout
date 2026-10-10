import { Match, Template } from 'aws-cdk-lib/assertions';
import { SPA_REWRITE_FUNCTION_CODE } from '../lib/spa-rewrite';
import { GATEWAY_ORIGIN, synthesize } from './helpers';

describe('CheckoutStack', () => {
  let template: Template;

  beforeAll(() => {
    template = synthesize();
  });

  describe('database', () => {
    it('AC-1: defines the four on-demand tables keyed by id', () => {
      template.resourceCountIs('AWS::DynamoDB::Table', 4);
      for (const name of ['products', 'customers', 'transactions', 'deliveries']) {
        template.hasResourceProperties('AWS::DynamoDB::Table', {
          TableName: `checkout-test-${name}`,
          BillingMode: 'PAY_PER_REQUEST',
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        });
      }
    });

    it.each([
      ['customers', ['byEmail']],
      ['transactions', ['byReference', 'byIdempotencyKey']],
      ['deliveries', ['byTransaction']],
    ])('AC-1: %s has the indexes %j', (name, indexes) => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: `checkout-test-${name}`,
        GlobalSecondaryIndexes: indexes.map((IndexName) => Match.objectLike({ IndexName })),
      });
    });
  });

  describe('api', () => {
    it('AC-2: configures the function through environment variables', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'checkout-test-api',
        Runtime: 'nodejs22.x',
        Handler: 'index.handler',
        Timeout: 29,
        Environment: {
          Variables: Match.objectLike({
            NODE_ENV: 'production',
            BASE_FEE_IN_CENTS: '250000',
            DELIVERY_FEE_IN_CENTS: '800000',
            PAYMENT_GATEWAY_BASE_URL: `${GATEWAY_ORIGIN}/v1`,
            PAYMENT_GATEWAY_PUBLIC_KEY: 'pub_test_key',
            PAYMENT_GATEWAY_PRIVATE_KEY_PARAM: '/checkout/test/payment-gateway/private-key',
            PAYMENT_GATEWAY_INTEGRITY_SECRET_PARAM:
              '/checkout/test/payment-gateway/integrity-secret',
            PAYMENT_GATEWAY_EVENTS_SECRET_PARAM: '/checkout/test/payment-gateway/events-secret',
          }),
        },
      });
    });

    it('AC-2: never places secret values in the template', () => {
      const variables = Object.values(template.findResources('AWS::Lambda::Function'))
        .map((resource) => resource.Properties.Environment?.Variables ?? {})
        .flatMap((vars) => Object.keys(vars));

      expect(variables).not.toEqual(
        expect.arrayContaining([
          'PAYMENT_GATEWAY_PRIVATE_KEY',
          'PAYMENT_GATEWAY_INTEGRITY_SECRET',
          'PAYMENT_GATEWAY_EVENTS_SECRET',
        ]),
      );
    });

    it('AC-3: grants no wildcard resources and scopes SSM to its own path', () => {
      const policies = Object.values(template.findResources('AWS::IAM::Policy'));
      const statements = policies.flatMap(
        (policy) => policy.Properties.PolicyDocument.Statement as Array<Record<string, unknown>>,
      );
      const apiStatements = statements.filter((statement) =>
        JSON.stringify(statement.Action).match(/dynamodb:|ssm:/),
      );

      expect(apiStatements.length).toBeGreaterThanOrEqual(2);
      for (const statement of apiStatements) {
        expect(statement.Resource).not.toBe('*');
      }
      const ssmStatement = apiStatements.find((statement) =>
        JSON.stringify(statement.Action).includes('ssm:GetParameter'),
      );
      expect(JSON.stringify(ssmStatement?.Resource)).toContain(
        'parameter/checkout/test/payment-gateway/*',
      );
    });

    it('keeps function logs for one week', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 7 });
    });

    it('routes every request of the HTTP API to the function', () => {
      template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: '$default' });
    });
  });

  describe('web', () => {
    it('AC-4: keeps the site bucket private and encrypted', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        BucketEncryption: Match.anyValue(),
      });
      template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    });

    it('AC-5: redirects to HTTPS and forwards /api/* uncached with all methods', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultRootObject: 'index.html',
          DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
          CacheBehaviors: [
            Match.objectLike({
              PathPattern: '/api/*',
              ViewerProtocolPolicy: 'https-only',
              AllowedMethods: Match.arrayWith(['PUT', 'PATCH', 'POST', 'DELETE']),
              // AWS managed "CachingDisabled" policy
              CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
            }),
          ],
        }),
      });
    });

    it('AC-6: rewrites client routes on the SPA behaviour only, with no error responses', () => {
      const [distribution] = Object.values(template.findResources('AWS::CloudFront::Distribution'));
      const config = distribution.Properties.DistributionConfig;

      expect(config.DefaultCacheBehavior.FunctionAssociations).toHaveLength(1);
      expect(config.CacheBehaviors[0].FunctionAssociations).toBeUndefined();
      expect(config.CustomErrorResponses).toBeUndefined();
    });

    it('AC-7: sends the security headers, with a CSP limited to self and the gateway', () => {
      template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
        ResponseHeadersPolicyConfig: Match.objectLike({
          Name: 'checkout-test-site-headers',
          SecurityHeadersConfig: Match.objectLike({
            StrictTransportSecurity: Match.objectLike({
              AccessControlMaxAgeSec: 63072000,
              IncludeSubdomains: true,
              Preload: true,
            }),
            ContentTypeOptions: { Override: true },
            FrameOptions: { FrameOption: 'DENY', Override: true },
            ReferrerPolicy: Match.objectLike({ ReferrerPolicy: 'strict-origin-when-cross-origin' }),
            ContentSecurityPolicy: Match.objectLike({
              ContentSecurityPolicy: Match.stringLikeRegexp(
                `connect-src 'self' ${GATEWAY_ORIGIN};.*frame-ancestors 'none'`,
              ),
            }),
          }),
          CustomHeadersConfig: {
            Items: [Match.objectLike({ Header: 'Permissions-Policy' })],
          },
        }),
      });
    });

    it('AC-7: does not override the CSP set by the API itself', () => {
      template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
        ResponseHeadersPolicyConfig: Match.objectLike({
          Name: 'checkout-test-api-headers',
          SecurityHeadersConfig: Match.objectLike({
            ContentSecurityPolicy: Match.absent(),
            StrictTransportSecurity: Match.anyValue(),
          }),
        }),
      });
    });
  });

  it('AC-9: outputs the site and API docs URLs', () => {
    template.hasOutput('SiteUrl', {});
    template.hasOutput('ApiDocsUrl', {});
    template.hasOutput('ApiBaseUrl', {});
  });
});

describe('SPA rewrite function', () => {
  const handler = new Function(`${SPA_REWRITE_FUNCTION_CODE}; return handler;`)() as (event: {
    request: { uri: string };
  }) => { uri: string };

  it.each([
    ['/', '/index.html'],
    ['/transactions/8b1f0c7e', '/index.html'],
    ['/assets/index-abc123.js', '/assets/index-abc123.js'],
    ['/images/products/aurora-desk-lamp.svg', '/images/products/aurora-desk-lamp.svg'],
    ['/index.html', '/index.html'],
  ])('AC-6: maps %s to %s', (uri, expected) => {
    expect(handler({ request: { uri } }).uri).toBe(expected);
  });
});
