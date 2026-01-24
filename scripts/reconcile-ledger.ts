/**
 * Ledger Reconciliation Report
 * 
 * This script reads CSV files directly and calculates all metrics from scratch
 * using the exact formulas defined in docs/calculations.md.
 * 
 * It then queries Supabase and compares the results to ensure they match
 * within tolerance ($0.01 for currency, 0.01% for percentages).
 */

import { readCSV, getCSVPath } from './utils/csv-reader.js';
import { supabase } from './utils/supabase-client.js';
import {
  parseDate,
  parseMoney,
  parseBoolean,
  parsePercent,
  normalizeOrderNumber,
  parseIntSafe,
} from './utils/parsers.js';

interface OrderRow {
  Order_Date: string;
  'Order_#': string;
  Customer_Name: string;
  Customer_Email: string;
  Product_ID: string;
  Qty_Ordered: string;
  Our_Cost_Per_Unit: string;
  Customer_Paid_Per_Unit: string;
  Line_Total: string; // Pre-calculated in CSV, but we'll recalculate
  Line_Cost: string; // Pre-calculated in CSV, but we'll recalculate
  Line_Profit: string; // Pre-calculated in CSV, but we'll recalculate
  'Line_ROI_%': string; // Pre-calculated in CSV, but we'll recalculate
  Shipping_Charged: string;
  Shipping_Cost: string;
  'Free_Shipping?': string;
  Order_Total: string; // Pre-calculated in CSV, but we'll recalculate
  Order_Cost: string; // Pre-calculated in CSV, but we'll recalculate
  Order_Profit: string; // Pre-calculated in CSV, but we'll recalculate
  'Order_ROI_%': string; // Pre-calculated in CSV, but we'll recalculate
  Payment_Method: string;
  Order_Status: string;
  Notes: string;
  Coupon_Code: string;
  Coupon_Discount: string;
}

interface ExpenseRow {
  Expense_Date: string;
  Category: string;
  Description: string;
  Vendor: string;
  Amount: string;
  Notes: string;
}

interface CouponRow {
  Coupon_Code: string;
  Discount_Type: string;
  Discount_Value: string;
  Active: string;
}

interface ReconciliationReport {
  csvMetrics: {
    totalRevenue: number;
    totalProductCost: number;
    totalShippingCostAbsorbed: number;
    totalProfit: number;
    totalOrders: number;
    totalUnitsSold: number;
    averageOrderValue: number;
    profitMargin: number;
    roiPercent: number;
    totalExpenses: number;
    netProfit: number;
  };
  dbMetrics: {
    totalRevenue: number;
    totalProductCost: number;
    totalShippingCostAbsorbed: number;
    totalProfit: number;
    totalOrders: number;
    totalUnitsSold: number;
    averageOrderValue: number;
    profitMargin: number;
    roiPercent: number;
    totalExpenses: number;
    netProfit: number;
  };
  differences: {
    totalRevenue: number;
    totalProductCost: number;
    totalShippingCostAbsorbed: number;
    totalProfit: number;
    totalOrders: number;
    totalUnitsSold: number;
    averageOrderValue: number;
    profitMargin: number;
    roiPercent: number;
    totalExpenses: number;
    netProfit: number;
  };
  passed: boolean;
}

/**
 * Calculate coupon discount from coupon rules or use provided value
 */
function calculateCouponDiscount(
  orderSubtotal: number,
  couponCode: string | null | undefined,
  providedDiscount: number,
  coupons: Map<string, { type: string; value: number }>
): number {
  // If coupon code provided, calculate from rules
  if (couponCode && coupons.has(couponCode)) {
    const coupon = coupons.get(couponCode)!;
    if (coupon.type === 'Percent') {
      return Math.min(orderSubtotal * (coupon.value / 100), orderSubtotal);
    } else if (coupon.type === 'Fixed') {
      return Math.min(coupon.value, orderSubtotal);
    }
  }
  // Otherwise use provided discount value
  return Math.min(providedDiscount, orderSubtotal);
}

/**
 * Calculate metrics from CSV files
 */
function calculateCSVMetrics(): {
  totalRevenue: number;
  totalProductCost: number;
  totalShippingCostAbsorbed: number;
  totalProfit: number;
  totalOrders: number;
  totalUnitsSold: number;
  averageOrderValue: number;
  profitMargin: number;
  roiPercent: number;
  totalExpenses: number;
  netProfit: number;
} {
  console.log('📊 Calculating metrics from CSV files...\n');

  // Load coupons for discount calculation
  const couponRows = readCSV(getCSVPath('Vici_Order_Tracker_with_Expenses_v2 - Coupons.csv')) as any[];
  const coupons = new Map<string, { type: string; value: number }>();
  couponRows.forEach((row: any) => {
    if (row.Coupon_Code) {
      coupons.set(row.Coupon_Code.trim(), {
        type: row.Discount_Type?.trim() || 'Fixed',
        value: parsePercent(row.Discount_Value) || parseMoney(row.Discount_Value),
      });
    }
  });

  // Load orders
  const orderRows = readCSV(getCSVPath('Vici_Order_Tracker_with_Expenses_v2 - Orders.csv')) as any[];

  // Group by order number
  const ordersMap = new Map<string, {
    orderDate: Date;
    lines: Array<{
      productId: number;
      qtyOrdered: number;
      ourCostPerUnit: number;
      customerPaidPerUnit: number;
    }>;
    shippingCharged: number;
    shippingCost: number;
    freeShipping: boolean;
    couponCode: string | null;
    couponDiscount: number;
  }>();

  // Process each row
  for (const row of orderRows) {
    const orderNumber = normalizeOrderNumber(row['Order_#']);
    if (!orderNumber) continue;

    const orderDate = parseDate(row.Order_Date);
    if (!orderDate) continue;

    if (!ordersMap.has(orderNumber)) {
      ordersMap.set(orderNumber, {
        orderDate,
        lines: [],
        shippingCharged: parseMoney(row.Shipping_Charged),
        shippingCost: parseMoney(row.Shipping_Cost),
        freeShipping: parseBoolean(row['Free_Shipping?']),
        couponCode: row.Coupon_Code?.trim() || null,
        couponDiscount: parseMoney(row.Coupon_Discount),
      });
    }

    const productId = parseIntSafe(row.Product_ID);
    if (!productId) continue;

    ordersMap.get(orderNumber)!.lines.push({
      productId,
      qtyOrdered: parseIntSafe(row.Qty_Ordered),
      ourCostPerUnit: parseMoney(row.Our_Cost_Per_Unit),
      customerPaidPerUnit: parseMoney(row.Customer_Paid_Per_Unit),
    });
  }

  // Calculate order-level metrics
  let totalRevenue = 0;
  let totalProductCost = 0;
  let totalShippingCostAbsorbed = 0;
  let totalProfit = 0;
  let totalUnitsSold = 0;

  for (const [orderNumber, order] of ordersMap.entries()) {
    // Calculate line-level totals
    let orderSubtotal = 0;
    let orderProductCost = 0;

    for (const line of order.lines) {
      // Line_Total = Qty_Ordered × Customer_Paid_Per_Unit
      const lineTotal = line.qtyOrdered * line.customerPaidPerUnit;
      orderSubtotal += lineTotal;

      // Line_Cost = Qty_Ordered × Our_Cost_Per_Unit
      const lineCost = line.qtyOrdered * line.ourCostPerUnit;
      orderProductCost += lineCost;

      totalUnitsSold += line.qtyOrdered;
    }

    // Shipping_Net_Cost_Absorbed
    let shippingNetCostAbsorbed = 0;
    if (order.freeShipping) {
      shippingNetCostAbsorbed = order.shippingCost;
    } else {
      shippingNetCostAbsorbed = Math.max(0, order.shippingCost - order.shippingCharged);
    }

    // Coupon_Discount (recalculate from rules if coupon code provided)
    const couponDiscount = calculateCouponDiscount(
      orderSubtotal,
      order.couponCode,
      order.couponDiscount,
      coupons
    );

    // Order_Total = Order_Subtotal + Shipping_Charged - Coupon_Discount
    const orderTotal = orderSubtotal + order.shippingCharged - couponDiscount;

    // Order_Cost = Order_Product_Cost + Shipping_Net_Cost_Absorbed
    const orderCost = orderProductCost + shippingNetCostAbsorbed;

    // Order_Profit = Order_Total - Order_Cost
    const orderProfit = orderTotal - orderCost;

    // Accumulate totals
    totalRevenue += orderTotal;
    totalProductCost += orderProductCost;
    totalShippingCostAbsorbed += shippingNetCostAbsorbed;
    totalProfit += orderProfit;
  }

  const totalOrders = ordersMap.size;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const totalCost = totalProductCost + totalShippingCostAbsorbed;
  const roiPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // Load expenses
  const expenseRows = readCSV(getCSVPath('Vici_Order_Tracker_with_Expenses_v2 - Expenses.csv')) as any[];
  const totalExpenses = expenseRows.reduce((sum, row) => sum + parseMoney(row.Amount), 0);
  const netProfit = totalProfit - totalExpenses;

  return {
    totalRevenue,
    totalProductCost,
    totalShippingCostAbsorbed,
    totalProfit,
    totalOrders,
    totalUnitsSold,
    averageOrderValue,
    profitMargin,
    roiPercent,
    totalExpenses,
    netProfit,
  };
}

/**
 * Query metrics from Supabase
 */
async function queryDBMetrics(): Promise<{
  totalRevenue: number;
  totalProductCost: number;
  totalShippingCostAbsorbed: number;
  totalProfit: number;
  totalOrders: number;
  totalUnitsSold: number;
  averageOrderValue: number;
  profitMargin: number;
  roiPercent: number;
  totalExpenses: number;
  netProfit: number;
}> {
  console.log('🔍 Querying metrics from Supabase...\n');

  // Total Revenue (sum of distinct orders)
  // Exclude checkout-draft and cancelled orders (no money exchanged)
  const { data: revenueData, error: revenueError } = await supabase
    .from('orders')
    .select('order_total')
    .not('order_status', 'in', '("checkout-draft","cancelled","draft")');
  if (revenueError) throw revenueError;
  const totalRevenue = (revenueData || []).reduce((sum, o) => sum + (Number(o.order_total) || 0), 0);

  // Total Product Cost (sum from orders)
  const { data: costData, error: costError } = await supabase
    .from('orders')
    .select('order_product_cost');
  if (costError) throw costError;
  const totalProductCost = (costData || []).reduce((sum, o) => sum + (Number(o.order_product_cost) || 0), 0);

  // Total Shipping Cost Absorbed
  // Exclude checkout-draft and cancelled orders (no money exchanged)
  const { data: shippingData, error: shippingError } = await supabase
    .from('orders')
    .select('shipping_net_cost_absorbed')
    .not('order_status', 'in', '("checkout-draft","cancelled","draft")');
  if (shippingError) throw shippingError;
  const totalShippingCostAbsorbed = (shippingData || []).reduce((sum, o) => sum + (Number(o.shipping_net_cost_absorbed) || 0), 0);

  // Total Profit (sum from orders)
  // Exclude checkout-draft and cancelled orders (no money exchanged)
  const { data: profitData, error: profitError } = await supabase
    .from('orders')
    .select('order_profit')
    .not('order_status', 'in', '("checkout-draft","cancelled","draft")');
  if (profitError) throw profitError;
  const totalProfit = (profitData || []).reduce((sum, o) => sum + (Number(o.order_profit) || 0), 0);

  // Total Orders (distinct count)
  // Exclude checkout-draft and cancelled orders (no money exchanged)
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('order_number')
    .not('order_status', 'in', '("checkout-draft","cancelled","draft")');
  if (ordersError) throw ordersError;
  const uniqueOrders = new Set((ordersData || []).map((o: any) => o.order_number));
  const totalOrders = uniqueOrders.size;

  // Total Units Sold (sum from order_lines)
  const { data: unitsData, error: unitsError } = await supabase
    .from('order_lines')
    .select('qty_ordered');
  if (unitsError) throw unitsError;
  const totalUnitsSold = (unitsData || []).reduce((sum, l) => sum + (Number(l.qty_ordered) || 0), 0);

  // Average Order Value
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Profit Margin
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // ROI Percent
  const totalCost = totalProductCost + totalShippingCostAbsorbed;
  const roiPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // Total Expenses
  const { data: expensesData, error: expensesError } = await supabase
    .from('expenses')
    .select('amount');
  if (expensesError) throw expensesError;
  const totalExpenses = (expensesData || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Net Profit
  const netProfit = totalProfit - totalExpenses;

  return {
    totalRevenue,
    totalProductCost,
    totalShippingCostAbsorbed,
    totalProfit,
    totalOrders,
    totalUnitsSold,
    averageOrderValue,
    profitMargin,
    roiPercent,
    totalExpenses,
    netProfit,
  };
}

/**
 * Compare metrics and generate report
 */
function compareMetrics(
  csvMetrics: ReturnType<typeof calculateCSVMetrics>,
  dbMetrics: Awaited<ReturnType<typeof queryDBMetrics>>
): ReconciliationReport {
  const differences = {
    totalRevenue: Math.abs(csvMetrics.totalRevenue - dbMetrics.totalRevenue),
    totalProductCost: Math.abs(csvMetrics.totalProductCost - dbMetrics.totalProductCost),
    totalShippingCostAbsorbed: Math.abs(csvMetrics.totalShippingCostAbsorbed - dbMetrics.totalShippingCostAbsorbed),
    totalProfit: Math.abs(csvMetrics.totalProfit - dbMetrics.totalProfit),
    totalOrders: Math.abs(csvMetrics.totalOrders - dbMetrics.totalOrders),
    totalUnitsSold: Math.abs(csvMetrics.totalUnitsSold - dbMetrics.totalUnitsSold),
    averageOrderValue: Math.abs(csvMetrics.averageOrderValue - dbMetrics.averageOrderValue),
    profitMargin: Math.abs(csvMetrics.profitMargin - dbMetrics.profitMargin),
    roiPercent: Math.abs(csvMetrics.roiPercent - dbMetrics.roiPercent),
    totalExpenses: Math.abs(csvMetrics.totalExpenses - dbMetrics.totalExpenses),
    netProfit: Math.abs(csvMetrics.netProfit - dbMetrics.netProfit),
  };

  // Check if all differences are within tolerance
  const currencyTolerance = 0.01;
  const percentTolerance = 0.01;
  const passed =
    differences.totalRevenue <= currencyTolerance &&
    differences.totalProductCost <= currencyTolerance &&
    differences.totalShippingCostAbsorbed <= currencyTolerance &&
    differences.totalProfit <= currencyTolerance &&
    differences.totalOrders === 0 &&
    differences.totalUnitsSold === 0 &&
    differences.averageOrderValue <= currencyTolerance &&
    differences.profitMargin <= percentTolerance &&
    differences.roiPercent <= percentTolerance &&
    differences.totalExpenses <= currencyTolerance &&
    differences.netProfit <= currencyTolerance;

  return {
    csvMetrics,
    dbMetrics,
    differences,
    passed,
  };
}

/**
 * Main reconciliation function
 */
async function reconcile(): Promise<void> {
  console.log('='.repeat(80));
  console.log('LEDGER RECONCILIATION REPORT');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Calculate from CSV
    const csvMetrics = calculateCSVMetrics();

    // Query from database
    const dbMetrics = await queryDBMetrics();

    // Compare
    const report = compareMetrics(csvMetrics, dbMetrics);

    // Print report
    console.log('='.repeat(80));
    console.log('METRICS COMPARISON');
    console.log('='.repeat(80));
    console.log('');

    const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
    const formatPercent = (val: number) => `${val.toFixed(2)}%`;

    console.log('Total Revenue:');
    console.log(`  CSV: ${formatCurrency(csvMetrics.totalRevenue)}`);
    console.log(`  DB:  ${formatCurrency(dbMetrics.totalRevenue)}`);
    console.log(`  Diff: ${formatCurrency(report.differences.totalRevenue)} ${report.differences.totalRevenue <= 0.01 ? '✅' : '❌'}`);
    console.log('');

    console.log('Total Product Cost:');
    console.log(`  CSV: ${formatCurrency(csvMetrics.totalProductCost)}`);
    console.log(`  DB:  ${formatCurrency(dbMetrics.totalProductCost)}`);
    console.log(`  Diff: ${formatCurrency(report.differences.totalProductCost)} ${report.differences.totalProductCost <= 0.01 ? '✅' : '❌'}`);
    console.log('');

    console.log('Total Shipping Cost Absorbed:');
    console.log(`  CSV: ${formatCurrency(csvMetrics.totalShippingCostAbsorbed)}`);
    console.log(`  DB:  ${formatCurrency(dbMetrics.totalShippingCostAbsorbed)}`);
    console.log(`  Diff: ${formatCurrency(report.differences.totalShippingCostAbsorbed)} ${report.differences.totalShippingCostAbsorbed <= 0.01 ? '✅' : '❌'}`);
    console.log('');

    console.log('Total Profit:');
    console.log(`  CSV: ${formatCurrency(csvMetrics.totalProfit)}`);
    console.log(`  DB:  ${formatCurrency(dbMetrics.totalProfit)}`);
    console.log(`  Diff: ${formatCurrency(report.differences.totalProfit)} ${report.differences.totalProfit <= 0.01 ? '✅' : '❌'}`);
    console.log('');

    console.log('Total Orders:');
    console.log(`  CSV: ${csvMetrics.totalOrders}`);
    console.log(`  DB:  ${dbMetrics.totalOrders}`);
    console.log(`  Diff: ${report.differences.totalOrders} ${report.differences.totalOrders === 0 ? '✅' : '❌'}`);
    console.log('');

    console.log('Total Units Sold:');
    console.log(`  CSV: ${csvMetrics.totalUnitsSold}`);
    console.log(`  DB:  ${dbMetrics.totalUnitsSold}`);
    console.log(`  Diff: ${report.differences.totalUnitsSold} ${report.differences.totalUnitsSold === 0 ? '✅' : '❌'}`);
    console.log('');

    console.log('Average Order Value:');
    console.log(`  CSV: ${formatCurrency(csvMetrics.averageOrderValue)}`);
    console.log(`  DB:  ${formatCurrency(dbMetrics.averageOrderValue)}`);
    console.log(`  Diff: ${formatCurrency(report.differences.averageOrderValue)} ${report.differences.averageOrderValue <= 0.01 ? '✅' : '❌'}`);
    console.log('');

    console.log('Profit Margin:');
    console.log(`  CSV: ${formatPercent(csvMetrics.profitMargin)}`);
    console.log(`  DB:  ${formatPercent(dbMetrics.profitMargin)}`);
    console.log(`  Diff: ${formatPercent(report.differences.profitMargin)} ${report.differences.profitMargin <= 0.01 ? '✅' : '❌'}`);
    console.log('');

    console.log('ROI Percent:');
    console.log(`  CSV: ${formatPercent(csvMetrics.roiPercent)}`);
    console.log(`  DB:  ${formatPercent(dbMetrics.roiPercent)}`);
    console.log(`  Diff: ${formatPercent(report.differences.roiPercent)} ${report.differences.roiPercent <= 0.01 ? '✅' : '❌'}`);
    console.log('');

    console.log('Total Expenses:');
    console.log(`  CSV: ${formatCurrency(csvMetrics.totalExpenses)}`);
    console.log(`  DB:  ${formatCurrency(dbMetrics.totalExpenses)}`);
    console.log(`  Diff: ${formatCurrency(report.differences.totalExpenses)} ${report.differences.totalExpenses <= 0.01 ? '✅' : '❌'}`);
    console.log('');

    console.log('Net Profit:');
    console.log(`  CSV: ${formatCurrency(csvMetrics.netProfit)}`);
    console.log(`  DB:  ${formatCurrency(dbMetrics.netProfit)}`);
    console.log(`  Diff: ${formatCurrency(report.differences.netProfit)} ${report.differences.netProfit <= 0.01 ? '✅' : '❌'}`);
    console.log('');

    console.log('='.repeat(80));
    if (report.passed) {
      console.log('✅ RECONCILIATION PASSED - All metrics match within tolerance');
    } else {
      console.log('❌ RECONCILIATION FAILED - Metrics do not match');
      process.exit(1);
    }
    console.log('='.repeat(80));

    // Write report to file
    const fs = await import('fs');
    const reportPath = './reconciliation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);

  } catch (error) {
    console.error('❌ Reconciliation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
reconcile();

export { reconcile, calculateCSVMetrics, queryDBMetrics, compareMetrics };
