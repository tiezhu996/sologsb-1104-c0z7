import { create } from 'zustand'
import type { DrillRound } from '../types/drill'
import type { DisassemblyStep } from '../types/step'
import { db } from '../utils/db'

interface StepTimingInput {
  actualSec: number
  plannedSec: number
}

interface DrillState {
  rounds: DrillRound[]
  loading: boolean
  /** 加载某类型的演练轮次，按结束时间倒序 */
  loadRounds: (jointTypeId: string) => Promise<void>
  /** 保存一轮演练并放入列表头部，返回新记录 */
  saveRound: (
    jointTypeId: string,
    startedAt: string,
    steps: DisassemblyStep[],
    timings: StepTimingInput[],
  ) => Promise<DrillRound>
  removeRound: (roundId: string) => Promise<void>
}

function createId(): string {
  return `drill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useDrillStore = create<DrillState>((set, get) => ({
  rounds: [],
  loading: false,

  loadRounds: async (jointTypeId) => {
    set({ loading: true })
    try {
      const list = await db.drills.where('jointTypeId').equals(jointTypeId).toArray()
      const rounds = list.sort((a, b) => b.endedAt.localeCompare(a.endedAt))
      set({ rounds })
    } finally {
      set({ loading: false })
    }
  },

  saveRound: async (jointTypeId, startedAt, steps, timings) => {
    const results = steps.map((step, index) => {
      const timing = timings[index]
      return {
        stepId: step.id,
        seq: step.seq,
        action: step.action,
        direction: step.direction,
        tool: step.tool,
        plannedSec: timing?.plannedSec ?? step.holdSec,
        actualSec: timing?.actualSec ?? step.holdSec,
      }
    })
    const round: DrillRound = {
      id: createId(),
      jointTypeId,
      startedAt,
      endedAt: new Date().toISOString(),
      totalPlannedSec: results.reduce((total, item) => total + item.plannedSec, 0),
      totalActualSec: results.reduce((total, item) => total + item.actualSec, 0),
      results,
    }
    await db.drills.add(round)
    const current = get().rounds
    set({ rounds: [round, ...current.filter((item) => item.jointTypeId === jointTypeId)] })
    return round
  },

  removeRound: async (roundId) => {
    await db.drills.delete(roundId)
    set((state) => ({ rounds: state.rounds.filter((round) => round.id !== roundId) }))
  },
}))
