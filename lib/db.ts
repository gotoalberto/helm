/**
 * PostgreSQL connection pool for server-side caching
 * Used by /api/apr to cache APR computation results
 * Also hosts the citadel schema for the Citadel Protocol game
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

/**
 * Ensure the citadel schema and all required tables exist
 */
export async function ensureCitadelSchema(): Promise<void> {
  const db = getDb()
  await db.query(`CREATE SCHEMA IF NOT EXISTS citadel`)
  await db.query(`
    CREATE TABLE IF NOT EXISTS citadel.walls (
      id SERIAL PRIMARY KEY,
      tick_lower INTEGER NOT NULL,
      tick_upper INTEGER NOT NULL,
      mcap_usd NUMERIC NOT NULL,
      deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      demolished_at TIMESTAMPTZ,
      breached_at TIMESTAMPTZ,
      peak_liquidity NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'demolished', 'breached'))
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS citadel.battles (
      id SERIAL PRIMARY KEY,
      wall_id INTEGER NOT NULL REFERENCES citadel.walls(id),
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      outcome TEXT NOT NULL CHECK (outcome IN ('defended', 'breached')),
      peak_liquidity NUMERIC NOT NULL DEFAULT 0,
      guardian_count INTEGER NOT NULL DEFAULT 0,
      mcap_at_start NUMERIC,
      mcap_at_end NUMERIC
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS citadel.first_guardians (
      id SERIAL PRIMARY KEY,
      wall_id INTEGER NOT NULL REFERENCES citadel.walls(id),
      address TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(wall_id)
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS citadel.guardian_battles (
      id SERIAL PRIMARY KEY,
      battle_id INTEGER NOT NULL REFERENCES citadel.battles(id),
      address TEXT NOT NULL,
      liquidity_contributed NUMERIC NOT NULL DEFAULT 0,
      fees_earned_usd NUMERIC NOT NULL DEFAULT 0,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(battle_id, address)
    )
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_walls_status ON citadel.walls(status)
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_guardian_battles_address ON citadel.guardian_battles(address)
  `)
}
