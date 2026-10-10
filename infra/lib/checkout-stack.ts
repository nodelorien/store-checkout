import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Api } from './api';
import type { DeploymentConfig } from './config';
import { Database } from './database';
import { Web } from './web';

export interface CheckoutStackProps extends StackProps {
  config: DeploymentConfig;
}

export class CheckoutStack extends Stack {
  constructor(scope: Construct, id: string, { config, ...props }: CheckoutStackProps) {
    super(scope, id, props);

    const database = new Database(this, 'Database', { stage: config.stage });
    const api = new Api(this, 'Api', { config, database });
    const web = new Web(this, 'Web', { config, apiDomainName: api.domainName });

    const siteUrl = `https://${web.distribution.distributionDomainName}`;
    new CfnOutput(this, 'SiteUrl', { value: siteUrl });
    new CfnOutput(this, 'ApiDocsUrl', { value: `${siteUrl}/api/docs` });
    new CfnOutput(this, 'ApiBaseUrl', { value: `${siteUrl}/api/v1` });
    new CfnOutput(this, 'ProductsTableName', { value: database.products.tableName });
  }
}
