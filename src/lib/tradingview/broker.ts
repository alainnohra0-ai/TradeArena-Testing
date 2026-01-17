/**
 * TradeArena Broker Implementation - Based on TradingView broker-sample
 * 
 * Features:
 * - Position management (open, close, reverse)
 * - Bracket editing (SL/TP) with drag support
 * - Real-time P&L calculation with contract size
 * - Account Manager integration
 * - Multiple accounts support (for competitions)
 * - P&L preview for SL/TP brackets
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// TradingView Broker API enums
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

// Extended Position interface with contract size for P&L
export interface Position {
  id: string;
  symbol: string;
  qty: number;
  side: Side;
  avgPrice: number;
  pl?: number;
  last?: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  contractSize?: number;
}

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
  price?: number;
  avgPrice?: number;
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

// Account info for multiple account support
interface AccountInfo {
  id: string;
  name: string;
  currency: string;
  balance?: number;
  competitionName?: string;
}

function changeSide(side: Side): Side {
  return side === Side.Buy ? Side.Sell : Side.Buy;
}

export class TradeArenaBroker {
  private _host: any;
  private _accountId: string;
  private _competitionId: string | undefined;
  private _userId: string;
  
  private _balanceValue: any;
  private _equityValue: any;
  
  private _pollingInterval: NodeJS.Timeout | null = null;
  private _instrumentCache: Map<string, InstrumentCache> = new Map();
  private _idsCounter: number = 1;
  
  private _positions: Position[] = [];
  private _positionById: Map<string, Position> = new Map();
  private _orderById: Map<string, Order> = new Map();
  private _initialDataLoaded: boolean = false;
  
  // Multiple accounts support
  private _accounts: AccountInfo[] = [];
  private _accountsLoaded: boolean = false;

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

    this._balanceValue = this._host.factory.createWatchedValue(0);
    this._equityValue = this._host.factory.createWatchedValue(0);

    // Load accounts first, then initial data
    this._loadUserAccounts().then(() => {
      this._loadInitialDataAndNotify();
    });
    this._startPolling();
    
    console.log("[TradeArenaBroker] Initialized", config);
  }

  connectionStatus(): ConnectionStatus {
    return ConnectionStatus.Connected;
  }

  currentAccount(): string {
    return this._accountId;
  }

  /**
   * Load all competition accounts for this user
   * This enables the account switcher in TradingView's Account Manager
   */
  private async _loadUserAccounts(): Promise<void> {
    try {
      console.log("[TradeArenaBroker] Loading user accounts for userId:", this._userId);
      
      // Query competition_participants to get all accounts for this user
      const { data, error } = await supabase
        .from('competition_participants')
        .select(`
          account_id,
          competition:competitions!inner(id, name),
          account:accounts!inner(id, balance, equity)
        `)
        .eq('user_id', this._userId);

      if (error) {
        console.error("[TradeArenaBroker] Failed to load user accounts:", error);
        // Fallback to single account
        this._accounts = [{
          id: this._accountId,
          name: 'TradeArena Trading Account',
          currency: 'USD',
        }];
        return;
      }

      if (!data || data.length === 0) {
        console.log("[TradeArenaBroker] No competition accounts found, using default");
        this._accounts = [{
          id: this._accountId,
          name: 'TradeArena Trading Account',
          currency: 'USD',
        }];
        return;
      }

      // Map to AccountInfo format
      this._accounts = data.map((row: any) => ({
        id: row.account_id,
        name: row.competition?.name || 'Trading Account',
        currency: 'USD',
        balance: row.account?.balance,
        competitionName: row.competition?.name,
      }));

      console.log("[TradeArenaBroker] ✅ Loaded", this._accounts.length, "accounts:", this._accounts);
      this._accountsLoaded = true;

    } catch (error) {
      console.error("[TradeArenaBroker] _loadUserAccounts error:", error);
      this._accounts = [{
        id: this._accountId,
        name: 'TradeArena Trading Account',
        currency: 'USD',
      }];
    }
  }

  /**
   * Returns list of accounts for TradingView's account switcher dropdown
   */
  async accountsMetainfo(): Promise<any[]> {
    // Wait for accounts to load if not ready
    if (!this._accountsLoaded && this._accounts.length === 0) {
      await this._loadUserAccounts();
    }

    // Return accounts in TradingView's expected format
    return this._accounts.map(acc => ({
      id: acc.id,
      name: acc.competitionName ? `${acc.competitionName}` : acc.name,
      currency: acc.currency,
    }));
  }

  /**
   * Called by TradingView when user switches accounts in the dropdown
   */
  async setCurrentAccount(accountId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🔄 Switching to account:", accountId);
    
    if (accountId === this._accountId) {
      console.log("[TradeArenaBroker] Already on this account");
      return;
    }

    // Find the account to get its competition ID
    const account = this._accounts.find(a => a.id === accountId);
    if (!account) {
      console.error("[TradeArenaBroker] Account not found:", accountId);
      throw new Error("Account not found");
    }

    // Update current account
    this._accountId = accountId;
    
    // Clear caches
    this._positions = [];
    this._positionById.clear();
    this._orderById.clear();

    // Find competition ID for this account
    try {
      const { data } = await supabase
        .from('competition_participants')
        .select('competition_id')
        .eq('account_id', accountId)
        .eq('user_id', this._userId)
        .single();
      
      if (data) {
        this._competitionId = data.competition_id;
        console.log("[TradeArenaBroker] Updated competition ID:", this._competitionId);
      }
    } catch (error) {
      console.error("[TradeArenaBroker] Failed to get competition ID:", error);
    }

    // Reload all data for new account
    await this._loadInitialDataAndNotify();
    await this._updateAccountData();

    // Notify TradingView of account switch
    this._host.currentAccountUpdate?.();
    
    toast.success(`Switched to ${account.name}`);
    console.log("[TradeArenaBroker] ✅ Account switch complete");
  }

  async isTradable(_symbol: string): Promise<boolean> {
    return true;
  }

  async symbolInfo(symbol: string): Promise<InstrumentInfo> {
    try {
      const mintick = await this._host.getSymbolMinTick(symbol);
      const pipSize = mintick || 0.0001;
      
      // Get contract size for proper pipValue calculation
      // pipValue = pipSize * contractSize (e.g., 0.0001 * 100000 = $10 per pip for forex)
      let contractSize = 100000; // Default for forex
      try {
        const instrument = await this._getInstrumentData(symbol);
        contractSize = instrument.contract_size || 100000;
      } catch {
        // Default contract sizes based on symbol type
        if (['XAUUSD', 'XAGUSD'].includes(symbol)) {
          contractSize = 100; // Metals
        } else if (symbol.includes('BTC') || symbol.includes('ETH')) {
          contractSize = 1; // Crypto
        } else if (symbol.length === 6) {
          contractSize = 100000; // Forex pairs
        }
      }
      
      const pipValue = pipSize * contractSize;
      
      return {
        qty: { min: 0.01, max: 1000, step: 0.01, default: 0.1 },
        pipSize: pipSize,
        pipValue: pipValue,
        minTick: pipSize,
        description: symbol,
      };
    } catch (error) {
      // Fallback with forex defaults
      return {
        qty: { min: 0.01, max: 1000, step: 0.01, default: 0.1 },
        pipSize: 0.0001,
        pipValue: 10, // Default for forex: 0.0001 * 100000
        minTick: 0.0001,
        description: symbol,
      };
    }
  }

  /**
   * Calculate P&L for bracket order preview (SL/TP lines on chart)
   * Called by TradingView when user drags SL/TP lines to show potential P&L
   */
  async calculatePLForBracketOrder(
    positionId: string,
    brackets: Brackets
  ): Promise<{ pl: number; plPercent: number }> {
    const position = this._positionById.get(positionId);
    
    if (!position) {
      return { pl: 0, plPercent: 0 };
    }

    // Get contract size for P&L calculation
    let contractSize = position.contractSize || 100000;
    try {
      const instrument = await this._getInstrumentData(position.symbol);
      contractSize = instrument.contract_size || 100000;
    } catch {
      // Use default
    }

    // Calculate P&L for the bracket level (SL or TP)
    const bracketPrice = brackets.stopLoss || brackets.takeProfit || position.avgPrice;
    const priceDiff = position.side === Side.Buy 
      ? bracketPrice - position.avgPrice 
      : position.avgPrice - bracketPrice;
    
    // P&L = priceDiff × qty × contractSize
    const pl = priceDiff * position.qty * contractSize;
    
    // Calculate percentage based on position value
    const positionValue = position.avgPrice * position.qty * contractSize;
    const plPercent = positionValue > 0 ? (pl / positionValue) * 100 : 0;

    console.log("[TradeArenaBroker] calculatePLForBracketOrder:", {
      positionId,
      brackets,
      avgPrice: position.avgPrice,
      bracketPrice,
      priceDiff,
      qty: position.qty,
      contractSize,
      pl,
      plPercent,
    });

    return { pl, plPercent };
  }

  private async _loadInitialDataAndNotify(): Promise<void> {
    await this._loadPositions();
    await this._updateAccountData();
    
    for (const position of this._positions) {
      this._host.positionUpdate(position);
    }
    
    this._initialDataLoaded = true;
    console.log("[TradeArenaBroker] ✅ Initial data loaded and notified", this._positions.length, "positions");
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
          instrument:instruments!inner(symbol, name, contract_size)
        `)
        .eq('account_id', this._accountId)
        .eq('status', 'open');

      if (error) {
        console.error("[TradeArenaBroker] _loadPositions error:", error);
        return;
      }

      this._positions = [];
      this._positionById.clear();

      for (const pos of (data || [])) {
        const avgPrice = Number(pos.entry_price);
        const currentPrice = pos.current_price ? Number(pos.current_price) : avgPrice;
        const contractSize = pos.instrument?.contract_size || 100000;
        
        // Calculate P&L using contract size
        // P&L = (currentPrice - avgPrice) × qty × contractSize for BUY
        // P&L = (avgPrice - currentPrice) × qty × contractSize for SELL
        const priceDiff = pos.side === 'buy' 
          ? currentPrice - avgPrice 
          : avgPrice - currentPrice;
        const calculatedPl = priceDiff * Math.abs(Number(pos.quantity)) * contractSize;
        
        const position: Position = {
          id: pos.id,
          symbol: pos.instrument?.symbol || 'UNKNOWN',
          qty: Math.abs(Number(pos.quantity)),
          side: pos.side === 'buy' ? Side.Buy : Side.Sell,
          avgPrice: avgPrice,
          price: avgPrice,
          // Use calculated P&L if unrealized_pnl is 0 or null
          pl: Number(pos.unrealized_pnl) || calculatedPl,
          last: currentPrice,
          stopLoss: pos.stop_loss ? Number(pos.stop_loss) : undefined,
          takeProfit: pos.take_profit ? Number(pos.take_profit) : undefined,
          contractSize: contractSize,
        };

        this._positions.push(position);
        this._positionById.set(position.id, position);
      }

      console.log("[TradeArenaBroker] 📊 Loaded", this._positions.length, "positions");
    } catch (error) {
      console.error("[TradeArenaBroker] _loadPositions error:", error);
    }
  }

  private async _reloadAndNotifyPositions(): Promise<void> {
    const oldPositionIds = new Set(this._positionById.keys());
    
    await this._loadPositions();
    
    for (const position of this._positions) {
      this._host.positionUpdate(position);
    }
    
    for (const oldId of oldPositionIds) {
      if (!this._positionById.has(oldId)) {
        this._host.positionUpdate({ id: oldId, qty: 0 } as Position);
      }
    }
    
    console.log("[TradeArenaBroker] 🔄 Reloaded and notified", this._positions.length, "positions");
  }

  async positions(): Promise<Position[]> {
    return this._positions.slice();
  }

  async orders(): Promise<Order[]> {
    return Array.from(this._orderById.values());
  }

  async executions(_symbol: string): Promise<any[]> {
    return [];
  }

  async editPositionBrackets(positionId: string, brackets: Brackets): Promise<void> {
    console.log("[TradeArenaBroker] 🎯 editPositionBrackets called:", positionId, brackets);

    const position = this._positionById.get(positionId);
    
    if (!position) {
      console.error("[TradeArenaBroker] Position not found:", positionId);
      throw new Error("Position not found");
    }

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

      console.log("[TradeArenaBroker] ✅ Backend updated brackets:", data);

      position.stopLoss = brackets.stopLoss;
      position.takeProfit = brackets.takeProfit;
      this._host.positionUpdate(position);

      console.log("[TradeArenaBroker] ✅ positionUpdate called with:", position);
      toast.success("Brackets updated successfully");

    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ editPositionBrackets error:", error);
      toast.error(error.message || "Failed to update brackets");
      throw error;
    }
  }

  private async _getInstrumentData(symbol: string): Promise<InstrumentCache> {
    if (this._instrumentCache.has(symbol)) {
      return this._instrumentCache.get(symbol)!;
    }

    const { data, error } = await supabase
      .from('instruments')
      .select('id, leverage_default, contract_size')
      .eq('symbol', symbol)
      .single() as { data: { id: string; leverage_default: number; contract_size: number } | null; error: any };

    if (error || !data) {
      throw new Error(`Instrument ${symbol} not found`);
    }

    const result: InstrumentCache = { 
      id: data.id, 
      leverage: data.leverage_default || 10,
      contract_size: data.contract_size || 100000
    };
    
    this._instrumentCache.set(symbol, result);
    return result;
  }

  private _createOrder(preOrder: PreOrder, orderId?: string): Order {
    return {
      id: orderId || `order_${this._idsCounter++}`,
      symbol: preOrder.symbol,
      type: preOrder.type || OrderType.Market,
      side: preOrder.side || Side.Buy,
      qty: preOrder.qty,
      status: OrderStatus.Filled,
      limitPrice: preOrder.limitPrice,
      stopPrice: preOrder.stopPrice,
      stopLoss: preOrder.stopLoss,
      takeProfit: preOrder.takeProfit,
    };
  }

  private _updateOrder(order: Order): void {
    this._orderById.set(order.id, order);
    this._host.orderUpdate(order);
  }

  async placeOrder(preOrder: PreOrder): Promise<{ orderId?: string }> {
    console.log("[TradeArenaBroker] 📥 placeOrder:", preOrder);

    try {
      if (!this._competitionId) {
        throw new Error("Competition ID is required to place orders");
      }

      const instrument = await this._getInstrumentData(preOrder.symbol);
      console.log("[TradeArenaBroker] Resolved instrument:", instrument);

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

      console.log("[TradeArenaBroker] Calling place-order with:", requestBody);

      const { data, error } = await supabase.functions.invoke('place-order', {
        body: requestBody,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] ✅ Order placed:", data);

      const orderId = data.order_id || `order_${this._idsCounter++}`;
      const order = this._createOrder(preOrder, orderId);
      
      order.price = data.filled_price;
      order.avgPrice = data.filled_price;
      order.last = data.filled_price;
      order.status = OrderStatus.Filled;
      
      this._updateOrder(order);
      toast.success("Order placed successfully");
      await this._reloadAndNotifyPositions();

      return {};

    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ placeOrder error:", error);
      toast.error(error.message || "Failed to place order");
      throw error;
    }
  }

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
      this._updateOrder(order);
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ modifyOrder error:", error);
      toast.error(error.message || "Failed to modify order");
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🚫 cancelOrder:", orderId);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('account_id', this._accountId);

      if (error) throw new Error(error.message);

      const order = this._orderById.get(orderId);
      if (order) {
        order.status = OrderStatus.Canceled;
        this._updateOrder(order);
      }

      toast.success("Order cancelled successfully");
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ cancelOrder error:", error);
      toast.error(error.message || "Failed to cancel order");
      throw error;
    }
  }

  async cancelOrders(_symbol: string, _side: Side | undefined, ordersIds: string[]): Promise<void> {
    console.log("[TradeArenaBroker] 🚫 cancelOrders:", ordersIds);
    
    await Promise.all(ordersIds.map((orderId: string) => {
      return this.cancelOrder(orderId);
    }));
  }

  async closePosition(positionId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🚪 closePosition:", positionId);

    const position = this._positionById.get(positionId);
    if (!position) {
      console.error("[TradeArenaBroker] Position not in local cache:", positionId);
      throw new Error("Position not found");
    }

    try {
      if (!this._competitionId) {
        throw new Error("Competition ID is required to close positions");
      }

      console.log("[TradeArenaBroker] Calling close-position edge function...");

      const { data, error } = await supabase.functions.invoke('close-position', {
        body: {
          position_id: positionId,
          competition_id: this._competitionId,
        },
      });

      console.log("[TradeArenaBroker] Response - data:", data, "error:", error);

      if (error) {
        console.error("[TradeArenaBroker] Edge function error:", error);
        throw new Error(error.message || "Edge function error");
      }

      if (data?.error) {
        console.error("[TradeArenaBroker] Data contains error:", data.error);
        throw new Error(data.error);
      }

      console.log("[TradeArenaBroker] ✅ Position closed successfully:", data);
      toast.success("Position closed successfully");

      position.qty = 0;
      this._host.positionUpdate(position);
      
      this._positionById.delete(positionId);
      this._positions = this._positions.filter(p => p.id !== positionId);

    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ closePosition error:", error);
      toast.error(error.message || "Failed to close position");
      throw error;
    }
  }

  async reversePosition(positionId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🔄 reversePosition:", positionId);

    const position = this._positionById.get(positionId);
    if (!position) {
      throw new Error("Position not found");
    }

    const symbol = position.symbol;
    const side = position.side;
    const qty = position.qty;

    try {
      await this.closePosition(positionId);
      
      await this.placeOrder({
        symbol: symbol,
        side: changeSide(side),
        type: OrderType.Market,
        qty: qty,
      });

      toast.success("Position reversed successfully");

    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ reversePosition error:", error);
      toast.error(error.message || "Failed to reverse position");
      throw error;
    }
  }

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
          label: "Stop Loss",
          alignment: "right",
          id: "stopLoss",
          dataFields: ["stopLoss"],
          formatter: StandardFormatterName.FormatPrice,
        },
        {
          label: "Take Profit",
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

  async chartContextMenuActions(context: any, options?: any): Promise<any[]> {
    if (this._host.defaultContextMenuActions) {
      return this._host.defaultContextMenuActions(context, options);
    }
    return [];
  }

  subscribeEquity(): void {
    console.log("[TradeArenaBroker] subscribeEquity");
    this._host.equityUpdate?.(this._equityValue.value());
  }

  unsubscribeEquity(): void {
    console.log("[TradeArenaBroker] unsubscribeEquity");
  }

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
    // Fetch latest prices from market_prices_latest
    try {
      const symbols = this._positions.map(p => p.symbol);
      if (symbols.length === 0) return;

      const { data: prices } = await supabase
        .from('market_prices_latest')
        .select('symbol, bid, ask')
        .in('symbol', symbols);

      if (!prices) return;

      const priceMap = new Map(prices.map(p => [p.symbol, p]));

      for (const position of this._positions) {
        const priceData = priceMap.get(position.symbol);
        if (priceData) {
          // Use bid for SELL positions (closing a sell = buying at bid)
          // Use ask for BUY positions (closing a buy = selling at ask)
          // Actually for P&L: BUY profits when price goes up (use bid for mark-to-market)
          // SELL profits when price goes down (use ask for mark-to-market)
          const currentPrice = position.side === Side.Buy 
            ? Number(priceData.bid) 
            : Number(priceData.ask);
          
          if (currentPrice > 0) {
            position.last = currentPrice;
            
            const contractSize = position.contractSize || 100000;
            const priceDiff = position.side === Side.Buy 
              ? currentPrice - position.avgPrice 
              : position.avgPrice - currentPrice;
            
            position.pl = priceDiff * position.qty * contractSize;
            
            this._host.plUpdate?.(position.symbol, position.pl);
            this._host.positionPartialUpdate?.(position.id, { 
              pl: position.pl,
              last: position.last 
            });
          }
        }
      }
    } catch (error) {
      // Fallback to simple calculation if no prices available
      for (const position of this._positions) {
        if (position.last && position.last !== position.avgPrice) {
          const contractSize = position.contractSize || 100000;
          const priceDiff = position.side === Side.Buy 
            ? position.last - position.avgPrice 
            : position.avgPrice - position.last;
          position.pl = priceDiff * position.qty * contractSize;
          
          this._host.plUpdate?.(position.symbol, position.pl);
          this._host.positionPartialUpdate?.(position.id, { pl: position.pl });
        }
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
    this._orderById.clear();
    this._positions = [];
    this._accounts = [];
  }
}

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

