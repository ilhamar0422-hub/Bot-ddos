{
  "name": "volox-ddos-bot",
  "version": "2.0.0",
  "description": "High-capacity DDoS bot for Telegram",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js",
    "start-panel": "node start-panel.js",
    "setup-termux": "bash termux-setup.sh",
    "test": "node tests/stress-test.js"
  },
  "dependencies": {
    "node-telegram-bot-api": "^0.61.0",
    "axios": "^1.6.0",
    "socket.io": "^4.7.2",
    "socket.io-client": "^4.7.2",
    "express": "^4.18.2",
    "net": "^1.0.2",
    "dns": "^0.2.2",
    "http": "^0.0.1-security",
    "https": "^1.0.0",
    "uuid": "^9.0.0",
    "chalk": "^4.1.2",
    "figlet": "^1.6.0",
    "ora": "^5.4.1",
    "inquirer": "^8.2.6",
    "cluster": "^0.7.7",
    "os": "^0.1.2"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
