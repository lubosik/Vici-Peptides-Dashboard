/**
 * Imports tiered pricing from Tiered_Pricing.csv
 */

import { readCSV, getCSVPath } from '../utils/csv-reader.js';
import { supabase } from '../utils/supabase-client.js';
import { parseIntSafe, parseMoney } from '../utils/parsers.js';

interface TieredPricingRow {
  Product_ID: string;
  Product_Name: string;
  Strength: string;
  Cost_Per_Unit: string;
  MSRP_Slashed: string;
  Price_1_Unit: string;
  Price_2_Units: string;
  Price_3_Units: string;
  Price_5_Plus: string;
}

export async function importTieredPricing(): Promise<{ inserted: number; updated: number; errors: number }> {
  console.log('💰 Importing tiered pricing...');
  
  const csvPath = getCSVPath('Vici_Order_Tracker_with_Expenses_v2 - Tiered_Pricing.csv');
  const rows = readCSV(csvPath) as any[];
  
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  for (const row of rows) {
    try {
      const productId = parseIntSafe(row.Product_ID);
      if (!productId) {
        console.warn(`⚠️  Skipping row with invalid Product_ID: ${row.Product_ID}`);
        errors++;
        continue;
      }
      
      // Verify product exists
      const { data: product } = await supabase
        .from('products')
        .select('product_id')
        .eq('product_id', productId)
        .single();
      
      if (!product) {
        console.warn(`⚠️  Product ${productId} not found, skipping tiered pricing`);
        errors++;
        continue;
      }
      
      const tieredPricing = {
        product_id: productId,
        product_name: row.Product_Name?.trim() || null,
        strength: row.Strength?.trim() || null,
        cost_per_unit: row.Cost_Per_Unit ? parseMoney(row.Cost_Per_Unit) : null,
        msrp_slashed: row.MSRP_Slashed ? parseMoney(row.MSRP_Slashed) : null,
        price_1_unit: row.Price_1_Unit ? parseMoney(row.Price_1_Unit) : null,
        price_2_units: row.Price_2_Units ? parseMoney(row.Price_2_Units) : null,
        price_3_units: row.Price_3_Units ? parseMoney(row.Price_3_Units) : null,
        price_5_plus: row.Price_5_Plus ? parseMoney(row.Price_5_Plus) : null,
      };
      
      // Upsert (insert or update on conflict)
      const { error } = await supabase
        .from('tiered_pricing')
        .upsert(tieredPricing, { onConflict: 'product_id' });
      
      if (error) {
        console.error(`❌ Error importing tiered pricing for product ${productId}:`, error.message);
        errors++;
      } else {
        const { data: existing } = await supabase
          .from('tiered_pricing')
          .select('product_id')
          .eq('product_id', productId)
          .single();
        
        if (existing) {
          updated++;
        } else {
          inserted++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing tiered pricing row:`, error);
      errors++;
    }
  }
  
  console.log(`✅ Tiered pricing import complete: ${inserted} inserted, ${updated} updated, ${errors} errors`);
  return { inserted, updated, errors };
}
