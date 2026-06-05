import { dashboardFontsClassName } from '@/lib/fonts/dashboard-fonts'

export default function CoproDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className={dashboardFontsClassName}>{children}</div>
}
