const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

const ID_SHORT_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const ID_SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function toWibPseudoDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS)
}

export function getWibDateKey(date: Date = new Date()): string {
  const wib = toWibPseudoDate(date)
  const yyyy = wib.getUTCFullYear()
  const mm = String(wib.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(wib.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function getWibCompactDate(date: Date = new Date()): string {
  return getWibDateKey(date).replace(/-/g, '')
}

export function getWibDayRange(daysAgo = 0): { start: Date, end: Date, dateKey: string } {
  const nowWib = toWibPseudoDate(new Date())
  const target = new Date(Date.UTC(
    nowWib.getUTCFullYear(),
    nowWib.getUTCMonth(),
    nowWib.getUTCDate() - daysAgo,
    0, 0, 0, 0
  ))

  const yyyy = target.getUTCFullYear()
  const mm = String(target.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(target.getUTCDate()).padStart(2, '0')
  const dateKey = `${yyyy}-${mm}-${dd}`

  // Store & query Date objects aligned to local WIB wall-clock for MySQL DATETIME
  const start = new Date(target.getTime() - WIB_OFFSET_MS)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)

  return { start, end, dateKey }
}

export function formatShortIndonesianDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dayName = ID_SHORT_DAYS[dt.getUTCDay()]
  const monthName = ID_SHORT_MONTHS[dt.getUTCMonth()]
  return `${dayName}, ${d} ${monthName}`
}

export function toDecimalString(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2)
}
