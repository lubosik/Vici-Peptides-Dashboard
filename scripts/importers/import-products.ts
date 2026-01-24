/**
 * Imports products from Product_Inventory.csv
 */

import { readCSV, getCSVPath } from '../utils/csv-reader.js';
import { supabase } from '../utils/supabase-client.js';
import { parseIntSafe, parseMoney, parsePercent } from '../utils/parsers.js';

interface ProductRow {
  Product_ID: string;
  Product_Name: string;
  Variant_Strength: string;
  SKU_Code: string;
  'Lot_#': string;
  Starting_Qty: string;
  Qty_Sold: string;
  Current_Stock: string;
  Reorder_Level: string;
  Stock_Status: string;
  Our_Cost: string;
  Retail_Price: string;
  Unit_Margin: string;
  'Margin_%': string;
}

export async function importProducts(): Promise<{ inserted: number; updated: number; errors: number }> {
  console.log('📦 Importing products...');
  
  const csvPath = getCSVPath('Vici_Order_Tracker_with_Expenses_v2 - Product_Inventory.csv');
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
      
      const product = {
        product_id: productId,
        product_name: row.Product_Name?.trim() || null,
        variant_strength: row.Variant_Strength?.trim() || null,
        sku_code: row.SKU_Code?.trim() || null,
        lot_number: row['Lot_#']?.trim() || null,
        starting_qty: row.Starting_Qty ? parseIntSafe(row.Starting_Qty) : null,
        qty_sold: row.Qty_Sold ? parseIntSafe(row.Qty_Sold) : 0,
        current_stock: row.Current_Stock ? parseIntSafe(row.Current_Stock) : 0,
        reorder_level: row.Reorder_Level ? parseIntSafe(row.Reorder_Level) : null,
        stock_status: row.Stock_Status?.trim() || null,
        our_cost: row.Our_Cost ? parseMoney(row.Our_Cost) : null,
        retail_price: row.Retail_Price ? parseMoney(row.Retail_Price) : null,
        unit_margin: row.Unit_Margin ? parseMoney(row.Unit_Margin) : null,
        margin_percent: row['Margin_%'] ? parsePercent(row['Margin_%']) : null,
      };
      
      // Upsert (insert or update on conflict)
      const { error } = await supabase
        .from('products')
        .upsert(product, { onConflict: 'product_id' });
      
      if (error) {
        console.error(`❌ Error importing product ${productId}:`, error.message);
        errors++;
      } else {
        // Check if it was an insert or update by querying first
        const { data: existing } = await supabase
          .from('products')
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
      console.error(`❌ Error processing product row:`, error);
      errors++;
    }
  }
  
  console.log(`✅ Products import complete: ${inserted} inserted, ${updated} updated, ${errors} errors`);
  return { inserted, updated, errors };
}
