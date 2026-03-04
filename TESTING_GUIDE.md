# Testing Guide - Step by Step

## Step 1: Start the Development Server

Open your terminal in the project folder and run:

```bash
npm run dev
```

Wait until you see:
```
✓ Ready in X seconds
○ Local:        http://localhost:3000
```

---

## Step 2: Open the Application

1. Open your web browser
2. Go to: **http://localhost:3000**
3. You should see the login page

---

## Step 3: Login as Admin

1. Enter your admin email and password
2. Click "Sign In"
3. You should be redirected to the **Dashboard**

---

## Step 4: Test Dashboard

**What you should see:**
- ✅ 4 stat cards at the top (Vehicles Sold, Total Advance, Lease Money, Monthly Profit)
- ✅ Quick Action buttons below
- ✅ Sidebar navigation on the left (or hamburger menu on mobile)

**Verify:**
- Monthly Profit card is visible (admin only feature)
- All navigation links work

---

## Step 5: Test Adding a Vehicle

### 5.1 Start the Process
1. Click **"Add Vehicle"** button (or from sidebar)
2. You should see a 4-step progress indicator

### 5.2 Step 1: Vehicle Details
Fill in:
- **Chassis Number**: `TEST001` (or any unique number)
- **Maker**: `Toyota`
- **Model**: `Corolla`
- **Manufacturer Year**: `2020`
- **Mileage**: `50000`

Click **"Next"**

### 5.3 Step 2: Japan Costs (JPY)
Fill in some test values (all in JPY):
- **Bidding Price**: `1000000`
- **Commission**: `50000`
- **Insurance**: `30000`
- **Inland Transport**: `20000`
- **Other Cost 1 - Name**: `Custom Fee`
- **Other Cost 1 - Amount**: `10000`

**Check:** You should see "Total CIF Cost (JPY)" calculated automatically at the bottom.

Click **"Next"**

### 5.4 Step 3: Split CIF
- **Invoice Amount (JPY)**: `800000`
- **Undial Amount (JPY)**: `220000`

**Note:** These should add up to your CIF total (1,110,000 JPY)

Click **"Next"**

### 5.5 Step 4: JPY → LKR Conversion
- **Invoice Rate**: Should be auto-filled (1.333)
- **Undial Rate (Manual)**: Enter `1.998`

**Check:**
- Invoice LKR should be calculated: 800,000 × 1.333 = 1,066,400 LKR
- Undial LKR should be calculated: 220,000 × 1.998 = 439,560 LKR
- Total Japan Cost (LKR) should show: 1,505,960 LKR

**Optional:** Check the "Sell Now" checkbox to test admin-only feature

Click **"Save Vehicle"**

**Expected Result:** Vehicle is saved and you're redirected to Available Vehicles page

---

## Step 6: Test Available Vehicles Page

**What you should see:**
- Your newly added vehicle card
- Vehicle details (Maker, Model, Chassis, Year, Mileage)
- Japan Total (LKR)
- Local Total (LKR) - should be 0 or empty
- Combined Total (LKR)

**Buttons available:**
- Edit Local Costs
- Add Advance
- Mark Sold
- Sell Now (Admin only - should be visible)

---

## Step 7: Test Local Costs with Running Totals

1. Click **"Edit Costs"** on your vehicle
2. A modal should open showing:
   - Base (Japan Total) at the top
   - Input fields for Tax, Clearance, Transport, and 3 Extra Costs

3. **Test Running Totals:**
   - Enter **Tax**: `100000`
   - **Check:** Next to Tax field, you should see: "TOTAL = LKR 1,605,960" (Base + Tax)
   
   - Enter **Clearance**: `50000`
   - **Check:** Next to Clearance, you should see: "TOTAL = LKR 1,655,960" (Base + Tax + Clearance)
   
   - Enter **Transport**: `30000`
   - **Check:** Next to Transport, you should see: "TOTAL = LKR 1,685,960" (Base + Tax + Clearance + Transport)

4. **Test Extra Costs:**
   - Enter **Extra Cost 1 - Name**: `Registration`
   - Enter **Extra Cost 1 - Amount**: `25000`
   - **Check:** Running total updates to: "TOTAL = LKR 1,710,960"

5. At the bottom, you should see **"Final Combined Total"** showing the final amount

6. Click **"Save Changes"**

**Expected Result:** Modal closes, vehicle card updates with new Local Total

---

## Step 8: Test Advance Payment (First Time)

1. Click **"Add Advance"** on your vehicle
2. Modal opens

**First Advance - Should ask for:**
- Customer Name: `John Doe`
- Customer Phone: `+94 77 123 4567`
- Customer Address: `123 Main Street, Colombo`
- Selling Price (LKR): `3500000`
- Today's Payment Amount: `500000`

**Check:**
- Total Advance shows: LKR 500,000
- Remaining Balance shows: LKR 3,000,000

3. Click **"Save & Print Receipt"**

**Expected Result:**
- Confirmation dialog: "Print Advance Receipt?"
- Click "OK"
- Receipt opens in new window/tab
- Modal closes
- Vehicle card updates

---

## Step 9: Test Second Advance Payment

1. Click **"Add Advance"** on the same vehicle again
2. **Check:** Customer details should be pre-filled (not editable)
3. **Check:** Selling price should be pre-filled (not editable)
4. Only enter: **Today's Payment Amount**: `300000`

**Check:**
- Previous payments should be listed
- Total Advance should show: LKR 800,000 (500,000 + 300,000)
- Remaining Balance should show: LKR 2,700,000

5. Click **"Save & Print Receipt"**

**Expected Result:** Receipt shows all payment history

---

## Step 10: Test "Mark as Sold"

1. Click **"Mark Sold"** on your vehicle
2. Modal opens

**Check:**
- If advance exists: Customer details and selling price should be pre-filled
- If no advance: You need to enter customer details and selling price

3. Enter/Verify:
   - Sold Date: Today's date (or select a date)
   - Sold Price: Should match your advance selling price (or enter new)

4. **Check:** Cost Summary shows:
   - Total Cost
   - Sold Price
   - Profit (LKR) - calculated automatically

5. Click **"Mark as Sold & Print Invoice"**

**Expected Result:**
- Confirmation: "Print Final Invoice?"
- Click "OK"
- Invoice opens (should NOT show profit)
- Vehicle moves to "Sold Vehicles" page

---

## Step 11: Test Sold Vehicles Page

1. Click **"Sold Vehicles"** in sidebar
2. **Check:** Your vehicle should be listed

**What you should see:**
- Vehicle details
- Sold date
- Sold price
- **Profit (LKR)** - visible because you're admin
- Customer details
- "Re-print Invoice" button

3. Click **"Re-print Invoice"**

**Expected Result:** Invoice opens in new window

---

## Step 12: Test "Sell Now" (Admin Only)

1. Go back to **"Available Vehicles"**
2. Add another test vehicle (quick test: just fill minimum required fields)
3. Click **"Sell Now"** button (should be visible for admin)

**Check:**
- Modal opens
- Shows note about using Invoice JPY → LKR rate
- Fields:
  - Buyer Name
  - Buyer Address
  - Buyer Phone
  - Expected Profit (JPY)

4. Fill in:
   - Buyer Name: `Jane Smith`
   - Expected Profit (JPY): `50000`

5. **Check:** Calculation Preview shows:
   - Invoice Amount (JPY)
   - Expected Profit (JPY)
   - Sold Price (JPY)

6. Click **"Sell & Print Invoice"**

**Expected Result:**
- Confirmation: "Print Invoice?"
- Invoice opens (sold price in JPY, NO profit shown)
- Vehicle moves to Sold Vehicles

---

## Step 13: Test Reports Page

1. Click **"Reports"** in sidebar
2. **Check:** You should see:

**Admin View:**
- ✅ Monthly Profit card (large, prominent)
- ✅ Sales Summary
- ✅ Advance Summary
- ✅ Lease Collection Summary

**Verify:**
- Monthly Profit shows current month's profit
- Sales Summary shows total vehicles sold, total sales, average profit
- Advance Summary shows total advance and payment count
- Lease Summary shows pending and collected amounts

---

## Step 14: Test Staff User (Optional)

1. Logout (click logout in sidebar)
2. Login as staff user
3. **Check Differences:**
   - ❌ No "Sell Now" button on Available Vehicles
   - ❌ No Monthly Profit on Dashboard
   - ❌ No Profit column on Sold Vehicles
   - ❌ No Monthly Profit card on Reports
   - ✅ Can still add vehicles, edit costs, add advances, mark sold

---

## Step 15: Test Lease Collections (If You Have Data)

1. Go to **"Lease Money To Be Collected"**
2. If you have lease data, you should see:
   - Vehicle details
   - Pending amount
   - Due date
   - "Mark as Collected" button

3. Click **"Mark as Collected"**
4. Confirm the action
5. **Check:** Item should disappear from the list

---

## Common Issues & Solutions

### Issue: "Unauthorized" error
**Solution:** Check RLS policies in Supabase - make sure you ran the RLS setup script

### Issue: Tables not found
**Solution:** Verify all tables exist in Supabase → Table Editor

### Issue: Can't login
**Solution:** 
- Check user exists in Supabase → Authentication → Users
- Verify user has `role` metadata set to "admin"

### Issue: Running totals not updating
**Solution:** 
- Check browser console for errors
- Make sure you're entering numeric values
- Refresh the page

### Issue: Invoice not printing
**Solution:** 
- Check browser popup blocker
- Allow popups for localhost
- Try manually opening the print dialog

---

## Success Checklist

✅ Dashboard loads with all stats
✅ Can add vehicle through 4 steps
✅ Running totals update live when editing costs
✅ First advance asks for customer details
✅ Second advance doesn't ask for customer details again
✅ Receipts generate correctly
✅ Invoices generate without showing profit
✅ Admin sees profit, staff doesn't
✅ "Sell Now" only visible to admin
✅ Reports show correct data

---

**You're all set!** The system is working correctly if all the above tests pass.


