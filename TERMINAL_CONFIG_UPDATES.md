# Terminal Configuration Updates

## Update broker_config in TradingTerminal.tsx

Replace the existing `broker_config` section with this enhanced version:

```typescript
// Broker integration - ENHANCED CONFIGURATION
broker_factory: brokerFactory,
broker_config: {
  configFlags: {
    // Core flags
    supportNativeReversePosition: true,     // ✅ Enable reverse position
    supportClosePosition: true,             // ✅ Enable close position
    supportPLUpdate: true,                  // ✅ Enable P&L updates
    
    // Bracket flags - CRITICAL FOR SL/TP DRAGGING
    supportOrderBrackets: true,             // ✅ Enable brackets on new orders
    supportMarketBrackets: true,            // ✅ Enable brackets on market orders  
    supportPositionBrackets: true,          // ✅ CRITICAL - enables bracket editing
    supportModifyPosition: true,            // ✅ Enable edit position dialog
    
    // Display flags
    showQuantityInsteadOfAmount: true,      // Show quantity, not notional
    supportEditAmount: false,               // Don't allow quantity editing
    supportLevel2Data: false,               // No level 2 data
    supportOrdersHistory: true,             // Show order history
    supportModifyOrder: false,              // Don't allow order modification
    
    // Additional useful flags
    supportDOM: true,                       // Enable DOM panel
    supportMultiposition: false,            // One position per symbol
    supportPLUpdate: true,                  // Real-time P&L
    supportStopLimitOrders: true,           // Stop-limit orders
    supportMarketOrders: true,              // Market orders
    supportLimitOrders: true,               // Limit orders
    supportStopOrders: true,                // Stop orders
  },
  
  // Order durations
  durations: [
    { name: "DAY", value: "DAY" },
    { name: "GTC", value: "GTC" },
  ],
  
  // Custom order dialog (if available)
  customOrderDialog: true,
  
  // Enable account manager
  showAccountManager: true,
},
```

## Additional Widget Configuration

Add these to `enabled_features` array:

```typescript
enabled_features: [
  "study_templates",
  "dom_widget",                       // Depth of Market
  "trading_account_manager",          // ✅ Account Manager panel
  "show_chart_property_page",         // Chart properties
  "chart_property_page_trading",      // Trading properties in chart
  "trading_notifications",            // Trading notifications
  "support_manage_broker_config",     // Broker config management
],
```

And add these to `disabled_features` to remove:

```typescript
disabled_features: [
  "use_localstorage_for_settings",
  "header_compare",
  "create_volume_indicator_by_default",  // Optional: remove volume
],
```

## Full Updated Widget Config

Here's the complete updated widgetConfig for TradingTerminal.tsx:

```typescript
const widgetConfig = {
  // Core settings
  fullscreen: true,
  symbol: symbol,
  interval: "1D",
  container: containerRef.current,
  datafeed: datafeed,
  library_path: LIBRARY_PATH,
  locale: "en",
  timezone: "Etc/UTC",
  theme: "dark",

  // Disabled features
  disabled_features: [
    "use_localstorage_for_settings",
    "header_compare",
    "create_volume_indicator_by_default",
  ],

  // Enabled features - ENHANCED
  enabled_features: [
    "study_templates",
    "dom_widget",
    "trading_account_manager",           // ✅ CRITICAL
    "show_chart_property_page",
    "chart_property_page_trading",
    "trading_notifications",
    "support_manage_broker_config",
  ],

  // Storage (TradingView cloud)
  charts_storage_url: "https://saveload.tradingview.com",
  charts_storage_api_version: "1.1",
  client_id: "tradearena_platform",
  user_id: user.id,

  // Widgetbar
  widgetbar: {
    details: true,
    news: false,
    watchlist: true,
    datawindow: true,
    watchlist_settings: {
      default_symbols: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"],
    },
  },

  // Broker integration - ENHANCED
  broker_factory: brokerFactory,
  broker_config: {
    configFlags: {
      // Core flags
      supportNativeReversePosition: true,
      supportClosePosition: true,
      supportPLUpdate: true,
      
      // Bracket flags - CRITICAL
      supportOrderBrackets: true,
      supportMarketBrackets: true,
      supportPositionBrackets: true,      // ✅ CRITICAL
      supportModifyPosition: true,        // ✅ CRITICAL
      
      // Display flags
      showQuantityInsteadOfAmount: true,
      supportEditAmount: false,
      supportLevel2Data: false,
      supportOrdersHistory: true,
      supportModifyOrder: false,
      
      // Additional flags
      supportDOM: true,
      supportMultiposition: false,
      supportStopLimitOrders: true,
      supportMarketOrders: true,
      supportLimitOrders: true,
      supportStopOrders: true,
    },
    
    durations: [
      { name: "DAY", value: "DAY" },
      { name: "GTC", value: "GTC" },
    ],
    
    customOrderDialog: true,
    showAccountManager: true,
  },
  
  // Loading screen
  loading_screen: {
    backgroundColor: "#131722",
    foregroundColor: "#2962ff",
  },
  
  // Overrides for dark theme
  overrides: {
    "mainSeriesProperties.candleStyle.upColor": "#26a69a",
    "mainSeriesProperties.candleStyle.downColor": "#ef5350",
    "mainSeriesProperties.candleStyle.drawWick": true,
    "mainSeriesProperties.candleStyle.drawBorder": true,
    "mainSeriesProperties.candleStyle.borderUpColor": "#26a69a",
    "mainSeriesProperties.candleStyle.borderDownColor": "#ef5350",
    "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
    "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350",
  },
};
```

## Verification Steps

After updating:

1. **Check Console Logs**:
```javascript
// In browser console after chart loads:
const broker = window.tvWidget._getBroker();
console.log('Broker methods:', {
  supportsBrackets: typeof broker.supportsBrackets,
  editPositionBrackets: typeof broker.editPositionBrackets,
  reversePosition: typeof broker.reversePosition,
  positionActions: typeof broker.positionActions,
});
```

2. **Check Config Flags**:
```javascript
const config = window.tvWidget._options.broker_config;
console.log('Bracket support:', {
  supportPositionBrackets: config.configFlags.supportPositionBrackets,
  supportModifyPosition: config.configFlags.supportModifyPosition,
  supportOrderBrackets: config.configFlags.supportOrderBrackets,
});
```

3. **Test Bracket Dragging**:
   - Place position with SL/TP
   - Look for lines on chart (Red=SL, Green=TP)
   - Try dragging them
   - Check console for `editPositionBrackets` call

4. **Test Context Menu**:
   - Right-click on position in Account Manager
   - Should see: Protect Position, Close Position, Reverse Position
   - Click and verify console logs

## Common Issues

### Lines Don't Appear on Chart
**Fix**: Ensure position data includes `stopLoss` and `takeProfit` properties (even if undefined)

### Can't Drag Lines
**Fix**: Check `supportPositionBrackets: true` and `supportModifyPosition: true` in config

### Context Menu Missing
**Fix**: Verify `contextMenuActions` is properly implemented and returns array

### Edit Button Missing
**Fix**: Add `'editPosition'` to the array returned by `positionActions()`


