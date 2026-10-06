require("dotenv").config();

const { TelegramClient } = require("teleproto");
const { StringSession } = require("teleproto/sessions");

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
});

async function main() {
  await client.start({
    phoneNumber: async () => {
      return await new Promise((resolve) => {
        process.stdout.write("Enter your phone number: ");
        process.stdin.once("data", (data) => resolve(data.toString().trim()));
      });
    },

    password: async () => {
      return await new Promise((resolve) => {
        process.stdout.write("Enter your 2FA password: ");
        process.stdin.once("data", (data) => resolve(data.toString().trim()));
      });
    },

    phoneCode: async () => {
      return await new Promise((resolve) => {
        process.stdout.write("Enter the Telegram code: ");
        process.stdin.once("data", (data) => resolve(data.toString().trim()));
      });
    },

    onError: (error) => {
      console.log(error);
    },
  });

  console.log("\n=================================");
  console.log("NEW SESSION:");
  console.log(client.session.save());
  console.log("=================================\n");

  await client.disconnect();
}

main();
