import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
	"dist/client/index.html",
	"dist/client/forum.html",
	"dist/client/js/chat.js",
	"dist/client/js/forum.js",
	"dist/client/js/vendor/marked.esm.js",
	"dist/client/js/vendor/purify.es.mjs",
	"dist/server/index.js",
	"dist/.openai/hosting.json",
	"dist/.openai/drizzle/0000_glorious_azazel.sql",
	"dist/.openai/drizzle/0001_shallow_warhawk.sql",
	"dist/.openai/drizzle/0002_medical_logan.sql"
];

await Promise.all(required.map((file) => access(path.join(root, file))));
console.log("Build verification passed.");
