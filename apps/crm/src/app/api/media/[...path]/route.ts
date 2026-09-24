import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { auth } from "@/server/auth/auth";
import { database } from "@/server/database";
import { mediaResponseHeaders } from "@/server/meta/media-headers";

export const dynamic = "force-dynamic";

/**
 * Sirve adjuntos de `storage/` (SPEC-062 M-05) solo a quien pertenece a la
 * organización del adjunto. El tipo de contenido es el que se guardó al
 * recibirlo, nunca el que llega en la URL.
 */
export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("No autorizado", { status: 401 });

  const { path: segments } = await context.params;
  // Los adjuntos se guardan en `media/<organizationId>/<archivo>`.
  const [folder, organizationId] = segments;
  if (folder !== "media" || !organizationId) {
    return new Response("No encontrado", { status: 404 });
  }

  const membership = await database.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organizationId,
      user: { status: "ACTIVE" },
    },
    select: { id: true },
  });
  if (!membership) return new Response("No encontrado", { status: 404 });

  const relative = path.posix.join(...segments);
  const message = await database.message.findFirst({
    where: { organizationId, mediaPath: relative },
    select: { mediaMimeType: true },
  });
  if (!message) return new Response("No encontrado", { status: 404 });

  const root = path.resolve(process.env.CRM_STORAGE_DIR ?? "./storage");
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
    return new Response("No encontrado", { status: 404 });
  }

  return new Response(Readable.toWeb(createReadStream(target)) as ReadableStream, {
    headers: mediaResponseHeaders(message.mediaMimeType, path.basename(target)),
  });
}
