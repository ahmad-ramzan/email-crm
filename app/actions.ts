"use server";

import { revalidatePath } from "next/cache";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Lead } from "./CrmDashboard";

// Helper to get supabase client in server actions
async function getSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
          }
        },
      },
    }
  );
}

export async function markOutreachToday(leadId: string, contactedToday: boolean) {
  const supabase = await getSupabase();
  const date = contactedToday ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("crm_leads")
    .update({ last_outreach_date: date })
    .eq("id", leadId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function createLead(data: Partial<Lead>) {
  const supabase = await getSupabase();

  if (!data.email) {
    throw new Error("Email is required.");
  }

  // Check for duplicate email
  const { data: existingLead } = await supabase
    .from("crm_leads")
    .select("id")
    .eq("email", data.email)
    .single();

  if (existingLead) {
    throw new Error("A lead with this email already exists.");
  }

  const { data: newLead, error } = await supabase
    .from("crm_leads")
    .insert([
      {
        full_name: data.full_name,
        company: data.company || null,
        email: data.email,
        phone: data.phone || null,
        status: data.status || 'new',
        notes: data.notes || null,
        social_linkedin: data.social_linkedin || null,
        social_instagram: data.social_instagram || null,
        website: data.website || null,
        location: data.location || null,
        role: data.role || null,
      }
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("crm_lead_timeline")
    .insert([
      {
        lead_id: newLead.id,
        title: "Lead Created",
        description: "Manually added via the dashboard",
      }
    ]);

  revalidatePath("/");
  return { ...newLead, timeline: [] } as Lead;
}

export async function updateLead(leadId: string, data: Partial<Lead>) {
  const supabase = await getSupabase();

  if (data.email) {
    // Check for duplicate email excluding the current lead
    const { data: existingLead } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("email", data.email)
      .neq("id", leadId)
      .single();

    if (existingLead) {
      throw new Error("A lead with this email already exists.");
    }
  }

  const { data: updatedLead, error } = await supabase
    .from("crm_leads")
    .update({
      full_name: data.full_name,
      company: data.company || null,
      email: data.email,
      phone: data.phone || null,
      status: data.status,
      notes: data.notes || null,
      social_linkedin: data.social_linkedin || null,
      social_instagram: data.social_instagram || null,
      website: data.website || null,
      location: data.location || null,
      role: data.role || null,
    })
    .eq("id", leadId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  return updatedLead;
}

export async function deleteLead(leadId: string) {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from("crm_leads")
    .delete()
    .eq("id", leadId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}
