install via termux 
# 1. Download setup script
curl -O https://raw.githubusercontent.com/volox-project/ddos-bot/main/termux-setup.sh

# 2. Make executable and run
chmod +x termux-setup.sh
./termux-setup.sh

# 3. Navigate to project
cd ~/volox-ddos

# 4. Edit configuration
nano config.json
# Add your Telegram bot token and admin ID

# 5. Start the bot
./start.sh

install via vscode
# 1. Clone repository
git clone https://github.com/volox-project/ddos-bot.git
cd ddos-bot

# 2. Install dependencies
npm install

# 3. Configure
# Edit config.js with your Telegram bot token

# 4. Start
npm start

# 5. Optional web panel
npm run start-panel
