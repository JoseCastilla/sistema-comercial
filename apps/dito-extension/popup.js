document.addEventListener("DOMContentLoaded", () => {
    const asesorInput = document.getElementById("asesor");
    const correoInput = document.getElementById("correo");
    const guardarBtn = document.getElementById("guardarAsesor");
    const extraerBtn = document.getElementById("extraer");
    const copiarBtn = document.getElementById("copiar");
    const resultadoArea = document.getElementById("resultado");
    const identidadEstado = document.getElementById("identidadEstado");
    let enviando = false;
    let extractedApiDetails = null;
    let extractionReady = false;

    copiarBtn.disabled = true;

    chrome.storage.local.get(["asesor", "agentEmail", "installationId"], (data) => {
        if (data.asesor) asesorInput.value = data.asesor;
        if (data.agentEmail) correoInput.value = data.agentEmail;

        if (data.asesor && data.agentEmail && data.installationId) {
            bloquearIdentidad();
            identidadEstado.textContent = "Identidad registrada en esta instalación.";
        } else if (data.asesor) {
            asesorInput.disabled = true;
            identidadEstado.textContent =
                "Completa el correo corporativo para actualizar esta instalación.";
        }
    });

    function bloquearIdentidad() {
        asesorInput.disabled = true;
        correoInput.disabled = true;
        guardarBtn.disabled = true;
    }

    guardarBtn.addEventListener("click", () => {
        const nombre = asesorInput.value.trim();
        const correo = correoInput.value.trim().toLowerCase();

        if (!nombre) {
            identidadEstado.textContent = "Ingresa el nombre del asesor.";
            return;
        }

        if (!/^[^\s@]+@distribuidoronline\.com$/i.test(correo)) {
            identidadEstado.textContent =
                "Ingresa un correo @distribuidoronline.com válido.";
            return;
        }

        chrome.storage.local.get("installationId", (data) => {
            const installationId = data.installationId || crypto.randomUUID();

            chrome.storage.local.set(
                { asesor: nombre, agentEmail: correo, installationId },
                () => {
                    bloquearIdentidad();
                    identidadEstado.textContent =
                        "Identidad registrada en esta instalación.";
                }
            );
        });
    });

    extraerBtn.addEventListener("click", async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab?.id || !tab.url?.startsWith("https://ventas.movistar.com.pe/")) {
                alert("Abre una venta en ventas.movistar.com.pe antes de extraer datos.");
                return;
            }

            extractionReady = false;
            extractedApiDetails = null;
            resultadoArea.value = "";
            copiarBtn.disabled = true;
            extraerBtn.disabled = true;
            extraerBtn.textContent = "Leyendo detalle...";

            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: extraerDatos
            });

            if (!result?.ok) {
                const missing = result?.missingFields?.join(", ") || "detalle del pedido";
                alert(
                    result?.reason === "PLACEHOLDER_SEQUENCE"
                        ? `Información incompleta detectada (N/A). Despliega manualmente “Ver detalle del pedido” en DITO y vuelve a extraer. Revisa: ${missing}.`
                        : `No se puede enviar esta venta. Despliega manualmente “Ver detalle del pedido” en DITO y verifica: ${missing}.`
                );
                return;
            }

            const { asesor = "N/A" } = await chrome.storage.local.get("asesor");
            resultadoArea.value = result.summary.replace(
                "ASESOR: N/A",
                `ASESOR: ${asesor}`
            );
            extractedApiDetails = result.apiDetails;
            extractionReady = true;
            copiarBtn.disabled = false;
        } catch (error) {
            console.error(error);
            alert("No se pudo leer el detalle de la venta. Inténtalo nuevamente.");
        } finally {
            extraerBtn.disabled = false;
            extraerBtn.textContent = "Extraer datos";
        }
    });

    copiarBtn.addEventListener("click", async () => {
        if (enviando) return;

        try {
            const datos = resultadoArea.value;

            if (!extractionReady || !datos.trim() || !extractedApiDetails) {
                alert("Primero extrae los datos de la venta.");
                return;
            }

            const identity = await chrome.storage.local.get([
                "asesor",
                "agentEmail",
                "installationId"
            ]);

            if (!identity.asesor || !identity.agentEmail || !identity.installationId) {
                alert("Completa y guarda la identidad del asesor antes de enviar.");
                return;
            }

            enviando = true;
            copiarBtn.disabled = true;
            copiarBtn.textContent = "Enviando...";

            await navigator.clipboard.writeText(datos);

            const response = await fetch(
                "https://automatizaciones.distribuidoronline.com/webhook/ventas-televentas",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        venta: datos,
                        fecha: new Date().toISOString(),
                        extension: {
                            installation_id: identity.installationId,
                            agent_name: identity.asesor,
                            agent_email: identity.agentEmail,
                            order_details: extractedApiDetails
                        }
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`El webhook respondió HTTP ${response.status}`);
            }

            alert("Venta enviada correctamente");
        } catch (error) {
            console.error(error);
            alert("Error enviando datos");
        } finally {
            enviando = false;
            copiarBtn.disabled = false;
            copiarBtn.textContent = "Copiar y enviar";
        }
    });
});

async function extraerDatos() {
    function isPlaceholder(value) {
        const normalized = String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\bN\s*\/?\s*A\b/gi, "")
            .replace(/[-–—./|\s]/g, "")
            .trim();

        return normalized.length === 0;
    }

    function hasRenderedDetails() {
        const titles = [...document.querySelectorAll("app-order-detail-fe .title")];
        return titles.some((element) => !isPlaceholder(element.textContent));
    }

    const detailReady = hasRenderedDetails();

    if (!detailReady) {
        return {
            ok: false,
            reason: "DETAIL_COLLAPSED",
            missingFields: ["detalle desplegado"],
            summary: "",
            apiDetails: null
        };
    }

    function getDetailByTitle(title) {
        let elements = document.querySelectorAll(".title");
        for (let el of elements) {
            if (el.innerText.trim() === title) {
                return el.nextElementSibling?.innerText.trim() || "N/A";
            }
        }
        return "N/A";
    }

    function getNombre() {
        let el = document.querySelector(".user-data .data-user");
        return el?.innerText.trim() || "N/A";
    }

    function getDNI() {
        let bolds = document.querySelectorAll(".user-data .data-bold");
        for (let el of bolds) {
            if (el.innerText.includes("DNI")) {
                let text = el.innerText.replace("DNI:", "").replace("DNI", "").trim();
                if (text) return text;
                let sibling = el.nextElementSibling;
                if (sibling) return sibling.innerText.trim();
            }
        }
        let dniElement = [...document.querySelectorAll(".user-data")].find(el => el.innerText.includes("DNI:"));
        return dniElement ? dniElement.innerText.replace("DNI:", "").trim() : "N/A";
    }

    function getUserDataByLabel(label) {
        const expected = label.trim().toUpperCase();
        const labels = document.querySelectorAll(".data-bold");

        for (const element of labels) {
            const current = element.innerText
                .replace(/:\s*$/, "")
                .trim()
                .toUpperCase();

            if (current === expected) {
                return element.nextElementSibling?.innerText.trim() || "";
            }
        }

        return "";
    }

    function parseDay(value) {
        const match = String(value || "").match(/\b(\d{1,2})\b/);
        return match ? Number(match[1]) : null;
    }

    function parseCoordinates(value) {
        const text = String(value || "");
        const latitude = text.match(/X:\s*(-?\d+(?:\.\d+)?)/i)?.[1];
        const longitude = text.match(/Y:\s*(-?\d+(?:\.\d+)?)/i)?.[1];

        return {
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null
        };
    }

    let esVentaFija = getDetailByTitle("PLAN HOGAR") !== "N/A";

    const extraction = esVentaFija ? extraerVentaFija() : extraerVentaMovil();
    const missingFields = [];
    const core = extraction.core;
    const placeholderSequence = /(?:\bN\s*\/?\s*A\b[\s/|,.-]*){2,}/i.test(
        extraction.summary
    );

    if (isPlaceholder(core.operation)) missingFields.push("operación");
    if (isPlaceholder(core.holderName)) missingFields.push("nombre del cliente");
    if (!/^\d{8,11}$/.test(String(core.documentNumber || "").replace(/\D/g, ""))) {
        missingFields.push("documento");
    }
    if (!/^\d{7,15}$/.test(String(core.serviceNumber || "").replace(/\D/g, ""))) {
        missingFields.push("teléfono de la operación");
    }
    if (isPlaceholder(core.department)) missingFields.push("departamento");
    if (isPlaceholder(core.province)) missingFields.push("provincia");
    if (isPlaceholder(core.district)) missingFields.push("distrito");
    if (isPlaceholder(core.deliveryMethod)) missingFields.push("forma de entrega");
    if (!/^\d+[A-Z]*$/i.test(String(core.orderCode || "").replace(/\s/g, ""))) {
        missingFields.push("código de orden");
    }

    return {
        ok: missingFields.length === 0 && !placeholderSequence,
        reason: placeholderSequence ? "PLACEHOLDER_SEQUENCE" : null,
        missingFields,
        summary: extraction.summary,
        apiDetails: extraction.apiDetails
    };

    function extraerVentaMovil() {
        let operacion = getDetailByTitle("TRANSACCIÓN");
        let cedente = getDetailByTitle("OPERADOR CEDENTE");
        let tipo = getDetailByTitle("TIPO DE LÍNEA").toUpperCase();
        let plan_movil = getDetailByTitle("PLAN MÓVIL").match(/\d+(\.\d{1,2})?/)?.[0] || "N/A";

        let nombres = getNombre();
        let dni = getDNI();
        let telefono = getDetailByTitle("NÚMERO DE TELÉFONO");
        let departamento = getDetailByTitle("DEPARTAMENTO");
        let provincia = getDetailByTitle("PROVINCIA");
        let distrito = getDetailByTitle("DISTRITO");
        let tipoEntrega = getDetailByTitle("FORMA DE ENTREGA").toUpperCase();
        let horarioEntrega = getDetailByTitle("HORARIO DE ENTREGA");
        let telefonoContacto = getDetailByTitle("TELÉFONO DE CONTACTO");
        let direccionEntrega = getDetailByTitle("DIRECCIÓN DELIVERY");
        let referenciaEntrega = getDetailByTitle("REFERENCIA");
        let coordenadas = parseCoordinates(getDetailByTitle("COORDENADAS DE ENTREGA"));
        let cicloFacturacionRaw = getUserDataByLabel("Ciclo de facturación");
        let ultimoDiaPagoRaw = getUserDataByLabel("Último día de pago");
        let orderCode = document.querySelector(".position_Order .orden-big")?.textContent.trim() + "A" || "N/A";
        let codigoVenta = document.querySelector("#id-success-saleid")?.textContent.trim() || null;

        const operacionNormalizada = operacion.trim().toUpperCase();
        const esAltaNueva = operacionNormalizada === "ALTA";
        let operacion_movil = operacionNormalizada === "PORTABILIDAD"
            ? "PORTA"
            : esAltaNueva
                ? "ALTA NUEVA"
                : operacion;
        let tipo_linea = tipo === "POSTPAGO"
            ? "POST"
            : tipo === "PREPAGO"
                ? "PRE"
                : esAltaNueva
                    ? "POST"
                    : "";
        const operadorSegmento = esAltaNueva || cedente === "N/A" ? "" : cedente;
        const operacionResumen = [
            operacion_movil,
            operadorSegmento,
            tipo_linea,
            plan_movil
        ].filter(Boolean).join(" ");

        const summary = `
OPERACIÓN: ${operacionResumen}
NOMBRE: ${nombres}
DNI: ${dni} / TELÉFONO: ${telefono}

ZONAL: ${departamento} - ${provincia} - ${distrito}
ENTREGA: ${tipoEntrega}

ASESOR: N/A
CÓDIGO DE ORDEN: ${orderCode}
`.trim();

        return {
            summary,
            core: {
                operation: operacionResumen,
                holderName: nombres,
                documentNumber: dni,
                serviceNumber: telefono,
                department: departamento,
                province: provincia,
                district: distrito,
                deliveryMethod: tipoEntrega,
                orderCode
            },
            apiDetails: {
                billing_cycle_day: parseDay(cicloFacturacionRaw),
                payment_due_day: parseDay(ultimoDiaPagoRaw),
                billing_cycle_raw: cicloFacturacionRaw || null,
                payment_due_raw: ultimoDiaPagoRaw || null,
                transaction_raw: operacion || null,
                line_type_raw: tipo === "N/A" ? null : tipo,
                carrier_raw: cedente === "N/A" ? null : cedente,
                delivery_contact_phone: telefonoContacto || null,
                delivery_time_range: horarioEntrega || null,
                delivery_address: direccionEntrega || null,
                delivery_reference: referenciaEntrega || null,
                delivery_latitude: coordenadas.latitude,
                delivery_longitude: coordenadas.longitude,
                sales_code: codigoVenta
            }
        };
    }

    function extraerVentaFija() {
        let operacion = getDetailByTitle("TRANSACCIÓN");
        let planHogar = getDetailByTitle("PLAN HOGAR").toLowerCase();
        let velocidadRaw = getDetailByTitle("VELOCIDAD DE INTERNET");
        let velocidad = velocidadRaw.match(/(\d+)\s*Mbps/i)?.[1] || "N/A";

        // Detectar tipo de producto segun nombre del plan
        let tipoProducto = "MONO INTERNET";
        if (planHogar.includes("trio") || planHogar.includes("trío")) {
            tipoProducto = "INTERNET + TV + FONO";
        } else if (planHogar.includes("duo") || planHogar.includes("dúo")) {
            tipoProducto = "INTERNET + TV";
        }

        let nombres = getNombre();
        let dni = getDNI();
        let telefono = getDetailByTitle("TELÉFONO DE CONTACTO 1");
        let departamento = getDetailByTitle("DEPARTAMENTO");
        let provincia = getDetailByTitle("PROVINCIA");
        let distrito = getDetailByTitle("DISTRITO");
        let direccion = getDetailByTitle("DIRECCIÓN");
        let fechaInstalacion = getDetailByTitle("FECHA DE INSTALACIÓN");
        let horarioInstalacion = getDetailByTitle("HORARIO DE INSTALACIÓN");
        let orderCode = document.querySelector(".position_Order .orden-big")?.textContent.trim() + "A" || "N/A";
        let codigoVenta = document.querySelector("#id-success-saleid")?.textContent.trim() || "N/A";

        const summary = `
OPERACIÓN: ${operacion} ${tipoProducto} ${velocidad} MBPS
NOMBRE: ${nombres}
DNI: ${dni} / TELÉFONO: ${telefono}

ZONAL: ${departamento} - ${provincia} - ${distrito}
DIRECCIÓN: ${direccion}

FECHA DE INSTALACIÓN: ${fechaInstalacion}
HORARIO DE INSTALACIÓN: ${horarioInstalacion}

ASESOR: N/A
CÓDIGO DE ORDEN: ${orderCode}
CÓDIGO DE VENTA: ${codigoVenta}
`.trim();

        return {
            summary,
            core: {
                operation: `${operacion} ${tipoProducto} ${velocidad} MBPS`,
                holderName: nombres,
                documentNumber: dni,
                serviceNumber: telefono,
                department: departamento,
                province: provincia,
                district: distrito,
                deliveryMethod: direccion,
                orderCode
            },
            apiDetails: {
                billing_cycle_day: null,
                payment_due_day: null,
                billing_cycle_raw: null,
                payment_due_raw: null,
                delivery_contact_phone: telefono || null,
                delivery_time_range: horarioInstalacion || null,
                delivery_address: direccion || null,
                delivery_reference: null,
                delivery_latitude: null,
                delivery_longitude: null,
                sales_code: codigoVenta === "N/A" ? null : codigoVenta
            }
        };
    }
}
