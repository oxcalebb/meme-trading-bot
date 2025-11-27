require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const Database = require('./database');
const PriceService = require('./priceService');
const TradingEngine = require('./tradingEngine');
const BotHandlers = require('./botHandlers');

const BOT_TOKEN = process.env.BOT_TOKEN;

// Create web server for health checks
const webApp = express();
const PORT = 8080;  // Fly.io requires port 8080

// Health check endpoint
webApp.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Start web server - FIXED for Fly.io
webApp.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Health check server running on port 8080');
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
            console.log('🤖 Meme Coin Trading Bot is running on Fly.io!');
        } catch (error) {
            console.error('❌ Failed to start bot:', error);
        }
    }
}

const tradingBot = new MemeCoinTradingBot();
tradingBot.start();