"use client"

import { Position } from "@/types"
import { ZEUS_DECIMALS, UNISWAP_V4_POSITION_MANAGER, ZEUS_TOKEN_ADDRESS, POOL_FEE, POOL_TICK_SPACING, POOL_HOOKS_ADDRESS } from "@/lib/constants"
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract, useBalance } from "wagmi"
import { useInvalidateCache } from "@/hooks/useInvalidateCache"
import { encodeAbiParameters, encodePacked, erc20Abi, parseUnits, formatUnits, maxUint256 } from "viem"
import { toast } from "sonner"
import { useEffect, useState } from "react"

interface PositionCardProps {
  position: Position
  ethPriceUsd: number
  zeusPriceUsd: number
  currentTick: number
  onSuccess?: () => void
}

// ── V4 Actions ──────────────────────────────────────────────────────────────
const ACTIONS = {
  INCREASE_LIQUIDITY: 0x00,
  DECREASE_LIQUIDITY: 0x01,
  BURN_POSITION: 0x03,
  TAKE_PAIR: 0x11,
  SETTLE_PAIR: 0x0d,
  SWEEP: 0x14,
} as const
const ETH_ADDRESS  = "0x0000000000000000000000000000000000000000" as const
const MSG_SENDER   = "0x0000000000000000000000000000000000000001" as const

const PM_ABI = [{
  name: "modifyLiquidities", type: "function", stateMutability: "payable",
  inputs: [{ name: "unlockData", type: "bytes" }, { name: "deadline", type: "uint256" }],
  outputs: [],
}] as const

function deadline() { return BigInt(Math.floor(Date.now() / 1000) + 1200) }

/** BURN_POSITION + TAKE_PAIR + SWEEP — closes position and withdraws all tokens */
function encodeBurnUnlockData(tokenId: bigint, amount0Min: bigint, amount1Min: bigint, recipient: `0x${string}`): `0x${string}` {
  const actions = encodePacked(["uint8", "uint8", "uint8"], [ACTIONS.BURN_POSITION, ACTIONS.TAKE_PAIR, ACTIONS.SWEEP])

  const burnParams = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint128" }, { type: "uint128" }, { type: "bytes" }],
    [tokenId, amount0Min, amount1Min, "0x"]
  )
  const takeParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }],
    [ETH_ADDRESS, ZEUS_TOKEN_ADDRESS as `0x${string}`, recipient]
  )
  const sweepParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [ETH_ADDRESS, MSG_SENDER]
  )
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [burnParams, takeParams, sweepParams]]
  )
}

/** DECREASE_LIQUIDITY(delta=0) + TAKE_PAIR — collects fees without touching liquidity */
function encodeCollectFeesUnlockData(tokenId: bigint, recipient: `0x${string}`): `0x${string}` {
  const actions = encodePacked(["uint8", "uint8", "uint8"], [ACTIONS.DECREASE_LIQUIDITY, ACTIONS.TAKE_PAIR, ACTIONS.SWEEP])

  const decreaseParams = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }, { type: "uint128" }, { type: "uint128" }, { type: "bytes" }],
    [tokenId, 0n, 0n, 0n, "0x"]
  )
  const takeParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }],
    [ETH_ADDRESS, ZEUS_TOKEN_ADDRESS as `0x${string}`, recipient]
  )
  const sweepParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [ETH_ADDRESS, MSG_SENDER]
  )
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [decreaseParams, takeParams, sweepParams]]
  )
}

/** DECREASE_LIQUIDITY(delta>0) + TAKE_PAIR + SWEEP — partial withdrawal */
function encodeDecreaseLiquidityUnlockData(
  tokenId: bigint, liquidity: bigint, amount0Min: bigint, amount1Min: bigint, recipient: `0x${string}`
): `0x${string}` {
  const actions = encodePacked(["uint8", "uint8", "uint8"], [ACTIONS.DECREASE_LIQUIDITY, ACTIONS.TAKE_PAIR, ACTIONS.SWEEP])
  const decreaseParams = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }, { type: "uint128" }, { type: "uint128" }, { type: "bytes" }],
    [tokenId, liquidity, amount0Min, amount1Min, "0x"]
  )
  const takeParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }],
    [ETH_ADDRESS, ZEUS_TOKEN_ADDRESS as `0x${string}`, recipient]
  )
  const sweepParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [ETH_ADDRESS, MSG_SENDER]
  )
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [decreaseParams, takeParams, sweepParams]]
  )
}

/** INCREASE_LIQUIDITY + SETTLE_PAIR + SWEEP */
function encodeIncreaseLiquidityUnlockData(
  tokenId: bigint, liquidity: bigint, amount0Max: bigint, amount1Max: bigint
): `0x${string}` {
  const actions = encodePacked(
    ["uint8", "uint8", "uint8"],
    [ACTIONS.INCREASE_LIQUIDITY, ACTIONS.SETTLE_PAIR, ACTIONS.SWEEP]
  )

  const increaseParams = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }, { type: "uint128" }, { type: "uint128" }, { type: "bytes" }],
    [tokenId, liquidity, amount0Max, amount1Max, "0x"]
  )
  const settleParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [ETH_ADDRESS, ZEUS_TOKEN_ADDRESS as `0x${string}`]
  )
  const sweepParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [ETH_ADDRESS, MSG_SENDER]
  )
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [increaseParams, settleParams, sweepParams]]
  )
}

// ── Liquidity math helpers ───────────────────────────────────────────────────
function tickToSqrtPriceX96(tick: number): bigint {
  const price = Math.pow(1.0001, tick)
  const sqrtPrice = Math.sqrt(price)
  return BigInt(Math.floor(sqrtPrice * 2 ** 96))
}

function getLiquidityForAmounts(
  sqrtPriceX96: bigint,
  sqrtPriceLowerX96: bigint,
  sqrtPriceUpperX96: bigint,
  amount0: bigint,
  amount1: bigint,
): bigint {
  const Q96 = 2n ** 96n

  if (sqrtPriceX96 <= sqrtPriceLowerX96) {
    if (sqrtPriceLowerX96 === sqrtPriceUpperX96) return 0n
    return (amount0 * sqrtPriceLowerX96 * sqrtPriceUpperX96 / Q96) /
      (sqrtPriceUpperX96 - sqrtPriceLowerX96)
  } else if (sqrtPriceX96 < sqrtPriceUpperX96) {
    const liq0 = (amount0 * sqrtPriceX96 * sqrtPriceUpperX96 / Q96) /
      (sqrtPriceUpperX96 - sqrtPriceX96)
    const liq1 = amount1 * Q96 / (sqrtPriceX96 - sqrtPriceLowerX96)
    return liq0 < liq1 ? liq0 : liq1
  } else {
    if (sqrtPriceLowerX96 === sqrtPriceUpperX96) return 0n
    return amount1 * Q96 / (sqrtPriceUpperX96 - sqrtPriceLowerX96)
  }
}

// ── Formatting helpers ──────────────────────────────────────────────────────
function fmtZeus(value: number): string {
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toFixed(4)
}

function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

const STATUS = {
  "in-range":    { label: "In Range",     bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.35)",  text: "#4ade80" },
  "out-of-range":{ label: "Defense Line", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.35)", text: "#fbbf24" },
  "closed":      { label: "Closed",       bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)",text: "#94a3b8" },
}

// ── Component ───────────────────────────────────────────────────────────────
export function PositionCard({ position, ethPriceUsd, zeusPriceUsd, currentTick, onSuccess }: PositionCardProps) {
  const { address } = useAccount()
  const invalidateCache = useInvalidateCache()
  const s = STATUS[position.status]

  const { writeContract: writeClose, data: closeTxHash, isPending: isClosing } = useWriteContract()
  const { writeContract: writeCollect, data: collectTxHash, isPending: isCollecting } = useWriteContract()
  const { writeContract: writeApprove, data: approveTxHash, isPending: isApproving } = useWriteContract()
  const { writeContract: writeAddMore, data: addMoreTxHash, isPending: isAddingMore } = useWriteContract()

  const { isLoading: isCloseConfirming, isSuccess: isCloseSuccess } = useWaitForTransactionReceipt({ hash: closeTxHash })
  const { isLoading: isCollectConfirming, isSuccess: isCollectSuccess } = useWaitForTransactionReceipt({ hash: collectTxHash })
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })
  const { isLoading: isAddMoreConfirming, isSuccess: isAddMoreSuccess } = useWaitForTransactionReceipt({ hash: addMoreTxHash })

  // Add liquidity form state
  const [showAddLiquidity, setShowAddLiquidity] = useState(false)

  // Withdraw partial form state
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawPct, setWithdrawPct] = useState(25)

  const { writeContract: writeWithdraw, data: withdrawTxHash, isPending: isWithdrawing } = useWriteContract()
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawTxHash })
  const [addEthAmount, setAddEthAmount] = useState("")
  const [addZeusAmount, setAddZeusAmount] = useState("")

  // Balances for the add liquidity form
  const { data: ethBalance } = useBalance({ address })
  const { data: zeusBalanceRaw } = useReadContract({
    address: ZEUS_TOKEN_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && showAddLiquidity },
  })
  const { data: zeusAllowance, refetch: refetchAllowance } = useReadContract({
    address: ZEUS_TOKEN_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, UNISWAP_V4_POSITION_MANAGER as `0x${string}`] : undefined,
    query: { enabled: !!address && showAddLiquidity },
  })

  // Determine which tokens are needed based on position's tick range vs current tick
  // tickLower = min(tickLower, tickUpper), tickUpper = max(...)
  const posTickLower = Math.min(position.tickLower, position.tickUpper)
  const posTickUpper = Math.max(position.tickLower, position.tickUpper)
  const isMcapBelowRange = position.status === "out-of-range" && currentTick > posTickUpper
  const isMcapAboveRange = position.status === "out-of-range" && currentTick < posTickLower
  const needsEth = !isMcapBelowRange
  const needsZeus = !isMcapAboveRange

  // Auto-calculate ZEUS from ETH when both needed
  useEffect(() => {
    if (!needsZeus || !needsEth || !addEthAmount || zeusPriceUsd === 0 || ethPriceUsd === 0) return
    const ethNum = parseFloat(addEthAmount)
    if (isNaN(ethNum) || ethNum <= 0) { setAddZeusAmount(""); return }
    const zeusNum = (ethNum * ethPriceUsd) / zeusPriceUsd
    setAddZeusAmount(zeusNum.toFixed(4))
  }, [addEthAmount, ethPriceUsd, zeusPriceUsd, needsZeus, needsEth])

  useEffect(() => {
    if (isCloseSuccess) {
      toast.success("Position closed!")
      onSuccess?.()
      invalidateCache()
    }
  }, [isCloseSuccess])

  useEffect(() => {
    if (isCollectSuccess) {
      toast.success("Fees collected!")
      onSuccess?.()
      invalidateCache()
      fetch("/api/fees/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          tokenId: position.tokenId.toString(),
          amount0Eth: Number(position.tokensOwed0) / 1e18,
          amount1Zeus: Number(position.tokensOwed1) / 1e9,
          ethPriceUsd,
          zeusPriceUsd,
          totalUsd:
            (Number(position.tokensOwed0) / 1e18) * ethPriceUsd +
            (Number(position.tokensOwed1) / 1e9) * zeusPriceUsd,
          txHash: collectTxHash,
        }),
      }).catch(() => {})
    }
  }, [isCollectSuccess])

  useEffect(() => {
    if (isApproveSuccess) {
      toast.success("ZEUS approved!")
      refetchAllowance()
    }
  }, [isApproveSuccess])

  useEffect(() => {
    if (isAddMoreSuccess) {
      toast.success("Liquidity added!")
      setAddEthAmount("")
      setAddZeusAmount("")
      setShowAddLiquidity(false)
      invalidateCache()
      onSuccess?.()
    }
  }, [isAddMoreSuccess])

  useEffect(() => {
    if (isWithdrawSuccess) {
      toast.success("Withdrawal successful!")
      setShowWithdraw(false)
      setWithdrawPct(25)
      invalidateCache()
      onSuccess?.()
    }
  }, [isWithdrawSuccess])

  const handleClose = () => {
    if (!address) return
    const unlockData = encodeBurnUnlockData(position.tokenId, 0n, 0n, address)
    writeClose({
      address: UNISWAP_V4_POSITION_MANAGER as `0x${string}`,
      abi: PM_ABI,
      functionName: "modifyLiquidities",
      args: [unlockData, deadline()],
    }, {
      onError: (e) => toast.error(`Close failed: ${e.message.slice(0, 80)}`),
    })
  }

  const handleCollect = () => {
    if (!address) return
    const unlockData = encodeCollectFeesUnlockData(position.tokenId, address)
    writeCollect({
      address: UNISWAP_V4_POSITION_MANAGER as `0x${string}`,
      abi: PM_ABI,
      functionName: "modifyLiquidities",
      args: [unlockData, deadline()],
    }, {
      onError: (e) => toast.error(`Collect failed: ${e.message.slice(0, 80)}`),
    })
  }

  const handleApproveZeus = () => {
    if (!address) return
    writeApprove({
      address: ZEUS_TOKEN_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      args: [UNISWAP_V4_POSITION_MANAGER as `0x${string}`, maxUint256],
    }, {
      onError: (e) => toast.error(`Approve failed: ${e.message.slice(0, 80)}`),
    })
  }

  const handleAddLiquidity = () => {
    if (!address) return
    const ethNum = parseFloat(addEthAmount) || 0
    const zeusNum = parseFloat(addZeusAmount) || 0
    const amount0 = needsEth ? parseUnits(addEthAmount || "0", 18) : 0n
    const amount1 = needsZeus ? parseUnits(addZeusAmount || "0", ZEUS_DECIMALS) : 0n

    const sqrtPrice = tickToSqrtPriceX96(currentTick)
    const sqrtLower = tickToSqrtPriceX96(posTickLower)
    const sqrtUpper = tickToSqrtPriceX96(posTickUpper)
    const liquidity = getLiquidityForAmounts(sqrtPrice, sqrtLower, sqrtUpper, amount0, amount1)

    if (liquidity === 0n) {
      toast.error("Could not compute liquidity — check amounts")
      return
    }

    const slippage = 1.01
    const amount0Max = BigInt(Math.floor(Number(amount0) * slippage))
    const amount1Max = BigInt(Math.floor(Number(amount1) * slippage))

    const unlockData = encodeIncreaseLiquidityUnlockData(position.tokenId, liquidity, amount0Max, amount1Max)
    const ethValue = needsEth ? parseUnits(addEthAmount || "0", 18) : 0n

    writeAddMore({
      address: UNISWAP_V4_POSITION_MANAGER as `0x${string}`,
      abi: PM_ABI,
      functionName: "modifyLiquidities",
      args: [unlockData, deadline()],
      value: ethValue,
    }, {
      onError: (e) => toast.error(`Add liquidity failed: ${e.message.slice(0, 80)}`),
    })
  }

  const handleWithdraw = () => {
    if (!address || position.liquidity === 0n) return
    const slippage = 0.99
    const withdrawLiquidity = (position.liquidity * BigInt(withdrawPct)) / 100n
    const amount0Min = BigInt(Math.floor(Number(position.amount0) * (withdrawPct / 100) * slippage))
    const amount1Min = BigInt(Math.floor(Number(position.amount1) * (withdrawPct / 100) * slippage))
    const unlockData = encodeDecreaseLiquidityUnlockData(position.tokenId, withdrawLiquidity, amount0Min, amount1Min, address)
    writeWithdraw({
      address: UNISWAP_V4_POSITION_MANAGER as `0x${string}`,
      abi: PM_ABI,
      functionName: "modifyLiquidities",
      args: [unlockData, deadline()],
    }, {
      onError: (e) => toast.error(`Withdraw failed: ${e.message.slice(0, 80)}`),
    })
  }

  const isBusy = isClosing || isCloseConfirming || isCollecting || isCollectConfirming || isWithdrawing || isWithdrawConfirming
  const isAddBusy = isApproving || isApproveConfirming || isAddingMore || isAddMoreConfirming

  const ethAmount   = Number(position.amount0) / 1e18
  const zeusAmount  = Number(position.amount1) / 10 ** ZEUS_DECIMALS
  const ethValueUsd  = ethAmount * ethPriceUsd
  const zeusValueUsd = zeusAmount * zeusPriceUsd

  const feesEth     = Number(position.tokensOwed0) / 1e18
  const feesZeus    = Number(position.tokensOwed1) / 10 ** ZEUS_DECIMALS
  const feesEthUsd  = feesEth * ethPriceUsd
  const feesZeusUsd = feesZeus * zeusPriceUsd
  const totalFeesUsd = feesEthUsd + feesZeusUsd
  const hasCollectableFees = totalFeesUsd > 0.001

  const mcapLow  = Math.min(position.minMcap, position.maxMcap)
  const mcapHigh = Math.max(position.minMcap, position.maxMcap)

  // Add liquidity form derived values
  const addEthNum = parseFloat(addEthAmount) || 0
  const addZeusNum = parseFloat(addZeusAmount) || 0
  const ethBalanceNum = ethBalance ? parseFloat(formatUnits(ethBalance.value, 18)) : 0
  const zeusBalanceNum = zeusBalanceRaw ? parseFloat(formatUnits(zeusBalanceRaw, ZEUS_DECIMALS)) : 0
  const addTotalUsd = (needsEth ? addEthNum * ethPriceUsd : 0) + (needsZeus ? addZeusNum * zeusPriceUsd : 0)
  const addZeusRaw = addZeusNum > 0 ? parseUnits(addZeusAmount || "0", ZEUS_DECIMALS) : 0n
  const isZeusApproved = !needsZeus || (zeusAllowance !== undefined && zeusAllowance >= addZeusRaw)
  const isAddFormValid = (needsEth ? addEthNum > 0 && addEthNum <= ethBalanceNum : true) &&
    (needsZeus ? addZeusNum > 0 && addZeusNum <= zeusBalanceNum : true) &&
    (needsEth ? addEthNum > 0 : true) || (needsZeus ? addZeusNum > 0 : true)

  // Withdraw preview derived values
  const withdrawEth      = (Number(position.amount0) / 1e18) * (withdrawPct / 100)
  const withdrawZeus     = (Number(position.amount1) / 10 ** ZEUS_DECIMALS) * (withdrawPct / 100)
  const withdrawEthUsd   = withdrawEth * ethPriceUsd
  const withdrawZeusUsd  = withdrawZeus * zeusPriceUsd
  const withdrawTotalUsd = withdrawEthUsd + withdrawZeusUsd

  return (
    <div style={{
      background: "var(--glass-bg)", border: "1px solid var(--glass-border-bright)",
      borderRadius: "1.25rem", padding: "1.5rem",
      display: "flex", flexDirection: "column", gap: "1.25rem",
      backdropFilter: "blur(12px)",
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
            #{position.tokenId.toString()}
          </span>
          <span style={{
            fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "0.25rem 0.75rem", borderRadius: "9999px",
            background: s.bg, border: `1px solid ${s.border}`, color: s.text,
          }}>
            {s.label}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "#fff", lineHeight: 1.1 }}>
            {fmtUsd(position.totalValueUsd)}
          </p>
          <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "0.2rem" }}>
            Total Value
          </p>
        </div>
      </div>

      <div style={{ height: 1, background: "var(--glass-border)" }} />

      {/* MCAP Range */}
      <div style={{
        background: "rgba(240,230,78,0.06)", border: "1px solid rgba(240,230,78,0.18)",
        borderRadius: "0.875rem", padding: "0.875rem 1.125rem",
      }}>
        <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(240,230,78,0.5)", marginBottom: "0.5rem" }}>
          Market Cap Range
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", color: "var(--highlight)" }}>{fmtUsd(mcapLow)}</span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>→</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", color: "var(--highlight)" }}>{fmtUsd(mcapHigh)}</span>
        </div>
      </div>

      {/* Token Amounts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {[
          { symbol: "ETH",  amount: ethAmount.toFixed(6),  usdValue: ethValueUsd,  accentBg: "rgba(109,156,244,0.08)", accentBorder: "rgba(109,156,244,0.2)",  labelColor: "rgba(109,156,244,0.7)", valueColor: "#a8c8ff" },
          { symbol: "ZEUS", amount: fmtZeus(zeusAmount), usdValue: zeusValueUsd, accentBg: "rgba(240,230,78,0.06)",  accentBorder: "rgba(240,230,78,0.18)", labelColor: "rgba(240,230,78,0.6)",  valueColor: "var(--highlight)" },
        ].map(({ symbol, amount, usdValue, accentBg, accentBorder, labelColor, valueColor }) => (
          <div key={symbol} style={{ background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: "0.875rem", padding: "0.875rem 1rem" }}>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: labelColor, marginBottom: "0.3rem" }}>{symbol}</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: valueColor, lineHeight: 1.2 }}>{amount}</p>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{fmtUsd(usdValue)}</p>
          </div>
        ))}
      </div>

      {/* Uncollected Fees */}
      <div style={{
        background: hasCollectableFees ? "rgba(34,197,94,0.07)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${hasCollectableFees ? "rgba(34,197,94,0.22)" : "var(--glass-border)"}`,
        borderRadius: "0.875rem", padding: "0.875rem 1.125rem",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
      }}>
        <div>
          <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: hasCollectableFees ? "rgba(74,222,128,0.6)" : "var(--text-muted)", marginBottom: "0.35rem" }}>
            Uncollected Fees
          </p>
          {hasCollectableFees ? (
            <>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "#4ade80", lineHeight: 1.1 }}>{fmtUsd(totalFeesUsd)}</p>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                {feesEth > 0 && <span style={{ fontSize: "0.7rem", color: "#a8c8ff" }}>{feesEth.toFixed(6)} ETH <span style={{ color: "var(--text-muted)" }}>({fmtUsd(feesEthUsd)})</span></span>}
                {feesZeus > 0 && <span style={{ fontSize: "0.7rem", color: "var(--highlight)" }}>{fmtZeus(feesZeus)} ZEUS <span style={{ color: "var(--text-muted)" }}>({fmtUsd(feesZeusUsd)})</span></span>}
              </div>
            </>
          ) : (
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>No fees yet</p>
          )}
        </div>
        {hasCollectableFees && position.status !== "closed" && (
          <button onClick={handleCollect} disabled={isBusy} className="btn-zeus" style={{ fontSize: "0.82rem", padding: "0.45rem 1.1rem", flexShrink: 0 }}>
            {isCollecting || isCollectConfirming ? "Collecting..." : "Collect"}
          </button>
        )}
      </div>

      {/* Action buttons */}
      {position.status !== "closed" && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={() => { setShowAddLiquidity(!showAddLiquidity); setShowWithdraw(false) }}
            disabled={isBusy}
            style={{
              flex: 1, padding: "0.65rem", borderRadius: "0.75rem", cursor: isBusy ? "not-allowed" : "pointer",
              background: showAddLiquidity ? "rgba(67,148,244,0.15)" : "rgba(67,148,244,0.08)",
              border: `1px solid ${showAddLiquidity ? "rgba(67,148,244,0.5)" : "rgba(67,148,244,0.25)"}`,
              color: "#a8c8ff", fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.04em",
              opacity: isBusy ? 0.5 : 1, transition: "all 0.15s",
            }}
          >
            {showAddLiquidity ? "Cancel" : "Add More Liquidity"}
          </button>
          <button
            onClick={() => { setShowWithdraw(!showWithdraw); setShowAddLiquidity(false) }}
            disabled={isBusy}
            style={{
              flex: 1, padding: "0.65rem", borderRadius: "0.75rem", cursor: isBusy ? "not-allowed" : "pointer",
              background: showWithdraw ? "rgba(240,230,78,0.15)" : "rgba(240,230,78,0.06)",
              border: `1px solid ${showWithdraw ? "rgba(240,230,78,0.5)" : "rgba(240,230,78,0.2)"}`,
              color: "var(--highlight)", fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.04em",
              opacity: isBusy ? 0.5 : 1, transition: "all 0.15s",
            }}
          >
            {showWithdraw ? "Cancel" : "Withdraw Partial"}
          </button>
          <button
            onClick={handleClose}
            disabled={isBusy}
            style={{
              flex: 1, padding: "0.65rem", borderRadius: "0.75rem", cursor: isBusy ? "not-allowed" : "pointer",
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)",
              color: "#f87171", fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.04em",
              opacity: isBusy ? 0.5 : 1, transition: "all 0.15s",
            }}
          >
            {isClosing || isCloseConfirming ? "Closing..." : "Close Position & Withdraw"}
          </button>
        </div>
      )}

      {/* Add Liquidity inline form */}
      {showAddLiquidity && position.status !== "closed" && (
        <div style={{
          background: "rgba(67,148,244,0.05)", border: "1px solid rgba(67,148,244,0.2)",
          borderRadius: "1rem", padding: "1.25rem",
          display: "flex", flexDirection: "column", gap: "1rem",
        }}>
          <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(67,148,244,0.7)" }}>
            Add Liquidity
            {isMcapBelowRange && <span style={{ color: "rgba(251,191,36,0.8)", marginLeft: "0.5rem" }}>(ZEUS only — mcap below range)</span>}
            {isMcapAboveRange && <span style={{ color: "rgba(109,156,244,0.8)", marginLeft: "0.5rem" }}>(ETH only — mcap above range)</span>}
          </p>

          {/* ETH input */}
          {needsEth && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>ETH Amount</label>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  Balance: {ethBalanceNum.toFixed(4)} ETH
                </span>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  value={addEthAmount}
                  onChange={(e) => setAddEthAmount(e.target.value)}
                  placeholder="0.0"
                  style={{
                    width: "100%", padding: "0.625rem 3.5rem 0.625rem 0.875rem",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(109,156,244,0.25)",
                    borderRadius: "0.625rem", color: "#fff", fontSize: "1rem",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => setAddEthAmount(Math.max(0, ethBalanceNum - 0.002).toFixed(6))}
                  style={{
                    position: "absolute", right: "0.625rem", top: "50%", transform: "translateY(-50%)",
                    background: "rgba(109,156,244,0.2)", border: "none", borderRadius: "0.375rem",
                    color: "#a8c8ff", fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.4rem",
                    cursor: "pointer",
                  }}
                >MAX</button>
              </div>
              {addEthNum > ethBalanceNum && addEthNum > 0 && (
                <p style={{ fontSize: "0.7rem", color: "#f87171", marginTop: "0.25rem" }}>Insufficient ETH balance</p>
              )}
            </div>
          )}

          {/* ZEUS input */}
          {needsZeus && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>ZEUS Amount</label>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  Balance: {zeusBalanceNum.toFixed(2)} ZEUS
                </span>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  value={addZeusAmount}
                  onChange={(e) => setAddZeusAmount(e.target.value)}
                  placeholder="0.0"
                  readOnly={needsEth && needsZeus}
                  style={{
                    width: "100%", padding: "0.625rem 3.5rem 0.625rem 0.875rem",
                    background: needsEth && needsZeus ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(240,230,78,0.25)",
                    borderRadius: "0.625rem", color: needsEth && needsZeus ? "var(--text-muted)" : "#fff",
                    fontSize: "1rem", outline: "none", boxSizing: "border-box",
                    cursor: needsEth && needsZeus ? "default" : "text",
                  }}
                />
                {!(needsEth && needsZeus) && (
                  <button
                    onClick={() => setAddZeusAmount(zeusBalanceNum.toFixed(4))}
                    style={{
                      position: "absolute", right: "0.625rem", top: "50%", transform: "translateY(-50%)",
                      background: "rgba(240,230,78,0.15)", border: "none", borderRadius: "0.375rem",
                      color: "var(--highlight)", fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.4rem",
                      cursor: "pointer",
                    }}
                  >MAX</button>
                )}
              </div>
              {addZeusNum > zeusBalanceNum && addZeusNum > 0 && (
                <p style={{ fontSize: "0.7rem", color: "#f87171", marginTop: "0.25rem" }}>Insufficient ZEUS balance</p>
              )}
              {needsEth && needsZeus && (
                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Auto-calculated from ETH amount</p>
              )}
            </div>
          )}

          {/* USD total */}
          {addTotalUsd > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Total deposit value</span>
              <span style={{ fontSize: "0.9rem", fontFamily: "var(--font-display)", color: "#fff" }}>{fmtUsd(addTotalUsd)}</span>
            </div>
          )}

          {/* Action button */}
          {needsZeus && !isZeusApproved ? (
            <button
              onClick={handleApproveZeus}
              disabled={isAddBusy}
              className="btn-zeus"
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.875rem", fontWeight: 700, opacity: isAddBusy ? 0.5 : 1 }}
            >
              {isApproving || isApproveConfirming ? "Approving ZEUS..." : "Approve ZEUS"}
            </button>
          ) : (
            <button
              onClick={handleAddLiquidity}
              disabled={isAddBusy || !(addEthNum > 0 || addZeusNum > 0)}
              className="btn-zeus"
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.875rem", fontWeight: 700, opacity: (isAddBusy || !(addEthNum > 0 || addZeusNum > 0)) ? 0.5 : 1 }}
            >
              {isAddingMore || isAddMoreConfirming ? "Adding Liquidity..." : "Add Liquidity"}
            </button>
          )}

          {addMoreTxHash && (
            <a href={`https://etherscan.io/tx/${addMoreTxHash}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "0.7rem", textAlign: "center", color: "#a8c8ff", fontFamily: "monospace" }}>
              Tx: {addMoreTxHash.slice(0, 10)}...
            </a>
          )}
        </div>
      )}

      {/* Withdraw Partial inline form */}
      {showWithdraw && position.status !== "closed" && (
        <div style={{ background: "rgba(240,230,78,0.04)", border: "1px solid rgba(240,230,78,0.15)", borderRadius: "1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Percentage picker */}
          <div>
            <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
              Withdraw Amount
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => setWithdrawPct(pct)} style={{
                  flex: 1, padding: "0.5rem",
                  background: withdrawPct === pct ? "rgba(240,230,78,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${withdrawPct === pct ? "rgba(240,230,78,0.5)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "0.5rem", color: withdrawPct === pct ? "var(--highlight)" : "var(--text-muted)",
                  fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                }}>
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0.75rem", padding: "0.875rem" }}>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>You will receive</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "#fff", marginBottom: "0.35rem" }}>{fmtUsd(withdrawTotalUsd)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              {needsEth && withdrawEth > 0 && (
                <span style={{ fontSize: "0.75rem", color: "#a8c8ff" }}>
                  {withdrawEth.toFixed(6)} ETH <span style={{ color: "var(--text-muted)" }}>({fmtUsd(withdrawEthUsd)})</span>
                </span>
              )}
              {needsZeus && withdrawZeus > 0 && (
                <span style={{ fontSize: "0.75rem", color: "var(--highlight)" }}>
                  {fmtZeus(withdrawZeus)} ZEUS <span style={{ color: "var(--text-muted)" }}>({fmtUsd(withdrawZeusUsd)})</span>
                </span>
              )}
            </div>
          </div>

          {/* Submit */}
          <button onClick={handleWithdraw} disabled={isBusy || position.liquidity === 0n} className="btn-zeus"
            style={{ width: "100%", padding: "0.75rem", fontSize: "0.875rem", fontWeight: 700 }}>
            {isWithdrawing || isWithdrawConfirming ? "Withdrawing..." : `Withdraw ${withdrawPct}%`}
          </button>
        </div>
      )}

      {/* Tx links */}
      {closeTxHash && (
        <a href={`https://etherscan.io/tx/${closeTxHash}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: "0.7rem", textAlign: "center", color: "#a8c8ff", fontFamily: "monospace" }}>
          Close tx: {closeTxHash.slice(0, 10)}...
        </a>
      )}
      {collectTxHash && (
        <a href={`https://etherscan.io/tx/${collectTxHash}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: "0.7rem", textAlign: "center", color: "#a8c8ff", fontFamily: "monospace" }}>
          Collect tx: {collectTxHash.slice(0, 10)}...
        </a>
      )}
    </div>
  )
}
