const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Telegram invalidates an auth key if two processes connect with it at once.
// Use a per-session lock in the OS temp directory so the app and maintenance
// scripts on this machine share the same guard without storing the session.
const session = process.env.SESSION;
if (!session) throw new Error("SESSION is required to lock the Telegram account");

const lockId = crypto.createHash("sha256").update(session).digest("hex");
const lockPath = path.join(os.tmpdir(), `telegram-session-${lockId}.lock`);
let held = false;

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function acquireSessionLock() {
  if (held) return releaseSessionLock;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, "wx", 0o600);
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, host: os.hostname() }));
      fs.closeSync(fd);
      held = true;
      process.once("exit", releaseSessionLock);
      return releaseSessionLock;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;

      let owner;
      try {
        owner = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      } catch {
        // Another process may still be writing the file; retry once.
        if (attempt === 0) continue;
      }

      if (owner && processIsRunning(owner.pid)) {
        throw new Error(
          `Telegram SESSION is already in use by process ${owner.pid} on ${owner.host || "this host"}. Stop that process before starting another client.`,
        );
      }

      // Remove only an abandoned lock. A second create attempt below handles
      // races with another process recovering the same stale file.
      try {
        fs.unlinkSync(lockPath);
      } catch (unlinkError) {
        if (unlinkError.code !== "ENOENT") throw unlinkError;
      }
    }
  }

  throw new Error("Could not acquire the Telegram SESSION lock");
}

function releaseSessionLock() {
  if (!held) return;
  held = false;
  try {
    const owner = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (owner.pid === process.pid) fs.unlinkSync(lockPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      // Process shutdown should not be interrupted by cleanup errors.
    }
  }
}

module.exports = { acquireSessionLock, releaseSessionLock };
