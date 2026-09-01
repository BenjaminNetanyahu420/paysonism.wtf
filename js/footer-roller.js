(function () {
	"use strict";

	var quotes = [
		"“Premature optimization is the root of all evil.” — Donald Knuth",
		"“Programs must be written for people to read.” — Harold Abelson",
		"“Talk is cheap. Show me the code.” — Linus Torvalds",
		"“Simplicity is prerequisite for reliability.” — Edsger W. Dijkstra"
	];
	var rollers = Array.prototype.slice.call(document.querySelectorAll(".footer-roller"));
	var index = 0;

	function line(text, entering) {
		var item = document.createElement("p");
		item.className = "footer-roller-line" + (entering ? " is-entering" : "");
		item.textContent = text;
		return item;
	}

	function replace(roller, text, animate) {
		var viewport = roller.querySelector(".footer-roller-viewport");
		var current = viewport.querySelector(".footer-roller-line");
		var next = line(text, animate);
		if (!animate) {
			viewport.replaceChildren(next);
			return;
		}
		current.classList.add("is-leaving");
		viewport.appendChild(next);
		requestAnimationFrame(function () { next.classList.add("is-active"); });
		window.setTimeout(function () { current.remove(); }, 480);
	}

	function render(animate) {
		rollers.forEach(function (roller, rollerIndex) {
			replace(roller, quotes[(index + rollerIndex) % quotes.length], animate);
		});
	}

	render(false);
	if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		window.setInterval(function () {
			index = (index + 1) % quotes.length;
			render(true);
		}, 5200);
	}
}());
