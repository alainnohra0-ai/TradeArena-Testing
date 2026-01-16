  /**
   * CRITICAL: Tell TradingView which operations are supported per position
   * This enables the edit buttons, context menu, and bracket dragging
   */
  async positionActions(_positionId: string): Promise<string[]> {
    console.log("[TradeArenaBroker] positionActions() called for:", _positionId);
    
    // Return all supported position actions
    // These enable:
    // - editStopLoss: Drag SL line on chart
    // - editTakeProfit: Drag TP line on chart
    // - editPosition: Edit button in position panel
    // - closePosition: Close action in context menu
    // - reversePosition: Reverse action in context menu
    return [
      'editStopLoss',
      'editTakeProfit',
      'editPosition',
      'closePosition',
      'reversePosition'
    ];
  }

