/**
 * Wall integrity calculation and state detection
 * Integrity = currentLiquidity / peakLiquidity * 100
 */

export type WallState = "INTACT" | "SIEGE" | "CRITICAL" | "FALLEN" | "NO_WALL"

export interface WallIntegrity {
  integrity: number // 0-100
  state: WallState
  currentLiquidity: bigint
  peakLiquidity: bigint
}

export function getWallIntegrity(
  currentLiquidity: bigint,
  peakLiquidity: bigint
): WallIntegrity {
  if (peakLiquidity === 0n) {
    return { integrity: 0, state: "NO_WALL", currentLiquidity, peakLiquidity }
  }

  const integrity = Number((currentLiquidity * 100n) / peakLiquidity)

  let state: WallState
  if (integrity >= 75) {
    state = "INTACT"
  } else if (integrity >= 50) {
    state = "SIEGE"
  } else if (integrity > 0) {
    state = "CRITICAL"
  } else {
    state = "FALLEN"
  }

  return { integrity, state, currentLiquidity, peakLiquidity }
}

export function getWallState(integrity: number): WallState {
  if (integrity >= 75) return "INTACT"
  if (integrity >= 50) return "SIEGE"
  if (integrity > 0) return "CRITICAL"
  return "FALLEN"
}
