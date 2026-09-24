import { describe, expect, it } from "vitest";

import {
  extensionForMime,
  externalIdsFor,
  extractChanges,
  isMarketingOptOut,
  limitTierFrom,
  parseInboundMessages,
  parseNumberUpdate,
  parseStatuses,
  parseTemplateUpdate,
  parseUserPreferences,
  timestampToDate,
} from "./parse";

const METADATA = { display_phone_number: "51999888777", phone_number_id: "111222333" };

function whatsappBody(field: string, value: unknown) {
  return { object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field, value }] }] };
}

describe("lectura del webhook de Meta", () => {
  it("aplana entry[].changes[] y conserva la WABA", () => {
    const changes = extractChanges(whatsappBody("messages", { metadata: METADATA }));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ field: "messages", entryId: "WABA1" });
    expect(extractChanges(null)).toEqual([]);
    expect(extractChanges({ entry: "no es lista" })).toEqual([]);
  });

  it("convierte el timestamp en segundos a fecha", () => {
    expect(timestampToDate("1789000000").toISOString()).toBe(new Date(1_789_000_000_000).toISOString());
    const fallback = new Date("2026-09-12T00:00:00Z");
    expect(timestampToDate(undefined, fallback)).toBe(fallback);
  });
});

describe("mensajes entrantes", () => {
  const textValue = {
    messaging_product: "whatsapp",
    metadata: METADATA,
    contacts: [{ profile: { name: "Ana Quispe" }, wa_id: "51987654321" }],
    messages: [
      {
        from: "51987654321",
        id: "wamid.TEXTO",
        timestamp: "1789000000",
        type: "text",
        text: { body: "Hola, quiero portar mi línea" },
      },
    ],
  };

  it("normaliza un mensaje de texto", () => {
    const [message] = parseInboundMessages(textValue);
    expect(message).toMatchObject({
      externalId: "wamid.TEXTO",
      phoneNumberId: "111222333",
      phone: "51987654321",
      profileName: "Ana Quispe",
      waUserId: null,
      type: "text",
      body: "Hola, quiero portar mi línea",
      media: null,
      referral: null,
    });
    expect(message!.timestamp.toISOString()).toBe(new Date(1_789_000_000_000).toISOString());
    expect(message!.raw).toMatchObject({ id: "wamid.TEXTO" });
  });

  it("toma el business-scoped user id cuando Meta lo manda", () => {
    const [message] = parseInboundMessages({
      ...textValue,
      contacts: [{ profile: { name: "Ana" }, wa_id: "51987654321", user_id: "BSUID-123" }],
    });
    expect(message).toMatchObject({ waUserId: "BSUID-123", phone: "51987654321" });
  });

  it("normaliza una imagen con su pie y guarda el id del archivo", () => {
    const [message] = parseInboundMessages({
      ...textValue,
      messages: [
        {
          from: "51987654321",
          id: "wamid.IMAGEN",
          timestamp: "1789000100",
          type: "image",
          image: { id: "MEDIA1", mime_type: "image/jpeg", sha256: "abc", caption: "Mi DNI" },
        },
      ],
    });
    expect(message).toMatchObject({ type: "image", body: "Mi DNI" });
    expect(message!.media).toEqual({ mediaId: "MEDIA1", mimeType: "image/jpeg", sha256: "abc", filename: null, caption: "Mi DNI" });
  });

  it("lee botones, listas, ubicación, reacción y no soportados", () => {
    const value = (message: Record<string, unknown>) => parseInboundMessages({ ...textValue, messages: [{ from: "519", id: `wamid.${String(message.type)}`, timestamp: "1789000000", ...message }] })[0]!;

    const button = value({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "si_quiero", title: "Sí, quiero" } } });
    expect(button.body).toBe("Sí, quiero");
    expect(button.payload).toMatchObject({ interactiveKind: "button_reply", replyId: "si_quiero" });

    const list = value({ type: "interactive", interactive: { type: "list_reply", list_reply: { id: "plan_39", title: "Plan 39", description: "20 GB" } } });
    expect(list.body).toBe("Plan 39");

    const location = value({ type: "location", location: { latitude: -12.05, longitude: -77.04, name: "Tienda Centro" } });
    expect(location.body).toBe("Tienda Centro");
    expect(location.payload).toMatchObject({ latitude: -12.05 });

    const reaction = value({ type: "reaction", reaction: { message_id: "wamid.PREVIO", emoji: "👍" } });
    expect(reaction.body).toBe("👍");

    const unsupported = value({ type: "unsupported", errors: [{ code: 131051, title: "Tipo de mensaje no admitido" }] });
    expect(unsupported.body).toBe("Tipo de mensaje no admitido");
  });

  it("guarda el referral del anuncio tal como llega", () => {
    const [message] = parseInboundMessages({
      ...textValue,
      messages: [{ ...textValue.messages[0], referral: { source_id: "AD123", source_type: "ad", headline: "Portabilidad" } }],
    });
    expect(message!.referral).toEqual({ source_id: "AD123", source_type: "ad", headline: "Portabilidad" });
  });

  it("descarta el cambio sin phone_number_id o sin mensajes", () => {
    expect(parseInboundMessages({ messages: [] })).toEqual([]);
    expect(parseInboundMessages({ metadata: METADATA, statuses: [{ id: "x", status: "sent" }] })).toEqual([]);
  });
});

describe("estados de entrega", () => {
  const value = {
    messaging_product: "whatsapp",
    metadata: METADATA,
    statuses: [
      {
        id: "wamid.ENVIADO",
        status: "delivered",
        timestamp: "1789000200",
        recipient_id: "51987654321",
        conversation: { id: "CONV1", origin: { type: "marketing" } },
        pricing: { billable: true, pricing_model: "CBP", category: "marketing" },
      },
    ],
  };

  it("normaliza entregado con su precio y su conversación", () => {
    const [status] = parseStatuses(value);
    expect(status).toMatchObject({ wamid: "wamid.ENVIADO", status: "DELIVERED", rawStatus: "delivered", recipientPhone: "51987654321" });
    expect(status!.pricing).toEqual({ billable: true, pricing_model: "CBP", category: "marketing" });
    expect(status!.conversation).toMatchObject({ id: "CONV1" });
  });

  it("normaliza un fallo con su código y su motivo", () => {
    const [status] = parseStatuses({
      ...value,
      statuses: [
        {
          id: "wamid.FALLO",
          status: "failed",
          timestamp: "1789000300",
          errors: [{ code: 131047, title: "Re-engagement message", error_data: { details: "Pasaron más de 24 horas" } }],
        },
      ],
    });
    expect(status).toMatchObject({ status: "FAILED", errorCode: "131047", errorTitle: "Re-engagement message" });
  });

  it("ignora estados que no sabemos leer", () => {
    expect(parseStatuses({ statuses: [{ id: "x", status: "deleted" }] })).toEqual([]);
  });
});

describe("plantillas", () => {
  it("lee la aprobación", () => {
    const update = parseTemplateUpdate("message_template_status_update", {
      message_template_id: "9001",
      message_template_name: "recordatorio_de_cita",
      message_template_language: "es",
      event: "APPROVED",
      timestamp: "1789000400",
    });
    expect(update).toMatchObject({ externalId: "9001", name: "recordatorio_de_cita", language: "es", event: "APPROVED", rejectedReason: null });
  });

  it("lee el rechazo con su motivo y la pausa con su fin", () => {
    const rejected = parseTemplateUpdate("message_template_status_update", {
      message_template_id: "9002",
      event: "REJECTED",
      reason: "INCORRECT_CATEGORY",
    });
    expect(rejected).toMatchObject({ event: "REJECTED", rejectedReason: "INCORRECT_CATEGORY" });

    const paused = parseTemplateUpdate("message_template_status_update", {
      message_template_id: "9003",
      event: "PAUSED",
      other_info: { expiration: "1789003600" },
    });
    expect(paused!.pausedUntil?.toISOString()).toBe(new Date(1_789_003_600_000).toISOString());
  });

  it("lee el cambio de categoría y la calidad", () => {
    const category = parseTemplateUpdate("template_category_update", {
      message_template_id: "9004",
      previous_category: "UTILITY",
      new_category: "MARKETING",
    });
    expect(category).toMatchObject({ previousCategory: "UTILITY", newCategory: "MARKETING" });

    const quality = parseTemplateUpdate("message_template_quality_update", {
      message_template_id: "9005",
      new_quality_score: "RED",
      previous_quality_score: "GREEN",
    });
    expect(quality).toMatchObject({ qualityScore: "RED" });
  });

  it("descarta el aviso sin identificador ni nombre", () => {
    expect(parseTemplateUpdate("template_category_update", { event: "x" })).toBeNull();
  });
});

describe("número y cuenta", () => {
  it("lee la bajada de calidad y el límite", () => {
    const update = parseNumberUpdate("phone_number_quality_update", {
      display_phone_number: "51 999 888 777",
      event: "FLAGGED",
      current_limit: "TIER_1K",
    });
    expect(update).toMatchObject({ event: "FLAGGED", currentLimit: "TIER_1K", restricted: true });
    expect(limitTierFrom(update.currentLimit)).toBe("TIER_1K");
    expect(limitTierFrom("1K")).toBe("TIER_1K");
    expect(limitTierFrom(null)).toBeNull();
  });

  it("una restricción de cuenta se marca aunque no traiga evento conocido", () => {
    expect(parseNumberUpdate("account_update", { restriction_info: [{ restriction_type: "RESTRICTED_ADD_PHONE_NUMBER" }] }).restricted).toBe(true);
    expect(parseNumberUpdate("account_update", { restriction_info: { restriction_type: "X" } }).restricted).toBe(true);
    expect(parseNumberUpdate("account_update", { event: "VERIFIED_ACCOUNT" }).restricted).toBe(false);
  });
});

describe("preferencias de la persona", () => {
  const value = {
    messaging_product: "whatsapp",
    metadata: METADATA,
    user_preferences: [{ wa_id: "51987654321", detail: "User requested to stop marketing messages", category: "marketing_messages", value: "stop", timestamp: "1789000500" }],
  };

  it("detecta la baja de marketing", () => {
    const [preference] = parseUserPreferences(value);
    expect(preference).toMatchObject({ waId: "51987654321", category: "marketing_messages", value: "stop" });
    expect(isMarketingOptOut(preference!)).toBe(true);
  });

  it("volver a aceptar no es baja", () => {
    const [preference] = parseUserPreferences({ ...value, user_preferences: [{ wa_id: "519", category: "marketing_messages", value: "resume" }] });
    expect(isMarketingOptOut(preference!)).toBe(false);
  });
});

describe("claves de idempotencia", () => {
  it("una por mensaje, una por estado", () => {
    const [change] = extractChanges(
      whatsappBody("messages", {
        metadata: METADATA,
        contacts: [{ wa_id: "519", profile: { name: "Ana" } }],
        messages: [
          { from: "519", id: "wamid.A", timestamp: "1789000000", type: "text", text: { body: "uno" } },
          { from: "519", id: "wamid.B", timestamp: "1789000001", type: "text", text: { body: "dos" } },
        ],
      }),
    );
    expect(externalIdsFor(change!).map((item) => item.externalId)).toEqual(["msg:wamid.A", "msg:wamid.B"]);
  });

  it("el estado lleva el wamid y el estado", () => {
    const [change] = extractChanges(whatsappBody("messages", { metadata: METADATA, statuses: [{ id: "wamid.A", status: "read", timestamp: "1789000000" }] }));
    expect(externalIdsFor(change!)[0]!.externalId).toBe("status:wamid.A:read");
  });

  it("la plantilla lleva id, evento y momento", () => {
    const [change] = extractChanges(whatsappBody("message_template_status_update", { message_template_id: "9001", event: "APPROVED", timestamp: "1789000400" }));
    expect(externalIdsFor(change!)[0]!.externalId).toBe("template:9001:APPROVED:1789000400");
  });

  it("el número lleva teléfono, evento y momento", () => {
    const [change] = extractChanges(whatsappBody("phone_number_quality_update", { display_phone_number: "51999888777", event: "DOWNGRADE", current_limit: "TIER_250", timestamp: "1789000600" }));
    expect(externalIdsFor(change!)[0]!.externalId).toBe("phone:51999888777:DOWNGRADE:1789000600");
  });

  it("la preferencia lleva a la persona y su decisión", () => {
    const [change] = extractChanges(whatsappBody("user_preferences", { metadata: METADATA, user_preferences: [{ wa_id: "51987654321", category: "marketing_messages", value: "stop", timestamp: "1789000700" }] }));
    expect(externalIdsFor(change!)[0]!.externalId).toBe("preference:51987654321:stop:1789000700");
  });

  it("lo que no conocemos se guarda una sola vez", () => {
    const [change] = extractChanges(whatsappBody("flows", { flow_id: "1", timestamp: "1789000800" }));
    expect(externalIdsFor(change!)[0]!.externalId).toBe("flows:WABA1:1789000800");
  });
});

describe("extensión del archivo", () => {
  it("usa el tipo que informa Meta", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("audio/ogg; codecs=opus")).toBe("ogg");
    expect(extensionForMime("application/pdf")).toBe("pdf");
    expect(extensionForMime("application/vnd.raro")).toBe("bin");
    expect(extensionForMime(null)).toBe("bin");
  });
});
