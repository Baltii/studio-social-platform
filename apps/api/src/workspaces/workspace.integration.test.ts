import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { createDatabase } from "@studio/database";
import jwt from "jsonwebtoken";
import { z } from "zod";

import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

test("workspace routes enforce identity, tenant access, roles, and slug conflicts", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl);

  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  const jwks = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ keys: [{ ...jwk, kid: "integration-key", alg: "RS256", use: "sig" }] }));
  });
  await new Promise<void>((resolve) => jwks.listen(0, "127.0.0.1", resolve));

  const issuer = "http://test-issuer.local/realms/studio";
  process.env.DATABASE_URL = databaseUrl;
  process.env.OIDC_ISSUER_URL = issuer;
  process.env.OIDC_API_AUDIENCE = "studio-api";
  process.env.OIDC_ALLOWED_CLIENT_ID = "studio-web";
  process.env.OIDC_JWKS_URL = `http://127.0.0.1:${(jwks.address() as AddressInfo).port}/certs`;

  const { AppModule } = await import("../app.module");
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("v1");
  await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  const suffix = randomUUID();
  const subjects = [`test-owner-${suffix}`, `test-viewer-${suffix}`];
  const connection = createDatabase(databaseUrl);
  let workspaceId: string | undefined;

  function token(subject: string) {
    return jwt.sign({ email: `${subject}@example.org`, azp: "studio-web" }, privateKey, {
      algorithm: "RS256",
      keyid: "integration-key",
      issuer,
      audience: "studio-api",
      subject,
      expiresIn: 300,
    });
  }

  async function request(method: string, path: string, subject: string, body?: object) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token(subject)}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }

  try {
    assert.equal((await fetch(`${baseUrl}/v1/workspaces`)).status, 401);
    assert.deepEqual((await request("GET", "/v1/workspaces", subjects[0])).body, []);
    const created = await request("POST", "/v1/workspaces", subjects[0], {
      name: "Test Workspace",
      slug: `test-${suffix}`,
      timezone: "Africa/Tunis",
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    workspaceId = z.object({ id: z.uuid(), role: z.literal("OWNER") }).parse(created.body).id;
    assert.equal((await request("GET", `/v1/workspaces/${workspaceId}`, subjects[0])).status, 200);
    assert.equal(
      (await request("POST", "/v1/workspaces", subjects[0], { name: "Duplicate", slug: `test-${suffix}` })).status,
      409,
    );

    assert.deepEqual((await request("GET", "/v1/workspaces", subjects[1])).body, []);
    assert.equal((await request("GET", `/v1/workspaces/${workspaceId}`, subjects[1])).status, 403);
    const viewer = await connection.pool.query<{ id: string }>("SELECT id FROM users WHERE oidc_subject=$1", [
      subjects[1],
    ]);
    await connection.pool.query("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,$3)", [
      workspaceId,
      viewer.rows[0].id,
      "VIEWER",
    ]);
    assert.equal((await request("GET", `/v1/workspaces/${workspaceId}`, subjects[1])).status, 200);
    assert.equal(
      (await request("PATCH", `/v1/workspaces/${workspaceId}`, subjects[1], { name: "Denied" })).status,
      403,
    );
    const updated = await request("PATCH", `/v1/workspaces/${workspaceId}`, subjects[0], {
      name: "Renamed Workspace",
    });
    assert.equal(updated.status, 200);
    assert.equal(z.object({ name: z.string() }).parse(updated.body).name, "Renamed Workspace");
  } finally {
    if (workspaceId) {
      await connection.pool.query("DELETE FROM audit_logs WHERE workspace_id=$1", [workspaceId]);
      await connection.pool.query("DELETE FROM workspace_members WHERE workspace_id=$1", [workspaceId]);
      await connection.pool.query("DELETE FROM workspaces WHERE id=$1", [workspaceId]);
    }
    await connection.pool.query("DELETE FROM users WHERE oidc_subject=ANY($1)", [subjects]);
    await connection.pool.end();
    await app.close();
    await new Promise<void>((resolve) => jwks.close(() => resolve()));
  }
});
