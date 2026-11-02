// How the API token is kept (secret.js) and which tokens are accepted (getSession).
import assert from "node:assert/strict";
import { test } from "node:test";
import { forgetKeys, jmap, localStore } from "../fakes/fake-chrome.mjs";
import { getSession } from "../../src/background/jmap.js";
import { getToken, setToken } from "../../src/background/secret.js";

test("a saved token is stored as ciphertext and reads back", async () => {
  await setToken("fmu1-secret-token");
  assert.equal(typeof localStore.token, "object");
  assert.ok(!JSON.stringify(localStore.token).includes("secret"), "the stored value must not contain the token");
  assert.equal(await getToken(), "fmu1-secret-token");
});

test("the same token encrypts differently each time", async () => {
  await setToken("same");
  const a = JSON.stringify(localStore.token);
  await setToken("same");
  assert.notEqual(JSON.stringify(localStore.token), a);
});

test("a plain-text token from an older version is encrypted on first read", async () => {
  localStore.token = "fmu1-old-plain-token";
  assert.equal(await getToken(), "fmu1-old-plain-token");
  assert.equal(typeof localStore.token, "object");
  assert.equal(await getToken(), "fmu1-old-plain-token");
});

test("no token stored: null", async () => {
  delete localStore.token;
  assert.equal(await getToken(), null);
});

test("when the key is gone the token is dropped, so the user reconnects", async () => {
  await setToken("fmu1-secret-token");
  forgetKeys(); // e.g. the profile was copied to another machine
  assert.equal(await getToken(), null);
  assert.equal(localStore.token, undefined);
});

test("a read-only token is accepted", async () => {
  jmap.readOnly = true;
  assert.equal((await getSession("t", { readOnlyRequired: true })).readOnly, true);
});

test("a token that can change mail is refused when read-only is required", async () => {
  jmap.readOnly = false;
  await assert.rejects(getSession("t", { readOnlyRequired: true }), { code: "writable", message: /read-only token/ });
  assert.equal((await getSession("t")).readOnly, false, "without the requirement it still connects, and reports it");
});
