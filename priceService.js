const axios = require('axios');

class PriceService {
    constructor() {
        // Cache to avoid duplicate requests
        this.tokenCache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }

    async getTokenInfoByCA(ca) {
        const normalizedCA = ca.trim().toLowerCase();

        // Check cache first
        const cached = this.tokenCache.get(normalizedCA);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        console.log(`🔍 Fetching token: ${normalizedCA.substring(0, 8)}...`);

        // Try multiple reliable sources in sequence
        const sources = [
            { name: 'Birdeye', method: this.tryBirdeye.bind(this) },
            { name: 'DexScreener', method: this.tryDexScreener.bind(this) },
            { name: 'Jupiter', method: this.tryJupiter.bind(this) },
            { name: 'Pump.fun', method: this.tryPumpFun.bind(this) },
        ];

        for (const source of sources) {
            try {
                console.log(`Trying ${source.name}...`);
                const tokenInfo = await source.method(normalizedCA);
                if (tokenInfo) {
                    // Cache successful result
                    this.tokenCache.set(normalizedCA, {
                        data: tokenInfo,
                        timestamp: Date.now()
                    });
                    return tokenInfo;
                }
            } catch (error) {
                console.log(`${source.name} failed:`, error.message);
                continue;
            }
        }

        throw new Error('Token not found on any supported platform. The token may be too new or have no liquidity.');
    }

    // 1. Birdeye - Most reliable for Solana tokens
    async tryBirdeye(ca) {
        try {
            const response = await axios.get(
                `https://public-api.birdeye.so/public/token?address=${ca}`,
                {
                    timeout: 5000,
                    headers: {
                        'X-API-KEY': '', // Can work without API key for basic info
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            );

            if (response.data.success && response.data.data) {
                const data = response.data.data;
                return {
                    ca: ca,
                    name: data.name || 'Unknown',
                    symbol: data.symbol || 'UNKNOWN',
                    price: parseFloat(data.price) || 0,
                    marketCap: parseFloat(data.market_cap) || 0,
                    volume: parseFloat(data.volume24h) || 0,
                    liquidity: parseFloat(data.liquidity) || 0,
                    priceChange: parseFloat(data.priceChange24h) || 0,
                    source: 'birdeye',
                    decimals: data.decimals || 9
                };
            }
        } catch (error) {
            // Continue to next source
        }
        return null;
    }

    // 2. DexScreener - Good fallback
    async tryDexScreener(ca) {
        try {
            const response = await axios.get(
                `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
                {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            );

            if (response.data.pairs && response.data.pairs.length > 0) {
                const pair = response.data.pairs[0];
                return {
                    ca: ca,
                    name: pair.baseToken?.name || 'Unknown',
                    symbol: pair.baseToken?.symbol || 'UNKNOWN',
                    price: parseFloat(pair.priceUsd) || 0,
                    marketCap: parseFloat(pair.marketCap) || 0,
                    volume: parseFloat(pair.volume?.h24) || 0,
                    liquidity: parseFloat(pair.liquidity?.usd) || 0,
                    priceChange: parseFloat(pair.priceChange?.h24) || 0,
                    source: 'dexscreener',
                    dex: pair.dexId
                };
            }
        } catch (error) {
            // Continue to next source
        }
        return null;
    }

    // 3. Jupiter - Good for newer tokens
    async tryJupiter(ca) {
        try {
            const response = await axios.get(
                `https://token.jup.ag/all`,
                {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            );

            if (response.data) {
                const token = response.data.find(t => t.address.toLowerCase() === ca);
                if (token) {
                    // Get price from Jupiter price API
                    const priceResponse = await axios.get(
                        `https://price.jup.ag/v4/price?ids=${ca}`,
                        { timeout: 5000 }
                    );

                    const priceData = priceResponse.data?.data?.[ca];
                    const price = priceData ? parseFloat(priceData.price) : 0;

                    return {
                        ca: ca,
                        name: token.name || 'Unknown',
                        symbol: token.symbol || 'UNKNOWN',
                        price: price,
                        marketCap: 0, // Jupiter doesn't provide market cap
                        volume: 0,
                        liquidity: 0,
                        priceChange: 0,
                        source: 'jupiter',
                        decimals: token.decimals || 9
                    };
                }
            }
        } catch (error) {
            // Continue to next source
        }
        return null;
    }

    // 4. Pump.fun - For new launches (requires specific handling)
    async tryPumpFun(ca) {
        try {
            const response = await axios.get(
                `https://api.pump.fun/token/${ca}`,
                {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json',
                        'Origin': 'https://pump.fun',
                        'Referer': 'https://pump.fun/'
                    }
                }
            );

            if (response.data) {
                const data = response.data;
                return {
                    ca: ca,
                    name: data.name || 'Unknown',
                    symbol: data.symbol || 'UNKNOWN',
                    price: parseFloat(data.price) || 0,
                    marketCap: parseFloat(data.marketCap) || 0,
                    volume: parseFloat(data.volume) || 0,
                    liquidity: parseFloat(data.liquidity) || 0,
                    priceChange: 0, // Pump.fun doesn't provide change
                    source: 'pump.fun',
                    isPumpFun: true,
                    bondCurvePrice: parseFloat(data.bondingCurvePrice) || 0
                };
            }
        } catch (error) {
            // Pump.fun often blocks bots, so this is expected to fail sometimes
        }
        return null;
    }

    async getCurrentPrice(ca) {
        try {
            // Use Birdeye for current prices (most reliable)
            const response = await axios.get(
                `https://public-api.birdeye.so/public/price?address=${ca}`,
                {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            );

            if (response.data.success && response.data.data) {
                const data = response.data.data;
                return {
                    price: parseFloat(data.value) || 0,
                    marketCap: 0, // Would need separate call
                    volume: 0,
                    source: 'birdeye'
                };
            }
        } catch (error) {
            // Fallback to DexScreener
            try {
                const response = await axios.get(
                    `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
                    { timeout: 5000 }
                );

                if (response.data.pairs && response.data.pairs.length > 0) {
                    const pair = response.data.pairs[0];
                    return {
                        price: parseFloat(pair.priceUsd) || 0,
                        marketCap: parseFloat(pair.marketCap) || 0,
                        volume: parseFloat(pair.volume?.h24) || 0,
                        source: 'dexscreener'
                    };
                }
            } catch (fallbackError) {
                throw new Error('Could not fetch current price');
            }
        }
    }

    // Utility function to validate Solana address
    isValidSolanaAddress(address) {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }

    // Clear cache (useful for testing)
    clearCache() {
        this.tokenCache.clear();
    }
}

module.exports = PriceService;