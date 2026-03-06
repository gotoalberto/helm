import { NextRequest, NextResponse } from "next/server"
import { getDb, ensureCitadelSchema } from "@/lib/db"
import { getCurrentPoolTick } from "@/lib/uniswap/positions"
import { getWallIntegrity } from "@/lib/citadel/wallIntegrity"
import { integrityToImage } from "@/lib/citadel/wallImage"

function checkAdminAuth(req: NextRequest): boolean {
  const password = req.headers.get("x-admin-password")
  return password === process.env.ADMIN_PASSWORD
}

/**
 * GET /api/citadel/wall
 * Returns the active wall with real-time integrity and breach detection
 */
export async function GET() {
  try {
    await ensureCitadelSchema()
    const db = getDb()

    // Get active wall
    const { rows } = await db.query(
      `SELECT * FROM citadel.walls WHERE status = 'active' ORDER BY deployed_at DESC LIMIT 1`
    )

    if (rows.length === 0) {
      return NextResponse.json({ wall: null })
    }

    const wall = rows[0]

    // Get current pool tick for breach detection
    const currentTick = await getCurrentPoolTick()
    const isBreached = currentTick < wall.tick_lower

    if (isBreached) {
      // Auto-record breach
      await db.query(
        `UPDATE citadel.walls SET status = 'breached', breached_at = NOW() WHERE id = $1`,
        [wall.id]
      )

      // Create battle record for the breach
      await db.query(
        `INSERT INTO citadel.battles (wall_id, started_at, ended_at, outcome, peak_liquidity, guardian_count)
         SELECT $1, deployed_at, NOW(), 'breached', peak_liquidity,
           (SELECT COUNT(DISTINCT address) FROM citadel.guardian_battles WHERE battle_id IN
             (SELECT id FROM citadel.battles WHERE wall_id = $1))
         FROM citadel.walls WHERE id = $1
         ON CONFLICT DO NOTHING`,
        [wall.id]
      )

      return NextResponse.json({
        wall: {
          ...wall,
          status: "breached",
          breached_at: new Date().toISOString(),
          currentTick,
          integrity: 0,
          wallState: "FALLEN",
          wallImage: "/wall-0.png",
        },
      })
    }

    // Calculate integrity from on-chain liquidity
    // peak_liquidity stored in DB, current liquidity fetched live would require StateView
    // For now use peak_liquidity as proxy (full integrity if no breach)
    const peakLiquidity = BigInt(wall.peak_liquidity || "0")
    const integrityResult = getWallIntegrity(peakLiquidity, peakLiquidity)

    return NextResponse.json({
      wall: {
        ...wall,
        currentTick,
        integrity: 100,
        wallState: "INTACT",
        wallImage: integrityToImage(100),
      },
    })
  } catch (error) {
    console.error("GET /api/citadel/wall error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/citadel/wall
 * Deploy a new wall (admin only)
 * Body: { tickLower, tickUpper, mcapUsd }
 */
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await ensureCitadelSchema()
    const db = getDb()
    const body = await req.json()
    const { tickLower, tickUpper, mcapUsd } = body

    if (tickLower == null || tickUpper == null || mcapUsd == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (tickUpper !== tickLower + 60) {
      return NextResponse.json({ error: "Wall must be exactly 1 tick wide (tickUpper = tickLower + 60)" }, { status: 400 })
    }

    // Demolish any existing active wall
    await db.query(
      `UPDATE citadel.walls SET status = 'demolished', demolished_at = NOW() WHERE status = 'active'`
    )

    const { rows } = await db.query(
      `INSERT INTO citadel.walls (tick_lower, tick_upper, mcap_usd) VALUES ($1, $2, $3) RETURNING *`,
      [tickLower, tickUpper, mcapUsd]
    )

    return NextResponse.json({ wall: rows[0] }, { status: 201 })
  } catch (error) {
    console.error("POST /api/citadel/wall error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
