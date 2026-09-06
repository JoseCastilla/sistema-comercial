import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

/**
 * SPEC-046 BR-001/BR-003: el worker es el reloj de la plataforma. Cada
 * pasada llama al mantenimiento de la web (AGR a sus horas, vencimientos,
 * liberaciones, retorno al pool) y al reintento de webhooks de la API. No
 * toca la base de datos: las reglas viven donde ya vivían; el worker solo
 * garantiza que corran aunque nadie abra una página.
 *
 * Variables: WEB_INTERNAL_URL, API_INTERNAL_URL, MAINTENANCE_INTERNAL_SECRET,
 * MAINTENANCE_INTERVAL_MINUTES (5 por defecto).
 */
@Injectable()
export class WorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WorkerService.name);

  private timer: NodeJS.Timeout | null = null;

  private running = false;

  onApplicationBootstrap(): void {
    const intervalMinutes = readIntervalMinutes();

    this.logger.log(
      `Worker listo: mantenimiento cada ${intervalMinutes} minuto(s)`,
    );

    // La primera pasada espera medio minuto: da tiempo a que web y api
    // terminen de arrancar en el mismo despliegue.
    this.timer = setTimeout(() => {
      void this.tick();

      this.timer = setInterval(
        () => {
          void this.tick();
        },
        intervalMinutes * 60 * 1000,
      );
    }, 30 * 1000);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      clearInterval(this.timer);
    }

    this.logger.log('Worker detenido correctamente');
  }

  async tick(): Promise<void> {
    // Una pasada larga no debe solaparse con la siguiente.
    if (this.running) {
      this.logger.warn('Pasada anterior todavía en curso; se omite esta');

      return;
    }

    this.running = true;

    try {
      await this.callMaintenance(
        'web',
        process.env.WEB_INTERNAL_URL,
        '/api/internal/maintenance',
      );

      await this.callMaintenance(
        'api',
        process.env.API_INTERNAL_URL,
        '/api/v1/internal/maintenance/webhooks-retry',
      );
    } finally {
      this.running = false;
    }
  }

  private async callMaintenance(
    target: string,
    baseUrl: string | undefined,
    path: string,
  ): Promise<void> {
    const secret = process.env.MAINTENANCE_INTERNAL_SECRET?.trim();

    if (!baseUrl?.trim() || !secret) {
      this.logger.error(
        `Falta configuración para ${target}: URL interna o MAINTENANCE_INTERNAL_SECRET`,
      );

      return;
    }

    const url = `${baseUrl.trim().replace(/\/$/, '')}${path}`;

    try {
      const response = await fetch(url, {
        method: 'POST',

        headers: {
          'x-maintenance-secret': secret,
        },

        signal: AbortSignal.timeout(10 * 60 * 1000),
      });

      const body = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        this.logger.error(
          `Mantenimiento ${target} respondió ${response.status}: ${JSON.stringify(body)}`,
        );

        return;
      }

      this.logger.log(`Mantenimiento ${target}: ${summarize(body)}`);
    } catch (error) {
      this.logger.error(
        `Mantenimiento ${target} no respondió: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function readIntervalMinutes(): number {
  const raw = Number(process.env.MAINTENANCE_INTERVAL_MINUTES ?? '5');

  return Number.isFinite(raw) && raw >= 1 && raw <= 60 ? Math.floor(raw) : 5;
}

/** Resumen de una línea: qué falló se ve sin abrir el JSON. */
function summarize(body: unknown): string {
  if (!body || typeof body !== 'object') return 'sin detalle';

  const record = body as Record<string, unknown>;

  if (Array.isArray(record.organizations)) {
    const failures: string[] = [];

    let jobs = 0;

    for (const organization of record.organizations as Array<
      Record<string, unknown>
    >) {
      const list = Array.isArray(organization.jobs)
        ? (organization.jobs as Array<Record<string, unknown>>)
        : [];

      jobs += list.length;

      for (const job of list) {
        if (job.ok === false) {
          failures.push(
            `${String(organization.organization)}/${String(job.job)}: ${String(job.error)}`,
          );
        }
      }
    }

    return failures.length === 0
      ? `${jobs} trabajo(s) en verde`
      : `${failures.length} de ${jobs} fallaron → ${failures.join(' | ')}`;
  }

  if ('candidates' in record) {
    return `webhooks: ${String(record.candidates)} candidatos, ${String(record.processed)} recuperados, ${String(record.failed)} siguen fallando`;
  }

  return JSON.stringify(record).slice(0, 300);
}
