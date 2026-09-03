import { marked } from "./vendor/marked.esm.js";
import DOMPurify from "./vendor/purify.es.mjs";

const apiRoot = "/api/forum";
const state = { user: null, categories: [], config: null, activeCategory: "", activeTopic: null, activeReplies: [] };
const main = document.getElementById("forum-main");
const title = document.getElementById("forum-title");
const userLabel = document.getElementById("forum-user-label");
const categoryList = document.getElementById("forum-categories");
const sideLogout = document.getElementById("forum-side-logout");
let fieldSequence = 0;

marked.use({ renderer: { html() { return ""; } } });

function element(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function button(text, action, value, className = "forum-button") {
	const node = element("button", className, text);
	node.type = action === "submit" ? "submit" : "button";
	if (action !== "submit") node.dataset.forumAction = action;
	if (value !== undefined) node.dataset.value = String(value);
	return node;
}

function textAction(text, action, value) {
	return button(text, action, value, "forum-text-action");
}

function markdown(value) {
	const node = element("div", "forum-markdown");
	node.innerHTML = DOMPurify.sanitize(marked.parse(value || "", { gfm: true, breaks: true }), {
		ALLOWED_TAGS: ["a", "blockquote", "br", "code", "del", "em", "h1", "h2", "h3", "h4", "hr", "img", "li", "ol", "p", "pre", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul"],
		ALLOWED_ATTR: ["alt", "href", "src", "title"]
	});
	node.querySelectorAll("a").forEach((link) => { link.target = "_blank"; link.rel = "noopener noreferrer"; });
	node.querySelectorAll("img").forEach((image) => { image.loading = "lazy"; });
	return node;
}

function formatDate(value) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function setTitle(value) { title.textContent = value; }

function clearMain() { main.replaceChildren(); }

function notice(text, error) {
	const node = element("p", error ? "forum-feedback forum-feedback-error" : "forum-feedback", text);
	main.prepend(node);
	setTimeout(() => node.remove(), 5000);
}

async function api(path, options = {}) {
	const response = await fetch(apiRoot + path, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json", ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) }, ...options });
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		const error = new Error(payload.error || "The forum request failed");
		error.code = payload.code || "";
		throw error;
	}
	return payload;
}

function renderCategories() {
	categoryList.replaceChildren();
	state.categories.forEach((category) => {
		const item = element("li");
		const link = element("a", "sb-butn", `${category.title} (${category.topic_count})`);
		link.href = `#category-${category.slug}`;
		link.dataset.forumAction = "category";
		link.dataset.value = category.slug;
		item.append(link);
		categoryList.append(item);
	});
	if (!state.categories.length) categoryList.append(element("li", "forum-loading", "No active sections"));
}

function renderUserStatus() {
	if (state.user) {
		userLabel.textContent = `${state.user.username}${state.user.is_owner ? " / Owner" : ""}`;
	} else {
		userLabel.textContent = "Guest";
	}
	sideLogout.hidden = !state.user;
}

async function refreshSession() {
	state.user = (await api("/me")).user;
	renderUserStatus();
}

async function refreshCategories() {
	state.categories = (await api("/categories")).categories;
	renderCategories();
}

function actionRow() { return element("div", "forum-action-row"); }

function formActions(submitText) {
	const actions = element("div", "forum-form-actions");
	actions.append(button(submitText, "submit"), textAction("Cancel", "cancel-inline"));
	return actions;
}

function utilityField(labelText, name, value = "", multiline = false, required = true) {
	const wrap = element("div", "forum-field");
	const label = element("label", "forum-label", labelText);
	const control = element(multiline ? "textarea" : "input", multiline ? "forum-textarea" : "forum-input");
	const id = `forum-${name}-${fieldSequence += 1}`;
	label.htmlFor = id;
	control.id = id;
	control.name = name;
	control.required = required;
	control.value = value;
	if (multiline) control.rows = 8;
	wrap.append(label, control);
	return { wrap, control };
}

function closeInlineForm() {
	main.querySelector(".forum-inline-editor")?.remove();
}

function openInlineForm(titleText, fields, submitText, onSubmit) {
	closeInlineForm();
	const form = element("form", "forum-inline-editor");
	form.append(element("h3", "forum-section-label", titleText));
	fields.forEach((field) => form.append(field.wrap));
	const feedback = element("p", "forum-feedback");
	feedback.hidden = true;
	form.append(feedback, formActions(submitText));
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (form.dataset.submitting === "true") return;
		form.dataset.submitting = "true";
		form.querySelectorAll("button").forEach((control) => { control.disabled = true; });
		feedback.hidden = true;
		try {
			await onSubmit(new FormData(form));
			closeInlineForm();
		} catch (error) {
			feedback.textContent = String(error.message || error);
			feedback.className = "forum-feedback forum-feedback-error";
			feedback.hidden = false;
			form.dataset.submitting = "false";
			form.querySelectorAll("button").forEach((control) => { control.disabled = false; });
		}
	});
	main.prepend(form);
	fields[0]?.control.focus();
}

function openConfirmForm(titleText, message, submitText, onSubmit) {
	closeInlineForm();
	const form = element("form", "forum-inline-editor");
	form.append(element("h3", "forum-section-label", titleText), element("p", "", message), formActions(submitText));
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (form.dataset.submitting === "true") return;
		form.dataset.submitting = "true";
		form.querySelectorAll("button").forEach((control) => { control.disabled = true; });
		try { await onSubmit(); closeInlineForm(); }
		catch (error) {
			form.prepend(element("p", "forum-feedback forum-feedback-error", String(error.message || error)));
			form.dataset.submitting = "false";
			form.querySelectorAll("button").forEach((control) => { control.disabled = false; });
		}
	});
	main.prepend(form);
	form.querySelector("button[type='submit']")?.focus();
}

function topicRow(topic) {
	const row = element("article", "forum-topic-row");
	const topicCell = element("div", "forum-topic-copy");
	const heading = element("h3", "forum-topic-heading");
	const link = element("a", "forum-topic-link", topic.title);
	link.href = `#topic-${topic.id}`;
	link.dataset.forumAction = "topic";
	link.dataset.value = topic.id;
	heading.append(link);
	topicCell.append(heading, element("p", "forum-meta", `Started by ${topic.author_username}`));
	if (topic.is_sticky || topic.is_locked || topic.is_hidden) {
		const flags = element("span", "forum-flags", [topic.is_sticky && "STICKY", topic.is_locked && "LOCKED", topic.is_hidden && "HIDDEN"].filter(Boolean).join(" / "));
		topicCell.append(flags);
	}
	const activity = element("div", "forum-topic-activity");
	activity.append(element("span", "forum-reply-count", `${topic.reply_count} ${topic.reply_count === 1 ? "reply" : "replies"}`), element("span", "forum-meta", `Last post ${formatDate(topic.last_activity_at)}`));
	row.append(topicCell, activity);
	return row;
}

function categorySection(category, topics, filtered) {
	const section = element("section", "forum-category-group");
	const heading = element("div", "forum-category-heading");
	const titleNode = element("h2", "forum-category-title");
	if (filtered) titleNode.textContent = category.title;
	else {
		const link = element("a", "forum-topic-link", category.title);
		link.href = `#category-${category.slug}`;
		link.dataset.forumAction = "category";
		link.dataset.value = category.slug;
		titleNode.append(link);
	}
	heading.append(titleNode);
	if (category.description) heading.append(element("p", "forum-category-description", category.description));
	heading.append(element("p", "forum-meta", `${category.topic_count} ${Number(category.topic_count) === 1 ? "topic" : "topics"}`));
	section.append(heading);
	if (topics.length) topics.forEach((topic) => section.append(topicRow(topic)));
	return section;
}

async function renderIndex(category = "") {
	state.activeCategory = category;
	state.activeTopic = null;
	state.activeReplies = [];
	setTitle(category ? `${category.toUpperCase()} / TOPICS` : "MERCURY COMMUNITY FORUM");
	clearMain();
	const controls = actionRow();
	if (state.user) controls.append(button("NEW TOPIC", "compose"));
	else controls.append(textAction("Sign in to post", "account"));
	main.append(controls);
	try {
		const query = category ? `?category=${encodeURIComponent(category)}` : "";
		const payload = await api(`/topics${query}`);
		const categories = category ? state.categories.filter((item) => item.slug === category) : state.categories;
		if (!categories.length) main.append(element("p", "forum-empty", "This forum section could not be found."));
		else categories.forEach((item) => main.append(categorySection(item, payload.topics.filter((topic) => topic.category_slug === item.slug), Boolean(category))));
	} catch (error) {
		main.append(element("p", "forum-error", String(error.message)));
	}
}

function postCard(item, type) {
	const card = element("article", `forum-post forum-${type}${item.is_hidden ? " forum-post-hidden" : ""}`);
	card.setAttribute("aria-label", `${type} ${item.id} by ${item.author_username}`);
	const header = element("header", "forum-post-header");
	header.append(element("strong", "forum-author", item.author_username), element("span", "forum-meta", `${type === "topic" ? "Topic" : "Reply"} #${item.id} · ${formatDate(item.created_at)}`));
	if (item.updated_at) header.append(element("span", "forum-edited", "Edited"));
	const content = element("div", "forum-post-content");
	content.append(markdown(item.body));
	card.append(header, content);
	const controls = actionRow();
	if (state.user) controls.append(textAction("Report", "report", `${type}:${item.id}`));
	if (state.user && (state.user.id === item.author_id || state.user.is_owner)) controls.append(textAction("Edit", "edit", `${type}:${item.id}`));
	if (state.user?.is_owner) {
		controls.append(textAction(item.is_hidden ? "Restore" : "Hide", "moderate", `${type}:${item.id}:${item.is_hidden ? "restore" : "hide"}`));
		if (type === "topic") controls.append(textAction(item.is_locked ? "Unlock" : "Lock", "moderate", `${type}:${item.id}:${item.is_locked ? "unlock" : "lock"}`));
	}
	if (controls.childElementCount) card.append(controls);
	return card;
}

async function renderTopic(topicId) {
	setTitle("FORUM TOPIC");
	clearMain();
	main.append(element("p", "forum-loading", "Loading thread..."));
	try {
		const payload = await api(`/topics/${topicId}`);
		state.activeTopic = payload.topic;
		state.activeReplies = payload.replies;
		clearMain();
		const breadcrumb = element("p", "forum-kicker", `${payload.topic.category_title} / Thread #${payload.topic.id}`);
		const heading = element("h2", "forum-thread-title", payload.topic.title);
		main.append(breadcrumb, heading, postCard(payload.topic, "topic"));
		if (payload.replies.length) main.append(element("h3", "forum-section-label", "REPLIES"));
		payload.replies.forEach((reply) => main.append(postCard(reply, "reply")));
		if (state.user && (!payload.topic.is_locked || state.user.is_owner)) main.append(replyForm(topicId));
		else main.append(element("p", "forum-empty", payload.topic.is_locked ? "This thread is locked." : "Sign in to reply."));
	} catch (error) {
		clearMain();
		main.append(element("p", "forum-error", String(error.message)), textAction("Return to forum index", "index"));
	}
}

function labelledInput(labelText, name, type = "text", required = true) {
	const wrap = element("div", "forum-field");
	const label = element("label", "forum-label", labelText);
	const input = element("input", "forum-input");
	const id = `forum-${name}-${fieldSequence += 1}`;
	label.htmlFor = id;
	input.id = id; input.name = name; input.type = type; input.required = required;
	wrap.append(label, input);
	return wrap;
}

function replyForm(topicId) {
	const form = element("form", "forum-form");
	form.dataset.forumForm = "reply";
	form.dataset.topicId = topicId;
	form.append(element("h3", "forum-section-label", "POST A REPLY"));
	const label = element("label", "forum-label", "MESSAGE");
	const body = element("textarea", "forum-textarea");
	body.id = `forum-reply-${fieldSequence += 1}`; body.name = "body"; body.required = true; body.maxLength = 10000; body.rows = 8; body.placeholder = "Markdown is supported. Raw HTML is disabled.";
	label.htmlFor = body.id;
	form.append(label, body, button("POST REPLY", "submit", undefined, "forum-button"));
	return form;
}

function renderCompose() {
	if (!state.user) return renderAccount("Sign in to create a topic.");
	setTitle("POST NEW TOPIC");
	clearMain();
	const form = element("form", "forum-form");
	form.dataset.forumForm = "topic";
	form.append(element("p", "forum-kicker", "Markdown is supported. Raw HTML is removed."));
	const categoryField = element("div", "forum-field");
	const categoryLabel = element("label", "forum-label", "FORUM SECTION");
	const select = element("select", "forum-input"); select.id = `forum-category-${fieldSequence += 1}`; select.name = "category_slug"; select.required = true;
	categoryLabel.htmlFor = select.id;
	categoryField.append(categoryLabel);
	state.categories.forEach((category) => { const option = element("option", "", category.title); option.value = category.slug; select.append(option); });
	categoryField.append(select);
	form.append(categoryField, labelledInput("SUBJECT", "title"));
	const messageLabel = element("label", "forum-label", "MESSAGE");
	const message = element("textarea", "forum-textarea"); message.id = `forum-message-${fieldSequence += 1}`; message.name = "body"; message.required = true; message.maxLength = 20000; message.rows = 14; message.placeholder = "Write the first post...";
	messageLabel.htmlFor = message.id;
	form.append(messageLabel, message);
	const uploadField = element("div", "forum-field");
	const uploadLabel = element("label", "forum-label", "OPTIONAL CATBOX ATTACHMENT");
	const file = element("input", "forum-input"); file.id = `forum-file-${fieldSequence += 1}`; file.type = "file"; file.name = "file"; file.disabled = !state.config.uploads_enabled;
	uploadLabel.htmlFor = file.id;
	uploadField.append(uploadLabel);
	uploadField.append(file, element("p", "forum-muted", state.config.uploads_enabled ? "Upload limit: 95 MiB. A public link will be added to the post." : "Attachments are not currently configured."));
	form.append(uploadField, button("OPEN TOPIC", "submit"));
	main.append(form);
}

function addTurnstile(form, siteKey) {
	const host = element("div", "forum-turnstile");
	host.dataset.sitekey = siteKey;
	form.append(host);
	let attempts = 0;
	const render = () => {
		if (!host.isConnected || host.dataset.rendered) return;
		if (window.turnstile?.render) {
			const widgetId = window.turnstile.render(host, { sitekey: siteKey, theme: "dark" });
			host.dataset.widgetId = String(widgetId);
			host.dataset.rendered = "true";
			return;
		}
		attempts += 1;
		if (attempts < 60) setTimeout(render, 250);
	};
	render();
}

function resetTurnstile(form) {
	const host = form.querySelector(".forum-turnstile[data-rendered='true']");
	if (!host || !window.turnstile?.reset) return;
	window.turnstile.reset(host.dataset.widgetId);
}

function authForm(mode) {
	const form = element("form", "forum-form forum-auth-form");
	form.dataset.forumForm = mode;
	form.append(element("h3", "forum-section-label", mode === "register" ? "CREATE ACCOUNT" : "SIGN IN"));
	form.append(labelledInput("HANDLE", "username"), labelledInput("PASSWORD", "password", "password"));
	if (mode === "register") form.append(element("p", "forum-muted", "Use a password between 12 and 256 characters. This forum does not collect email addresses."));
	addTurnstile(form, state.config.turnstile_site_key);
	form.append(button(mode === "register" ? "CREATE ACCOUNT" : "SIGN IN", "submit"));
	return form;
}

async function renderOwnerPanel() {
	if (!state.user?.is_owner) return;
	const panel = element("section", "forum-owner-panel");
	panel.append(element("h3", "forum-section-label", "OWNER CONSOLE"));
	const actions = actionRow();
	actions.append(button("OPEN REPORTS", "reports"), textAction("New section", "new-category"));
	panel.append(actions);
	state.categories.forEach((category) => panel.append(textAction(`Edit ${category.title}`, "edit-category", String(category.id))));
	main.append(panel);
}

async function renderAccount(message = "") {
	setTitle("MEMBER ACCOUNT");
	clearMain();
	if (message) main.append(element("p", "forum-feedback", message));
	if (state.user) {
		main.append(element("p", "forum-kicker", `Signed in as ${state.user.username}.`), element("p", "forum-empty", "Password recovery is handled by a site owner. Contact an owner outside the forum if you need help."), textAction("Sign out", "logout"));
		await renderOwnerPanel();
		return;
	}
	if (!state.config.turnstile_enabled || !state.config.turnstile_site_key) {
		main.append(element("p", "forum-empty", "Accounts are temporarily unavailable because verification has not been configured."));
		return;
	}
	const columns = element("div", "forum-auth-columns");
	columns.append(authForm("login"), authForm("register"));
	main.append(columns);
}

async function renderReports() {
	if (!state.user?.is_owner) return renderAccount("Owner access required.");
	setTitle("OWNER / OPEN REPORTS");
	clearMain();
	const payload = await api("/owner/reports");
	if (!payload.reports.length) main.append(element("p", "forum-empty", "There are no open reports."));
	payload.reports.forEach((report) => {
		const row = element("article", "forum-admin-row");
		row.append(element("h3", "forum-topic-heading", `${report.target_type.toUpperCase()} #${report.target_id} // ${report.reporter_username.toUpperCase()}`), element("p", "forum-meta", formatDate(report.created_at)), element("p", "", report.reason));
		const controls = actionRow();
		controls.append(textAction("Open target", "topic", report.target_type === "topic" ? report.target_id : ""), textAction("Resolve", "moderate", `report:${report.id}:resolve`));
		row.append(controls); main.append(row);
	});
	const reset = element("form", "forum-form"); reset.dataset.forumForm = "reset-password"; reset.append(element("h3", "forum-section-label", "OWNER PASSWORD RESET"), labelledInput("HANDLE", "username"), labelledInput("NEW PASSWORD", "password", "password"), button("RESET PASSWORD", "submit")); main.append(reset);
	const userAction = element("form", "forum-form"); userAction.dataset.forumForm = "user-action"; userAction.append(element("h3", "forum-section-label", "ACCOUNT CONTROL"), labelledInput("HANDLE", "username"));
	const actionField = element("div", "forum-field"); const actionLabel = element("label", "forum-label", "ACTION"); const select = element("select", "forum-input"); select.id = `forum-action-${fieldSequence += 1}`; select.name = "action"; actionLabel.htmlFor = select.id; actionField.append(actionLabel); ["suspend", "restore"].forEach((value) => { const option = element("option", "", value.toUpperCase()); option.value = value; select.append(option); }); actionField.append(select); userAction.append(actionField, button("APPLY ACCOUNT ACTION", "submit")); main.append(userAction);
}

function reportTarget(value) {
	if (!state.user) return renderAccount("Sign in before reporting content.");
	const [targetType, targetId] = value.split(":");
	const reason = utilityField("Reason for report", "reason", "", true);
	reason.control.maxLength = 1000;
	openInlineForm(`REPORT ${targetType.toUpperCase()} #${targetId}`, [reason], "SUBMIT REPORT", async (values) => {
		await api("/reports", { method: "POST", body: JSON.stringify({ target_type: targetType, target_id: Number(targetId), reason: values.get("reason") }) });
		notice("Your report was sent to the site owner.");
	});
}

function editTarget(value) {
	const [targetType, targetId] = value.split(":");
	if (targetType === "topic") {
		const titleField = utilityField("Topic title", "title", state.activeTopic?.title || "");
		const bodyField = utilityField("Topic body (Markdown)", "body", state.activeTopic?.body || "", true);
		titleField.control.maxLength = 120;
		bodyField.control.maxLength = 20000;
		return openInlineForm(`EDIT TOPIC #${targetId}`, [titleField, bodyField], "SAVE CHANGES", async (values) => {
			await api(`/topics/${targetId}`, { method: "PATCH", body: JSON.stringify({ title: values.get("title"), body: values.get("body") }) });
			await renderTopic(targetId);
		});
	}
	const reply = state.activeReplies.find((item) => item.id === Number(targetId));
	const bodyField = utilityField("Reply body (Markdown)", "body", reply?.body || "", true);
	bodyField.control.maxLength = 10000;
	return openInlineForm(`EDIT REPLY #${targetId}`, [bodyField], "SAVE CHANGES", async (values) => {
		await api(`/replies/${targetId}`, { method: "PATCH", body: JSON.stringify({ body: values.get("body") }) });
		await renderTopic(state.activeTopic.id);
	});
}

function moderateTarget(value) {
	const [targetType, targetId, action] = value.split(":");
	const label = `${action.charAt(0).toUpperCase()}${action.slice(1)} ${targetType} #${targetId}`;
	openConfirmForm("CONFIRM MODERATION", `${label}? This change takes effect immediately.`, action.toUpperCase(), async () => {
		await api("/owner/moderate", { method: "POST", body: JSON.stringify({ target_type: targetType, target_id: Number(targetId), action }) });
		if (state.activeTopic) await renderTopic(state.activeTopic.id);
		else await renderIndex(state.activeCategory);
	});
}

function newCategoryForm() {
	const titleField = utilityField("Section title", "title");
	const descriptionField = utilityField("Description", "description", "", true, false);
	titleField.control.maxLength = 80;
	descriptionField.control.maxLength = 240;
	openInlineForm("NEW FORUM SECTION", [titleField, descriptionField], "CREATE SECTION", async (values) => {
		await api("/owner/categories", { method: "POST", body: JSON.stringify({ title: values.get("title"), description: values.get("description") }) });
		await refreshCategories();
		await renderIndex();
	});
}

function editCategoryForm(category) {
	const titleField = utilityField("Section title", "title", category.title);
	const descriptionField = utilityField("Description", "description", category.description || "", true, false);
	titleField.control.maxLength = 80;
	descriptionField.control.maxLength = 240;
	const archiveWrap = element("div", "forum-field forum-check-field");
	const archive = element("input", "forum-check");
	const archiveLabel = element("label", "forum-check-label", "Archive this section");
	archive.type = "checkbox";
	archive.name = "archived";
	archive.id = `forum-archived-${fieldSequence += 1}`;
	archive.checked = Boolean(category.is_archived);
	archiveLabel.htmlFor = archive.id;
	archiveWrap.append(archive, archiveLabel);
	openInlineForm(`EDIT ${category.title.toUpperCase()}`, [titleField, descriptionField, { wrap: archiveWrap, control: archive }], "SAVE SECTION", async (values) => {
		await api(`/owner/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ title: values.get("title"), description: values.get("description"), is_archived: values.get("archived") === "on" }) });
		await refreshCategories();
		await renderAccount();
	});
}

async function handleForm(form) {
	if (form.dataset.submitting === "true") return;
	form.dataset.submitting = "true";
	form.querySelectorAll("button[type='submit']").forEach((control) => { control.disabled = true; });
	const kind = form.dataset.forumForm;
	const values = new FormData(form);
	try {
		if (kind === "login" || kind === "register") {
			const payload = await api(`/auth/${kind}`, { method: "POST", body: JSON.stringify({ username: values.get("username"), password: values.get("password"), turnstile_token: values.get("cf-turnstile-response") }) });
			state.user = payload.user; renderUserStatus(); return renderIndex();
		}
		if (kind === "topic") {
			let body = String(values.get("body") || "");
			const file = values.get("file");
			if (file instanceof File && file.size) {
				const upload = new FormData(); upload.append("file", file);
				const attachment = (await api("/uploads", { method: "POST", body: upload })).attachment;
				body += `\n\n[${attachment.filename.replace(/[\[\]]/g, "")}](${attachment.url})`;
			}
			const result = await api("/topics", { method: "POST", body: JSON.stringify({ category_slug: values.get("category_slug"), title: values.get("title"), body }) });
			return renderTopic(result.topic.id);
		}
		if (kind === "reply") {
			await api(`/topics/${form.dataset.topicId}/replies`, { method: "POST", body: JSON.stringify({ body: values.get("body") }) });
			return renderTopic(form.dataset.topicId);
		}
		if (kind === "reset-password") {
			await api("/owner/reset-password", { method: "POST", body: JSON.stringify({ username: values.get("username"), password: values.get("password") }) });
			return notice("PASSWORD RESET; ALL EXISTING SESSIONS REVOKED.");
		}
		if (kind === "user-action") {
			await api("/owner/users/action", { method: "POST", body: JSON.stringify({ username: values.get("username"), action: values.get("action") }) });
			return notice("ACCOUNT ACTION APPLIED; EXISTING SESSIONS REVOKED.");
		}
	} catch (error) {
		if ((kind === "login" || kind === "register") && error.code === "turnstile_failed") resetTurnstile(form);
		notice(String(error.message), true);
	}
	finally {
		delete form.dataset.submitting;
		form.querySelectorAll("button[type='submit']").forEach((control) => { control.disabled = false; });
	}
}

document.addEventListener("submit", (event) => {
	const form = event.target.closest("form[data-forum-form]");
	if (!form) return;
	event.preventDefault();
	handleForm(form);
});

document.addEventListener("click", (event) => {
	const target = event.target.closest("[data-forum-action]");
	if (!target) return;
	const action = target.dataset.forumAction;
	event.preventDefault();
	const value = target.dataset.value;
	if (action === "index") return renderIndex();
	if (action === "category") return renderIndex(value);
	if (action === "topic") return value ? renderTopic(value) : renderIndex();
	if (action === "compose") return renderCompose();
	if (action === "account") return renderAccount();
	if (action === "logout") return api("/auth/logout", { method: "POST", body: "{}" }).then(() => { state.user = null; renderUserStatus(); return renderIndex(); });
	if (action === "report") return reportTarget(value);
	if (action === "edit") return editTarget(value);
	if (action === "moderate") return moderateTarget(value);
	if (action === "reports") return renderReports().catch((error) => notice(error.message, true));
	if (action === "cancel-inline") return closeInlineForm();
	if (action === "new-category") return newCategoryForm();
	if (action === "edit-category") {
		const category = state.categories.find((item) => item.id === Number(value));
		if (!category) return;
		return editCategoryForm(category);
	}
});

async function initialize() {
	try {
		state.config = await api("/config");
		await Promise.all([refreshSession(), refreshCategories()]);
		const topicMatch = location.hash.match(/^#topic-(\d+)$/);
		const categoryMatch = location.hash.match(/^#category-(.+)$/);
		if (topicMatch) await renderTopic(topicMatch[1]);
		else await renderIndex(categoryMatch ? categoryMatch[1] : "");
	} catch (error) {
		clearMain(); main.append(element("p", "forum-error", String(error.message)));
	}
}

initialize();
