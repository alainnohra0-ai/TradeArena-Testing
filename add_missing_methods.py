#!/usr/bin/env python3
"""
Add ONLY the missing methods that TradingView needs
"""

# Read the file
with open('src/lib/tradingview/broker.ts', 'r') as f:
    content = f.read()

# Find where to insert accountsMetainfo and executions
# Insert after editPositionBrackets method

insert_point = '''  async editPositionBrackets(positionId: string, brackets: Brackets): Promise<void> {
    console.log("[TradeArenaBroker] editPositionBrackets:", positionId, brackets);

    try {
      const { data, error } = await supabase.functions.invoke('update-position-brackets', {
        body: {
          position_id: positionId,
          stop_loss: brackets.stopLoss,
          take_profit: brackets.takeProfit,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] Brackets updated:", data);

      toast.success("Brackets updated successfully");
      this.host.positionUpdate?.();
    } catch (error: any) {
      console.error("[TradeArenaBroker] editPositionBrackets error:", error);
      toast.error(error.message || "Failed to update brackets");
      throw error;
    }
  }'''

new_methods = '''  async editPositionBrackets(positionId: string, brackets: Brackets): Promise<void> {
    console.log("[TradeArenaBroker] editPositionBrackets:", positionId, brackets);

    try {
      const { data, error } = await supabase.functions.invoke('update-position-brackets', {
        body: {
          position_id: positionId,
          stop_loss: brackets.stopLoss,
          take_profit: brackets.takeProfit,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] Brackets updated:", data);

      toast.success("Brackets updated successfully");
      this.host.positionUpdate?.();
    } catch (error: any) {
      console.error("[TradeArenaBroker] editPositionBrackets error:", error);
      toast.error(error.message || "Failed to update brackets");
      throw error;
    }
  }

  async accountsMetainfo(): Promise<any[]> {
    return [{
      id: this.accountId,
      name: 'TradeArena Trading Account',
      currency: 'USD',
    }];
  }

  async executions(_symbol: string): Promise<any[]> {
    return [];
  }'''

content = content.replace(insert_point, new_methods)

# Write back
with open('src/lib/tradingview/broker.ts', 'w') as f:
    f.write(content)

print("✅ Added accountsMetainfo() method")
print("✅ Added executions() method")
print("✅ These are required by TradingView for Account Manager and edit buttons")

