'use client'

import { ReactNode } from 'react'
import Layout from './Layout'
import PageHeader from './PageHeader'

interface ReportPageTemplateProps {
  title: string
  subtitle?: string
  children: ReactNode
  onExport?: () => void
  dateRange?: {
    startDate: string
    endDate: string
    onStartDateChange: (date: string) => void
    onEndDateChange: (date: string) => void
  }
}

export default function ReportPageTemplate({
  title,
  subtitle = 'Comprehensive analytics for your vehicle retail business',
  children,
  onExport,
  dateRange,
}: ReportPageTemplateProps) {
  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title={title}
          subtitle={subtitle}
          showFilters={true}
          onExport={onExport}
          dateRange={dateRange}
        />
        {children}
      </div>
    </Layout>
  )
}
