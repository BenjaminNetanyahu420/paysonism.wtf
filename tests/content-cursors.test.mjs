import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("homepage imports the approved legacy copy without restoring legacy structure", async () => {
	const html = await readFile(path.join(root, "index.html"), "utf8");

	for (const text of [
		"DISCORD PERKS",
		"150+ total projects",
		"C, C++, and KMDF",
		"Like-minded Exploiters",
		"Hey, I'm Payson!",
		"custom AI tools",
		"MY MOST KNOWN PROJECTS",
		"NO LONGER",
		"CorMem Vulnerable Driver",
		"VMProtect Unpacker",
		"Capstone for disassembly",
		"Hypervisor Docs: VT-X Hypervisor Docs Collection",
		"PUBLIC CHATROOM",
		"Visit forum"
	]) assert.match(html, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

	for (const superseded of [
		"CURRENT FOCUS",
		"AT A GLANCE",
		"100+ projects",
		"SELECTED SYSTEMS &amp; RESEARCH WORK",
		"CORMEM VULNERABLE DRIVER REVERSAL",
		"IOCTLBF",
		"STATUS......ACTIVE"
	]) assert.doesNotMatch(html, new RegExp(superseded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});

test("every Windows 98 cursor is a local CUR file with a semantic CSS fallback", async () => {
	const css = await readFile(path.join(root, "css", "mercury.css"), "utf8");
	const cursors = [
		["arrow.cur", "default"],
		["hand.cur", "pointer"],
		["text.cur", "text"],
		["progress.cur", "progress"],
		["busy.cur", "wait"],
		["help.cur", "help"],
		["unavailable.cur", "not-allowed"],
		["crosshair.cur", "crosshair"],
		["move.cur", "move"],
		["resize-nesw.cur", "nesw-resize"],
		["resize-nwse.cur", "nwse-resize"],
		["resize-ew.cur", "ew-resize"],
		["resize-ns.cur", "ns-resize"],
		["up-arrow.cur", "n-resize"]
	];

	for (const [filename, fallback] of cursors) {
		const data = await readFile(path.join(root, "assets", "cursors", filename));
		assert.deepEqual([...data.subarray(0, 4)], [0, 0, 2, 0], `${filename} has a CUR signature`);
		assert.match(css, new RegExp(`url\\(['\"]?\\.\\./assets/cursors/${filename.replace(".", "\\.")}['\"]?\\),\\s*${fallback.replace("-", "\\-")}`));
	}

	const textCursor = await readFile(path.join(root, "assets", "cursors", "text.cur"));
	assert.equal(textCursor.readUInt16LE(10), 15, "text cursor keeps the Windows 98 horizontal hotspot");
	assert.equal(textCursor.readUInt16LE(12), 16, "text cursor keeps the Windows 98 vertical hotspot");
	assert.equal(textCursor.readUInt16LE(36), 32, "text cursor uses browser-visible 32-bit pixels instead of an XOR-only mask");
	assert.ok(textCursor.subarray(62, 62 + (32 * 32 * 4)).some((byte) => byte !== 0), "text cursor contains visible pixels");
});

test("custom Mercury pointers are removed without removing arcade interactions", async () => {
	const css = await readFile(path.join(root, "css", "mercury.css"), "utf8");
	const interactions = await readFile(path.join(root, "js", "mercury-interactions.js"), "utf8");

	assert.doesNotMatch(css, /mercury-(?:cursor|probe)|cursor:\s*none/);
	assert.doesNotMatch(interactions, /makeProbe|updateProbe|mercury-probe/);
	assert.match(interactions, /setupParticles\(\)/);
	assert.match(interactions, /registerControls\(\)/);
	assert.match(interactions, /registerMonitors\(\)/);
	assert.match(interactions, /registerMechanicalButtons\(\)/);
});
