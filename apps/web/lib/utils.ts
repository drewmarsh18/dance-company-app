import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isWithin24Hours(date: string, time: string): boolean {
  const dt = new Date(`${date} ${time}`)
  if (Number.isNaN(dt.getTime())) return false
  return dt.getTime() - Date.now() < 24 * 60 * 60 * 1000
}
