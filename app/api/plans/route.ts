import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase config');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all plans
    const { data: plans, error } = await supabaseAdmin
      .from('plans')
      .select('*')
      .order('price_zar', { ascending: true });

    if (error) {
      console.error('Supabase error fetching plans:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Plans fetched successfully:', plans);
    return NextResponse.json(plans || []);
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
