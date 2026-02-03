/**
 * Expense categories from Lists.csv
 */

export function getExpenseCategoriesFromLists(): string[] {
  // Categories from Lists.csv Expense_Categories column; Shipping for Shippo sync
  return [
    'Shipping',
    'Packaging',
    'Labels',
    'Tape',
    'Stickers',
    'Supplies',
    'Software',
    'Marketing',
    'Shipping Supplies',
    'Office',
    'Other',
    'Inventory',
  ]
}
