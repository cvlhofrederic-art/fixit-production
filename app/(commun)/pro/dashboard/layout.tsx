// DM Sans et Montserrat : polices auto-hébergées déclarées dans app/polices.css (layout racine).
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="police-dm-sans police-montserrat">
      {children}
    </div>
  )
}
