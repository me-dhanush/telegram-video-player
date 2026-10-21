require("dotenv").config();

const { TelegramClient, Api } = require("teleproto");
const { StringSession } = require("teleproto/sessions");
const { acquireSessionLock, releaseSessionLock } = require("./sessionLock");

console.log("TELEGRAM MODULE LOADED:", __filename);

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;

const stringSession = new StringSession(process.env.SESSION);

function createVideoLocation(message) {
  const document = message.media.document;

  return new Api.InputDocumentFileLocation({
    id: document.id,
    accessHash: document.accessHash,
    fileReference: document.fileReference,
    thumbSize: "",
  });
}

async function createTelegram() {
  console.log("Connecting to Telegram...");

  acquireSessionLock();

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 3,
  });

  try {
    await client.connect();
  } catch (error) {
    releaseSessionLock();
    if (error.errorMessage === "AUTH_KEY_DUPLICATED" || error.code === 406) {
      throw new Error(
        "Telegram rejected this SESSION because it was used by another connection. Stop every app or script using it, then generate a fresh SESSION and set it in the environment.",
        { cause: error },
      );
    }
    throw error;
  }

  console.log("✅ Connected to Telegram");

  const dialogs = await client.getDialogs({});

  const pwClasses = dialogs.find((dialog) => dialog.name === "PW Classes");

  if (!pwClasses) {
    throw new Error("Could not find PW Classes");
  }

  console.log("✅ Found PW Classes");
  console.log("Group ID:", pwClasses.id.toString());

  const forumTopics = await client.invoke(
    new Api.messages.GetForumTopics({
      peer: pwClasses.entity,
      q: "",
      offsetDate: 0,
      offsetId: 0,
      offsetTopic: 0,
      limit: 100,
    }),
  );

  console.log("📚 Forum topics found:", forumTopics.topics.length);

  forumTopics.topics.forEach((topic) => {
    console.log("📁 TOPIC:", topic.id, topic.title);
  });

  const allMessages = [];

  // Ask Telegram to filter server-side so cold starts don't download and
  // inspect every text/photo message in the chat.
  for await (const message of client.iterMessages(pwClasses.entity, {
    filter: new Api.InputMessagesFilterVideo(),
  })) {
    allMessages.push(message);
  }

  console.log(`📨 Total Telegram messages fetched: ${allMessages.length}`);

  const videos = allMessages
    .filter(
      (message) =>
        message &&
        message.media &&
        message.media.document &&
        message.media.document.mimeType &&
        message.media.document.mimeType.startsWith("video/"),
    )
    .map((message) => {
      const topicId = message.replyTo?.replyToMsgId;

      const topic = forumTopics.topics.find((topic) => topic.id === topicId);

      console.log("VIDEO TOPIC:", message.id, topicId, topic?.title);

      return {
        id: message.id,
        telegramChatId: pwClasses.id.toString(),
        name: message.message || `Video ${message.id}`,
        topicId,
        topicName: topic?.title || `Topic ${topicId}`,
        videoDocument: message.media.document,
        videoLocation: createVideoLocation(message),
      };
    });

  console.log(`🎥 Found ${videos.length} videos in recent messages`);

  return {
    client,
    videos,

    // We keep the actual Telegram entity so that
    // we can fetch a fresh message later.
    telegramEntity: pwClasses.entity,

    telegramChatId: pwClasses.id.toString(),

    // Used by video/route.js when refreshing a file reference.
    createVideoLocation,
  };
}

// Keep the client and its startup/reconnect locks on globalThis so Next.js
// development module reloads do not create another client with the same key.
let telegramPromise = globalThis.__telegramPromise || null;

function startTelegram() {
  if (!telegramPromise) {
    telegramPromise = createTelegram().catch((error) => {
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

async function getTelegram() {
  const telegram = await startTelegram();

  if (!telegram.client.connected) {
    console.log("⚠️ Telegram disconnected. Reconnecting...");
    await ensureTelegramConnected(telegram.client);

    console.log("✅ Telegram reconnected");
  }

  return telegram;
}

module.exports = {
  startTelegram,
  getTelegram,
  ensureTelegramConnected,
};
