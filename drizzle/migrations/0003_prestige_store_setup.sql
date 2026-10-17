CREATE TABLE IF NOT EXISTS public.profiles (id uuid PRIMARY KEY, display_name text, phone text, avatar_url text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile owner read" ON public.profiles;
CREATE POLICY "profile owner read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "profile owner insert" ON public.profiles;
CREATE POLICY "profile owner insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "profile owner update" ON public.profiles;
CREATE POLICY "profile owner update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DO $t$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $t$;
CREATE TABLE IF NOT EXISTS public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.admin_emails (email text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, DELETE ON public.admin_emails TO authenticated;
GRANT ALL ON public.admin_emails TO service_role;
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_store_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL AND (lower(u.email) = 'atfm64803@gmail.com' OR EXISTS (SELECT 1 FROM public.admin_emails a WHERE lower(a.email) = lower(u.email)) OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin')))
$$;
GRANT EXECUTE ON FUNCTION public.is_store_admin() TO authenticated;
DROP POLICY IF EXISTS "admin email list" ON public.admin_emails;
CREATE POLICY "admin email list" ON public.admin_emails FOR SELECT TO authenticated USING (public.is_store_admin());
DROP POLICY IF EXISTS "admin email add" ON public.admin_emails;
CREATE POLICY "admin email add" ON public.admin_emails FOR INSERT TO authenticated WITH CHECK (public.is_store_admin() AND email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$');
DROP POLICY IF EXISTS "admin email remove" ON public.admin_emails;
CREATE POLICY "admin email remove" ON public.admin_emails FOR DELETE TO authenticated USING (public.is_store_admin());

CREATE TABLE IF NOT EXISTS public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, category text NOT NULL, subcategory text, card_description text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', image_urls text[] NOT NULL DEFAULT '{}', price numeric(12,2) NOT NULL CHECK(price >= 0), discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(discount_amount >= 0), discount_until timestamptz, stock integer NOT NULL DEFAULT 0 CHECK(stock >= 0), featured boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public active catalog" ON public.products;
CREATE POLICY "public active catalog" ON public.products FOR SELECT TO anon, authenticated USING (active = true);
DROP POLICY IF EXISTS "admin catalog read" ON public.products;
CREATE POLICY "admin catalog read" ON public.products FOR SELECT TO authenticated USING (public.is_store_admin());
DROP POLICY IF EXISTS "admin catalog insert" ON public.products;
CREATE POLICY "admin catalog insert" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_store_admin());
DROP POLICY IF EXISTS "admin catalog update" ON public.products;
CREATE POLICY "admin catalog update" ON public.products FOR UPDATE TO authenticated USING (public.is_store_admin()) WITH CHECK (public.is_store_admin());
DROP POLICY IF EXISTS "admin catalog delete" ON public.products;
CREATE POLICY "admin catalog delete" ON public.products FOR DELETE TO authenticated USING (public.is_store_admin());

CREATE TABLE IF NOT EXISTS public.orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, customer_name text NOT NULL, phone text NOT NULL, address text NOT NULL, notes text NOT NULL DEFAULT '', payment_method text NOT NULL CHECK(payment_method IN ('cod','instapay','vodafone')), payment_proof_path text, status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','confirmed','completed','cancelled')), total numeric(12,2) NOT NULL CHECK(total >= 0), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read orders" ON public.orders;
CREATE POLICY "admin read orders" ON public.orders FOR SELECT TO authenticated USING (public.is_store_admin());
DROP POLICY IF EXISTS "customer read orders" ON public.orders;
CREATE POLICY "customer read orders" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "admin update orders" ON public.orders;
CREATE POLICY "admin update orders" ON public.orders FOR UPDATE TO authenticated USING (public.is_store_admin()) WITH CHECK (public.is_store_admin());

CREATE TABLE IF NOT EXISTS public.order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id), product_name text NOT NULL, quantity integer NOT NULL CHECK(quantity > 0), unit_price numeric(12,2) NOT NULL CHECK(unit_price >= 0));
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read items" ON public.order_items;
CREATE POLICY "admin read items" ON public.order_items FOR SELECT TO authenticated USING (public.is_store_admin());
DROP POLICY IF EXISTS "customer read items" ON public.order_items;
CREATE POLICY "customer read items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.decrease_stock_on_completed_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item record;
BEGIN
 IF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
   RAISE EXCEPTION 'Completed orders cannot change status';
 END IF;
 IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
  FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
   UPDATE public.products SET stock = stock - item.quantity WHERE id = item.product_id AND stock >= item.quantity;
   IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock for product %', item.product_id; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS completed_order_stock ON public.orders;
CREATE TRIGGER completed_order_stock AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.decrease_stock_on_completed_order();

DROP POLICY IF EXISTS "admin product image uploads" ON storage.objects;
CREATE POLICY "admin product image uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.is_store_admin());
DROP POLICY IF EXISTS "admin product image reads" ON storage.objects;
CREATE POLICY "admin product image reads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images' AND public.is_store_admin());
DROP POLICY IF EXISTS "admin product image deletes" ON storage.objects;
CREATE POLICY "admin product image deletes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND public.is_store_admin());
DROP POLICY IF EXISTS "admin product image updates" ON storage.objects;
CREATE POLICY "admin product image updates" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND public.is_store_admin()) WITH CHECK (bucket_id = 'product-images' AND public.is_store_admin());
DROP POLICY IF EXISTS "admin proof reads" ON storage.objects;
CREATE POLICY "admin proof reads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND public.is_store_admin());

CREATE TABLE IF NOT EXISTS public.delivery_zones (
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
DROP POLICY IF EXISTS "public active zones" ON public.delivery_zones;
CREATE POLICY "public active zones" ON public.delivery_zones FOR SELECT TO anon, authenticated USING (active = true);
DROP POLICY IF EXISTS "admin zones read" ON public.delivery_zones;
CREATE POLICY "admin zones read" ON public.delivery_zones FOR SELECT TO authenticated USING (public.is_store_admin());
DROP POLICY IF EXISTS "admin zones insert" ON public.delivery_zones;
CREATE POLICY "admin zones insert" ON public.delivery_zones FOR INSERT TO authenticated WITH CHECK (public.is_store_admin());
DROP POLICY IF EXISTS "admin zones update" ON public.delivery_zones;
CREATE POLICY "admin zones update" ON public.delivery_zones FOR UPDATE TO authenticated USING (public.is_store_admin()) WITH CHECK (public.is_store_admin());
DROP POLICY IF EXISTS "admin zones delete" ON public.delivery_zones;
CREATE POLICY "admin zones delete" ON public.delivery_zones FOR DELETE TO authenticated USING (public.is_store_admin());

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zone_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS loyalty_discount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS location_url text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS loyalty_eligible boolean NOT NULL DEFAULT false;