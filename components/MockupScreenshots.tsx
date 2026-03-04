'use client'

import { motion } from 'framer-motion'

export default function MockupScreenshots() {
  return (
    <div className="space-y-12 p-8 bg-slate-50">
      <h2 className="text-3xl font-bold text-center text-slate-800 mb-8">System Mockups</h2>
      
      {/* Dashboard Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <h3 className="text-xl font-bold mb-4">Dashboard</h3>
        <svg viewBox="0 0 1200 800" className="w-full h-auto border border-slate-200 rounded-lg">
          {/* Header */}
          <rect x="0" y="0" width="1200" height="80" fill="#1e40af" />
          <text x="40" y="50" fill="white" fontSize="24" fontWeight="bold">Vehicle Management System</text>
          <circle cx="1100" cy="40" r="20" fill="#fbbf24" />
          <text x="1080" y="45" fill="white" fontSize="12" textAnchor="middle">A</text>
          
          {/* Sidebar */}
          <rect x="0" y="80" width="250" height="720" fill="#f3f4f6" />
          <rect x="20" y="120" width="210" height="50" rx="8" fill="#3b82f6" />
          <text x="30" y="150" fill="white" fontSize="16">Dashboard</text>
          <rect x="20" y="190" width="210" height="40" rx="8" fill="white" />
          <text x="30" y="215" fill="#64748b" fontSize="14">Add Vehicle</text>
          <rect x="20" y="250" width="210" height="40" rx="8" fill="white" />
          <text x="30" y="275" fill="#64748b" fontSize="14">Available Vehicles</text>
          
          {/* Stats Cards */}
          <rect x="280" y="120" width="280" height="150" rx="12" fill="white" stroke="#e5e7eb" strokeWidth="2" />
          <circle cx="320" cy="180" r="30" fill="#10b981" />
          <text x="370" y="170" fontSize="18" fontWeight="bold" fill="#1f2937">Vehicles Sold</text>
          <text x="370" y="200" fontSize="32" fontWeight="bold" fill="#10b981">12</text>
          
          <rect x="580" y="120" width="280" height="150" rx="12" fill="white" stroke="#e5e7eb" strokeWidth="2" />
          <circle cx="620" cy="180" r="30" fill="#3b82f6" />
          <text x="670" y="170" fontSize="18" fontWeight="bold" fill="#1f2937">Total Advance</text>
          <text x="670" y="200" fontSize="28" fontWeight="bold" fill="#3b82f6">LKR 2,450,000</text>
          
          <rect x="880" y="120" width="280" height="150" rx="12" fill="white" stroke="#e5e7eb" strokeWidth="2" />
          <circle cx="920" cy="180" r="30" fill="#f59e0b" />
          <text x="970" y="170" fontSize="18" fontWeight="bold" fill="#1f2937">Lease Money</text>
          <text x="970" y="200" fontSize="28" fontWeight="bold" fill="#f59e0b">LKR 850,000</text>
          
          {/* Quick Actions */}
          <text x="280" y="320" fontSize="24" fontWeight="bold" fill="#1f2937">Quick Actions</text>
          <rect x="280" y="350" width="180" height="120" rx="12" fill="#3b82f6" />
          <text x="320" y="390" fill="white" fontSize="16" fontWeight="bold">Add Vehicle</text>
          
          <rect x="480" y="350" width="180" height="120" rx="12" fill="#10b981" />
          <text x="520" y="390" fill="white" fontSize="16" fontWeight="bold">Available</text>
          
          <rect x="680" y="350" width="180" height="120" rx="12" fill="#8b5cf6" />
          <text x="720" y="390" fill="white" fontSize="16" fontWeight="bold">Sold</text>
        </svg>
      </motion.div>

      {/* Add Vehicle Form Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6"
      >
        <h3 className="text-xl font-bold mb-4">Add Vehicle - Multi-Step Form</h3>
        <svg viewBox="0 0 1200 900" className="w-full h-auto border border-slate-200 rounded-lg">
          {/* Progress Steps */}
          <rect x="100" y="50" width="1000" height="100" fill="#f9fafb" />
          <circle cx="150" cy="100" r="25" fill="#3b82f6" />
          <text x="150" y="108" fill="white" fontSize="18" fontWeight="bold" textAnchor="middle">1</text>
          <line x1="200" y1="100" x2="300" y2="100" stroke="#3b82f6" strokeWidth="4" />
          <circle cx="350" cy="100" r="25" fill="#3b82f6" />
          <text x="350" y="108" fill="white" fontSize="18" fontWeight="bold" textAnchor="middle">2</text>
          <line x1="400" y1="100" x2="500" y2="100" stroke="#3b82f6" strokeWidth="4" />
          <circle cx="550" cy="100" r="25" fill="#e5e7eb" />
          <text x="550" y="108" fill="#64748b" fontSize="18" fontWeight="bold" textAnchor="middle">3</text>
          <line x1="600" y1="100" x2="700" y2="100" stroke="#e5e7eb" strokeWidth="4" />
          <circle cx="750" cy="100" r="25" fill="#e5e7eb" />
          <text x="750" y="108" fill="#64748b" fontSize="18" fontWeight="bold" textAnchor="middle">4</text>
          
          <text x="120" y="145" fontSize="12" fill="#64748b" textAnchor="middle">Vehicle Details</text>
          <text x="320" y="145" fontSize="12" fill="#64748b" textAnchor="middle">Japan Costs</text>
          <text x="520" y="145" fontSize="12" fill="#64748b" textAnchor="middle">Split CIF</text>
          <text x="720" y="145" fontSize="12" fill="#64748b" textAnchor="middle">Conversion</text>
          
          {/* Form Fields */}
          <rect x="200" y="200" width="800" height="60" rx="8" fill="white" stroke="#d1d5db" strokeWidth="2" />
          <text x="220" y="230" fontSize="14" fill="#374151" fontWeight="bold">Chassis Number *</text>
          <text x="220" y="250" fontSize="14" fill="#9ca3af">ABC123456789</text>
          
          <rect x="200" y="280" width="380" height="60" rx="8" fill="white" stroke="#d1d5db" strokeWidth="2" />
          <text x="220" y="310" fontSize="14" fill="#374151" fontWeight="bold">Maker *</text>
          <text x="220" y="330" fontSize="14" fill="#9ca3af">Toyota</text>
          
          <rect x="620" y="280" width="380" height="60" rx="8" fill="white" stroke="#d1d5db" strokeWidth="2" />
          <text x="640" y="310" fontSize="14" fill="#374151" fontWeight="bold">Model *</text>
          <text x="640" y="330" fontSize="14" fill="#9ca3af">Corolla</text>
          
          {/* Navigation Buttons */}
          <rect x="200" y="400" width="120" height="50" rx="8" fill="#e5e7eb" />
          <text x="260" y="430" fontSize="16" fill="#64748b" textAnchor="middle">Previous</text>
          
          <rect x="880" y="400" width="120" height="50" rx="8" fill="#3b82f6" />
          <text x="940" y="430" fontSize="16" fill="white" textAnchor="middle">Next</text>
        </svg>
      </motion.div>

      {/* Available Vehicles Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card p-6"
      >
        <h3 className="text-xl font-bold mb-4">Available Vehicles with Running Totals</h3>
        <svg viewBox="0 0 1200 700" className="w-full h-auto border border-slate-200 rounded-lg">
          {/* Vehicle Card 1 */}
          <rect x="50" y="50" width="500" height="280" rx="12" fill="white" stroke="#e5e7eb" strokeWidth="2" />
          <text x="70" y="90" fontSize="20" fontWeight="bold" fill="#1f2937">Toyota Corolla</text>
          <text x="70" y="115" fontSize="14" fill="#64748b">Chassis: ABC123456789</text>
          
          <line x1="70" y1="140" x2="500" y2="140" stroke="#e5e7eb" strokeWidth="1" />
          
          <text x="70" y="170" fontSize="14" fill="#64748b">Japan Total (LKR):</text>
          <text x="350" y="170" fontSize="14" fontWeight="bold" fill="#1f2937">LKR 2,500,000</text>
          
          <text x="70" y="200" fontSize="14" fill="#64748b">Local Total (LKR):</text>
          <text x="350" y="200" fontSize="14" fontWeight="bold" fill="#1f2937">LKR 450,000</text>
          
          <line x1="70" y1="220" x2="500" y2="220" stroke="#e5e7eb" strokeWidth="1" />
          
          <text x="70" y="250" fontSize="16" fontWeight="bold" fill="#1f2937">Combined Total:</text>
          <text x="350" y="250" fontSize="18" fontWeight="bold" fill="#3b82f6">LKR 2,950,000</text>
          
          {/* Buttons */}
          <rect x="70" y="270" width="100" height="40" rx="6" fill="#dbeafe" />
          <text x="120" y="293" fontSize="12" fill="#1e40af" textAnchor="middle">Edit Costs</text>
          
          <rect x="180" y="270" width="100" height="40" rx="6" fill="#dcfce7" />
          <text x="230" y="293" fontSize="12" fill="#166534" textAnchor="middle">Add Advance</text>
          
          {/* Running Total Example */}
          <rect x="600" y="50" width="550" height="400" rx="12" fill="#f0f9ff" stroke="#3b82f6" strokeWidth="2" />
          <text x="620" y="90" fontSize="18" fontWeight="bold" fill="#1e40af">Local Costs - Running Total</text>
          
          <text x="620" y="130" fontSize="14" fill="#64748b">Base (Japan Total):</text>
          <text x="900" y="130" fontSize="16" fontWeight="bold" fill="#1e40af">LKR 2,500,000</text>
          
          <rect x="620" y="150" width="500" height="50" rx="6" fill="white" stroke="#d1d5db" strokeWidth="1" />
          <text x="640" y="175" fontSize="14" fill="#374151">Tax (LKR)</text>
          <text x="640" y="195" fontSize="12" fill="#3b82f6" fontWeight="bold">TOTAL = LKR 2,650,000</text>
          
          <rect x="620" y="220" width="500" height="50" rx="6" fill="white" stroke="#d1d5db" strokeWidth="1" />
          <text x="640" y="245" fontSize="14" fill="#374151">Clearance (LKR)</text>
          <text x="640" y="265" fontSize="12" fill="#3b82f6" fontWeight="bold">TOTAL = LKR 2,800,000</text>
          
          <rect x="620" y="290" width="500" height="50" rx="6" fill="white" stroke="#d1d5db" strokeWidth="1" />
          <text x="640" y="315" fontSize="14" fill="#374151">Transport (LKR)</text>
          <text x="640" y="335" fontSize="12" fill="#3b82f6" fontWeight="bold">TOTAL = LKR 2,950,000</text>
        </svg>
      </motion.div>

      {/* Advance Payment Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card p-6"
      >
        <h3 className="text-xl font-bold mb-4">Advance Payment System</h3>
        <svg viewBox="0 0 1200 600" className="w-full h-auto border border-slate-200 rounded-lg">
          {/* Modal */}
          <rect x="200" y="50" width="800" height="500" rx="12" fill="white" stroke="#3b82f6" strokeWidth="3" />
          <text x="220" y="90" fontSize="24" fontWeight="bold" fill="#1f2937">Add Advance Payment</text>
          
          {/* Customer Info (First Advance) */}
          <rect x="240" y="120" width="720" height="50" rx="6" fill="white" stroke="#d1d5db" strokeWidth="1" />
          <text x="260" y="145" fontSize="14" fill="#374151" fontWeight="bold">Customer Name *</text>
          <text x="260" y="165" fontSize="14" fill="#9ca3af">John Doe</text>
          
          <rect x="240" y="190" width="720" height="50" rx="6" fill="white" stroke="#d1d5db" strokeWidth="1" />
          <text x="260" y="215" fontSize="14" fill="#374151" fontWeight="bold">Selling Price (LKR) *</text>
          <text x="260" y="235" fontSize="14" fill="#9ca3af">3,500,000</text>
          
          {/* Payment History */}
          <rect x="240" y="260" width="720" height="120" rx="6" fill="#f9fafb" stroke="#d1d5db" strokeWidth="1" />
          <text x="260" y="290" fontSize="14" fontWeight="bold" fill="#374151">Previous Payments</text>
          <text x="260" y="320" fontSize="12" fill="#64748b">2024-01-15: LKR 500,000</text>
          <text x="260" y="345" fontSize="12" fill="#64748b">2024-02-01: LKR 300,000</text>
          <text x="260" y="370" fontSize="12" fontWeight="bold" fill="#10b981">Total Paid: LKR 800,000</text>
          
          {/* Today's Payment */}
          <rect x="240" y="400" width="720" height="50" rx="6" fill="white" stroke="#d1d5db" strokeWidth="1" />
          <text x="260" y="425" fontSize="14" fill="#374151" fontWeight="bold">Today's Payment Amount (LKR) *</text>
          <text x="260" y="445" fontSize="14" fill="#9ca3af">200,000</text>
          
          {/* Summary */}
          <rect x="240" y="470" width="720" height="60" rx="6" fill="#dcfce7" stroke="#10b981" strokeWidth="2" />
          <text x="260" y="495" fontSize="14" fontWeight="bold" fill="#166534">Total Advance:</text>
          <text x="600" y="495" fontSize="18" fontWeight="bold" fill="#166534">LKR 1,000,000</text>
          <text x="260" y="520" fontSize="14" fontWeight="bold" fill="#166534">Remaining Balance:</text>
          <text x="600" y="520" fontSize="18" fontWeight="bold" fill="#1f2937">LKR 2,500,000</text>
        </svg>
      </motion.div>
    </div>
  )
}


