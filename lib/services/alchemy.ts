/**
 * Alchemy API Client
 *
 * Provides RPC methods and Enhanced API for Ethereum interactions
 * Used for fetching positions, balances, and making contract calls
 */

// Server-side: call Alchemy directly. Client-side: use proxy to hide the key.
function getRpcUrl(): string {
  if (typeof window === "undefined" && process.env.ALCHEMY_API_KEY) {
    return `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  }
  return "/api/rpc"
}

// ============================================================================
// RPC Client
// ============================================================================

export async function alchemyRpcCall<T = any>(
  method: string,
  params: any[] = []
): Promise<T> {
  const response = await fetch(getRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })

  if (!response.ok) {
    throw new Error(`Alchemy RPC error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`Alchemy RPC error: ${data.error.message}`)
  }

  return data.result
}

// ============================================================================
// Enhanced API Methods
// ============================================================================

/**
 * Get ETH balance for an address
 */
export async function getEthBalance(address: string): Promise<bigint> {
  const balance = await alchemyRpcCall<string>("eth_getBalance", [address, "latest"])
  return BigInt(balance)
}

/**
 * Get token balances for an address
 * Returns ZEUS balance with 9 decimals
 */
export async function getTokenBalances(
  address: string,
  contractAddresses: string[]
): Promise<{ contractAddress: string; tokenBalance: string }[]> {
  const result = await alchemyRpcCall<{
    address: string
    tokenBalances: { contractAddress: string; tokenBalance: string; error?: string }[]
  }>("alchemy_getTokenBalances", [address, contractAddresses])

  return result.tokenBalances.filter((balance) => !balance.error)
}

/**
 * Get logs for Transfer events (used to find minted positions)
 */
export async function getLogs(params: {
  address?: string
  fromBlock?: string
  toBlock?: string
  topics?: (string | string[] | null)[]
}): Promise<
  {
    address: string
    topics: string[]
    data: string
    blockNumber: string
    transactionHash: string
    transactionIndex: string
    blockHash: string
    logIndex: string
    removed: boolean
  }[]
> {
  return alchemyRpcCall("eth_getLogs", [params])
}

/**
 * Make a contract call (read-only)
 */
export async function ethCall(
  transaction: {
    to: string
    data: string
  },
  blockTag: string = "latest"
): Promise<string> {
  return alchemyRpcCall("eth_call", [transaction, blockTag])
}

/**
 * Get current block number
 */
export async function getBlockNumber(): Promise<number> {
  const blockNumberHex = await alchemyRpcCall<string>("eth_blockNumber")
  return parseInt(blockNumberHex, 16)
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(transaction: {
  from?: string
  to: string
  value?: string
  data?: string
}): Promise<bigint> {
  const gasHex = await alchemyRpcCall<string>("eth_estimateGas", [transaction])
  return BigInt(gasHex)
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(txHash: string): Promise<{
  transactionHash: string
  transactionIndex: string
  blockHash: string
  blockNumber: string
  from: string
  to: string
  cumulativeGasUsed: string
  gasUsed: string
  contractAddress: string | null
  logs: any[]
  status: string
} | null> {
  return alchemyRpcCall("eth_getTransactionReceipt", [txHash])
}

/**
 * Get current gas price
 */
export async function getGasPrice(): Promise<bigint> {
  const gasPriceHex = await alchemyRpcCall<string>("eth_gasPrice")
  return BigInt(gasPriceHex)
}

// ============================================================================
// Batch RPC Calls (for efficiency)
// ============================================================================

export async function alchemyBatchRpcCall(
  calls: { method: string; params: any[] }[]
): Promise<any[]> {
  const response = await fetch(getRpcUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      calls.map((call, index) => ({
        jsonrpc: "2.0",
        id: index + 1,
        method: call.method,
        params: call.params,
      }))
    ),
  })

  if (!response.ok) {
    throw new Error(`Alchemy batch RPC error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  return data.map((item: any) => {
    if (item.error) {
      throw new Error(`Alchemy RPC error: ${item.error.message}`)
    }
    return item.result
  })
}
