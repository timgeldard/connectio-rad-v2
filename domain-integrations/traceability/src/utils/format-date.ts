const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const date = formatDate(iso)
  if (h === 0 && m === 0) return date
  return `${date} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
