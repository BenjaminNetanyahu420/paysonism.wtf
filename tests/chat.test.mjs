import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMessage, normalizeUsername } from "../worker/index.js";

test("normalizes anonymous handles", () => {
	assert.equal(normalizeUsername("  cyber\n user  "), "cyber user");
});

test("preserves message line breaks and removes controls", () => {
	assert.equal(normalizeMessage(" hello\r\nworld\u0000 "), "hello\nworld");
});
