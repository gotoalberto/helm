import type { WallState } from "./wallIntegrity"

export function stateToImage(state: WallState): string {
  switch (state) {
    case "INTACT":
      return "/wall-100.png"
    case "SIEGE":
      return "/wall-75.png"
    case "CRITICAL":
      return "/wall-25.png"
    case "FALLEN":
      return "/wall-0.png"
    case "NO_WALL":
    default:
      return "/wall-0.png"
  }
}

export function integrityToImage(integrity: number): string {
  if (integrity >= 75) return "/wall-100.png"
  if (integrity >= 50) return "/wall-75.png"
  if (integrity >= 25) return "/wall-50.png"
  if (integrity > 0) return "/wall-25.png"
  return "/wall-0.png"
}
