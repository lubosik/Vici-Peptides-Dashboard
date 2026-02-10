-- Fix: "trigger functions can only be called as triggers"
-- recalculate_order_totals_on_order_update() was calling recalculate_order_totals() via PERFORM;
-- in PostgreSQL, TRIGGER functions may only be invoked by triggers. Extract logic into a
-- callable function and have both triggers use it.

-- Standalone function: recalculate order totals for a given order_number (callable from triggers and SQL)
CREATE OR REPLACE FUNCTION recalculate_order_totals_for_order(p_order_number TEXT)
RETURNS void AS $$
DECLARE
  v_order_subtotal NUMERIC(10,2);
  v_order_product_cost NUMERIC(10,2);
  v_shipping_net_cost_absorbed NUMERIC(10,2);
  v_order_total NUMERIC(10,2);
  v_order_cost NUMERIC(10,2);
  v_order_profit NUMERIC(10,2);
  v_order_roi_percent NUMERIC(10,2);
  v_order_record RECORD;
BEGIN
  SELECT * INTO v_order_record FROM orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(line_total), 0) INTO v_order_subtotal
  FROM order_lines WHERE order_number = p_order_number;

  SELECT COALESCE(SUM(line_cost), 0) INTO v_order_product_cost
  FROM order_lines WHERE order_number = p_order_number;

  IF v_order_record.free_shipping = true THEN
    v_shipping_net_cost_absorbed := COALESCE(v_order_record.shipping_cost, 0);
  ELSE
    v_shipping_net_cost_absorbed := GREATEST(0, COALESCE(v_order_record.shipping_cost, 0) - COALESCE(v_order_record.shipping_charged, 0));
  END IF;

  v_order_total := v_order_subtotal + COALESCE(v_order_record.shipping_charged, 0) - COALESCE(v_order_record.coupon_discount, 0);
  v_order_cost := v_order_product_cost + v_shipping_net_cost_absorbed;
  v_order_profit := v_order_total - v_order_cost;

  IF v_order_cost = 0 AND v_order_profit > 0 THEN
    v_order_roi_percent := NULL;
  ELSIF v_order_cost = 0 THEN
    v_order_roi_percent := NULL;
  ELSE
    v_order_roi_percent := (v_order_profit / v_order_cost) * 100;
  END IF;

  UPDATE orders
  SET
    order_subtotal = v_order_subtotal,
    order_product_cost = v_order_product_cost,
    shipping_net_cost_absorbed = v_shipping_net_cost_absorbed,
    order_total = v_order_total,
    order_cost = v_order_cost,
    order_profit = v_order_profit,
    order_roi_percent = v_order_roi_percent,
    updated_at = NOW()
  WHERE order_number = p_order_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: delegate to callable function
CREATE OR REPLACE FUNCTION recalculate_order_totals()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_order_totals_for_order(COALESCE(NEW.order_number, OLD.order_number));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function on order update: call the callable function (not the trigger function)
CREATE OR REPLACE FUNCTION recalculate_order_totals_on_order_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_order_totals_for_order(NEW.order_number);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;