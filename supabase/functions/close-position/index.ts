import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      body: JSON.stringify({ symbols: [symbol], update_db: false }),
    });

    if (!response.ok) {
      console.error(`Price engine error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.prices && data.prices[symbol]) {
      const price = data.prices[symbol];
      return { bid: price.bid, ask: price.ask, mid: price.mid };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching from price engine:`, error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== CLOSE POSITION FUNCTION STARTED ===');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No auth header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log('Supabase URL:', supabaseUrl ? 'SET' : 'NOT SET');
    console.log('Supabase Anon Key:', supabaseAnonKey ? 'SET' : 'NOT SET');

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('User authenticated:', user.id);

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new Response(JSON.stringify({ error: 'Invalid request body' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { position_id, competition_id } = body;
    console.log('Request:', { position_id, competition_id });

    if (!position_id || !competition_id) {
      return new Response(JSON.stringify({ error: 'position_id and competition_id are required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get participant
    const { data: participant, error: participantError } = await supabase
      .from('competition_participants')
      .select('id')
      .eq('competition_id', competition_id)
      .eq('user_id', user.id)
      .single();

    if (participantError) {
      console.error('Participant query error:', participantError);
      return new Response(JSON.stringify({ error: 'Failed to verify participation', details: participantError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!participant) {
      return new Response(JSON.stringify({ error: 'Not participating in this competition' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Participant found:', participant.id);

    // Get account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, balance, used_margin, peak_equity, max_drawdown_pct')
      .eq('participant_id', participant.id)
      .single();

    if (accountError) {
      console.error('Account query error:', accountError);
      return new Response(JSON.stringify({ error: 'Failed to get account', details: accountError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!account) {
      return new Response(JSON.stringify({ error: 'Account not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Account found:', account.id);

    // Get position
    const { data: position, error: posError } = await supabase
      .from('positions')
      .select('id, account_id, instrument_id, side, quantity, entry_price, margin_used, status, opened_at')
      .eq('id', position_id)
      .eq('account_id', account.id)
      .eq('status', 'open')
      .single();

    if (posError) {
      console.error('Position query error:', posError);
      return new Response(JSON.stringify({ error: 'Failed to get position', details: posError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!position) {
      return new Response(JSON.stringify({ error: 'Position not found or already closed' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Position found:', position.id, 'Status:', position.status);

    // Get instrument
    const { data: instrument } = await supabase
      .from('instruments')
      .select('symbol, contract_size')
      .eq('id', position.instrument_id)
      .single();

    const contractSize = Number(instrument?.contract_size || 1);
    const symbol = instrument?.symbol || '';

    console.log('Instrument:', symbol, 'Contract size:', contractSize);

    // Get close price
    let closePrice: number;
    let exitBid: number = 0;
    let exitAsk: number = 0;
    let priceSource: string = 'price-engine';

    const priceEngineResult = await fetchFromPriceEngine(symbol);
    
    if (priceEngineResult) {
      exitBid = priceEngineResult.bid;
      exitAsk = priceEngineResult.ask;
      closePrice = position.side === 'buy' ? exitBid : exitAsk;
      console.log('Price from engine:', { exitBid, exitAsk, closePrice });
    } else {
      // Fallback to entry price
      closePrice = Number(position.entry_price);
      exitBid = closePrice;
      exitAsk = closePrice;
      priceSource = 'entry_fallback';
      console.log('Using entry price as fallback:', closePrice);
    }

    // Calculate P&L
    const entryPrice = Number(position.entry_price);
    const qty = Number(position.quantity);
    const priceDiff = position.side === 'buy' 
      ? closePrice - entryPrice 
      : entryPrice - closePrice;
    
    const realizedPnl = priceDiff * qty * contractSize;

    console.log('P&L calculation:', { entryPrice, closePrice, qty, priceDiff, realizedPnl });

    // Update position to closed
    console.log('Updating position status to closed...');
    const { error: updateError } = await supabase
      .from('positions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        current_price: closePrice,
        realized_pnl: realizedPnl
      })
      .eq('id', position_id);

    if (updateError) {
      console.error('Failed to update position:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to close position', details: updateError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Position updated successfully');

    // Create trade record
    const { error: tradeError } = await supabase.from('trades').insert({
      account_id: account.id,
      position_id: position_id,
      instrument_id: position.instrument_id,
      side: position.side,
      quantity: qty,
      entry_price: entryPrice,
      exit_price: closePrice,
      realized_pnl: realizedPnl,
      opened_at: position.opened_at || new Date().toISOString()
    });

    if (tradeError) {
      console.error('Failed to create trade record:', tradeError);
      // Don't fail for this
    }

    // Update account
    const newBalance = account.balance + realizedPnl;
    const newUsedMargin = Math.max(0, account.used_margin - Number(position.margin_used));

    // Get remaining unrealized P&L
    const { data: openPositions } = await supabase
      .from('positions')
      .select('unrealized_pnl')
      .eq('account_id', account.id)
      .eq('status', 'open');

    const totalUnrealizedPnl = openPositions?.reduce((sum: number, p: any) => sum + Number(p.unrealized_pnl || 0), 0) || 0;
    const newEquity = newBalance + totalUnrealizedPnl;
    const newPeakEquity = Math.max(account.peak_equity, newEquity);
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
        max_drawdown_pct: Math.max(account.max_drawdown_pct, drawdown)
      })
      .eq('id', account.id);

    console.log('Account updated:', { newBalance, newEquity, newUsedMargin });

    // Create equity snapshot
    await supabase.from('equity_snapshots').insert({
      account_id: account.id,
      equity: newEquity,
      balance: newBalance,
      unrealized_pnl: totalUnrealizedPnl,
      max_drawdown_pct_so_far: Math.max(account.max_drawdown_pct, drawdown)
    });

    console.log('=== CLOSE POSITION SUCCESS ===');

    return new Response(JSON.stringify({
      success: true,
      position_id,
      close_price: closePrice,
      realized_pnl: realizedPnl,
      new_balance: newBalance,
      symbol,
      price_source: priceSource
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('=== CLOSE POSITION ERROR ===', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

