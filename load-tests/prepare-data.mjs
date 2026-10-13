// Gives every product of the load-test table enough stock for a whole run.
//   DYNAMODB_ENDPOINT=http://localhost:8000 TABLE_PRODUCTS=load-products node load-tests/prepare-data.mjs
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const endpoint = process.env.DYNAMODB_ENDPOINT;
const table = process.env.TABLE_PRODUCTS;
if (!endpoint || !table) {
  throw new Error('DYNAMODB_ENDPOINT and TABLE_PRODUCTS are required');
}
if (!/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(endpoint)) {
  throw new Error('Refusing to change stock outside a local DynamoDB');
}

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: 'us-east-1',
    endpoint,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  }),
);
const { Items = [] } = await client.send(new ScanCommand({ TableName: table }));
for (const item of Items) {
  await client.send(
    new UpdateCommand({
      TableName: table,
      Key: { id: item.id },
      UpdateExpression: 'SET stock = :stock',
      ExpressionAttributeValues: { ':stock': 1_000_000 },
    }),
  );
}
console.warn(`Stock raised on ${Items.length} products of ${table}`);
client.destroy();
