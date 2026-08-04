import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { MINIMUM_PASSWORD_LENGTH, validatePasswordUpdate } from "../lib/auth/password-recovery";

const read = (...parts: string[]) => readFileSync(resolve(process.cwd(), ...parts), "utf8");
const page = read("app", "account", "update-password", "page.tsx");
const confirmRoute = read("app", "auth", "confirm", "route.ts");

test("matching valid passwords pass validation", () => {
  assert.equal(validatePasswordUpdate("secure-password", "secure-password"), null);
});

test("empty password fields are rejected", () => {
  assert.equal(validatePasswordUpdate("", ""), "Both password fields are required.");
});

test("mismatched passwords are rejected", () => {
  assert.equal(validatePasswordUpdate("secure-password", "different-password"), "Passwords do not match.");
});

test("short passwords are rejected", () => {
  assert.equal(validatePasswordUpdate("short", "short"), `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
});

test("recovery page uses the authenticated client and handles update errors", () => {
  assert.match(page, /auth\.updateUser\(\{ password: newPassword \}\)/);
  assert.match(page, /The password could not be updated/);
  assert.match(page, /This recovery link is invalid or has expired/);
});

test("successful update confirms and redirects to login", () => {
  assert.match(page, /Your password was updated/);
  assert.match(page, /router\.replace\("\/login"\)/);
});

test("PKCE confirmation exchanges the code and removes it before redirect", () => {
  assert.match(confirmRoute, /exchangeCodeForSession\(code\)/);
  assert.match(confirmRoute, /account\/update-password/);
  assert.match(confirmRoute, /Recovery link is missing or invalid/);
});
