/**
 * GET /api/fees/history/[address]
 *
 * Returns total historical fees earned by an address:
 *   - accumulated_usd: fees already collected (detected by pending drops between snapshots)
 *   - pending_usd: fees currently uncollected across all active positions
 *   - total_usd: sum of both
 */

import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getDb, ensureSchema } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params

  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 })
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ accumulatedUsd: 0, pendingUsd: 0, totalUsd: 0 })
  }

  try {
    await ensureSchema()
    const db = getDb()
    const row = await db.query(
      `SELECT
         COALESCE(SUM(accumulated_usd), 0)::float AS accumulated_usd,
         COALESCE(SUM(pending_usd), 0)::float      AS pending_usd
       FROM zeus_position_fees_snapshot
       WHERE owner = $1`,
      [address.toLowerCase()]
    )

    const r = row.rows[0]
    const accumulatedUsd = r?.accumulated_usd ?? 0
    const pendingUsd     = r?.pending_usd ?? 0

    return NextResponse.json({
      accumulatedUsd,
      pendingUsd,
      totalUsd: accumulatedUsd + pendingUsd,
    })
  } catch (e) {
    console.error("Fee history error:", e)
    return NextResponse.json({ accumulatedUsd: 0, pendingUsd: 0, totalUsd: 0 })
  }
}
