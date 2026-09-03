import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("chat and forum use the complete v1-noforum Mercury interface language", async () => {
	const css = await readFile(path.join(root, "css", "mercury.css"), "utf8");
	const interactions = await readFile(path.join(root, "js", "mercury-interactions.js"), "utf8");
	const forum = await readFile(path.join(root, "js", "forum.js"), "utf8");
	const index = await readFile(path.join(root, "index.html"), "utf8");
	const chat = await readFile(path.join(root, "js", "chat.js"), "utf8");
	const start = css.indexOf("/* Mercury community interface");
	const end = css.indexOf("/* Main Content */", start);

	assert.notEqual(start, -1, "Mercury community CSS section is present");
	assert.notEqual(end, -1, "Mercury chat/forum CSS section has a stable boundary");

	const section = css.slice(start, end);
	assert.match(section, /#public-chat \.VInfo[\s\S]*width:\s*180px/, "chat returns to the compact sidebar module");
	assert.match(section, /#chat-messages[\s\S]*height:\s*160px[\s\S]*background-color:\s*#2E2E2E[\s\S]*border:\s*1px solid #737373/, "chat message well matches the reference branch");
	assert.match(section, /#chat-submit[\s\S]*nav-btns\.jpg/, "chat submit uses the reference sidebar control sprite");
	assert.match(section, /\.forum-button[\s\S]*nav-btns\.jpg/, "forum actions use the same native sidebar control sprite");
	assert.match(section, /\.forum-text-action[\s\S]*color:\s*#9E9E9E[\s\S]*text-decoration:\s*underline/, "secondary actions use the reference link treatment");
	assert.match(css, /nav-btns\.jpg/, "forum category navigation retains the native sidebar sprite");
	assert.match(section, /border-radius:\s*0px/, "community fields explicitly retain square corners");
	assert.doesNotMatch(section, /linear-gradient|backdrop-filter|rgba\(|--community-|display:\s*grid/, "community UI does not introduce a second visual system");
	assert.match(section, /\.forum-category-group[\s\S]*background-color:\s*#181818[\s\S]*border:\s*1px solid #737373/, "forum categories use framed Mercury surfaces");
	assert.match(section, /\.forum-topic-row[\s\S]*border-bottom:\s*1px dotted #737373/, "topic rows use the reference dotted dividers");
	assert.match(section, /\.forum-post[\s\S]*background-color:\s*#181818[\s\S]*border:\s*1px solid #737373/, "topic and reply bodies use framed Mercury surfaces");
	assert.match(section, /\.forum-form,[\s\S]*background-color:\s*#181818[\s\S]*border:\s*1px solid #737373/, "every forum form uses the same framed surface");
	assert.match(section, /font-family:\s*'Aldrich', Tahoma, Verdana/, "chat and forum typography match the reference branch");
	assert.match(section, /\.forum-page \.CInfo/, "the forum content frame cannot fall back to the main branch font");
	for (const selector of [
		"forum-loading", "forum-empty", "forum-error", "forum-feedback", "forum-action-row", "forum-form-actions", "forum-form", "forum-inline-editor",
		"forum-label", "forum-input", "forum-textarea", "forum-button", "forum-text-action",
		"forum-account-summary", "forum-side-info", "forum-side-note", "forum-kicker", "forum-meta", "forum-flags", "forum-edited",
		"forum-category-group", "forum-category-heading", "forum-category-title", "forum-category-description",
		"forum-category-empty", "forum-topic-row", "forum-topic-copy", "forum-topic-activity",
		"forum-reply-count", "forum-topic-heading", "forum-thread-title", "forum-section-label", "forum-topic-link",
		"forum-post", "forum-post-hidden", "forum-post-header", "forum-author", "forum-post-content", "forum-markdown",
		"forum-auth-columns", "forum-auth-form", "forum-turnstile", "forum-owner-panel", "forum-admin-row",
		"forum-muted", "forum-check", "forum-check-label"
	]) assert.match(section, new RegExp(`\\.${selector}\\b`), `${selector} has an explicit Mercury style`);
	assert.match(forum, /element\("section", "forum-category-group"\)/);
	assert.match(forum, /element\("article", "forum-topic-row"\)/);
	assert.match(forum, /element\("article", `forum-post/);
	assert.match(forum, /"forum-category-empty"/);
	assert.doesNotMatch(forum, /forum-index-table|forum-inline-button|element\("table", `forum-post/);
	assert.match(forum, /openInlineForm/);
	assert.match(forum, /cancel-inline/);
	assert.doesNotMatch(forum, /window\.(?:prompt|confirm)\(/, "core forum actions do not use browser dialogs");
	assert.doesNotMatch(index, /chat-toolbar|chat-room-note|forum-inline-button|chat-interface/);
	assert.match(index, /<div class="Vbox" id="public-chat">/);
	assert.match(index, /<div class="VTitle">CHATROOM<\/div>/);
	assert.match(index, /id="chat-submit"[^>]*>SEND<\/button>/);
	assert.ok(index.indexOf('id="public-chat"') < index.indexOf('id="col-right"'), "chat lives in the Mercury sidebar before the wide content column");
	assert.match(index, /fonts\.googleapis\.com\/css\?family=Aldrich/);
	const forumHtml = await readFile(path.join(root, "forum.html"), "utf8");
	assert.match(forumHtml, /<body id="top" class="forum-page">/);
	assert.match(forumHtml, /fonts\.googleapis\.com\/css\?family=Aldrich/);
	assert.match(chat, /entry\.appendChild\(document\.createElement\("br"\)\)/);
	assert.match(chat, /setStatus\("CHANNEL ONLINE", false\)/);
	assert.match(chat, /setFeedback\("TRANSMISSION RECEIVED", false\)/);
	assert.match(index, /content="width=device-width, initial-scale=1\.0"/);
	assert.match(interactions, /\.forum-button/);
	assert.doesNotMatch(interactions, /forum-inline-button|forum-entry-link|chat-older/);
	assert.match(interactions, /\.sb-butn/);
});
