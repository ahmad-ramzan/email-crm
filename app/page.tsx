import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import CrmDashboard, { type Lead } from "./CrmDashboard";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase environment variables are missing.");
    return (
      <div style={{ padding: 20, color: 'red', fontFamily: 'sans-serif' }}>
        <h2>Missing Supabase Configuration</h2>
        <p>Please check your <code>.env.local</code> file and ensure <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> are set.</p>
      </div>
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {},
      remove(name: string, options: CookieOptions) {},
    },
  });

  const { data: leads, error } = await supabase
    .from("crm_leads")
    .select(`
      *,
      timeline:crm_lead_timeline(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching leads:", error);
    // You could render an error state here, but we will just pass an empty array to the dashboard for now.
  }

  const initialLeads: Lead[] = (leads || []).map((lead: any) => ({
    ...lead,
    timeline: lead.timeline?.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [],
  }));

  return <CrmDashboard initialLeads={initialLeads} />;
}
