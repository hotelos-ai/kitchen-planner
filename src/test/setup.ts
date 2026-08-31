import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const values = new Map<string, string>()
const testStorage: Storage = {
  get length() { return values.size },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => [...values.keys()][index] ?? null,
  removeItem: (key) => { values.delete(key) },
  setItem: (key, value) => { values.set(key, value) },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: testStorage,
  configurable: true,
})

afterEach(() => {
  cleanup()
  testStorage.clear()
})
