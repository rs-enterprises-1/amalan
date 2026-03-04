'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { getCompanySettings, saveCompanySettings, clearSettingsCache } from '@/lib/settings'
import Layout from '@/components/Layout'
import { Upload, Trash2, UserPlus, Lock } from 'lucide-react'
import { isAdmin } from '@/lib/auth'
import StaffUserActivityModal from '@/components/StaffUserActivityModal'

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [companyName, setCompanyName] = useState('R.S.Enterprises')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyTelephone, setCompanyTelephone] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [enableSriLankaPurchase, setEnableSriLankaPurchase] = useState(false)
  const [enableProfitIntelligence, setEnableProfitIntelligence] = useState(false)
  const [activeTab, setActiveTab] = useState<'branding' | 'users' | 'password'>(() => {
    // Default to 'password' for staff, 'branding' for admin
    return 'password'
  })
  
  // Add User state
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'staff'>('staff')
  const [addingUser, setAddingUser] = useState(false)
  
  // Staff Users List state
  const [staffUsers, setStaffUsers] = useState<Array<{ id: string; email: string; role: string; created_at: string }>>([])
  const [loadingStaffUsers, setLoadingStaffUsers] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [selectedStaffUser, setSelectedStaffUser] = useState<{ id: string; email: string } | null>(null)
  
  // Change Password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

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

    // Load settings from database (only for admin)
    if (role === 'admin') {
      await loadSettings()
      await loadStaffUsers()
    }
    setLoading(false)
  }

  async function loadSettings() {
    try {
      const settings = await getCompanySettings()
      setCompanyName(settings.company_name)
      setCompanyAddress(settings.company_address || '')
      setCompanyEmail(settings.company_email || '')
      setCompanyTelephone(settings.company_telephone || '')
      setLogoUrl(settings.company_logo_url)
      setEnableSriLankaPurchase(settings.enable_sri_lanka_purchase ?? false)
      setEnableProfitIntelligence(settings.enable_profit_intelligence ?? false)
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB')
      return
    }

    setLogoFile(file)
    
    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      setLogoUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleRemoveLogo() {
    setLogoUrl(null)
    setLogoFile(null)
  }

  async function handleSave() {
    if (!isAdmin(user)) {
      alert('Only admin can save settings')
      return
    }

    setSaving(true)
    try {
      let finalLogoUrl = logoUrl

      // Upload logo to Supabase storage if new file selected
      if (logoFile) {
        const logoFileName = `company-logo-${Date.now()}.${logoFile.name.split('.').pop()}`
        const { data: logoData, error: logoError } = await supabase.storage
          .from('company-assets')
          .upload(logoFileName, logoFile, {
            cacheControl: '3600',
            upsert: false
          })

        if (logoError) {
          // If bucket doesn't exist, create it or use public URL
          console.error('Error uploading logo:', logoError)
          // For now, use data URL as fallback
          finalLogoUrl = logoUrl
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('company-assets')
            .getPublicUrl(logoFileName)
          finalLogoUrl = publicUrl
        }
      }

      // Save settings to database
      await saveCompanySettings({
        company_name: companyName,
        company_address: companyAddress || null,
        company_email: companyEmail || null,
        company_telephone: companyTelephone || null,
        company_logo_url: finalLogoUrl,
        enable_sri_lanka_purchase: enableSriLankaPurchase,
        enable_profit_intelligence: enableProfitIntelligence,
      })

      clearSettingsCache()
      
      // Dispatch event to notify all components to reload company name
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('companySettingsUpdated'))
      }
      
      alert('Settings saved successfully! The company name will update across all pages.')
    } catch (error: any) {
      console.error('Error saving settings:', error)
      alert(`Error saving settings: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddUser() {
    if (!isAdmin(user)) {
      alert('Only admin can add users')
      return
    }

    if (!newUserEmail || !newUserPassword) {
      alert('Please fill in all required fields')
      return
    }

    if (newUserPassword.length < 6) {
      alert('Password must be at least 6 characters long')
      return
    }

    setAddingUser(true)
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Session expired. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      alert(`User created successfully! Email: ${newUserEmail}, Role: ${newUserRole}`)
      
      // Reset form
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserRole('staff')
      
      // Reload staff users list if a staff user was created
      if (newUserRole === 'staff') {
        await loadStaffUsers()
      }
    } catch (error: any) {
      console.error('Error adding user:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setAddingUser(false)
    }
  }

  async function loadStaffUsers() {
    if (!isAdmin(user)) return
    
    setLoadingStaffUsers(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return
      }

      const response = await fetch('/api/users/list', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load users')
      }

      setStaffUsers(data.users || [])
    } catch (error: any) {
      console.error('Error loading staff users:', error)
      alert(`Error loading users: ${error.message}`)
    } finally {
      setLoadingStaffUsers(false)
    }
  }

  async function handleDeleteUser(userId: string, userEmail: string) {
    if (!isAdmin(user)) {
      alert('Only admin can delete users')
      return
    }

    if (!confirm(`Are you sure you want to delete the staff user "${userEmail}"? This action cannot be undone.`)) {
      return
    }

    setDeletingUserId(userId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Session expired. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      alert(`User "${userEmail}" deleted successfully`)
      
      // Reload staff users list
      await loadStaffUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setDeletingUserId(null)
    }
  }

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      alert('Please fill in all fields')
      return
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Session expired. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      alert('Password changed successfully! Please login again with your new password.')
      
      // Reset form
      setNewPassword('')
      setConfirmPassword('')
      
      // Logout and redirect to login
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error: any) {
      console.error('Error changing password:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setChangingPassword(false)
    }
  }

  if (!user || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">Settings</h1>
          <p className="text-slate-600 text-sm">Manage your company branding and system settings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          {isAdmin(user) && (
            <button
              onClick={() => setActiveTab('branding')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'branding'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Branding
            </button>
          )}
          {isAdmin(user) && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Add Users
            </button>
          )}
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'password'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            Change Password
          </button>
        </div>

        {/* Content Sections */}
        {activeTab === 'branding' && isAdmin(user) && (
          <div className="space-y-6">
            {/* Company Branding */}
            <div className="card p-6 bg-white">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Company Branding</h2>
            <p className="text-sm text-slate-600 mb-6">Customize login screens, letters, and the application theme.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Company Name (Used in Invoices & Contracts)
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="Company Name"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    This name will override the branch name on official documents.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Company Address
                  </label>
                  <input
                    type="text"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="No.164/B,Nittambuwa Road,Paththalagedara,Veyangoda"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Company Email
                  </label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="rsenterprises59@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Company Telephone
                  </label>
                  <input
                    type="text"
                    value={companyTelephone}
                    onChange={(e) => setCompanyTelephone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="0773073156,0332245886"
                  />
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="mt-6 space-y-4">
                {/* Enable Sri Lanka Purchase */}
                <div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="enableSriLankaPurchase"
                      checked={enableSriLankaPurchase}
                      onChange={(e) => setEnableSriLankaPurchase(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="enableSriLankaPurchase" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Enable buying from Sri Lanka
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 ml-8">
                    When enabled, the Add Vehicle form will ask whether the vehicle was bought from Japan or Sri Lanka.
                  </p>
                </div>

                {/* Enable Profit Intelligence on Dashboard */}
                <div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="enableProfitIntelligence"
                      checked={enableProfitIntelligence}
                      onChange={(e) => setEnableProfitIntelligence(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="enableProfitIntelligence" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Show profit intelligence chart on Dashboard
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 ml-8">
                    When enabled, admins will see a 30-day gross profit chart on the Dashboard.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Company Logo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Company Logo</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Company Logo" className="max-w-full max-h-32" />
                    ) : (
                      <div className="w-32 h-32 border-2 border-red-500 rounded-lg flex items-center justify-center">
                        <span className="text-4xl font-bold text-red-500">H</span>
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <label className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Upload Logo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      {logoUrl && (
                        <button
                          onClick={handleRemoveLogo}
                          className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'branding' && !isAdmin(user) && (
          <div className="card p-6 bg-white">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
              <p className="text-slate-600">Only administrators can access branding settings.</p>
            </div>
          </div>
        )}

        {activeTab === 'users' && isAdmin(user) && (
          <div className="space-y-6">
            <div className="card p-6 bg-white">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Add New User</h2>
              <p className="text-sm text-slate-600 mb-6">Create a new user account with email, password, and role.</p>

              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="Minimum 6 characters"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Password must be at least 6 characters long
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'staff')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Admin users have full access to all features
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleAddUser}
                    disabled={addingUser}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingUser ? 'Creating User...' : 'Create User'}
                  </button>
                </div>
              </div>
            </div>

            {/* Staff Users List */}
            <div className="card p-6 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">Staff Users</h2>
                  <p className="text-sm text-slate-600">Manage staff user accounts. Only staff users can be deleted.</p>
                </div>
                <button
                  onClick={loadStaffUsers}
                  disabled={loadingStaffUsers}
                  className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingStaffUsers ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {loadingStaffUsers && staffUsers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-slate-500 mt-2">Loading users...</p>
                </div>
              ) : staffUsers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500">No staff users found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {staffUsers.map((staffUser) => (
                    <div
                      key={staffUser.id}
                      className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          setSelectedStaffUser({ id: staffUser.id, email: staffUser.email })
                          setActivityModalOpen(true)
                        }}
                      >
                        <p className="font-medium text-slate-900 hover:text-blue-600">{staffUser.email}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Created: {new Date(staffUser.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">Click to view activities</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteUser(staffUser.id, staffUser.email)
                        }}
                        disabled={deletingUserId === staffUser.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingUserId === staffUser.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="space-y-6">
            <div className="card p-6 bg-white">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Change Password</h2>
              <p className="text-sm text-slate-600 mb-6">Update your account password. You will be logged out after changing your password.</p>

              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="Minimum 6 characters"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Password must be at least 6 characters long
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="Re-enter your new password"
                  />
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changingPassword ? 'Changing Password...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Staff User Activity Modal */}
        {selectedStaffUser && (
          <StaffUserActivityModal
            open={activityModalOpen}
            onClose={() => {
              setActivityModalOpen(false)
              setSelectedStaffUser(null)
            }}
            userId={selectedStaffUser.id}
            userEmail={selectedStaffUser.email}
          />
        )}
      </div>
    </Layout>
  )
}
