/**
 * PostgreSQL connection pool for server-side caching
 * Used by /api/apr to cache APR computation results
 */

import { Pool } from "pg"

let pool: Pool | null = null

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("rds.amazonaws.com")
        ? { rejectUnauthorized: false }
        : undefined,
    })
  }
  return pool
}

/**
 * Ensure all required tables exist
 */
export async function ensureSchema(): Promise<void> {
  const db = getDb()
  await db.query(`
    CREATE TABLE IF NOT EXISTS zeus_apr_cache (
      id SERIAL PRIMARY KEY,
      apr NUMERIC NOT NULL,
      volume_24h_usd NUMERIC NOT NULL,
      tvl_usd NUMERIC NOT NULL,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS zeus_positions_cache (
      id SERIAL PRIMARY KEY,
      positions JSONB NOT NULL,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS zeus_fee_collections (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL,
      token_id TEXT NOT NULL,
      amount0_eth NUMERIC NOT NULL,
      amount1_zeus NUMERIC NOT NULL,
      eth_price_usd NUMERIC NOT NULL,
      zeus_price_usd NUMERIC NOT NULL,
      total_usd NUMERIC NOT NULL,
      tx_hash TEXT,
      collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_fee_collections_address ON zeus_fee_collections(address)
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS zeus_user_positions_cache (
      address TEXT PRIMARY KEY,
      positions JSONB NOT NULL,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS zeus_position_fees_snapshot (
      token_id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      pending_usd NUMERIC NOT NULL DEFAULT 0,
      accumulated_usd NUMERIC NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}
