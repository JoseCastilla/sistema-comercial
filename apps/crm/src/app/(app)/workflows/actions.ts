"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { WorkflowStatus } from "@/generated/prisma/enums";
import { assertRole, requireAccess, type Access } from "@/server/auth/access";
import { failure, integer, optionalText, text, type ActionState } from "@/server/forms";
import { createWorkflow, parseDefinitionJson, saveWorkflow, setWorkflowStatus } from "@/server/workflows/service";

/** Los flujos los arman el dueño y los supervisores (BR-004). */
async function requireBuilder(): Promise<Access> {
  const access = await requireAccess();
  await assertRole(access, "OWNER", "SUPERVISOR");
  return access;
}

export async function createWorkflowAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let workflowId: string;
  try {
    const access = await requireBuilder();
    workflowId = await createWorkflow({
      organizationId: access.organizationId,
      userId: access.userId,
      name: text(formData, "name"),
      presetKey: optionalText(formData, "preset"),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/workflows");
  redirect(`/workflows/${workflowId}`);
}

export async function saveWorkflowAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireBuilder();
    const workflowId = text(formData, "workflowId");
    const definition = parseDefinitionJson(text(formData, "definition"));
    const { version } = await saveWorkflow({
      organizationId: access.organizationId,
      userId: access.userId,
      workflowId,
      name: text(formData, "name"),
      description: optionalText(formData, "description"),
      priority: Math.min(999, Math.max(1, integer(formData, "priority", 100))),
      definition,
    });
    revalidatePath("/workflows");
    revalidatePath(`/workflows/${workflowId}`);
    return { ok: true, message: `Guardado. Este flujo va por la versión ${version}; lo que ya está en curso termina con la versión con la que empezó.` };
  } catch (error) {
    return failure(error);
  }
}

export async function setWorkflowStatusAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireBuilder();
    const workflowId = text(formData, "workflowId");
    const status = text(formData, "status") as WorkflowStatus;
    if (!["DRAFT", "ACTIVE", "PAUSED"].includes(status)) throw new Error("Ese estado no existe.");
    const message = await setWorkflowStatus({
      organizationId: access.organizationId,
      userId: access.userId,
      role: access.role,
      workflowId,
      status,
    });
    revalidatePath("/workflows");
    revalidatePath(`/workflows/${workflowId}`);
    return { ok: true, message };
  } catch (error) {
    return failure(error);
  }
}
