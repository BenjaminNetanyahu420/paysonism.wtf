import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "server"), { recursive: true });
await mkdir(path.join(dist, "client"), { recursive: true });
await mkdir(path.join(dist, ".openai"), { recursive: true });

await cp(path.join(root, "worker", "index.js"), path.join(dist, "server", "index.js"));
await cp(path.join(root, "index.html"), path.join(dist, "client", "index.html"));
await cp(path.join(root, "forum.html"), path.join(dist, "client", "forum.html"));

for (const folder of ["css", "theme", "assets", "js"]) {
	await cp(path.join(root, folder), path.join(dist, "client", folder), { recursive: true });
}

await cp(path.join(root, ".openai", "hosting.json"), path.join(dist, ".openai", "hosting.json"));
await cp(path.join(root, "drizzle"), path.join(dist, ".openai", "drizzle"), { recursive: true });
await mkdir(path.join(dist, "client", "js", "vendor"), { recursive: true });
await copyFile(path.join(root, "node_modules", "marked", "lib", "marked.esm.js"), path.join(dist, "client", "js", "vendor", "marked.esm.js"));
await copyFile(path.join(root, "node_modules", "dompurify", "dist", "purify.es.mjs"), path.join(dist, "client", "js", "vendor", "purify.es.mjs"));

console.log("Built deployable output in dist/");
