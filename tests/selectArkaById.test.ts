import assert from 'node:assert/strict'
import test from 'node:test'
import { selectArkaById } from '../src/lib/arka/selectArkaById'
import type { Arka } from '../src/types/arka'

function arka(id: string) {
  return { id } as Arka
}

test('selectArkaById keeps a stable object reference for Zustand selectors', () => {
  const selectedArka = arka('arka-stable')
  const arkas = [selectedArka]

  assert.equal(selectArkaById(arkas, 'arka-stable', ''), selectedArka)
  assert.equal(selectArkaById(arkas, undefined, 'arka-stable'), selectedArka)
})
