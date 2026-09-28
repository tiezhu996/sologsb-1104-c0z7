import type { StepAction, StepDirection, StepTool } from './step'

/** 单步在一轮演练中的计时结果 */
export interface DrillStepResult {
  stepId: string
  seq: number
  action: StepAction
  direction: StepDirection
  tool: StepTool
  /** 计划停留秒数，取自开演时的步序快照 */
  plannedSec: number
  /** 实际耗时秒数，暂停时段不计入 */
  actualSec: number
}

/** 一轮完整演练 */
export interface DrillRound {
  id: string
  jointTypeId: string
  startedAt: string
  endedAt: string
  totalPlannedSec: number
  totalActualSec: number
  results: DrillStepResult[]
}
