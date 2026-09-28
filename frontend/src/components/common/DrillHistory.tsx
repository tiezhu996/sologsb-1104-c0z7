import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDrillStore } from '../../stores/drillStore'
import type { DrillRound } from '../../types/drill'
import { deviationLevel, formatDeviation, formatDuration, formatRoundTime, isOvertime } from '../../utils/drillTimer'
import { BlankPanel } from './BlankPanel'
import { DrillStepTable } from './DrillStepTable'

interface DrillHistoryProps {
  jointTypeId: string
  /** 默认展示最近几轮，0 表示全部 */
  limit?: number
  /** 是否显示“进入演练计时”入口 */
  showEntry?: boolean
}

export function DrillHistory({ jointTypeId, limit = 5, showEntry = true }: DrillHistoryProps) {
  const rounds = useDrillStore((state) => state.rounds)
  const loading = useDrillStore((state) => state.loading)
  const loadRounds = useDrillStore((state) => state.loadRounds)
  const removeRound = useDrillStore((state) => state.removeRound)
  const [showAll, setShowAll] = useState(limit === 0)

  useEffect(() => {
    void loadRounds(jointTypeId)
  }, [jointTypeId, loadRounds])

  const visibleRounds = showAll || limit === 0 ? rounds : rounds.slice(0, limit)

  if (!loading && rounds.length === 0) {
    return (
      <BlankPanel
        title="尚无演练计时记录"
        description="完成一轮拆装演练后，每一步的实际耗时与偏差会保存在当前类型里。"
        action={showEntry ? (
          <Link className="primary-button" to={`/joints/${jointTypeId}/drill`}>开始一轮演练</Link>
        ) : undefined}
      />
    )
  }

  return (
    <div className="space-y-3" data-testid="drill-history">
      {visibleRounds.map((round, index) => (
        <RoundCard key={round.id} round={round} defaultExpanded={index === 0} onDelete={() => void removeRound(round.id)} />
      ))}
      {!showAll && limit > 0 && rounds.length > limit ? (
        <button type="button" className="secondary-button w-full" onClick={() => setShowAll(true)}>
          翻看更早的 {rounds.length - limit} 轮记录
        </button>
      ) : null}
    </div>
  )
}

interface RoundCardProps {
  round: DrillRound
  defaultExpanded: boolean
  onDelete: () => void
}

function RoundCard({ round, defaultExpanded, onDelete }: RoundCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [confirming, setConfirming] = useState(false)
  const overtimeCount = round.results.filter((item) => isOvertime(deviationLevel(item.actualSec, item.plannedSec))).length
  const totalDelta = round.totalActualSec - round.totalPlannedSec

  return (
    <article className="panel overflow-hidden" data-testid="drill-round">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 text-left hover:bg-wood-50/60">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wood-50 text-wood-700">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm text-stone-900">{formatRoundTime(round.endedAt)} 的演练</strong>
          <span className="mt-0.5 block text-xs text-stone-500">
            {round.results.length} 步 · 计划 {formatDuration(round.totalPlannedSec)} · 实际 {formatDuration(round.totalActualSec)}
          </span>
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          totalDelta > 5 ? 'bg-rose-50 text-rose-800' : totalDelta < -2 ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'
        }`}>
          总偏差 {formatDeviation(round.totalActualSec, round.totalPlannedSec)}
        </span>
        {overtimeCount > 0 ? (
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800" data-testid="drill-overtime-badge">
            {overtimeCount} 步超时
          </span>
        ) : null}
        <span className="text-xs text-stone-400" aria-hidden="true">{expanded ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {expanded ? (
        <div className="border-t border-wood-100">
          <div className="p-2">
            <DrillStepTable
              rows={round.results.map((item) => ({
                seq: item.seq,
                action: item.action,
                direction: item.direction,
                tool: item.tool,
                plannedSec: item.plannedSec,
                actualSec: item.actualSec,
              }))}
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3" data-testid="drill-round-actions">
            {confirming ? (
              <>
                <span className="mr-auto text-xs text-rose-700">确认清掉这条录错的记录？此操作不可恢复。</span>
                <button type="button" className="secondary-button px-3 py-1.5 text-xs" onClick={() => setConfirming(false)}>再想想</button>
                <button
                  type="button"
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                  data-testid="drill-delete-confirm"
                  onClick={() => {
                    onDelete()
                    setConfirming(false)
                  }}
                >
                  确认清除
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                data-testid="drill-delete"
                onClick={() => setConfirming(true)}
              >
                清除该轮记录
              </button>
            )}
          </div>
        </div>
      ) : null}
    </article>
  )
}
