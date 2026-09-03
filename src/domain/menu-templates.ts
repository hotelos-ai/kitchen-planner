import type { SimulationMenuItem } from './project'

/** @deprecated Use SimulationMenuItem. Kept as a source-compatible UI alias. */
export type EstimatedMenuItem = SimulationMenuItem

export const DEFAULT_GENERATED_MENU: SimulationMenuItem[] = [
  {
    id: 'grilled-fish', name: 'Grilled fish', sharePct: 16, source: 'template-estimate',
    steps: [
      { label: 'Retrieve', capability: 'cold-retrieval', activeSeconds: 15 },
      { label: 'Prepare', capability: 'food-prep', activeSeconds: 90 },
      { label: 'Cook', capability: 'flat-top-cook', activeSeconds: 25, passiveSeconds: { minSeconds: 480, maxSeconds: 720 } },
      { label: 'Plate', capability: 'finish-plate', activeSeconds: 45 },
      { label: 'Pass', capability: 'clean-window', activeSeconds: 10 },
    ],
  },
  {
    id: 'chicken-curry', name: 'Chicken curry', sharePct: 13, source: 'template-estimate',
    steps: [
      { label: 'Retrieve', capability: 'cold-retrieval', activeSeconds: 20 },
      { label: 'Prepare', capability: 'food-prep', activeSeconds: 120 },
      { label: 'Cook', capability: 'range-cook', activeSeconds: 40, passiveSeconds: { minSeconds: 540, maxSeconds: 900 } },
      { label: 'Plate', capability: 'finish-plate', activeSeconds: 40 },
      { label: 'Pass', capability: 'clean-window', activeSeconds: 10 },
    ],
  },
  {
    id: 'fried-rice', name: 'Fried rice', sharePct: 11, source: 'template-estimate',
    steps: [
      { label: 'Retrieve', capability: 'cold-retrieval', activeSeconds: 12 },
      { label: 'Prepare', capability: 'food-prep', activeSeconds: 60 },
      { label: 'Cook', capability: 'range-cook', activeSeconds: 30, passiveSeconds: { minSeconds: 300, maxSeconds: 480 } },
      { label: 'Plate', capability: 'finish-plate', activeSeconds: 30 },
      { label: 'Pass', capability: 'clean-window', activeSeconds: 10 },
    ],
  },
  {
    id: 'green-salad', name: 'Green salad', sharePct: 9, source: 'template-estimate',
    steps: [
      { label: 'Retrieve', capability: 'cold-retrieval', activeSeconds: 20 },
      { label: 'Prepare', capability: 'food-prep', activeSeconds: 90 },
      { label: 'Plate', capability: 'finish-plate', activeSeconds: 35 },
      { label: 'Pass', capability: 'clean-window', activeSeconds: 10 },
    ],
  },
]

export function parseMenuText(text: string): SimulationMenuItem[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 200)
  if (!lines.length) return []
  const share = Math.min(100, Math.max(0, Math.round(100 / lines.length)))
  return lines.map((name, index) => ({
    id: `imported-${index + 1}`,
    name: name.replace(/^[\d.)\-\s]+/, '').slice(0, 160) || `Item ${index + 1}`,
    sharePct: share,
    source: 'imported' as const,
    steps: [
      { label: 'Prepare', capability: 'food-prep' as const, activeSeconds: 90 },
      { label: 'Cook', capability: 'range-cook' as const, activeSeconds: 30, passiveSeconds: { minSeconds: 360, maxSeconds: 600 } },
      { label: 'Plate', capability: 'finish-plate' as const, activeSeconds: 40 },
      { label: 'Pass', capability: 'clean-window' as const, activeSeconds: 10 },
    ],
  }))
}

export function assumptionCounts(userProvided: number, equipmentDerived: number, templateEstimates: number, unresolved = 0) {
  return { userProvided, equipmentDerived, templateEstimates, unresolved }
}
