require("dotenv").config();

const { TelegramClient, Api } = require("teleproto");
const { StringSession } = require("teleproto/sessions");
const { acquireSessionLock, releaseSessionLock } = require("./sessionLock");

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;

const stringSession = new StringSession(process.env.SESSION);
const telegramVideoCache =
  globalThis.__telegramVideoCache || (globalThis.__telegramVideoCache = new Map());
const telegramFileDcIds =
  globalThis.__telegramFileDcIds || (globalThis.__telegramFileDcIds = new Map());

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
  console.info(`[Telegram] Loaded ${videos.length} videos`);
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

async function loadTopicCatalog(telegram) {
  const topics = [];
  for (const chat of telegram.chats) {
    let forumTopics = [];
    try {
      const result = await telegram.client.invoke(
        new Api.messages.GetForumTopics({
          peer: chat.entity, q: "", offsetDate: 0, offsetId: 0,
          offsetTopic: 0, limit: 100,
        }),
      );
      forumTopics = result.topics || [];
    } catch {
      // Chats without forum topics have a single main topic.
    }

    if (forumTopics.length) {
      for (const topic of forumTopics) {
        topics.push({
          id: `${chat.id}:${topic.id}`,
          chatId: chat.id.toString(),
          chatName: chat.name,
          topicName: topic.title || chat.name,
          rootMessageId: topic.id,
        });
      }
    } else {
      topics.push({
        id: `${chat.id}:main`, chatId: chat.id.toString(),
        chatName: chat.name, topicName: chat.name, rootMessageId: null,
      });
    }
  }
  return topics;
}

function toVideo(chat, message, topicName = chat.name) {
  const document = message?.media?.document;
  if (!document?.mimeType?.startsWith("video/")) return null;
  return {
    id: message.id,
    telegramChatId: chat.id.toString(),
    chatName: chat.name,
    name: message.message || `Video ${message.id}`,
    messageText: message.message || "",
    date: message.date || 0,
    topicId: `${chat.id}:${message.replyTo?.replyToMsgId ?? "main"}`,
    topicName,
    telegramEntity: chat.entity,
    videoDocument: document,
    videoLocation: createVideoLocation(message),
  };
}

async function getVideosForTopic(telegram, topicId) {
  const [chatId, rootId] = String(topicId).split(":");
  const chat = telegram.chats.find((item) => item.id.toString() === chatId);
  if (!chat) return [];
  const topics = await loadTopicCatalog(telegram);
  const topic = topics.find((item) => item.id === String(topicId));
  if (!topic) return [];
  const videos = [];
  for await (const message of telegram.client.iterMessages(chat.entity, {
    filter: new Api.InputMessagesFilterVideo(),
    ...(rootId !== "main" ? { replyTo: Number(rootId) } : {}),
  })) {
    const video = toVideo(chat, message, topic.topicName);
    if (video) {
      video.topicId = topic.id;
      videos.push(video);
    }
  }
  return videos;
}

async function getRecentVideos(telegram, limit = 10) {
  const recent = [];
  for (const chat of telegram.chats) {
    let count = 0;
    for await (const message of telegram.client.iterMessages(chat.entity, {
      filter: new Api.InputMessagesFilterVideo(), limit,
    })) {
      const video = toVideo(chat, message);
      if (video) {
        recent.push(video);
        count += 1;
        if (count >= limit) break;
      }
    }
  }
  return recent.sort((a, b) => Number(b.date) - Number(a.date)).slice(0, limit);
}

async function getTelegramThumbnail(telegram, messageId, telegramChatId) {
  const video = await getTelegramVideo(telegram, Number(messageId), telegramChatId);
  const thumbs = video?.videoDocument?.thumbs || [];
  const thumb = [...thumbs].reverse().find((item) => item?.type);
  if (!video || !thumb) return null;

  const location = new Api.InputDocumentFileLocation({
    id: video.videoDocument.id,
    accessHash: video.videoDocument.accessHash,
    fileReference: video.videoDocument.fileReference,
    thumbSize: thumb.type,
  });
  const request = new Api.upload.GetFile({
    location,
    offset: 0,
    limit: 512 * 1024,
    precise: true,
  });
  const fileKey = video.videoDocument.id.toString();
  let dcId = telegramFileDcIds.get(fileKey) ?? video.videoDocument.dcId;
  let result;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      result = await telegram.client.invoke(request, dcId);
      break;
    } catch (error) {
      const migratedDc = typeof error?.newDc === "number"
        ? error.newDc
        : Number(error?.errorMessage?.match(/^FILE_MIGRATE_(\d+)$/)?.[1]);
      if (!Number.isInteger(migratedDc) || migratedDc <= 0 || migratedDc === dcId) {
        throw error;
      }
      dcId = migratedDc;
      telegramFileDcIds.set(fileKey, dcId);
      console.info(`[Telegram] Thumbnail file moved to DC ${dcId}; retrying`);
    }
  }
  if (!result) throw new Error("Telegram thumbnail DC migration retries exhausted");
  return {
    bytes: Buffer.from(result.bytes),
    mimeType: "image/jpeg",
  };
}

async function createTelegram({ loadVideos = true } = {}) {
  console.info("[Telegram] Connecting...");

  const releaseLocalSessionLock = acquireSessionLock();

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 3,
  });

  try {
    await client.connect();

    console.info("[Telegram] Connected");

    const dialogs = await client.getDialogs({});

    const chatNames = ["PW Classes", "Go classes"];
    const chats = chatNames.map((name) => {
      const dialog = dialogs.find((item) => item.name === name);
      if (!dialog) throw new Error(`Could not find ${name}`);
      console.info(`[Telegram] Found chat: ${name} (${dialog.id})`);
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
    console.warn("[Telegram] Disconnected; reconnecting...");
    const releaseLocalSessionLock = acquireSessionLock();
    telegram.releaseSessionLock = releaseLocalSessionLock;
    try {
      await ensureTelegramConnected(telegram.client);
    } catch (error) {
      releaseLocalSessionLock();
      throw error;
    }

    console.info("[Telegram] Reconnected");
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
  loadTopicCatalog,
  getVideosForTopic,
  getRecentVideos,
  getTelegramThumbnail,
};
