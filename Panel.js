const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const config = require('./config');

class WebPanel {
  constructor(attackManager, config) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server);
    this.attackManager = attackManager;
    this.config = config.panel;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocket();
  }
  
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static('web-panel'));
    
    // Basic auth middleware
    this.app.use((req, res, next) => {
      if (!this.config.enabled) {
        return res.status(403).send('Panel disabled');
      }
      
      // IP whitelist check
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      if (this.config.whitelist.length > 0 && !this.config.whitelist.includes(clientIp)) {
        return res.status(403).send('IP not whitelisted');
      }
      
      // Password check for API routes
      if (req.path.startsWith('/api/')) {
        const auth = req.headers.authorization;
        if (!auth || auth !== `Bearer ${this.config.password}`) {
          return res.status(401).send('Unauthorized');
        }
      }
      
      next();
    });
  }
  
  setupRoutes() {
    // Panel homepage
    this.app.get('/', (req, res) => {
      res.sendFile(__dirname + '/web-panel/index.html');
    });
    
    // API endpoints
    this.app.get('/api/stats', (req, res) => {
      res.json(this.attackManager.getStats());
    });
    
    this.app.get('/api/attacks', (req, res) => {
      const attacks = [];
      // Convert Map to array
      this.attackManager.activeAttacks.forEach((attack, id) => {
        attacks.push({ id, ...attack });
      });
      res.json({ active: attacks, queued: this.attackManager.attackQueue });
    });
    
    this.app.post('/api/attack', (req, res) => {
      const { type, target, port, duration, threads, power } = req.body;
      
      const result = this.attackManager.launchAttack({
        type: type || 'http',
        target,
        port: parseInt(port) || 80,
        duration: parseInt(duration) || 60,
        threads: parseInt(threads) || 200,
        power: parseInt(power) || 100
      });
      
      res.json(result);
    });
    
    this.app.post('/api/attack/stop', (req, res) => {
      const { attackId } = req.body;
      const result = attackId ? 
        this.attackManager.stopAttack(attackId) : 
        this.attackManager.stopAllAttacks();
      res.json(result);
    });
  }
  
  setupSocket() {
    this.io.on('connection', (socket) => {
      console.log('Panel client connected');
      
      // Send initial stats
      socket.emit('stats', this.attackManager.getStats());
      
      // Listen for panel commands
      socket.on('launch_attack', (data) => {
        const result = this.attackManager.launchAttack(data);
        socket.emit('attack_launched', result);
      });
      
      socket.on('stop_attack', (attackId) => {
        const result = this.attackManager.stopAttack(attackId);
        socket.emit('attack_stopped', result);
      });
      
      socket.on('disconnect', () => {
        console.log('Panel client disconnected');
      });
    });
    
    // Broadcast stats updates
    setInterval(() => {
      this.io.emit('stats_update', this.attackManager.getStats());
    }, 5000);
  }
  
  start() {
    this.server.listen(this.config.port, () => {
      console.log(`Web panel running on port ${this.config.port}`);
      console.log(`Access: http://localhost:${this.config.port}`);
      console.log(`Password: ${this.config.password}`);
    });
  }
}

module.exports = (config, attackManager) => {
  if (!config.panel.enabled) {
    console.log('Web panel disabled in config');
    return;
  }
  
  const panel = new WebPanel(attackManager, config);
  panel.start();
};
