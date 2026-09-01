const encoder = new TextEncoder();

export function normalizeUsername(value) {
	return String(value || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeMessage(value) {
	return String(value || "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

function json(data, status) {
	return new Response(JSON.stringify(data), {
		status: status || 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff"
		}
	});
}

async function fingerprint(request) {
	const address = request.headers.get("CF-Connecting-IP") || "unknown";
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(address));
	return Array.from(new Uint8Array(digest), function (byte) {
		return byte.toString(16).padStart(2, "0");
	}).join("");
}

function sameOrigin(request) {
	const origin = request.headers.get("Origin");
	return !origin || origin === new URL(request.url).origin;
}

async function listMessages(request, env) {
	const url = new URL(request.url);
	const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "25", 10);
	const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 25;
	const before = Number.parseInt(url.searchParams.get("before") || "", 10);
	let statement;

	if (Number.isInteger(before) && before > 0) {
		statement = env.DB.prepare(
			"SELECT id, username, message, created_at FROM chat_messages WHERE id < ? ORDER BY id DESC LIMIT ?"
		).bind(before, limit);
	} else {
		statement = env.DB.prepare(
			"SELECT id, username, message, created_at FROM chat_messages ORDER BY id DESC LIMIT ?"
		).bind(limit);
	}

	const result = await statement.all();
	return json({ messages: result.results || [] });
}

async function createMessage(request, env) {
	if (!sameOrigin(request)) {
		return json({ error: "Cross-origin posts are not accepted" }, 403);
	}
	if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
		return json({ error: "JSON body required" }, 415);
	}
	const contentLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
	if (contentLength > 2048) {
		return json({ error: "Message payload is too large" }, 413);
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: "Invalid JSON body" }, 400);
	}

	const username = normalizeUsername(body.username);
	const message = normalizeMessage(body.message);
	if (!username || Array.from(username).length > 24) {
		return json({ error: "Handle must contain 1 to 24 characters" }, 400);
	}
	if (!message || Array.from(message).length > 300) {
		return json({ error: "Message must contain 1 to 300 characters" }, 400);
	}

	const senderHash = await fingerprint(request);
	const previous = await env.DB.prepare(
		"SELECT created_at FROM chat_messages WHERE sender_hash = ? ORDER BY id DESC LIMIT 1"
	).bind(senderHash).first();
	if (previous && Date.now() - Date.parse(previous.created_at) < 2500) {
		return json({ error: "Wait a moment before posting again" }, 429);
	}

	const created = await env.DB.prepare(
		"INSERT INTO chat_messages (username, message, sender_hash) VALUES (?, ?, ?) RETURNING id, username, message, created_at"
	).bind(username, message, senderHash).first();
	return json({ message: created }, 201);
}

async function handleChat(request, env) {
	if (!env.DB) {
		return json({ error: "Chat database unavailable" }, 503);
	}
	if (request.method === "GET") {
		return listMessages(request, env);
	}
	if (request.method === "POST") {
		return createMessage(request, env);
	}
	return json({ error: "Method not allowed" }, 405);
}

async function serveAsset(request, env) {
	const url = new URL(request.url);
	if (url.pathname === "/") {
		url.pathname = "/index.html";
	}
	return env.ASSETS.fetch(new Request(url, request));
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname === "/api/chat") {
			return handleChat(request, env);
		}
		return serveAsset(request, env);
	}
};
