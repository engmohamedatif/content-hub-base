ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_stage integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_updated_at timestamptz;
UPDATE public.orders SET tracking_code = upper(substr(replace(id::text,'-',''),1,8)) WHERE tracking_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_code_key ON public.orders (tracking_code);