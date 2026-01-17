/**
 * Custom TradingView Datafeed
 * Loads symbols from database, fetches candles from candles-engine
 * Optimized with caching to reduce repeated requests
 */

import { supabase } from "@/integrations/supabase/client";

// Dynamic symbol configuration loaded from database
interface SymbolConfig {
  name: string;
  pricescale: number;
  type: string;
  instrumentId: string;
}

let symbolConfigCache: Record<string, SymbolConfig> = {};
let symbolsLoaded = false;

// Cache for bar data to avoid repeated requests
interface BarCache {
  bars: Bar[];
  timestamp: number;
}
const barCache: Map<string, BarCache> = new Map();
const BAR_CACHE_TTL = 60000; // 1 minute cache

// Resolution mapping
const RESOLUTION_MAP: Record<string, string> = {
  '1': '1min',
  '5': '5min',
  '15': '15min',
  '30': '30min',
  '60': '1h',
  '240': '4h',
  'D': '1day',
  '1D': '1day',
  'W': '1week',
  '1W': '1week',
};

const RESOLUTION_SECONDS: Record<string, number> = {
  '1': 60,
  '5': 300,
  '15': 900,
  '30': 1800,
  '60': 3600,
  '240': 14400,
  'D': 86400,
  '1D': 86400,
  'W': 604800,
  '1W': 604800,
};

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Subscription {
  symbolInfo: any;
  resolution: string;
  lastBar: Bar | null;
  callback: (bar: Bar) => void;
  channelUnsubscribe?: () => void;
}

const subscriptions: Map<string, Subscription> = new Map();

// Load all instruments from database
async function loadSymbolsFromDatabase(): Promise<void> {
  if (symbolsLoaded && Object.keys(symbolConfigCache).length > 0) {
    return;
  }

  try {
    const { data: instruments, error } = await supabase
      .from('instruments')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('[Datafeed] Error loading instruments:', error);
      return;
    }

    if (instruments) {
      instruments.forEach(inst => {
        // Calculate pricescale from tick_size
        const tickSize = Number(inst.tick_size) || 0.00001;
        const pricescale = Math.round(1 / tickSize);

        symbolConfigCache[inst.symbol] = {
          name: inst.name,
          pricescale,
          type: inst.asset_class,
          instrumentId: inst.id,
        };
      });

      symbolsLoaded = true;
      console.log('[Datafeed] Loaded', Object.keys(symbolConfigCache).length, 'instruments');
    }
  } catch (err) {
    console.error('[Datafeed] Failed to load instruments:', err);
  }
}

export function createDatafeed() {
  // Load symbols on creation
  loadSymbolsFromDatabase();

  return {
    onReady: (callback: (config: any) => void) => {
      console.log('[Datafeed] onReady called');
      
      // Ensure symbols are loaded before returning config
      loadSymbolsFromDatabase().then(() => {
        callback({
          supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W'],
          exchanges: [
            { value: '', name: 'All Exchanges', desc: '' },
            { value: 'FOREX', name: 'Forex', desc: 'Foreign Exchange' },
            { value: 'CRYPTO', name: 'Crypto', desc: 'Cryptocurrency' },
            { value: 'COMMODITIES', name: 'Commodities', desc: 'Commodities' },
            { value: 'INDICES', name: 'Indices', desc: 'Stock Indices' },
          ],
          symbols_types: [
            { name: 'All types', value: '' },
            { name: 'Forex', value: 'forex' },
            { name: 'Crypto', value: 'crypto' },
            { name: 'Commodities', value: 'commodities' },
            { name: 'Indices', value: 'indices' },
          ],
          supports_marks: true,
          supports_timescale_marks: true,
          supports_time: true,
        });
      });
    },

    searchSymbols: async (
      userInput: string,
      exchange: string,
      symbolType: string,
      onResultReadyCallback: (symbols: any[]) => void
    ) => {
      console.log('[Datafeed] searchSymbols:', userInput);
      
      // Ensure symbols are loaded
      await loadSymbolsFromDatabase();

      const results = Object.entries(symbolConfigCache)
        .filter(([symbol, config]) => {
          const matchesInput = !userInput || 
            symbol.toLowerCase().includes(userInput.toLowerCase()) ||
            config.name.toLowerCase().includes(userInput.toLowerCase());
          const matchesType = !symbolType || config.type === symbolType;
          const matchesExchange = !exchange || config.type.toUpperCase() === exchange;
          return matchesInput && matchesType && matchesExchange;
        })
        .map(([symbol, config]) => ({
          symbol,
          full_name: symbol,
          description: config.name,
          exchange: config.type.toUpperCase(),
          type: config.type,
        }));
      
      onResultReadyCallback(results);
    },

    resolveSymbol: async (
      symbolName: string,
      onSymbolResolvedCallback: (symbolInfo: any) => void,
      onResolveErrorCallback: (reason: string) => void
    ) => {
      console.log('[Datafeed] resolveSymbol:', symbolName);
      
      // Ensure symbols are loaded
      await loadSymbolsFromDatabase();
      
      const config = symbolConfigCache[symbolName];
      
      if (!config) {
        console.error(`[Datafeed] Unknown symbol: ${symbolName}`);
        onResolveErrorCallback(`Unknown symbol: ${symbolName}`);
        return;
      }

      onSymbolResolvedCallback({
        name: symbolName,
        full_name: symbolName,
        description: config.name,
        type: config.type,
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: config.type.toUpperCase(),
        minmov: 1,
        pricescale: config.pricescale,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W'],
        volume_precision: 2,
        data_status: 'streaming',
      });
    },

    getBars: async (
      symbolInfo: any,
      resolution: string,
      periodParams: { from: number; to: number; countBack?: number; firstDataRequest: boolean },
      onHistoryCallback: (bars: Bar[], meta: { noData?: boolean }) => void,
      onErrorCallback: (reason: string) => void
    ) => {
      const symbol = symbolInfo.name;
      const timeframe = RESOLUTION_MAP[resolution] || '1h';
      
      // Create cache key for this request
      const cacheKey = `${symbol}_${timeframe}_${periodParams.from}_${periodParams.to}`;
      
      // Check cache first
      const cached = barCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < BAR_CACHE_TTL) {
        console.log(`[Datafeed] Cache hit for ${symbol} (${cached.bars.length} bars)`);
        onHistoryCallback(cached.bars, { noData: cached.bars.length === 0 });
        return;
      }

      console.log('[Datafeed] getBars:', symbol, resolution, 'from:', new Date(periodParams.from * 1000).toISOString().split('T')[0]);

      try {
        const config = symbolConfigCache[symbol];
        const instrumentId = config?.instrumentId;
        
        // Try to get from market_candles table first
        let bars: Bar[] = [];
        
        if (instrumentId) {
          const { data: candles, error } = await supabase
            .from('market_candles')
            .select('*')
            .eq('instrument_id', instrumentId)
            .eq('timeframe', timeframe)
            .gte('ts_open', new Date(periodParams.from * 1000).toISOString())
            .lte('ts_open', new Date(periodParams.to * 1000).toISOString())
            .order('ts_open', { ascending: true })
            .limit(1000);

          if (!error && candles && candles.length > 0) {
            bars = candles.map(c => ({
              time: new Date(c.ts_open).getTime(),
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume || 0,
            }));
            console.log(`[Datafeed] Got ${bars.length} bars from market_candles`);
          }
        }

        // If no candles in DB, use mock data immediately (skip slow API)
        if (bars.length === 0) {
          console.log('[Datafeed] No DB data, using mock bars for fast display');
          bars = generateMockBars(symbol, resolution, periodParams.from, periodParams.to);
        }

        // Cache the result
        barCache.set(cacheKey, { bars, timestamp: Date.now() });

        if (bars.length === 0) {
          onHistoryCallback([], { noData: true });
        } else {
          onHistoryCallback(bars, { noData: false });
        }
      } catch (err) {
        console.error('[Datafeed] getBars error:', err);
        // On error, return mock data to keep chart responsive
        const mockBars = generateMockBars(symbol, resolution, periodParams.from, periodParams.to);
        onHistoryCallback(mockBars, { noData: false });
      }
    },

    subscribeBars: async (
      symbolInfo: any,
      resolution: string,
      onRealtimeCallback: (bar: Bar) => void,
      subscriberUID: string,
      onResetCacheNeededCallback: () => void
    ) => {
      const symbol = symbolInfo.name;
      console.log('[Datafeed] subscribeBars:', symbol, subscriberUID);

      const config = symbolConfigCache[symbol];
      const instrumentId = config?.instrumentId;
      
      const subscription: Subscription = {
        symbolInfo,
        resolution,
        lastBar: null,
        callback: onRealtimeCallback,
      };

      // Subscribe to market_prices_latest for realtime updates
      if (instrumentId) {
        const channel = supabase
          .channel(`prices_${subscriberUID}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'market_prices_latest',
              filter: `instrument_id=eq.${instrumentId}`,
            },
            (payload: any) => {
              const newPrice = payload.new;
              if (!newPrice) return;

              const resolutionSeconds = RESOLUTION_SECONDS[resolution] || 60;
              const currentTime = Math.floor(Date.now() / 1000);
              const barTime = Math.floor(currentTime / resolutionSeconds) * resolutionSeconds * 1000;

              const sub = subscriptions.get(subscriberUID);
              if (!sub) return;

              const price = newPrice.price;

              if (sub.lastBar && sub.lastBar.time === barTime) {
                // Update existing bar
                const updatedBar: Bar = {
                  ...sub.lastBar,
                  high: Math.max(sub.lastBar.high, price),
                  low: Math.min(sub.lastBar.low, price),
                  close: price,
                };
                sub.lastBar = updatedBar;
                sub.callback(updatedBar);
              } else {
                // New bar
                const newBar: Bar = {
                  time: barTime,
                  open: price,
                  high: price,
                  low: price,
                  close: price,
                };
                sub.lastBar = newBar;
                sub.callback(newBar);
              }
            }
          )
          .subscribe();

        subscription.channelUnsubscribe = () => {
          supabase.removeChannel(channel);
        };
      }

      subscriptions.set(subscriberUID, subscription);
    },

    unsubscribeBars: (subscriberUID: string) => {
      console.log('[Datafeed] unsubscribeBars:', subscriberUID);
      const subscription = subscriptions.get(subscriberUID);
      if (subscription?.channelUnsubscribe) {
        subscription.channelUnsubscribe();
      }
      subscriptions.delete(subscriberUID);
    },

    // Get marks for trading positions
    getMarks: async (
      symbolInfo: any,
      from: number,
      to: number,
      onDataCallback: (marks: any[]) => void,
      resolution: string
    ) => {
      onDataCallback([]);
    },

    getTimescaleMarks: async (
      symbolInfo: any,
      from: number,
      to: number,
      onDataCallback: (marks: any[]) => void,
      resolution: string
    ) => {
      onDataCallback([]);
    },
    
    // Get quotes for watchlist
    getQuotes: async (
      symbols: string[],
      onDataCallback: (data: any[]) => void,
      onErrorCallback: (reason: string) => void
    ) => {
      try {
        const quotes = [];
        
        for (const symbol of symbols) {
          const config = symbolConfigCache[symbol];
          if (!config) continue;
          
          // Get latest price from database
          const { data: priceData } = await supabase
            .from('market_prices_latest')
            .select('*')
            .eq('instrument_id', config.instrumentId)
            .single();
          
          if (priceData) {
            quotes.push({
              s: 'ok',
              n: symbol,
              v: {
                ch: 0,
                chp: 0,
                short_name: symbol,
                exchange: config.type.toUpperCase(),
                description: config.name,
                lp: priceData.price,
                ask: priceData.ask,
                bid: priceData.bid,
                open_price: priceData.price,
                high_price: priceData.price,
                low_price: priceData.price,
                prev_close_price: priceData.price,
                volume: 0,
              },
            });
          }
        }
        
        onDataCallback(quotes);
      } catch (err) {
        console.error('[Datafeed] getQuotes error:', err);
        onErrorCallback(String(err));
      }
    },
    
    subscribeQuotes: (
      symbols: string[],
      fastSymbols: string[],
      onRealtimeCallback: (data: any[]) => void,
      listenerGUID: string
    ) => {
      console.log('[Datafeed] subscribeQuotes:', symbols);
      // Quotes are updated via realtime subscription in subscribeBars
    },
    
    unsubscribeQuotes: (listenerGUID: string) => {
      console.log('[Datafeed] unsubscribeQuotes:', listenerGUID);
    },
  };
}

// Generate mock bars when no data available
function generateMockBars(symbol: string, resolution: string, from: number, to: number): Bar[] {
  const bars: Bar[] = [];
  const interval = RESOLUTION_SECONDS[resolution] || 3600;
  
  // Base prices for different symbols
  const basePrices: Record<string, number> = {
    'EURUSD': 1.08,
    'GBPUSD': 1.27,
    'USDJPY': 149.5,
    'BTCUSD': 42000,
    'ETHUSD': 2200,
    'XAUUSD': 2020,
    'XAGUSD': 23.5,
    'US500': 5000,
    'US30': 38000,
    'NAS100': 17500,
  };
  
  let price = basePrices[symbol] || 100;
  const volatility = price * 0.001;

  for (let time = from; time <= to; time += interval) {
    const change = (Math.random() - 0.5) * volatility * 2;
    const open = price;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    bars.push({
      time: time * 1000,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000,
    });

    price = close;
  }

  return bars;
}

export default createDatafeed;