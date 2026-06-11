import { SignJWT, jwtVerify } from "jose";

function getSecret() {
  const secret = process.env.JWT_SECRET;

  if (
    !secret ||
    secret.length < 32 ||
    secret === "gere_um_segredo_forte_com_no_minimo_32_caracteres"
  ) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

export async function createToken(payload: { userId: string; orgId: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // Validade de 7 dias para a sessão
    .sign(getSecret());
}

export async function createOAuthState(payload: { userId: string; orgId: string }) {
  return await new SignJWT({
    ...payload,
    nonce: globalThis.crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { userId: string; orgId: string };
  } catch (error) {
    return null;
  }
}

export async function verifyOAuthState(state: string) {
  try {
    const { payload } = await jwtVerify(state, getSecret());
    return payload as { userId: string; orgId: string; nonce: string };
  } catch (error) {
    return null;
  }
}
