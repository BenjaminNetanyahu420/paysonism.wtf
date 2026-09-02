import { marked } from "./vendor/marked.esm.js";
import DOMPurify from "./vendor/purify.es.mjs";

const apiRoot = "/api/forum";
const state = { user: null, categories: [], config: null, activeCategory: "", activeTopic: null };
const main = document.getElementById("forum-main");
const title = document.getElementById("forum-title");
const status = document.getElementById("forum-status");
const userLabel = document.getElementById("forum-user-label");
const categoryList = document.getElementById("forum-categories");

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
	return Number.isNaN(date.getTime()) ? "UNKNOWN TIME" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }).toUpperCase();
}

function setStatus(text, problem) {
	status.textContent = text;
	status.className = problem ? "forum-status forum-status-error" : "forum-status";
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
		const error = new Error(payload.error || "Forum relay error");
		error.code = payload.code || "";
		throw error;
	}
	return payload;
}

function renderCategories() {
	categoryList.replaceChildren();
	state.categories.forEach((category) => {
		const item = element("li");
		const link = element("a", "sb-butn", `${category.title.toUpperCase()} [${category.topic_count}]`);
		link.href = `#category-${category.slug}`;
		link.dataset.forumAction = "category";
		link.dataset.value = category.slug;
		item.append(link);
		categoryList.append(item);
	});
	if (!state.categories.length) categoryList.append(element("li", "forum-loading", "NO ACTIVE SECTIONS"));
}

function renderUserStatus() {
	if (state.user) {
		userLabel.textContent = `${state.user.username.toUpperCase()}${state.user.is_owner ? " / OWNER" : ""}`;
		setStatus("MEMBER RELAY ACTIVE", false);
	} else {
		userLabel.textContent = "GUEST TERMINAL";
		setStatus("PUBLIC READ-ONLY MODE", false);
	}
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

function topicRow(topic) {
	const row = element("article", "forum-topic-row");
	const heading = element("h3", "forum-topic-heading");
	const link = element("a", "forum-topic-link", topic.title);
	link.href = `#topic-${topic.id}`;
	link.dataset.forumAction = "topic";
	link.dataset.value = topic.id;
	heading.append(link);
	const meta = element("p", "forum-meta", `${topic.category_title.toUpperCase()} // ${topic.author_username.toUpperCase()} // ${topic.reply_count} REPLIES // ${formatDate(topic.last_activity_at)}`);
	row.append(heading, meta);
	if (topic.is_sticky || topic.is_locked || topic.is_hidden) {
		const flags = element("span", "forum-flags", [topic.is_sticky && "STICKY", topic.is_locked && "LOCKED", topic.is_hidden && "HIDDEN"].filter(Boolean).join(" / "));
		row.append(flags);
	}
	return row;
}

async function renderIndex(category = "") {
	state.activeCategory = category;
	state.activeTopic = null;
	setTitle(category ? `${category.toUpperCase()} / TOPICS` : "MERCURY COMMUNITY FORUM");
	clearMain();
	const controls = actionRow();
	controls.append(button("NEW TRANSMISSION", "compose"), button("REFRESH INDEX", "index"));
	main.append(controls, element("p", "forum-kicker", category ? "[ FILTERED FORUM SECTION ]" : "[ REGISTERED MEMBERS MAY CREATE TOPICS, REPLY, REPORT, AND ATTACH FILES ]"));
	try {
		const query = category ? `?category=${encodeURIComponent(category)}` : "";
		const payload = await api(`/topics${query}`);
		if (!payload.topics.length) main.append(element("p", "forum-empty", "NO TRANSMISSIONS YET. OPEN THE CHANNEL."));
		payload.topics.forEach((topic) => main.append(topicRow(topic)));
	} catch (error) {
		main.append(element("p", "forum-empty", String(error.message).toUpperCase()));
	}
}

function postCard(item, type) {
	const card = element("article", `forum-post forum-${type}${item.is_hidden ? " forum-post-hidden" : ""}`);
	const header = element("div", "forum-post-header");
	header.append(element("strong", "forum-author", item.author_username.toUpperCase()), element("span", "forum-meta", `${type.toUpperCase()} #${item.id} // ${formatDate(item.created_at)}`));
	if (item.updated_at) header.append(element("span", "forum-edited", "EDITED"));
	card.append(header, markdown(item.body));
	const controls = actionRow();
	if (state.user) controls.append(button("REPORT", "report", `${type}:${item.id}`, "forum-inline-button"));
	if (state.user && (state.user.id === item.author_id || state.user.is_owner)) controls.append(button("EDIT", "edit", `${type}:${item.id}`, "forum-inline-button"));
	if (state.user?.is_owner) {
		controls.append(button(item.is_hidden ? "RESTORE" : "HIDE", "moderate", `${type}:${item.id}:${item.is_hidden ? "restore" : "hide"}`, "forum-inline-button"));
		if (type === "topic") controls.append(button(item.is_locked ? "UNLOCK" : "LOCK", "moderate", `${type}:${item.id}:${item.is_locked ? "unlock" : "lock"}`, "forum-inline-button"));
	}
	if (controls.childElementCount) card.append(controls);
	return card;
}

async function renderTopic(topicId) {
	setTitle("TOPIC TRANSMISSION");
	clearMain();
	main.append(element("p", "forum-loading", "LOADING THREAD..."));
	try {
		const payload = await api(`/topics/${topicId}`);
		state.activeTopic = payload.topic;
		clearMain();
		const breadcrumb = element("p", "forum-kicker", `[ ${payload.topic.category_title.toUpperCase()} / THREAD #${payload.topic.id} ]`);
		const heading = element("h2", "forum-thread-title", payload.topic.title);
		main.append(breadcrumb, heading, postCard(payload.topic, "topic"));
		if (payload.replies.length) main.append(element("h3", "forum-section-label", "REPLIES"));
		payload.replies.forEach((reply) => main.append(postCard(reply, "reply")));
		if (state.user && (!payload.topic.is_locked || state.user.is_owner)) main.append(replyForm(topicId));
		else main.append(element("p", "forum-empty", payload.topic.is_locked ? "THREAD LOCKED." : "SIGN IN TO REPLY."));
	} catch (error) {
		clearMain();
		main.append(element("p", "forum-empty", String(error.message).toUpperCase()), button("RETURN TO INDEX", "index"));
	}
}

function labelledInput(labelText, name, type = "text", required = true) {
	const wrap = element("div", "forum-field");
	const label = element("label", "forum-label", labelText);
	const input = element("input", "forum-input");
	input.name = name; input.type = type; input.required = required;
	wrap.append(label, input);
	return wrap;
}

function replyForm(topicId) {
	const form = element("form", "forum-form");
	form.dataset.forumForm = "reply";
	form.dataset.topicId = topicId;
	form.append(element("h3", "forum-section-label", "REPLY RELAY"));
	const body = element("textarea", "forum-textarea");
	body.name = "body"; body.required = true; body.maxLength = 10000; body.rows = 8; body.placeholder = "Markdown is supported. Raw HTML is disabled.";
	form.append(body, button("TRANSMIT REPLY", "submit", undefined, "forum-button"));
	return form;
}

function renderCompose() {
	if (!state.user) return renderAccount("Sign in to create a transmission.");
	setTitle("NEW TOPIC TRANSMISSION");
	clearMain();
	const form = element("form", "forum-form");
	form.dataset.forumForm = "topic";
	form.append(element("p", "forum-kicker", "[ MARKDOWN ENABLED // RAW HTML DISABLED ]"));
	const categoryField = element("div", "forum-field");
	categoryField.append(element("label", "forum-label", "FORUM SECTION"));
	const select = element("select", "forum-input"); select.name = "category_slug"; select.required = true;
	state.categories.forEach((category) => { const option = element("option", "", category.title); option.value = category.slug; select.append(option); });
	categoryField.append(select);
	form.append(categoryField, labelledInput("SUBJECT", "title"));
	const message = element("textarea", "forum-textarea"); message.name = "body"; message.required = true; message.maxLength = 20000; message.rows = 14; message.placeholder = "Write the first post...";
	form.append(element("label", "forum-label", "MESSAGE"), message);
	const uploadField = element("div", "forum-field");
	uploadField.append(element("label", "forum-label", "OPTIONAL CATBOX ATTACHMENT"));
	const file = element("input", "forum-input"); file.type = "file"; file.name = "file"; file.disabled = !state.config.uploads_enabled;
	uploadField.append(file, element("p", "forum-muted", state.config.uploads_enabled ? "UPLOAD LIMIT: 95 MiB. THE PUBLIC URL WILL BE ADDED TO THE POST." : "UPLOAD RELAY IS NOT CONFIGURED."));
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
	form.append(element("h3", "forum-section-label", mode === "register" ? "CREATE LOCAL ACCOUNT" : "SIGN IN"));
	form.append(labelledInput("HANDLE", "username"), labelledInput("PASSWORD", "password", "password"));
	if (mode === "register") form.append(element("p", "forum-muted", "12–256 CHARACTERS. EMAIL AND PASSWORD-RECOVERY LINKS ARE NOT USED."));
	addTurnstile(form, state.config.turnstile_site_key);
	form.append(button(mode === "register" ? "CREATE ACCOUNT" : "SIGN IN", "submit"));
	return form;
}

async function renderOwnerPanel() {
	if (!state.user?.is_owner) return;
	const panel = element("section", "forum-owner-panel");
	panel.append(element("h3", "forum-section-label", "OWNER CONSOLE"));
	const actions = actionRow();
	actions.append(button("OPEN REPORTS", "reports"), button("NEW SECTION", "new-category"));
	panel.append(actions);
	state.categories.forEach((category) => panel.append(button(`EDIT ${category.title.toUpperCase()}`, "edit-category", String(category.id), "forum-inline-button")));
	main.append(panel);
}

async function renderAccount(message = "") {
	setTitle("ACCOUNT TERMINAL");
	clearMain();
	if (message) main.append(element("p", "forum-feedback", message.toUpperCase()));
	if (state.user) {
		main.append(element("p", "forum-kicker", `[ AUTHENTICATED AS ${state.user.username.toUpperCase()} ]`), element("p", "forum-empty", "PASSWORD RECOVERY IS OWNER-ASSISTED. CONTACT A SITE OWNER OUT-OF-BAND."), button("SIGN OUT", "logout"));
		await renderOwnerPanel();
		return;
	}
	if (!state.config.turnstile_enabled || !state.config.turnstile_site_key) {
		main.append(element("p", "forum-empty", "ACCOUNT RELAY IS NOT CONFIGURED. THE SITE OWNER MUST SET TURNSTILE KEYS BEFORE REGISTRATION IS ENABLED."));
		return;
	}
	main.append(authForm("login"), authForm("register"));
}

async function renderReports() {
	if (!state.user?.is_owner) return renderAccount("Owner access required.");
	setTitle("OWNER / OPEN REPORTS");
	clearMain();
	const payload = await api("/owner/reports");
	if (!payload.reports.length) main.append(element("p", "forum-empty", "NO OPEN REPORTS."));
	payload.reports.forEach((report) => {
		const row = element("article", "forum-topic-row");
		row.append(element("h3", "forum-topic-heading", `${report.target_type.toUpperCase()} #${report.target_id} // ${report.reporter_username.toUpperCase()}`), element("p", "forum-meta", formatDate(report.created_at)), element("p", "", report.reason));
		const controls = actionRow();
		controls.append(button("OPEN TARGET", "topic", report.target_type === "topic" ? report.target_id : "", "forum-inline-button"), button("RESOLVE", "moderate", `report:${report.id}:resolve`, "forum-inline-button"));
		row.append(controls); main.append(row);
	});
	const reset = element("form", "forum-form"); reset.dataset.forumForm = "reset-password"; reset.append(element("h3", "forum-section-label", "OWNER PASSWORD RESET"), labelledInput("HANDLE", "username"), labelledInput("NEW PASSWORD", "password", "password"), button("RESET PASSWORD", "submit")); main.append(reset);
	const userAction = element("form", "forum-form"); userAction.dataset.forumForm = "user-action"; userAction.append(element("h3", "forum-section-label", "ACCOUNT CONTROL"), labelledInput("HANDLE", "username"));
	const actionField = element("div", "forum-field"); actionField.append(element("label", "forum-label", "ACTION")); const select = element("select", "forum-input"); select.name = "action"; ["suspend", "restore"].forEach((value) => { const option = element("option", "", value.toUpperCase()); option.value = value; select.append(option); }); actionField.append(select); userAction.append(actionField, button("APPLY ACCOUNT ACTION", "submit")); main.append(userAction);
}

function reportTarget(value) {
	if (!state.user) return renderAccount("Sign in before reporting content.");
	const [targetType, targetId] = value.split(":");
	const reason = window.prompt("Why should this content be reviewed?");
	if (!reason) return;
	api("/reports", { method: "POST", body: JSON.stringify({ target_type: targetType, target_id: Number(targetId), reason }) }).then(() => notice("REPORT QUEUED FOR OWNER REVIEW.")).catch((error) => notice(error.message.toUpperCase(), true));
}

async function editTarget(value) {
	const [targetType, targetId] = value.split(":");
	if (targetType === "topic") {
		const nextTitle = window.prompt("Topic title", state.activeTopic?.title || "");
		const nextBody = window.prompt("Topic body (Markdown)", state.activeTopic?.body || "");
		if (!nextTitle || !nextBody) return;
		await api(`/topics/${targetId}`, { method: "PATCH", body: JSON.stringify({ title: nextTitle, body: nextBody }) });
		return renderTopic(targetId);
	}
	const reply = [...document.querySelectorAll(".forum-reply")].find((node) => node.querySelector(".forum-meta")?.textContent.includes(`#${targetId}`));
	const nextBody = window.prompt("Reply body (Markdown)", reply?.querySelector(".forum-markdown")?.innerText || "");
	if (!nextBody) return;
	await api(`/replies/${targetId}`, { method: "PATCH", body: JSON.stringify({ body: nextBody }) });
	return renderTopic(state.activeTopic.id);
}

async function moderateTarget(value) {
	const [targetType, targetId, action] = value.split(":");
	await api("/owner/moderate", { method: "POST", body: JSON.stringify({ target_type: targetType, target_id: Number(targetId), action }) });
	if (state.activeTopic) return renderTopic(state.activeTopic.id);
	return renderIndex(state.activeCategory);
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
		notice(String(error.message).toUpperCase(), true);
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
	if (action === "edit") return editTarget(value).catch((error) => notice(error.message.toUpperCase(), true));
	if (action === "moderate") return moderateTarget(value).catch((error) => notice(error.message.toUpperCase(), true));
	if (action === "reports") return renderReports().catch((error) => notice(error.message.toUpperCase(), true));
	if (action === "new-category") {
		const titleValue = window.prompt("Section title"); const description = window.prompt("Section description", "");
		if (!titleValue) return;
		return api("/owner/categories", { method: "POST", body: JSON.stringify({ title: titleValue, description }) }).then(refreshCategories).then(renderIndex).catch((error) => notice(error.message.toUpperCase(), true));
	}
	if (action === "edit-category") {
		const category = state.categories.find((item) => item.id === Number(value));
		if (!category) return;
		const nextTitle = window.prompt("Section title", category.title); if (!nextTitle) return;
		const description = window.prompt("Section description", category.description); if (description === null) return;
		const archived = window.confirm("Archive this section? Select Cancel to keep it active.");
		return api(`/owner/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ title: nextTitle, description, is_archived: archived }) }).then(refreshCategories).then(renderAccount).catch((error) => notice(error.message.toUpperCase(), true));
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
		setStatus("FORUM OFFLINE", true);
		clearMain(); main.append(element("p", "forum-empty", String(error.message).toUpperCase()));
	}
}

initialize();
