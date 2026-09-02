export type StationTemplate = {
  id: string
  name: string
  description: string
  catalogIds: string[]
}

export const STATION_TEMPLATES: StationTemplate[] = [
  {
    id: 'hot-cooking-line',
    name: 'Hot cooking line',
    description: 'Range, flat-top and fryer as an editable cluster.',
    catalogIds: ['hot-six-burner-range', 'hot-griddle', 'hot-deep-fryer'],
  },
  {
    id: 'cold-preparation',
    name: 'Cold preparation station',
    description: 'Prep table, refrigerated counter and upright fridge.',
    catalogIds: ['prep-work-table', 'cold-prep-counter', 'cold-upright-refrigerator'],
  },
  {
    id: 'dishwashing',
    name: 'Dishwashing station',
    description: 'Dirty landing, pre-rinse, dishwasher and clean landing.',
    catalogIds: ['wash-dirty-landing', 'wash-pre-rinse-sink', 'wash-hood-dishwasher', 'wash-clean-landing'],
  },
  {
    id: 'bakery',
    name: 'Bakery station',
    description: 'Mixer, deck oven and proofing cabinet.',
    catalogIds: ['prep-spiral-mixer', 'oven-deck', 'holding-proofing-cabinet'],
  },
  {
    id: 'plating-pass',
    name: 'Plating and pass',
    description: 'Chef table and heated service pass.',
    catalogIds: ['prep-chef-table', 'service-hot-pass'],
  },
  {
    id: 'beverage',
    name: 'Beverage station',
    description: 'Espresso machine, ice and bar sink.',
    catalogIds: ['service-espresso-machine', 'ice-maker', 'service-bar-sink'],
  },
  {
    id: 'receiving',
    name: 'Receiving station',
    description: 'Work table, scale and waste bin for inbound goods.',
    catalogIds: ['prep-work-table', 'prep-scale', 'waste-mobile-bin'],
  },
]
