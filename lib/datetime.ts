/**
 * Dashboard timezone: America/New_York (Eastern).
 * All "today" dates and date display use this timezone so the client sees correct dates.
 */

const TIMEZONE = 'America/New_York'

/**
 * Returns today's date in Miami as YYYY-MM-DD (for storing expense_date, etc.).
 */
export function getTodayInMiami(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date()) // en-CA gives YYYY-MM-DD
}

/**
 * Format a date (ISO string or Date) for display in Miami.
 */
export function formatDateInMiami(value: string | Date | null | undefined): string {
  if (value == null) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

/**
 * Format a date with time for display in Miami.
 */
export function formatDateTimeInMiami(value: string | Date | null | undefined): string {
  if (value == null) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

/**
 * Short date for chart labels (e.g. "Feb 13") in Miami.
 */
export function formatDateShortInMiami(value: string | Date | null | undefined): string {
  if (value == null) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
  }).format(date)
}
