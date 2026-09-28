import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { DrillSession } from '../../types/drill'
import { deviationTone, formatDateTime, formatSec, formatSignedSec, isStepOverrun } from '../../utils/timing'

interface DrillHistoryProps {
  jointTypeId: string
  sessions: DrillSession[]
  limit?: number
  onDelete: (sessionId: string) => Promise<void> | void
}

export function DrillHistory({ jointTypeId, sessions, limit = 6, onDelete }: DrillHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const visible = sessions.slice(0, limit)

  const confirmDelete = async (session: DrillSession) => {
    const message = `删除 ${formatDateTime(session.startedAt)} 开始的这一轮演练记录？`
    if (!window.confirm(message)) return
    setRemovingId(session.id)
    try {
      await onDelete(session.id)
      if (expandedId === session.id) setExpandedId(null)
    } finally {
      setRemovingId(null)
    }
  }

  if (sessions.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-wood-100 bg-wood-50/70 px-6 py-8 text-center">
        <h2 className="text-base font-semibold text-wood-900">尚无演练计时记录</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">
          到步序编排页开始一轮演练，逐步记录实际耗时后，结果会保存在当前类型下。
        </p>
        <Link to={`/joints/${jointTypeId}/steps`} className="secondary-button mt-4">去演练计时</Link>
      </section>
    )
  }

  return (
    <section className="space-y-4" data-testid="drill-history">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-wood-900">演练计时记录</h2>
          <p className="mt-1 text-sm text-stone-500">最近 {visible.length} 轮（共 {sessions.length} 轮），录错的记录可直接清掉。</p>
        </div>
        <Link to={`/joints/${jointTypeId}/steps`} className="text-sm text-wood-700 hover:underline">开始新一轮演练 →</Link>
      </div>
      <div className="space-y-3">
        {visible.map((session, index) => {
          const roundNo = sessions.length - index
          const expanded = expandedId === session.id
          const totalDeviation = session.actualTotalSec - session.plannedTotalSec
          return (
            <article key={session.id} className="panel overflow-hidden" data-testid="drill-session">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wood-700 text-sm font-bold text-white">
                  {roundNo}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">{formatDateTime(session.startedAt)}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    计划 {formatSec(session.plannedTotalSec)} · 实际 {formatSec(session.actualTotalSec)} · 偏差
                    <strong className={`ml-1 ${deviationTone(session.plannedTotalSec, session.actualTotalSec)}`}>
                      {formatSignedSec(totalDeviation)}
                    </strong>
                  </p>
                </div>
                {session.overrunStepCount > 0 ? (
                  <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    {session.overrunStepCount} 步超时较多
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                    无明显超时
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    className="secondary-button px-3 py-1.5 text-xs"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : session.id)}
                  >
                    {expanded ? '收起明细' : '查看逐步明细'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    disabled={removingId === session.id}
                    onClick={() => void confirmDelete(session)}
                  >
                    {removingId === session.id ? '清除中…' : '清除记录'}
                  </button>
                </div>
              </div>
              {expanded ? (
                <div className="border-t border-stone-100 bg-stone-50/60 px-5 py-4" data-testid="drill-session-detail">
                  <ol className="space-y-2">
                    {session.records.map((record) => {
                      const overrun = isStepOverrun(record.plannedSec, record.actualSec)
                      return (
                        <li
                          key={`${session.id}-${record.stepId}`}
                          className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm ${
                            overrun ? 'border-rose-200 bg-rose-50/70' : 'border-stone-200 bg-white'
                          }`}
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                            {record.seq}
                          </span>
                          <strong className="text-stone-800">{record.action} · {record.direction}</strong>
                          <span className="text-xs text-stone-500">计划 {formatSec(record.plannedSec)}</span>
                          <span className="text-xs text-stone-500">实际 {formatSec(record.actualSec)}</span>
                          <span className={`text-xs font-semibold ${deviationTone(record.plannedSec, record.actualSec)}`}>
                            偏差 {formatSignedSec(record.actualSec - record.plannedSec)}
                          </span>
                          {overrun ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">超时较多</span>
                          ) : null}
                        </li>
                      )
                    })}
                  </ol>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
