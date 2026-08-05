import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (...parts: string[]) => readFileSync(resolve(process.cwd(), ...parts), "utf8");
const form = read("app", "sign-in", "forgot-password-form.tsx");
const signInPage = read("app", "sign-in", "page.tsx");

test("password recovery uses the current production origin", () => {
  assert.match(form, /resetPasswordForEmail\(email\.trim\(\),\s*\{/);
  assert.match(form, /redirectTo: `\$\{window\.location\.origin\}\/account\/update-password`/);
  assert.doesNotMatch(form, /localhost/);
});

test("successful recovery requests show an account-neutral message", () => {
  assert.match(form, /If an account exists for that email/);
  assert.match(signInPage, /<ForgotPasswordForm \/>/);
});

test("Supabase recovery errors show a sanitized retry message", () => {
  assert.match(form, /if \(recoveryError\)/);
  assert.match(form, /The recovery request could not be completed/);
  assert.doesNotMatch(form, /recoveryError\.message/);
});

test("password recovery never creates a user", () => {
  assert.doesNotMatch(form, /signUp|createUser|admin\./);
});
