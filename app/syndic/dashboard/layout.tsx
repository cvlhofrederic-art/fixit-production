import { dashboardFontsClassName } from '@/lib/fonts/dashboard-fonts'

export default function SyndicDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className={dashboardFontsClassName}>{children}</div>
}
