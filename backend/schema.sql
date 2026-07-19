-- 1. Enable UUID generation
-- (Supabase has gen_random_uuid() enabled by default in modern PG engines)

-- 2. Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS bank_accounts;
DROP TABLE IF EXISTS day_summaries;

-- 3. Create Day Summaries Table
CREATE TABLE day_summaries (
  date TEXT PRIMARY KEY, -- Format: YYYY-MM-DD
  opening_cash NUMERIC DEFAULT 0 NOT NULL,
  closing_cash NUMERIC DEFAULT 0 NOT NULL,
  total_profit NUMERIC DEFAULT 0 NOT NULL,
  status TEXT CHECK (status IN ('Open', 'Closed')) DEFAULT 'Open' NOT NULL,
  bank_balances JSONB DEFAULT '{}'::jsonb, -- Stores snapshot of bank balances at close
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Create Bank Accounts Table
CREATE TABLE bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name TEXT UNIQUE NOT NULL,
  current_balance NUMERIC DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Create Transactions Table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('Credit', 'Debit')) DEFAULT 'Credit' NOT NULL, -- Credit = Cash Out, Debit = Cash In
  customer_amount NUMERIC NOT NULL,
  cash_out NUMERIC NOT NULL,
  profit NUMERIC NOT NULL,
  customer_name TEXT DEFAULT NULL,
  commission_mode TEXT CHECK (commission_mode IN ('Deducted', 'Cash', 'Bank')) DEFAULT 'Deducted' NOT NULL, -- How commission was paid
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Create Atomic ACID Transaction RPC Function
CREATE OR REPLACE FUNCTION create_transaction_atomic(
  p_bank_account_id UUID,
  p_customer_amount NUMERIC,
  p_cash_out NUMERIC,
  p_profit NUMERIC,
  p_customer_name TEXT DEFAULT NULL,
  p_type TEXT DEFAULT 'Credit',
  p_commission_mode TEXT DEFAULT 'Deducted'
) RETURNS JSON AS $$
DECLARE
  v_active_day RECORD;
  v_transaction_id UUID;
BEGIN
  -- 1. Find the active (Open) day
  SELECT * INTO v_active_day FROM day_summaries WHERE status = 'Open' LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active day is currently open. Please start a day summary first.';
  END IF;

  -- 2. Increment targeted BankAccount balance (adds signed value: decrements if negative!)
  UPDATE bank_accounts 
  SET current_balance = current_balance + p_customer_amount 
  WHERE id = p_bank_account_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank account not found.';
  END IF;

  -- 3. Update day summary (subtracts signed cash_out: increments cash if negative!)
  UPDATE day_summaries 
  SET closing_cash = closing_cash - p_cash_out,
      total_profit = total_profit + p_profit
  WHERE date = v_active_day.date;

  -- 4. Insert transaction record
  INSERT INTO transactions (bank_account_id, type, customer_amount, cash_out, profit, customer_name, commission_mode, timestamp)
  VALUES (p_bank_account_id, p_type, p_customer_amount, p_cash_out, p_profit, p_customer_name, p_commission_mode, NOW())
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id
  );
END;
$$ LANGUAGE plpgsql;
