import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { aProduct, PRODUCT_ID } from '../../../../../test/builders/product.builder';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { testConfig } from '../../../../../test/helpers/test-config';
import { createDocumentClient } from '../../../../shared/dynamodb/dynamodb.client';
import { DynamoDbProductRepository, toProduct, toProductItem } from './dynamodb-product.repository';

const dynamo = mockClient(DynamoDBDocumentClient);
const config = testConfig();
const repository = new DynamoDbProductRepository(createDocumentClient(config.aws), config);

beforeEach(() => dynamo.reset());

describe('product mapper', () => {
  it('round-trips a product through its item', () => {
    const product = aProduct().build();

    expect(toProduct(toProductItem(product)).toProps()).toEqual(product.toProps());
  });
});

describe('DynamoDbProductRepository', () => {
  it('AC-1: scans the products table and follows pagination', async () => {
    const first = toProductItem(aProduct().build());
    const second = toProductItem(aProduct().withId('p-2').build());
    dynamo
      .on(ScanCommand)
      .resolvesOnce({ Items: [first], LastEvaluatedKey: { id: first.id } })
      .resolvesOnce({ Items: [second] });

    const products = expectOk(await repository.findAll());

    expect(products.map((product) => product.id)).toEqual([PRODUCT_ID, 'p-2']);
    const calls = dynamo.commandCalls(ScanCommand);
    expect(calls[0].args[0].input).toEqual({
      TableName: 'test-products',
      ExclusiveStartKey: undefined,
    });
    expect(calls[1].args[0].input.ExclusiveStartKey).toEqual({ id: first.id });
  });

  it('AC-1: returns an empty list when the table is empty', async () => {
    dynamo.on(ScanCommand).resolves({});

    expect(expectOk(await repository.findAll())).toEqual([]);
  });

  it('AC-6: converts a scan failure into PERSISTENCE_ERROR', async () => {
    dynamo.on(ScanCommand).rejects(new Error('boom'));

    expectErr(await repository.findAll(), 'PERSISTENCE_ERROR');
  });

  it('AC-2: gets a product by its key', async () => {
    dynamo.on(GetCommand).resolves({ Item: toProductItem(aProduct().withStock(3).build()) });

    const product = expectOk(await repository.findById(PRODUCT_ID));

    expect(product.stock).toBe(3);
    expect(dynamo.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: 'test-products',
      Key: { id: PRODUCT_ID },
    });
  });

  it('AC-3: returns PRODUCT_NOT_FOUND when the item does not exist', async () => {
    dynamo.on(GetCommand).resolves({});

    expectErr(await repository.findById(PRODUCT_ID), 'PRODUCT_NOT_FOUND');
  });

  it('AC-6: converts a get failure into PERSISTENCE_ERROR', async () => {
    dynamo.on(GetCommand).rejects(new Error('boom'));

    expectErr(await repository.findById(PRODUCT_ID), 'PERSISTENCE_ERROR');
  });
});
