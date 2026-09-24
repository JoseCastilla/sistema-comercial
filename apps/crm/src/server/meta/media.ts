import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { downloadMedia, getMediaUrl } from "./graph";
import { extensionForMime, type ParsedMedia } from "./parse";

/**
 * Descarga de adjuntos entrantes. Se guardan en `CRM_STORAGE_DIR/media/
 * <organizationId>/<wamid>.<ext>` y se sirven por `/api/media/<ruta>` con
 * sesión (SPEC-062 M-05). La ruta que se guarda es relativa a la carpeta.
 */
export interface StoredMedia {
  path: string;
  mimeType: string;
  sizeBytes: number;
}

export function storageRoot(): string {
  return path.resolve(process.env.CRM_STORAGE_DIR ?? "./storage");
}

/** El wamid trae caracteres que no sirven de nombre de archivo. */
function safeName(wamid: string): string {
  return wamid.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
}

export async function downloadInboundMedia(input: {
  token: string;
  organizationId: string;
  wamid: string;
  media: ParsedMedia;
}): Promise<StoredMedia> {
  const info = await getMediaUrl(input.token, input.media.mediaId);
  const buffer = await downloadMedia(input.token, info.url);
  const mimeType = info.mime_type ?? input.media.mimeType ?? "application/octet-stream";
  const relative = path.posix.join("media", input.organizationId, `${safeName(input.wamid)}.${extensionForMime(mimeType)}`);
  const target = path.resolve(storageRoot(), relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
  return { path: relative, mimeType, sizeBytes: buffer.byteLength };
}
