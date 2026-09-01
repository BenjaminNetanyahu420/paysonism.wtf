import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chatFile = path.join(root, ".local", "chat-messages.json");
const portArgument = process.argv.find((argument) => argument.startsWith("--port="));
const port = Number(portArgument?.slice(7) || process.env.PORT || 8787);
const mimeTypes = {
	".css": "text/css; charset=utf-8", ".gif": "image/gif", ".html": "text/html; charset=utf-8",
	".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml"
};
const recentPosts = new Map();

function json(response, status, body) {
	response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
	response.end(JSON.stringify(body));
}

async function readMessages() {
	try {
		return JSON.parse(await readFile(chatFile, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return [];
		throw error;
	}
}

async function receiveJson(request) {
	let body = "";
	for await (const chunk of request) {
		body += chunk;
		if (body.length > 2048) throw new Error("Message payload is too large");
	}
	return JSON.parse(body);
}

function normalizeUsername(value) {
	return String(value || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeMessage(value) {
	return String(value || "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

const server = createServer(async (request, response) => {
	try {
		const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
		if (url.pathname === "/api/chat") {
			const messages = await readMessages();
			if (request.method === "GET") {
				const before = Number(url.searchParams.get("before"));
				const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), 50);
				const selected = messages.filter((item) => !before || item.id < before).slice(-limit).reverse();
				return json(response, 200, { messages: selected });
			}
			if (request.method !== "POST") return json(response, 405, { error: "Method not allowed" });
			const address = request.socket.remoteAddress || "local";
			if (Date.now() - (recentPosts.get(address) || 0) < 2500) return json(response, 429, { error: "Wait a moment before posting again" });
			const body = await receiveJson(request);
			const username = normalizeUsername(body.username);
			const message = normalizeMessage(body.message);
			if (!username || Array.from(username).length > 24) return json(response, 400, { error: "Handle must contain 1 to 24 characters" });
			if (!message || Array.from(message).length > 300) return json(response, 400, { error: "Message must contain 1 to 300 characters" });
			const entry = { id: (messages.at(-1)?.id || 0) + 1, username, message, created_at: new Date().toISOString() };
			messages.push(entry);
			await mkdir(path.dirname(chatFile), { recursive: true });
			await writeFile(chatFile, JSON.stringify(messages, null, 2) + "\n");
			recentPosts.set(address, Date.now());
			return json(response, 201, { message: entry });
		}

		if (request.method !== "GET" && request.method !== "HEAD") {
			response.writeHead(405); return response.end();
		}
		const relativePath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
		const filePath = path.resolve(root, relativePath);
		if (!filePath.startsWith(root + path.sep)) {
			response.writeHead(403); return response.end();
		}
		const content = await readFile(filePath);
		response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
		return request.method === "HEAD" ? response.end() : response.end(content);
	} catch (error) {
		if (error.code === "ENOENT") {
			response.writeHead(404); return response.end("Not found");
		}
		if (error instanceof SyntaxError || error.message === "Message payload is too large") return json(response, 400, { error: error.message || "Invalid JSON body" });
		console.error(error);
		return json(response, 500, { error: "Local development server error" });
	}
});

server.listen(port, "127.0.0.1", () => console.log(`Local portfolio: http://127.0.0.1:${port}`));
