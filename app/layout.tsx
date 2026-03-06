import type { Metadata } from "next"
import { Fredoka, Titan_One } from "next/font/google"
import "./globals.css"
import { Web3Provider } from "@/providers/Web3Provider"
import { Toaster } from "sonner"

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const titanOne = Titan_One({
  variable: "--font-titan-one",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
})

export const metadata: Metadata = {
  title: "ZEUS Liquidity Manager | earn.pepes.dog",
  description: "Provide liquidity for ZEUS/ETH on Uniswap V4. The god dog earns.",
  keywords: ["ZEUS", "Uniswap V4", "Liquidity", "DeFi", "Ethereum", "Pepe"],
  authors: [{ name: "ZEUS Protocol" }],
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
}

export const viewport = {
  themeColor: "#4394f4",
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
      <body
        className={`${fredoka.variable} ${titanOne.variable} antialiased`}
      >
        <Web3Provider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "rgba(13, 21, 39, 0.96)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#ffffff",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                borderRadius: "0.875rem",
                fontFamily: "Fredoka, system-ui, sans-serif",
                fontWeight: "600",
                backdropFilter: "blur(12px)",
              },
            }}
          />
        </Web3Provider>
      </body>
    </html>
  )
}
