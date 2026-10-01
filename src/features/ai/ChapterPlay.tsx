/* =============================================================================
   ChapterPlay.tsx —— 章节调度器
   ---------------------------------------------------------------------------
   结构：
     ChapterPlay      决定"现在演哪一章"，并把"上一章收尾的形态"传给新章节
     ChapterRunner    通用元流程（领养 → 开场 → 玩法 → BOSS → 变形 → 收口）
     chapters/ChapterN.tsx  各自的状态 + 玩法编排

   加一章 = 写一个 chapters/ChapterN.tsx + 在 chapters.ts 里加配置。

   ★ 章节之间的过渡怎么演的（两层，叠加使用）：
     ① 全屏【镜头推进】—— 巨大的章节号从极远处冲过来、穿过镜头。
        它负责"换场景"：把观众从上一章拔出来，带进新一章。
     ② 新章节开场的【形态交接】—— 上一章那只向上浮走，这一章这只从下面升起来。
        它负责"换形态"：交代"上一章的结果变成了现在这只"。

     顺序很重要：① 先演完，② 才开始。否则形态交接会被遮罩挡住，白演一遍。
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chapter0 } from '@/features/ai/chapters/Chapter0'
import { Chapter1 } from '@/features/ai/chapters/Chapter1'
import { Chapter2 } from '@/features/ai/chapters/Chapter2'
import { Chapter3 } from '@/features/ai/chapters/Chapter3'
import { Chapter4 } from '@/features/ai/chapters/Chapter4'
import { ModelCardPage } from '@/features/ai/ModelCardPage'
import { ChapterTransition } from '@/features/ai/components/ChapterTransition'
import { getChapter } from '@/features/ai/data/chapters'
import { stageByProgress, stageAt } from '@/features/ai/games/chapter0'
import { usePetStore, type ChapterId } from '@/features/ai/store/petStore'
import type { BodyKind } from '@/features/ai/pet/petState'

/** 全屏镜头推进的总时长，要和 ChapterTransition 的 duration 一致 */
const TRANSITION_MS = 2600

/**
 * ★ 算出某一章【收尾时它长什么样】。
 *
 * 为什么要这个纯函数：切章那一刻，上一章的组件已经被卸载了，
 * 没法问它"你最后是什么形态"。所以按同样的规则重算一遍。
 *
 * 规则必须和 ChapterRunner 里的一致：
 *   petBody 有值 → 一直是它
 *   petBody 没有 → 按喂食比例分阶段长大，收尾时是最后一阶段
 */
function chapterEndForm(id: ChapterId): BodyKind | undefined {
  const spec = getChapter(id)
  if (!spec) return undefined

  /* 标着固定形态的章节：收尾就是它 */
  const FIXED: Partial<Record<ChapterId, BodyKind>> = {
    ch1: 'fat',
    ch2: 'box',
    ch3: 'spiky',
    ch4: 'healthy',
  }
  if (FIXED[id]) return FIXED[id]
  if (id === 'ch0') {
    // 第 0 章没有固定形态，按喂食比例分阶段 → 喂满时是最后一阶段
    return stageAt(stageByProgress(1, 1)).body
  }
  void spec
  return undefined
}

export function ChapterPlay({ onExit }: { onExit?: () => void }) {
  const stored = usePetStore((s) => s.chapter)
  const resetPet = usePetStore((s) => s.reset)
  const navigate = useNavigate()
  const location = useLocation()

  /* ★ 这个组件同时挂在两个地方：
       /tracks/ai  —— 产品里的正式入口，要给"返回方向选择"
       /_play      —— 开发时免登录直达，不要那个按钮
     靠路由自己判断，这样整合时调用方什么都不用传。 */
  const embedded = location.pathname.startsWith('/tracks/')
  const exit = onExit ?? (embedded ? () => navigate('/') : undefined)

  const [current, setCurrent] = useState<ChapterId>(stored || 'ch0')
  /**
   * ★ 上一章结束时的形态 —— 新章节开场用它演"形态交接"。
   * 怎么算出来的：在这章还没切走之前，先把它【收尾时长什么样】记下来，
   * 切过去之后就把这个值当作"往上浮走的那只"。
   */
  const [handoffFrom, setHandoffFrom] = useState<BodyKind | undefined>(undefined)
  const prevChapterRef = useRef<ChapterId>(current)
  /**
   * ★ 全屏镜头推进：切章时盖一层，演完自动收起。
   * 它演完之后，新章节开场的"形态交接"才开始 —— 两者是先后关系，
   * 不然形态交接会被遮罩挡住，等于白演。
   */
  const [transition, setTransition] = useState<{
    order: string
    title: string
    subtitle: string
  } | null>(null)
  /** 镜头推进是否已经演完（演完才允许开场播形态交接） */
  const [stageReady, setStageReady] = useState(true)
  const firstLoad = useRef(true)

  /* ★ 必须订阅 store：章节内部用 goChapter 切章时这里要跟着换。
     只在挂载时读一次的话，点"进入下一章"会毫无反应。 */
  useEffect(() => {
    if (!stored || stored === current) return

    const spec = getChapter(stored)

    /* 记下"上一章收尾时的样子"。
       注意不能问上一章的 ChapterRunner —— 它已经被卸载了。
       所以用一个纯函数按同样的规则重算一遍（见 chapterEndForm）。 */
    const from = chapterEndForm(prevChapterRef.current)
    prevChapterRef.current = stored

    setHandoffFrom(from)
    setCurrent(stored)

    /* 首次加载不播镜头推进；真正切章才播 */
    if (!firstLoad.current && spec) {
      setStageReady(false)
      setTransition({ order: spec.order, title: spec.title, subtitle: spec.subtitle })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored])

  useEffect(() => {
    firstLoad.current = false
  }, [])

  /* ★ 'card'（模型身份证）不是一章，它不在 CHAPTERS 里，
     所以必须在 getChapter 之前拦下来 —— 否则会掉进下面"还没有工作台"的兜底。
     踩过的坑：以前把它写在最后的渲染分支里，结果永远走不到。 */
  if (current === 'card') {
    return (
      <ModelCardPage
        onRestart={() => {
          resetPet()
          setCurrent('ch0')
        }}
      />
    )
  }

  const spec = getChapter(current)

  if (!spec) {
    return (
      <div className="grid min-h-screen place-items-center bg-body text-lcd-ink">
        <div className="text-center">
          <p className="text-sm text-lcd-ink/60">这一章还没有工作台。</p>
          {exit && (
            <button
              type="button"
              onClick={exit}
              className="mt-4 rounded-full border border-lcd-ink/12 bg-screen-3 px-5 py-3 text-sm"
            >
              返回
            </button>
          )}
        </div>
      </div>
    )
  }

  /* 每一章都带上 fromBody —— 新章节开场时演"旧的浮上去、新的升起来"。
     handoffReady 控制它什么时候开始：必须等全屏镜头推进演完。 */
  const shared = {
    onExit: exit,
    onChapterChange: setCurrent,
    fromBody: handoffFrom,
    handoffReady: stageReady,
  }

  return (
    <>
      {/* ★ 第一层：全屏镜头推进（换场景） */}
      {transition && (
        <ChapterTransition
          order={transition.order}
          title={transition.title}
          subtitle={transition.subtitle}
          duration={TRANSITION_MS}
          onDone={() => {
            setTransition(null)
            setStageReady(true)
          }}
        />
      )}

      {current === 'ch0' ? (
        <Chapter0 {...shared} />
      ) : current === 'ch1' ? (
        <Chapter1 {...shared} />
      ) : current === 'ch2' ? (
        <Chapter2 {...shared} />
      ) : current === 'ch3' ? (
        <Chapter3 {...shared} />
      ) : current === 'ch4' ? (
        <Chapter4 {...shared} />
      ) : (
        /* ★ 兜底必须【明确报错】，不能默认渲染某一章。
           踩过的坑：以前兜底是 <Chapter0 />，于是第 2 章点"进入下一章"之后
           因为 ch3 还没做，就落进兜底又演了一遍第 0 章 —— 用户看到的是
           "第 0 章和第 1 章无限循环"，查了半天才知道是兜底在骗人。 */
        <div className="grid min-h-screen place-items-center bg-body px-6 text-center text-lcd-ink">
          <div>
            <p className="text-sm font-semibold">这一章还没有做出来（{current}）</p>
            <p className="mt-2 text-xs text-lcd-ink/45">
              别把它当成上一章重复演了 —— 这是缺少内容，不是循环。
            </p>
            {exit && (
              <button
                type="button"
                onClick={exit}
                className="mt-5 rounded-full border border-lcd-ink/12 bg-screen-3 px-5 py-3 text-sm"
              >
                返回
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
