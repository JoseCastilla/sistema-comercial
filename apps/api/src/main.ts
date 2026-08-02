import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  const port = Number(process.env.PORT ?? 3001);

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');

  logger.log(`API disponible en http://0.0.0.0:${port}/api/v1`);
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');

  logger.error(
    'No se pudo iniciar la API',
    error instanceof Error ? error.stack : String(error),
  );

  process.exitCode = 1;
});
