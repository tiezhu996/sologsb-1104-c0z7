import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BlankPanel } from '../components/common/BlankPanel'
import { StepRail } from '../components/common/StepRail'
import { SvgCanvas } from '../components/common/SvgCanvas'
import { useDrillRun } from '../hooks/useDrillRun'
import { useStepOrder } from '../hooks/useStepOrder'
import { useDiagramStore } from '../stores/diagramStore'
import { useDrillStore } from '../stores/drillStore'
import { useJointStore } from '../stores/jointStore'
import type { DrillSession } from '../types/drill'
import { formatSec, formatSignedSec, isStepOverrun } from '../utils/timing'

export default function StepBoard() {
  const { id: idParam } = useParams()
  const id = idParam ?? ''
  const joints = useJointStore((state) => state.joints)
  const loadAll = useJointStore((state) => state.loadAll)
  const diagrams = useDiagramStore((state) => state.diagrams)
  const selectedMemberId = useDiagramStore((state) => state.selectedMemberId)
  const loadDiagrams = useDiagramStore((state) => state.loadDiagrams)
  const setSelectedMember = useDiagramStore((state) => state.setSelectedMember)
  const sessions = useDrillStore((state) => state.sessions)
  const loadByJoint = useDrillStore((state) => state.loadByJoint)
  const addSession = useDrillStore((state) => state.addSession)
  const { steps, totalDurationSec, currentStepIndex, move, setCurrentStep } = useStepOrder(id)

  const handleFinish = async (session: DrillSession): Promise<void> => {
    await addSession(session)
  }
  const drill = useDrillRun({ steps, onFinish: handleFinish })
  const drillActive = drill.phase !== 'idle'

  useEffect(() => {
    void loadAll()
    if (id) void loadDiagrams(id)
    if (id) void loadByJoint(id)
  }, [id, loadAll, loadDiagrams, loadByJoint])

  // 演练进行中，右侧预览始终跟随当前计时步骤，点选与拖动都被挡住。
  useEffect(() => {
    if (drillActive) setCurrentStep(drill.currentStepIndex)
  }, [drillActive, drill.currentStepIndex, setCurrentStep])

  const joint = joints.find((item) => item.id === id)
  const currentStep = steps[currentStepIndex]
  const currentDiagram = diagrams.find((diagram) => diagram.stepId === currentStep?.id) ?? diagrams[0]
  const latestSession = sessions[0]

  const idleActuals = useMemo(() => {
    if (!latestSession) return []
    return latestSession.records.map((record) => ({ stepId: record.stepId, actualSec: record.actualSec }))
  }, [latestSession])

  const railActuals = drillActive
    ? drill.actuals
    : idleActuals

  const isLastStep = drill.currentStepIndex >= steps.length - 1
  const liveOverrun = isStepOverrun(currentStep?.holdSec ?? 0, drill.currentStepElapsedSec)

  const confirmDiscard = () => {
    if (window.confirm('结束并丢弃本轮演练？已记录的逐步耗时不会保存。')) drill.discard()
  }

  return (
    <div className="space-y-7">
      <div>
        <Link to={`/joints/${id}`} className="inline-flex items-center gap-1.5 text-sm text-wood-700 hover:underline">
          <span aria-hidden="true">←</span> 返回类型详情
        </Link>
      </div>

      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.24em] text-wood-500">STEP SEQUENCE</p>
          <h1 className="text-3xl font-bold tracking-tight text-wood-900 sm:text-4xl">{joint?.name ?? '榫卯'} · 拆装步序编排</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
            拖动左侧步骤调整真实顺序，右侧同步查看每一步的示意图和风险提醒；开始演练后将逐步记录实际耗时。
          </p>
        </div>
        <div className="rounded-xl border border-wood-100 bg-white px-5 py-3 text-sm text-stone-600 shadow-sm">
          {steps.length} 步 · 计划总停留 <strong className="text-wood-700">{totalDurationSec}</strong> 秒
        </div>
      </section>

      {steps.length === 0 ? (
        <BlankPanel title="当前类型尚无步骤" description="没有可编排、可演练的拆装动作，请先补充步骤数据。" />
      ) : (
        <>
          <DrillConsole
            phase={drill.phase}
            stepLabel={currentStep ? `第 ${currentStep.seq} 步 · ${currentStep.action} ${currentStep.direction}` : '步骤'}
            stepIndex={drill.currentStepIndex}
            stepCount={steps.length}
            currentElapsedSec={drill.currentStepElapsedSec}
            totalElapsedSec={drill.totalElapsedSec}
            plannedCurrentSec={currentStep?.holdSec ?? 0}
            isLastStep={isLastStep}
            liveOverrun={liveOverrun}
            latestSession={latestSession}
            onStart={() => {
              setCurrentStep(0)
              drill.start()
            }}
            onTogglePause={drill.togglePause}
            onNext={drill.next}
            onFinish={drill.finish}
            onDiscard={confirmDiscard}
          />

          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="panel max-h-[720px] overflow-y-auto p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-wood-900">步骤轨道</h2>
                  <p className="mt-1 text-xs text-stone-500">
                    {drillActive ? '演练计时中，步序与点选已锁定' : '拖动任意步骤到目标位置'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${
                  drillActive ? 'bg-amber-100 text-amber-800' : 'bg-wood-50 text-wood-700'
                }`}>
                  {drillActive ? '计时中 · 已锁定' : '自动保存'}
                </span>
              </div>
              <StepRail
                steps={steps}
                currentIndex={currentStepIndex}
                actuals={railActuals}
                dragLocked={drillActive}
                onSelect={setCurrentStep}
                onMove={(from, to) => void move(from, to)}
              />
            </section>

            <section className="space-y-5">
              <div className="panel p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-wood-700 text-lg font-bold text-white">
                    {currentStep?.seq ?? 0}
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold text-wood-900">{currentStep?.action ?? '步骤'} · {currentStep?.direction ?? '方向'}</h2>
                    <p className="mt-1 text-xs text-stone-500">使用工具：{currentStep?.tool ?? '待补充'} · 计划停留 {currentStep?.holdSec ?? 0} 秒</p>
                  </div>
                  {drillActive ? (
                    <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${
                      drill.phase === 'paused' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                    }`} data-testid="drill-status">
                      {drill.phase === 'paused' ? '已暂停 · 计时冻结' : '计时中'} · 本步 {formatSec(drill.currentStepElapsedSec)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-900">易损部位提醒</p>
                  <p className="mt-1 text-sm leading-6 text-amber-900/80">{currentStep?.riskNote ?? '暂无提醒'}</p>
                </div>
              </div>

              <SvgCanvas
                svgMarkup={currentDiagram?.svgMarkup ?? ''}
                title={currentDiagram?.title ?? '步骤预览'}
                hitAreas={currentDiagram?.hitAreas ?? []}
                selectedMemberId={selectedMemberId}
                onSelectMember={setSelectedMember}
                emptyMessage="该步骤暂未绑定示意图"
              />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

interface DrillConsoleProps {
  phase: ReturnType<typeof useDrillRun>['phase']
  stepLabel: string
  stepIndex: number
  stepCount: number
  currentElapsedSec: number
  totalElapsedSec: number
  plannedCurrentSec: number
  isLastStep: boolean
  liveOverrun: boolean
  latestSession?: DrillSession
  onStart: () => void
  onTogglePause: () => void
  onNext: () => void
  onFinish: () => void
  onDiscard: () => void
}

function DrillConsole({
  phase,
  stepLabel,
  stepIndex,
  stepCount,
  currentElapsedSec,
  totalElapsedSec,
  plannedCurrentSec,
  isLastStep,
  liveOverrun,
  latestSession,
  onStart,
  onTogglePause,
  onNext,
  onFinish,
  onDiscard,
}: DrillConsoleProps) {
  const progressPct = stepCount > 0 ? Math.round((stepIndex / stepCount) * 100) : 0

  if (phase === 'idle') {
    const latestDeviation = latestSession ? latestSession.actualTotalSec - latestSession.plannedTotalSec : null
    return (
      <section className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="drill-console">
        <div>
          <h2 className="text-lg font-semibold text-wood-900">演练计时</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            开始后逐步记录每一步的实际耗时，<strong className="text-stone-800">暂停期间不计时</strong>；演练中拖动步序会被锁定，避免对错步骤。
          </p>
          {latestSession ? (
            <p className="mt-2 text-xs text-stone-500">
              上一轮：实际 {formatSec(latestSession.actualTotalSec)}，偏差
              <strong className={`ml-1 ${latestDeviation !== null && latestDeviation > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {formatSignedSec(latestDeviation)}
              </strong>
              {latestSession.overrunStepCount > 0 ? ` · ${latestSession.overrunStepCount} 步超时较多` : ''}
            </p>
          ) : (
            <p className="mt-2 text-xs text-stone-400">当前类型还没有演练记录，旧数据未记录计时也可照常浏览。</p>
          )}
        </div>
        <button type="button" className="primary-button shrink-0" data-testid="drill-start" onClick={onStart}>
          <span aria-hidden="true">▶</span> 开始演练
        </button>
      </section>
    )
  }

  return (
    <section className="panel space-y-4 border-wood-500 p-5" data-testid="drill-console">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-wood-500">
            {phase === 'paused' ? 'PAUSED' : 'DRILLING'} · {stepIndex + 1}/{stepCount}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-wood-900">{stepLabel}</h2>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-[11px] text-stone-500">本步计划</p>
            <strong className="text-stone-700">{plannedCurrentSec} 秒</strong>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-stone-500">本步实际</p>
            <strong
              className={`font-mono text-xl tabular-nums ${liveOverrun ? 'text-rose-700' : 'text-wood-700'}`}
              data-testid="drill-current-elapsed"
            >
              {formatSec(currentElapsedSec)}
            </strong>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-stone-500">累计实际</p>
            <strong className="font-mono text-xl tabular-nums text-stone-800" data-testid="drill-total-elapsed">
              {formatSec(totalElapsedSec)}
            </strong>
          </div>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-all ${liveOverrun ? 'bg-rose-400' : 'bg-wood-500'}`}
          style={{ width: `${Math.max(progressPct, 4)}%` }}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="secondary-button" onClick={onDiscard}>终止并丢弃</button>
        <button
          type="button"
          className="secondary-button"
          data-testid="drill-pause"
          onClick={onTogglePause}
        >
          {phase === 'paused' ? '继续计时' : '暂停'}
        </button>
        {isLastStep ? (
          <button
            type="button"
            className="primary-button"
            data-testid="drill-finish"
            disabled={phase === 'paused'}
            onClick={onFinish}
          >
            结束并保存本轮
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            data-testid="drill-next"
            disabled={phase === 'paused'}
            onClick={onNext}
          >
            完成本步，进入下一步
          </button>
        )}
      </div>
    </section>
  )
}
