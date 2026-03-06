import { NextRequest, NextResponse } from "next/server"
import { getDb, ensureCitadelSchema } from "@/lib/db"

/**
 * POST /api/citadel/guardian/join
 * Record a guardian joining the active wall
 * Body: { address, liquidityContributed, txHash? }
 */
export async function POST(req: NextRequest) {
  try {
    await ensureCitadelSchema()
    const db = getDb()
    const body = await req.json()
    const { address, liquidityContributed, txHash } = body

    if (!address || liquidityContributed == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const normalizedAddress = address.toLowerCase()

    // Get active wall
    const { rows: wallRows } = await db.query(
      `SELECT * FROM citadel.walls WHERE status = 'active' ORDER BY deployed_at DESC LIMIT 1`
    )

    if (wallRows.length === 0) {
      return NextResponse.json({ error: "No active wall" }, { status: 404 })
    }

    const wall = wallRows[0]

    // Update peak liquidity if needed
    const newLiquidity = BigInt(wall.peak_liquidity || "0") + BigInt(liquidityContributed)
    await db.query(
      `UPDATE citadel.walls SET peak_liquidity = $1 WHERE id = $2`,
      [newLiquidity.toString(), wall.id]
    )

    // Get or create battle for this wall
    let { rows: battleRows } = await db.query(
      `SELECT * FROM citadel.battles WHERE wall_id = $1 AND outcome = 'defended' AND ended_at > NOW() - INTERVAL '1 year' LIMIT 1`,
      [wall.id]
    )

    // If no ongoing battle tracking row, create a placeholder one
    // (battles are finalized when wall is demolished/breached)
    // We track participation via guardian_battles linked to future battle
    // Instead, track against wall_id directly in first_guardians and a pending battle

    // Register first guardian
    await db.query(
      `INSERT INTO citadel.first_guardians (wall_id, address) VALUES ($1, $2) ON CONFLICT (wall_id) DO NOTHING`,
      [wall.id, normalizedAddress]
    )

    // Record participation (use wall_id as temporary key until battle is finalized)
    // We'll use a separate join tracking table approach via upsert
    await db.query(
      `INSERT INTO citadel.guardian_battles (battle_id, address, liquidity_contributed)
       SELECT b.id, $1, $2
       FROM citadel.battles b
       WHERE b.wall_id = $3
       ORDER BY b.id DESC LIMIT 1
       ON CONFLICT (battle_id, address) DO UPDATE SET liquidity_contributed = citadel.guardian_battles.liquidity_contributed + $2`,
      [normalizedAddress, liquidityContributed.toString(), wall.id]
    )

    // Check if first guardian
    const { rows: firstRows } = await db.query(
      `SELECT address FROM citadel.first_guardians WHERE wall_id = $1`,
      [wall.id]
    )
    const isFirstGuardian = firstRows.length > 0 && firstRows[0].address === normalizedAddress

    return NextResponse.json({
      success: true,
      isFirstGuardian,
      wallId: wall.id,
    }, { status: 201 })
  } catch (error) {
    console.error("POST /api/citadel/guardian/join error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
