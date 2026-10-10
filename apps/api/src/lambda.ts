import 'reflect-metadata';
import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Callback, Context, Handler } from 'aws-lambda';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

/** Built once per execution environment and reused by warm invocations. */
let cachedServer: Promise<Handler> | undefined;

async function createServer(): Promise<Handler> {
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule));
  await app.init();
  return serverlessExpress({ app: app.getHttpAdapter().getInstance() });
}

export const handler: Handler = async (event: unknown, context: Context, callback: Callback) => {
  cachedServer ??= createServer().catch((error: unknown) => {
    // Do not cache a failed boot (for example a missing parameter): retry on the next invocation.
    cachedServer = undefined;
    throw error;
  });
  const server = await cachedServer;
  return server(event, context, callback);
};
