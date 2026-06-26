import TelegramBot from 'node-telegram-bot-api';
import config from '../../config/index.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('telegram');

let telegramBot = null;
let lastChatId = config.telegram.chatId || null;

function buildWelcomeMessage() {
  return [
    '👋 Welcome to SmartMail AI!',
    '',
    'Your AI Email Assistant is online.',
    '',
    'You will receive notifications about:',
    '• Internship opportunities',
    '• Academic deadlines',
    '• Important personal emails',
    '• Forms requiring action',
    '• Fee reminders',
  ].join('\n');
}

function buildHelpMessage() {
  return [
    'List available commands:',
    '',
    '/start - Welcome message',
    '/help - List available commands',
    '/ping - Health check',
  ].join('\n');
}

export function initTelegramBot({ mode = null } = {}) {
  if (telegramBot) {
    return telegramBot;
  }

  const token = config.telegram.botToken;

  if (!token) {
    log.fail('TELEGRAM_BOT_TOKEN missing. Bot will not start.');
    return null;
  }

  const resolvedNodeEnv = config.nodeEnv;
  const effectiveMode = mode || resolvedNodeEnv;
  const tokenLooksValid = /^\d{6,}:[\w-]{20,}$/.test(token);

  const usePolling = effectiveMode !== 'production' || !config.telegram.webhookUrl;

  log.info('Initializing Telegram Bot...');
  if (!tokenLooksValid) {
    log.warn('TELEGRAM_BOT_TOKEN does not look like a valid Telegram bot token');
  }

  try {
    const bot = new TelegramBot(token, { polling: false });

    bot.on('message', (msg) => {
      try {
        const chatId = msg?.chat?.id;
        const userId = msg?.from?.id;
        const text = msg?.text;

        if (chatId) {
          lastChatId = chatId;
        }
      } catch (e) {
        log.error(`Failed to log incoming message: ${e.message}`);
      }
    });

    bot.onText(/\/start(?:\s+.*)?/, (msg) => {
      const chatId = msg.chat.id;
      bot
        .sendMessage(chatId, buildWelcomeMessage())
        .catch((err) => log.error(`/start sendMessage error: ${err.message}`));
    });

    bot.onText(/\/help(?:\s+.*)?/, (msg) => {
      const chatId = msg.chat.id;
      bot
        .sendMessage(chatId, buildHelpMessage())
        .catch((err) => log.error(`/help sendMessage error: ${err.message}`));
    });

    bot.onText(/\/ping(?:\s+.*)?/, (msg) => {
      const chatId = msg.chat.id;
      bot
        .sendMessage(chatId, '🏓 Pong!\nBot is running.')
        .catch((err) => log.error(`/ping sendMessage error: ${err.message}`));
    });

    bot.on('polling_error', (error) => {
      log.error(`polling_error: ${error.message}`);
    });

    bot.on('webhook_error', (error) => {
      log.error(`webhook_error: ${error.message}`);
    });

    bot.on('error', (error) => {
      log.error(`bot error: ${error.message}`);
    });

    telegramBot = bot;
    log.ok('Telegram Bot initialized');

    if (usePolling) {
      bot
        .deleteWebhook()
        .then(() => bot.startPolling())
        .then(() => {
          log.info('Telegram polling started');
        })
        .catch((error) => {
          log.error(`Failed to start polling: ${error.message}`);
        });
    } else {
      bot
        .setWebhook(config.telegram.webhookUrl)
        .then(() => {
          log.info(`Telegram webhook configured: ${config.telegram.webhookUrl}`);
        })
        .catch((error) => {
          log.error(`Failed to configure webhook: ${error.message}`);
        });
    }

    return bot;
  } catch (err) {
    log.error(`Initialization failed: ${err.message}`);
    throw err;
  }
}

export function getTelegramBot() {
  return telegramBot;
}

export function getTelegramChatId() {
  return lastChatId;
}
