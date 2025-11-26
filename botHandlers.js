class BotHandlers {
    constructor(tradingEngine, priceService) {
        this.trading = tradingEngine;
        this.priceService = priceService;
        this.userStates = new Map();
    }

    async handleStart(ctx) {
        const user = this.trading.db.getOrCreateUser(ctx.from.id);

        const welcomeMessage =
            `🎮 Welcome to Advanced Meme Coin Trading Bot!\n\n` +
            `💰 Starting Balance: ${user.demoBalance.SOL} SOL\n\n` +
            `📋 Available Commands:\n` +
            `/buy - Buy tokens by CA (Supports Pump.fun!)\n` +
            `/sell - Sell your positions\n` +
            `/positions - View your portfolio\n` +
            `/deposit - Add SOL to balance\n` +
            `/withdraw - Remove SOL from balance\n` +
            `/settings - Configure bot settings\n` +
            `/refresh - Update portfolio prices\n` +
            `/analyze - Analyze Pump.fun token\n\n` +
            `💡 Supports DexScreener, Pump.fun, and GeckoTerminal tokens!`;

        await ctx.reply(welcomeMessage);
    }

    async handleBuy(ctx) {
        const userId = ctx.from.id;

        await ctx.reply(
            `🛒 Buy Token\n\n` +
            `Please enter the token Contract Address (CA):\n\n` +
            `📱 Supported Platforms:\n` +
            `• Pump.fun 🚀\n` +
            `• DexScreener\n` +
            `• Raydium\n` +
            `• Orca\n\n` +
            `📝 Paste the CA below:`
        );

        this.userStates.set(userId, { action: 'awaiting_ca' });
    }

    async handleAnalyze(ctx) {
        await ctx.reply(
            `🔍 Analyze Pump.fun Token\n\n` +
            `Enter the Pump.fun token Contract Address for detailed analysis:`
        );
        this.userStates.set(ctx.from.id, { action: 'awaiting_analysis_ca' });
    }

    // Update the CA input handler with improved error messages
    async handleCAInput(ctx, ca) {
        try {
            if (ca.length < 32 || !this.isValidSolanaAddress(ca)) {
                throw new Error('Invalid Solana contract address format. Please check and try again.');
            }

            await ctx.reply('🔍 Verifying token across multiple platforms...');

            const tokenInfo = await this.trading.startBuyProcess(ctx.from.id, ca);

            let tokenMessage = `✅ Token Verified on ${tokenInfo.source.toUpperCase()}!\n\n`;

            tokenMessage += `🪙 ${tokenInfo.name} (${tokenInfo.symbol})\n`;
            tokenMessage += `💰 Price: $${tokenInfo.price.toFixed(8)}\n`;
            tokenMessage += `🏢 Market Cap: $${this.formatNumber(tokenInfo.marketCap)}\n`;

            if (tokenInfo.volume > 0) {
                tokenMessage += `📊 24h Volume: $${this.formatNumber(tokenInfo.volume)}\n`;
            }

            if (tokenInfo.liquidity > 0) {
                tokenMessage += `💧 Liquidity: $${this.formatNumber(tokenInfo.liquidity)}\n`;
            }

            if (tokenInfo.priceChange !== 0) {
                tokenMessage += `📈 24h Change: ${tokenInfo.priceChange.toFixed(2)}%\n`;
            }

            // Add Pump.fun specific info
            if (tokenInfo.source === 'pump.fun') {
                tokenMessage += `🚀 **Pump.fun Token**\n`;
                if (tokenInfo.bondCurvePrice) {
                    tokenMessage += `📊 Bond Curve: $${tokenInfo.bondCurvePrice.toFixed(8)}\n`;
                }

                // Add quick analysis
                try {
                    const analysis = await this.trading.analyzePumpFunToken(ca);
                    if (analysis.analysis) {
                        tokenMessage += `\n${analysis.analysis}\n`;
                    }
                } catch (analysisError) {
                    // Skip analysis if it fails
                }
            }

            tokenMessage += `\n💎 Enter the amount of SOL to invest:`;

            await ctx.reply(tokenMessage);
            this.userStates.set(ctx.from.id, { action: 'awaiting_buy_amount' });

        } catch (error) {
            let errorMessage = `❌ Token verification failed: ${error.message}\n\n`;
            errorMessage += `💡 Possible reasons:\n`;
            errorMessage += `• Token is too new (wait 5-10 minutes)\n`;
            errorMessage += `• No liquidity on DEXs\n`;
            errorMessage += `• Invalid contract address\n`;
            errorMessage += `• API temporarily unavailable\n\n`;
            errorMessage += `🔄 Try again in a few minutes or use a different token.`;

            await ctx.reply(errorMessage);
            this.userStates.delete(ctx.from.id);
        }
    }

    // Add analysis handler
    async handleAnalysisCA(ctx, ca) {
        try {
            if (ca.length < 32 || !this.isValidSolanaAddress(ca)) {
                throw new Error('Invalid Solana contract address format. Please check and try again.');
            }

            await ctx.reply('🔍 Analyzing Pump.fun token...');

            const analysis = await this.trading.analyzePumpFunToken(ca);

            let analysisMessage = `📊 Pump.fun Token Analysis\n\n`;
            analysisMessage += `🪙 ${analysis.tokenInfo.name} (${analysis.tokenInfo.symbol})\n`;
            analysisMessage += `📍 CA: ${ca.substring(0, 12)}...\n\n`;
            analysisMessage += `💰 Price: $${analysis.tokenInfo.price.toFixed(8)}\n`;
            analysisMessage += `🏢 Market Cap: $${this.formatNumber(analysis.tokenInfo.marketCap)}\n`;
            analysisMessage += `💧 Liquidity: $${this.formatNumber(analysis.tokenInfo.liquidity)}\n\n`;

            if (analysis.analysis) {
                analysisMessage += `${analysis.analysis}\n\n`;
            }

            analysisMessage += `🛒 Use /buy to purchase this token`;

            await ctx.reply(analysisMessage);
            this.userStates.delete(ctx.from.id);

        } catch (error) {
            let errorMessage = `❌ Analysis failed: ${error.message}\n\n`;
            errorMessage += `💡 Possible reasons:\n`;
            errorMessage += `• Token not found on Pump.fun\n`;
            errorMessage += `• Token is too new\n`;
            errorMessage += `• API temporarily unavailable\n\n`;
            errorMessage += `🔄 Try a different token or check the contract address.`;

            await ctx.reply(errorMessage);
            this.userStates.delete(ctx.from.id);
        }
    }

    // Update positions display to show source
    async handlePositions(ctx) {
        const user = this.trading.db.getUser(ctx.from.id);
        if (!user) {
            await ctx.reply('❌ Please start with /start first');
            return;
        }

        const portfolio = await this.trading.refreshPortfolio(ctx.from.id);

        let message = `📊 Your Portfolio\n\n`;
        message += `💎 SOL Balance: ${portfolio.balance.toFixed(2)}\n`;
        message += `🏦 Total Value: ${portfolio.totalValue.toFixed(2)} SOL\n\n`;

        if (portfolio.positions.length === 0) {
            message += `📭 No active positions.\n💸 Use /buy to start trading!`;
        } else {
            portfolio.positions.forEach(position => {
                const sourceIcon = position.isPumpFun ? '🚀' : '🔄';
                message += `${sourceIcon} ${position.tokenName}\n`;
                message += `   📍 CA: ${position.tokenCA.substring(0, 12)}...\n`;
                message += `   📦 Amount: ${position.amount.toFixed(2)}\n`;
                message += `   💰 Avg Price: $${position.buyPrice.toFixed(8)}\n`;
                message += `   📈 Current: $${position.currentPrice.toFixed(8)}\n`;
                message += `   🏢 Market Cap: $${this.formatNumber(position.marketCap)}\n`;

                if (position.volume > 0) {
                    message += `   📊 Volume: $${this.formatNumber(position.volume)}\n`;
                }

                const pnlIcon = position.pnl >= 0 ? '🟢' : '🔴';
                message += `   ${pnlIcon} P&L: ${position.pnl.toFixed(2)} SOL (${position.pnlPercent.toFixed(2)}%)\n\n`;
            });
        }

        await ctx.reply(message);
    }

    async handleDeposit(ctx) {
        await ctx.reply(
            `💰 Deposit SOL\n\n` +
            `Enter the amount of SOL to deposit:\n\n` +
            `💡 Current balance: ${this.trading.db.getOrCreateUser(ctx.from.id).demoBalance.SOL} SOL`
        );
        this.userStates.set(ctx.from.id, { action: 'awaiting_deposit' });
    }

    async handleWithdraw(ctx) {
        const user = this.trading.db.getOrCreateUser(ctx.from.id);
        await ctx.reply(
            `💰 Withdraw SOL\n\n` +
            `Enter the amount of SOL to withdraw:\n\n` +
            `💡 Available: ${user.demoBalance.SOL} SOL`
        );
        this.userStates.set(ctx.from.id, { action: 'awaiting_withdraw' });
    }

    async handleSettings(ctx) {
        const user = this.trading.db.getOrCreateUser(ctx.from.id);

        const settingsMessage =
            `⚙️ Bot Settings\n\n` +
            `Auto Refresh: ${user.settings.autoRefresh ? '✅ On' : '❌ Off'}\n` +
            `Notifications: ${user.settings.notifications ? '✅ On' : '❌ Off'}\n\n` +
            `🔧 Use buttons to toggle settings (coming soon)`;

        await ctx.reply(settingsMessage);
    }

    async handleRefresh(ctx) {
        await ctx.reply('🔄 Refreshing portfolio...');
        await this.handlePositions(ctx); // This will refresh and show positions
    }

    // Update text message handler to include analysis
    async handleTextMessage(ctx) {
        const userId = ctx.from.id;
        const text = ctx.message.text;
        const userState = this.userStates.get(userId);

        if (!userState) return;

        try {
            switch (userState.action) {
                case 'awaiting_ca':
                    await this.handleCAInput(ctx, text);
                    break;
                case 'awaiting_buy_amount':
                    await this.handleBuyAmount(ctx, text);
                    break;
                case 'awaiting_sell_choice':
                    await this.handleSellChoice(ctx, text);
                    break;
                case 'awaiting_deposit':
                    await this.handleDepositAmount(ctx, text);
                    break;
                case 'awaiting_withdraw':
                    await this.handleWithdrawAmount(ctx, text);
                    break;
                case 'awaiting_analysis_ca':
                    await this.handleAnalysisCA(ctx, text);
                    break;
            }
        } catch (error) {
            let errorMessage = `❌ Error: ${error.message}\n\n`;
            errorMessage += `🔄 Please try the command again.`;

            await ctx.reply(errorMessage);
            this.userStates.delete(userId);
        }
    }

    // Update buy completion to show source
    async handleBuyAmount(ctx, amountText) {
        const amount = parseFloat(amountText);
        if (isNaN(amount) || amount <= 0) {
            throw new Error('Please enter a valid SOL amount greater than 0');
        }

        const result = await this.trading.completeBuy(ctx.from.id, amount);

        const sourceIcon = result.isPumpFun ? '🚀' : '🔄';
        const successMessage =
            `${sourceIcon} Buy Order Executed!\n\n` +
            `🪙 ${result.position.tokenName}\n` +
            `📦 Amount: ${result.tokenAmount.toFixed(2)}\n` +
            `💰 Price: $${result.position.buyPrice.toFixed(8)}\n` +
            `💸 Cost: ${result.solAmount} SOL\n` +
            `🏦 New Balance: ${this.trading.db.getUser(ctx.from.id).demoBalance.SOL.toFixed(2)} SOL\n` +
            `📱 Source: ${result.source.toUpperCase()}\n\n` +
            `📊 Check your /positions`;

        await ctx.reply(successMessage);
        this.userStates.delete(ctx.from.id);
    }

    async handleDepositAmount(ctx, amountText) {
        const amount = parseFloat(amountText);
        if (isNaN(amount) || amount <= 0) {
            throw new Error('Please enter a valid SOL amount greater than 0');
        }

        const user = this.trading.db.getOrCreateUser(ctx.from.id);
        user.deposit(amount);

        await ctx.reply(
            `✅ Deposited ${amount} SOL\n\n` +
            `🏦 New Balance: ${user.demoBalance.SOL.toFixed(2)} SOL`
        );
        this.userStates.delete(ctx.from.id);
    }

    async handleWithdrawAmount(ctx, amountText) {
        const amount = parseFloat(amountText);
        if (isNaN(amount) || amount <= 0) {
            throw new Error('Please enter a valid SOL amount greater than 0');
        }

        const user = this.trading.db.getOrCreateUser(ctx.from.id);
        const success = user.withdraw(amount);

        if (success) {
            await ctx.reply(
                `✅ Withdrawn ${amount} SOL\n\n` +
                `🏦 New Balance: ${user.demoBalance.SOL.toFixed(2)} SOL`
            );
        } else {
            await ctx.reply(`❌ Insufficient balance. Available: ${user.demoBalance.SOL} SOL`);
        }
        this.userStates.delete(ctx.from.id);
    }

    async handleSellChoice(ctx, choice) {
        // Implementation for selling specific positions
        await ctx.reply('🔧 Sell functionality being implemented...');
        this.userStates.delete(ctx.from.id);
    }

    // Utility function to format large numbers
    formatNumber(num) {
        if (!num || num === 0) return '0';
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }

    // Helper function to validate Solana addresses
    isValidSolanaAddress(address) {
        // Basic Solana address validation
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }
}

module.exports = BotHandlers;