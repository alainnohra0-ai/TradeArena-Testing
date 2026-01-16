#!/usr/bin/env python3
"""
Add supportModifyPosition flag to enable edit button functionality
"""

# Read the file
with open('src/components/trading/TradingTerminal.tsx', 'r') as f:
    content = f.read()

# Find and update the configFlags section
old_config = '''          configFlags: {
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
          },'''

new_config = '''          configFlags: {
            supportNativeReversePosition: true,
            supportClosePosition: true,
            supportPLUpdate: true,
            supportLevel2Data: false,
            showQuantityInsteadOfAmount: true,
            supportEditAmount: false,
            supportOrderBrackets: true,
            supportMarketBrackets: true,
            supportPositionBrackets: true,
            supportModifyPosition: true,  // ✅ CRITICAL - Enables edit button and bracket dragging
            supportOrdersHistory: false,
          },'''

content = content.replace(old_config, new_config)

# Write back
with open('src/components/trading/TradingTerminal.tsx', 'w') as f:
    f.write(content)

print("✅ Added supportModifyPosition: true flag")
print("✅ This enables the edit button to open a dialog")
print("✅ This also enables dragging SL/TP lines on chart")

