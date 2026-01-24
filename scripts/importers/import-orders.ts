/**
 * Imports orders from Orders.csv with normalization logic
 * Normalizes denormalized CSV into orders (parent) + order_lines (child) tables
 */

import { readCSV, getCSVPath } from '../utils/csv-reader.js';
import { supabase } from '../utils/supabase-client.js';
import {
  parseDate,
  parseMoney,
  parseBoolean,
  normalizeOrderNumber,
  normalizeOrderStatus,
  parseIntSafe,
} from '../utils/parsers.js';

interface OrderRow {
  Order_Date: string;
  'Order_#': string;
  Customer_Name: string;
  Customer_Email: string;
  Product_ID: string;
  Qty_Ordered: string;
  Our_Cost_Per_Unit: string;
  Customer_Paid_Per_Unit: string;
  Line_Total: string;
  Line_Cost: string;
  Line_Profit: string;
  'Line_ROI_%': string;
  Shipping_Charged: string;
  Shipping_Cost: string;
  'Free_Shipping?': string;
  Order_Total: string;
  Order_Cost: string;
  Order_Profit: string;
  'Order_ROI_%': string;
  Payment_Method: string;
  Order_Status: string;
  Notes: string;
  Coupon_Code: string;
  Coupon_Discount: string;
}

interface OrderData {
  order_number: string;
  order_date: Date;
  customer_name: string | null;
  customer_email: string | null;
  shipping_charged: number;
  shipping_cost: number;
  free_shipping: boolean;
  coupon_code: string | null;
  coupon_discount: number;
  payment_method: string | null;
  order_status: string;
  notes: string | null;
}

interface OrderLineData {
  order_number: string;
  product_id: number;
  qty_ordered: number;
  our_cost_per_unit: number;
  customer_paid_per_unit: number;
}

export async function importOrders(): Promise<{ ordersInserted: number; ordersUpdated: number; linesInserted: number; errors: number }> {
  console.log('📦 Importing orders (with normalization)...');
  
  const csvPath = getCSVPath('Vici_Order_Tracker_with_Expenses_v2 - Orders.csv');
  const rows = readCSV(csvPath) as any[];
  
  // Group rows by Order_# to normalize
  const ordersMap = new Map<string, { order: OrderData; lines: OrderLineData[] }>();
  
  // First pass: collect all order data
  for (const row of rows) {
    const orderNumber = normalizeOrderNumber(row['Order_#']);
    if (!orderNumber) {
      console.warn(`⚠️  Skipping row with empty Order_#`);
      continue;
    }
    
    // Extract order-level data (same for all rows with same Order_#)
    if (!ordersMap.has(orderNumber)) {
      const orderDate = parseDate(row.Order_Date);
      if (!orderDate) {
        console.warn(`⚠️  Skipping order ${orderNumber} with invalid date: ${row.Order_Date}`);
        continue;
      }
      
      const order: OrderData = {
        order_number: orderNumber,
        order_date: orderDate,
        customer_name: row.Customer_Name?.trim() || null,
        customer_email: row.Customer_Email?.trim() || null,
        shipping_charged: parseMoney(row.Shipping_Charged),
        shipping_cost: parseMoney(row.Shipping_Cost),
        free_shipping: parseBoolean(row['Free_Shipping?']),
        coupon_code: row.Coupon_Code?.trim() || null,
        coupon_discount: 0, // Will be recalculated from coupon rules in second pass
        payment_method: row.Payment_Method?.trim() || null,
        order_status: normalizeOrderStatus(row.Order_Status),
        notes: row.Notes?.trim() || null,
      };
      
      ordersMap.set(orderNumber, { order, lines: [] });
    }
    
    // Extract line-level data (each row is a line item)
    const productId = parseIntSafe(row.Product_ID);
    if (!productId) {
      console.warn(`⚠️  Skipping line item with invalid Product_ID: ${row.Product_ID}`);
      continue;
    }
    
    const line: OrderLineData = {
      order_number: orderNumber,
      product_id: productId,
      qty_ordered: parseIntSafe(row.Qty_Ordered),
      our_cost_per_unit: parseMoney(row.Our_Cost_Per_Unit),
      customer_paid_per_unit: parseMoney(row.Customer_Paid_Per_Unit),
    };
    
    ordersMap.get(orderNumber)!.lines.push(line);
  }
  
  // Second pass: insert/update orders and order_lines
  let ordersInserted = 0;
  let ordersUpdated = 0;
  let linesInserted = 0;
  let errors = 0;
  
  for (const [orderNumber, { order, lines }] of ordersMap.entries()) {
    try {
      // Calculate coupon discount from coupon rules if coupon code provided
      if (order.coupon_code) {
        const { data: coupon } = await supabase
          .from('coupons')
          .select('coupon_code, discount_type, discount_value')
          .eq('coupon_code', order.coupon_code)
          .single();
        
        if (!coupon) {
          console.warn(`⚠️  Coupon ${order.coupon_code} not found, setting to null`);
          order.coupon_code = null;
          order.coupon_discount = 0;
        } else {
          // Recalculate coupon discount from rules
          // First, we need to calculate order subtotal from lines
          // But we haven't inserted lines yet, so we'll calculate it from the lines array
          let orderSubtotal = 0;
          for (const line of lines) {
            orderSubtotal += line.qty_ordered * line.customer_paid_per_unit;
          }
          
          // Calculate discount from coupon rules
          if (coupon.discount_type === 'Percent') {
            order.coupon_discount = Math.min(orderSubtotal * (coupon.discount_value / 100), orderSubtotal);
          } else if (coupon.discount_type === 'Fixed') {
            order.coupon_discount = Math.min(coupon.discount_value, orderSubtotal);
          } else {
            // Keep provided discount if coupon type is unknown
            console.warn(`⚠️  Unknown coupon type for ${order.coupon_code}, using provided discount`);
          }
        }
      } else {
        // No coupon code, ensure discount is 0
        order.coupon_discount = 0;
      }
      
      // Upsert order
      const { error: orderError } = await supabase
        .from('orders')
        .upsert(order, { onConflict: 'order_number' });
      
      if (orderError) {
        console.error(`❌ Error importing order ${orderNumber}:`, orderError.message);
        errors++;
        continue;
      }
      
      // Check if order was inserted or updated
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('order_number')
        .eq('order_number', orderNumber)
        .single();
      
      if (existingOrder) {
        ordersUpdated++;
      } else {
        ordersInserted++;
      }
      
      // Insert/update order lines
      for (const line of lines) {
        // Verify product exists
        const { data: product } = await supabase
          .from('products')
          .select('product_id')
          .eq('product_id', line.product_id)
          .single();
        
        if (!product) {
          console.warn(`⚠️  Product ${line.product_id} not found, skipping line item`);
          errors++;
          continue;
        }
        
        // Upsert order line (idempotent via unique constraint)
        const { error: lineError } = await supabase
          .from('order_lines')
          .upsert(line, {
            onConflict: 'order_number,product_id,our_cost_per_unit,customer_paid_per_unit',
          });
        
        if (lineError) {
          console.error(`❌ Error importing line item for order ${orderNumber}:`, lineError.message);
          errors++;
        } else {
          linesInserted++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing order ${orderNumber}:`, error);
      errors++;
    }
  }
  
  console.log(
    `✅ Orders import complete: ${ordersInserted} orders inserted, ${ordersUpdated} orders updated, ${linesInserted} line items inserted, ${errors} errors`
  );
  return { ordersInserted, ordersUpdated, linesInserted, errors };
}
