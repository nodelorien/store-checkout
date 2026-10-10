import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table, type ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseProps {
  stage: string;
}

/** The four aggregate tables described in docs/components/backend/data-model.md. */
export class Database extends Construct {
  readonly products: Table;
  readonly customers: Table;
  readonly transactions: Table;
  readonly deliveries: Table;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    this.products = this.table('Products', `checkout-${props.stage}-products`);

    this.customers = this.table('Customers', `checkout-${props.stage}-customers`);
    this.index(this.customers, 'byEmail', 'email');

    this.transactions = this.table('Transactions', `checkout-${props.stage}-transactions`);
    this.index(this.transactions, 'byReference', 'reference');
    this.index(this.transactions, 'byIdempotencyKey', 'idempotencyKey');

    this.deliveries = this.table('Deliveries', `checkout-${props.stage}-deliveries`);
    this.index(this.deliveries, 'byTransaction', 'transactionId');
  }

  get all(): ITable[] {
    return [this.products, this.customers, this.transactions, this.deliveries];
  }

  private table(id: string, tableName: string): Table {
    return new Table(this, id, {
      tableName,
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      // Assessment stack: tear down cleanly. Switch to RETAIN for real data.
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  private index(table: Table, indexName: string, attribute: string): void {
    table.addGlobalSecondaryIndex({
      indexName,
      partitionKey: { name: attribute, type: AttributeType.STRING },
    });
  }
}
