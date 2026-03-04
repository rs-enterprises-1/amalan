# Getting Started - Step by Step Guide

## Step 1: Install Dependencies

Open your terminal in the project folder and run:

```bash
npm install
```

This will install all required packages (Next.js, React, Supabase, etc.)

**Wait for this to complete before moving to the next step.**

---

## Step 2: Set Up Supabase Database Tables

You need to create 5 tables in your Supabase database. Follow these steps:

### 2.1 Go to Supabase Dashboard
1. Open https://supabase.com/dashboard
2. Select your project (or create a new one)
3. Click on "SQL Editor" in the left sidebar

### 2.2 Create the Tables

**Option A: Use the Complete Script (Recommended)**

Copy the entire contents of `database-setup.sql` file and paste into SQL Editor, then click "Run". This script uses `CREATE TABLE IF NOT EXISTS` so it won't error if tables already exist.

**Option B: Create Tables Individually**

If you prefer to create them one by one, copy and paste each SQL script below:

#### Table 1: Vehicles
```sql
CREATE TABLE IF NOT EXISTS vehicles (
  chassis_no TEXT PRIMARY KEY,
  maker TEXT NOT NULL,
  model TEXT NOT NULL,
  manufacturer_year INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'sold')),
  
  -- Japan costs (JPY)
  bid_jpy NUMERIC,
  commission_jpy NUMERIC,
  insurance_jpy NUMERIC,
  inland_transport_jpy NUMERIC,
  other_jpy NUMERIC,
  other_label TEXT,
  
  -- CIF split
  invoice_amount_jpy NUMERIC,
  invoice_jpy_to_lkr_rate NUMERIC,
  undial_amount_jpy NUMERIC,
  undial_jpy_to_lkr_rate NUMERIC,
  
  -- Local costs (LKR)
  tax_lkr NUMERIC,
  clearance_lkr NUMERIC,
  transport_lkr NUMERIC,
  local_extra1_label TEXT,
  local_extra1_lkr NUMERIC,
  local_extra2_label TEXT,
  local_extra2_lkr NUMERIC,
  local_extra3_label TEXT,
  local_extra3_lkr NUMERIC,
  
  -- Computed totals
  japan_total_lkr NUMERIC,
  final_total_lkr NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 2: Advances
```sql
CREATE TABLE IF NOT EXISTS advances (
  chassis_no TEXT PRIMARY KEY REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  expected_sell_price_lkr NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 3: Advance Payments
```sql
CREATE TABLE IF NOT EXISTS advance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  paid_date DATE NOT NULL,
  amount_lkr NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 4: Sales
```sql
CREATE TABLE IF NOT EXISTS sales (
  chassis_no TEXT PRIMARY KEY REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  sold_price NUMERIC NOT NULL,
  sold_currency TEXT NOT NULL CHECK (sold_currency IN ('JPY', 'LKR')),
  rate_jpy_to_lkr NUMERIC,
  profit_lkr NUMERIC NOT NULL,
  sold_date DATE NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_address TEXT,
  buyer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 5: Lease Collections
```sql
CREATE TABLE IF NOT EXISTS lease_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  due_amount_lkr NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  collected BOOLEAN DEFAULT FALSE,
  collected_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Important:** 
- If using Option A: Run the entire `database-setup.sql` script once
- If using Option B: Run each CREATE TABLE statement separately. Wait for "Success" message before running the next one.
- The `IF NOT EXISTS` clause prevents errors if tables already exist

---

## Step 3: Set Up Row Level Security (RLS)

**If you used Option A (database-setup.sql):** RLS is already set up! Skip to Step 4.

**If you used Option B:** In Supabase SQL Editor, run this to enable RLS on all tables:

```sql
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_collections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Allow authenticated users" ON advances;
DROP POLICY IF EXISTS "Allow authenticated users" ON advance_payments;
DROP POLICY IF EXISTS "Allow authenticated users" ON sales;
DROP POLICY IF EXISTS "Allow authenticated users" ON lease_collections;

-- Allow authenticated users to access all data
CREATE POLICY "Allow authenticated users" ON vehicles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON advances FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON advance_payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON sales FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON lease_collections FOR ALL USING (auth.role() = 'authenticated');
```

---

## Step 4: Create Test Users

### 4.1 Go to Authentication
1. In Supabase Dashboard, click "Authentication" in the left sidebar
2. Click "Users" tab

### 4.2 Create Admin User
1. Click "Add user" → "Create new user"
2. Enter email: `admin@test.com`
3. Enter password: `admin123` (or your choice)
4. Click "Create user"
5. After creation, click on the user
6. In "User Metadata" section, click "Add new field"
7. Add:
   - Key: `role`
   - Value: `admin`
8. Click "Save"

### 4.3 Create Staff User
1. Click "Add user" again
2. Enter email: `staff@test.com`
3. Enter password: `staff123` (or your choice)
4. Click "Create user"
5. After creation, click on the user
6. In "User Metadata" section, add:
   - Key: `role`
   - Value: `staff`
7. Click "Save"

---

## Step 5: Verify Environment Variables

Check that your `.env.local` file exists and has these values:

```
NEXT_PUBLIC_SUPABASE_URL=https://aluvxkhvaceaebaqwijn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdXZ4a2h2YWNlYWViYXF3aWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3Mjc2OTMsImV4cCI6MjA4MjMwMzY5M30.9lN1UHmE-q71jS0NxRPKmuFm31-VKYf7Ei3T6pNRUPs
NEXT_PUBLIC_INVOICE_PREFIX=INV-
NEXT_PUBLIC_ADV_PREFIX=ADV-
NEXT_PUBLIC_SUMMARY_PREFIX=TS-
```

**If `.env.local` doesn't exist, create it and add the above content.**

---

## Step 6: Start the Development Server

In your terminal, run:

```bash
npm run dev
```

You should see:
```
✓ Ready in X seconds
○ Local:        http://localhost:3000
```

---

## Step 7: Test the Application

1. **Open your browser** and go to: http://localhost:3000

2. **Login** with:
   - Email: `admin@test.com`
   - Password: `admin123`

3. **You should see the Dashboard** with:
   - Stats cards
   - Quick action buttons
   - Monthly profit (visible because you're admin)

4. **Test Adding a Vehicle:**
   - Click "Add Vehicle"
   - Fill in Step 1: Chassis Number, Maker, Model, Year, Mileage
   - Click "Next"
   - Fill in Step 2: Japan costs (enter some test values)
   - Click "Next"
   - Fill in Step 3: Split CIF amounts
   - Click "Next"
   - Step 4: Invoice rate is auto-filled, enter Undial rate (e.g., 1.998)
   - Click "Save Vehicle"

5. **Test Local Costs:**
   - Go to "Available Vehicles"
   - Click "Edit Costs" on your vehicle
   - Enter Tax amount - notice the running total updates
   - Enter Clearance - total updates again
   - Save

6. **Test Advance Payment:**
   - Click "Add Advance" on a vehicle
   - Enter customer details and selling price (first time)
   - Enter payment amount
   - Save and print receipt

7. **Test Staff User:**
   - Logout
   - Login as `staff@test.com` / `staff123`
   - Notice: No "Sell Now" button, no profit visible

---

## Step 8: Troubleshooting

### If you see "Table doesn't exist" error:
- Go back to Step 2 and make sure all tables were created successfully

### If login doesn't work:
- Check that users were created in Supabase Authentication
- Verify user metadata has `role` field set

### If you see "Unauthorized" error:
- Check RLS policies in Step 3
- Make sure you ran all the CREATE POLICY statements

### If the app won't start:
- Make sure you ran `npm install` (Step 1)
- Check that Node.js version is 18 or higher: `node --version`

---

## You're Done! 🎉

The system is now ready to use. You can:
- Add vehicles
- Manage costs
- Track advances
- Mark vehicles as sold
- View reports
- Generate invoices

**Next Steps:**
- Add more users as needed
- Customize the JPY to LKR rate fetching (currently mocked)
- Add more vehicles and test all features

