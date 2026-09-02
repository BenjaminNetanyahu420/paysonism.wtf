var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// dist/server/index.js
var encoder = new TextEncoder();
var SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
var TEST_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
var TEST_TURNSTILE_SECRET = "1x0000000000000000000000000000000AA";
function normalizeUsername(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}
__name(normalizeUsername, "normalizeUsername");
function normalizeMessage(value) {
  return String(value || "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}
__name(normalizeMessage, "normalizeMessage");
function normalizeForumUsername(value) {
  return normalizeUsername(value).replace(/[^A-Za-z0-9_.-]/g, "");
}
__name(normalizeForumUsername, "normalizeForumUsername");
function normalizeForumText(value) {
  return normalizeMessage(value);
}
__name(normalizeForumText, "normalizeForumText");
function normalizeTopicTitle(value) {
  return normalizeMessage(value).replace(/\n+/g, " ");
}
__name(normalizeTopicTitle, "normalizeTopicTitle");
function json(data, status, headers) {
  const responseHeaders = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  Object.entries(headers || {}).forEach(([key, value]) => responseHeaders.set(key, value));
  return new Response(JSON.stringify(data), { status: status || 200, headers: responseHeaders });
}
__name(json, "json");
async function hashText(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(hashText, "hashText");
async function fingerprint(request) {
  return hashText(request.headers.get("CF-Connecting-IP") || "unknown");
}
__name(fingerprint, "fingerprint");
function base64Url(bytes) {
  let binary = "";
  new Uint8Array(bytes).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(base64Url, "base64Url");
function base64UrlBytes(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
__name(base64UrlBytes, "base64UrlBytes");
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}
__name(randomToken, "randomToken");
async function hashPassword(password, iterations = 6e5) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return `${iterations}$${base64Url(salt)}$${base64Url(bits)}`;
}
__name(hashPassword, "hashPassword");
function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
async function verifyPassword(password, encodedHash) {
  const [iterationValue, saltValue, expectedValue] = String(encodedHash || "").split("$");
  const iterations = Number(iterationValue);
  if (!Number.isInteger(iterations) || iterations < 1e5 || !saltValue || !expectedValue) return false;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: base64UrlBytes(saltValue), iterations }, key, 256);
    return timingSafeEqual(new Uint8Array(bits), base64UrlBytes(expectedValue));
  } catch {
    return false;
  }
}
__name(verifyPassword, "verifyPassword");
function parseCookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}
__name(parseCookies, "parseCookies");
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}
__name(sameOrigin, "sameOrigin");
function cookieForSession(token) {
  return `forum_session=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
__name(cookieForSession, "cookieForSession");
function clearedSessionCookie() {
  return "forum_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax";
}
__name(clearedSessionCookie, "clearedSessionCookie");
function ownerHandles(env) {
  return new Set(String(env.FORUM_OWNER_HANDLES || "").split(",").map((handle) => normalizeForumUsername(handle).toLowerCase()).filter(Boolean));
}
__name(ownerHandles, "ownerHandles");
function publicUser(row, env) {
  if (!row) return null;
  return { id: row.id, username: row.username, is_owner: ownerHandles(env).has(row.username_key), is_suspended: Boolean(row.is_suspended), created_at: row.created_at };
}
__name(publicUser, "publicUser");
async function readJson(request, maximumBytes = 1e5) {
  const contentLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
  if (contentLength > maximumBytes) throw new Error("Request payload is too large");
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) throw new Error("JSON body required");
  return request.json();
}
__name(readJson, "readJson");
async function requireSession(request, env) {
  const token = parseCookies(request).forum_session;
  if (!token || token.length > 128) return null;
  const row = await env.DB.prepare("SELECT u.id, u.username, u.username_key, u.is_suspended, u.created_at FROM forum_sessions s JOIN forum_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1").bind(await hashText(token), (/* @__PURE__ */ new Date()).toISOString()).first();
  return row && !row.is_suspended ? publicUser(row, env) : null;
}
__name(requireSession, "requireSession");
async function createSession(userId, env) {
  const token = randomToken();
  await env.DB.prepare("INSERT INTO forum_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)").bind(userId, await hashText(token), new Date(Date.now() + SESSION_TTL_SECONDS * 1e3).toISOString()).run();
  return token;
}
__name(createSession, "createSession");
async function enforceRateLimit(env, key, limit, windowSeconds) {
  const now = Date.now();
  const current = await env.DB.prepare("SELECT count, window_started_at FROM forum_rate_limits WHERE key = ?").bind(key).first();
  if (!current || now - Date.parse(current.window_started_at) >= windowSeconds * 1e3) {
    await env.DB.prepare("INSERT INTO forum_rate_limits (key, count, window_started_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_started_at = excluded.window_started_at").bind(key, new Date(now).toISOString()).run();
    return true;
  }
  if (current.count >= limit) return false;
  await env.DB.prepare("UPDATE forum_rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}
__name(enforceRateLimit, "enforceRateLimit");
async function rateKey(request, scope, user) {
  return `${scope}:${user ? `u${user.id}` : `ip${await fingerprint(request)}`}`;
}
__name(rateKey, "rateKey");
async function verifyTurnstile(token, request, env) {
  if (!token || typeof token !== "string" || token.length > 2048) return false;
  const secret = env.FORUM_ALLOW_TEST_TURNSTILE === "true" ? TEST_TURNSTILE_SECRET : env.TURNSTILE_SECRET || "";
  if (!secret) return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  body.append("remoteip", request.headers.get("CF-Connecting-IP") || "");
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    return Boolean((await response.json()).success);
  } catch {
    return false;
  }
}
__name(verifyTurnstile, "verifyTurnstile");
async function listMessages(request, env) {
  const url = new URL(request.url);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "25", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 25;
  const before = Number.parseInt(url.searchParams.get("before") || "", 10);
  const statement = Number.isInteger(before) && before > 0 ? env.DB.prepare("SELECT id, username, message, created_at FROM chat_messages WHERE id < ? ORDER BY id DESC LIMIT ?").bind(before, limit) : env.DB.prepare("SELECT id, username, message, created_at FROM chat_messages ORDER BY id DESC LIMIT ?").bind(limit);
  const result = await statement.all();
  return json({ messages: result.results || [] });
}
__name(listMessages, "listMessages");
async function createMessage(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin posts are not accepted" }, 403);
  let body;
  try {
    body = await readJson(request, 2048);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const username = normalizeUsername(body.username);
  const message = normalizeMessage(body.message);
  if (!username || Array.from(username).length > 24) return json({ error: "Handle must contain 1 to 24 characters" }, 400);
  if (!message || Array.from(message).length > 300) return json({ error: "Message must contain 1 to 300 characters" }, 400);
  const senderHash = await fingerprint(request);
  const previous = await env.DB.prepare("SELECT created_at FROM chat_messages WHERE sender_hash = ? ORDER BY id DESC LIMIT 1").bind(senderHash).first();
  if (previous && Date.now() - Date.parse(previous.created_at) < 2500) return json({ error: "Wait a moment before posting again" }, 429);
  const created = await env.DB.prepare("INSERT INTO chat_messages (username, message, sender_hash) VALUES (?, ?, ?) RETURNING id, username, message, created_at").bind(username, message, senderHash).first();
  return json({ message: created }, 201);
}
__name(createMessage, "createMessage");
async function handleChat(request, env) {
  if (!env.DB) return json({ error: "Chat database unavailable" }, 503);
  if (request.method === "GET") return listMessages(request, env);
  if (request.method === "POST") return createMessage(request, env);
  return json({ error: "Method not allowed" }, 405);
}
__name(handleChat, "handleChat");
function isOwner(user) {
  return Boolean(user && user.is_owner);
}
__name(isOwner, "isOwner");
async function requireForumUser(request, env, ownerOnly = false) {
  const user = await requireSession(request, env);
  if (!user) return { error: json({ error: "Sign in required" }, 401) };
  if (ownerOnly && !isOwner(user)) return { error: json({ error: "Owner access required" }, 403) };
  return { user };
}
__name(requireForumUser, "requireForumUser");
function visibleClause(user, column = "t.is_hidden") {
  return isOwner(user) ? "1 = 1" : `${column} = 0`;
}
__name(visibleClause, "visibleClause");
async function forumConfig(env) {
  const turnstileSiteKey = env.FORUM_ALLOW_TEST_TURNSTILE === "true" ? TEST_TURNSTILE_SITE_KEY : env.TURNSTILE_SITE_KEY || "";
  return json({ turnstile_site_key: turnstileSiteKey, uploads_enabled: Boolean(env.CATBOX_USERHASH) });
}
__name(forumConfig, "forumConfig");
async function forumMe(request, env) {
  return json({ user: await requireSession(request, env) });
}
__name(forumMe, "forumMe");
async function registerForumUser(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  if (!await enforceRateLimit(env, await rateKey(request, "register"), 5, 3600)) return json({ error: "Registration rate limit reached" }, 429);
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const username = normalizeForumUsername(body.username);
  const usernameKey = username.toLowerCase();
  const password = String(body.password || "");
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(username)) return json({ error: "Handle must use 3 to 24 letters, numbers, dots, hyphens, or underscores" }, 400);
  if (password.length < 12 || password.length > 256) return json({ error: "Password must contain 12 to 256 characters" }, 400);
  if (!await verifyTurnstile(body.turnstile_token, request, env)) return json({ error: "Turnstile verification failed" }, 400);
  try {
    const created = await env.DB.prepare("INSERT INTO forum_users (username, username_key, password_hash) VALUES (?, ?, ?) RETURNING id, username, username_key, is_suspended, created_at").bind(username, usernameKey, await hashPassword(password)).first();
    return json({ user: publicUser(created, env) }, 201, { "Set-Cookie": cookieForSession(await createSession(created.id, env)) });
  } catch (error) {
    if (String(error.message || error).includes("UNIQUE")) return json({ error: "That handle is already registered" }, 409);
    throw error;
  }
}
__name(registerForumUser, "registerForumUser");
async function loginForumUser(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  if (!await enforceRateLimit(env, await rateKey(request, "login"), 12, 900)) return json({ error: "Sign-in rate limit reached" }, 429);
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const usernameKey = normalizeForumUsername(body.username).toLowerCase();
  const row = await env.DB.prepare("SELECT id, username, username_key, password_hash, is_suspended, created_at FROM forum_users WHERE username_key = ? LIMIT 1").bind(usernameKey).first();
  if (!row || !await verifyPassword(String(body.password || ""), row.password_hash)) return json({ error: "Invalid handle or password" }, 401);
  if (row.is_suspended) return json({ error: "This account is suspended" }, 403);
  if (!await verifyTurnstile(body.turnstile_token, request, env)) return json({ error: "Turnstile verification failed" }, 400);
  return json({ user: publicUser(row, env) }, 200, { "Set-Cookie": cookieForSession(await createSession(row.id, env)) });
}
__name(loginForumUser, "loginForumUser");
async function logoutForumUser(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const token = parseCookies(request).forum_session;
  if (token) await env.DB.prepare("DELETE FROM forum_sessions WHERE token_hash = ?").bind(await hashText(token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearedSessionCookie() });
}
__name(logoutForumUser, "logoutForumUser");
async function listCategories(request, env) {
  const user = await requireSession(request, env);
  const where = isOwner(user) ? "1 = 1" : "c.is_archived = 0";
  const result = await env.DB.prepare(`SELECT c.id, c.slug, c.title, c.description, c.position, c.is_archived, COUNT(t.id) AS topic_count FROM forum_categories c LEFT JOIN forum_topics t ON t.category_id = c.id AND t.is_hidden = 0 WHERE ${where} GROUP BY c.id ORDER BY c.position, c.id`).all();
  return json({ categories: result.results || [] });
}
__name(listCategories, "listCategories");
async function listTopics(request, env) {
  const url = new URL(request.url);
  const user = await requireSession(request, env);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "25", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 25;
  const category = url.searchParams.get("category") || "";
  const before = url.searchParams.get("before") || "";
  const parameters = [];
  let where = `${visibleClause(user)} AND c.is_archived = 0`;
  if (category) {
    where += " AND c.slug = ?";
    parameters.push(category);
  }
  if (before) {
    where += " AND t.last_activity_at < ?";
    parameters.push(before);
  }
  parameters.push(limit);
  const replyFilter = isOwner(user) ? "1 = 1" : "r.is_hidden = 0";
  const result = await env.DB.prepare(`SELECT t.id, t.title, t.is_locked, t.is_sticky, t.is_hidden, t.created_at, t.last_activity_at, c.slug AS category_slug, c.title AS category_title, u.username AS author_username, (SELECT COUNT(*) FROM forum_replies r WHERE r.topic_id = t.id AND ${replyFilter}) AS reply_count FROM forum_topics t JOIN forum_categories c ON c.id = t.category_id JOIN forum_users u ON u.id = t.author_id WHERE ${where} ORDER BY t.is_sticky DESC, t.last_activity_at DESC, t.id DESC LIMIT ?`).bind(...parameters).all();
  return json({ topics: result.results || [] });
}
__name(listTopics, "listTopics");
async function topicDetail(request, env, topicId) {
  const url = new URL(request.url);
  const user = await requireSession(request, env);
  const topic = await env.DB.prepare(`SELECT t.id, t.title, t.body, t.author_id, t.is_locked, t.is_sticky, t.is_hidden, t.created_at, t.updated_at, t.last_activity_at, c.slug AS category_slug, c.title AS category_title, u.username AS author_username FROM forum_topics t JOIN forum_categories c ON c.id = t.category_id JOIN forum_users u ON u.id = t.author_id WHERE t.id = ? AND ${visibleClause(user)} LIMIT 1`).bind(topicId).first();
  if (!topic) return json({ error: "Topic not found" }, 404);
  const before = Number.parseInt(url.searchParams.get("before") || "", 10);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const hidden = isOwner(user) ? "1 = 1" : "r.is_hidden = 0";
  const statement = Number.isInteger(before) && before > 0 ? env.DB.prepare(`SELECT r.id, r.topic_id, r.author_id, r.body, r.is_hidden, r.created_at, r.updated_at, u.username AS author_username FROM forum_replies r JOIN forum_users u ON u.id = r.author_id WHERE r.topic_id = ? AND ${hidden} AND r.id < ? ORDER BY r.id DESC LIMIT ?`).bind(topicId, before, limit) : env.DB.prepare(`SELECT r.id, r.topic_id, r.author_id, r.body, r.is_hidden, r.created_at, r.updated_at, u.username AS author_username FROM forum_replies r JOIN forum_users u ON u.id = r.author_id WHERE r.topic_id = ? AND ${hidden} ORDER BY r.id DESC LIMIT ?`).bind(topicId, limit);
  const replies = await statement.all();
  return json({ topic, replies: (replies.results || []).reverse(), user });
}
__name(topicDetail, "topicDetail");
async function createTopic(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env);
  if (access.error) return access.error;
  if (!await enforceRateLimit(env, await rateKey(request, "topic", access.user), 5, 600)) return json({ error: "Wait before creating another topic" }, 429);
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const title = normalizeTopicTitle(body.title);
  const message = normalizeForumText(body.body);
  if (!title || Array.from(title).length > 120) return json({ error: "Title must contain 1 to 120 characters" }, 400);
  if (!message || Array.from(message).length > 2e4) return json({ error: "Topic body must contain 1 to 20,000 characters" }, 400);
  const category = await env.DB.prepare("SELECT id, is_archived FROM forum_categories WHERE slug = ? LIMIT 1").bind(String(body.category_slug || "")).first();
  if (!category || category.is_archived) return json({ error: "Choose an active forum section" }, 400);
  const topic = await env.DB.prepare("INSERT INTO forum_topics (category_id, author_id, title, body) VALUES (?, ?, ?, ?) RETURNING id, title, body, created_at").bind(category.id, access.user.id, title, message).first();
  return json({ topic }, 201);
}
__name(createTopic, "createTopic");
async function createReply(request, env, topicId) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env);
  if (access.error) return access.error;
  if (!await enforceRateLimit(env, await rateKey(request, "reply", access.user), 12, 600)) return json({ error: "Wait before posting another reply" }, 429);
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const message = normalizeForumText(body.body);
  if (!message || Array.from(message).length > 1e4) return json({ error: "Reply must contain 1 to 10,000 characters" }, 400);
  const topic = await env.DB.prepare("SELECT id, is_locked, is_hidden FROM forum_topics WHERE id = ? LIMIT 1").bind(topicId).first();
  if (!topic || topic.is_hidden) return json({ error: "Topic not found" }, 404);
  if (topic.is_locked && !isOwner(access.user)) return json({ error: "This topic is locked" }, 403);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const results = await env.DB.batch([
    env.DB.prepare("INSERT INTO forum_replies (topic_id, author_id, body) VALUES (?, ?, ?) RETURNING id, topic_id, author_id, body, created_at").bind(topicId, access.user.id, message),
    env.DB.prepare("UPDATE forum_topics SET last_activity_at = ? WHERE id = ?").bind(now, topicId)
  ]);
  return json({ reply: results[0].results[0] }, 201);
}
__name(createReply, "createReply");
async function editTopic(request, env, topicId) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env);
  if (access.error) return access.error;
  const topic = await env.DB.prepare("SELECT id, author_id, is_locked FROM forum_topics WHERE id = ? LIMIT 1").bind(topicId).first();
  if (!topic) return json({ error: "Topic not found" }, 404);
  if (topic.author_id !== access.user.id && !isOwner(access.user)) return json({ error: "You cannot edit this topic" }, 403);
  if (topic.is_locked && !isOwner(access.user)) return json({ error: "This topic is locked" }, 403);
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const title = normalizeTopicTitle(body.title);
  const message = normalizeForumText(body.body);
  if (!title || Array.from(title).length > 120 || !message || Array.from(message).length > 2e4) return json({ error: "Invalid topic content" }, 400);
  await env.DB.prepare("UPDATE forum_topics SET title = ?, body = ?, updated_at = ? WHERE id = ?").bind(title, message, (/* @__PURE__ */ new Date()).toISOString(), topicId).run();
  return json({ ok: true });
}
__name(editTopic, "editTopic");
async function editReply(request, env, replyId) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env);
  if (access.error) return access.error;
  const reply = await env.DB.prepare("SELECT r.id, r.author_id, t.is_locked FROM forum_replies r JOIN forum_topics t ON t.id = r.topic_id WHERE r.id = ? LIMIT 1").bind(replyId).first();
  if (!reply) return json({ error: "Reply not found" }, 404);
  if (reply.author_id !== access.user.id && !isOwner(access.user)) return json({ error: "You cannot edit this reply" }, 403);
  if (reply.is_locked && !isOwner(access.user)) return json({ error: "This topic is locked" }, 403);
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const message = normalizeForumText(body.body);
  if (!message || Array.from(message).length > 1e4) return json({ error: "Invalid reply content" }, 400);
  await env.DB.prepare("UPDATE forum_replies SET body = ?, updated_at = ? WHERE id = ?").bind(message, (/* @__PURE__ */ new Date()).toISOString(), replyId).run();
  return json({ ok: true });
}
__name(editReply, "editReply");
function isCatboxUrl(value) {
  try {
    return new URL(value).hostname === "files.catbox.moe";
  } catch {
    return false;
  }
}
__name(isCatboxUrl, "isCatboxUrl");
async function uploadAttachment(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env);
  if (access.error) return access.error;
  if (!env.CATBOX_USERHASH) return json({ error: "Uploads are not configured" }, 503);
  if (!await enforceRateLimit(env, await rateKey(request, "upload", access.user), 8, 3600)) return json({ error: "Upload rate limit reached" }, 429);
  const contentLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
  if (contentLength > 95 * 1024 * 1024) return json({ error: "Files must be smaller than 95 MiB" }, 413);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("multipart/form-data")) return json({ error: "Multipart file upload required" }, 415);
  let inbound;
  try {
    inbound = await request.formData();
  } catch {
    return json({ error: "Invalid multipart upload" }, 400);
  }
  const file = inbound.get("file");
  if (!(file instanceof File) || !file.name) return json({ error: "Choose a file to upload" }, 400);
  if (file.size > 95 * 1024 * 1024) return json({ error: "Files must be smaller than 95 MiB" }, 413);
  const outbound = new FormData();
  outbound.append("reqtype", "fileupload");
  outbound.append("userhash", env.CATBOX_USERHASH);
  outbound.append("fileToUpload", file, file.name);
  let response;
  try {
    response = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: outbound });
  } catch {
    return json({ error: "File host unavailable" }, 502);
  }
  const url = (await response.text()).trim();
  if (!response.ok || !isCatboxUrl(url)) return json({ error: "File host rejected the upload" }, 502);
  const attachment = await env.DB.prepare("INSERT INTO forum_attachments (uploader_id, url, filename, byte_size) VALUES (?, ?, ?, ?) RETURNING id, url, filename, byte_size, created_at").bind(access.user.id, url, normalizeMessage(file.name).slice(0, 255), file.size).first();
  return json({ attachment }, 201);
}
__name(uploadAttachment, "uploadAttachment");
async function createReport(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env);
  if (access.error) return access.error;
  if (!await enforceRateLimit(env, await rateKey(request, "report", access.user), 8, 3600)) return json({ error: "Report rate limit reached" }, 429);
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const targetType = body.target_type === "reply" ? "reply" : body.target_type === "topic" ? "topic" : "";
  const targetId = Number.parseInt(body.target_id, 10);
  const reason = normalizeForumText(body.reason);
  if (!targetType || !Number.isInteger(targetId) || !reason || Array.from(reason).length > 1e3) return json({ error: "Invalid report" }, 400);
  const report = await env.DB.prepare("INSERT INTO forum_reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?) RETURNING id, status, created_at").bind(access.user.id, targetType, targetId, reason).first();
  return json({ report }, 201);
}
__name(createReport, "createReport");
async function ownerCategories(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env, true);
  if (access.error) return access.error;
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const title = normalizeTopicTitle(body.title);
  const description = normalizeForumText(body.description);
  const slug = String(body.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!title || Array.from(title).length > 80 || !slug || slug.length > 48 || Array.from(description).length > 240) return json({ error: "Invalid section details" }, 400);
  const next = await env.DB.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS position FROM forum_categories").first();
  try {
    const category = await env.DB.prepare("INSERT INTO forum_categories (slug, title, description, position) VALUES (?, ?, ?, ?) RETURNING id, slug, title, description, position, is_archived").bind(slug, title, description, next.position).first();
    return json({ category }, 201);
  } catch (error) {
    if (String(error.message || error).includes("UNIQUE")) return json({ error: "That section slug already exists" }, 409);
    throw error;
  }
}
__name(ownerCategories, "ownerCategories");
async function updateCategory(request, env, categoryId) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env, true);
  if (access.error) return access.error;
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const title = normalizeTopicTitle(body.title);
  const description = normalizeForumText(body.description);
  if (!title || Array.from(title).length > 80 || Array.from(description).length > 240) return json({ error: "Invalid section details" }, 400);
  await env.DB.prepare("UPDATE forum_categories SET title = ?, description = ?, is_archived = ? WHERE id = ?").bind(title, description, body.is_archived ? 1 : 0, categoryId).run();
  return json({ ok: true });
}
__name(updateCategory, "updateCategory");
async function ownerReports(request, env) {
  const access = await requireForumUser(request, env, true);
  if (access.error) return access.error;
  const reports = await env.DB.prepare("SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at, u.username AS reporter_username FROM forum_reports r JOIN forum_users u ON u.id = r.reporter_id WHERE r.status = 'open' ORDER BY r.id DESC LIMIT 100").all();
  return json({ reports: reports.results || [] });
}
__name(ownerReports, "ownerReports");
async function moderate(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env, true);
  if (access.error) return access.error;
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const targetType = ["topic", "reply", "user", "report"].includes(body.target_type) ? body.target_type : "";
  const targetId = Number.parseInt(body.target_id, 10);
  const action = String(body.action || "");
  if (!targetType || !Number.isInteger(targetId)) return json({ error: "Invalid moderation target" }, 400);
  const allowed = { topic: ["hide", "restore", "lock", "unlock", "sticky", "unsticky"], reply: ["hide", "restore"], user: ["suspend", "restore"], report: ["resolve"] };
  if (!allowed[targetType].includes(action)) return json({ error: "Invalid moderation action" }, 400);
  const operations = {
    topic: { hide: "UPDATE forum_topics SET is_hidden = 1 WHERE id = ?", restore: "UPDATE forum_topics SET is_hidden = 0 WHERE id = ?", lock: "UPDATE forum_topics SET is_locked = 1 WHERE id = ?", unlock: "UPDATE forum_topics SET is_locked = 0 WHERE id = ?", sticky: "UPDATE forum_topics SET is_sticky = 1 WHERE id = ?", unsticky: "UPDATE forum_topics SET is_sticky = 0 WHERE id = ?" },
    reply: { hide: "UPDATE forum_replies SET is_hidden = 1 WHERE id = ?", restore: "UPDATE forum_replies SET is_hidden = 0 WHERE id = ?" },
    user: { suspend: "UPDATE forum_users SET is_suspended = 1 WHERE id = ?", restore: "UPDATE forum_users SET is_suspended = 0 WHERE id = ?" },
    report: { resolve: "UPDATE forum_reports SET status = 'resolved' WHERE id = ?" }
  };
  await env.DB.batch([
    env.DB.prepare(operations[targetType][action]).bind(targetId),
    env.DB.prepare("INSERT INTO forum_moderation_events (owner_id, target_type, target_id, action, details) VALUES (?, ?, ?, ?, ?)").bind(access.user.id, targetType, targetId, action, normalizeForumText(body.details).slice(0, 1e3))
  ]);
  return json({ ok: true });
}
__name(moderate, "moderate");
async function resetPassword(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env, true);
  if (access.error) return access.error;
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const usernameKey = normalizeForumUsername(body.username).toLowerCase();
  const password = String(body.password || "");
  if (!usernameKey || password.length < 12 || password.length > 256) return json({ error: "Invalid handle or password" }, 400);
  const target = await env.DB.prepare("SELECT id FROM forum_users WHERE username_key = ? LIMIT 1").bind(usernameKey).first();
  if (!target) return json({ error: "Account not found" }, 404);
  await env.DB.batch([
    env.DB.prepare("UPDATE forum_users SET password_hash = ? WHERE id = ?").bind(await hashPassword(password), target.id),
    env.DB.prepare("DELETE FROM forum_sessions WHERE user_id = ?").bind(target.id),
    env.DB.prepare("INSERT INTO forum_moderation_events (owner_id, target_type, target_id, action, details) VALUES (?, 'user', ?, 'password_reset', '')").bind(access.user.id, target.id)
  ]);
  return json({ ok: true });
}
__name(resetPassword, "resetPassword");
async function ownerUserAction(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted" }, 403);
  const access = await requireForumUser(request, env, true);
  if (access.error) return access.error;
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const usernameKey = normalizeForumUsername(body.username).toLowerCase();
  const action = body.action === "suspend" ? "suspend" : body.action === "restore" ? "restore" : "";
  if (!usernameKey || !action) return json({ error: "Invalid account action" }, 400);
  const target = await env.DB.prepare("SELECT id FROM forum_users WHERE username_key = ? LIMIT 1").bind(usernameKey).first();
  if (!target) return json({ error: "Account not found" }, 404);
  if (target.id === access.user.id && action === "suspend") return json({ error: "Owners cannot suspend their own active account" }, 400);
  await env.DB.batch([
    env.DB.prepare("UPDATE forum_users SET is_suspended = ? WHERE id = ?").bind(action === "suspend" ? 1 : 0, target.id),
    env.DB.prepare("DELETE FROM forum_sessions WHERE user_id = ?").bind(target.id),
    env.DB.prepare("INSERT INTO forum_moderation_events (owner_id, target_type, target_id, action, details) VALUES (?, 'user', ?, ?, '')").bind(access.user.id, target.id, action)
  ]);
  return json({ ok: true });
}
__name(ownerUserAction, "ownerUserAction");
async function handleForum(request, env) {
  if (!env.DB) return json({ error: "Forum database unavailable" }, 503);
  const path = new URL(request.url).pathname.replace(/^\/api\/forum\/?/, "").replace(/\/$/, "");
  if (request.method === "GET" && path === "config") return forumConfig(env);
  if (request.method === "GET" && path === "me") return forumMe(request, env);
  if (request.method === "POST" && path === "auth/register") return registerForumUser(request, env);
  if (request.method === "POST" && path === "auth/login") return loginForumUser(request, env);
  if (request.method === "POST" && path === "auth/logout") return logoutForumUser(request, env);
  if (request.method === "GET" && path === "categories") return listCategories(request, env);
  if (request.method === "GET" && path === "topics") return listTopics(request, env);
  if (request.method === "POST" && path === "topics") return createTopic(request, env);
  if (request.method === "POST" && path === "uploads") return uploadAttachment(request, env);
  if (request.method === "POST" && path === "reports") return createReport(request, env);
  if (request.method === "GET" && path === "owner/reports") return ownerReports(request, env);
  if (request.method === "POST" && path === "owner/categories") return ownerCategories(request, env);
  if (request.method === "POST" && path === "owner/moderate") return moderate(request, env);
  if (request.method === "POST" && path === "owner/reset-password") return resetPassword(request, env);
  if (request.method === "POST" && path === "owner/users/action") return ownerUserAction(request, env);
  const topicMatch = path.match(/^topics\/(\d+)$/);
  if (topicMatch) {
    if (request.method === "GET") return topicDetail(request, env, Number(topicMatch[1]));
    if (request.method === "PATCH") return editTopic(request, env, Number(topicMatch[1]));
  }
  const replyMatch = path.match(/^topics\/(\d+)\/replies$/);
  if (replyMatch && request.method === "POST") return createReply(request, env, Number(replyMatch[1]));
  const categoryMatch = path.match(/^owner\/categories\/(\d+)$/);
  if (categoryMatch && request.method === "PATCH") return updateCategory(request, env, Number(categoryMatch[1]));
  const editReplyMatch = path.match(/^replies\/(\d+)$/);
  if (editReplyMatch && request.method === "PATCH") return editReply(request, env, Number(editReplyMatch[1]));
  return json({ error: "Forum route not found" }, 404);
}
__name(handleForum, "handleForum");
async function serveAsset(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/") url.pathname = "/index.html";
  return env.ASSETS.fetch(new Request(url, request));
}
__name(serveAsset, "serveAsset");
var server_default = {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/api/chat") return handleChat(request, env);
    if (path === "/api/forum" || path.startsWith("/api/forum/")) return handleForum(request, env);
    return serveAsset(request, env);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-3SVios/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = server_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-3SVios/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default,
  hashPassword,
  isCatboxUrl,
  normalizeForumText,
  normalizeForumUsername,
  normalizeMessage,
  normalizeTopicTitle,
  normalizeUsername,
  parseCookies,
  verifyPassword
};
//# sourceMappingURL=index.js.map
