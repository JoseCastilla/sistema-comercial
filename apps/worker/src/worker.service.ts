import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

@Injectable()
export class WorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WorkerService.name);

  onApplicationBootstrap(): void {
    this.logger.log('Worker listo para procesar trabajos');
  }

  onApplicationShutdown(): void {
    this.logger.log('Worker detenido correctamente');
  }
}
