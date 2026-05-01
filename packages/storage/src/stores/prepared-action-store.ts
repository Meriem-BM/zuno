import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PreparedActionRecord } from "@zuno/core";
import { defaultPreparedActionDir, isNotFound, preparedActionPath } from "./helpers.js";
import type { PreparedActionStore } from "./types.js";

export function createMemoryPreparedActionStore(): PreparedActionStore {
  const records = new Map<string, PreparedActionRecord>();
  let latestId: string | null = null;
  return {
    async save(record) {
      records.set(record.id, record);
      latestId = record.id;
    },
    async get(id) {
      return records.get(id) ?? null;
    },
    async latest() {
      return latestId ? (records.get(latestId) ?? null) : null;
    },
  };
}

export function createFilePreparedActionStore(
  root = defaultPreparedActionDir(),
): PreparedActionStore {
  let latestId: string | null = null;
  return {
    async save(record) {
      const file = preparedActionPath(root, record.id);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
      latestId = record.id;
      await writeFile(join(root, "latest"), record.id, "utf8");
    },
    async get(id) {
      try {
        return JSON.parse(
          await readFile(preparedActionPath(root, id), "utf8"),
        ) as PreparedActionRecord;
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async latest() {
      if (!latestId) {
        try {
          latestId = (await readFile(join(root, "latest"), "utf8")).trim();
        } catch (error) {
          if (isNotFound(error)) return null;
          throw error;
        }
      }
      return latestId ? this.get(latestId) : null;
    },
  };
}

let singleton: PreparedActionStore | null = null;

export function defaultPreparedActionStore(): PreparedActionStore {
  singleton ??= createFilePreparedActionStore();
  return singleton;
}
