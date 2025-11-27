require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const Database = require('./database');
const PriceService = require('./priceService');
const TradingEngine = require('./tradingEngine');
const BotHandlers = require('./botHandlers');

const BOT_TOKEN = process.env.BOT_TOKEN;

// Validate environment variables
if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required');
    process.exit(1);
}

// Create web server for health checks
const webApp = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
webApp.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        message: 'Meme Trading Bot is running!'
    });
});

// Root endpoint
webApp.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Meme Trading Bot</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .status { color: green; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>🤖 Meme Trading Bot</h1>
                <p class="status">✅ Bot is running successfully!</p>
                <p>Uptime: ${Math.floor(process.uptime())} seconds</p>
                <p>Go to Telegram to start trading!</p>
            </body>
        </html>
    `);
});

// Start web server
webApp.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

// Bot class
class MemeCoinTradingBot {
    constructor() {
        console.log('🚀 Initializing Meme Coin Trading Bot...');
        this.bot = new Telegraf(BOT_TOKEN);
        this.db = new Database();
        this.priceService = new PriceService();
        this.tradingEngine = new TradingEngine(this.db, this.priceService);
        this.handlers = new BotHandlers(this.tradingEngine, this.priceService);

        this.setupCommands();
        this.setupErrorHandling();
        console.log('✅ Bot initialized successfully');
    }

    setupCommands() {
        // Clear any existing menus and set our commands
        this.bot.telegram.setMyCommands([
            { command: 'start', description: 'Start trading' },
            { command: 'buy', description: 'Buy tokens' },
            { command: 'sell', description: 'Sell positions' },
            { command: 'positions', description: 'View portfolio' },
            { command: 'deposit', description: 'Deposit SOL' },
            { command: 'withdraw', description: 'Withdraw SOL' },
            { command: 'settings', description: 'Bot settings' },
            { command: 'refresh', description: 'Refresh portfolio' },
            { command: 'analyze', description: 'Analyze token' },
            { command: 'status', description: 'Check bot status' }
        ]);

        // Command handlers
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

        // Text message handler for conversation flow
        this.bot.on('text', (ctx) => this.handlers.handleTextMessage(ctx));
    }

    setupErrorHandling() {
        this.bot.catch((err, ctx) => {
            console.error('Bot error:', err);
            if (ctx) {
                ctx.reply('❌ An error occurred. Please try again.');
            }
        });

        // Global error handlers
        process.on('uncaughtException', (error) => {
            console.error('🆘 Uncaught Exception:', error);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('🆘 Unhandled Rejection at:', promise, 'reason:', reason);
        });
    }

    handleStatus(ctx) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        ctx.reply(
            `🤖 Bot Status:\n\n` +
            `✅ Online and Healthy\n` +
            `🕒 Uptime: ${hours}h ${minutes}m ${seconds}s\n` +
            `💾 Memory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB\n` +
            `☁️ Host: Fly.io\n` +
            `🚀 Ready to trade!`
        );
    }

    async start() {
        try {
            console.log('🚀 Launching bot...');
            await this.bot.launch({
                dropPendingUpdates: true,
                allowedUpdates: ['message', 'callback_query']
            });

            console.log('🤖 Meme Coin Trading Bot is running!');
            console.log('🚀 Now with 24/7 health checks!');
            console.log('✅ Bot started successfully!');

            // Periodic health logging
            setInterval(() => {
                const memoryUsage = process.memoryUsage();
                console.log('❤️ Health Check - Bot is running:', {
                    uptime: Math.floor(process.uptime()),
                    memory: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB'
                });
            }, 600000); // 10 minutes

        } catch (error) {
            console.error('❌ Failed to start bot:', error.message);
            process.exit(1);
        }

        // Graceful shutdown
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }
}

// Start the application
console.log('🎯 Starting Meme Trading Bot with Health Checks...');
console.log('📦 Node.js version:', process.version);

const tradingBot = new MemeCoinTradingBot();
tradingBot.start();