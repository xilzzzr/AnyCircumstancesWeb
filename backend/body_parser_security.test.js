const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { gzipSync } = require("node:zlib");
const express = require("express");
const { apiJsonBodyParser, stripeWebhookBodyParser } = require("./body_parser_security");

async function requestWith(parser, input, headers = {}) {
  const app = express();
  app.post("/test", parser, (req, res) => {
    res.status(200).json({ parsed: Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body });
  });
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.type || err.message });
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await new Promise((resolve, reject) => {
      const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: "/test", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": input.length, ...headers } }, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
      });
      req.on("error", reject);
      req.end(input);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("API JSON accepts ordinary uncompressed bodies", async () => {
  const response = await requestWith(apiJsonBodyParser(), Buffer.from('{"value":42}'));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.parsed, { value: 42 });
});

test("API JSON refuses compressed bodies before decompression", async () => {
  const response = await requestWith(apiJsonBodyParser(), gzipSync(Buffer.from('{"value":42}')), { "Content-Encoding": "gzip" });
  assert.equal(response.status, 415);
  assert.equal(response.body.error, "encoding.unsupported");
});

test("signed Stripe raw JSON accepts uncompressed bytes, rejects compressed bytes", async () => {
  const input = Buffer.from('{"id":"evt_test"}');
  const plain = await requestWith(stripeWebhookBodyParser(), input);
  assert.equal(plain.status, 200);
  assert.equal(plain.body.parsed, input.toString("utf8"));
  const zipped = await requestWith(stripeWebhookBodyParser(), gzipSync(input), { "Content-Encoding": "gzip" });
  assert.equal(zipped.status, 415);
  assert.equal(zipped.body.error, "encoding.unsupported");
});
