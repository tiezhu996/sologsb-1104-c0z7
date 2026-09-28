import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BlankPanel } from '../components/common/BlankPanel'
import { DrillHistory } from '../components/common/DrillHistory'
import { DrillStepTable, type DrillStepRow } from '../components/common/DrillStepTable'
import { useDrillStore } from '../stores/drillStore'
import { selectCurrentElapsed, selectStepElapsed, useDrillSessionStore } from '../stores/drillSessionStore'
import { useJointStore } from '../stores/jointStore'
import { useStepOrder } from '../hooks/useStepOrder'
import { deviationLevel, formatClock, formatDeviation, formatDuration, isOvertime } from '../utils/drillTimer'

export default function DrillTimer() {
  const { id: idParam } = useParams()
  const id = idParam ?? ''
  const joints = useJointStore((state) => state.joints)
  const loadAll = useJointStore((state) => state.loadAll)
  const { steps } = useStepOrder(id)
  const session = useDrillSessionStore((state) => state.session)
  const start = useDrillSessionStore((state) => state.start)
  const togglePause = useDrillSessionStore((state) => state.togglePause)
  const advanceStep = useDrillSessionStore((state) => state.advanceStep)
  const finish = useDrillSessionStore((state) => state.finish)
  const discard = useDrillSessionStore((state) => state.discard)
  const saveRound = useDrillStore((state) => state.saveRound)
  const [now, setNow] = useState(() => Date.now())
  const [savedNote, setSavedNote] = useState(false)

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // 250ms 节拍，仅在演练进行时驱动计时显示
  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [session])

  const joint = joints.find((item) => item.id === id)
  const activeHere = session?.jointTypeId === id ? session : null
  const otherSession = session && session.jointTypeId !== id ? session : null

  const currentStep = activeHere?.steps[activeHere.currentIndex]
  const currentElapsed = activeHere ? selectCurrentElapsed(activeHere, now) : 0
  const currentLevel = currentStep ? deviationLevel(currentElapsed, currentStep.holdSec) : null

  const handleFinish = async () => {
    if (!session || session.jointTypeId !== id) return
    const startedAt = session.startedAt
    const planSteps = steps
    const timings = finish()
    if (timings.length === 0 || planSteps.length !== timings.length) return
    await saveRound(id, startedAt, planSteps, timings)
    setSavedNote(true)
  }

  const rows = useMemo<DrillStepRow[]>(() => {
    if (!activeHere) return []
    return activeHere.steps.map((step, index) => {
      if (index > activeHere.currentIndex) {
        return {
          seq: step.seq, action: step.action, direction: step.direction, tool: step.tool,
          plannedSec: step.holdSec, actualSec: null,
        }
      }
      const elapsed = selectStepElapsed(activeHere, index, now)
      return {
        seq: step.seq, action: step.action, direction: step.direction, tool: step.tool,
        plannedSec: step.holdSec,
        actualSec: index === activeHere.currentIndex ? elapsed : Math.max(1, Math.round(elapsed)),
      }
    })
  }, [activeHere, now])

  const totalActual = activeHere
    ? activeHere.steps.reduce((sum, _step, index) => sum + selectStepElapsed(activeHere, index, now), 0)
    : 0
  const totalPlanned = activeHere?.steps.reduce((sum, step) => sum + step.holdSec, 0) ?? 0
  const isLastStep = activeHere ? activeHere.currentIndex >= activeHere.steps.length - 1 : false

  return (
    <div className="space-y-7" data-testid="drill-page">
      <div>
        <Link to={`/joints/${id}`} className="inline-flex items-center gap-1.5 text-sm text-wood-700 hover:underline">
          <span aria-hidden="true">←</span> 返回类型详情
        </Link>
      </div>

      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.24em] text-wood-500">DRILL TIMING</p>
          <h1 className="text-3xl font-bold tracking-tight text-wood-900 sm:text-4xl">{joint?.name ?? '榫卯'} · 演练计时</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
            开始后按拆装步序逐步记录实际耗时，暂停期间不计时；演练中步序拖动已锁定，避免对错步骤。
          </p>
        </div>
        {activeHere ? (
          <div className="rounded-xl border border-wood-100 bg-white px-5 py-3 text-sm text-stone-600 shadow-sm">
            第 <strong className="text-wood-700">{activeHere.currentIndex + 1}</strong> / {activeHere.steps.length} 步
            · 状态 <strong className={activeHere.phase === 'running' ? 'text-emerald-700' : 'text-amber-700'}>
              {activeHere.phase === 'running' ? '计时中' : '已暂停'}
            </strong>
          </div>
        ) : null}
      </section>

      {otherSession ? (
        <BlankPanel
          title="另一项榫卯的演练尚未结束"
          description="同一时间只进行一轮演练。请先回到原演练完成或放弃本轮，再开始新的计时。"
          action={<Link className="primary-button" to={`/joints/${otherSession.jointTypeId}/drill`}>回到进行中的演练</Link>}
        />
      ) : null}

      {steps.length === 0 && !activeHere ? (
        <BlankPanel title="当前类型尚无步骤" description="没有可计时的拆装动作，请先在步序编排页补充步骤。" />
      ) : null}

      {activeHere && currentStep ? (
        <>
          <section className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-wood-700 text-xl font-bold text-white">
                  {currentStep.seq}
                </span>
                <div>
                  <h2 className="text-2xl font-semibold text-wood-900">{currentStep.action} · {currentStep.direction}</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    使用 {currentStep.tool} · 计划停留 {currentStep.holdSec} 秒
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-5xl font-bold tracking-tight text-wood-900" data-testid="drill-current-clock">
                  {formatClock(currentElapsed)}
                </p>
                <p className={`mt-1 text-sm ${currentLevel && isOvertime(currentLevel) ? 'font-semibold text-rose-700' : 'text-stone-500'}`}>
                  {activeHere.phase === 'paused'
                    ? '已暂停，恢复后继续累计'
                    : `对比计划 ${formatDeviation(currentElapsed, currentStep.holdSec)}`}
                </p>
              </div>
            </div>

            {currentLevel === 'severe' && activeHere.phase === 'running' ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" data-testid="drill-severe-banner">
                本步已明显超出计划停留时间，注意检查是否卡住。
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className={activeHere.phase === 'running' ? 'secondary-button' : 'primary-button'}
                data-testid="drill-pause-toggle"
                onClick={togglePause}
              >
                {activeHere.phase === 'running' ? '暂停计时' : '开始 / 继续计时'}
              </button>
              {!isLastStep ? (
                <button
                  type="button"
                  className="secondary-button"
                  data-testid="drill-next-step"
                  onClick={advanceStep}
                >
                  完成本步，进入下一步
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  data-testid="drill-finish"
                  onClick={() => void handleFinish()}
                >
                  结束并保存本轮演练
                </button>
              )}
              <button
                type="button"
                className="ml-auto rounded-lg px-3 py-2.5 text-sm text-stone-500 hover:bg-stone-100"
                data-testid="drill-discard"
                onClick={discard}
              >
                放弃本轮
              </button>
            </div>
          </section>

          <section className="panel p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-wood-900">逐步计时明细</h2>
              <p className="text-xs text-stone-500">
                计划合计 {formatDuration(totalPlanned)} · 当前累计 {formatDuration(totalActual)}
              </p>
            </div>
            <DrillStepTable rows={rows} activeIndex={activeHere.currentIndex} />
            <p className="mt-3 text-xs leading-5 text-stone-500">
              <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">超时</span>
              表示比计划慢出较多，
              <span className="mx-1 rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-700">超时较多</span>
              表示实际耗时比计划多 5 秒以上或超出一倍，可据此回看卡壳的位置。
            </p>
          </section>
        </>
      ) : null}

      {!activeHere && !otherSession && steps.length > 0 ? (
        <>
          <section className="panel p-6 text-center sm:p-10">
            {savedNote ? (
              <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" data-testid="drill-saved-note">
                本轮演练结果已保存在当前榫卯类型中，可在下方或类型详情页翻看。
              </div>
            ) : null}
            <h2 className="text-xl font-semibold text-wood-900">准备开始一轮拆装演练</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">
              共 {steps.length} 步，计划总停留 {formatDuration(steps.reduce((sum, step) => sum + step.holdSec, 0))}。
              开始后第一步默认暂停，确认动作到位再点“开始计时”；中途可随时暂停。
            </p>
            <div className="mt-6">
              <button
                type="button"
                className="primary-button"
                data-testid="drill-start"
                onClick={() => {
                  setSavedNote(false)
                  start(id, steps)
                }}
              >
                {savedNote ? '再练一轮' : '开始演练'}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-wood-900">本类型的最近演练</h2>
            <DrillHistory jointTypeId={id} limit={5} showEntry={false} />
          </section>
        </>
      ) : null}
    </div>
  )
}
