import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Connect as ADMIN (Bypasses all security rules)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log("⚠️ STARTING SYSTEM RESET...");

    // 1. Delete all family data
    // We use .neq("id", "0") to select "id is not equal to 0" (which means ALL rows)
    const { error: dbError } = await supabaseAdmin.from("family_members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (dbError) throw dbError;

    // 2. Delete all Users (The accounts themselves)
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    for (const user of users) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    }

    console.log("✅ SYSTEM RESET COMPLETE.");
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Reset Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}