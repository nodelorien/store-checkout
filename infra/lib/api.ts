import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { secretParameterNames, type DeploymentConfig } from './config';
import type { Database } from './database';

export interface ApiProps {
  config: DeploymentConfig;
  database: Database;
}

/** NestJS API on a single Lambda behind an API Gateway HTTP API. */
export class Api extends Construct {
  readonly handler: LambdaFunction;
  readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string, { config, database }: ApiProps) {
    super(scope, id);

    const secrets = secretParameterNames(config.stage);

    this.handler = new LambdaFunction(this, 'Handler', {
      functionName: `checkout-${config.stage}-api`,
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      handler: 'index.handler',
      code: Code.fromAsset(config.apiCodePath),
      memorySize: 512,
      // API Gateway cuts requests at 30 s; stay just below it.
      timeout: Duration.seconds(29),
      logGroup: new LogGroup(this, 'Logs', {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        TABLE_PRODUCTS: database.products.tableName,
        TABLE_CUSTOMERS: database.customers.tableName,
        TABLE_TRANSACTIONS: database.transactions.tableName,
        TABLE_DELIVERIES: database.deliveries.tableName,
        BASE_FEE_IN_CENTS: String(config.baseFeeInCents),
        DELIVERY_FEE_IN_CENTS: String(config.deliveryFeeInCents),
        PAYMENT_GATEWAY_BASE_URL: config.gatewayBaseUrl,
        PAYMENT_GATEWAY_PUBLIC_KEY: config.gatewayPublicKey,
        // Names only: the values are SecureString parameters read at cold start.
        PAYMENT_GATEWAY_PRIVATE_KEY_PARAM: secrets.privateKey,
        PAYMENT_GATEWAY_INTEGRITY_SECRET_PARAM: secrets.integritySecret,
        PAYMENT_GATEWAY_EVENTS_SECRET_PARAM: secrets.eventsSecret,
        ...(config.redisUrlParameter ? { REDIS_URL_PARAM: config.redisUrlParameter } : {}),
      },
    });

    for (const table of database.all) {
      table.grantReadWriteData(this.handler);
    }

    const stack = Stack.of(this);
    const parameterArn = (name: string): string =>
      stack.formatArn({ service: 'ssm', resource: 'parameter', resourceName: name.slice(1) });
    this.handler.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [
          parameterArn(`${secrets.prefix}/*`),
          ...(config.redisUrlParameter ? [parameterArn(config.redisUrlParameter)] : []),
        ],
      }),
    );

    this.httpApi = new HttpApi(this, 'HttpApi', {
      apiName: `checkout-${config.stage}`,
      defaultIntegration: new HttpLambdaIntegration('ApiIntegration', this.handler),
    });
  }

  /** Host name CloudFront uses as the API origin. */
  get domainName(): string {
    const stack = Stack.of(this);
    return `${this.httpApi.apiId}.execute-api.${stack.region}.${stack.urlSuffix}`;
  }
}
