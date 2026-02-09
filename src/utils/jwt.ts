import { jwtVerify } from "jose";
import { createSecretKey } from "node:crypto";

export interface JWTPayload {
  id: string;
  email: string;
  [key: string]: unknown;
}

const accessSecret = process.env.ACCESS_SECRET!;

export async function verifyToken(
  token: string,
  audience: string,
): Promise<JWTPayload> {
  if (!accessSecret) {
    throw new Error(`Secret of type: access is required for verifying token!`);
  }

  const secret = createSecretKey(accessSecret, "utf-8");

  const { payload } = await jwtVerify(token, secret, {
    issuer: "auth-service",
    audience,
  });

  return payload as JWTPayload;
}
