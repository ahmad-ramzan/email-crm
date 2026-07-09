-- ================================================================
-- Compact Outreach CRM - Supabase SQL Schema
-- ================================================================

-- Enums
DO $$ BEGIN CREATE TYPE public.crm_lead_status AS ENUM ('new', 'warm', 'hot', 'closed'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Leads Table
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    company TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    status public.crm_lead_status NOT NULL DEFAULT 'new',
    budget TEXT,
    next_step TEXT,
    notes TEXT,
    location TEXT,
    role TEXT,
    social_instagram TEXT,
    social_linkedin TEXT,
    website TEXT,
    last_outreach_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lead Timeline Table
CREATE TABLE IF NOT EXISTS public.crm_lead_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function for updated_at (if not already existing in this DB)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update `updated_at`
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_crm_leads_updated_at') THEN
    CREATE TRIGGER tr_crm_leads_updated_at
      BEFORE UPDATE ON public.crm_leads
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_timeline ENABLE ROW LEVEL SECURITY;

-- Policies (Assuming authenticated users can do everything for now)
-- You may want to restrict this depending on your auth setup
CREATE POLICY "Enable read access for authenticated users" ON public.crm_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.crm_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON public.crm_leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete access for authenticated users" ON public.crm_leads FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" ON public.crm_lead_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.crm_lead_timeline FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON public.crm_lead_timeline FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete access for authenticated users" ON public.crm_lead_timeline FOR DELETE TO authenticated USING (true);

-- Allow anon read/write since we don't have an auth setup running right now
CREATE POLICY "Enable read access for anon users" ON public.crm_leads FOR SELECT TO anon USING (true);
CREATE POLICY "Enable insert access for anon users" ON public.crm_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Enable update access for anon users" ON public.crm_leads FOR UPDATE TO anon USING (true);

CREATE POLICY "Enable read access for anon users" ON public.crm_lead_timeline FOR SELECT TO anon USING (true);
CREATE POLICY "Enable insert access for anon users" ON public.crm_lead_timeline FOR INSERT TO anon WITH CHECK (true);
