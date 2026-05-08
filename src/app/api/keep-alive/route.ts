import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  // Connect to Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Make a microscopic query to prove the database is active
  const { data, error } = await supabase.from('family_members').select('id').limit(1);

  if (error) {
    return NextResponse.json({ status: 'Error: Database asleep', error });
  }

  return NextResponse.json({ 
    status: 'Heartbeat successful. Database is awake!', 
    time: new Date().toISOString() 
  });
}
