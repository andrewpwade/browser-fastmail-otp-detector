import assert from "node:assert/strict";
import { test } from "node:test";
import { sameSite, site, siteOfEmail, siteOfUrl } from "../../sites.js";

test("site is the registrable domain", () => {
  assert.equal(site("example.com"), "example.com");
  assert.equal(site("login.example.com"), "example.com");
  assert.equal(site("WWW.Example.COM."), "example.com");
  assert.equal(site("login.bank.co.uk"), "bank.co.uk");
  assert.equal(site("bank.co.uk"), "bank.co.uk");
});

test("public suffixes are not sites", () => {
  assert.equal(site("co.uk"), null);
  assert.equal(site("com"), null);
  assert.equal(site("github.io"), null);
});

test("private suffixes separate their users (github.io, blogspot.com)", () => {
  assert.equal(site("bank.github.io"), "bank.github.io");
  assert.notEqual(site("evil.github.io"), site("bank.github.io"));
});

test("wildcard and exception rules (*.ck, !www.ck)", () => {
  assert.equal(site("a.b.ck"), "a.b.ck");
  assert.equal(site("www.ck"), "www.ck");
});

test("IP addresses and single-label hosts are their own site", () => {
  assert.equal(site("127.0.0.1"), "127.0.0.1");
  assert.equal(site("localhost"), "localhost");
  assert.equal(site("[::1]"), "[::1]");
});

test("international domains, in the punycode form URLs give", () => {
  assert.equal(siteOfUrl("https://shop.münchen.de/"), "xn--mnchen-3ya.de");
});

test("siteOfEmail and siteOfUrl", () => {
  assert.equal(siteOfEmail("no-reply@accounts.google.com"), "google.com");
  assert.equal(siteOfEmail("nobody"), null);
  assert.equal(siteOfUrl("https://login.bank.co.uk:8443/verify?x=1"), "bank.co.uk");
  assert.equal(siteOfUrl("chrome://settings"), null);
  assert.equal(siteOfUrl("not a url"), null);
});

test("sameSite: equal sites, or one owner's group", () => {
  assert.equal(sameSite("bank.co.uk", "bank.co.uk"), true);
  assert.equal(sameSite("google.com", "youtube.com"), true);
  assert.equal(sameSite("microsoft.com", "live.com"), true);
});

test("sameSite: lookalikes and unknowns never match", () => {
  assert.equal(sameSite("paypal.com", "paypa1.com"), false);
  assert.equal(sameSite("bank.co.uk", "bank-secure-login.com"), false);
  assert.equal(sameSite("google.com", "microsoft.com"), false);
  assert.equal(sameSite(null, "bank.co.uk"), false);
  assert.equal(sameSite("bank.co.uk", null), false);
});
