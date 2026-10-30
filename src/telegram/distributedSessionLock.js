const { Client } = require("pg");
const { createHash } = require("node:crypto");

// PostgreSQL shares this lock across Vercel instances and releases it when the
// database session ends unexpectedly.
async function acquireDistributedSessionLock({ timeoutMs = 45_000 } = {}) {
  const session = process.env.SESSION;
  if (!session) throw new Error("SESSION is required for the Telegram service lock");

  // Use a stable, non-secret key so unrelated Telegram accounts can share the
  // same PostgreSQL database without blocking each other.
  const lockId = createHash("sha256")
    .update(session)
    .digest()
    .readBigInt64BE(0)
    .toString();
  const connectionString =
    process.env.TELEGRAM_LOCK_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TELEGRAM_LOCK_DATABASE_URL or DATABASE_URL is required for the Telegram service lock",
    );
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const result = await client.query(
        "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
        [lockId],
      );

      if (result.rows[0]?.acquired) break;
      if (Date.now() >= deadline) {
        const error = new Error("Timed out waiting for the Telegram session lock");
        error.status = 503;
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }

  let released = false;
  return async function releaseDistributedSessionLock() {
    if (released) return;
    released = true;

    try {
      await client.query("SELECT pg_advisory_unlock($1::bigint)", [
        lockId,
      ]);
    } finally {
      await client.end();
    }
  };
}

module.exports = { acquireDistributedSessionLock };
