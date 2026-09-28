import type { DragEvent } from 'react'
import type { DisassemblyStep } from '../../types/step'

interface StepRailProps {
  steps: DisassemblyStep[]
  currentIndex: number
  onSelect: (index: number) => void
  onMove: (from: number, to: number) => void
  /** 演练计时进行中锁定拖动，避免时间对错步骤 */
  dragLocked?: boolean
}

export function StepRail({ steps, currentIndex, onSelect, onMove, dragLocked = false }: StepRailProps) {
  const handleDrop = (event: DragEvent<HTMLElement>, to: number) => {
    event.preventDefault()
    if (dragLocked) return
    const from = Number(event.dataTransfer.getData('text/plain'))
    if (Number.isInteger(from)) onMove(from, to)
  }

  return (
    <div className="space-y-3" aria-label="拆装步骤轨道">
      {dragLocked ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="step-drag-lock">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          演练计时中，步序拖动已锁定，完成或放弃本轮后恢复调序。
        </div>
      ) : null}
      {steps.map((step, index) => (
        <article
          key={step.id}
          draggable={!dragLocked}
          onDragStart={(event) => {
            if (dragLocked) {
              event.preventDefault()
              return
            }
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', String(index))
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = dragLocked ? 'none' : 'move'
          }}
          onDrop={(event) => handleDrop(event, index)}
          className={`group rounded-xl border p-3 transition ${
            currentIndex === index
              ? 'border-wood-500 bg-wood-50 shadow-sm'
              : 'border-stone-200 bg-white hover:border-wood-100'
          } ${dragLocked ? 'cursor-default opacity-90' : ''}`}
          data-testid="step-row"
          aria-disabled={dragLocked}
        >
          <button
            type="button"
            onClick={() => onSelect(index)}
            className="flex w-full items-start gap-3 text-left"
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
              </span>
              <span className="mt-1 block text-xs leading-5 text-stone-500">{step.riskNote}</span>
              <span className="mt-1 block text-[11px] text-wood-700">停留 {step.holdSec} 秒</span>
            </span>
          </button>
          <div className="mt-2 flex justify-end">
            <span className={`select-none rounded px-2 py-1 text-[11px] ${
              dragLocked ? 'cursor-not-allowed text-stone-300' : 'cursor-grab text-stone-400 group-active:cursor-grabbing'
            }`}>
              {dragLocked ? '调序已锁定' : '拖动调序'}
            </span>
          </div>
        </article>
      ))}
    </div>
  )
}
