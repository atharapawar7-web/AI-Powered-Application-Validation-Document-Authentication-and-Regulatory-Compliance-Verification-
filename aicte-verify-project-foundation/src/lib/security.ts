import crypto from "crypto";

const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => {
      if (err) return reject(err);
      resolve(key as Buffer);
    });
  });
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) return false;

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => {
      if (err) return reject(err);
      resolve(key as Buffer);
    });
  });

  const original = Buffer.from(hashHex, "hex");
  if (original.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(original, derivedKey);
}

export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
