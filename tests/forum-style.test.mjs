import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("chat and forum reuse the native Mercury content and action language", async () => {
	const css = await readFile(path.join(root, "css", "mercury.css"), "utf8");
	const interactions = await readFile(path.join(root, "js", "mercury-interactions.js"), "utf8");
	const forum = await readFile(path.join(root, "js", "forum.js"), "utf8");
	const index = await readFile(path.join(root, "index.html"), "utf8");
	const chat = await readFile(path.join(root, "js", "chat.js"), "utf8");
	const start = css.indexOf("/* Community elements reuse");
	const end = css.indexOf("/* Main Content */", start);

	assert.notEqual(start, -1, "Mercury community CSS section is present");
	assert.notEqual(end, -1, "Mercury chat/forum CSS section has a stable boundary");

	const section = css.slice(start, end);
	assert.match(section, /\.forum-button[\s\S]*ft-butns4\.jpg/, "primary community actions use the native Mercury sprite");
	assert.match(section, /\.forum-text-action[\s\S]*color:\s*#829EAE[\s\S]*text-decoration:\s*underline/, "secondary actions use the native Mercury link treatment");
	assert.match(css, /nav-btns\.jpg/, "forum category navigation retains the native sidebar sprite");
	assert.match(section, /border-radius:\s*0px/, "community fields explicitly retain square corners");
	assert.doesNotMatch(section, /linear-gradient|backdrop-filter|rgba\(|--community-|display:\s*grid/, "community UI does not introduce a second visual system");
	assert.match(section, /\.chat-messages[\s\S]*max-height:\s*260px/, "populated chat scrolls without forcing an empty panel height");
	assert.match(section, /\.forum-topic-row[\s\S]*border-bottom:\s*1px dotted #303A40/, "topic rows reuse native content dividers");
	assert.match(section, /font-family:\s*Verdana, Tahoma/, "body copy uses the period-appropriate interface stack");
	assert.match(forum, /element\("section", "forum-category-group"\)/);
	assert.match(forum, /element\("article", "forum-topic-row"\)/);
	assert.match(forum, /element\("article", `forum-post/);
	assert.doesNotMatch(forum, /forum-index-table|forum-inline-button|element\("table", `forum-post/);
	assert.match(forum, /openInlineForm/);
	assert.match(forum, /cancel-inline/);
	assert.doesNotMatch(forum, /window\.(?:prompt|confirm)\(/, "core forum actions do not use browser dialogs");
	assert.doesNotMatch(index, /chat-toolbar|chat-room-note|forum-inline-button/);
	assert.match(index, /id="chat-status"[^>]*hidden="hidden"/);
	assert.match(chat, /statusNode\.hidden = !offline/);
	assert.match(chat, /feedbackNode\.hidden = !error/);
	assert.doesNotMatch(chat, /Chatroom online|Message posted/);
	assert.ok(index.indexOf('id="public-chat"') > index.indexOf('id="about"'), "chat follows the About panel in the wide content column");
	assert.match(index, /content="width=device-width, initial-scale=1\.0"/);
	assert.match(interactions, /\.forum-button/);
	assert.doesNotMatch(interactions, /forum-inline-button|forum-entry-link|chat-older/);
	assert.match(interactions, /\.sb-butn/);
});
