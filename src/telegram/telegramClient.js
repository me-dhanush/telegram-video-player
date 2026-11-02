require("dotenv").config();

const { TelegramClient, Api } = require("teleproto");
const { StringSession } = require("teleproto/sessions");
const { acquireSessionLock, releaseSessionLock } = require("./sessionLock");

console.log("TELEGRAM MODULE LOADED:", __filename);

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;

const stringSession = new StringSession(process.env.SESSION);
const telegramVideoCache =
  globalThis.__telegramVideoCache || (globalThis.__telegramVideoCache = new Map());

function createVideoLocation(message) {
  const document = message.media.document;

  return new Api.InputDocumentFileLocation({
    id: document.id,
    accessHash: document.accessHash,
    fileReference: document.fileReference,
    thumbSize: "",
  });
}

async function loadVideoCatalog(telegram) {
  const videos = [];

  for (const chat of telegram.chats) {
    let topics = [];
    try {
      const forumTopics = await telegram.client.invoke(
        new Api.messages.GetForumTopics({
          peer: chat.entity,
          q: "",
          offsetDate: 0,
          offsetId: 0,
          offsetTopic: 0,
          limit: 100,
        }),
      );
      topics = forumTopics.topics || [];
    } catch {
      // Regular group chats do not have forum topics.
      console.log(`No forum topics for ${chat.name}`);
    }

    for await (const message of telegram.client.iterMessages(chat.entity, {
      filter: new Api.InputMessagesFilterVideo(),
    })) {
      const document = message?.media?.document;
      if (!document?.mimeType?.startsWith("video/")) continue;

      const topicId = message.replyTo?.replyToMsgId;
      const topic = topics.find((item) => item.id === topicId);
      videos.push({
        id: message.id,
        telegramChatId: chat.id.toString(),
        chatName: chat.name,
        name: message.message || `Video ${message.id}`,
        messageText: message.message || "",
        topicId: `${chat.id}:${topicId ?? "main"}`,
        topicName: topic?.title || chat.name,
        telegramEntity: chat.entity,
        videoDocument: document,
        videoLocation: createVideoLocation(message),
      });
    }
  }

  telegram.videos = videos;
  telegram.videosLoaded = true;
  console.log(`🎥 Found ${videos.length} videos in recent messages`);
}

async function ensureVideoCatalog(telegram) {
  if (telegram.videosLoaded) return;

  if (!telegram.catalogPromise) {
    telegram.catalogPromise = loadVideoCatalog(telegram).finally(() => {
      telegram.catalogPromise = null;
    });
  }

  await telegram.catalogPromise;
}

async function createTelegram({ loadVideos = true } = {}) {
  console.log("Connecting to Telegram...");

  const releaseLocalSessionLock = acquireSessionLock();

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 3,
  });

  try {
    await client.connect();

    console.log("✅ Connected to Telegram");

    const dialogs = await client.getDialogs({});

    const chatNames = ["PW Classes", "Go classes"];
    const chats = chatNames.map((name) => {
      const dialog = dialogs.find((item) => item.name === name);
      if (!dialog) throw new Error(`Could not find ${name}`);
      console.log(`✅ Found ${name}:`, dialog.id.toString());
      return dialog;
    });

    const telegram = {
      client,
      chats,
      videos: [],
      videosLoaded: false,
      releaseSessionLock: releaseLocalSessionLock,

      // Used by video/route.js when refreshing a file reference.
      createVideoLocation,
    };

    if (loadVideos) await ensureVideoCatalog(telegram);
    return telegram;
  } catch (error) {
    if (client.connected) await client.disconnect().catch(() => {});
    releaseSessionLock();
    if (error.errorMessage === "AUTH_KEY_DUPLICATED" || error.code === 406) {
      throw new Error(
        "Telegram rejected this SESSION because it was used by another connection. Stop every app or script using it, then generate a fresh SESSION and set it in the environment.",
        { cause: error },
      );
    }
    throw error;
  }
}

// Keep the client and its startup/reconnect locks on globalThis so Next.js
// development module reloads do not create another client with the same key.
let telegramPromise = globalThis.__telegramPromise || null;

function startTelegram(options) {
  if (!telegramPromise) {
    telegramPromise = createTelegram(options).catch((error) => {
      telegramPromise = null;
      globalThis.__telegramPromise = null;
      throw error;
    });
    globalThis.__telegramPromise = telegramPromise;
  }

  return telegramPromise;
}

async function ensureTelegramConnected(client) {
  if (client.connected) return;

  if (!globalThis.__telegramReconnectPromise) {
    globalThis.__telegramReconnectPromise = client.connect().finally(() => {
      globalThis.__telegramReconnectPromise = null;
    });
  }

  await globalThis.__telegramReconnectPromise;
}

async function getTelegram({ loadVideos = true } = {}) {
  const telegram = await startTelegram({ loadVideos });

  if (!telegram.client.connected) {
    console.log("⚠️ Telegram disconnected. Reconnecting...");
    const releaseLocalSessionLock = acquireSessionLock();
    telegram.releaseSessionLock = releaseLocalSessionLock;
    try {
      await ensureTelegramConnected(telegram.client);
    } catch (error) {
      releaseLocalSessionLock();
      throw error;
    }

    console.log("✅ Telegram reconnected");
  }

  if (loadVideos) await ensureVideoCatalog(telegram);

  return telegram;
}

async function getTelegramVideo(telegram, messageId, telegramChatId) {
  if (telegram.videosLoaded) {
    return telegram.videos.find(
      (video) =>
        video.id === messageId &&
        (!telegramChatId || video.telegramChatId === telegramChatId),
    );
  }

  if (!telegramChatId) {
    await ensureVideoCatalog(telegram);
    return telegram.videos.find((video) => video.id === messageId);
  }

  const cacheKey = `${telegramChatId}:${messageId}`;
  const cachedVideo = telegramVideoCache.get(cacheKey);
  if (cachedVideo) {
    telegramVideoCache.delete(cacheKey);
    telegramVideoCache.set(cacheKey, cachedVideo);
    return cachedVideo;
  }

  const chat = telegram.chats.find(
    (item) => item.id.toString() === String(telegramChatId),
  );
  if (!chat) return undefined;

  const messages = await telegram.client.getMessages(chat.entity, {
    ids: [messageId],
  });
  const message = messages?.[0];
  const document = message?.media?.document;
  if (!document?.mimeType?.startsWith("video/")) return undefined;

  const topicId = message.replyTo?.replyToMsgId;
  const video = {
    id: message.id,
    telegramChatId: chat.id.toString(),
    chatName: chat.name,
    name: message.message || `Video ${message.id}`,
    messageText: message.message || "",
    topicId: `${chat.id}:${topicId ?? "main"}`,
    topicName: chat.name,
    telegramEntity: chat.entity,
    videoDocument: document,
    videoLocation: createVideoLocation(message),
  };

  telegramVideoCache.set(cacheKey, video);
  while (telegramVideoCache.size > 100) {
    telegramVideoCache.delete(telegramVideoCache.keys().next().value);
  }

  return video;
}

module.exports = {
  startTelegram,
  getTelegram,
  getTelegramVideo,
  ensureTelegramConnected,
};
