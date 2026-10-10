import { Global, Module, ModuleMetadata } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { configureApp } from '../../src/bootstrap';
import { APP_CONFIG, AppConfig } from '../../src/shared/config/app-config';
import { HttpKernelModule } from '../../src/shared/http/http-kernel.module';
import { testConfig } from './test-config';

/**
 * Builds an HTTP application around the given controllers with the real pipes, filter, guard and
 * middleware (`configureApp`), so controller specs exercise the true request pipeline while the
 * use cases are faked through `providers`.
 */
export async function createHttpTestApp(
  metadata: Pick<ModuleMetadata, 'controllers' | 'providers' | 'imports'>,
  config: AppConfig = testConfig(),
): Promise<NestExpressApplication> {
  @Global()
  @Module({ providers: [{ provide: APP_CONFIG, useValue: config }], exports: [APP_CONFIG] })
  class TestConfigModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [TestConfigModule, HttpKernelModule, ...(metadata.imports ?? [])],
    controllers: metadata.controllers,
    providers: metadata.providers,
  }).compile();

  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
  app.useLogger(false);
  await app.init();
  return app;
}
