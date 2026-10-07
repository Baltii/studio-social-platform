import { UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";

import { OidcTokenVerifier } from "./oidc-token-verifier";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

test("OIDC verifier accepts only signed access tokens for the configured API and client", async (context) => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const otherPrivateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const jwk = publicKey.export({ format: "jwk" });
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ keys: [{ ...jwk, kid: "test-key", use: "sig", alg: "RS256" }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const port = (server.address() as AddressInfo).port;
  const verifier = new OidcTokenVerifier({
    issuer: "http://localhost:8080/realms/studio",
    audience: "studio-api",
    allowedClientId: "studio-web",
    jwksUrl: `http://127.0.0.1:${port}/certs`,
  });
  const sign = (
    claims: Record<string, unknown> = {},
    options: { audience?: string; privateKey?: typeof privateKey; expiresIn?: number } = {},
  ) =>
    jwt.sign(
      { email: "owner@example.com", name: "Workspace Owner", azp: "studio-web", ...claims },
      options.privateKey ?? privateKey,
      {
        algorithm: "RS256",
        issuer: "http://localhost:8080/realms/studio",
        audience: options.audience ?? "studio-api",
        subject: "keycloak-user-id",
        expiresIn: options.expiresIn ?? 300,
        keyid: "test-key",
      },
    );

  assert.deepEqual(await verifier.verify(sign()), {
    subject: "keycloak-user-id",
    email: "owner@example.com",
    displayName: "Workspace Owner",
  });
  await assert.rejects(verifier.verify(sign({}, { audience: "another-api" })), UnauthorizedException);
  await assert.rejects(verifier.verify(sign({ azp: "another-client" })), UnauthorizedException);
  await assert.rejects(verifier.verify(sign({}, { privateKey: otherPrivateKey })), UnauthorizedException);
  await assert.rejects(verifier.verify(sign({}, { expiresIn: -30 })), UnauthorizedException);
});
