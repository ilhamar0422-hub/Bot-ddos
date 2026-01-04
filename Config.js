module.exports = {
  // Telegram Bot Configuration
  telegram: {
    token: process.env.BOT_TOKEN || "YOUR_TELEGRAM_BOT_TOKEN",
    adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : ["YOUR_USER_ID"],
    polling: true,
    webhook: false
  },
  
  // Attack Configuration
  attack: {
    maxConcurrent: 5000,
    maxDuration: 3600, // seconds
    defaultThreads: 200,
    defaultSockets: 25,
    autoRestart: true,
    queueSize: 10000
  },
  
  // Network Configuration
  network: {
    timeout: 5000,
    retries: 3,
    useProxies: false,
    proxyFile: "./data/proxies.json",
    dnsCache: true
  },
  
  // System Configuration
  system: {
    logLevel: "info",
    saveLogs: true,
    maxMemory: "2gb",
    checkInterval: 5000
  },
  
  // Web Panel Configuration (Optional)
  panel: {
    enabled: false,
    port: 3000,
    password: "volox2024",
    whitelist: ["127.0.0.1"]
  }
};
