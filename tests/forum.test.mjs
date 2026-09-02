import test from "node:test";
import assert from "node:assert/strict";
import {
	hashPassword,
	isCatboxUrl,
	normalizeForumText,
	normalizeForumUsername,
	normalizeTopicTitle,
	parseCookies,
	verifyPassword
} from "../worker/index.js";
import worker from "../worker/index.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function createForumDatabase() {
	const users = new Map();
	const usersByKey = new Map();
	const sessions = new Map();
	const rateLimits = new Map();
	let nextUserId = 1;

	return {
		prepare(query) {
			return {
				bind(...values) {
					return {
						async first() {
							if (query.startsWith("SELECT count, window_started_at FROM forum_rate_limits")) return rateLimits.get(values[0]) || null;
							if (query.startsWith("INSERT INTO forum_users")) {
								const user = { id: nextUserId++, username: values[0], username_key: values[1], password_hash: values[2], is_suspended: 0, created_at: "2026-01-01T00:00:00.000Z" };
								users.set(user.id, user);
								usersByKey.set(user.username_key, user);
								return user;
							}
							if (query.startsWith("SELECT id, username, username_key, password_hash")) return usersByKey.get(values[0]) || null;
							if (query.startsWith("SELECT u.id, u.username, u.username_key, u.is_suspended")) {
								const session = sessions.get(values[0]);
								return session && session.expires_at > values[1] ? users.get(session.user_id) || null : null;
							}
							throw new Error(`Unhandled first query: ${query}`);
						},
						async run() {
							if (query.startsWith("INSERT INTO forum_rate_limits")) {
								rateLimits.set(values[0], { count: 1, window_started_at: values[1] });
								return;
							}
							if (query.startsWith("UPDATE forum_rate_limits")) {
								const current = rateLimits.get(values[0]);
								rateLimits.set(values[0], { ...current, count: current.count + 1 });
								return;
							}
							if (query.startsWith("INSERT INTO forum_sessions")) {
								sessions.set(values[1], { user_id: values[0], expires_at: values[2] });
								return;
							}
							throw new Error(`Unhandled run query: ${query}`);
						}
					};
				}
			};
		}
	};
}

function forumRequest(pathname, method, body, cookie = "") {
	const headers = new Headers({ Origin: "https://paysonism.wtf" });
	if (body) headers.set("Content-Type", "application/json");
	if (cookie) headers.set("Cookie", cookie);
	return new Request(`https://paysonism.wtf/api/forum/${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

test("normalizes forum handles, titles, and Markdown text", () => {
	assert.equal(normalizeForumUsername("  user! name  "), "username");
	assert.equal(normalizeTopicTitle("  relay\r\nsubject "), "relay subject");
	assert.equal(normalizeForumText(" hello\r\nworld\u0000 "), "hello\nworld");
});

test("PBKDF2 hashes verify only with their original password", async () => {
	const encoded = await hashPassword("a correct local forum password", 100000);
	assert.equal(await verifyPassword("a correct local forum password", encoded), true);
	assert.equal(await verifyPassword("wrong password", encoded), false);
});

test("parses session cookies and only recognizes canonical Catbox URLs", () => {
	const request = new Request("https://paysonism.wtf/api/forum/me", { headers: { Cookie: "other=value; forum_session=opaque-token" } });
	assert.equal(parseCookies(request).forum_session, "opaque-token");
	assert.equal(isCatboxUrl("https://files.catbox.moe/example.zip"), true);
	assert.equal(isCatboxUrl("https://catbox.moe/user/api.php"), false);
	assert.equal(isCatboxUrl("https://files.catbox.moe.evil.example/file"), false);
});

test("forum registration, sign-in, and session lookup complete with Turnstile", async () => {
	const originalFetch = globalThis.fetch;
	let verificationRequest;
	globalThis.fetch = async (input, options) => {
		verificationRequest = { input, options };
		return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
	};
	try {
		const env = { DB: createForumDatabase(), FORUM_ALLOW_TEST_TURNSTILE: "true", TURNSTILE_SITE_KEY: "production-site-key" };
		const credentials = { username: "relay-user", password: "a secure forum password", turnstile_token: "test-token" };
		const config = await worker.fetch(forumRequest("config", "GET"), env);
		assert.equal((await config.json()).turnstile_site_key, "1x00000000000000000000AA");

		const registration = await worker.fetch(forumRequest("auth/register", "POST", credentials), env);
		assert.equal(registration.status, 201);
		assert.equal((await registration.json()).user.username, "relay-user");
		assert.equal(verificationRequest.input, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
		assert.equal(verificationRequest.options.method, "POST");
		assert.equal(verificationRequest.options.headers["Content-Type"], "application/x-www-form-urlencoded");
		assert.equal(new URLSearchParams(verificationRequest.options.body).get("secret"), "1x0000000000000000000000000000000AA");
		assert.equal(new URLSearchParams(verificationRequest.options.body).get("response"), "test-token");
		const firstSession = registration.headers.get("Set-Cookie")?.split(";")[0];
		assert.match(firstSession || "", /^forum_session=/);

		const currentUser = await worker.fetch(forumRequest("me", "GET", undefined, firstSession), env);
		assert.equal((await currentUser.json()).user.username, "relay-user");

		const login = await worker.fetch(forumRequest("auth/login", "POST", credentials), env);
		assert.equal(login.status, 200);
		assert.equal((await login.json()).user.username, "relay-user");
		assert.match(login.headers.get("Set-Cookie") || "", /HttpOnly; Secure; SameSite=Lax/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("forum disables account forms and does not accept registrations without a Turnstile secret", async () => {
	const originalFetch = globalThis.fetch;
	let called = false;
	globalThis.fetch = async () => { called = true; throw new Error("Siteverify must not run without a secret"); };
	try {
		const env = { DB: createForumDatabase(), TURNSTILE_SITE_KEY: "production-site-key" };
		const config = await worker.fetch(forumRequest("config", "GET"), env);
		assert.deepEqual(await config.json(), { turnstile_site_key: "", turnstile_enabled: false, uploads_enabled: false });

		const credentials = { username: "relay-user", password: "a secure forum password", turnstile_token: "token" };
		const registration = await worker.fetch(forumRequest("auth/register", "POST", credentials), env);
		assert.equal(registration.status, 503);
		assert.deepEqual(await registration.json(), {
			error: "Account verification is unavailable. The site owner must configure Turnstile before registration can continue.",
			code: "turnstile_unavailable"
		});
		assert.equal(called, false);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("forum client uses native submit controls for every generated form", async () => {
	const source = await readFile(path.join(root, "js", "forum.js"), "utf8");
	assert.match(source, /node\.type = action === "submit" \? "submit" : "button"/);
	assert.match(source, /form\.append\(button\(mode === "register" \? "CREATE ACCOUNT" : "SIGN IN", "submit"\)\);/);
	assert.match(source, /window\.turnstile\.reset\(host\.dataset\.widgetId\)/);
	assert.doesNotMatch(source, /if \(action === "submit"\) return/);
});
