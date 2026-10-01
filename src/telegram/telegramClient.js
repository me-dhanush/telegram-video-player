require("dotenv").config();

const { TelegramClient, Api } = require("teleproto");
const { StringSession } = require("teleproto/sessions");

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION);

async function startTelegram() {
  console.log("Connecting to Telegram...");

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();
  console.log("✅ Connected to Telegram");

  const dialogs = await client.getDialogs({});
  const pwClasses = dialogs.find((dialog) => dialog.name === "PW Classes");

  if (!pwClasses) {
    throw new Error("Could not find PW Classes");
  }

  console.log("✅ Found PW Classes");
  console.log("Group ID:", pwClasses.id.toString());

  const messages = await client.getMessages(pwClasses.entity, { ids: [19] });

  const message = messages[0];

  if (!message || !message.media || !message.media.document) {
    throw new Error("Message 19 does not contain a video");
  }

  const videoDocument = message.media.document;

  console.log("🎥 Video found");
  console.log("Message ID:", message.id);
  console.log("Size:", videoDocument.size.toString());
  console.log("DC:", videoDocument.dcId);

  const videoLocation = new Api.InputDocumentFileLocation({
    id: videoDocument.id,
    accessHash: videoDocument.accessHash,
    fileReference: videoDocument.fileReference,
    thumbSize: "",
  });

  console.log("✅ Video location ready");

  return {
    client,
    videoDocument,
    videoLocation,
  };
}

module.exports = {
  startTelegram,
};
