#!/usr/bin/env node
// First Android laboratory build helper for browser-based/mobile Codespaces.
// Generates no local secrets and only answers the exact EAS keystore prompt.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const expectedBranch = "fix/mwd-eas-project-id-stage146-20261028";
try {
  const currentBranch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  if (currentBranch !== expectedBranch) {
    throw new Error(`Expected laboratory branch ${expectedBranch}, found ${currentBranch}.`);
  }
  const changes = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  if (changes) {
    throw new Error("The worktree has uncommitted changes. Inspect them before building.");
  }
  const eas = JSON.parse(readFileSync("eas.json", "utf8"));
  const lab = eas.build?.["samsung-lab"];
  if (lab?.env?.MWD_APP_VARIANT !== "samsung-lab" || lab?.android?.buildType !== "apk" || lab?.distribution !== "internal") {
    throw new Error("The samsung-lab profile is not an internal Android APK build.");
  }
} catch (error) {
  console.error("Safety check:", error.message);
  process.exit(1);
}

const command = "npx eas-cli build --platform android --profile samsung-lab --no-wait";
console.log("Starting the isolated Samsung Lab Android APK build.");
console.log("Only the exact question about generating a new Android keystore will be answered automatically.");
const child = spawn("script", ["-q", "-e", "-c", command, "/dev/null"], {
  stdio: ["pipe", "pipe", "pipe"],
});

let output = "";
let answered = false;
child.stdout.on("data", (bytes) => {
  const chunk = bytes.toString("utf8");
  process.stdout.write(chunk);
  output = (output + chunk).replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").slice(-4000);
  if (!answered && output.includes("Generate a new Android Keystore?")) {
    answered = true;
    console.log("\nApproving a new keystore only for the laboratory build.");
    child.stdin.write("y\r");
  }
});
child.stderr.on("data", (bytes) => process.stderr.write(bytes));
child.on("error", (error) => {
  console.error("Failed to launch EAS:", error.message);
  process.exitCode = 1;
});
child.on("close", (code, signal) => {
  if (code !== 0) {
    console.error(`Laboratory build command stopped (code ${code}, signal ${signal}).`);
    process.exitCode = code || 1;
  }
});
process.on("SIGINT", () => child.kill("SIGINT"));
