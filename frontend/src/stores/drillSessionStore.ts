import { create } from 'zustand'
import type { DisassemblyStep } from '../types/step'
import { elapsedSec, roundSec } from '../utils/drillTimer'

/** 演练中某一步的计时快照：timingStart 为 null 表示该步正处于暂停 */
interface SessionStep {
  elapsedBeforeMs: number
  timingStartMs: number | null
}

export type DrillPhase = 'running' | 'paused'

export interface DrillSession {
  jointTypeId: string
  startedAt: string
  steps: Pick<DisassemblyStep, 'id' | 'seq' | 'action' | 'direction' | 'tool' | 'holdSec'>[]
  /** 每一步的计时状态，索引与 steps 对齐 */
  timings: SessionStep[]
  currentIndex: number
  phase: DrillPhase
}

interface StepSnapshot {
  actualSec: number
  plannedSec: number
}

interface DrillSessionState {
  session: DrillSession | null
  start: (jointTypeId: string, steps: DisassemblyStep[]) => void
  togglePause: () => void
  /** 结束当前步并进入下一步，返回上一步的计时结果；进入下一步后保持暂停 */
  advanceStep: () => StepSnapshot | null
  /** 结束演练：返回每一步的整秒结果，调用方负责落库 */
  finish: () => StepSnapshot[]
  discard: () => void
}

function nowMs(): number {
  return Date.now()
}

export const useDrillSessionStore = create<DrillSessionState>((set, get) => ({
  session: null,

  start: (jointTypeId, steps) => {
    if (steps.length === 0) return
    set({
      session: {
        jointTypeId,
        startedAt: new Date().toISOString(),
        steps: steps.map(({ id, seq, action, direction, tool, holdSec }) => ({
          id, seq, action, direction, tool, holdSec,
        })),
        timings: steps.map(() => ({ elapsedBeforeMs: 0, timingStartMs: null })),
        currentIndex: 0,
        phase: 'paused',
      },
    })
  },

  togglePause: () => {
    const { session } = get()
    if (!session) return
    const at = nowMs()
    const timings = session.timings.map((timing, index) => {
      if (index !== session.currentIndex) return timing
      if (session.phase === 'running') {
        // 运行 → 暂停：把本段计时并入累计
        return {
          elapsedBeforeMs: timing.elapsedBeforeMs + (timing.timingStartMs === null ? 0 : at - timing.timingStartMs),
          timingStartMs: null,
        }
      }
      // 暂停 → 继续：重新起算
      return { ...timing, timingStartMs: at }
    })
    set({
      session: {
        ...session,
        timings,
        phase: session.phase === 'running' ? 'paused' : 'running',
      },
    })
  },

  advanceStep: () => {
    const { session } = get()
    if (!session) return null
    if (session.currentIndex >= session.steps.length - 1) return null
    const at = nowMs()
    const current = session.timings[session.currentIndex]
    const currentStep = session.steps[session.currentIndex]
    if (!current || !currentStep) return null
    const lastElapsed = elapsedSec(current.elapsedBeforeMs, current.timingStartMs, at)
    const timings = session.timings.map((timing, index) => {
      if (index === session.currentIndex) {
        return {
          elapsedBeforeMs: current.elapsedBeforeMs + (current.timingStartMs === null ? 0 : at - current.timingStartMs),
          timingStartMs: null,
        }
      }
      return timing
    })
    set({
      session: {
        ...session,
        timings,
        currentIndex: session.currentIndex + 1,
        // 切换后先停在新步骤上，由学员确认再开始计时
        phase: 'paused',
      },
    })
    return { actualSec: roundSec(lastElapsed), plannedSec: currentStep.holdSec }
  },

  finish: () => {
    const { session } = get()
    if (!session) return []
    const at = nowMs()
    const results = session.steps.map((step, index) => {
      const timing = session.timings[index]
      const seconds = timing
        ? elapsedSec(timing.elapsedBeforeMs, timing.timingStartMs, at)
        : 0
      return { actualSec: roundSec(seconds), plannedSec: step.holdSec }
    })
    set({ session: null })
    return results
  },

  discard: () => set({ session: null }),
}))

/** 供组件在渲染期读取当前步实时耗时（秒），需配合定时刷新调用方使用 */
export function selectCurrentElapsed(session: DrillSession, at: number): number {
  const timing = session.timings[session.currentIndex]
  if (!timing) return 0
  return elapsedSec(timing.elapsedBeforeMs, timing.timingStartMs, at)
}

/** 读取任意步骤当前累计耗时（秒），含未结束步骤的实时值 */
export function selectStepElapsed(session: DrillSession, index: number, at: number): number {
  const timing = session.timings[index]
  if (!timing) return 0
  return elapsedSec(timing.elapsedBeforeMs, timing.timingStartMs, at)
}
