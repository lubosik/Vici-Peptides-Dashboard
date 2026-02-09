-- Migration: Expense imports and categorization rules for credit card statement upload
CREATE TABLE IF NOT EXISTS expense_imports (
  id BIGSERIAL PRIMARY KEY,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  source_file TEXT NOT NULL,
  total_lines INT DEFAULT 0,
  approved_lines INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'approved', 'rejected')),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS expense_import_lines (
  id BIGSERIAL PRIMARY KEY,
  import_id BIGINT NOT NULL REFERENCES expense_imports(id) ON DELETE CASCADE,
  expense_date DATE,
  description TEXT,
  vendor TEXT,
  amount NUMERIC(10,2),
  category TEXT,
  auto_categorized BOOLEAN DEFAULT FALSE,
  approved BOOLEAN DEFAULT FALSE,
  rejected BOOLEAN DEFAULT FALSE,
  expense_id BIGINT REFERENCES expenses(expense_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_categorization_rules (
  id BIGSERIAL PRIMARY KEY,
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL DEFAULT 'contains' CHECK (pattern_type IN ('contains', 'regex', 'exact')),
  category TEXT NOT NULL,
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_import_lines_import_id ON expense_import_lines(import_id);
CREATE INDEX IF NOT EXISTS idx_import_lines_approved ON expense_import_lines(approved);
CREATE INDEX IF NOT EXISTS idx_rules_active ON expense_categorization_rules(active);
