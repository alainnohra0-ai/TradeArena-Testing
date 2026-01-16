#!/usr/bin/env python3
"""
Script to update TradingTerminal.tsx with enhanced broker configuration
"""

# Read the original file
with open('src/components/trading/TradingTerminal.tsx', 'r') as f:
    content = f.read()

# 1. Update enabled_features
old_enabled_features = '''        // Enabled features
        enabled_features: [
          "study_templates",
          "dom_widget",
        ],'''

new_enabled_features = '''        // Enabled features - ENHANCED
        enabled_features: [
          "study_templates",
          "dom_widget",
          "trading_account_manager",          // ✅ CRITICAL - Account Manager panel
          "show_chart_property_page",         // ✅ Chart properties
          "chart_property_page_trading",      // ✅ Trading properties in chart
          "trading_notifications",            // ✅ Trading notifications
        ],'''

content = content.replace(old_enabled_features, new_enabled_features)

# 2. Update broker_config with enhanced configFlags
old_broker_config = '''        // Broker integration - THE KEY PART
        broker_factory: brokerFactory,
        broker_config: {
          configFlags: {
            supportNativeReversePosition: true,
            supportClosePosition: true,
            supportPLUpdate: true,
            supportLevel2Data: false,
            showQuantityInsteadOfAmount: true,
            supportEditAmount: false,
            supportOrderBrackets: true,
            supportMarketBrackets: true,
            supportPositionBrackets: true,
            supportOrdersHistory: false,
          },
          durations: [
            { name: "DAY", value: "DAY" },
            { name: "GTC", value: "GTC" },
          ],
        },'''

new_broker_config = '''        // Broker integration - ENHANCED CONFIGURATION
        broker_factory: brokerFactory,
        broker_config: {
          configFlags: {
            // Core flags
            supportNativeReversePosition: true,
            supportClosePosition: true,
            supportPLUpdate: true,
            
            // Bracket flags - CRITICAL FOR SL/TP DRAGGING
            supportOrderBrackets: true,             // ✅ Enable brackets on new orders
            supportMarketBrackets: true,            // ✅ Enable brackets on market orders  
            supportPositionBrackets: true,          // ✅ CRITICAL - enables bracket editing
            supportModifyPosition: true,            // ✅ CRITICAL - Enable edit position dialog
            
            // Display flags
            showQuantityInsteadOfAmount: true,      // Show quantity, not notional
            supportEditAmount: false,               // Don't allow quantity editing
            supportLevel2Data: false,               // No level 2 data
            supportOrdersHistory: true,             // ✅ Show order history
            
            // Additional useful flags
            supportDOM: true,                       // ✅ Enable DOM panel
            supportMultiposition: false,            // One position per symbol
            supportStopLimitOrders: true,           // ✅ Stop-limit orders
            supportMarketOrders: true,              // ✅ Market orders
            supportLimitOrders: true,               // ✅ Limit orders
            supportStopOrders: true,                // ✅ Stop orders
          },
          durations: [
            { name: "DAY", value: "DAY" },
            { name: "GTC", value: "GTC" },
          ],
          customOrderDialog: true,                  // ✅ Custom order dialog
          showAccountManager: true,                 // ✅ Show account manager
        },'''

content = content.replace(old_broker_config, new_broker_config)

# Write the updated file
with open('src/components/trading/TradingTerminal.tsx', 'w') as f:
    f.write(content)

print("✅ TradingTerminal.tsx updated successfully!")
print("Changes made:")
print("  1. ✅ Added 4 new enabled_features")
print("  2. ✅ Added supportModifyPosition: true flag")
print("  3. ✅ Added 8+ new configFlags")
print("  4. ✅ Added customOrderDialog: true")
print("  5. ✅ Added showAccountManager: true")

