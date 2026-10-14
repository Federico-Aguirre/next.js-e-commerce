import { readFile } from 'node:fs/promises';

async function readBotToken() {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  for (const path of ['.env.local', '.env']) {
    try {
      const content = await readFile(path, 'utf8');
      const match = content.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m);
      if (match?.[1]) {
        return match[1].trim().replace(/^(['\"])|(['\"])$/g, '');
      }
    } catch {
      // Ignore missing env files.
    }
  }

  return null;
}

const token = await readBotToken();
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
}

const webhookResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const webhook = (await webhookResponse.json()) as {
  ok?: boolean;
  result?: { url?: string };
  description?: string;
};

if (!webhookResponse.ok || !webhook.ok) {
  throw new Error(
    `Telegram API validation failed: ${webhook.description ?? webhookResponse.status}`,
  );
}

if (webhook.result?.url) {
  throw new Error(
    'Telegram webhook is configured. Disable it before using getUpdates for this setup script.',
  );
}

const updatesResponse = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`);
const updates = (await updatesResponse.json()) as {
  ok?: boolean;
  result?: Array<{
    message?: { text?: string; chat?: { id?: number | string } };
  }>;
  description?: string;
};

if (!updatesResponse.ok || !updates.ok) {
  throw new Error(`Telegram getUpdates failed: ${updates.description ?? updatesResponse.status}`);
}

const startMessage = [...(updates.result ?? [])]
  .reverse()
  .find(
    (update) =>
      update.message?.text?.trim().startsWith('/start') && update.message.chat?.id !== undefined,
  );

if (startMessage?.message?.chat?.id === undefined) {
  console.info(
    'No /start message found. Open the bot in Telegram, press Start, then run this command again.',
  );
  process.exit(0);
}

console.info(`TELEGRAM_CHAT_ID=${startMessage.message.chat.id}`);
