import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDirectory = path.join(root, "tests");
const testFiles = (await readdir(testDirectory))
	.filter((file) => file.endsWith(".test.mjs"))
	.map((file) => path.join(testDirectory, file));
const child = spawn(process.execPath, ["--test", ...testFiles], { stdio: "inherit" });
child.on("exit", (code) => process.exitCode = code ?? 1);
