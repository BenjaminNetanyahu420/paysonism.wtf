import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testFile = path.join(root, "tests", "chat.test.mjs");
const child = spawn(process.execPath, ["--test", testFile], { stdio: "inherit" });
child.on("exit", (code) => process.exitCode = code ?? 1);
