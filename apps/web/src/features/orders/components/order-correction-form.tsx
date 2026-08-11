"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { Field, SelectInput, TextInput } from "@repo/ui/field";

import { correctOrderAction } from "../server/correct-order-action";

import type { OrderInboxItem } from "../order-inbox.types";
import type { OrderCorrectionActionState } from "../server/order-correction-action.types";

const initialState: OrderCorrectionActionState = { type: "idle", message: "" };

export function OrderCorrectionForm({ order }: { order: OrderInboxItem }) {
  const [state, action, pending] = useActionState(
    correctOrderAction,
    initialState,
  );

  return (
    <details className="rounded-xl border border-ui-warning-border bg-ui-warning-soft p-4">
      <summary className="cursor-pointer text-sm font-semibold text-ui-warning">
        Corregir datos recibidos de DITO
      </summary>

      <p className="mt-2 text-sm leading-6 text-ui-warning">
        Esta acción modifica los datos operativos, conserva el resumen original
        y registra tu identidad y el motivo.
      </p>

      <form action={action} className="ui-form-stack mt-4">
        <input name="orderId" type="hidden" value={order.id} />
        <input name="expectedUpdatedAt" type="hidden" value={order.updatedAt} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            error={state.fieldErrors?.operationRaw}
            label="Operación completa"
          >
            <TextInput
              defaultValue={order.operation}
              disabled={pending}
              maxLength={200}
              name="operationRaw"
              required
            />
          </Field>
          <Field
            error={state.fieldErrors?.commercialOperation}
            label="Tipo de operación"
          >
            <SelectInput
              defaultValue={order.commercialOperation}
              disabled={pending}
              name="commercialOperation"
              required
            >
              <option value="">Seleccionar</option>
              <option value="NEW_LINE">Alta nueva</option>
              <option value="PORT_PREPAID">Portabilidad prepago</option>
              <option value="PORT_POSTPAID">Portabilidad postpago</option>
            </SelectInput>
          </Field>
          <Field error={state.fieldErrors?.carrier} label="Operador cedente">
            <SelectInput
              defaultValue={order.carrier}
              disabled={pending}
              name="carrier"
              required
            >
              <option value="UNKNOWN">No aplica / desconocido</option>
              <option value="BITEL">Bitel</option>
              <option value="CLARO">Claro</option>
              <option value="ENTEL">Entel</option>
              <option value="MOVISTAR">Movistar</option>
              <option value="OTHER">Otro</option>
            </SelectInput>
          </Field>
          <Field error={state.fieldErrors?.fixedCharge} label="Cargo fijo">
            <TextInput
              defaultValue={order.fixedCharge ?? ""}
              disabled={pending}
              min="0"
              name="fixedCharge"
              step="0.01"
              type="number"
            />
          </Field>
          <Field
            error={state.fieldErrors?.holderName}
            label="Nombre del titular"
          >
            <TextInput
              defaultValue={order.holderName}
              disabled={pending}
              maxLength={200}
              name="holderName"
              required
            />
          </Field>
          <Field error={state.fieldErrors?.documentNumber} label="Documento">
            <TextInput
              defaultValue={order.documentNumber}
              disabled={pending}
              maxLength={30}
              name="documentNumber"
              required
            />
          </Field>
          <Field
            error={state.fieldErrors?.serviceNumber}
            label="Teléfono de la operación"
          >
            <TextInput
              defaultValue={order.serviceNumber}
              disabled={pending}
              maxLength={30}
              name="serviceNumber"
              required
            />
          </Field>
          <Field
            error={state.fieldErrors?.deliveryContactPhone}
            label="Teléfono de contacto"
          >
            <TextInput
              defaultValue={order.deliveryContactPhone}
              disabled={pending}
              maxLength={30}
              name="deliveryContactPhone"
              required
            />
          </Field>
          <Field
            error={state.fieldErrors?.deliveryMethod}
            label="Forma de entrega"
          >
            <SelectInput
              defaultValue={order.deliveryMethod}
              disabled={pending}
              name="deliveryMethod"
              required
            >
              <option value="">Seleccionar</option>
              <option value="EXPRESS">Express</option>
              <option value="REGULAR_24H">Regular 24 h</option>
              <option value="REGULAR_48H">Regular 48 h</option>
              <option value="REGULAR_72H">Regular 72 h</option>
            </SelectInput>
          </Field>
          <Field
            error={state.fieldErrors?.deliveryTimeRange}
            label="Horario de entrega"
          >
            <TextInput
              defaultValue={order.deliveryTimeRange ?? ""}
              disabled={pending}
              maxLength={100}
              name="deliveryTimeRange"
            />
          </Field>
          <Field error={state.fieldErrors?.department} label="Departamento">
            <TextInput
              defaultValue={order.department}
              disabled={pending}
              maxLength={100}
              name="department"
              required
            />
          </Field>
          <Field error={state.fieldErrors?.province} label="Provincia">
            <TextInput
              defaultValue={order.province}
              disabled={pending}
              maxLength={100}
              name="province"
              required
            />
          </Field>
          <Field error={state.fieldErrors?.district} label="Distrito">
            <TextInput
              defaultValue={order.district}
              disabled={pending}
              maxLength={100}
              name="district"
              required
            />
          </Field>
          <Field error={state.fieldErrors?.salesCode} label="Código de venta">
            <TextInput
              defaultValue={order.salesCode ?? ""}
              disabled={pending}
              maxLength={100}
              name="salesCode"
            />
          </Field>
          <Field
            error={state.fieldErrors?.billingCycleDay}
            label="Día de ciclo"
          >
            <TextInput
              defaultValue={order.billingCycleDay ?? ""}
              disabled={pending}
              max="31"
              min="1"
              name="billingCycleDay"
              type="number"
            />
          </Field>
          <Field
            error={state.fieldErrors?.paymentDueDay}
            label="Último día de pago"
          >
            <TextInput
              defaultValue={order.paymentDueDay ?? ""}
              disabled={pending}
              max="31"
              min="1"
              name="paymentDueDay"
              type="number"
            />
          </Field>
        </div>

        <Field
          error={state.fieldErrors?.deliveryAddress}
          label="Dirección de entrega"
        >
          <TextInput
            defaultValue={order.deliveryAddress ?? ""}
            disabled={pending}
            maxLength={500}
            name="deliveryAddress"
          />
        </Field>
        <Field error={state.fieldErrors?.deliveryReference} label="Referencia">
          <TextInput
            defaultValue={order.deliveryReference ?? ""}
            disabled={pending}
            maxLength={500}
            name="deliveryReference"
          />
        </Field>
        <Field
          error={state.fieldErrors?.reason}
          hint="Quedará registrado en el historial."
          label="Motivo de la corrección"
        >
          <textarea
            className="ui-control min-h-24"
            disabled={pending}
            maxLength={500}
            name="reason"
            required
          />
        </Field>

        <InlineFeedback
          message={state.message}
          tone={
            state.type === "success"
              ? "success"
              : state.type === "idle"
                ? "neutral"
                : "danger"
          }
        />
        <Button disabled={pending} type="submit">
          {pending ? "Guardando corrección..." : "Guardar corrección auditada"}
        </Button>
      </form>
    </details>
  );
}
