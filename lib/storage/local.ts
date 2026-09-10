import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSafeStorageKey } from "@/lib/storage/keys";
import type { StorageProvider, StoredObjectMetadata } from "@/lib/storage/types";

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly directory: string) {}

  private pathFor(key: string) {
    if (!isSafeStorageKey(key)) throw new Error("INVALID_STORAGE_KEY");
    return path.join(this.directory, key);
  }

  async put(key: string, bytes: Uint8Array, options: StoredObjectMetadata) {
    void options;
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.pathFor(key), bytes, { flag: "wx", mode: 0o640 });
  }

  async get(key: string) { return readFile(this.pathFor(key)).then(bytes => new Uint8Array(bytes)).catch(error => error?.code === "ENOENT" ? null : Promise.reject(error)); }

  async delete(key: string) { await unlink(this.pathFor(key)).catch(error => { if (error?.code !== "ENOENT") throw error; }); }
}
