// Reject compressed API request bodies until all deployments use a patched body-parser.
// Compressed bodies are not part of our public API or signed webhook contract.
const express = require("express");

function apiJsonBodyParser() {
  return express.json({ limit: "1mb", inflate: false });
}

function stripeWebhookBodyParser() {
  // Stripe signs the exact raw JSON body; do not decompress or transform it.
  return express.raw({ type: "application/json", inflate: false });
}

module.exports = { apiJsonBodyParser, stripeWebhookBodyParser };
