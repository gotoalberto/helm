import { NextResponse } from "next/server"
import { getDb, ensureCitadelSchema } from "@/lib/db"

/**
 * GET /api/citadel/battles
 * Returns battle history (most recent first)
 */
export async function GET() {
  try {
    await ensureCitadelSchema()
    const db = getDb()

    const { rows } = await db.query(`
      SELECT
        b.*,
        w.tick_lower,
        w.tick_upper,
        w.mcap_usd,
        COUNT(DISTINCT gb.address) AS guardian_count
      FROM citadel.battles b
      JOIN citadel.walls w ON b.wall_id = w.id
      LEFT JOIN citadel.guardian_battles gb ON gb.battle_id = b.id
      GROUP BY b.id, w.tick_lower, w.tick_upper, w.mcap_usd
      ORDER BY b.ended_at DESC
      LIMIT 50
    `)

    return NextResponse.json({ battles: rows })
  } catch (error) {
    console.error("GET /api/citadel/battles error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
