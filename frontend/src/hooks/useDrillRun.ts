import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DrillSession, DrillStepRecord } from '../types/drill'
import type { DisassemblyStep } from '../types/step'
import { isStepOverrun, roundSec } from '../utils/timing'

export type DrillPhase = 'idle' | 'running' | 'paused'

interface CompletedRecord {
  stepId: string
  seq: number
  action: DisassemblyStep['action']
  direction: DisassemblyStep['direction']
  plannedSec: number
  actualSec: number
}

interface RunState {
  startedAt: number
  stepIndex: number
  records: CompletedRecord[]
  /** 当前步骤最近一次开始（或从暂停恢复）的时间戳；暂停时保持冻结前的旧值。 */
  activeSince: number
  /** 当前步骤已经累计的活跃毫秒，暂停期间不再增加。 */
  activeMs: number
}

export interface DrillRunResult {
  phase: DrillPhase
  startedAt: number | null
  currentStepIndex: number
  currentStepElapsedSec: number
  totalElapsedSec: number
  actuals: Array<{ stepId: string; actualSec: number }>
  start: () => void
  togglePause: () => void
  next: () => void
  finish: () => void
  discard: () => void
}

interface UseDrillRunOptions {
  steps: DisassemblyStep[]
  onFinish: (session: DrillSession) => Promise<void> | void
}

const TICK_MS = 120

export function useDrillRun({ steps, onFinish }: UseDrillRunOptions): DrillRunResult {
  const [phase, setPhase] = useState<DrillPhase>('idle')
  const [run, setRun] = useState<RunState | null>(null)
  const [, setTick] = useState(0)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  // 把当前步骤的累计时间冻结进 activeMs：运行时补上本活跃段，暂停时保持原值。
  const freeze = useCallback((state: RunState, now: number): RunState => {
    if (phase !== 'running') return state
    return { ...state, activeMs: state.activeMs + (now - state.activeSince) }
  }, [phase])

  // 将冻结状态中的当前步骤写入已完成记录（不再重复追加时间）。
  const appendRecord = useCallback((state: RunState): RunState => {
    const step = steps[state.stepIndex]
    if (!step) return state
    return {
      ...state,
      records: [
        ...state.records,
        {
          stepId: step.id,
          seq: step.seq,
          action: step.action,
          direction: step.direction,
          plannedSec: step.holdSec,
          actualSec: roundSec(state.activeMs / 1000),
        },
      ],
      activeMs: 0,
    }
  }, [steps])

  const start = useCallback(() => {
    if (steps.length === 0) return
    const now = Date.now()
    setRun({
      startedAt: now,
      stepIndex: 0,
      records: [],
      activeSince: now,
      activeMs: 0,
    })
    setPhase('running')
  }, [steps.length])

  const togglePause = useCallback(() => {
    const now = Date.now()
    if (phase === 'running') {
      setRun((current) => (current ? freeze(current, now) : current))
      setPhase('paused')
      return
    }
    if (phase === 'paused') {
      setRun((current) => (current ? { ...current, activeSince: now } : current))
      setPhase('running')
    }
  }, [phase, freeze])

  const next = useCallback(() => {
    if (phase !== 'running') return
    const now = Date.now()
    setRun((current) => {
      if (!current) return current
      const nextIndex = current.stepIndex + 1
      if (nextIndex >= steps.length) return current
      const recorded = appendRecord(freeze(current, now))
      return { ...recorded, stepIndex: nextIndex, activeSince: now, activeMs: 0 }
    })
  }, [phase, steps.length, freeze, appendRecord])

  const finish = useCallback(() => {
    const now = Date.now()
    const snapshot = run ? appendRecord(freeze(run, now)) : null
    if (!snapshot) return
    const records: DrillStepRecord[] = snapshot.records.map((record) => ({ ...record }))
    const plannedTotalSec = records.reduce((total, record) => total + record.plannedSec, 0)
    const actualTotalSec = roundSec(records.reduce((total, record) => total + record.actualSec, 0))
    const overrunStepCount = records.filter((record) => isStepOverrun(record.plannedSec, record.actualSec)).length
    const session: DrillSession | null = records.length === 0 ? null : {
      id: '',
      jointTypeId: steps[0]?.jointTypeId ?? '',
      startedAt: new Date(snapshot.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      plannedTotalSec,
      actualTotalSec,
      overrunStepCount,
      records,
    }
    setRun(null)
    setPhase('idle')
    if (session) void onFinishRef.current(session)
  }, [run, steps, freeze, appendRecord])

  const discard = useCallback(() => {
    setRun(null)
    setPhase('idle')
  }, [])

  useEffect(() => {
    if (phase !== 'running') return
    const timer = window.setInterval(() => setTick((value) => value + 1), TICK_MS)
    return () => window.clearInterval(timer)
  }, [phase])

  // 离开步序页时未结束的演练直接丢弃，避免把半截计时写进记录。
  useEffect(() => () => {
    setRun(null)
    setPhase('idle')
  }, [])

  const now = Date.now()
  const liveActiveMs = run
    ? (phase === 'running' ? run.activeMs + (now - run.activeSince) : run.activeMs)
    : 0

  const currentStepElapsedSec = useMemo(
    () => roundSec(liveActiveMs / 1000),
    [liveActiveMs],
  )

  const totalElapsedSec = useMemo(() => {
    if (!run) return 0
    const doneMs = run.records.reduce((total, record) => total + record.actualSec * 1000, 0)
    return roundSec((doneMs + liveActiveMs) / 1000)
  }, [run, liveActiveMs])

  const actuals = useMemo(() => {
    if (!run) return []
    const list = run.records.map((record) => ({ stepId: record.stepId, actualSec: record.actualSec }))
    const currentStep = steps[run.stepIndex]
    if (currentStep) list.push({ stepId: currentStep.id, actualSec: currentStepElapsedSec })
    return list
  }, [run, steps, currentStepElapsedSec])

  return {
    phase,
    startedAt: run?.startedAt ?? null,
    currentStepIndex: run?.stepIndex ?? 0,
    currentStepElapsedSec,
    totalElapsedSec,
    actuals,
    start,
    togglePause,
    next,
    finish,
    discard,
  }
}
