CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  fee numeric NOT NULL DEFAULT 0 CHECK (fee >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT ALL ON public.delivery_zones TO service_role;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public active zones" ON public.delivery_zones FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "admin zones read" ON public.delivery_zones FOR SELECT TO authenticated USING (public.is_store_admin());
CREATE POLICY "admin zones insert" ON public.delivery_zones FOR INSERT TO authenticated WITH CHECK (public.is_store_admin());
CREATE POLICY "admin zones update" ON public.delivery_zones FOR UPDATE TO authenticated USING (public.is_store_admin()) WITH CHECK (public.is_store_admin());
CREATE POLICY "admin zones delete" ON public.delivery_zones FOR DELETE TO authenticated USING (public.is_store_admin());

ALTER TABLE public.orders ADD COLUMN zone_name text;
ALTER TABLE public.orders ADD COLUMN delivery_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN subtotal numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN loyalty_discount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN location_url text;
ALTER TABLE public.order_items ADD COLUMN loyalty_eligible boolean NOT NULL DEFAULT false;