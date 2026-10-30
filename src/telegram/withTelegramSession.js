import { acquireDistributedSessionLock } from "./distributedSessionLock";
import { getTelegram } from "./telegramClient";

export async function withTelegramSession(operation) {
  const releaseDistributedLock = await acquireDistributedSessionLock({
    timeoutMs: 45_000,
  });
  let telegram;

  try {
    telegram = await getTelegram();
    return await operation(telegram);
  } finally {
    if (telegram?.client?.connected) {
      await telegram.client.disconnect();
    }
    telegram?.releaseSessionLock?.();
    await releaseDistributedLock();
  }
}
