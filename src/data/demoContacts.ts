export type DemoContact = {
  id: string
  name: string
  arkaCount: number
  lastArkaName: string
  lastSharedAt: string
  totalSharedNim: number
  tone: string
}

// Local demo history. This will later be derived from the user's completed and active Arkas.
export const demoContacts: DemoContact[] = [
  { id: 'user-maria', name: 'Maria', arkaCount: 6, lastArkaName: 'Friday Dinner', lastSharedAt: '2026-07-17T19:20:00.000Z', totalSharedNim: 684, tone: '#f6d7c7' },
  { id: 'user-fabi', name: 'Fabi', arkaCount: 5, lastArkaName: 'Weekend groceries', lastSharedAt: '2026-07-16T12:10:00.000Z', totalSharedNim: 522, tone: '#ded7ff' },
  { id: 'user-sara', name: 'Sara', arkaCount: 4, lastArkaName: 'Friday Dinner', lastSharedAt: '2026-07-15T20:05:00.000Z', totalSharedNim: 476, tone: '#cde8fa' },
  { id: 'user-josue', name: 'Josue', arkaCount: 3, lastArkaName: 'Office lunch', lastSharedAt: '2026-07-13T18:30:00.000Z', totalSharedNim: 318, tone: '#d4eee5' },
  { id: 'user-lucia', name: 'Lucia', arkaCount: 3, lastArkaName: 'Cafe meetup', lastSharedAt: '2026-07-11T10:34:00.000Z', totalSharedNim: 241, tone: '#fff0bd' },
  { id: 'user-alex', name: 'Alex', arkaCount: 2, lastArkaName: 'Friday Dinner', lastSharedAt: '2026-07-09T21:15:00.000Z', totalSharedNim: 196, tone: '#ead9c8' },
  { id: 'user-diego', name: 'Diego', arkaCount: 2, lastArkaName: 'Cafe meetup', lastSharedAt: '2026-07-05T10:34:00.000Z', totalSharedNim: 154, tone: '#dbe8c5' },
  { id: 'user-sofia', name: 'Sofia', arkaCount: 1, lastArkaName: 'Cafe meetup', lastSharedAt: '2026-07-05T10:34:00.000Z', totalSharedNim: 82, tone: '#f5d4df' },
]
