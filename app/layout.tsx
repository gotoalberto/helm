import type { Metadata } from "next"
import { Orbitron, Rajdhani, Share_Tech_Mono } from "next/font/google"
import "./globals.css"
import { Web3Provider } from "@/providers/Web3Provider"
import { Toaster } from "sonner"

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
})

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
})

export const metadata: Metadata = {
  title: "CITADEL PROTOCOL — Defend the Wall",
  description: "Defend the ZEUS price wall. Provide concentrated liquidity. Become a Guardian.",
  keywords: ["ZEUS", "Citadel", "Uniswap V4", "DeFi", "Liquidity", "Ethereum"],
  authors: [{ name: "Citadel Protocol" }],
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
}

export const viewport = {
  themeColor: "#00f5ff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${orbitron.variable} ${rajdhani.variable} ${shareTechMono.variable} antialiased`}>
        <Web3Provider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--bg-panel-alt)",
                border: "1px solid var(--glass-border-bright)",
                borderLeft: "3px solid var(--neon-cyan)",
                color: "var(--text-primary)",
                boxShadow: "0 0 20px rgba(0,245,255,0.15)",
                borderRadius: "2px",
                fontFamily: "'Rajdhani', system-ui, sans-serif",
                fontWeight: "600",
              },
            }}
          />
        </Web3Provider>
      </body>
    </html>
  )
}
