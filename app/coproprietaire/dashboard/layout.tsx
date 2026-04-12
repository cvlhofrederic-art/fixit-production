import { Outfit, Montserrat } from "next/font/google";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export default function CoproDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${outfit.variable} ${montserrat.variable}`}>
      {children}
    </div>
  )
}
