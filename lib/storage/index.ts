import path from "node:path";
import { getRuntimeConfig, type RuntimeConfig } from "@/lib/config";
import { AzureBlobStorageProvider } from "@/lib/storage/azure-blob";
import { LocalStorageProvider } from "@/lib/storage/local";
import type { StorageProvider } from "@/lib/storage/types";

export function getStorageProvider(config: RuntimeConfig = getRuntimeConfig()): StorageProvider {
  if (config.storage.provider === "azure-blob") {
    if (!config.storage.containerUrl || !config.storage.sasToken) throw new Error("Azure Blob storage is not configured");
    return new AzureBlobStorageProvider(config.storage.containerUrl, config.storage.sasToken);
  }
  return new LocalStorageProvider(path.resolve(/* turbopackIgnore: true */ config.storage.uploadDir));
}

export type { StorageProvider, StoredObjectMetadata } from "@/lib/storage/types";
