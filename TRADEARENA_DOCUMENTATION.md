# TradeArena - TradingView Integration

## Overview

TradeArena is a cryptocurrency/stock trading competition platform built with:
- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth)
- **Charts**: TradingView Charting Library with full broker integration

## Features

- 📊 Professional TradingView charts with real-time data
- 💹 Full trading functionality (Buy/Sell, Stop Loss, Take Profit)
- 🏆 Trading competitions with leaderboards
- 👛 Virtual wallet system
- 📈 Position management with bracket editing

## TradingView Broker Integration

The platform implements TradingView's `IBrokerTerminal` interface for seamless trading integration.

### Key Components

1. **`/src/lib/tradingview/broker.ts`** - Main broker implementation
   - Handles order placement, modification, cancellation
   - Position management with SL/TP brackets
   - Real-time P&L updates
   
2. **`/src/components/trading/TradingTerminal.tsx`** - TradingView widget wrapper
   - Configures broker_config flags
   - Manages widget lifecycle

3. **`/src/lib/tradingviewDatafeed.ts`** - Market data feed
   - Provides OHLCV candle data
   - Real-time quote subscriptions

### Broker Configuration Flags

```javascript
broker_config: {
  configFlags: {
    supportNativeReversePosition: true,
    supportClosePosition: true,
    supportPLUpdate: true,
    supportOrderBrackets: true,
    supportMarketBrackets: true,
    supportPositionBrackets: true,  // Enables Edit button & SL/TP drag
    supportEditAmount: false,
    showQuantityInsteadOfAmount: true,
  }
}
```

### Supported Trading Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| Place Order | `placeOrder()` | Market/Limit/Stop orders with brackets |
| Modify Order | `modifyOrder()` | Change price, quantity, brackets |
| Cancel Order | `cancelOrder()` | Cancel pending orders |
| Close Position | `closePosition()` | Close at market price |
| Edit Brackets | `editPositionBrackets()` | Modify SL/TP via dialog or chart drag |
| Reverse Position | `reversePosition()` | Close and open opposite |

## Supabase Edge Functions

| Function | Purpose |
|----------|---------|
| `place-order` | Execute trades, create positions |
| `close-position` | Close positions, calculate P&L |
| `update-position-brackets` | Modify SL/TP levels |
| `price-engine` | Fetch real-time prices |
| `candles-engine` | Fetch OHLCV candle data |

## Database Schema

### Core Tables
- `instruments` - Tradable symbols (forex, crypto, stocks, etc.)
- `competitions` - Trading competitions
- `competition_participants` - User enrollments
- `accounts` - Trading accounts with balance/equity
- `positions` - Open/closed positions
- `orders` - Pending orders
- `trades` - Execution history

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create `.env` file with:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Deployment

The project is configured for deployment via:
- **Vercel** - Automatic deployments from GitHub
- **Lovable** - Visual development platform

## License

Private - All rights reserved.

---

*Last updated: January 2026*

