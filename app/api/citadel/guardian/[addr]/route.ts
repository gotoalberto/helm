import { NextRequest, NextResponse } from "next/server"
import { getDb, ensureCitadelSchema } from "@/lib/db"
import { calculateBadges } from "@/lib/citadel/badgeCalculator"

/**
 * GET /api/citadel/guardian/[addr]
 * Returns guardian profile with stats and earned badges
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ addr: string }> }
) {
  try {
    await ensureCitadelSchema()
    const { addr } = await params
    const address = addr.toLowerCase()
    const db = getDb()

    // Battle participation stats
    const { rows: battleRows } = await db.query(
      `SELECT
        COUNT(DISTINCT gb.battle_id) AS battle_count,
        SUM(gb.fees_earned_usd) AS total_fees_usd,
        SUM(CASE WHEN b.outcome = 'defended' THEN 1 ELSE 0 END) AS survived_battles,
        SUM(CASE WHEN b.outcome = 'breached' THEN 1 ELSE 0 END) AS breached_battles
       FROM citadel.guardian_battles gb
       JOIN citadel.battles b ON gb.battle_id = b.id
       WHERE LOWER(gb.address) = $1`,
      [address]
    )

    // First guardian check
    const { rows: firstRows } = await db.query(
      `SELECT COUNT(*) AS count FROM citadel.first_guardians WHERE LOWER(address) = $1`,
      [address]
    )

    // Last stand check: guardian with highest contribution in a breached battle
    const { rows: lastStandRows } = await db.query(
      `SELECT COUNT(*) AS count FROM (
        SELECT gb.battle_id
        FROM citadel.guardian_battles gb
        JOIN citadel.battles b ON gb.battle_id = b.id
        WHERE b.outcome = 'breached'
          AND LOWER(gb.address) = $1
          AND gb.liquidity_contributed = (
            SELECT MAX(gb2.liquidity_contributed)
            FROM citadel.guardian_battles gb2
            WHERE gb2.battle_id = gb.battle_id
          )
      ) AS ls`,
      [address]
    )

    const stats = battleRows[0]
    const battleCount = parseInt(stats.battle_count || "0")
    const survivedBattles = parseInt(stats.survived_battles || "0")
    const breachedBattles = parseInt(stats.breached_battles || "0")
    const totalFeesUsd = parseFloat(stats.total_fees_usd || "0")
    const isFirstGuardian = parseInt(firstRows[0].count) > 0
    const wasLastStand = parseInt(lastStandRows[0].count) > 0
    const hasCollectedFees = totalFeesUsd > 0

    const badges = calculateBadges({
      battleCount,
      survivedBattles,
      breachedBattles,
      isFirstGuardian,
      hasCollectedFees,
      wasLastStand,
    })

    // Recent battles
    const { rows: recentBattles } = await db.query(
      `SELECT b.id, b.outcome, b.ended_at, w.mcap_usd, gb.liquidity_contributed, gb.fees_earned_usd
       FROM citadel.guardian_battles gb
       JOIN citadel.battles b ON gb.battle_id = b.id
       JOIN citadel.walls w ON b.wall_id = w.id
       WHERE LOWER(gb.address) = $1
       ORDER BY b.ended_at DESC
       LIMIT 10`,
      [address]
    )

    return NextResponse.json({
      address,
      stats: {
        battleCount,
        survivedBattles,
        breachedBattles,
        totalFeesUsd,
        isFirstGuardian,
        wasLastStand,
        hasCollectedFees,
      },
      badges,
      recentBattles,
    })
  } catch (error) {
    console.error("GET /api/citadel/guardian/[addr] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
