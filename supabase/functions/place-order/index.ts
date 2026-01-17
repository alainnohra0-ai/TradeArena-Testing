import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRequest {
  competition_id: string;
  instrument_id: string;
  side: 'buy' | 'sell';
  quantity: number;
  leverage: number;
  stop_loss?: number;
  take_profit?: number;
  client_price?: number;
  order_type?: 'market' | 'limit' | 'stop' | 'stop_limit';
  requested_price?: number;
  create_new_position?: boolean;
}

interface PriceData {
  bid: number;
  ask: number;
  mid: number;
}

// Fetch price from centralized price engine
async function fetchFromPriceEngine(symbol: string): Promise<PriceData | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/price-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ symbols: [symbol], update_db: true }),
    });

    if (!response.ok) {
      console.error(`Price engine error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.prices && data.prices[symbol]) {
      const price = data.prices[symbol];
      console.log(`Price engine returned for ${symbol}: bid=${price.bid}, ask=${price.ask}`);
      return { bid: price.bid, ask: price.ask, mid: price.mid };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching from price engine for ${symbol}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized - no auth header' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Create client with user's auth for reading data
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Create admin client for writes (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const userId = user.id;
    const body: OrderRequest = await req.json();
    const { 
      competition_id, 
      instrument_id, 
      side, 
      quantity, 
      leverage, 
      stop_loss, 
      take_profit, 
      client_price,
      order_type = 'market',
      requested_price,
      create_new_position = true
    } = body;

    // Input validation
    if (!competition_id || !instrument_id || !side || !quantity || !leverage) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!['buy', 'sell'].includes(side)) {
      return new Response(JSON.stringify({ error: 'Invalid side. Must be buy or sell' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (quantity <= 0 || leverage < 1) {
      return new Response(JSON.stringify({ error: 'Invalid quantity or leverage' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    if ((order_type === 'limit' || order_type === 'stop' || order_type === 'stop_limit') && (!requested_price || requested_price <= 0)) {
      return new Response(JSON.stringify({ error: 'Limit/Stop orders require a valid price' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Order request:', { userId, competition_id, instrument_id, side, quantity, leverage, order_type, requested_price });

    // Verify competition is live
    const { data: competition, error: compError } = await supabaseUser
      .from('competitions')
      .select('id, status')
      .eq('id', competition_id)
      .single();

    if (compError || !competition) {
      return new Response(JSON.stringify({ error: 'Competition not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (competition.status !== 'live') {
      return new Response(JSON.stringify({ error: 'Competition is not live' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get competition rules
    const { data: rules, error: rulesError } = await supabaseUser
      .from('competition_rules')
      .select('max_drawdown_pct, max_leverage_global, max_position_pct, starting_balance')
      .eq('competition_id', competition_id)
      .single();

    if (rulesError || !rules) {
      return new Response(JSON.stringify({ error: 'Competition rules not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Check instrument is allowed
    const { data: compInstrument, error: instrError } = await supabaseUser
      .from('competition_instruments')
      .select('instrument_id, leverage_max_override')
      .eq('competition_id', competition_id)
      .eq('instrument_id', instrument_id)
      .single();

    if (instrError || !compInstrument) {
      return new Response(JSON.stringify({ error: 'Instrument not allowed in this competition' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const maxLeverage = compInstrument.leverage_max_override || rules.max_leverage_global;
    if (leverage > maxLeverage) {
      return new Response(JSON.stringify({ 
        error: `Leverage exceeds maximum allowed (${maxLeverage}x)` 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get instrument details
    const { data: instrument, error: getInstrError } = await supabaseUser
      .from('instruments')
      .select('id, symbol, contract_size, tick_size')
      .eq('id', instrument_id)
      .single();

    if (getInstrError || !instrument) {
      return new Response(JSON.stringify({ error: 'Instrument not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get participant and account
    const { data: participant, error: partError } = await supabaseUser
      .from('competition_participants')
      .select('id, status')
      .eq('competition_id', competition_id)
      .eq('user_id', userId)
      .single();

    if (partError || !participant) {
      return new Response(JSON.stringify({ error: 'You are not participating in this competition' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (participant.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Your participation is not active' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: account, error: accError } = await supabaseUser
      .from('accounts')
      .select('id, balance, equity, used_margin, peak_equity, max_drawdown_pct, status')
      .eq('participant_id', participant.id)
      .single();

    if (accError || !account) {
      return new Response(JSON.stringify({ error: 'Trading account not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (account.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Trading account is frozen or closed' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get price from centralized price engine
    let fillPrice: number;
    let entryBid: number;
    let entryAsk: number;
    let priceSource: string = 'price-engine';

    const marketPrice = await fetchFromPriceEngine(instrument.symbol);
    
    if (marketPrice) {
      entryBid = marketPrice.bid;
      entryAsk = marketPrice.ask;
      fillPrice = side === 'buy' ? entryAsk : entryBid;
      console.log(`Price engine execution: side=${side}, bid=${entryBid}, ask=${entryAsk}, fillPrice=${fillPrice}`);
    } else {
      // Fallback: Use cached DB price or client price
      const { data: latestPrice } = await supabaseUser
        .from('market_prices_latest')
        .select('price, bid, ask, ts')
        .eq('instrument_id', instrument_id)
        .single();

      if (latestPrice && latestPrice.bid && latestPrice.ask) {
        entryBid = latestPrice.bid;
        entryAsk = latestPrice.ask;
        fillPrice = side === 'buy' ? entryAsk : entryBid;
        priceSource = 'db_cache';
        console.log(`Using DB cache: bid=${entryBid}, ask=${entryAsk}`);
      } else if (client_price && client_price > 0) {
        const spread = client_price * 0.0001;
        entryBid = client_price - spread;
        entryAsk = client_price + spread;
        fillPrice = side === 'buy' ? entryAsk : entryBid;
        priceSource = 'client_fallback';
        console.log(`Using client price fallback: ${client_price}`);
      } else {
        return new Response(JSON.stringify({ error: 'Unable to fetch market price' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    /**
     * Calculate Required Margin using the formula:
     * Required Margin = (Trade Size × Asset Price) / Leverage
     * 
     * Where:
     * - Trade Size = quantity × contract_size (notional value in base currency)
     * - Asset Price = fillPrice for market orders, requested_price for limit/stop orders
     * - Leverage = user-specified leverage
     */
    const contractSize = Number(instrument.contract_size) || 1;
    const priceForMargin = order_type === 'market' ? fillPrice : requested_price!;
    const notionalValue = quantity * contractSize * priceForMargin;
    const requiredMargin = notionalValue / leverage;

    console.log('Margin calculation:', {
      quantity,
      contractSize,
      priceForMargin,
      notionalValue,
      leverage,
      requiredMargin,
    });

    // Check max position size rule
    const maxMarginAllowed = (rules.max_position_pct / 100) * rules.starting_balance;
    if (requiredMargin > maxMarginAllowed) {
      return new Response(JSON.stringify({ 
        error: `Position margin exceeds maximum allowed (${rules.max_position_pct}% of starting balance = $${maxMarginAllowed.toFixed(2)})` 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    /**
     * Check Free Margin using the formula:
     * Free Margin = Equity - Used Margin
     * 
     * Where:
     * - Equity = Balance + Unrealized P&L (stored in accounts table)
     * - Used Margin = Sum of all position margins (stored in accounts table)
     */
    const freeMargin = account.equity - account.used_margin;
    if (requiredMargin > freeMargin) {
      return new Response(JSON.stringify({ 
        error: `Insufficient margin. Required: $${requiredMargin.toFixed(2)}, Available: $${freeMargin.toFixed(2)}` 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Handle pending orders (limit/stop) - use admin client to bypass RLS
    if (order_type !== 'market') {
      console.log('Creating pending order:', { order_type, requested_price, account_id: account.id });
      
      const orderData: Record<string, unknown> = {
        account_id: account.id,
        instrument_id,
        side,
        order_type,
        quantity,
        leverage,
        requested_price,
        status: 'pending'
      };
      
      // Set limit_price for limit orders, stop_price for stop orders
      if (order_type === 'limit') {
        orderData.limit_price = requested_price;
      } else if (order_type === 'stop') {
        orderData.stop_price = requested_price;
      } else if (order_type === 'stop_limit') {
        // For stop-limit, the stop_price triggers the limit order at limit_price
        // For now, use requested_price for both (can be enhanced later)
        orderData.stop_price = requested_price;
        orderData.limit_price = requested_price;
      }
      
      // Add SL/TP if provided
      if (stop_loss && stop_loss > 0) orderData.stop_loss = stop_loss;
      if (take_profit && take_profit > 0) orderData.take_profit = take_profit;
      
      // Use admin client to bypass RLS for insert
      const { data: pendingOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert(orderData)
        .select('id')
        .single();
      
      if (orderError) {
        console.error('Failed to create pending order:', orderError);
        return new Response(JSON.stringify({ 
          error: `Failed to create pending order: ${orderError.message}` 
        }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      console.log('Pending order created:', pendingOrder?.id, 'type:', order_type, 'price:', requested_price);
      
      return new Response(JSON.stringify({
        success: true,
        order_id: pendingOrder?.id,
        order_type,
        requested_price,
        limit_price: order_type === 'limit' || order_type === 'stop_limit' ? requested_price : undefined,
        stop_price: order_type === 'stop' || order_type === 'stop_limit' ? requested_price : undefined,
        status: 'pending',
        symbol: instrument.symbol
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Market order execution - always create new position (no netting by default)
    let existingPosition = null;
    
    if (!create_new_position) {
      const { data: pos } = await supabaseUser
        .from('positions')
        .select('id, side, quantity, entry_price, margin_used, realized_pnl, opened_at')
        .eq('account_id', account.id)
        .eq('instrument_id', instrument_id)
        .eq('status', 'open')
        .single();
      existingPosition = pos;
    }

    let positionId: string;
    let newUsedMargin = account.used_margin;

    if (existingPosition) {
      if (existingPosition.side === side) {
        // Add to existing position
        const oldQty = Number(existingPosition.quantity);
        const oldPrice = Number(existingPosition.entry_price);
        const newQty = oldQty + quantity;
        const avgPrice = ((oldQty * oldPrice) + (quantity * fillPrice)) / newQty;
        const newMargin = Number(existingPosition.margin_used) + requiredMargin;

        const { error: updatePosError } = await supabaseAdmin
          .from('positions')
          .update({
            quantity: newQty,
            entry_price: avgPrice,
            margin_used: newMargin,
            current_price: fillPrice
          })
          .eq('id', existingPosition.id);

        if (updatePosError) {
          console.error('Failed to update position:', updatePosError);
          return new Response(JSON.stringify({ error: 'Failed to update position' }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        positionId = existingPosition.id;
        newUsedMargin += requiredMargin;
      } else {
        // Opposite side - close/reduce
        const existingQty = Number(existingPosition.quantity);
        
        if (quantity >= existingQty) {
          const priceDiff = side === 'buy' 
            ? Number(existingPosition.entry_price) - fillPrice
            : fillPrice - Number(existingPosition.entry_price);
          
          const realizedPnl = priceDiff * existingQty * contractSize;

          await supabaseAdmin
            .from('positions')
            .update({
              status: 'closed',
              closed_at: new Date().toISOString(),
              realized_pnl: realizedPnl,
              current_price: fillPrice
            })
            .eq('id', existingPosition.id);

          await supabaseAdmin.from('trades').insert({
            account_id: account.id,
            position_id: existingPosition.id,
            instrument_id,
            side: existingPosition.side,
            quantity: existingQty,
            entry_price: existingPosition.entry_price,
            exit_price: fillPrice,
            realized_pnl: realizedPnl,
            opened_at: existingPosition.opened_at || new Date().toISOString()
          });

          newUsedMargin = account.used_margin - Number(existingPosition.margin_used);
          const newBalance = account.balance + realizedPnl;

          const remainingQty = quantity - existingQty;
          if (remainingQty > 0) {
            const newNotional = remainingQty * contractSize * fillPrice;
            const newPosMargin = newNotional / leverage;

            const { data: newPos } = await supabaseAdmin
              .from('positions')
              .insert({
                account_id: account.id,
                instrument_id,
                side,
                quantity: remainingQty,
                entry_price: fillPrice,
                current_price: fillPrice,
                leverage,
                margin_used: newPosMargin,
                unrealized_pnl: 0,
                realized_pnl: 0,
                status: 'open'
              })
              .select('id')
              .single();

            positionId = newPos?.id || existingPosition.id;
            newUsedMargin += newPosMargin;
          } else {
            positionId = existingPosition.id;
          }

          await supabaseAdmin
            .from('accounts')
            .update({
              balance: newBalance,
              used_margin: newUsedMargin
            })
            .eq('id', account.id);

        } else {
          // Partial close
          const remainingQty = existingQty - quantity;
          const priceDiff = side === 'buy'
            ? Number(existingPosition.entry_price) - fillPrice
            : fillPrice - Number(existingPosition.entry_price);
          
          const realizedPnl = priceDiff * quantity * contractSize;
          const marginReduction = (quantity / existingQty) * Number(existingPosition.margin_used);

          await supabaseAdmin
            .from('positions')
            .update({
              quantity: remainingQty,
              margin_used: Number(existingPosition.margin_used) - marginReduction,
              realized_pnl: Number(existingPosition.realized_pnl || 0) + realizedPnl
            })
            .eq('id', existingPosition.id);

          positionId = existingPosition.id;
          newUsedMargin -= marginReduction;

          await supabaseAdmin
            .from('accounts')
            .update({
              balance: account.balance + realizedPnl,
              used_margin: newUsedMargin
            })
            .eq('id', account.id);
        }
      }
    } else {
      // Create new position
      const positionData: Record<string, unknown> = {
        account_id: account.id,
        instrument_id,
        side,
        quantity,
        entry_price: fillPrice,
        current_price: fillPrice,
        leverage,
        margin_used: requiredMargin,
        unrealized_pnl: 0,
        realized_pnl: 0,
        status: 'open'
      };
      
      if (stop_loss && stop_loss > 0) positionData.stop_loss = stop_loss;
      if (take_profit && take_profit > 0) positionData.take_profit = take_profit;
      
      const { data: newPosition, error: posError } = await supabaseAdmin
        .from('positions')
        .insert(positionData)
        .select('id')
        .single();

      if (posError || !newPosition) {
        console.error('Failed to create position:', posError);
        return new Response(JSON.stringify({ error: 'Failed to create position' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      positionId = newPosition.id;
      newUsedMargin += requiredMargin;
    }

    // Create order record
    const orderData: Record<string, unknown> = {
      account_id: account.id,
      instrument_id,
      side,
      order_type: 'market',
      quantity,
      leverage,
      filled_price: fillPrice,
      margin_used: requiredMargin,
      filled_at: new Date().toISOString(),
      status: 'filled'
    };
    
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select('id')
      .single();

    if (orderError) {
      console.error('Failed to create order:', orderError);
    }

    // Update account used_margin
    await supabaseAdmin
      .from('accounts')
      .update({ used_margin: newUsedMargin })
      .eq('id', account.id);

    // Calculate and check drawdown
    const { data: updatedAccount } = await supabaseAdmin
      .from('accounts')
      .select('balance, equity, used_margin, peak_equity')
      .eq('id', account.id)
      .single();

    if (updatedAccount) {
      const { data: openPositions } = await supabaseAdmin
        .from('positions')
        .select('unrealized_pnl')
        .eq('account_id', account.id)
        .eq('status', 'open');

      const totalUnrealizedPnl = openPositions?.reduce((sum: number, p: any) => sum + Number(p.unrealized_pnl || 0), 0) || 0;
      
      /**
       * Calculate Equity using the formula:
       * Equity = Balance + Unrealized P&L
       */
      const currentEquity = updatedAccount.balance + totalUnrealizedPnl;
      const newPeakEquity = Math.max(updatedAccount.peak_equity, currentEquity);
      const drawdown = newPeakEquity > 0 
        ? ((newPeakEquity - currentEquity) / newPeakEquity) * 100 
        : 0;

      await supabaseAdmin
        .from('accounts')
        .update({
          equity: currentEquity,
          peak_equity: newPeakEquity,
          max_drawdown_pct: Math.max(account.max_drawdown_pct, drawdown)
        })
        .eq('id', account.id);

      // Check for drawdown breach
      if (drawdown >= rules.max_drawdown_pct) {
        console.log('DRAWDOWN BREACH - Disqualifying account:', account.id);

        await supabaseAdmin
          .from('accounts')
          .update({ status: 'frozen' })
          .eq('id', account.id);

        await supabaseAdmin
          .from('competition_participants')
          .update({ status: 'disqualified' })
          .eq('id', participant.id);

        await supabaseAdmin.from('disqualifications').insert({
          competition_id,
          account_id: account.id,
          reason: `Maximum drawdown exceeded: ${drawdown.toFixed(2)}% (limit: ${rules.max_drawdown_pct}%)`
        });

        return new Response(JSON.stringify({
          success: false,
          order_id: order?.id,
          position_id: positionId,
          filled_price: fillPrice,
          disqualified: true,
          reason: `Maximum drawdown exceeded: ${drawdown.toFixed(2)}%`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create equity snapshot
      await supabaseAdmin.from('equity_snapshots').insert({
        account_id: account.id,
        equity: currentEquity,
        balance: updatedAccount.balance,
        unrealized_pnl: totalUnrealizedPnl,
        max_drawdown_pct_so_far: Math.max(account.max_drawdown_pct, drawdown)
      });
    }

    console.log('Order executed:', { order_id: order?.id, position_id: positionId, filled_price: fillPrice, source: priceSource });

    return new Response(JSON.stringify({
      success: true,
      order_id: order?.id,
      position_id: positionId,
      filled_price: fillPrice,
      margin_used: requiredMargin,
      symbol: instrument.symbol,
      price_source: priceSource,
      entry_bid: entryBid,
      entry_ask: entryAsk
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in place-order:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

