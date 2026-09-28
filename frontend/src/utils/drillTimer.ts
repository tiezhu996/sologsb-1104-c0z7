/** 演练计时与偏差展示工具 */

export type DeviationLevel = 'ahead' | 'ontime' | 'over' | 'severe'

/**
 * 根据实际与计划秒数判断超时程度：
 * - 超时较多（severe）：比计划多出 5 秒以上，或超出计划一倍
 * - 超时（over）：比计划多出 2 秒以上，或超出 50%
 * - 偏快（ahead）：比计划快 2 秒以上
 * - 其余视为基本吻合（ontime）
 */
export function deviationLevel(actualSec: number, plannedSec: number): DeviationLevel {
  const delta = actualSec - plannedSec
  if (delta > 5 || actualSec > plannedSec * 2) return 'severe'
  if (delta > 2 || actualSec > plannedSec * 1.5) return 'over'
  if (delta < -2) return 'ahead'
  return 'ontime'
}

export function isOvertime(level: DeviationLevel): boolean {
  return level === 'over' || level === 'severe'
}

/** 已计入的耗时秒数（暂停区间不计）；timingStart 为空表示当前处于暂停 */
export function elapsedSec(elapsedBeforeMs: number, timingStartMs: number | null, nowMs: number): number {
  return Math.max(0, (elapsedBeforeMs + (timingStartMs === null ? 0 : nowMs - timingStartMs)) / 1000)
}

/** 四舍五入到整秒，保证落库的实际耗时为正整数 */
export function roundSec(elapsedSeconds: number): number {
  return Math.max(1, Math.round(elapsedSeconds))
}

export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes === 0) return `${seconds} 秒`
  return `${minutes} 分 ${String(seconds).padStart(2, '0')} 秒`
}

export function formatClock(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatDeviation(actualSec: number, plannedSec: number): string {
  const delta = actualSec - plannedSec
  if (delta === 0) return '±0 秒'
  return delta > 0 ? `+${delta} 秒` : `${delta} 秒`
}

export function formatRoundTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '时间未知'
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getMonth() + 1}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
