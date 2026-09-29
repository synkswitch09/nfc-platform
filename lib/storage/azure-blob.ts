import { isSafeStorageKey } from "@/lib/storage/keys";
import type { StorageProvider, StoredObjectMetadata } from "@/lib/storage/types";

type Fetcher = typeof fetch;

export class AzureBlobStorageProvider implements StorageProvider {
  constructor(private readonly containerUrl: string, private readonly sasToken: string, private readonly fetcher: Fetcher = fetch) {}

  private objectUrl(key: string) {
    if (!isSafeStorageKey(key)) throw new Error("INVALID_STORAGE_KEY");
    const separator = this.sasToken.startsWith("?") ? "" : "?";
    return `${this.containerUrl.replace(/\/$/, "")}/${encodeURIComponent(key)}${separator}${this.sasToken}`;
  }

  async put(key: string, bytes: Uint8Array, options: StoredObjectMetadata) {
    const headers: Record<string, string> = { "content-type": options.contentType, "x-ms-blob-type": "BlockBlob", "x-ms-version": "2023-11-03" };
    if (options.cacheControl) headers["x-ms-blob-cache-control"] = options.cacheControl;
    for (const [name, value] of Object.entries(options.metadata ?? {})) headers[`x-ms-meta-${name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`] = value.slice(0, 1024);
    const response = await this.fetcher(this.objectUrl(key), { method: "PUT", headers, body: Buffer.from(bytes) });
    if (!response.ok) throw new Error(`OBJECT_STORAGE_WRITE_FAILED_${response.status}`);
  }

  async get(key: string) {
    const response = await this.fetcher(this.objectUrl(key), { headers: { "x-ms-version": "2023-11-03" }, cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`OBJECT_STORAGE_READ_FAILED_${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(key: string) {
    const response = await this.fetcher(this.objectUrl(key), { method: "DELETE", headers: { "x-ms-version": "2023-11-03" } });
    if (!response.ok && response.status !== 404) throw new Error(`OBJECT_STORAGE_DELETE_FAILED_${response.status}`);
  }
}
