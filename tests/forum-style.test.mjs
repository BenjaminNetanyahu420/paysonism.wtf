import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("chat and forum retain the Mercury sprite and legacy-style contract", async () => {
	const css = await readFile(path.join(root, "css", "mercury.css"), "utf8");
	const interactions = await readFile(path.join(root, "js", "mercury-interactions.js"), "utf8");
	const start = css.indexOf("/* Mercury chat and forum:");
	const end = css.indexOf("/* Main Content */", start);

	assert.notEqual(start, -1, "Mercury chat/forum CSS section is present");
	assert.notEqual(end, -1, "Mercury chat/forum CSS section has a stable boundary");

	const section = css.slice(start, end);
	assert.match(section, /ft-butns4\.jpg/, "chat and forum actions use the native Mercury sprite");
	assert.match(css, /nav-btns\.jpg/, "forum category navigation retains the native sidebar sprite");
	assert.doesNotMatch(section, /linear-gradient|display:\s*flex|flex-wrap|\bgap:|box-shadow|scrollbar-color|box-sizing|\bresize:/, "modern control and card treatments are excluded");
	assert.match(interactions, /\.forum-button/);
	assert.match(interactions, /\.forum-inline-button/);
	assert.match(interactions, /\.forum-entry-link/);
	assert.match(interactions, /\.sb-butn/);
});
