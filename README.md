# TradeArena - Trading Competition Platform

A comprehensive cryptocurrency/stock trading competition platform built with React, TypeScript, Supabase, and TradingView's Charting Library.

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **Charts**: TradingView Charting Library (Advanced Charts)
- **Price Data**: Twelve Data API

### Database Schema (18 Tables)
- `competitions` - Competition definitions
- `competition_rules` - Trading rules per competition
- `competition_instruments` - Allowed instruments per competition
- `competition_participants` - User participation records
- `accounts` - Trading accounts (one per competition per user)
- `positions` - Open/closed trading positions
- `orders` - Order records
- `trades` - Closed trade history
- `equity_snapshots` - Historical equity tracking
- `rank_snapshots` - Competition ranking history
- `disqualifications` - DQ records
- `instruments` - Trading instruments (forex, crypto, indices, commodities)
- `market_prices_latest` - Current prices
- `market_candles` - Historical OHLCV data
- `wallet_accounts` - User wallets
- `wallet_transactions` - Wallet transaction history
- `withdraw_requests` - Withdrawal requests
- `profiles` - User profiles
- `user_roles` - Role assignments

### Edge Functions (9 Functions)
1. **place-order** - Execute market/limit/stop orders
2. **close-position** - Close positions with P&L calculation
3. **update-position-brackets** - Update SL/TP levels
4. **join-competition** - Join competition and create account
5. **price-engine** - Centralized price fetching from Twelve Data
6. **candles-engine** - Historical candle data
7. **get-forex-price** - Legacy price function
8. **sltp-trigger-engine** - Background SL/TP trigger checker
9. **pnl-update-engine** - Background P&L updater

## 🚀 Features

### Trading Features
- ✅ Open positions (market orders)
- ✅ Close positions
- ✅ Reverse positions
- ✅ Set/modify Stop Loss (SL)
- ✅ Set/modify Take Profit (TP)
- ✅ Drag SL/TP lines on chart
- ✅ Real-time P&L calculation
- ✅ Account Manager panel (positions, orders)
- ✅ Multiple competition accounts support

### Competition Features
- ✅ Join competitions
- ✅ Entry fee deduction from wallet
- ✅ Starting balance per competition
- ✅ Max drawdown enforcement
- ✅ Max leverage limits
- ✅ Max position size limits
- ✅ Automatic disqualification on rule breach
- ✅ Leaderboard ranking

### Price & Data
- ✅ Real-time prices from Twelve Data API
- ✅ Bid/Ask spread calculation
- ✅ Price caching with TTL
- ✅ Fallback to database prices
- ✅ Historical candle data
- ✅ Realtime price updates via Supabase

## 📁 Project Structure

```
supabase-deploy-hub/
├── public/
│   └── charting_library/     # TradingView library files
├── src/
│   ├── components/
│   │   ├── trading/
│   │   │   └── TradingTerminal.tsx   # TradingView widget wrapper
│   │   ├── ui/                        # shadcn/ui components
│   │   └── admin/                     # Admin components
│   ├── contexts/
│   │   └── AuthContext.tsx           # Authentication context
│   ├── hooks/
│   │   ├── useCompetitions.ts        # Competition data hooks
│   │   ├── useRealtimePrices.ts      # Realtime price subscription
│   │   └── useTrading.ts             # Trading hooks
│   ├── lib/
│   │   ├── tradingview/
│   │   │   └── broker.ts             # TradingView Broker API implementation
│   │   └── tradingviewDatafeed.ts    # TradingView Datafeed implementation
│   ├── pages/
│   │   ├── Trading.tsx               # Main trading page
│   │   ├── Competitions.tsx          # Competition browser
│   │   └── MyCompetitionDashboard.tsx # Competition dashboard
│   └── integrations/
│       └── supabase/
│           ├── client.ts             # Supabase client
│           └── types.ts              # Auto-generated types
└── supabase/
    ├── functions/
    │   ├── place-order/
    │   ├── close-position/
    │   ├── update-position-brackets/
    │   ├── join-competition/
    │   ├── price-engine/
    │   ├── candles-engine/
    │   ├── sltp-trigger-engine/
    │   └── pnl-update-engine/
    └── migrations/                   # Database migrations
```

## 🔧 Configuration

### Environment Variables

**.env.local**
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Supabase Secrets (for Edge Functions)**
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TWELVE_DATA_API_KEY=your_twelve_data_api_key
```

## 🎯 Key Implementation Details

### Broker Implementation

The `broker.ts` implements TradingView's Broker API:

```typescript
// Key methods
placeOrder(preOrder: PreOrder)      // Place market/limit/stop orders
closePosition(positionId: string)    // Close a position
reversePosition(positionId: string)  // Reverse position direction
editPositionBrackets(id, brackets)   // Update SL/TP
positions()                          // Get all positions
orders()                            // Get all orders
```

### P&L Calculation

```typescript
// For BUY positions: close at BID
// For SELL positions: close at ASK
const exitPrice = side === 'buy' ? bid : ask;
const priceDiff = side === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice;
const pnl = priceDiff * quantity * contractSize;
```

### Multi-Account Support

Users can participate in multiple competitions simultaneously. Each competition creates a separate trading account:

```
User → CompetitionParticipant → Account → Positions
         └──────────────────────→ Account → Positions
```

## 🔄 Background Jobs

The following edge functions should be called periodically:

1. **sltp-trigger-engine** (every 5-10 seconds)
   - Checks all positions with SL/TP
   - Closes positions when price hits levels

2. **pnl-update-engine** (every 5-10 seconds)
   - Updates unrealized P&L for all open positions
   - Updates account equity values

### Setting Up Cron Jobs

Using an external cron service (e.g., cron-job.org):

```bash
# Every 10 seconds
POST https://your-supabase-url/functions/v1/sltp-trigger-engine
POST https://your-supabase-url/functions/v1/pnl-update-engine
```

## 🧪 Testing

### Test with Mock Data

The system uses mock data when no real price data is available:
- Mock prices are generated based on symbol base prices
- Mock candles are generated for chart display

### Test Order Flow

1. Join a competition (creates account with starting balance)
2. Open a position on Trading page
3. Set SL/TP via bracket editor or chart drag
4. Verify P&L updates in Account Manager
5. Close position and check balance update

## 📊 Supported Instruments

### Forex (Default leverage: 100x)
- EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD

### Crypto (Default leverage: 10x)
- BTCUSD, ETHUSD, SOLUSD, BNBUSD, XRPUSD

### Commodities (Default leverage: 20x)
- XAUUSD (Gold), XAGUSD (Silver)

### Indices (Default leverage: 50x)
- US500 (S&P 500), US30 (Dow Jones), NAS100 (Nasdaq)

## 🚀 Deployment

### Deploy Edge Functions

```bash
supabase functions deploy place-order
supabase functions deploy close-position
supabase functions deploy update-position-brackets
supabase functions deploy join-competition
supabase functions deploy price-engine
supabase functions deploy candles-engine
supabase functions deploy sltp-trigger-engine
supabase functions deploy pnl-update-engine
```

### Set Secrets

```bash
supabase secrets set TWELVE_DATA_API_KEY=your_key
```

## 📝 License

Proprietary - TradeArena Platform

---

**Version**: 1.0.0  
**Last Updated**: January 2026

