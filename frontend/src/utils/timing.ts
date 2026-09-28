import { roundMeasure } from './measure'

/** 超时较多：比计划慢 50% 以上，且至少多出 2 秒，避免小步序被小数偏差误伤。 */
export function isStepOverrun(plannedSec: number, actualSec: number): boolean {
  if (!Number.isFinite(plannedSec) || !Number.isFinite(actualSec)) return false
  return actualSec - plannedSec >= Math.max(2, plannedSec * 0.5)
}

export function roundSec(valueSec: number): number {
  return roundMeasure(valueSec, 1)
}

export function formatSec(valueSec: number | null | undefined): string {
  if (valueSec === null || valueSec === undefined || !Number.isFinite(valueSec)) return '--'
  return `${roundMeasure(valueSec, 1)} 秒`
}

export function formatSignedSec(valueSec: number | null | undefined): string {
  if (valueSec === null || valueSec === undefined || !Number.isFinite(valueSec)) return '--'
  const rounded = roundMeasure(valueSec, 1)
  if (rounded === 0) return '±0 秒'
  return `${rounded > 0 ? '+' : ''}${rounded} 秒`
}

export function deviationTone(plannedSec: number, actualSec: number): string {
  if (isStepOverrun(plannedSec, actualSec)) return 'text-rose-700 font-semibold'
  if (actualSec - plannedSec > 0) return 'text-amber-700'
  if (actualSec - plannedSec < 0) return 'text-emerald-700'
  return 'text-stone-500'
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
