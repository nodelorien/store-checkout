import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  buildDynamoClientConfig,
  createDocumentClient,
  toPersistenceError,
} from './dynamodb.client';

describe('buildDynamoClientConfig', () => {
  it('uses only the region when no endpoint is configured (AWS)', () => {
    expect(buildDynamoClientConfig({ region: 'us-east-1' }, {})).toEqual({ region: 'us-east-1' });
  });

  it('adds the endpoint and placeholder credentials for DynamoDB Local', () => {
    expect(
      buildDynamoClientConfig({ region: 'us-east-1', dynamoEndpoint: 'http://localhost:8000' }, {}),
    ).toEqual({
      region: 'us-east-1',
      endpoint: 'http://localhost:8000',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    });
  });

  it('keeps real credentials from the environment when present', () => {
    const config = buildDynamoClientConfig(
      { region: 'us-east-1', dynamoEndpoint: 'http://localhost:8000' },
      { AWS_ACCESS_KEY_ID: 'AKIA' },
    );

    expect(config.credentials).toBeUndefined();
  });
});

describe('createDocumentClient', () => {
  it('creates a document client', () => {
    const client = createDocumentClient({ region: 'us-east-1' });

    expect(client).toBeInstanceOf(DynamoDBDocumentClient);
    client.destroy();
  });
});

describe('toPersistenceError', () => {
  it('keeps only the SDK error name', () => {
    const cause = Object.assign(new Error('item {email: a@b.co}'), { name: 'ThrottlingException' });

    expect(toPersistenceError(cause)).toEqual({
      code: 'PERSISTENCE_ERROR',
      message: 'DynamoDB request failed: ThrottlingException',
      details: [],
    });
    expect(toPersistenceError('weird').message).toBe('DynamoDB request failed: UnknownError');
  });
});
