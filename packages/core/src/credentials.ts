import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "./errors";
function credentialKey() {
  const value = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) throw new AppError(503, "CREDENTIAL_KEY_REQUIRED", "Configure the instance credential encryption key.");
  return Buffer.from(value, "hex");
}
export function encryptCredential(value: string | null) {
  if (!value) return null;
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", credentialKey(), iv);
  cipher.setAAD(Buffer.from("cognelo-ai-key-v1"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["ai-v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":");
}
export function decryptCredential(value: string | null) {
  if (!value) return null;
  // Read compatibility only; the credential migration removes legacy plaintext.
  if (!value.startsWith("ai-v1:")) return value;
  try {
    const [, iv, tag, encrypted] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", credentialKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from("cognelo-ai-key-v1"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch { throw new AppError(503, "CREDENTIAL_UNAVAILABLE", "The stored service credential could not be read."); }
}
