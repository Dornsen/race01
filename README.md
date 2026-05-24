# 🎮 Card Battle Game

A multiplayer online card game with real-time battle system, social features, and marketplace.

## 🚀 Quick Start

### Requirements
- Node.js >= 14
- MySQL >= 5.7

### Installation & Setup

1. **Install dependencies:**
```bash
cd server
npm install
```

2. **Create `.env` file in the `server/` folder**

Create a file named `.env` in the `server` directory with the following content:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=KIRIdatabase

# Server Configuration
PORT=3000

# Mail Configuration (optional)
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password

```

3. **Start the server:**

**Development mode** (with auto-restart):
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

4. **Open in your browser:**
```
http://localhost:3000
```

## 📝 .env Variables Explained

| Variable | Description | Example |
|---|---|---|
| `DB_HOST` | MySQL server address | `localhost` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | `password123` |
| `DB_NAME` | Database name | `KIRIdatabase` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `MAIL_SERVICE` | Email service provider | `gmail` |
| `MAIL_USER` | Email address for sending mails | `your_email@gmail.com` |
| `MAIL_PASS` | Email app password | `xxxx xxxx xxxx xxxx` |
| `GAME_SECRET` | Secret key for game sessions | `any_random_string` |

## 📁 Project Structure

```
.
├── client/              # Frontend application
├── server/              # Backend application
│   ├── .env             # Environment variables (CREATE THIS FILE)
│   ├── server.js        # Main server file
│   ├── package.json     # Dependencies
│   ├── config/          # Configuration files
│   ├── controllers/     # Business logic
│   ├── game/            # Game logic
│   ├── migrations/      # Database migrations
│   └── sockets/         # WebSocket handlers
└── database/            # Database
    └── init.sql         # Database schema
```

## 🎯 Features

- Real-time PvP battles via WebSockets
- Deck building system
- Daily quests and rewards
- Marketplace with cards and emotes
- Leaderboard and rankings
- Match history
- Friends system
- News feed
