import { hasPermission, permissions, workspaceRoles } from "./permissions";
import assert from "node:assert/strict";
import test from "node:test";

test("owner can perform every defined workspace action", () => {
  for (const permission of permissions) {
    assert.equal(hasPermission("OWNER", permission), true, permission);
  }
});

test("manager can publish but cannot manage accounts or members", () => {
  assert.equal(hasPermission("MANAGER", "posts:publish"), true);
  assert.equal(hasPermission("MANAGER", "accounts:manage"), false);
  assert.equal(hasPermission("MANAGER", "members:manage"), false);
});

test("editor and viewer cannot approve, schedule, or publish", () => {
  for (const role of ["EDITOR", "VIEWER"] as const) {
    for (const permission of ["posts:approve", "posts:schedule", "posts:publish"] as const) {
      assert.equal(hasPermission(role, permission), false, `${role} ${permission}`);
    }
  }
});

test("all roles can read their workspace", () => {
  for (const role of workspaceRoles) {
    assert.equal(hasPermission(role, "workspace:read"), true);
  }
});
