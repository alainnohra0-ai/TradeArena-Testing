import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const userId = user.id;
    const { position_id, stop_loss, take_profit } = await req.json();

    if (!position_id) {
      return new Response(JSON.stringify({ error: 'position_id is required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Update position brackets request:', { userId, position_id, stop_loss, take_profit });

    // Get position and verify ownership
    const { data: position, error: posError } = await supabase
      .from('positions')
      .select(`
        id,
        account_id,
        side,
        entry_price,
        quantity,
        stop_loss,
        take_profit,
        accounts!inner(
          participant_id,
          competition_participants!inner(user_id)
        )
      `)
      .eq('id', position_id)
      .eq('status', 'open')
      .single();

    if (posError || !position) {
      console.error('Position not found:', posError);
      return new Response(JSON.stringify({ error: 'Position not found or already closed' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verify ownership
    const positionUserId = (position as any).accounts?.competition_participants?.user_id;
    if (positionUserId !== userId) {
      return new Response(JSON.stringify({ error: 'Not authorized to modify this position' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validate SL/TP based on position side
    const entryPrice = Number(position.entry_price);
    
    if (stop_loss !== undefined && stop_loss !== null) {
      // For BUY: SL must be below entry; For SELL: SL must be above entry
      if (position.side === 'buy' && stop_loss >= entryPrice) {
        return new Response(JSON.stringify({ 
          error: `Stop loss for BUY position must be below entry price (${entryPrice})` 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      if (position.side === 'sell' && stop_loss <= entryPrice) {
        return new Response(JSON.stringify({ 
          error: `Stop loss for SELL position must be above entry price (${entryPrice})` 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    if (take_profit !== undefined && take_profit !== null) {
      // For BUY: TP must be above entry; For SELL: TP must be below entry
      if (position.side === 'buy' && take_profit <= entryPrice) {
        return new Response(JSON.stringify({ 
          error: `Take profit for BUY position must be above entry price (${entryPrice})` 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      if (position.side === 'sell' && take_profit >= entryPrice) {
        return new Response(JSON.stringify({ 
          error: `Take profit for SELL position must be below entry price (${entryPrice})` 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Update position
    const updateData: Record<string, any> = {};
    if (stop_loss !== undefined) {
      updateData.stop_loss = stop_loss;
    }
    if (take_profit !== undefined) {
      updateData.take_profit = take_profit;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No updates provided. Specify stop_loss or take_profit' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { error: updateError } = await supabase
      .from('positions')
      .update(updateData)
      .eq('id', position_id);

    if (updateError) {
      console.error('Failed to update position brackets:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update brackets' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Position brackets updated successfully:', { position_id, ...updateData });

    return new Response(JSON.stringify({
      success: true,
      position_id,
      stop_loss: updateData.stop_loss ?? position.stop_loss,
      take_profit: updateData.take_profit ?? position.take_profit
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in update-position-brackets:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});