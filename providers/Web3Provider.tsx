"use client"

/**
 * Web3Provider — Reown AppKit + wagmi configuration
 *
 * Supports MetaMask, WalletConnect, Coinbase Wallet
 * Enforces Ethereum mainnet only
 */

import { createAppKit } from "@reown/appkit/react"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { mainnet } from "@reown/appkit/networks"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode } from "react"
import { REOWN_PROJECT_ID, QUERY_STALE_TIME, QUERY_CACHE_TIME } from "@/lib/constants"

// ============================================================================
// Query Client Configuration
// ============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME,
      gcTime: QUERY_CACHE_TIME,
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
})

// ============================================================================
// Wagmi Configuration
// ============================================================================

const projectId = REOWN_PROJECT_ID!

const wagmiAdapter = new WagmiAdapter({
  networks: [mainnet],
  projectId,
  ssr: true,
})

// ============================================================================
// AppKit Configuration
// ============================================================================

createAppKit({
  adapters: [wagmiAdapter],
  networks: [mainnet] as [typeof mainnet],
  projectId,
  features: {
    analytics: true,
    email: false,
    socials: [],
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#E8A117", // ZEUS gold
    "--w3m-border-radius-master": "8px",
  },
})

// ============================================================================
// Provider Component
// ============================================================================

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
