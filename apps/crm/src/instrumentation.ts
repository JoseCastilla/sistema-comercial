/**
 * Arranque de los bucles de fondo del MVP (SPEC-062 M-03). Cada módulo
 * registra el suyo al importarse; aquí solo se importan y se arrancan.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startAllLoops } = await import("./server/background/registry");
  await import("./server/background/loops");
  startAllLoops();
}
