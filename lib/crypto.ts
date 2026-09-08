import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BASE32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBase32(length: number) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => BASE32[byte % BASE32.length]).join("");
}

export function createPublicTagId() {
  return randomBase32(10);
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
  const value = process.env[name];
  if (!value || value.length < 32) throw new Error(`${name} must contain at least 32 characters`);
  return value;
}
