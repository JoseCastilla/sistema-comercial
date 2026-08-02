import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

function getPort(): number {
  const port = Number(process.env.PORT ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un nÃºmero entero entre 1 y 65535');
  }

  return port;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  const host = process.env.HOST ?? '0.0.0.0';
  const port = getPort();

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');

  logger.log(`API disponible en http://${host}:${port}/api/v1`);
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');

  logger.error(
    'No se pudo iniciar la API',
    error instanceof Error ? error.stack : String(error),
  );

  process.exitCode = 1;
});
