import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

function checkAdminAuth(req: NextRequest): boolean {
  const password = req.headers.get("x-admin-password")
  return password === process.env.ADMIN_PASSWORD
}

/**
 * DELETE /api/citadel/wall/[id]
 * Demolish a wall (admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const db = getDb()

    const { rows } = await db.query(
      `UPDATE citadel.walls SET status = 'demolished', demolished_at = NOW()
       WHERE id = $1 AND status = 'active' RETURNING *`,
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: "Wall not found or already inactive" }, { status: 404 })
    }

    return NextResponse.json({ wall: rows[0] })
  } catch (error) {
    console.error("DELETE /api/citadel/wall/[id] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
