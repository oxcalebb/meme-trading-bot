class TradingEngine {
    constructor(database, priceService) {
        this.db = database;
        this.priceService = priceService;
        this.pendingBuys = new Map();
        this.pendingSells = new Map();
    }

    async startBuyProcess(userId, ca) {
        try {
            // Verify token and get info from multiple sources
            const tokenInfo = await this.priceService.getTokenInfoByCA(ca);

            // Store pending buy with additional info
            this.pendingBuys.set(userId.toString(), {
                ca: ca,
                tokenInfo: tokenInfo,
                timestamp: Date.now(),
                isPumpFun: tokenInfo.source === 'pump.fun'
            });

            return tokenInfo;
        } catch (error) {
            throw new Error(`Token verification failed: ${error.message}`);
        }
    }

    async completeBuy(userId, solAmount) {
        const pending = this.pendingBuys.get(userId.toString());
        if (!pending) {
            throw new Error('No pending buy operation. Please start with /buy first.');
        }

        const user = this.db.getOrCreateUser(userId);

        // Check balance
        if (user.demoBalance.SOL < solAmount) {
            throw new Error(`Insufficient SOL balance. You have: ${user.demoBalance.SOL} SOL`);
        }

        // Calculate token amount
        const tokenAmount = solAmount / pending.tokenInfo.price;

        // Execute buy
        user.demoBalance.SOL -= solAmount;
        const position = user.addPosition(
            pending.ca,
            pending.tokenInfo.name,
            tokenAmount,
            pending.tokenInfo.price,
            pending.tokenInfo.marketCap,
            pending.tokenInfo.volume
        );

        // Add Pump.fun specific data if applicable
        if (pending.isPumpFun) {
            position.isPumpFun = true;
            position.bondCurvePrice = pending.tokenInfo.bondCurvePrice;
        }

        // Record transaction
        user.tradeHistory.push({
            type: 'BUY',
            tokenCA: pending.ca,
            tokenName: pending.tokenInfo.name,
            tokenAmount: tokenAmount,
            solAmount: solAmount,
            price: pending.tokenInfo.price,
            source: pending.tokenInfo.source,
            timestamp: new Date()
        });

        // Clear pending buy
        this.pendingBuys.delete(userId.toString());

        return {
            success: true,
            position: position,
            tokenAmount: tokenAmount,
            solAmount: solAmount,
            source: pending.tokenInfo.source,
            isPumpFun: pending.isPumpFun
        };
    }

    async sellPosition(userId, ca, percentage = 100) {
        const user = this.db.getUser(userId);
        if (!user) throw new Error('User not found');

        const position = user.getPosition(ca);
        if (!position) throw new Error('No position found for this token');

        // Get current price
        const currentPrice = await this.priceService.getCurrentPrice(ca);
        user.updatePositionPrice(ca, currentPrice.price, currentPrice.marketCap, currentPrice.volume);

        // Calculate sell amount
        const sellAmount = position.amount * (percentage / 100);
        const solReceived = sellAmount * currentPrice.price;

        // Execute sell
        user.demoBalance.SOL += solReceived;
        const soldAmount = user.removePosition(ca, sellAmount);

        // Record transaction
        user.tradeHistory.push({
            type: 'SELL',
            tokenCA: ca,
            tokenName: position.tokenName,
            tokenAmount: soldAmount,
            solAmount: solReceived,
            price: currentPrice.price,
            pnl: position.pnl * (percentage / 100),
            source: position.source || 'unknown',
            timestamp: new Date()
        });

        return {
            success: true,
            soldAmount: soldAmount,
            solReceived: solReceived,
            pnl: position.pnl * (percentage / 100),
            source: position.source
        };
    }

    async refreshPortfolio(userId) {
        const user = this.db.getUser(userId);
        if (!user) throw new Error('User not found');

        let totalPortfolioValue = user.demoBalance.SOL;
        let updatedPositions = [];

        for (const position of user.positions) {
            try {
                const currentPrice = await this.priceService.getCurrentPrice(position.tokenCA);
                user.updatePositionPrice(
                    position.tokenCA,
                    currentPrice.price,
                    currentPrice.marketCap,
                    currentPrice.volume
                );

                const updatedPosition = user.getPosition(position.tokenCA);
                totalPortfolioValue += updatedPosition.currentValue;
                updatedPositions.push(updatedPosition);
            } catch (error) {
                console.error(`Could not update position for ${position.tokenCA}:`, error.message);
                updatedPositions.push(position);
                totalPortfolioValue += position.currentValue;
            }
        }

        return {
            positions: updatedPositions,
            totalValue: totalPortfolioValue,
            balance: user.demoBalance.SOL
        };
    }

    // Special method for Pump.fun token analysis
    async analyzePumpFunToken(ca) {
        try {
            const tokenInfo = await this.priceService.getTokenInfoByCA(ca);
            const chartData = await this.priceService.getPumpFunChart(ca);

            return {
                tokenInfo,
                chartData,
                analysis: this.generatePumpFunAnalysis(tokenInfo, chartData)
            };
        } catch (error) {
            throw new Error(`Pump.fun analysis failed: ${error.message}`);
        }
    }

    generatePumpFunAnalysis(tokenInfo, chartData) {
        const analysis = [];

        if (tokenInfo.source === 'pump.fun') {
            analysis.push('🎯 **Pump.fun Token Detected**');

            if (tokenInfo.marketCap < 10000) {
                analysis.push('💎 **Early Stage**: Market cap under $10K');
            } else if (tokenInfo.marketCap < 50000) {
                analysis.push('🚀 **Growing**: Market cap $10K-$50K');
            } else {
                analysis.push('🏢 **Established**: Market cap over $50K');
            }

            if (tokenInfo.liquidity > 0) {
                analysis.push(`💧 **Liquidity**: $${this.formatNumber(tokenInfo.liquidity)}`);
            }

            if (chartData) {
                analysis.push('📊 **Chart data available**');
            }
        }

        return analysis.join('\n');
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }
}

module.exports = TradingEngine;