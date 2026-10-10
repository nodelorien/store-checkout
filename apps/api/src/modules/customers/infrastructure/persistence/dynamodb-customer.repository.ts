import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../../../shared/config/app-config';
import {
  DYNAMODB_DOCUMENT_CLIENT,
  toPersistenceError,
} from '../../../../shared/dynamodb/dynamodb.client';
import { DomainError, DomainErrors } from '../../../../shared/errors/domain-error';
import { err, ok, Result, tryAsync } from '../../../../shared/result/result';
import { CustomerRepository } from '../../application/ports/customer-repository.port';
import { Customer } from '../../domain/customer';

export const CUSTOMERS_BY_EMAIL_INDEX = 'byEmail';

export function toCustomerItem(customer: Customer): Record<string, unknown> {
  return { ...customer.toProps() };
}

export function toCustomer(item: Record<string, unknown>): Customer {
  return Customer.restore({
    id: String(item.id),
    fullName: String(item.fullName),
    email: String(item.email),
    phone: String(item.phone),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  });
}

@Injectable()
export class DynamoDbCustomerRepository implements CustomerRepository {
  private readonly table: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT) private readonly client: DynamoDBDocumentClient,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.table = config.tables.customers;
  }

  async findById(id: string): Promise<Result<Customer, DomainError>> {
    const output = await tryAsync(
      () => this.client.send(new GetCommand({ TableName: this.table, Key: { id } })),
      toPersistenceError,
    );
    return output.andThen((result) =>
      result.Item ? ok(toCustomer(result.Item)) : err(DomainErrors.customerNotFound()),
    );
  }

  /** Query on the `byEmail` GSI. If duplicates ever exist the oldest record wins. */
  async findByEmail(email: string): Promise<Result<Customer | null, DomainError>> {
    const output = await tryAsync(
      () =>
        this.client.send(
          new QueryCommand({
            TableName: this.table,
            IndexName: CUSTOMERS_BY_EMAIL_INDEX,
            KeyConditionExpression: '#email = :email',
            ExpressionAttributeNames: { '#email': 'email' },
            ExpressionAttributeValues: { ':email': email },
          }),
        ),
      toPersistenceError,
    );
    return output.map((result) => {
      const customers = (result.Items ?? []).map(toCustomer);
      customers.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return customers[0] ?? null;
    });
  }

  async save(customer: Customer): Promise<Result<Customer, DomainError>> {
    const output = await tryAsync(
      () =>
        this.client.send(new PutCommand({ TableName: this.table, Item: toCustomerItem(customer) })),
      toPersistenceError,
    );
    return output.map(() => customer);
  }
}
