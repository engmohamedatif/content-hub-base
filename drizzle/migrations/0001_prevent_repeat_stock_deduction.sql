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