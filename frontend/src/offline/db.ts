import Dexie, { type Table } from "dexie";
import type { OutboxEntry } from "../api/types";
import type { Asset } from "../api/types";

export class SocietyOpsDB extends Dexie {
  outbox!: Table<OutboxEntry, number>;
  cachedAssets!: Table<Asset, number>;

  constructor() {
    super("SocietyOpsDB");
    this.version(1).stores({
      outbox: "++id, entity_type, client_uuid, status, created_at",
      cachedAssets: "id, type, society_id",
    });
  }
}

export const db = new SocietyOpsDB();
