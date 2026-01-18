import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Get and validate auth header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Client with user's auth for verifying user
    const supabaseUser = createClient(
      supabaseUrl!,
      supabaseAnonKey!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Admin client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      supabaseUrl!,
      supabaseServiceKey!
    );

    // Get user from auth header
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired token'
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const userId = user.id;
    console.log('User joining competition:', userId);

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { competition_id } = body;
    
    if (!competition_id || typeof competition_id !== 'string') {
      return new Response(JSON.stringify({ error: 'competition_id is required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get competition details
    const { data: competition, error: compError } = await supabaseAdmin
      .from('competitions')
      .select('id, name, status, starts_at, ends_at, entry_fee, max_participants')
      .eq('id', competition_id)
      .single();

    if (compError || !competition) {
      return new Response(JSON.stringify({ error: 'Competition not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Check if competition is joinable
    if (competition.status !== 'upcoming' && competition.status !== 'live') {
      return new Response(JSON.stringify({ 
        error: `Cannot join competition with status: ${competition.status}` 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Check if already joined (with account - fully joined)
    const { data: existingParticipant } = await supabaseAdmin
      .from('competition_participants')
      .select('id, accounts(id)')
      .eq('competition_id', competition_id)
      .eq('user_id', userId)
      .single();

    if (existingParticipant) {
      // Check if they have an account (fully joined)
      const accounts = existingParticipant.accounts as any;
      if (accounts && (Array.isArray(accounts) ? accounts.length > 0 : accounts.id)) {
        return new Response(JSON.stringify({ error: 'Already joined this competition' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      // Orphaned participant - clean it up
      console.log('Cleaning up orphaned participant:', existingParticipant.id);
      await supabaseAdmin
        .from('competition_participants')
        .delete()
        .eq('id', existingParticipant.id);
    }

    // Check participant limit
    if (competition.max_participants) {
      const { count } = await supabaseAdmin
        .from('competition_participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', competition_id);

      if (count && count >= competition.max_participants) {
        return new Response(JSON.stringify({ error: 'Competition is full' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Get competition rules for starting balance
    const { data: rules, error: rulesError } = await supabaseAdmin
      .from('competition_rules')
      .select('starting_balance')
      .eq('competition_id', competition_id)
      .single();

    if (rulesError || !rules) {
      return new Response(JSON.stringify({ error: 'Competition rules not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const startingBalance = rules.starting_balance;

    // Check wallet balance if entry fee > 0
    if (competition.entry_fee > 0) {
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from('wallet_accounts')
        .select('id, balance')
        .eq('user_id', userId)
        .single();

      if (walletError || !wallet) {
        return new Response(JSON.stringify({ error: 'Wallet not found. Please contact support.' }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      if (wallet.balance < competition.entry_fee) {
        return new Response(JSON.stringify({ 
          error: `Insufficient wallet balance. Required: $${competition.entry_fee}, Available: $${wallet.balance}` 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Deduct entry fee
      const { error: deductError } = await supabaseAdmin
        .from('wallet_accounts')
        .update({ balance: wallet.balance - competition.entry_fee })
        .eq('id', wallet.id);

      if (deductError) {
        return new Response(JSON.stringify({ error: 'Failed to process entry fee' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Record wallet transaction
      await supabaseAdmin.from('wallet_transactions').insert({
        wallet_account_id: wallet.id,
        type: 'entry_fee',
        amount: -competition.entry_fee,
        reference_type: 'competition',
        reference_id: competition_id,
        status: 'completed'
      });
    }

    // Create participant and account in a single transaction-like flow
    // Use upsert for participant to handle race conditions
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('competition_participants')
      .upsert({
        competition_id,
        user_id: userId,
        status: 'active'
      }, {
        onConflict: 'competition_id,user_id',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (participantError || !participant) {
      console.error('Failed to create participant:', participantError);
      return new Response(JSON.stringify({ error: 'Failed to join competition' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Participant created/found:', participant.id);

    // Check if account already exists for this participant
    const { data: existingAccount } = await supabaseAdmin
      .from('accounts')
      .select('id, balance, equity')
      .eq('participant_id', participant.id)
      .single();

    if (existingAccount) {
      console.log('Account already exists:', existingAccount.id);
      return new Response(JSON.stringify({
        success: true,
        participant_id: participant.id,
        account_id: existingAccount.id,
        starting_balance: existingAccount.balance,
        message: `Already joined ${competition.name}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create trading account
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .insert({
        participant_id: participant.id,
        balance: startingBalance,
        equity: startingBalance,
        used_margin: 0,
        peak_equity: startingBalance,
        max_drawdown_pct: 0,
        status: 'active'
      })
      .select('id, balance, equity')
      .single();

    if (accountError || !account) {
      console.error('Failed to create account:', JSON.stringify(accountError, null, 2));
      // Rollback: delete the participant
      await supabaseAdmin.from('competition_participants').delete().eq('id', participant.id);
      return new Response(JSON.stringify({ error: 'Failed to create trading account' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Account created:', account.id);

    // Create initial equity snapshot
    await supabaseAdmin.from('equity_snapshots').insert({
      account_id: account.id,
      equity: startingBalance,
      balance: startingBalance,
      unrealized_pnl: 0,
      max_drawdown_pct_so_far: 0
    });

    console.log('User joined successfully:', { participant_id: participant.id, account_id: account.id });

    return new Response(JSON.stringify({
      success: true,
      participant_id: participant.id,
      account_id: account.id,
      starting_balance: startingBalance,
      message: `Successfully joined ${competition.name}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in join-competition:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

