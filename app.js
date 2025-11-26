require('dotenv').config();
const { Telegraf } = require('telegraf');
const Database = require('./database');
const PriceService = require('./priceService');
const TradingEngine = require('./tradingEngine');
const BotHandlers = require('./botHandlers');

const BOT_TOKEN = process.env.BOT_TOKEN || '7670481860:AAGKOPXpw0Se76gjTgmyem6UbWkXqRK-T_c';

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

        // Handle text messages for conversation flow
        this.bot.on('text', (ctx) => this.handlers.handleTextMessage(ctx));
    }

    setupErrorHandling() {
        this.bot.catch((err, ctx) => {
            console.error('Bot error:', err);
            ctx.reply('❌ An error occurred. Please try again.');
        });
    }

    async start() {
        try {
            await this.bot.launch();
            console.log('🤖 Advanced Meme Coin Trading Bot is running!');
            console.log('🚀 Now with Pump.fun support!');
            console.log('✅ Bot started successfully!');
        } catch (error) {
            console.error('❌ Failed to start bot:', error.message);
            process.exit(1);
        }

        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }
}

const tradingBot = new MemeCoinTradingBot();
tradingBot.start();