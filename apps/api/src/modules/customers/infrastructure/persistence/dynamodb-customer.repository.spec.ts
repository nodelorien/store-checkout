import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { aCustomer, CUSTOMER_ID } from '../../../../../test/builders/customer.builder';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { testConfig } from '../../../../../test/helpers/test-config';
import { createDocumentClient } from '../../../../shared/dynamodb/dynamodb.client';
import {
  DynamoDbCustomerRepository,
  toCustomer,
  toCustomerItem,
} from './dynamodb-customer.repository';

const dynamo = mockClient(DynamoDBDocumentClient);
const config = testConfig();
const repository = new DynamoDbCustomerRepository(createDocumentClient(config.aws), config);

beforeEach(() => dynamo.reset());

describe('customer mapper', () => {
  it('round-trips a customer through its item', () => {
    const customer = aCustomer().build();

    expect(toCustomer(toCustomerItem(customer)).toProps()).toEqual(customer.toProps());
  });
});

describe('DynamoDbCustomerRepository', () => {
  it('AC-4: gets a customer by its key', async () => {
    dynamo.on(GetCommand).resolves({ Item: toCustomerItem(aCustomer().build()) });

    expect(expectOk(await repository.findById(CUSTOMER_ID)).email).toBe('ada@example.com');
    expect(dynamo.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: 'test-customers',
      Key: { id: CUSTOMER_ID },
    });
  });

  it('AC-4: returns CUSTOMER_NOT_FOUND when the item does not exist', async () => {
    dynamo.on(GetCommand).resolves({});

    expectErr(await repository.findById(CUSTOMER_ID), 'CUSTOMER_NOT_FOUND');
  });

  it('AC-2: queries the byEmail index', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [toCustomerItem(aCustomer().build())] });

    expect(expectOk(await repository.findByEmail('ada@example.com'))?.id).toBe(CUSTOMER_ID);
    expect(dynamo.commandCalls(QueryCommand)[0].args[0].input).toEqual({
      TableName: 'test-customers',
      IndexName: 'byEmail',
      KeyConditionExpression: '#email = :email',
      ExpressionAttributeNames: { '#email': 'email' },
      ExpressionAttributeValues: { ':email': 'ada@example.com' },
    });
  });

  it('AC-1: returns null when no customer has the e-mail', async () => {
    dynamo.on(QueryCommand).resolvesOnce({ Items: [] }).resolvesOnce({});

    expect(expectOk(await repository.findByEmail('new@example.com'))).toBeNull();
    expect(expectOk(await repository.findByEmail('new@example.com'))).toBeNull();
  });

  it('returns the oldest record if duplicates exist', async () => {
    const newer = aCustomer().with({ id: 'newer', createdAt: '2026-10-05T00:00:00.000Z' }).build();
    const older = aCustomer().with({ id: 'older', createdAt: '2026-10-02T00:00:00.000Z' }).build();
    dynamo.on(QueryCommand).resolves({ Items: [toCustomerItem(newer), toCustomerItem(older)] });

    expect(expectOk(await repository.findByEmail('ada@example.com'))?.id).toBe('older');
  });

  it('AC-1: puts the customer item', async () => {
    dynamo.on(PutCommand).resolves({});
    const customer = aCustomer().build();

    expect(expectOk(await repository.save(customer))).toBe(customer);
    expect(dynamo.commandCalls(PutCommand)[0].args[0].input).toEqual({
      TableName: 'test-customers',
      Item: customer.toProps(),
    });
  });

  it('AC-5: converts SDK failures into PERSISTENCE_ERROR', async () => {
    dynamo.onAnyCommand().rejects(new Error('boom'));

    expectErr(await repository.findById(CUSTOMER_ID), 'PERSISTENCE_ERROR');
    expectErr(await repository.findByEmail('ada@example.com'), 'PERSISTENCE_ERROR');
    expectErr(await repository.save(aCustomer().build()), 'PERSISTENCE_ERROR');
  });
});
