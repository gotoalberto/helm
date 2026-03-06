/**
 * POST /api/positions/invalidate
 *
 * Clears the zeus_positions_cache so the next GET /api/positions/all
 * rescans the chain and picks up newly opened/closed positions.
 *
 * Called client-side after a confirmed add/remove liquidity transaction.
 */

import { NextResponse } from "next/server"
import { getDb, ensureSchema } from "@/lib/db"

export const runtime = "nodejs"

export async function POST() {
  try {
    if (process.env.DATABASE_URL) {
      await ensureSchema()
      const db = getDb()
      await db.query("DELETE FROM zeus_positions_cache")
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Positions invalidate error:", error)
    return NextResponse.json({ error: "Failed to invalidate cache" }, { status: 500 })
  }
}
