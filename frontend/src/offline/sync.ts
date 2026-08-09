import api from "../api/client";
import { db } from "./db";
import type { OutboxEntry } from "../api/types";
import { generateUUID } from "../lib/uuid";

interface SyncResult {
  client_uuid: string;
  status: "synced" | "failed";
  server_id: number | null;
  error: string | null;
}

export async function syncOutbox(): Promise<void> {
  const pending = await db.outbox.where("status").equals("pending").toArray();
  if (pending.length === 0) return;

  for (const entry of pending) {
    try {
      await syncEntry(entry);
    } catch {
      // Individual failure is handled inside syncEntry
    }
  }
}

async function syncEntry(entry: OutboxEntry): Promise<void> {
  const payload = { ...entry.payload };

  // Upload any offline photos first
  if (entry.photo_blobs && entry.photo_blobs.length > 0) {
    for (const { field, blob, name } of entry.photo_blobs) {
      const form = new FormData();
      form.append("file", blob, name);
      try {
        const res = await api.post<{ photo_url: string }>("/uploads/temp", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        payload[field] = res.data.photo_url;
      } catch {
        // Continue without photo URL — log will still sync
      }
    }
  }

  try {
    const res = await api.post<{ results: SyncResult[] }>("/sync/batch", {
      items: [
        {
          entity_type: entry.entity_type,
          client_uuid: entry.client_uuid,
          payload,
        },
      ],
    });

    const result = res.data.results[0];
    if (result.status === "synced") {
      await db.outbox.update(entry.id!, {
        status: "synced",
        synced_at: new Date().toISOString(),
        error: null,
      });
    } else {
      await db.outbox.update(entry.id!, { status: "failed", error: result.error });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    await db.outbox.update(entry.id!, { status: "failed", error: message });
  }
}

export async function queueEntry(
  entity_type: OutboxEntry["entity_type"],
  payload: Record<string, unknown>,
  photo_blobs: OutboxEntry["photo_blobs"] = []
): Promise<string> {
  const client_uuid = generateUUID();
  await db.outbox.add({
    entity_type,
    client_uuid,
    payload: { ...payload, client_uuid },
    status: "pending",
    created_at: new Date().toISOString(),
    synced_at: null,
    error: null,
    photo_blobs,
  });
  return client_uuid;
}

export async function retryFailed(): Promise<void> {
  await db.outbox.where("status").equals("failed").modify({ status: "pending" });
  await syncOutbox();
}
