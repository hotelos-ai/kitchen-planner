export type MenuItemSource = 'user-provided' | 'imported' | 'template-estimate' | 'system-inferred'

export type MenuRouteStep = {
  label: string
  station: string
  activeSeconds: number
  cookingSeconds?: { min: number; max: number }
}

export type EstimatedMenuItem = {
  id: string
  name: string
  sharePct: number
  route: string
  timeRangeMinutes: [number, number]
  source: MenuItemSource
  steps: MenuRouteStep[]
}

export const DEFAULT_GENERATED_MENU: EstimatedMenuItem[] = [
  {
    id: 'grilled-fish', name: 'Grilled fish', sharePct: 16, route: 'Cold prep → Grill → Pass', timeRangeMinutes: [10, 14], source: 'template-estimate',
    steps: [
      { label: 'Retrieve', station: 'Upright fridge', activeSeconds: 15 },
      { label: 'Prepare', station: 'Cold preparation', activeSeconds: 90 },
      { label: 'Cook', station: 'Grill', activeSeconds: 25, cookingSeconds: { min: 480, max: 720 } },
      { label: 'Plate', station: 'Pass', activeSeconds: 45 },
    ],
  },
  {
    id: 'chicken-curry', name: 'Chicken curry', sharePct: 13, route: 'Prep → Range → Pass', timeRangeMinutes: [12, 18], source: 'template-estimate',
    steps: [
      { label: 'Retrieve', station: 'Cold storage', activeSeconds: 20 },
      { label: 'Prepare', station: 'Prep', activeSeconds: 120 },
      { label: 'Cook', station: 'Range', activeSeconds: 40, cookingSeconds: { min: 540, max: 900 } },
      { label: 'Plate', station: 'Pass', activeSeconds: 40 },
    ],
  },
  {
    id: 'fried-rice', name: 'Fried rice', sharePct: 11, route: 'Prep → Range → Pass', timeRangeMinutes: [7, 11], source: 'template-estimate',
    steps: [
      { label: 'Retrieve', station: 'Fridge', activeSeconds: 12 },
      { label: 'Prepare', station: 'Prep', activeSeconds: 60 },
      { label: 'Cook', station: 'Range', activeSeconds: 30, cookingSeconds: { min: 300, max: 480 } },
      { label: 'Plate', station: 'Pass', activeSeconds: 30 },
    ],
  },
  {
    id: 'green-salad', name: 'Green salad', sharePct: 9, route: 'Cold prep → Pass', timeRangeMinutes: [4, 7], source: 'template-estimate',
    steps: [
      { label: 'Retrieve', station: 'Cold prep', activeSeconds: 20 },
      { label: 'Prepare', station: 'Cold preparation', activeSeconds: 90 },
      { label: 'Plate', station: 'Pass', activeSeconds: 35 },
    ],
  },
]

export function parseMenuText(text: string): EstimatedMenuItem[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return []
  const share = Math.max(4, Math.round(100 / lines.length))
  return lines.map((name, index) => ({
    id: `imported-${index + 1}`,
    name: name.replace(/^[\d.)\-\s]+/, '').slice(0, 80) || `Item ${index + 1}`,
    sharePct: share,
    route: 'Prep → Cook → Pass',
    timeRangeMinutes: [8, 14] as [number, number],
    source: 'imported' as const,
    steps: [
      { label: 'Prepare', station: 'Prep', activeSeconds: 90 },
      { label: 'Cook', station: 'Hot line', activeSeconds: 30, cookingSeconds: { min: 360, max: 600 } },
      { label: 'Plate', station: 'Pass', activeSeconds: 40 },
    ],
  }))
}

export function assumptionCounts(userProvided: number, equipmentDerived: number, templateEstimates: number, unresolved = 0) {
  return { userProvided, equipmentDerived, templateEstimates, unresolved }
}
