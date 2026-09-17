import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { getRuntimeConfig } from "@/lib/config";

const BASE32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBase32(length: number) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => BASE32[byte % BASE32.length]).join("");
}

export function createPublicTagId() {
  return randomBase32(16);
}

export function createActivationCode() {
  return `${randomBase32(4)}-${randomBase32(4)}-${randomBase32(4)}`;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function hashActivationCode(code: string) {
  return createHmac("sha256", requiredSecret("ACTIVATION_PEPPER")).update(normaliseActivationCode(code)).digest("hex");
}

export async function verifyActivationCode(code: string, hash: string) {
  const candidate = await hashActivationCode(code);
  if (candidate.length !== hash.length) return false;
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

export function normaliseActivationCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function privacyHash(value: string) {
  return createHmac("sha256", requiredSecret("SESSION_SECRET")).update(value).digest("hex");
}

export function requiredSecret(name: "SESSION_SECRET" | "ACTIVATION_PEPPER") {
  const config = getRuntimeConfig();
  const value = name === "SESSION_SECRET" ? config.sessionSecret : config.activationPepper;
  if (!value || value.length < 32) throw new Error(`${name} must contain at least 32 characters`);
  return value;
}

// For short-lived third-party access tokens. The key is derived from the
// deployment secret, rather than stored beside the ciphertext. Rotating
// SESSION_SECRET intentionally invalidates connected marketplace accounts.
export function encryptSecret(value: string) {
  const key = createHash("sha256").update(requiredSecret("SESSION_SECRET")).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string) {
  const [version, iv, authTag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !authTag || !ciphertext) throw new Error("Invalid encrypted secret");
  const key = createHash("sha256").update(requiredSecret("SESSION_SECRET")).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
