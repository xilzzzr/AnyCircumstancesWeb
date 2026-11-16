const assert = require("node:assert/strict");
const test = require("node:test");
const { sameEmail } = require("./email_identity");

test("an accented look-alike address is not the same account", () => {
  assert.equal(sameEmail("name@example.com", "name@exämple.com"), false);
  assert.equal(sameEmail("name@example.com", "nämé@example.com"), false);
  assert.equal(sameEmail("name@gmail.com", "name@gmaíl.com"), false);
});

test("case, surrounding spaces and Unicode composition still match", () => {
  assert.equal(sameEmail("Name@Example.com", " name@example.COM "), true);
  // "é" typed as one character versus "e" plus a combining accent.
  assert.equal(sameEmail("josé@example.com", "josé@example.com"), true);
});

test("a missing stored address never matches", () => {
  assert.equal(sameEmail("", ""), false);
  assert.equal(sameEmail(null, "name@example.com"), false);
});
