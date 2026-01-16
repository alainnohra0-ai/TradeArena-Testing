  /**
   * TradingView API: reversePosition
   * Closes current position and opens opposite one
   */
  async reversePosition(positionId: string): Promise<void> {
    console.log("[TradeArenaBroker] reversePosition:", positionId);

    try {
      if (!this.competitionId) {
        throw new Error("Competition ID is required to reverse positions");
      }

      // Get current position details
      const { data: position, error: posError } = await supabase
        .from('positions')
        .select(`
          side,
          quantity,
          instrument:instruments!inner(symbol, id)
        `)
        .eq('id', positionId)
        .eq('account_id', this.accountId)
        .single();

      if (posError || !position) {
        throw new Error("Position not found");
      }

      // Close current position
      await this.closePosition(positionId);

      // Wait a bit for close to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Open opposite position with same quantity
      const oppositeSide = position.side === 'buy' ? Side.Sell : Side.Buy;
      await this.placeOrder({
        symbol: position.instrument.symbol,
        type: OrderType.Market,
        side: oppositeSide,
        qty: Math.abs(Number(position.quantity)),
      });

      toast.success("Position reversed successfully");
      this.host.positionUpdate?.();
    } catch (error: any) {
      console.error("[TradeArenaBroker] reversePosition error:", error);
      toast.error(error.message || "Failed to reverse position");
      throw error;
    }
  }

