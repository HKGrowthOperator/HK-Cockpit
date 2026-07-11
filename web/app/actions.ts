"use server";

import { revalidatePath } from "next/cache";
import { createItem, updateItem, deleteItem } from "@/lib/store";
import { deleteOutput } from "@/lib/agents";

// Mutations used by the module views. They persist to Postgres and revalidate
// the page so the change shows immediately.

export async function saveItem(input: {
  module: string;
  path: string;
  id?: string;
  data: Record<string, unknown>;
}): Promise<{ ok: true }> {
  if (input.id) await updateItem(input.id, input.data);
  else await createItem(input.module, input.data);
  revalidatePath(input.path);
  return { ok: true };
}

export async function removeItem(input: { id: string; path: string }): Promise<{ ok: true }> {
  await deleteItem(input.id);
  revalidatePath(input.path);
  return { ok: true };
}

export async function removeOutput(input: { id: string }): Promise<{ ok: true }> {
  await deleteOutput(input.id);
  revalidatePath("/bibliothek");
  return { ok: true };
}
