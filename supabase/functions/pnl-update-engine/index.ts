import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Position P&L Update Engine
 * 
 * Updates unrealized P&L for all open positions based on current market prices.
 * Also updates account equity values.
 * 
 * Should be called periodically (e.g., every 5-10 seconds)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results = {
    positions_updated: 0,
    accounts_updated: 0,
    errors: 0,
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all open positions with instrument data
    const { data: positions, error: posError } = await supabase
      .from('positions')
      .select(`
        id,
        account_id,
        instrument_id,
        side,
        quantity,
        entry_price,
        unrealized_pnl,
        instrument:instruments!inner(symbol, contract_size)
      `)
      .eq('status', 'open');

    if (posError) {
      throw new Error(`Failed to fetch positions: ${posError.message}`);
    }

    if (!positions || positions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No open positions found',
        ...results,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique instrument IDs
    const instrumentIds = [...new Set(positions.map(p => p.instrument_id))];

    // Fetch latest prices
    const { data: prices, error: priceError } = await supabase
      .from('market_prices_latest')
      .select('instrument_id, price, bid, ask')
      .in('instrument_id', instrumentIds);

    if (priceError) {
      throw new Error(`Failed to fetch prices: ${priceError.message}`);
    }

    // Create price lookup map
    const priceMap = new Map<string, { price: number; bid: number; ask: number }>();
    for (const p of (prices || [])) {
      priceMap.set(p.instrument_id, { 
        price: Number(p.price), 
        bid: Number(p.bid), 
        ask: Number(p.ask) 
      });
    }

    // Group positions by account for equity updates
    const accountPnL = new Map<string, number>();

    // Update each position's unrealized P&L
    for (const pos of positions) {
      try {
        const priceData = priceMap.get(pos.instrument_id);
        if (!priceData) {
          continue;
        }

        const instrument = Array.isArray(pos.instrument) ? pos.instrument[0] : pos.instrument;
        const contractSize = Number(instrument?.contract_size || 1);

        // For BUY, mark-to-market at BID; for SELL, mark-to-market at ASK
        const markPrice = pos.side === 'buy' ? priceData.bid : priceData.ask;

        // Calculate unrealized P&L
        const entryPrice = Number(pos.entry_price);
        const qty = Number(pos.quantity);
        const priceDiff = pos.side === 'buy' 
          ? markPrice - entryPrice 
          : entryPrice - markPrice;
        
        const unrealizedPnl = priceDiff * qty * contractSize;

        // Update position
        const { error: updateError } = await supabase
          .from('positions')
          .update({
            current_price: markPrice,
            unrealized_pnl: unrealizedPnl,
          })
          .eq('id', pos.id);

        if (!updateError) {
          results.positions_updated++;
          
          // Accumulate P&L per account
          const currentPnL = accountPnL.get(pos.account_id) || 0;
          accountPnL.set(pos.account_id, currentPnL + unrealizedPnl);
        }
      } catch (err) {
        console.error(`[P&L Engine] Error updating position ${pos.id}:`, err);
        results.errors++;
      }
    }

    // Update account equity values
    for (const [accountId, totalUnrealizedPnl] of accountPnL.entries()) {
      try {
        const { data: account, error: accError } = await supabase
          .from('accounts')
          .select('balance, peak_equity, max_drawdown_pct')
          .eq('id', accountId)
          .single();

        if (accError || !account) continue;

        const newEquity = Number(account.balance) + totalUnrealizedPnl;
        const newPeakEquity = Math.max(Number(account.peak_equity), newEquity);
        const drawdown = newPeakEquity > 0 
          ? ((newPeakEquity - newEquity) / newPeakEquity) * 100 
          : 0;

        const { error: updateAccError } = await supabase
          .from('accounts')
          .update({
            equity: newEquity,
            peak_equity: newPeakEquity,
            max_drawdown_pct: Math.max(Number(account.max_drawdown_pct), drawdown),
          })
          .eq('id', accountId);

        if (!updateAccError) {
          results.accounts_updated++;
        }
      } catch (err) {
        console.error(`[P&L Engine] Error updating account ${accountId}:`, err);
        results.errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[P&L Engine] Completed in ${duration}ms:`, results);

    return new Response(JSON.stringify({
      success: true,
      ...results,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[P&L Engine] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: message,
      ...results,
      duration_ms: Date.now() - startTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

