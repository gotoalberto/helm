/**
 * POST /api/cache/invalidate
 *
 * Deletes the leaderboard DB cache so the next GET /api/fees/leaderboard
 * recomputes from scratch in background.
 * Called client-side after any on-chain tx (mint, add, remove, collect, close).
 */

import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function POST() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true })
  }
  try {
    const db = getDb()
    await db.query(`DELETE FROM zeus_user_positions_cache WHERE address = '__leaderboard__'`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Cache invalidate error:", e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
