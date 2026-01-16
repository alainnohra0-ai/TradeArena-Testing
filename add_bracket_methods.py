#!/usr/bin/env python3
"""
Add methods needed for bracket editing (edit button and drag functionality)
"""

# Read the file
with open('src/lib/tradingview/broker.ts', 'r') as f:
    content = f.read()

# Add supportsBrackets and positionActions methods after isTradable
insert_point = '''  async isTradable(_symbol: string): Promise<boolean> {
    return true;
  }'''

new_methods = '''  async isTradable(_symbol: string): Promise<boolean> {
    return true;
  }

  /**
   * Tell TradingView this broker supports position brackets
   */
  supportsBrackets(): boolean {
    console.log("[TradeArenaBroker] supportsBrackets() - returning true");
    return true;
  }

  /**
   * Tell TradingView which operations are supported per position
   */
  async positionActions(_positionId: string): Promise<string[]> {
    console.log("[TradeArenaBroker] positionActions() called");
    return ['editStopLoss', 'editTakeProfit', 'editPosition', 'closePosition'];
  }'''

content = content.replace(insert_point, new_methods)

# Also add modifyPosition as an alternative to editPositionBrackets
# Insert after executions method
insert_point2 = '''  async executions(_symbol: string): Promise<any[]> {
    return [];
  }'''

new_method2 = '''  async executions(_symbol: string): Promise<any[]> {
    return [];
  }

  async modifyPosition(positionId: string, data: any): Promise<void> {
    console.log("[TradeArenaBroker] modifyPosition:", positionId, data);
    
    const brackets: Brackets = {
      stopLoss: data.stopLoss,
      takeProfit: data.takeProfit,
    };
    
    await this.editPositionBrackets(positionId, brackets);
  }'''

content = content.replace(insert_point2, new_method2)

# Write back
with open('src/lib/tradingview/broker.ts', 'w') as f:
    f.write(content)

print("✅ Added supportsBrackets() method")
print("✅ Added positionActions() method")
print("✅ Added modifyPosition() method")
print("")
print("These methods tell TradingView:")
print("  - Bracket editing is supported")
print("  - Which actions are available per position")
print("  - How to modify positions")

