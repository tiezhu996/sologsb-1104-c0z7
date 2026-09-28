import type { DragEvent } from 'react'
import type { DisassemblyStep } from '../../types/step'
import { deviationTone, formatSec, formatSignedSec, isStepOverrun } from '../../utils/timing'

interface StepActual {
  stepId: string
  actualSec?: number
}

interface StepRailProps {
  steps: DisassemblyStep[]
  currentIndex: number
  actuals?: StepActual[]
  dragLocked?: boolean
  onSelect: (index: number) => void
  onMove: (from: number, to: number) => void
}

export function StepRail({ steps, currentIndex, actuals = [], dragLocked = false, onSelect, onMove }: StepRailProps) {
  const actualMap = new Map(actuals.map((item) => [item.stepId, item.actualSec]))

  const handleDrop = (event: DragEvent<HTMLElement>, to: number) => {
    event.preventDefault()
    if (dragLocked) return
    const from = Number(event.dataTransfer.getData('text/plain'))
    if (Number.isInteger(from)) onMove(from, to)
  }

  return (
    <div className="space-y-3" aria-label="拆装步骤轨道">
      {steps.map((step, index) => {
        const actualSec = actualMap.get(step.id) ?? null
        const hasActual = actualSec !== null
        const overrun = hasActual && isStepOverrun(step.holdSec, actualSec)
        const deviation = hasActual ? actualSec - step.holdSec : null
        const toneClass = hasActual ? deviationTone(step.holdSec, actualSec) : 'text-stone-400'
        return (
          <article
            key={step.id}
            draggable={!dragLocked}
            onDragStart={dragLocked ? undefined : (event) => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', String(index))
            }}
            onDragOver={dragLocked ? undefined : (event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(event) => handleDrop(event, index)}
            className={`group rounded-xl border p-3 transition ${
              overrun
                ? 'border-rose-300 bg-rose-50/70 shadow-sm'
                : currentIndex === index
                  ? 'border-wood-500 bg-wood-50 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-wood-100'
            }`}
            data-testid="step-row"
          >
            <button
              type="button"
              disabled={dragLocked}
              onClick={() => onSelect(index)}
              className="flex w-full items-start gap-3 text-left disabled:cursor-default"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                currentIndex === index ? 'bg-wood-700 text-white' : 'bg-stone-100 text-stone-600'
              }`}>
                {step.seq}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-stone-900">{step.action}</strong>
                  <span className="text-xs text-stone-500">{step.direction} · {step.tool}</span>
                  {overrun ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700" data-testid="step-overrun">
                      超时较多
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs leading-5 text-stone-500">{step.riskNote}</span>
                <span className="mt-2 grid grid-cols-3 gap-2 text-[11px] leading-5" data-testid="step-timing">
                  <span className="rounded-md bg-stone-50 px-2 py-1">
                    计划<strong className="ml-1 text-stone-700">{step.holdSec} 秒</strong>
                  </span>
                  <span className={`rounded-md px-2 py-1 ${hasActual ? 'bg-wood-50' : 'bg-stone-50'}`}>
                    实际<strong className="ml-1 text-stone-700">{hasActual ? formatSec(actualSec) : '--'}</strong>
                  </span>
                  <span className={`rounded-md px-2 py-1 ${deviation !== null ? 'bg-stone-50' : 'bg-stone-50'}`}>
                    偏差<strong className={`ml-1 ${toneClass}`}>
                      {deviation !== null ? formatSignedSec(deviation) : '--'}
                    </strong>
                  </span>
                </span>
              </span>
            </button>
            <div className="mt-2 flex justify-end">
              {dragLocked ? (
                <span className="select-none rounded px-2 py-1 text-[11px] text-amber-700" data-testid="drag-locked">
                  演练中 · 调序锁定
                </span>
              ) : (
                <span className="cursor-grab select-none rounded px-2 py-1 text-[11px] text-stone-400 group-active:cursor-grabbing" data-testid="drag-handle">
                  拖动调序
                </span>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
