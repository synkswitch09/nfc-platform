export type StoredObjectMetadata = {
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
};

export interface StorageProvider {
  put(key: string, bytes: Uint8Array, options: StoredObjectMetadata): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}
