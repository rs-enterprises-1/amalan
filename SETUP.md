# Setup Instructions

## Prerequisites

- Node.js 18+ installed
- Supabase account with database set up

## Database Setup

You need to create the following tables in your Supabase database:

### 1. Vehicles Table

```sql
CREATE TABLE vehicles (
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

### 2. Advances Table

```sql
CREATE TABLE advances (
  chassis_no TEXT PRIMARY KEY REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  expected_sell_price_lkr NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Advance Payments Table

```sql
CREATE TABLE advance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  paid_date DATE NOT NULL,
  amount_lkr NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Sales Table

```sql
CREATE TABLE sales (
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

### 5. Lease Collections Table

```sql
CREATE TABLE lease_collections (
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

### 6. User Roles

You'll need to set up user roles in Supabase. You can do this by:

1. Adding a `role` field to the `auth.users` metadata, OR
2. Creating a `profiles` table that references `auth.users`

Example profiles table:

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Installation Steps

1. **Clone or navigate to the project directory**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Copy `.env.local` (already created with your Supabase credentials)
   - Verify all environment variables are set correctly

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   - Open [http://localhost:3000](http://localhost:3000)
   - You'll be redirected to login if not authenticated

## Authentication Setup

1. In Supabase Dashboard, go to Authentication
2. Create users with email/password
3. Set user metadata with `role: 'admin'` or `role: 'staff'`

Or use the profiles table approach and insert records after user creation.

## Testing

1. Create a test admin user
2. Create a test staff user
3. Test all features:
   - Add vehicle (multi-step)
   - Edit local costs (check running totals)
   - Add advance payments
   - Mark as sold
   - View reports (admin should see profit, staff should not)

## Notes

- The JPY to LKR rate fetching is currently mocked. In production, you'll need to implement actual API integration.
- All profit calculations are done in LKR internally.
- Invoices never show profit amounts.
- The system follows all business rules exactly as specified.


