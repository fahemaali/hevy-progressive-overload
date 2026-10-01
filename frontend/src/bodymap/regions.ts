/**
 * Which shapes of the body figure make up each Hevy muscle group.
 *
 * The figure's outlines come from the open-source `body-muscles` package
 * (Apache-2.0, © Ivan Vulović), which splits the body into ~90 regions. Hevy uses
 * 17 body groups, so each group is a set of those regions, matched by id prefix.
 * Regions that aren't a trainable group (head, hands, knees…) are drawn as figure.
 */
import { BACK_MUSCLES, FRONT_MUSCLES } from 'body-muscles'

export const HEVY_REGIONS: Record<string, readonly string[]> = {
  abdominals: ['abs-', 'obliques-', 'serratus-anterior-'],
  abductors: ['gluteus-medius-'],
  adductors: ['adductors-'],
  biceps: ['biceps-'],
  calves: ['calves-'],
  chest: ['chest-'],
  forearms: ['forearm-'],
  glutes: ['gluteus-maximus-'],
  hamstrings: ['hamstrings-'],
  lats: ['lats-'],
  lower_back: ['lower-back-'],
  neck: ['neck-', 'nape'],
  quadriceps: ['quads-'],
  shoulders: ['shoulder-', 'deltoid-rear-'],
  traps: ['traps-upper-'],
  triceps: ['triceps-'],
  upper_back: ['traps-mid-', 'traps-lower-'],
}

export type View = 'front' | 'back'

export interface Region {
  id: string
  path: string
  group: string | null // null: part of the figure, not a muscle group
}

function groupFor(regionId: string): string | null {
  for (const [group, prefixes] of Object.entries(HEVY_REGIONS)) {
    if (prefixes.some((prefix) => regionId.startsWith(prefix))) return group
  }
  return null
}

function toRegions(muscles: readonly { id: string; path: string }[]): Region[] {
  return muscles.map((m) => ({ id: m.id, path: m.path, group: groupFor(m.id) }))
}

export const REGIONS: Record<View, Region[]> = {
  front: toRegions(FRONT_MUSCLES),
  back: toRegions(BACK_MUSCLES),
}

// The package draws both views on one canvas, side by side.
export const VIEW_BOXES: Record<View, string> = {
  front: '0 0 35 93',
  back: '37 0 35 93',
}
