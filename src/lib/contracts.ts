export const RENEWAL_WINDOW_DAYS = 60

export function daysUntil(dateStr: string) {
  const ms = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / 86_400_000)
}
