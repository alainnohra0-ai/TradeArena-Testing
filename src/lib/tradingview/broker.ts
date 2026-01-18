/**
 * TradeArena Broker Implementation - Based on TradingView broker-sample
 * 
 * Features:
 * - Position management (open, close, reverse)
 * - Bracket editing (SL/TP) with drag support
 * - Real-time P&L calculation with contract size
 * - Account Manager integration with full margin metrics
 * - Multiple accounts support (for competitions)
 * - P&L preview for SL/TP brackets
 * - Persistent SL/TP lines on chart reload
 * - Pending orders (limit/stop) support
 * 
 * Margin Formulas:
 * - Required Margin = (Quantity × Contract Size × Price) / Leverage
 * - Used Margin = Sum of all open positions' margin_used
 * - Free Margin = Equity - Used Margin
 * - Margin Level = (Equity / Used Margin) × 100%
 * - Equity = Balance + Unrealized P&L
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

// Stop type for bracket orders
export enum StopType {
  StopLoss = 0,
  TrailingStop = 1,
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
  instrumentId?: string; // For price lookups
  marginUsed?: number; // Required margin for this position
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
  stopType?: StopType;
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
  competitionId?: string;
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
  
  // Account metrics watched values for TradingView Account Manager
  private _balanceValue: any;
  private _equityValue: any;
  private _usedMarginValue: any;
  private _freeMarginValue: any;
  private _marginLevelValue: any;
  private _unrealizedPnlValue: any;
  
  private _pollingInterval: NodeJS.Timeout | null = null;
  private _instrumentCache: Map<string, InstrumentCache> = new Map();
  private _idsCounter: number = 1;
  
  private _positions: Position[] = [];
  private _positionById: Map<string, Position> = new Map();
  private _orderById: Map<string, Order> = new Map();
  private _pendingOrders: Map<string, Order> = new Map(); // Standalone pending orders (limit/stop)
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

    // Initialize all watched values for Account Manager
    this._balanceValue = this._host.factory.createWatchedValue(0);
    this._equityValue = this._host.factory.createWatchedValue(0);
    this._usedMarginValue = this._host.factory.createWatchedValue(0);
    this._freeMarginValue = this._host.factory.createWatchedValue(0);
    this._marginLevelValue = this._host.factory.createWatchedValue(0);
    this._unrealizedPnlValue = this._host.factory.createWatchedValue(0);

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
   * Schema: competition_participants.id -> accounts.participant_id
   */
  private async _loadUserAccounts(): Promise<void> {
    try {
      console.log("[TradeArenaBroker] Loading user accounts for userId:", this._userId);
      
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          id,
          balance,
          equity,
          participant:competition_participants!inner(
            id,
            user_id,
            competition_id,
            competition:competitions!inner(id, name)
          )
        `)
        .eq('participant.user_id', this._userId);

      if (error) {
        console.error("[TradeArenaBroker] Failed to load user accounts:", error);
        this._accounts = [{
          id: this._accountId,
          name: 'TradeArena Trading Account',
          currency: 'USD',
        }];
        this._accountsLoaded = true;
        return;
      }

      if (!data || data.length === 0) {
        console.log("[TradeArenaBroker] No competition accounts found, using default");
        this._accounts = [{
          id: this._accountId,
          name: 'TradeArena Trading Account',
          currency: 'USD',
        }];
        this._accountsLoaded = true;
        return;
      }

      this._accounts = data.map((row: any) => ({
        id: row.id,
        name: row.participant?.competition?.name || 'Trading Account',
        currency: 'USD',
        balance: row.balance,
        competitionId: row.participant?.competition_id,
        competitionName: row.participant?.competition?.name,
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
      this._accountsLoaded = true;
    }
  }

  async accountsMetainfo(): Promise<any[]> {
    if (!this._accountsLoaded && this._accounts.length === 0) {
      await this._loadUserAccounts();
    }

    return this._accounts.map(acc => ({
      id: acc.id,
      name: acc.competitionName ? `${acc.competitionName}` : acc.name,
      currency: acc.currency,
    }));
  }

  async setCurrentAccount(accountId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🔄 Switching to account:", accountId);
    
    if (accountId === this._accountId) {
      console.log("[TradeArenaBroker] Already on this account");
      return;
    }

    const account = this._accounts.find(a => a.id === accountId);
    if (!account) {
      console.error("[TradeArenaBroker] Account not found in cache:", accountId);
      throw new Error("Account not found");
    }

    this._accountId = accountId;
    
    if (account.competitionId) {
      this._competitionId = account.competitionId;
      console.log("[TradeArenaBroker] Updated competition ID from cache:", this._competitionId);
    }
    
    this._positions = [];
    this._positionById.clear();
    this._orderById.clear();
    this._pendingOrders.clear();

    await this._loadInitialDataAndNotify();
    await this._updateAccountData();

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
      
      let contractSize = 100000;
      try {
        const instrument = await this._getInstrumentData(symbol);
        contractSize = instrument.contract_size || 100000;
      } catch {
        if (['XAUUSD', 'XAGUSD'].includes(symbol)) {
          contractSize = 100;
        } else if (symbol.includes('BTC') || symbol.includes('ETH')) {
          contractSize = 1;
        } else if (symbol.length === 6) {
          contractSize = 100000;
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
      return {
        qty: { min: 0.01, max: 1000, step: 0.01, default: 0.1 },
        pipSize: 0.0001,
        pipValue: 10,
        minTick: 0.0001,
        description: symbol,
      };
    }
  }

  async calculatePLForBracketOrder(
    positionId: string,
    brackets: Brackets
  ): Promise<{ pl: number; plPercent: number }> {
    const position = this._positionById.get(positionId);
    
    if (!position) {
      return { pl: 0, plPercent: 0 };
    }

    let contractSize = position.contractSize || 100000;
    try {
      const instrument = await this._getInstrumentData(position.symbol);
      contractSize = instrument.contract_size || 100000;
    } catch {
      // Use default
    }

    const bracketPrice = brackets.stopLoss || brackets.takeProfit || position.avgPrice;
    const priceDiff = position.side === Side.Buy 
      ? bracketPrice - position.avgPrice 
      : position.avgPrice - bracketPrice;
    
    const pl = priceDiff * position.qty * contractSize;
    
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
    await this._loadPendingOrders();
    await this._updateAccountData();
    
    // Notify TradingView of all positions
    for (const position of this._positions) {
      console.log("[TradeArenaBroker] Notifying position:", position.id, "SL:", position.stopLoss, "TP:", position.takeProfit);
      this._host.positionUpdate(position);
    }
    
    // Notify TradingView of all bracket orders (SL/TP as pending orders)
    for (const order of this._orderById.values()) {
      console.log("[TradeArenaBroker] Notifying bracket order:", order.id, "parentId:", order.parentId);
      this._host.orderUpdate(order);
    }

    // Notify TradingView of standalone pending orders (limit/stop)
    for (const order of this._pendingOrders.values()) {
      console.log("[TradeArenaBroker] Notifying pending order:", order.id, "type:", order.type);
      this._host.orderUpdate(order);
    }
    
    this._initialDataLoaded = true;
    console.log("[TradeArenaBroker] ✅ Initial data loaded and notified", this._positions.length, "positions,", this._orderById.size, "bracket orders,", this._pendingOrders.size, "pending orders");
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
          margin_used,
          status,
          instrument_id,
          instrument:instruments!inner(id, symbol, name, contract_size)
        `)
        .eq('account_id', this._accountId)
        .eq('status', 'open');

      if (error) {
        console.error("[TradeArenaBroker] _loadPositions error:", error);
        return;
      }

      this._positions = [];
      this._positionById.clear();
      this._orderById.clear();

      for (const pos of (data || [])) {
        const avgPrice = Number(pos.entry_price);
        const currentPrice = pos.current_price ? Number(pos.current_price) : avgPrice;
        const contractSize = pos.instrument?.contract_size || 100000;
        
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
          pl: Number(pos.unrealized_pnl) || calculatedPl,
          last: currentPrice,
          stopLoss: pos.stop_loss ? Number(pos.stop_loss) : undefined,
          takeProfit: pos.take_profit ? Number(pos.take_profit) : undefined,
          contractSize: contractSize,
          instrumentId: pos.instrument_id,
          marginUsed: pos.margin_used ? Number(pos.margin_used) : 0,
        };

        this._positions.push(position);
        this._positionById.set(position.id, position);

        // Create bracket orders for SL/TP so TradingView displays them on the chart
        this._createBracketOrdersForPosition(position);
      }

      console.log("[TradeArenaBroker] 📊 Loaded", this._positions.length, "positions with", this._orderById.size, "bracket orders");
    } catch (error) {
      console.error("[TradeArenaBroker] _loadPositions error:", error);
    }
  }

  /**
   * Load pending orders (limit/stop) from the database
   */
  private async _loadPendingOrders(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          side,
          order_type,
          quantity,
          requested_price,
          stop_loss,
          take_profit,
          status,
          instrument:instruments!inner(id, symbol)
        `)
        .eq('account_id', this._accountId)
        .eq('status', 'pending');

      if (error) {
        console.error("[TradeArenaBroker] _loadPendingOrders error:", error);
        return;
      }

      this._pendingOrders.clear();

      for (const ord of (data || [])) {
        let orderType = OrderType.Market;
        if (ord.order_type === 'limit') orderType = OrderType.Limit;
        else if (ord.order_type === 'stop') orderType = OrderType.Stop;
        
        const order: Order = {
          id: ord.id,
          symbol: ord.instrument?.symbol || 'UNKNOWN',
          type: orderType,
          side: ord.side === 'buy' ? Side.Buy : Side.Sell,
          qty: Math.abs(Number(ord.quantity)),
          status: OrderStatus.Working,
          limitPrice: orderType === OrderType.Limit ? Number(ord.requested_price) : undefined,
          stopPrice: orderType === OrderType.Stop ? Number(ord.requested_price) : undefined,
          stopLoss: ord.stop_loss ? Number(ord.stop_loss) : undefined,
          takeProfit: ord.take_profit ? Number(ord.take_profit) : undefined,
        };

        this._pendingOrders.set(order.id, order);
      }

      console.log("[TradeArenaBroker] 📋 Loaded", this._pendingOrders.size, "pending orders");
    } catch (error) {
      console.error("[TradeArenaBroker] _loadPendingOrders error:", error);
    }
  }

  /**
   * Create bracket orders (SL/TP) for a position
   * TradingView displays SL/TP lines on the chart based on orders with parentId/parentType
   */
  private _createBracketOrdersForPosition(position: Position): void {
    // Create Stop Loss order if position has SL
    if (position.stopLoss) {
      const slOrderId = `${position.id}_sl`;
      const slOrder: Order = {
        id: slOrderId,
        symbol: position.symbol,
        type: OrderType.Stop,
        side: changeSide(position.side), // SL closes position, so opposite side
        qty: position.qty,
        status: OrderStatus.Working,
        stopPrice: position.stopLoss,
        parentId: position.id,
        parentType: ParentType.Position,
        stopType: StopType.StopLoss,
      };
      this._orderById.set(slOrderId, slOrder);
      console.log("[TradeArenaBroker] Created SL bracket order:", slOrderId, "at", position.stopLoss);
    }

    // Create Take Profit order if position has TP
    if (position.takeProfit) {
      const tpOrderId = `${position.id}_tp`;
      const tpOrder: Order = {
        id: tpOrderId,
        symbol: position.symbol,
        type: OrderType.Limit,
        side: changeSide(position.side), // TP closes position, so opposite side
        qty: position.qty,
        status: OrderStatus.Working,
        limitPrice: position.takeProfit,
        parentId: position.id,
        parentType: ParentType.Position,
      };
      this._orderById.set(tpOrderId, tpOrder);
      console.log("[TradeArenaBroker] Created TP bracket order:", tpOrderId, "at", position.takeProfit);
    }
  }

  private async _reloadAndNotifyPositions(): Promise<void> {
    const oldPositionIds = new Set(this._positionById.keys());
    const oldOrderIds = new Set(this._orderById.keys());
    const oldPendingOrderIds = new Set(this._pendingOrders.keys());
    
    await this._loadPositions();
    await this._loadPendingOrders();
    
    // Notify positions
    for (const position of this._positions) {
      this._host.positionUpdate(position);
    }
    
    // Remove old positions
    for (const oldId of oldPositionIds) {
      if (!this._positionById.has(oldId)) {
        this._host.positionUpdate({ id: oldId, qty: 0 } as Position);
      }
    }

    // Notify bracket orders
    for (const order of this._orderById.values()) {
      this._host.orderUpdate(order);
    }

    // Cancel old bracket orders that no longer exist
    for (const oldId of oldOrderIds) {
      if (!this._orderById.has(oldId)) {
        this._host.orderUpdate({ id: oldId, status: OrderStatus.Canceled } as Order);
      }
    }

    // Notify pending orders
    for (const order of this._pendingOrders.values()) {
      this._host.orderUpdate(order);
    }

    // Cancel old pending orders that no longer exist
    for (const oldId of oldPendingOrderIds) {
      if (!this._pendingOrders.has(oldId)) {
        this._host.orderUpdate({ id: oldId, status: OrderStatus.Canceled } as Order);
      }
    }
    
    console.log("[TradeArenaBroker] 🔄 Reloaded and notified", this._positions.length, "positions,", this._orderById.size, "bracket orders,", this._pendingOrders.size, "pending orders");
  }

  async positions(): Promise<Position[]> {
    return this._positions.slice();
  }

  async orders(): Promise<Order[]> {
    // Combine bracket orders and pending orders
    return [
      ...Array.from(this._orderById.values()),
      ...Array.from(this._pendingOrders.values()),
    ];
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

      if (error) {
        // Try to extract actual error message from data if available
        const errorMessage = data?.error || error.message || "Failed to place order";
        throw new Error(errorMessage);
      }
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] ✅ Backend updated brackets:", data);

      // Update local position
      position.stopLoss = brackets.stopLoss;
      position.takeProfit = brackets.takeProfit;
      this._host.positionUpdate(position);

      // Update or create/remove bracket orders
      this._updateBracketOrdersForPosition(position, brackets);

      console.log("[TradeArenaBroker] ✅ positionUpdate and orderUpdate called");
      toast.success("Brackets updated successfully");

    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ editPositionBrackets error:", error);
      toast.error(error.message || "Failed to update brackets");
      throw error;
    }
  }

  /**
   * Update bracket orders when SL/TP changes
   */
  private _updateBracketOrdersForPosition(position: Position, brackets: Brackets): void {
    const slOrderId = `${position.id}_sl`;
    const tpOrderId = `${position.id}_tp`;

    // Handle Stop Loss
    if (brackets.stopLoss) {
      const existingSlOrder = this._orderById.get(slOrderId);
      if (existingSlOrder) {
        // Update existing SL order
        existingSlOrder.stopPrice = brackets.stopLoss;
        this._host.orderUpdate(existingSlOrder);
      } else {
        // Create new SL order
        const slOrder: Order = {
          id: slOrderId,
          symbol: position.symbol,
          type: OrderType.Stop,
          side: changeSide(position.side),
          qty: position.qty,
          status: OrderStatus.Working,
          stopPrice: brackets.stopLoss,
          parentId: position.id,
          parentType: ParentType.Position,
          stopType: StopType.StopLoss,
        };
        this._orderById.set(slOrderId, slOrder);
        this._host.orderUpdate(slOrder);
      }
    } else {
      // Remove SL order if it exists
      if (this._orderById.has(slOrderId)) {
        this._host.orderUpdate({ id: slOrderId, status: OrderStatus.Canceled } as Order);
        this._orderById.delete(slOrderId);
      }
    }

    // Handle Take Profit
    if (brackets.takeProfit) {
      const existingTpOrder = this._orderById.get(tpOrderId);
      if (existingTpOrder) {
        // Update existing TP order
        existingTpOrder.limitPrice = brackets.takeProfit;
        this._host.orderUpdate(existingTpOrder);
      } else {
        // Create new TP order
        const tpOrder: Order = {
          id: tpOrderId,
          symbol: position.symbol,
          type: OrderType.Limit,
          side: changeSide(position.side),
          qty: position.qty,
          status: OrderStatus.Working,
          limitPrice: brackets.takeProfit,
          parentId: position.id,
          parentType: ParentType.Position,
        };
        this._orderById.set(tpOrderId, tpOrder);
        this._host.orderUpdate(tpOrder);
      }
    } else {
      // Remove TP order if it exists
      if (this._orderById.has(tpOrderId)) {
        this._host.orderUpdate({ id: tpOrderId, status: OrderStatus.Canceled } as Order);
        this._orderById.delete(tpOrderId);
      }
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

      let orderType: 'market' | 'limit' | 'stop' = 'market';
      if (preOrder.type === OrderType.Limit) orderType = 'limit';
      else if (preOrder.type === OrderType.Stop) orderType = 'stop';
      else if (preOrder.type === OrderType.StopLimit) orderType = 'stop' // Map StopLimit to Stop;

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

      if (error) {
        // Try to extract actual error message from data if available
        const errorMessage = data?.error || error.message || "Failed to place order";
        throw new Error(errorMessage);
      }
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] ✅ Order placed:", data);

      // Handle pending orders (limit/stop)
      if (data.status === 'pending') {
        const orderId = data.order_id;
        const pendingOrder: Order = {
          id: orderId,
          symbol: preOrder.symbol,
          type: preOrder.type,
          side: preOrder.side,
          qty: preOrder.qty,
          status: OrderStatus.Working,
          limitPrice: preOrder.limitPrice,
          stopPrice: preOrder.stopPrice,
          stopLoss: preOrder.stopLoss,
          takeProfit: preOrder.takeProfit,
        };
        this._pendingOrders.set(orderId, pendingOrder);
        this._host.orderUpdate(pendingOrder);
        toast.success(`${orderType.toUpperCase()} order placed at ${data.requested_price}`);
        return { orderId };
      }

      // Handle filled market orders
      const orderId = data.order_id || `order_${this._idsCounter++}`;
      const order = this._createOrder(preOrder, orderId);
      
      order.price = data.filled_price;
      order.avgPrice = data.filled_price;
      order.last = data.filled_price;
      order.status = OrderStatus.Filled;
      
      this._updateOrder(order);
      toast.success("Order placed successfully");
      await this._reloadAndNotifyPositions();
      await this._updateAccountData();

      return {};

    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ placeOrder error:", error);
      toast.error(error.message || "Failed to place order");
      throw error;
    }
  }

  async modifyOrder(order: Order): Promise<void> {
    console.log("[TradeArenaBroker] 🔧 modifyOrder:", order);
    
    // Check if this is a bracket order (SL/TP)
    if (order.parentId && order.parentType === ParentType.Position) {
      // This is a bracket order - update the position's brackets
      const position = this._positionById.get(order.parentId);
      if (position) {
        const brackets: Brackets = {
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
        };

        // Determine which bracket is being modified
        if (order.id.endsWith('_sl')) {
          brackets.stopLoss = order.stopPrice;
        } else if (order.id.endsWith('_tp')) {
          brackets.takeProfit = order.limitPrice;
        }

        await this.editPositionBrackets(order.parentId, brackets);
        return;
      }
    }

    // Regular order modification (pending limit/stop orders)
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          requested_price: order.limitPrice || order.stopPrice,
          stop_loss: order.stopLoss,
          take_profit: order.takeProfit,
          quantity: order.qty,
        })
        .eq('id', order.id)
        .eq('account_id', this._accountId);

      if (error) {
        // Try to extract actual error message from data if available
        const errorMessage = data?.error || error.message || "Failed to place order";
        throw new Error(errorMessage);
      }

      // Update local pending order
      if (this._pendingOrders.has(order.id)) {
        this._pendingOrders.set(order.id, order);
      }

      toast.success("Order modified successfully");
      this._host.orderUpdate(order);
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ modifyOrder error:", error);
      toast.error(error.message || "Failed to modify order");
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🚫 cancelOrder:", orderId);

    // Check if this is a bracket order
    const bracketOrder = this._orderById.get(orderId);
    if (bracketOrder?.parentId && bracketOrder.parentType === ParentType.Position) {
      // This is a bracket order - remove the bracket from the position
      const position = this._positionById.get(bracketOrder.parentId);
      if (position) {
        const brackets: Brackets = {
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
        };

        // Remove the appropriate bracket
        if (orderId.endsWith('_sl')) {
          brackets.stopLoss = undefined;
        } else if (orderId.endsWith('_tp')) {
          brackets.takeProfit = undefined;
        }

        await this.editPositionBrackets(bracketOrder.parentId, brackets);
        return;
      }
    }

    // Check if this is a pending order
    const pendingOrder = this._pendingOrders.get(orderId);
    if (pendingOrder) {
      try {
        // Use 'cancelled' (British spelling) to match database enum
        const { error } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', orderId)
          .eq('account_id', this._accountId);

        if (error) {
        // Try to extract actual error message from data if available
        const errorMessage = data?.error || error.message || "Failed to place order";
        throw new Error(errorMessage);
      }

        pendingOrder.status = OrderStatus.Canceled;
        this._host.orderUpdate(pendingOrder);
        this._pendingOrders.delete(orderId);

        toast.success("Order cancelled successfully");
        return;
      } catch (error: any) {
        console.error("[TradeArenaBroker] ❌ cancelOrder error:", error);
        toast.error(error.message || "Failed to cancel order");
        throw error;
      }
    }

    // Fallback: try to cancel as regular order in database
    try {
      // Use 'cancelled' (British spelling) to match database enum
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('account_id', this._accountId);

      if (error) {
        // Try to extract actual error message from data if available
        const errorMessage = data?.error || error.message || "Failed to place order";
        throw new Error(errorMessage);
      }

      this._host.orderUpdate({ id: orderId, status: OrderStatus.Canceled } as Order);
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

      // Remove bracket orders for this position
      const slOrderId = `${positionId}_sl`;
      const tpOrderId = `${positionId}_tp`;
      
      if (this._orderById.has(slOrderId)) {
        this._host.orderUpdate({ id: slOrderId, status: OrderStatus.Canceled } as Order);
        this._orderById.delete(slOrderId);
      }
      if (this._orderById.has(tpOrderId)) {
        this._host.orderUpdate({ id: tpOrderId, status: OrderStatus.Canceled } as Order);
        this._orderById.delete(tpOrderId);
      }

      position.qty = 0;
      this._host.positionUpdate(position);
      
      this._positionById.delete(positionId);
      this._positions = this._positions.filter(p => p.id !== positionId);

      // Update account data after closing position
      await this._updateAccountData();

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
        {
          text: "Unrealized P&L",
          wValue: this._unrealizedPnlValue,
          formatter: StandardFormatterName.Profit,
          isDefault: true,
        },
        {
          text: "Used Margin",
          wValue: this._usedMarginValue,
          formatter: StandardFormatterName.Fixed,
          isDefault: true,
        },
        {
          text: "Free Margin",
          wValue: this._freeMarginValue,
          formatter: StandardFormatterName.Fixed,
          isDefault: true,
        },
        {
          text: "Margin Level %",
          wValue: this._marginLevelValue,
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
          label: "Stop",
          alignment: "right",
          id: "stopPrice",
          dataFields: ["stopPrice"],
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

  /**
   * Update account data with full margin calculations
   * 
   * Formulas:
   * - Used Margin = Sum of all open positions' margin_used
   * - Unrealized P&L = Sum of all open positions' P&L
   * - Equity = Balance + Unrealized P&L
   * - Free Margin = Equity - Used Margin
   * - Margin Level = (Equity / Used Margin) × 100% (or 0 if no margin used)
   */
  private async _updateAccountData(): Promise<void> {
    try {
      const { data } = await supabase
        .from('accounts')
        .select('balance, equity, used_margin')
        .eq('id', this._accountId)
        .single();

      if (data) {
        const balance = Number(data.balance || 0);
        const usedMargin = Number(data.used_margin || 0);
        
        // Calculate unrealized P&L from positions
        let unrealizedPnl = 0;
        for (const position of this._positions) {
          unrealizedPnl += position.pl || 0;
        }

        // Calculate equity = balance + unrealized P&L
        const equity = balance + unrealizedPnl;

        // Calculate free margin = equity - used margin
        const freeMargin = equity - usedMargin;

        // Calculate margin level = (equity / used margin) × 100
        // If no margin is used, margin level is effectively infinite (show 0 or N/A)
        const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;

        // Update all watched values
        this._balanceValue.setValue(balance);
        this._equityValue.setValue(equity);
        this._usedMarginValue.setValue(usedMargin);
        this._freeMarginValue.setValue(freeMargin);
        this._marginLevelValue.setValue(marginLevel);
        this._unrealizedPnlValue.setValue(unrealizedPnl);

        // Also update equity in the database if it's different
        if (Math.abs(equity - Number(data.equity || 0)) > 0.01) {
          await supabase
            .from('accounts')
            .update({ equity: equity })
            .eq('id', this._accountId);
        }

        console.log("[TradeArenaBroker] 💰 Account metrics updated:", {
          balance,
          equity,
          usedMargin,
          freeMargin,
          marginLevel: marginLevel.toFixed(2) + '%',
          unrealizedPnl,
        });
      }
    } catch (error) {
      console.error("[TradeArenaBroker] _updateAccountData error:", error);
    }
  }

  private async _updatePositionPrices(): Promise<void> {
    if (this._positions.length === 0) return;

    try {
      const instrumentIds = this._positions
        .map(p => p.instrumentId)
        .filter((id): id is string => !!id);
      
      if (instrumentIds.length === 0) return;

      const { data: prices, error } = await supabase
        .from('market_prices_latest')
        .select('instrument_id, bid, ask')
        .in('instrument_id', instrumentIds);

      if (error) {
        console.error("[TradeArenaBroker] Failed to fetch prices:", error);
        return;
      }

      if (!prices || prices.length === 0) return;

      const priceMap = new Map(prices.map(p => [p.instrument_id, p]));

      for (const position of this._positions) {
        if (!position.instrumentId) continue;
        
        const priceData = priceMap.get(position.instrumentId);
        if (priceData) {
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

      // After updating position prices, recalculate account metrics
      await this._updateAccountData();

    } catch (error) {
      console.error("[TradeArenaBroker] _updatePositionPrices error:", error);
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
    this._pendingOrders.clear();
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

