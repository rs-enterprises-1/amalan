'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { User } from '@/lib/supabase'
import { getCompanySettings } from '@/lib/settings'
import { 
  LayoutDashboard, 
  PlusCircle, 
  Car, 
  CheckCircle, 
  Receipt, 
  FileText,
  LogOut,
  Menu,
  X,
  FileCheck,
  DollarSign,
  Calculator,
  CarFront,
  ChevronRight,
  ChevronDown,
  Settings
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [companyName, setCompanyName] = useState('RSEnterprises') // Default fallback
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    checkUser()
    loadCompanyName()
    
    // Listen for settings updates
    const handleSettingsUpdate = () => {
      loadCompanyName()
    }
    
    window.addEventListener('companySettingsUpdated', handleSettingsUpdate)
    
    return () => {
      window.removeEventListener('companySettingsUpdated', handleSettingsUpdate)
    }
  }, [])

  async function loadCompanyName() {
    try {
      const settings = await getCompanySettings()
      if (settings?.company_name) {
        setCompanyName(settings.company_name)
        // Update document title
        document.title = `${settings.company_name} - Vehicle Management System`
      }
    } catch (error) {
      console.error('Error loading company name:', error)
      // Keep default fallback
    }
  }

  async function checkUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      router.push('/login')
      return
    }
    
    const role = (authUser.user_metadata?.role as 'admin' | 'staff') || 'staff'
    setUser({
      id: authUser.id,
      email: authUser.email!,
      role,
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems: Array<{
    href?: string
    label: string
    icon: any
    submenu?: Array<{ href: string; label: string }>
  }> = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/add-vehicle', label: 'Add Vehicle', icon: PlusCircle },
    { href: '/available', label: 'Available Vehicles', icon: Car },
    { href: '/not-available', label: 'Not Available', icon: CarFront },
    { href: '/generate-invoice', label: 'Generate Invoice', icon: FileCheck },
    { href: '/sold', label: 'Sold Vehicles', icon: CheckCircle },
    { href: '/lease', label: 'Lease', icon: Receipt },
    { href: '/expenses', label: 'Expenses', icon: DollarSign },
    { href: '/tax', label: 'Tax', icon: Calculator },
    { href: '/settings', label: 'Settings', icon: Settings },
    { 
      href: '/reports', 
      label: 'Reports', 
      icon: FileText,
      submenu: [
        { href: '/reports/sales', label: 'Sales' },
        { href: '/reports/inventory', label: 'Inventory' },
        { href: '/reports/profit-loss', label: 'Profit & Loss' },
      ]
    },
  ]

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-stone-100 to-amber-50/30 shadow-2xl z-50 lg:hidden border-r border-amber-200/40"
            >
              <SidebarContent 
                user={user} 
                navItems={navItems} 
                pathname={pathname}
                onLogout={handleLogout}
                onClose={() => setSidebarOpen(false)}
                companyName={companyName}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="w-64 bg-white shadow-sm border-r border-slate-200">
          <SidebarContent 
            user={user} 
            navItems={navItems} 
            pathname={pathname}
            onLogout={handleLogout}
            companyName={companyName}
          />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold text-slate-900">Vehicle Management</h1>
          <div className="w-10" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ 
  user, 
  navItems, 
  pathname, 
  onLogout,
  onClose,
  companyName
}: { 
  user: User
  navItems: Array<{ href?: string; label: string; icon: any; submenu?: Array<{ href: string; label: string }> }>
  pathname: string
  onLogout: () => void
  onClose?: () => void
  companyName: string
}) {
  const router = useRouter()
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => 
      prev.includes(label) 
        ? prev.filter(m => m !== label)
        : [...prev, label]
    )
  }

  const isReportsActive = pathname.startsWith('/reports')

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-900">
            {companyName}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="text-sm text-slate-600">
          <div className="font-semibold">{user.email}</div>
          <div className="text-xs mt-1">
            <span className={`inline-block px-2 py-1 rounded-full ${
              user.role === 'admin' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {user.role.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          // Hide "Add Vehicle", "Not Available", "Tax", and "Reports" for staff (admin-only)
          if (
            (item.href === '/add-vehicle' ||
              item.href === '/not-available' ||
              item.href === '/tax' ||
              item.href === '/reports') &&
            !isAdmin(user)
          ) {
            return null
          }
          
          const Icon = item.icon
          const hasSubmenu = item.submenu && item.submenu.length > 0
          const isExpanded = expandedMenus.includes(item.label)
          const isActive = item.href 
            ? (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))
            : (hasSubmenu && isReportsActive)
          
          if (hasSubmenu) {
            return (
              <div key={item.label}>
                <div className="flex items-center">
                  {item.href && (
                    <motion.button
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        router.push(item.href!)
                        onClose?.()
                      }}
                      className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-l-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </motion.button>
                  )}
                  {!item.href && (
                    <div className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-l-lg ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-700'
                    }`}>
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                  )}
                  <motion.button
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (!isExpanded) {
                        setExpandedMenus(prev => [...prev, item.label])
                      } else {
                        setExpandedMenus(prev => prev.filter(m => m !== item.label))
                      }
                    }}
                    className={`px-3 py-3 rounded-r-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </motion.button>
                </div>
                {isExpanded && item.submenu && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.submenu.map((subItem) => {
                      const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/')
                      return (
                        <motion.button
                          key={subItem.href}
                          whileHover={{ x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            router.push(subItem.href)
                            onClose?.()
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
                            isSubActive
                              ? 'bg-slate-100 text-slate-900 font-medium'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>{subItem.label}</span>
                        </motion.button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
          
          return (
            <motion.button
              key={item.href || item.label}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (item.href) {
                  router.push(item.href)
                  onClose?.()
                }
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </motion.button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  )
}

