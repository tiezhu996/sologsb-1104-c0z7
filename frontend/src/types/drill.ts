import type { StepAction, StepDirection } from './step'

export interface DrillStepRecord {
  stepId: string
  seq: number
  action: StepAction
  direction: StepDirection
  plannedSec: number
  actualSec: number
}

export interface DrillSession {
  id: string
  jointTypeId: string
  startedAt: string
  endedAt: string
  plannedTotalSec: number
  actualTotalSec: number
  overrunStepCount: number
  records: DrillStepRecord[]
  schemaRev?: number
}
