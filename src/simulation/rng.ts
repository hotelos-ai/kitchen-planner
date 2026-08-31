export interface Rng {
  next(): number
  between(min: number, max: number): number
  integer(min: number, max: number): number
  pick<T>(values: readonly T[]): T
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    between: (min, max) => min + (max - min) * next(),
    integer: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: <T,>(values: readonly T[]) => {
      if (!values.length) throw new Error('Cannot choose from an empty list')
      return values[Math.floor(next() * values.length)]
    },
  }
}
