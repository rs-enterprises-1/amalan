# RSEnterprises - Vehicle Management System

A private internal vehicle management system for staff and admin users, built with Next.js, TypeScript, and Supabase.

## Features

### Role-Based Access
- **ADMIN (Owner)**: Can see profit, sell vehicles, use Sell Now, view monthly profit, access all reports
- **STAFF**: Cannot see profit, cannot sell vehicles, can add vehicles, manage costs, manage advances

### Main Sections

1. **Dashboard** - Summary page showing:
   - Vehicles sold this month (count)
   - Total advance money currently held
   - Lease money still to be collected
   - Monthly profit (ADMIN ONLY)
   - Quick action buttons

2. **Add Vehicle** - Multi-step form:
   - Step 1: Vehicle Details (Chassis Number, Maker, Model, Year, Mileage)
   - Step 2: Japan Costs (JPY) - Bidding, Commission, Insurance, Transport, Other costs
   - Step 3: Split CIF into Invoice Amount and Undial Amount (both manual)
   - Step 4: JPY → LKR Conversion (Invoice rate auto-fetched, Undial rate manual)
   - Sell Now option (Admin only)

3. **Available Vehicles** - Manage vehicles in stock:
   - View vehicle details and costs
   - Edit Local Costs with live running totals
   - Add Advance Payments
   - Mark as Sold
   - Sell Now (Admin only)

4. **Sold Vehicles** - View all sold vehicles:
   - Vehicle and customer details
   - Sold date and price
   - Profit (ADMIN ONLY)
   - Invoice re-print option

5. **Lease Money To Be Collected** - Track pending lease payments:
   - View vehicles under lease
   - Pending amounts and due dates
   - Mark as collected

6. **Reports** - System reports:
   - Monthly profit (ADMIN ONLY)
   - Sales summary
   - Advance summary
   - Lease collection summary

## Key Features

### Running Total System
When editing local costs, the system shows live running totals:
- Tax: BASE + Tax
- Clearance: BASE + Tax + Clearance
- Transport: BASE + Tax + Clearance + Transport
- Extra Costs: Each adds to the running total

### Advance Payment System
- First advance requires customer details and selling price
- Subsequent advances only require the payment amount
- System tracks all payments and calculates remaining balance
- Generates receipt for each advance payment

### Invoice Generation
- Invoices show vehicle and customer details
- Sold price displayed (profit NEVER shown)
- Advance payments deducted if applicable
- Balance paid calculated and displayed

## Technology Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Supabase** - Authentication and database
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **React Hook Form** - Form management

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_INVOICE_PREFIX=INV-
NEXT_PUBLIC_ADV_PREFIX=ADV-
NEXT_PUBLIC_SUMMARY_PREFIX=TS-
```

## Database Schema

### Vehicles Table
- `chassis_no` (PRIMARY KEY)
- Vehicle details (maker, model, year, mileage)
- Japan costs (JPY)
- CIF split (invoice/undial amounts and rates)
- Local costs (LKR)
- Computed totals

### Advances Table
- `chassis_no` (FK)
- Customer details
- Expected selling price (stored once)

### Advance Payments Table
- Multiple payments per vehicle
- Date and amount for each payment

### Sales Table
- `chassis_no` (FK)
- Sold price and currency
- Profit (always in LKR)
- Customer details

### Lease Collections Table
- `chassis_no` (FK)
- Due amount and date
- Collection status

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env.local`

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Important Rules

- NEVER auto-change manual rates
- NEVER show profit on invoices
- ALL profits stored in LKR
- Decimals MUST be supported
- Do NOT remove fields
- Do NOT simplify logic
- Follow EXACTLY as written

## License

Private internal system - All rights reserved

