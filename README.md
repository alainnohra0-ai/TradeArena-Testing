# TradeArena - Trading Competition Platform

A comprehensive trading competition platform built with React, TypeScript, and Supabase, featuring real-time TradingView integration for live trading.

## Features

- 🎯 **Trading Competitions**: Create and manage multi-asset trading competitions
- 📊 **TradingView Integration**: Full-featured trading terminal with charting
- 💰 **Multi-Asset Support**: Forex, Indices, Commodities, Crypto, and Stocks
- 🏆 **Real-time Leaderboards**: Live ranking and performance tracking
- 💼 **Portfolio Management**: Track positions, orders, and P&L
- 🔒 **Secure Trading**: Row-level security and proper margin management
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Trading**: TradingView Charting Library & Trading Terminal
- **State Management**: React Context API
- **Routing**: React Router v6

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or bun
- Supabase account

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd supabase-deploy-hub

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your Supabase credentials
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
supabase-deploy-hub/
├── src/
│   ├── components/          # React components
│   │   ├── trading/        # Trading-specific components
│   │   ├── admin/          # Admin panel components
│   │   └── ui/             # Reusable UI components
│   ├── pages/              # Page components
│   ├── lib/                # Utilities and helpers
│   │   └── tradingview/    # TradingView broker integration
│   ├── contexts/           # React contexts
│   ├── hooks/              # Custom React hooks
│   └── integrations/       # External integrations
│       └── supabase/       # Supabase client
├── supabase/
│   ├── migrations/         # Database migrations
│   └── functions/          # Edge Functions
│       ├── place-order/    # Order placement
│       ├── close-position/ # Position closing
│       ├── price-engine/   # Real-time pricing
│       └── ...
├── docs/                   # Documentation
│   ├── TRADING_BACKEND_FIXES.md       # Recent backend fixes
│   ├── TRADING_WORKFLOW_COMPLETE.md   # Complete trading workflow
│   └── TRADINGVIEW_*.md               # TradingView integration docs
└── public/                 # Static assets
```

## Database Schema

The platform uses a comprehensive PostgreSQL schema with:

- **Users & Profiles**: Authentication and user management
- **Competitions**: Competition metadata and rules
- **Instruments**: Multi-asset trading instruments
- **Accounts**: Trading accounts per participant
- **Orders & Positions**: Order management and position tracking
- **Trades**: Historical trade records
- **Market Data**: Real-time pricing and candles
- **Wallets**: User balance management

See [Database Schema Migrations](./supabase/migrations/) for details.

## Trading Features

### Order Types
- ✅ Market Orders
- ✅ Limit Orders
- ✅ Stop Orders
- ✅ Stop-Limit Orders (partial)

### Position Management
- ✅ Open/Close positions
- ✅ Stop Loss & Take Profit brackets
- ✅ Real-time P&L tracking
- ✅ Margin management
- ✅ Leverage configuration

### Risk Management
- ✅ Maximum drawdown limits
- ✅ Position size limits
- ✅ Leverage restrictions
- ✅ Automatic disqualification on breach

## Recent Updates (2026-01-15)

### Trading Backend Fixes
- Fixed broker parameter mismatch (symbol → instrument_id)
- Added instrument caching for performance
- Created database migrations for missing fields
- Improved error handling and logging
- Fixed order cancellation logic

See [TRADING_BACKEND_FIXES.md](./docs/TRADING_BACKEND_FIXES.md) for details.

## Documentation

- [Start Here](./docs/START_HERE.md) - Getting started guide
- [Trading Workflow](./docs/TRADING_WORKFLOW_COMPLETE.md) - Complete trading flow documentation
- [Trading Backend Fixes](./docs/TRADING_BACKEND_FIXES.md) - Recent backend improvements
- [TradingView Integration](./docs/TRADINGVIEW_INTEGRATION.md) - TradingView setup guide

## Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# TradingView (optional)
VITE_TRADINGVIEW_LIBRARY_PATH=/charting_library/
```

## Deployment

### Frontend
The app can be deployed to:
- Vercel
- Netlify
- Lovable
- Any static hosting service

### Backend (Supabase)
1. Create a Supabase project
2. Apply database migrations via SQL Editor
3. Deploy Edge Functions (if using CLI)
4. Configure environment variables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Your License Here]

## Support

For issues or questions:
- Check the [documentation](./docs/)
- Review [closed issues](../../issues?q=is%3Aissue+is%3Aclosed)
- Open a new issue

## Acknowledgments

- TradingView for the charting library
- Supabase for the backend infrastructure
- shadcn/ui for the component library

---

**Built with ❤️ for competitive trading**

