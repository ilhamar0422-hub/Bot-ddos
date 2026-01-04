#!/data/data/com.termux/files/usr/bin/bash
# VOLOX-DDoS Termux Setup Script

echo -e "\033[1;31m"
echo "╔══════════════════════════════════════════════════╗"
echo "║           VOLOX-DDoS Termux Setup                ║"
echo "║          5000+ Capacity Optimization             ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "\033[0m"

# Update and upgrade
echo "[*] Updating packages..."
pkg update -y && pkg upgrade -y

# Install required packages
echo "[*] Installing dependencies..."
pkg install -y nodejs python python-pip git clang libffi openssl libxml2 libxslt

# Install Node.js modules
echo "[*] Installing Node.js modules..."
npm install -g npm@latest
npm install -g node-gyp
npm install -g pm2

# Install Python modules
echo "[*] Installing Python modules..."
pip install --upgrade pip
pip install requests beautifulsoup4

# Increase system limits
echo "[*] Increasing system limits..."
echo "ulimit -n 100000" >> ~/.bashrc
echo "ulimit -u 100000" >> ~/.bashrc

# Optimize TCP settings
echo "[*] Optimizing TCP settings..."
cat > ~/tcp-optimize.sh << EOF
#!/bin/bash
echo 100000 > /proc/sys/fs/file-max
echo 10000 > /proc/sys/net/core/somaxconn
echo 0 > /proc/sys/net/ipv4/tcp_syncookies
echo 10000 > /proc/sys/net/ipv4/tcp_max_syn_backlog
echo 1 > /proc/sys/net/ipv4/tcp_tw_reuse
echo 1 > /proc/sys/net/ipv4/tcp_tw_recycle
echo 30 > /proc/sys/net/ipv4/tcp_fin_timeout
echo 1024 65535 > /proc/sys/net/ipv4/ip_local_port_range
EOF

chmod +x ~/tcp-optimize.sh
~/tcp-optimize.sh

# Create project directory
echo "[*] Setting up project directory..."
mkdir -p ~/volox-ddos
cd ~/volox-ddos

# Clone repository if available, otherwise create structure
if [ -d ".git" ]; then
    echo "[*] Updating existing repository..."
    git pull
else
    echo "[*] Initializing project structure..."
    mkdir -p {attacks,commands,lib,utils,data,web-panel}
    
    # Create essential files
    echo '{"userAgents": [], "proxies": [], "payloads": []}' > data/user-agents.json
    echo '{"token": "", "adminIds": []}' > config.json
fi

# Install project dependencies
echo "[*] Installing project dependencies..."
if [ -f "package.json" ]; then
    npm install
else
    npm init -y
    npm install node-telegram-bot-api axios socket.io express net dns http https uuid chalk figlet ora inquirer
fi

# Create startup script
echo "[*] Creating startup scripts..."
cat > start.sh << 'EOF'
#!/bin/bash
clear
echo -e "\033[1;31m"
cat << "ART"
╦  ╦╔═╗╦  ╔═╗╔═╗  ╔╦╗╔═╗╔═╗
║  ║╠═╝║  ║╣ ║╣    ║║║ ║║ ║
╩═╝╩╩  ╩═╝╚═╝╚═╝  ═╩╝╚═╝╚═╝
ART
echo -e "\033[0m"
echo "VOLOX-DDoS Bot - Termux Edition"
echo "Starting with optimized settings..."
ulimit -n 100000
ulimit -u 100000
node bot.js
EOF

chmod +x start.sh

# Create panel script
cat > start-panel.sh << 'EOF'
#!/bin/bash
clear
echo -e "\033[1;36m"
echo "Starting Web Panel on port 3000..."
echo -e "\033[0m"
node start-panel.js
EOF

chmod +x start-panel.sh

# Performance test script
cat > test-performance.sh << 'EOF'
#!/bin/bash
echo "Testing system performance..."
echo "CPU Cores: $(nproc)"
echo "Memory: $(free -h | awk '/^Mem:/ {print $2}')"
echo "Open files limit: $(ulimit -n)"
echo "User processes limit: $(ulimit -u)"
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
EOF

chmod +x test-performance.sh

echo "[+] Setup complete!"
echo ""
echo -e "\033[1;32m[USAGE]\033[0m"
echo "1. Edit config.json with your Telegram bot token"
echo "2. Run: ./start.sh"
echo "3. Web Panel: ./start-panel.sh"
echo "4. Performance test: ./test-performance.sh"
echo ""
echo -e "\033[1;33m[NOTES]\033[0m"
echo "- Bot token: Get from @BotFather on Telegram"
echo "- Admin ID: Use /id command with @userinfobot"
echo "- Max capacity: 5000 concurrent attacks"
echo "- Monitor with: pm2 monit"
echo ""
echo -e "\033[1;31m[WARNING]\033[0m"
echo "For educational purposes only. Use responsibly."
