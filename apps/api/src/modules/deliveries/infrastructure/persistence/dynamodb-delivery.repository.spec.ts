import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import {
  aDelivery,
  AN_ADDRESS,
  DELIVERY_ID,
  TRANSACTION_ID,
} from '../../../../../test/builders/transaction.builder';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { testConfig } from '../../../../../test/helpers/test-config';
import { createDocumentClient } from '../../../../shared/dynamodb/dynamodb.client';
import { toAddress, toDelivery, toDeliveryItem } from './delivery.mapper';
import { DynamoDbDeliveryRepository } from './dynamodb-delivery.repository';

const dynamo = mockClient(DynamoDBDocumentClient);
const config = testConfig();
const repository = new DynamoDbDeliveryRepository(createDocumentClient(config.aws), config);

beforeEach(() => dynamo.reset());

describe('delivery mapper', () => {
  it('round-trips a delivery, omitting absent optional address fields', () => {
    const full = aDelivery().build();
    const minimal = aDelivery()
      .with({
        address: { addressLine1: 'Cra 7 # 71-21', city: 'Bogotá', region: 'DC', country: 'CO' },
      })
      .build();

    expect(toDelivery(toDeliveryItem(full)).toProps()).toEqual(full.toProps());
    expect(toDeliveryItem(minimal).address).toEqual({
      addressLine1: 'Cra 7 # 71-21',
      city: 'Bogotá',
      region: 'DC',
      country: 'CO',
    });
    expect(toDelivery(toDeliveryItem(minimal)).toProps()).toEqual(minimal.toProps());
  });

  it('tolerates a missing address attribute', () => {
    expect(toAddress(undefined)).toEqual({
      addressLine1: '',
      addressLine2: undefined,
      city: '',
      region: '',
      country: '',
      postalCode: undefined,
    });
  });
});

describe('DynamoDbDeliveryRepository', () => {
  it('AC-1: gets a delivery by its key', async () => {
    dynamo.on(GetCommand).resolves({ Item: toDeliveryItem(aDelivery().build()) });

    expect(expectOk(await repository.findById(DELIVERY_ID)).transactionId).toBe(TRANSACTION_ID);
    expect(dynamo.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: 'test-deliveries',
      Key: { id: DELIVERY_ID },
    });
  });

  it('AC-1: returns DELIVERY_NOT_FOUND when the item does not exist', async () => {
    dynamo.on(GetCommand).resolves({});

    expectErr(await repository.findById(DELIVERY_ID), 'DELIVERY_NOT_FOUND');
  });

  it('AC-2: queries the byTransaction index', async () => {
    dynamo.on(QueryCommand).resolvesOnce({ Items: [toDeliveryItem(aDelivery().build())] });

    expect(expectOk(await repository.findByTransactionId(TRANSACTION_ID))?.id).toBe(DELIVERY_ID);
    expect(dynamo.commandCalls(QueryCommand)[0].args[0].input).toEqual({
      TableName: 'test-deliveries',
      IndexName: 'byTransaction',
      KeyConditionExpression: '#transactionId = :transactionId',
      ExpressionAttributeNames: { '#transactionId': 'transactionId' },
      ExpressionAttributeValues: { ':transactionId': TRANSACTION_ID },
      Limit: 1,
    });
  });

  it('AC-2: returns null when the transaction has no delivery', async () => {
    dynamo.on(QueryCommand).resolvesOnce({ Items: [] }).resolvesOnce({});

    expect(expectOk(await repository.findByTransactionId(TRANSACTION_ID))).toBeNull();
    expect(expectOk(await repository.findByTransactionId(TRANSACTION_ID))).toBeNull();
  });

  it('AC-3: updates the address with a PENDING condition', async () => {
    dynamo.on(UpdateCommand).resolves({});
    const delivery = aDelivery().build();

    expect(expectOk(await repository.updateAddress(delivery))).toBe(delivery);
    expect(dynamo.commandCalls(UpdateCommand)[0].args[0].input).toEqual({
      TableName: 'test-deliveries',
      Key: { id: DELIVERY_ID },
      UpdateExpression: 'SET #address = :address, #updatedAt = :updatedAt',
      ConditionExpression: '#status = :pending',
      ExpressionAttributeNames: {
        '#address': 'address',
        '#updatedAt': 'updatedAt',
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':address': AN_ADDRESS,
        ':updatedAt': '2026-10-09T15:00:05.000Z',
        ':pending': 'PENDING',
      },
    });
  });

  it('AC-4: returns DELIVERY_NOT_EDITABLE when the condition fails', async () => {
    dynamo
      .on(UpdateCommand)
      .rejects(Object.assign(new Error('condition'), { name: 'ConditionalCheckFailedException' }));

    expectErr(await repository.updateAddress(aDelivery().build()), 'DELIVERY_NOT_EDITABLE');
  });

  it('AC-6: converts SDK failures into PERSISTENCE_ERROR', async () => {
    dynamo.onAnyCommand().rejects(new Error('boom'));

    expectErr(await repository.findById(DELIVERY_ID), 'PERSISTENCE_ERROR');
    expectErr(await repository.findByTransactionId(TRANSACTION_ID), 'PERSISTENCE_ERROR');
    expectErr(await repository.updateAddress(aDelivery().build()), 'PERSISTENCE_ERROR');
  });
});
