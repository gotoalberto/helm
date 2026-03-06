/**
 * Badge calculation logic for Guardian profiles
 *
 * Badges:
 * - ARCHITECT: Admin who deployed the wall (off-chain, assigned by admin)
 * - FIRST_GUARDIAN: First LP to join a wall
 * - FEE_HARVESTER: Collected fees from a wall position
 * - VETERAN: Participated in 3+ battles
 * - SURVIVOR: Was in a battle that was successfully defended
 * - LAST_STAND: Was the last guardian when wall fell (highest relative contribution in a breach)
 */

export type BadgeType =
  | "ARCHITECT"
  | "FIRST_GUARDIAN"
  | "FEE_HARVESTER"
  | "VETERAN"
  | "SURVIVOR"
  | "LAST_STAND"

export interface Badge {
  type: BadgeType
  label: string
  description: string
  image: string
  earnedAt?: string
}

const BADGE_META: Record<BadgeType, Omit<Badge, "earnedAt">> = {
  ARCHITECT: {
    type: "ARCHITECT",
    label: "Architect",
    description: "Deployed the Citadel Wall",
    image: "/badge-architect.png",
  },
  FIRST_GUARDIAN: {
    type: "FIRST_GUARDIAN",
    label: "First Guardian",
    description: "First to join a wall's defense",
    image: "/badge-first-guardian.png",
  },
  FEE_HARVESTER: {
    type: "FEE_HARVESTER",
    label: "Fee Harvester",
    description: "Collected fees from a defended wall",
    image: "/badge-fee-harvester.png",
  },
  VETERAN: {
    type: "VETERAN",
    label: "Veteran",
    description: "Participated in 3 or more battles",
    image: "/badge-veteran.png",
  },
  SURVIVOR: {
    type: "SURVIVOR",
    label: "Survivor",
    description: "Defended a wall that held against the siege",
    image: "/badge-survivor.png",
  },
  LAST_STAND: {
    type: "LAST_STAND",
    label: "Last Stand",
    description: "Held position as the wall fell",
    image: "/badge-last-stand.png",
  },
}

export interface GuardianStats {
  battleCount: number
  survivedBattles: number
  breachedBattles: number
  isFirstGuardian: boolean
  hasCollectedFees: boolean
  wasLastStand: boolean
}

export function calculateBadges(stats: GuardianStats): Badge[] {
  const badges: Badge[] = []

  if (stats.isFirstGuardian) {
    badges.push(BADGE_META.FIRST_GUARDIAN)
  }
  if (stats.hasCollectedFees) {
    badges.push(BADGE_META.FEE_HARVESTER)
  }
  if (stats.battleCount >= 3) {
    badges.push(BADGE_META.VETERAN)
  }
  if (stats.survivedBattles > 0) {
    badges.push(BADGE_META.SURVIVOR)
  }
  if (stats.wasLastStand) {
    badges.push(BADGE_META.LAST_STAND)
  }

  return badges
}

export function getBadgeMeta(type: BadgeType): Omit<Badge, "earnedAt"> {
  return BADGE_META[type]
}
