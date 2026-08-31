export const HISTORY_LIMIT = 100

export function appendHistory<T>(history: T[], value: T): T[] {
  return [...history.slice(-(HISTORY_LIMIT - 1)), value]
}
