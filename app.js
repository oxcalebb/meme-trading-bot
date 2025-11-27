require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const Database = require('./database');
const PriceService = require('./priceService');
const TradingEngine = require('./tradingEngine');
const BotHandlers = require('./botHandlers');

// YOUR BOT TOKEN HARDCODED
const BOT_TOKEN = '7670481860:AAGKOPXpw0Se76gjTgmyem6UbWkXqRK-T_c';

// Create web server for health checks
const app = express();
const PORT = 8080;

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.send('🤖 Meme Trading Bot is running!');
});

// START SERVER
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});

class MemeCoinTradingBot {
    constructor() {
        this.bot = new Telegraf(BOT_TOKEN);
        this.db = new Database();
        this.priceService = new PriceService();
        this.tradingEngine = new TradingEngine(this.db, this.priceService);
        this.handlers = new BotHandlers(this.tradingEngine, this.priceService);

        this.setupCommands();
        this.setupErrorHandling();
    }

    setupCommands() {
        this.bot.start((ctx) => this.handlers.handleStart(ctx));
        this.bot.command('buy', (ctx) => this.handlers.handleBuy(ctx));
        this.bot.command('sell', (ctx) => this.handlers.handleSell(ctx));
        this.bot.command('positions', (ctx) => this.handlers.handlePositions(ctx));
        this.bot.command('deposit', (ctx) => this.handlers.handleDeposit(ctx));
        this.bot.command('withdraw', (ctx) => this.handlers.handleWithdraw(ctx));
        this.bot.command('settings', (ctx) => this.handlers.handleSettings(ctx));
        this.bot.command('refresh', (ctx) => this.handlers.handleRefresh(ctx));
        this.bot.command('analyze', (ctx) => this.handlers.handleAnalyze(ctx));
        this.bot.command('status', (ctx) => this.handleStatus(ctx));

        this.bot.on('text', (ctx) => this.handlers.handleTextMessage(ctx));
    }

    setupErrorHandling() {
        this.bot.catch((err, ctx) => {
            console.error('Bot error:', err);
            if (ctx) ctx.reply('❌ An error occurred. Please try again.');
        });
    }

    handleStatus(ctx) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        ctx.reply(`🤖 Bot Status:\n✅ Online\n🕒 Uptime: ${hours}h ${minutes}m ${seconds}s`);
    }

    async start() {
        try {
            await this.bot.launch();
            console.log('🤖 Meme Coin Trading Bot is running!');
        } catch (error) {
            console.error('❌ Failed to start bot:', error);
        }
    }
}

// Start the bot
console.log('🚀 Starting bot...');
const tradingBot = new MemeCoinTradingBot();
tradingBot.start();