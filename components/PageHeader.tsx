'use client'

import { useState } from 'react'
import { Download, Calendar } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  showFilters?: boolean
  onExport?: () => void
  dateRange?: {
    startDate: string
    endDate: string
    onStartDateChange: (date: string) => void
    onEndDateChange: (date: string) => void
  }
}

export default function PageHeader({ 
  title, 
  subtitle = 'Comprehensive analytics for your vehicle retail business',
  showFilters = true,
  onExport,
  dateRange
}: PageHeaderProps) {
  const [startDate, setStartDate] = useState(dateRange?.startDate || '')
  const [endDate, setEndDate] = useState(dateRange?.endDate || '')

  const setQuickRange = (days: number | 'month' | 'lastMonth' | 'quarter' | 'ytd') => {
    const now = new Date()
    let start: Date
    let end: Date = now

    if (days === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (days === 'lastMonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end = new Date(now.getFullYear(), now.getMonth(), 0)
    } else if (days === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), quarter * 3, 1)
    } else if (days === 'ytd') {
      start = new Date(now.getFullYear(), 0, 1)
    } else {
      start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    }

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    
    setStartDate(startStr)
    setEndDate(endStr)
    
    if (dateRange) {
      dateRange.onStartDateChange(startStr)
      dateRange.onEndDateChange(endStr)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">{title}</h1>
          {subtitle && <p className="text-slate-600 text-sm">{subtitle}</p>}
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Date Range:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                dateRange?.onStartDateChange(e.target.value)
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                dateRange?.onEndDateChange(e.target.value)
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuickRange(7)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              7D
            </button>
            <button
              onClick={() => setQuickRange(30)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              30D
            </button>
            <button
              onClick={() => setQuickRange('month')}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => setQuickRange('lastMonth')}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Last Month
            </button>
            <button
              onClick={() => setQuickRange('quarter')}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Quarter
            </button>
            <button
              onClick={() => setQuickRange('ytd')}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              YTD
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
