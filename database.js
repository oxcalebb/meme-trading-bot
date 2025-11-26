class Database {
    constructor() {
        this.users = new Map();
        this.tokens = new Map(); // Store token info by CA
    }

    getUser(userId) {
        return this.users.get(userId.toString());
    }

    getOrCreateUser(userId) {
        const id = userId.toString();
        if (!this.users.has(id)) {
            this.users.set(id, new UserAccount(id));
        }
        return this.users.get(id);
    }

    // Token management
    addToken(ca, tokenInfo) {
        this.tokens.set(ca.toLowerCase(), tokenInfo);
    }

    getToken(ca) {
        return this.tokens.get(ca.toLowerCase());
    }

    getAllUsers() {
        return Array.from(this.users.values());
    }
}

class UserAccount {
    constructor(userId) {
        this.userId = userId;
        this.demoBalance = {
            SOL: 1000, // Starting simulated SOL
        };
        this.positions = []; // Array of position objects
        this.tradeHistory = [];
        this.createdAt = new Date();
        this.settings = {
            autoRefresh: true,
            notifications: true
        };
    }

    addPosition(tokenCA, tokenName, amount, buyPrice, marketCap, volume) {
        const position = {
            tokenCA: tokenCA.toLowerCase(),
            tokenName: tokenName,
            amount: amount,
            buyPrice: buyPrice,
            currentPrice: buyPrice,
            marketCap: marketCap,
            volume: volume,
            pnl: 0,
            pnlPercent: 0,
            invested: amount * buyPrice,
            currentValue: amount * buyPrice,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
        this.positions.push(position);
        return position;
    }

    removePosition(tokenCA, amount) {
        const ca = tokenCA.toLowerCase();
        const positionIndex = this.positions.findIndex(p => p.tokenCA === ca);

        if (positionIndex !== -1) {
            const position = this.positions[positionIndex];

            if (amount >= position.amount) {
                // Remove entire position
                this.positions.splice(positionIndex, 1);
                return position.amount;
            } else {
                // Reduce position
                position.amount -= amount;
                position.invested = position.amount * position.buyPrice;
                position.currentValue = position.amount * position.currentPrice;
                return amount;
            }
        }
        return 0;
    }

    getPosition(tokenCA) {
        return this.positions.find(p => p.tokenCA === tokenCA.toLowerCase());
    }

    updatePositionPrice(tokenCA, newPrice, newMarketCap, newVolume) {
        const position = this.getPosition(tokenCA);
        if (position) {
            position.currentPrice = newPrice;
            position.marketCap = newMarketCap;
            position.volume = newVolume;
            position.currentValue = position.amount * newPrice;
            position.pnl = position.currentValue - position.invested;
            position.pnlPercent = (position.pnl / position.invested) * 100;
            position.lastUpdated = new Date();
        }
    }

    deposit(amount) {
        this.demoBalance.SOL += amount;
        this.tradeHistory.push({
            type: 'DEPOSIT',
            amount: amount,
            timestamp: new Date(),
            newBalance: this.demoBalance.SOL
        });
    }

    withdraw(amount) {
        if (this.demoBalance.SOL >= amount) {
            this.demoBalance.SOL -= amount;
            this.tradeHistory.push({
                type: 'WITHDRAWAL',
                amount: amount,
                timestamp: new Date(),
                newBalance: this.demoBalance.SOL
            });
            return true;
        }
        return false;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }
}

module.exports = Database;