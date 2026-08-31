import type { DisplayUnit } from './project'

const MM_PER_INCH = 25.4

const compact = (value: number, digits = 2) => Number(value.toFixed(digits)).toString()

export function formatLength(mm: number, unit: DisplayUnit): string {
  if (unit === 'mm') return `${Math.round(mm)} mm`
  if (unit === 'cm') return `${compact(mm / 10)} cm`
  if (unit === 'in') return `${compact(mm / MM_PER_INCH)} in`
  const totalInches = mm / MM_PER_INCH
  const feet = Math.floor(totalInches / 12)
  return `${feet}' ${compact(totalInches - feet * 12)}"`
}

export function formatLengthInput(mm: number, unit: DisplayUnit): string {
  if (unit === 'mm') return Math.round(mm).toString()
  if (unit === 'cm') return compact(mm / 10)
  if (unit === 'in') return compact(mm / MM_PER_INCH)
  const totalInches = mm / MM_PER_INCH
  return `${Math.floor(totalInches / 12)}' ${compact(totalInches % 12)}"`
}

export function parseLength(input: string, unit: DisplayUnit): number {
  const numbers = input.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  if (!numbers.length) throw new Error('Enter a numeric length')
  if (unit === 'ft') return (numbers[0] * 12 + (numbers[1] ?? 0)) * MM_PER_INCH
  const factor = unit === 'mm' ? 1 : unit === 'cm' ? 10 : MM_PER_INCH
  return numbers[0] * factor
}

export function formatDimensions(
  value: { widthMm: number; depthMm: number },
  unit: DisplayUnit,
): string {
  return `${formatLength(value.widthMm, unit)} × ${formatLength(value.depthMm, unit)}`
}
