import { generateSecret, generateURI, verifySync } from "otplib";

export function createTotpSecret(): string {
  return generateSecret({ length: 20 });
}

export function createOtpAuthUri(email: string, secret: string): string {
  return generateURI({
    strategy: "totp",
    issuer: "AICTE-VERIFY",
    label: email,
    secret,
    digits: 6,
    period: 30,
  });
}

export function verifyTotp(token: string, secret: string): boolean {
  const result = verifySync({
    strategy: "totp",
    token,
    secret,
    digits: 6,
    period: 30,
    epochTolerance: [30, 30],
  });
  return result.valid;
}
