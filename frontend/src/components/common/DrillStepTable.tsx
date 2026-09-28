import { deviationLevel, formatDeviation, isOvertime, type DeviationLevel } from '../../utils/drillTimer'

export interface DrillStepRow {
  seq: number
  action: string
  direction: string
  tool: string
  plannedSec: number
  /** 未结束或未记录的步骤传 null，显示为占位 */
  actualSec: number | null
}

interface DrillStepTableProps {
  rows: DrillStepRow[]
  /** 当前正在演练的步骤索引，用于强调 */
  activeIndex?: number
  caption?: string
}

const deviationTone: Record<DeviationLevel, string> = {
  ahead: 'text-emerald-700',
  ontime: 'text-stone-600',
  over: 'text-amber-700',
  severe: 'font-bold text-rose-700',
}

export function DrillStepTable({ rows, activeIndex = -1, caption }: DrillStepTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        {caption ? <caption className="mb-2 text-left text-xs text-stone-500">{caption}</caption> : null}
        <thead className="bg-wood-50 text-xs text-wood-700">
          <tr>
            <th className="px-4 py-3 font-semibold">步序</th>
            <th className="px-4 py-3 font-semibold">动作</th>
            <th className="px-4 py-3 text-right font-semibold">计划（秒）</th>
            <th className="px-4 py-3 text-right font-semibold">实际（秒）</th>
            <th className="px-4 py-3 text-right font-semibold">偏差</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row, index) => {
            const level = row.actualSec === null ? null : deviationLevel(row.actualSec, row.plannedSec)
            const overtime = level !== null && isOvertime(level)
            const rowTone = index === activeIndex
              ? 'bg-wood-50/80'
              : level === 'severe'
                ? 'bg-rose-50/70'
                : level === 'over'
                  ? 'bg-amber-50/50'
                  : 'bg-white'
            return (
              <tr
                key={`${row.seq}-${index}`}
                data-testid="drill-step-row"
                data-seq={row.seq}
                data-overtime={overtime ? 'true' : 'false'}
                data-level={level ?? 'pending'}
                className={`align-top ${rowTone}`}
              >
                <td className="px-4 py-3">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    index === activeIndex ? 'bg-wood-700 text-white' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {row.seq}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <strong className="block text-stone-900">{row.action}</strong>
                  <span className="mt-0.5 block text-xs text-stone-500">{row.direction} · {row.tool}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-stone-600" data-testid="drill-planned">
                  {row.plannedSec}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-stone-900" data-testid="drill-actual">
                  {row.actualSec === null ? <span className="text-stone-300">—</span> : row.actualSec}
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-right ${level ? deviationTone[level] : 'text-stone-300'}`} data-testid="drill-deviation">
                  {row.actualSec === null || level === null
                    ? '—'
                    : <span className="inline-flex items-center gap-1.5">
                        {level === 'severe'
                          ? <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rose-700">超时较多</span>
                          : level === 'over'
                            ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800">超时</span>
                            : null}
                        {formatDeviation(row.actualSec, row.plannedSec)}
                      </span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
