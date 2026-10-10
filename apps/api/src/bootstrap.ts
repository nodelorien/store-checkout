import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = 'api/docs';

/** Shared application setup used by the local server, the Lambda handler and the tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin.split(',').map((origin) => origin.trim()) });
  }

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Store checkout API')
      .setDescription('Products, stock, customers, transactions and deliveries')
      .setVersion('1.0')
      .build(),
  );
  SwaggerModule.setup(DOCS_PATH, app, document);

  return app;
}
