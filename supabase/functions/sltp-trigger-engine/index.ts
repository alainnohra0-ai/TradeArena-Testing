import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * SL/TP Trigger Engine
 * 
 * This function checks all open positions with SL/TP levels against current prices
 * and automatically closes positions when price hits SL or TP.
 * 
 * Should be called periodically (e.g., every 5-10 seconds via cron or external scheduler)
 */

interface PositionWithPrice {
  id: string;
  account_id: string;
  instrument_id: string;
  side: 'buy' | 'sell';
  quantity: number;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  margin_used: number;
  leverage: number;
  opened_at: string;
  // Joined data
  current_price?: number;
  bid?: number;
  ask?: number;
  symbol?: string;
  contract_size?: number;
  competition_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results = {
    checked: 0,
    triggered_sl: 0,
    triggered_tp: 0,
    errors: 0,
    details: [] as string[],
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all open positions with SL or TP set
    const { data: positions, error: posError } = await supabase
      .from('positions')
      .select(`
        id,
        account_id,
        instrument_id,
        side,
        quantity,
        entry_price,
        stop_loss,
        take_profit,
        margin_used,
        leverage,
        opened_at,
        instrument:instruments!inner(id, symbol, contract_size)
      `)
      .eq('status', 'open')
      .or('stop_loss.not.is.null,take_profit.not.is.null');

    if (posError) {
      throw new Error(`Failed to fetch positions: ${posError.message}`);
    }

    if (!positions || positions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No positions with SL/TP found',
        ...results,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    results.checked = positions.length;
    console.log(`[SL/TP Engine] Checking ${positions.length} positions with SL/TP`);

    // Get unique instrument IDs
    const instrumentIds = [...new Set(positions.map(p => p.instrument_id))];

    // Fetch latest prices for all instruments
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

    // Check each position
    for (const pos of positions) {
      try {
        const priceData = priceMap.get(pos.instrument_id);
        if (!priceData) {
          console.log(`[SL/TP Engine] No price data for instrument ${pos.instrument_id}`);
          continue;
        }

        const instrument = Array.isArray(pos.instrument) ? pos.instrument[0] : pos.instrument;
        const symbol = instrument?.symbol || 'UNKNOWN';
        const contractSize = Number(instrument?.contract_size || 1);

        // For BUY positions, exit at BID price; for SELL, exit at ASK price
        const exitPrice = pos.side === 'buy' ? priceData.bid : priceData.ask;

        let shouldClose = false;
        let closeReason = '';
        let realizedPnl = 0;

        // Check Stop Loss
        if (pos.stop_loss !== null) {
          const sl = Number(pos.stop_loss);
          if (pos.side === 'buy' && exitPrice <= sl) {
            shouldClose = true;
            closeReason = 'stop_loss';
            console.log(`[SL/TP Engine] 🛑 SL triggered for BUY ${symbol}: price ${exitPrice} <= SL ${sl}`);
          } else if (pos.side === 'sell' && exitPrice >= sl) {
            shouldClose = true;
            closeReason = 'stop_loss';
            console.log(`[SL/TP Engine] 🛑 SL triggered for SELL ${symbol}: price ${exitPrice} >= SL ${sl}`);
          }
        }

        // Check Take Profit (only if SL not triggered)
        if (!shouldClose && pos.take_profit !== null) {
          const tp = Number(pos.take_profit);
          if (pos.side === 'buy' && exitPrice >= tp) {
            shouldClose = true;
            closeReason = 'take_profit';
            console.log(`[SL/TP Engine] ✅ TP triggered for BUY ${symbol}: price ${exitPrice} >= TP ${tp}`);
          } else if (pos.side === 'sell' && exitPrice <= tp) {
            shouldClose = true;
            closeReason = 'take_profit';
            console.log(`[SL/TP Engine] ✅ TP triggered for SELL ${symbol}: price ${exitPrice} <= TP ${tp}`);
          }
        }

        if (shouldClose) {
          // Calculate P&L
          const entryPrice = Number(pos.entry_price);
          const qty = Number(pos.quantity);
          const priceDiff = pos.side === 'buy' 
            ? exitPrice - entryPrice 
            : entryPrice - exitPrice;
          
          realizedPnl = priceDiff * qty * contractSize;

          // Close the position
          const { error: closeError } = await supabase
            .from('positions')
            .update({
              status: 'closed',
              closed_at: new Date().toISOString(),
              current_price: exitPrice,
              realized_pnl: realizedPnl,
            })
            .eq('id', pos.id);

          if (closeError) {
            console.error(`[SL/TP Engine] Failed to close position ${pos.id}:`, closeError);
            results.errors++;
            continue;
          }

          // Create trade record
          await supabase.from('trades').insert({
            account_id: pos.account_id,
            position_id: pos.id,
            instrument_id: pos.instrument_id,
            side: pos.side,
            quantity: qty,
            entry_price: entryPrice,
            exit_price: exitPrice,
            realized_pnl: realizedPnl,
            opened_at: pos.opened_at,
          });

          // Update account balance and margin
          const { data: account } = await supabase
            .from('accounts')
            .select('balance, used_margin, peak_equity, max_drawdown_pct')
            .eq('id', pos.account_id)
            .single();

          if (account) {
            const newBalance = Number(account.balance) + realizedPnl;
            const newUsedMargin = Math.max(0, Number(account.used_margin) - Number(pos.margin_used));

            // Get remaining unrealized P&L
            const { data: openPositions } = await supabase
              .from('positions')
              .select('unrealized_pnl')
              .eq('account_id', pos.account_id)
              .eq('status', 'open');

            const totalUnrealizedPnl = openPositions?.reduce(
              (sum, p) => sum + Number(p.unrealized_pnl || 0), 0
            ) || 0;

            const newEquity = newBalance + totalUnrealizedPnl;
            const newPeakEquity = Math.max(Number(account.peak_equity), newEquity);
            const drawdown = newPeakEquity > 0 
              ? ((newPeakEquity - newEquity) / newPeakEquity) * 100 
              : 0;

            await supabase
              .from('accounts')
              .update({
                balance: newBalance,
                equity: newEquity,
                used_margin: newUsedMargin,
                peak_equity: newPeakEquity,
                max_drawdown_pct: Math.max(Number(account.max_drawdown_pct), drawdown),
              })
              .eq('id', pos.account_id);

            // Create equity snapshot
            await supabase.from('equity_snapshots').insert({
              account_id: pos.account_id,
              equity: newEquity,
              balance: newBalance,
              unrealized_pnl: totalUnrealizedPnl,
              max_drawdown_pct_so_far: Math.max(Number(account.max_drawdown_pct), drawdown),
            });
          }

          if (closeReason === 'stop_loss') {
            results.triggered_sl++;
          } else {
            results.triggered_tp++;
          }

          results.details.push(
            `${closeReason.toUpperCase()}: ${symbol} ${pos.side.toUpperCase()} @ ${exitPrice}, P&L: ${realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}`
          );
        }
      } catch (positionError) {
        console.error(`[SL/TP Engine] Error processing position ${pos.id}:`, positionError);
        results.errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SL/TP Engine] Completed in ${duration}ms:`, results);

    return new Response(JSON.stringify({
      success: true,
      ...results,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[SL/TP Engine] Error:', error);
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

