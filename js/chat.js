(function () {
	"use strict";

	var apiUrl = "/api/chat";
	var pageSize = 25;
	var messages = new Map();
	var statusNode = document.getElementById("chat-status");
	var listNode = document.getElementById("chat-messages");
	var olderButton = document.getElementById("chat-older");
	var form = document.getElementById("chat-form");
	var usernameInput = document.getElementById("chat-username");
	var messageInput = document.getElementById("chat-message");
	var submitButton = document.getElementById("chat-submit");
	var feedbackNode = document.getElementById("chat-feedback");
	var initialized = false;
	var refreshing = false;

	function setStatus(text, offline) {
		statusNode.textContent = text;
		statusNode.className = offline ? "chat-status chat-status-offline" : "chat-status";
	}

	function setFeedback(text, error) {
		feedbackNode.textContent = text;
		feedbackNode.className = error ? "chat-feedback chat-feedback-error" : "chat-feedback";
	}

	function formatTime(value) {
		var date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return "--:--";
		}
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}

	function render() {
		var shouldStick = !initialized || listNode.scrollHeight - listNode.scrollTop - listNode.clientHeight < 35;
		var ordered = Array.from(messages.values()).sort(function (a, b) {
			return a.id - b.id;
		});

		listNode.replaceChildren();
		if (!ordered.length) {
			var empty = document.createElement("p");
			empty.className = "chat-empty";
			empty.textContent = "No transmissions yet. Start the channel.";
			listNode.appendChild(empty);
		} else {
			ordered.forEach(function (item) {
				var entry = document.createElement("p");
				var username = document.createElement("strong");
				var time = document.createElement("time");
				var body = document.createTextNode(item.message);

				entry.className = "chat-message";
				username.className = "chat-username";
				time.className = "chat-time";
				username.textContent = item.username;
				time.dateTime = item.created_at;
				time.textContent = " [" + formatTime(item.created_at) + "]";
				entry.appendChild(username);
				entry.appendChild(time);
				entry.appendChild(document.createElement("br"));
				entry.appendChild(body);
				listNode.appendChild(entry);
			});
		}

		if (shouldStick) {
			listNode.scrollTop = listNode.scrollHeight;
		}
		initialized = true;
	}

	async function fetchMessages(older) {
		if (refreshing) {
			return;
		}
		refreshing = true;
		try {
			var params = new URLSearchParams({ limit: String(pageSize) });
			if (older && messages.size) {
				params.set("before", String(Math.min.apply(null, Array.from(messages.keys()))));
			}
			var response = await fetch(apiUrl + "?" + params.toString(), {
				headers: { Accept: "application/json" },
				cache: "no-store"
			});
			if (!response.ok) {
				throw new Error("Channel unavailable");
			}
			var payload = await response.json();
			payload.messages.forEach(function (item) {
				messages.set(item.id, item);
			});
			if (older) {
				olderButton.hidden = payload.messages.length < pageSize;
			} else if (!initialized) {
				olderButton.hidden = payload.messages.length < pageSize;
			}
			render();
			setStatus("CHANNEL ONLINE", false);
		} catch (error) {
			setStatus("RECONNECTING...", true);
		} finally {
			refreshing = false;
		}
	}

	form.addEventListener("submit", async function (event) {
		event.preventDefault();
		var username = usernameInput.value.trim();
		var message = messageInput.value.trim();
		if (!username || !message) {
			setFeedback("HANDLE AND MESSAGE REQUIRED", true);
			return;
		}

		submitButton.disabled = true;
		setFeedback("TRANSMITTING...", false);
		try {
			var response = await fetch(apiUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify({ username: username, message: message })
			});
			var payload = await response.json();
			if (!response.ok) {
				throw new Error(payload.error || "Message failed");
			}
			localStorage.setItem("payson-chat-username", username);
			messages.set(payload.message.id, payload.message);
			messageInput.value = "";
			render();
			setFeedback("TRANSMISSION RECEIVED", false);
		} catch (error) {
			setFeedback(String(error.message || error).toUpperCase(), true);
		} finally {
			submitButton.disabled = false;
			messageInput.focus();
		}
	});

	olderButton.addEventListener("click", function () {
		fetchMessages(true);
	});

	usernameInput.value = localStorage.getItem("payson-chat-username") || "";
	fetchMessages(false);
	setInterval(function () {
		if (document.visibilityState === "visible") {
			fetchMessages(false);
		}
	}, 3000);
}());
