import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConditionalLayout from "@/components/ConditionalLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VitFix - Trouvez l'artisan pr\u00E8s de chez vous, en 2 clics",
  description: "Trouvez et r\u00E9servez un artisan v\u00E9rifi\u00E9 pr\u00E8s de chez vous en quelques clics. Plomberie, \u00E9lectricit\u00E9, jardinage et plus.",
  authors: [{ name: "VitFix SAS" }],
  creator: "VitFix SAS",
  publisher: "VitFix SAS",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: "VitFix - Artisans v\u00E9rifi\u00E9s pr\u00E8s de chez vous",
    description: "Trouvez et r\u00E9servez un artisan certifi\u00E9 en quelques clics. Plomberie, \u00E9lectricit\u00E9, serrurerie et plus.",
    siteName: "VitFix",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
      </body>
    </html>
  );
}
