import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DomainError, DomainErrors } from '../errors/domain-error';

export const DYNAMODB_DOCUMENT_CLIENT = Symbol('DYNAMODB_DOCUMENT_CLIENT');

export interface DynamoSettings {
  readonly region: string;
  readonly dynamoEndpoint?: string;
}

/** DynamoDB Local accepts any credentials but the SDK refuses to sign without some. */
export function buildDynamoClientConfig(
  settings: DynamoSettings,
  env: Readonly<Record<string, string | undefined>>,
): DynamoDBClientConfig {
  const config: DynamoDBClientConfig = { region: settings.region };
  if (settings.dynamoEndpoint) {
    config.endpoint = settings.dynamoEndpoint;
    if (!env.AWS_ACCESS_KEY_ID) {
      config.credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
    }
  }
  return config;
}

export function createDocumentClient(
  settings: DynamoSettings,
  env: Readonly<Record<string, string | undefined>> = process.env,
): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient(buildDynamoClientConfig(settings, env)), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

/** Boundary conversion used by every repository: the SDK error name only, never item data. */
export function toPersistenceError(cause: unknown): DomainError {
  const name = cause instanceof Error ? cause.name : 'UnknownError';
  return DomainErrors.persistence(`DynamoDB request failed: ${name}`);
}
