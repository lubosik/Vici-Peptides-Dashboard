/**
 * Imports coupons from Coupons.csv
 */

import { readCSV, getCSVPath } from '../utils/csv-reader.js';
import { supabase } from '../utils/supabase-client.js';
import { parsePercent, parseBoolean } from '../utils/parsers.js';

interface CouponRow {
  Coupon_Code: string;
  Discount_Type: string;
  Discount_Value: string;
  Description: string;
  Active: string;
}

export async function importCoupons(): Promise<{ inserted: number; updated: number; errors: number }> {
  console.log('🎫 Importing coupons...');
  
  const csvPath = getCSVPath('Vici_Order_Tracker_with_Expenses_v2 - Coupons.csv');
  const rows = readCSV(csvPath) as any[];
  
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  for (const row of rows) {
    try {
      const couponCode = row.Coupon_Code?.trim();
      if (!couponCode) {
        console.warn(`⚠️  Skipping row with empty Coupon_Code`);
        errors++;
        continue;
      }
      
      // Parse discount value (remove % symbol if present)
      const discountValueStr = row.Discount_Value?.trim() || '';
      const discountValue = parsePercent(discountValueStr);
      
      const coupon = {
        coupon_code: couponCode,
        discount_type: row.Discount_Type?.trim() || 'Percent',
        discount_value: discountValue,
        description: row.Description?.trim() || null,
        active: parseBoolean(row.Active),
      };
      
      // Upsert (insert or update on conflict)
      const { error } = await supabase
        .from('coupons')
        .upsert(coupon, { onConflict: 'coupon_code' });
      
      if (error) {
        console.error(`❌ Error importing coupon ${couponCode}:`, error.message);
        errors++;
      } else {
        const { data: existing } = await supabase
          .from('coupons')
          .select('coupon_code')
          .eq('coupon_code', couponCode)
          .single();
        
        if (existing) {
          updated++;
        } else {
          inserted++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing coupon row:`, error);
      errors++;
    }
  }
  
  console.log(`✅ Coupons import complete: ${inserted} inserted, ${updated} updated, ${errors} errors`);
  return { inserted, updated, errors };
}
