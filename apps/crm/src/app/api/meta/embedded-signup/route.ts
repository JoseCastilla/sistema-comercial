import { revalidatePath } from "next/cache";

import { requireAccess } from "@/server/auth/access";
import { describeMetaError, MetaApiError } from "@/server/meta/errors";
import { exchangeCodeForToken } from "@/server/meta/graph";
import { connectFromEmbeddedSignup } from "@/server/meta/numbers";

/**
 * Cierra el Embedded Signup: canjea el código por el token de Meta, registra
 * el número con un PIN nuevo y lo guarda cifrado. Solo el dueño conecta.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Body {
  code?: unknown;
  phoneNumberId?: unknown;
  wabaId?: unknown;
}

export async function POST(request: Request) {
  const access = await requireAccess();
  if (access.role !== "OWNER") {
    return Response.json({ ok: false, error: "Solo el dueño del negocio puede conectar un número." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "La petición llegó mal formada." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const phoneNumberId = typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
  const wabaId = typeof body.wabaId === "string" ? body.wabaId.trim() : "";
  if (!code) return Response.json({ ok: false, error: "Meta no devolvió la autorización." }, { status: 400 });
  if (!phoneNumberId || !wabaId) {
    return Response.json(
      { ok: false, error: "Meta no dijo qué número se conectó. Vuelve a intentar sin cerrar la ventana antes de tiempo." },
      { status: 400 },
    );
  }

  try {
    const { accessToken } = await exchangeCodeForToken(code);
    const { number, pin, registerError } = await connectFromEmbeddedSignup({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      wabaId,
      phoneNumberId,
      token: accessToken,
    });
    revalidatePath("/settings/whatsapp");
    return Response.json({
      ok: true,
      // El PIN se muestra una sola vez: no se guarda en ningún lado.
      pin,
      message: registerError
        ? `Número guardado, pero Meta no aceptó registrarlo: ${registerError}`
        : `Conectado ${number.verifiedName ?? number.displayPhoneNumber ?? phoneNumberId}. Ya puedes recibir mensajes.`,
    });
  } catch (error) {
    console.error("Embedded Signup falló", error);
    const message = error instanceof MetaApiError
      ? describeMetaError(error)
      : error instanceof Error
        ? error.message
        : "No se pudo conectar el número.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
