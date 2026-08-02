import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('WorkerBootstrap');

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  logger.log('Worker iniciado');

  const signal = await new Promise<NodeJS.Signals>((resolve) => {
    process.once('SIGINT', () => resolve('SIGINT'));
    process.once('SIGTERM', () => resolve('SIGTERM'));
  });

  logger.log(`Señal ${signal} recibida. Cerrando worker...`);

  await app.close();
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('WorkerBootstrap');

  logger.error(
    'No se pudo iniciar el worker',
    error instanceof Error ? error.stack : String(error),
  );

  process.exitCode = 1;
});
