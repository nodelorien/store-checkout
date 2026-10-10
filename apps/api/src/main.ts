import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { APP_CONFIG, AppConfig } from './shared/config/app-config';

async function main(): Promise<void> {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  // Explicit adapter: Nest's default lookup is a dynamic require that depends on hoisting.
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter()),
  );
  await app.listen(app.get<AppConfig>(APP_CONFIG).port);
}

void main();
