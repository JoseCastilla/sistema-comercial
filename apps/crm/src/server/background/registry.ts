import "server-only";

/**
 * Bucles de fondo en el mismo proceso (SPEC-062 M-03). Cada módulo registra
 * el suyo con `registerLoop`; `instrumentation.ts` los arranca una vez.
 * Un bucle nunca se solapa consigo mismo y un fallo no lo detiene.
 */
interface LoopDefinition {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

interface LoopState extends LoopDefinition {
  running: boolean;
  timer: ReturnType<typeof setInterval> | null;
  lastRunAt: Date | null;
  lastError: string | null;
}

const globalForLoops = globalThis as typeof globalThis & {
  crmLoops?: Map<string, LoopState>;
  crmLoopsStarted?: boolean;
};

const loops = globalForLoops.crmLoops ?? new Map<string, LoopState>();
globalForLoops.crmLoops = loops;

export function registerLoop(definition: LoopDefinition): void {
  const existing = loops.get(definition.name);
  if (existing) {
    // Recarga en desarrollo: se conserva el timer y se actualiza la función.
    existing.run = definition.run;
    existing.intervalMs = definition.intervalMs;
    return;
  }
  const state: LoopState = { ...definition, running: false, timer: null, lastRunAt: null, lastError: null };
  loops.set(definition.name, state);
  if (globalForLoops.crmLoopsStarted) {
    startLoop(state);
  }
}

function startLoop(state: LoopState) {
  if (state.timer) return;
  const tick = async () => {
    if (state.running) return;
    state.running = true;
    try {
      await state.run();
      state.lastError = null;
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      console.error(`Bucle ${state.name} falló`, error);
    } finally {
      state.running = false;
      state.lastRunAt = new Date();
    }
  };
  state.timer = setInterval(() => void tick(), state.intervalMs);
  void tick();
}

export function startAllLoops(): void {
  globalForLoops.crmLoopsStarted = true;
  for (const state of loops.values()) startLoop(state);
}

/** Ejecuta un bucle ahora (lo usan las pruebas y el botón «procesar ahora»). */
export async function runLoopNow(name: string): Promise<void> {
  const state = loops.get(name);
  if (!state) throw new Error(`No existe el bucle ${name}`);
  if (state.running) return;
  state.running = true;
  try {
    await state.run();
  } finally {
    state.running = false;
    state.lastRunAt = new Date();
  }
}

export function loopsStatus() {
  return [...loops.values()].map(({ name, intervalMs, running, lastRunAt, lastError }) => ({
    name,
    intervalMs,
    running,
    lastRunAt,
    lastError,
  }));
}
