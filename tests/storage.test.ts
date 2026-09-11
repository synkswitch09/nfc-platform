import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AzureBlobStorageProvider } from "@/lib/storage/azure-blob";
import { createStorageKey, storageKeyEnvironment, storageKeyStore } from "@/lib/storage/keys";
import { LocalStorageProvider } from "@/lib/storage/local";

const temporaryDirectories: string[] = [];
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });

describe("storage providers", () => {
  it("writes, reads and deletes through the local provider", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "tapkin-storage-")); temporaryDirectories.push(directory);
    const provider = new LocalStorageProvider(directory); const key = createStorageKey("development", "tapkin", "00000000-0000-4000-8000-000000000001", "png");
    await provider.put(key, Uint8Array.from([1, 2, 3]), { contentType: "image/png" });
    expect(await provider.get(key)).toEqual(Uint8Array.from([1, 2, 3]));
    await provider.delete(key); expect(await provider.get(key)).toBeNull();
  });

  it("uses the Azure provider contract without exposing its credential in headers", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    const provider = new AzureBlobStorageProvider("https://storage.example/container", "?sv=secret", fetcher);
    await provider.put(createStorageKey("staging", "tapkin", "00000000-0000-4000-8000-000000000002", "jpg"), Uint8Array.from([4]), { contentType: "image/jpeg", metadata: { environment: "staging" } });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = fetcher.mock.calls[0];
    expect(String(url)).toContain("staging-tapkin-00000000-0000-4000-8000-000000000002.jpg?sv=secret");
    expect(JSON.stringify(request?.headers)).not.toContain("secret");
  });

  it("prefixes new objects to make environment ownership explicit", () => {
    const id = "00000000-0000-4000-8000-000000000003";
    expect(storageKeyEnvironment(createStorageKey("development", "tapkin", id, "webp"))).toBe("development");
    expect(storageKeyEnvironment(createStorageKey("production", "home-demo", id, "webp"))).toBe("production");
    expect(storageKeyStore(createStorageKey("production", "home-demo", id, "webp"))).toBe("home-demo");
    expect(storageKeyStore(`development-${id}.webp`)).toBe("unscoped");
    expect(storageKeyEnvironment("../../production-secret.png")).toBeNull();
  });
});
