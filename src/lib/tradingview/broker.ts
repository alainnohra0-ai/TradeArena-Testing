/**
 * TradeArena Broker Implementation - Based on TradingView broker-sample
 * 
 * CRITICAL UNDERSTANDING FROM TRADINGVIEW SAMPLE:
 * 1. Position objects MUST have takeProfit and stopLoss fields directly
 * 2. editPositionBrackets updates position AND can create bracket orders
 * 3. host.positionUpdate(position) needs the FULL position object
 * 4. Brackets are stored as separate Order objects with parentId pointing to position
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// TradingView Broker API enums (from broker-api.d.ts)
export enum ConnectionStatus {
  Connected = 1,
  Connecting = 2,
  Disconnected = 3,
  Error = 4,
}

export enum Side {
  Buy = 1,
  Sell = -1,
}

export enum OrderType {
  Limit = 1,
  Market = 2,
  Stop = 3,
  StopLimit = 4,
}

export enum OrderStatus {
  Canceled = 1,
  Filled = 2,
  Inactive = 3,
  Placing = 4,
  Rejected = 5,
  Working = 6,
}

export enum ParentType {
  Order = 1,
  Position = 2,
}

export enum StandardFormatterName {
  Fixed = "fixed",
  FormatQuantity = "formatQuantity",
  FormatPrice = "formatPrice",
  Profit = "profit",
  Side = "side",
  PositionSide = "positionSide",
  Status = "status",
  Symbol = "symbol",
  Type = "type",
}

export const CommonAccountManagerColumnId = {
  Symbol: "symbol",
};

// TradingView Position interface - MUST include stopLoss and takeProfit
export interface Position {
  id: string;
  symbol: string;
  qty: number;
  side: Side;
  avgPrice: number;
  pl?: number;
  last?: number;
  stopLoss?: number;    // CRITICAL: Must be on position for bracket editing
  takeProfit?: number;  // CRITICAL: Must be on position for bracket editing
}

// TradingView Order interface
export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: Side;
  qty: number;
  status: OrderStatus;
  limitPrice?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  parentId?: string;
  parentType?: ParentType;
  last?: number;
}

export interface PreOrder {
  symbol: string;
  type: OrderType;
  side: Side;
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  isClose?: boolean;
}

export interface Brackets {
  stopLoss?: number;
  takeProfit?: number;
}

export interface InstrumentInfo {
  qty: { min: number; max: number; step: number; default?: number };
  pipSize: number;
  pipValue: number;
  minTick: number;
  description: string;
}

interface InstrumentCache {
  id: string;
  leverage: number;
  contract_size: number;
}

/**
 * TradeArena Broker Class - Implements IBrokerTerminal
 * Based on TradingView's broker-sample implementation
 */
export class TradeArenaBroker {
  private _host: any;
  private _accountId: string;
  private _competitionId: string | undefined;
  private _userId: string;
  
  private _balanceValue: any;
  private _equityValue: any;
  
  private _pollingInterval: NodeJS.Timeout | null = null;
  private _instrumentCache: Map<string, InstrumentCache> = new Map();
  
  // Store positions and orders in memory (like broker-sample does)
  private _positions: Position[] = [];
  private _positionById: Map<string, Position> = new Map();
  private _orderById: Map<string, Order> = new Map();

  constructor(
    host: any,
    config: {
      accountId: string;
      userId: string;
      competitionId?: string;
    }
  ) {
    this._host = host;
    this._accountId = config.accountId;
    this._userId = config.userId;
    this._competitionId = config.competitionId;

    // Create watched values for account summary
    this._balanceValue = this._host.factory.createWatchedValue(0);
    this._equityValue = this._host.factory.createWatchedValue(0);

    // Initialize data
    this._loadInitialData();
    this._startPolling();
    
    console.log("[TradeArenaBroker] Initialized", config);
  }

  // ============================================================
  // CONNECTION & ACCOUNT METHODS
  // ============================================================

  connectionStatus(): ConnectionStatus {
    return ConnectionStatus.Connected;
  }

  currentAccount(): string {
    return this._accountId;
  }

  async accountsMetainfo(): Promise<any[]> {
    return [{
      id: this._accountId,
      name: 'TradeArena Trading Account',
      currency: 'USD',
    }];
  }

  // ============================================================
  // SYMBOL METHODS
  // ============================================================

  async isTradable(_symbol: string): Promise<boolean> {
    return true;
  }

  async symbolInfo(symbol: string): Promise<InstrumentInfo> {
    try {
      const mintick = await this._host.getSymbolMinTick(symbol);
      return {
        qty: { min: 0.01, max: 1000000, step: 0.01, default: 0.1 },
        pipSize: mintick || 0.0001,
        pipValue: mintick || 0.0001,
        minTick: mintick || 0.0001,
        description: symbol,
      };
    } catch (error) {
      return {
        qty: { min: 0.01, max: 1000000, step: 0.01, default: 0.1 },
        pipSize: 0.0001,
        pipValue: 0.0001,
        minTick: 0.0001,
        description: symbol,
      };
    }
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  private async _loadInitialData(): Promise<void> {
    await this._loadPositions();
    await this._updateAccountData();
  }

  private async _loadPositions(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select(`
          id,
          side,
          quantity,
          entry_price,
          current_price,
          unrealized_pnl,
          stop_loss,
          take_profit,
          status,
          instrument:instruments!inner(symbol, name)
        `)
        .eq('account_id', this._accountId)
        .eq('status', 'open');

      if (error) {
        console.error("[TradeArenaBroker] _loadPositions error:", error);
        return;
      }

      // Clear existing positions
      this._positions = [];
      this._positionById.clear();

      // Build position objects
      for (const pos of (data || [])) {
        const position: Position = {
          id: pos.id,
          symbol: pos.instrument?.symbol || 'UNKNOWN',
          qty: Math.abs(Number(pos.quantity)),
          side: pos.side === 'buy' ? Side.Buy : Side.Sell,
          avgPrice: Number(pos.entry_price),
          pl: Number(pos.unrealized_pnl || 0),
          last: pos.current_price ? Number(pos.current_price) : Number(pos.entry_price),
          // CRITICAL: Include stopLoss and takeProfit directly on position
          stopLoss: pos.stop_loss ? Number(pos.stop_loss) : undefined,
          takeProfit: pos.take_profit ? Number(pos.take_profit) : undefined,
        };

        this._positions.push(position);
        this._positionById.set(position.id, position);
      }

      console.log("[TradeArenaBroker] 📊 Loaded", this._positions.length, "positions");
    } catch (error) {
      console.error("[TradeArenaBroker] _loadPositions error:", error);
    }
  }

  // ============================================================
  // POSITIONS - Required by IBrokerTerminal
  // ============================================================

  async positions(): Promise<Position[]> {
    // Return a copy of positions array (like broker-sample does)
    return this._positions.slice();
  }

  // ============================================================
  // ORDERS - Required by IBrokerTerminal
  // ============================================================

  async orders(): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          side,
          quantity,
          limit_price,
          stop_price,
          order_type,
          status,
          stop_loss,
          take_profit,
          instrument:instruments!inner(symbol, name)
        `)
        .eq('account_id', this._accountId)
        .eq('status', 'pending');

      if (error) {
        console.error("[TradeArenaBroker] orders error:", error);
        return [];
      }

      return (data || []).map((order: any) => {
        let orderType = OrderType.Market;
        if (order.order_type === 'limit') orderType = OrderType.Limit;
        else if (order.order_type === 'stop') orderType = OrderType.Stop;
        else if (order.order_type === 'stop_limit') orderType = OrderType.StopLimit;

        return {
          id: order.id,
          symbol: order.instrument?.symbol || 'UNKNOWN',
          type: orderType,
          side: order.side === 'buy' ? Side.Buy : Side.Sell,
          qty: Math.abs(Number(order.quantity)),
          status: OrderStatus.Working,
          limitPrice: order.limit_price ? Number(order.limit_price) : undefined,
          stopPrice: order.stop_price ? Number(order.stop_price) : undefined,
          stopLoss: order.stop_loss ? Number(order.stop_loss) : undefined,
          takeProfit: order.take_profit ? Number(order.take_profit) : undefined,
        };
      });
    } catch (error) {
      console.error("[TradeArenaBroker] orders error:", error);
      return [];
    }
  }

  async executions(_symbol: string): Promise<any[]> {
    return [];
  }

  // ============================================================
  // POSITION BRACKET EDITING - THE CRITICAL METHOD
  // This is called when:
  // - User clicks Edit button in Account Manager
  // - User drags SL/TP lines on chart
  // - User uses context menu "Edit position..."
  // ============================================================

  async editPositionBrackets(positionId: string, brackets: Brackets): Promise<void> {
    console.log("[TradeArenaBroker] 🎯 editPositionBrackets called:", positionId, brackets);

    // Get the position from our local cache
    const position = this._positionById.get(positionId);
    
    if (!position) {
      console.error("[TradeArenaBroker] Position not found:", positionId);
      throw new Error("Position not found");
    }

    try {
      // Call backend to update brackets
      const { data, error } = await supabase.functions.invoke('update-position-brackets', {
        body: {
          position_id: positionId,
          stop_loss: brackets.stopLoss,
          take_profit: brackets.takeProfit,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] ✅ Backend updated brackets:", data);

      // CRITICAL: Update local position object with new brackets
      position.stopLoss = brackets.stopLoss;
      position.takeProfit = brackets.takeProfit;

      // CRITICAL: Notify TradingView that position has been updated
      // This is what makes the chart update!
      this._host.positionUpdate(position);

      console.log("[TradeArenaBroker] ✅ positionUpdate called with:", position);
      toast.success("Brackets updated successfully");

    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ editPositionBrackets error:", error);
      toast.error(error.message || "Failed to update brackets");
      throw error;
    }
  }

  // ============================================================
  // INSTRUMENT HELPERS
  // ============================================================

  private async _getInstrumentData(symbol: string): Promise<InstrumentCache> {
    if (this._instrumentCache.has(symbol)) {
      return this._instrumentCache.get(symbol)!;
    }

    const { data, error } = await supabase
      .from('instruments')
      .select('id, leverage_default, contract_size')
      .eq('symbol', symbol)
      .single();

    if (error || !data) {
      throw new Error(`Instrument ${symbol} not found`);
    }

    const result: InstrumentCache = { 
      id: data.id, 
      leverage: data.leverage_default || 10,
      contract_size: data.contract_size || 1
    };
    
    this._instrumentCache.set(symbol, result);
    return result;
  }

  // ============================================================
  // ORDER PLACEMENT
  // ============================================================

  async placeOrder(preOrder: PreOrder): Promise<{ orderId: string }> {
    console.log("[TradeArenaBroker] 📥 placeOrder:", preOrder);

    try {
      if (!this._competitionId) {
        throw new Error("Competition ID is required to place orders");
      }

      const instrument = await this._getInstrumentData(preOrder.symbol);

      let orderType: 'market' | 'limit' | 'stop' | 'stop_limit' = 'market';
      if (preOrder.type === OrderType.Limit) orderType = 'limit';
      else if (preOrder.type === OrderType.Stop) orderType = 'stop';
      else if (preOrder.type === OrderType.StopLimit) orderType = 'stop_limit';

      const leverage = preOrder.leverage || instrument.leverage || 10;

      const requestBody = {
        competition_id: this._competitionId,
        instrument_id: instrument.id,
        side: preOrder.side === Side.Buy ? 'buy' : 'sell',
        quantity: preOrder.qty,
        leverage: leverage,
        stop_loss: preOrder.stopLoss,
        take_profit: preOrder.takeProfit,
        order_type: orderType,
        requested_price: preOrder.limitPrice || preOrder.stopPrice,
        create_new_position: !preOrder.isClose
      };

      const { data, error } = await supabase.functions.invoke('place-order', {
        body: requestBody,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] ✅ Order placed:", data);
      toast.success("Order placed successfully");

      // Reload positions after order placement
      await this._loadPositions();
      
      // Notify TradingView to refresh
      if (this._host.positionsFullUpdate) {
        this._host.positionsFullUpdate();
      }

      return { orderId: data.order_id || 'order_' + Date.now() };
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ placeOrder error:", error);
      toast.error(error.message || "Failed to place order");
      throw error;
    }
  }

  // ============================================================
  // ORDER MODIFICATION
  // ============================================================

  async modifyOrder(order: Order): Promise<void> {
    console.log("[TradeArenaBroker] 🔧 modifyOrder:", order);
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          limit_price: order.limitPrice,
          stop_price: order.stopPrice,
          stop_loss: order.stopLoss,
          take_profit: order.takeProfit,
          quantity: order.qty,
        })
        .eq('id', order.id)
        .eq('account_id', this._accountId);

      if (error) throw new Error(error.message);

      toast.success("Order modified successfully");
      this._host.orderUpdate(order);
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ modifyOrder error:", error);
      toast.error(error.message || "Failed to modify order");
      throw error;
    }
  }

  // ============================================================
  // ORDER CANCELLATION
  // ============================================================

  async cancelOrder(orderId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🚫 cancelOrder:", orderId);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('account_id', this._accountId);

      if (error) throw new Error(error.message);

      toast.success("Order cancelled successfully");
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ cancelOrder error:", error);
      toast.error(error.message || "Failed to cancel order");
      throw error;
    }
  }

  // ============================================================
  // POSITION CLOSING
  // ============================================================

  async closePosition(positionId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🚪 closePosition:", positionId);

    try {
      if (!this._competitionId) {
        throw new Error("Competition ID is required to close positions");
      }

      const { data, error } = await supabase.functions.invoke('close-position', {
        body: {
          position_id: positionId,
          competition_id: this._competitionId,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] ✅ Position closed:", data);
      toast.success("Position closed successfully");

      // Remove from local cache
      const position = this._positionById.get(positionId);
      if (position) {
        // Set qty to 0 to indicate closed (like broker-sample does)
        position.qty = 0;
        this._host.positionUpdate(position);
        
        // Remove from arrays
        this._positionById.delete(positionId);
        this._positions = this._positions.filter(p => p.id !== positionId);
      }

    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ closePosition error:", error);
      toast.error(error.message || "Failed to close position");
      throw error;
    }
  }

  // ============================================================
  // POSITION REVERSAL
  // ============================================================

  async reversePosition(positionId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🔄 reversePosition:", positionId);

    const position = this._positionById.get(positionId);
    if (!position) {
      throw new Error("Position not found");
    }

    try {
      // Close current and open opposite (like broker-sample)
      await this.placeOrder({
        symbol: position.symbol,
        side: position.side === Side.Buy ? Side.Sell : Side.Buy,
        type: OrderType.Market,
        qty: position.qty * 2, // Double qty to reverse
      });

      toast.success("Position reversed successfully");
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ reversePosition error:", error);
      toast.error(error.message || "Failed to reverse position");
      throw error;
    }
  }

  // ============================================================
  // ACCOUNT MANAGER INFO
  // ============================================================

  accountManagerInfo() {
    return {
      accountTitle: "TradeArena",
      summary: [
        {
          text: "Balance",
          wValue: this._balanceValue,
          formatter: StandardFormatterName.Fixed,
          isDefault: true,
        },
        {
          text: "Equity",
          wValue: this._equityValue,
          formatter: StandardFormatterName.Fixed,
          isDefault: true,
        },
      ],
      orderColumns: [
        {
          label: "Symbol",
          formatter: StandardFormatterName.Symbol,
          id: CommonAccountManagerColumnId.Symbol,
          dataFields: ["symbol", "symbol"],
        },
        {
          label: "Side",
          id: "side",
          dataFields: ["side"],
          formatter: StandardFormatterName.Side,
        },
        {
          label: "Type",
          id: "type",
          dataFields: ["type", "parentId", "stopType"],
          formatter: StandardFormatterName.Type,
        },
        {
          label: "Qty",
          alignment: "right",
          id: "qty",
          dataFields: ["qty"],
          formatter: StandardFormatterName.FormatQuantity,
        },
        {
          label: "Limit",
          alignment: "right",
          id: "limitPrice",
          dataFields: ["limitPrice"],
          formatter: StandardFormatterName.FormatPrice,
        },
        {
          label: "Status",
          id: "status",
          dataFields: ["status"],
          formatter: StandardFormatterName.Status,
        },
      ],
      positionColumns: [
        {
          label: "Symbol",
          formatter: StandardFormatterName.Symbol,
          id: CommonAccountManagerColumnId.Symbol,
          dataFields: ["symbol", "symbol"],
        },
        {
          label: "Side",
          id: "side",
          dataFields: ["side"],
          formatter: StandardFormatterName.PositionSide,
        },
        {
          label: "Qty",
          alignment: "right",
          id: "qty",
          dataFields: ["qty"],
          formatter: StandardFormatterName.FormatQuantity,
        },
        {
          label: "Avg Price",
          alignment: "right",
          id: "avgPrice",
          dataFields: ["avgPrice"],
          formatter: StandardFormatterName.FormatPrice,
        },
        {
          label: "P&L",
          alignment: "right",
          id: "pl",
          dataFields: ["pl"],
          formatter: StandardFormatterName.Profit,
        },
        {
          label: "SL",
          alignment: "right",
          id: "stopLoss",
          dataFields: ["stopLoss"],
          formatter: StandardFormatterName.FormatPrice,
        },
        {
          label: "TP",
          alignment: "right",
          id: "takeProfit",
          dataFields: ["takeProfit"],
          formatter: StandardFormatterName.FormatPrice,
        },
      ],
      pages: [],
      contextMenuActions: (e: MouseEvent | TouchEvent, activePageActions: any[]) => {
        return Promise.resolve(this._contextMenuItems(activePageActions));
      },
    };
  }

  private _contextMenuItems(activePageActions: any[]): any[] {
    const separator = { separator: true };
    const sellBuyButtonsVisibility = this._host.sellBuyButtonsVisibility?.();

    const items: any[] = [...(activePageActions || [])];
    
    if (items.length > 0) {
      items.push(separator);
    }

    items.push({
      text: 'Show Buy/Sell Buttons',
      action: () => {
        if (sellBuyButtonsVisibility) {
          sellBuyButtonsVisibility.setValue(!sellBuyButtonsVisibility.value());
        }
      },
      checkable: true,
      checked: sellBuyButtonsVisibility?.value() ?? false,
    });

    items.push({
      text: 'Trading Settings...',
      action: () => {
        this._host.showTradingProperties?.();
      },
    });

    return items;
  }

  // ============================================================
  // CHART CONTEXT MENU
  // ============================================================

  async chartContextMenuActions(context: any, options?: any): Promise<any[]> {
    if (this._host.defaultContextMenuActions) {
      return this._host.defaultContextMenuActions(context, options);
    }
    return [];
  }

  // ============================================================
  // EQUITY SUBSCRIPTION (for Order Ticket risk calculation)
  // ============================================================

  subscribeEquity(): void {
    console.log("[TradeArenaBroker] subscribeEquity");
    // Send current equity
    this._host.equityUpdate?.(this._equityValue.value());
  }

  unsubscribeEquity(): void {
    console.log("[TradeArenaBroker] unsubscribeEquity");
  }

  // ============================================================
  // POLLING & CLEANUP
  // ============================================================

  private _startPolling(): void {
    this._pollingInterval = setInterval(async () => {
      await this._updateAccountData();
      await this._updatePositionPrices();
    }, 5000);
  }

  private async _updateAccountData(): Promise<void> {
    try {
      const { data } = await supabase
        .from('accounts')
        .select('balance, equity')
        .eq('id', this._accountId)
        .single();

      if (data) {
        this._balanceValue.setValue(Number(data.balance || 0));
        this._equityValue.setValue(Number(data.equity || 0));
      }
    } catch (error) {
      console.error("[TradeArenaBroker] _updateAccountData error:", error);
    }
  }

  private async _updatePositionPrices(): Promise<void> {
    // Update P&L for positions based on current prices
    for (const position of this._positions) {
      if (position.last) {
        const priceDiff = position.side === Side.Buy 
          ? position.last - position.avgPrice 
          : position.avgPrice - position.last;
        position.pl = priceDiff * position.qty;
        
        // Notify TradingView of P&L update
        this._host.plUpdate?.(position.symbol, position.pl);
        this._host.positionPartialUpdate?.(position.id, { pl: position.pl });
      }
    }
  }

  destroy(): void {
    console.log("[TradeArenaBroker] 💀 Destroying");
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
      this._pollingInterval = null;
    }
    this._instrumentCache.clear();
    this._positionById.clear();
    this._positions = [];
  }
}

// Factory function
export function createTradeArenaBroker(
  host: any,
  config: {
    accountId: string;
    userId: string;
    competitionId?: string;
  }
): TradeArenaBroker {
  return new TradeArenaBroker(host, config);
}

