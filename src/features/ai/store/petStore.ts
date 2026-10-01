/* =============================================================================
   petStore.ts —— 状态管理（Zustand）
   管：宠物当前长什么样 / 章节进度 / BOSS 结果 / 徽章 / 术语图鉴 / 埋点查询
   ========================================================================== */

import { create } from 'zustand'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'
import { PET_NAMES } from '@/features/ai/pet/petState'
import type { BrainState } from '@/features/ai/lib/modelBrain'
import {
  analyzeFixStrategy,
  averageGap,
  countOf,
  resetEvents,
  type FixStrategy,
} from '@/features/ai/lib/track'
import { PERSONALITIES, type Personality } from '@/features/ai/data/petLines'

export type ChapterId = 'ch0' | 'ch1' | 'ch2' | 'ch3' | 'ch4' | 'card'

export interface BossResult {
  boss: string
  score: number
  total: number
  passed: boolean
}

interface PetState {
  /* 身份 */
  name: string
  /**
   * 名字是不是用户自己取的。
   * ★ 为什么需要它：store 初始化时会给一个随机名字（不能是空串），
   *   但"领养页"只在【还没取过名字】时才该出现。
   *   光看 name 是否为空判断不出来。
   */
  namingDone: boolean

  /* 外观 */
  body: BodyKind
  mood: Mood
  spots: number

  /* 能力 */
  brain: BrainState

  /* 进度 */
  chapter: ChapterId
  cleared: ChapterId[]
  bosses: BossResult[]
  badges: string[]

  /* 图鉴 */
  glossary: string[]

  /* 动作 */
  setName: (name: string) => void
  /** 用户取好名字了 */
  finishNaming: (name: string) => void
  setLook: (look: { body?: BodyKind; mood?: Mood; spots?: number }) => void
  setBrain: (brain: BrainState) => void
  goChapter: (chapter: ChapterId) => void
  clearChapter: (chapter: ChapterId, badge?: string) => void
  recordBoss: (result: BossResult) => void
  learnTerm: (term: string) => void
  reset: () => void
}

/** 随机给个名字：用户不改就用这个 */
function pickName(): string {
  return PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)]
}

export const usePetStore = create<PetState>((set, get) => ({
  name: pickName(),
  namingDone: false,

  body: 'blob',
  mood: 'confused',
  spots: 0,

  brain: 'untrained',

  chapter: 'ch0',
  cleared: [],
  bosses: [],
  badges: [],
  glossary: [],

  setName: (name) => set({ name }),

  finishNaming: (name) => set({ name, namingDone: true }),

  setLook: (look) =>
    set((s) => ({
      body: look.body ?? s.body,
      mood: look.mood ?? s.mood,
      spots: look.spots ?? s.spots,
    })),

  setBrain: (brain) => set({ brain }),

  goChapter: (chapter) => set({ chapter }),

  clearChapter: (chapter, badge) =>
    set((s) => ({
      cleared: s.cleared.includes(chapter) ? s.cleared : [...s.cleared, chapter],
      badges: badge && !s.badges.includes(badge) ? [...s.badges, badge] : s.badges,
    })),

  recordBoss: (result) => set((s) => ({ bosses: [...s.bosses, result] })),

  learnTerm: (term) => {
    if (get().glossary.includes(term)) return
    set((s) => ({ glossary: [...s.glossary, term] }))
  },

  reset: () => {
    resetEvents()
    set({
      name: pickName(),
  namingDone: false,
      body: 'blob',
      mood: 'confused',
      spots: 0,
      brain: 'untrained',
      chapter: 'ch0',
      cleared: [],
      bosses: [],
      badges: [],
      glossary: [],
    })
  },
}))

/* ---------------------------------------------------------------------------
   行为画像：从埋点里读出"这个人是怎么养它的"
   这是最终模型卡片上最值钱的部分 —— 它同时是一次复盘
   ------------------------------------------------------------------------ */

export interface BehaviorProfile {
  personality: Personality
  fixStrategy: FixStrategy
  paramCount: number
  feedCount: number
  dirtyFound: number
  overdoTried: boolean
  fastSubmit: boolean
}

export function buildProfile(): BehaviorProfile {
  const fixStrategy = analyzeFixStrategy()
  const paramCount = countOf('param_adjust')
  const feedCount = countOf('feed') + countOf('widen_sample')
  const dirtyFound = countOf('intruder_found')
  const overdoTried = countOf('overdo_press') > 0

  // 平均动作间隔很短 = 出手很快
  const fastSubmit = avgGapCached() < 1200

  let personality = PERSONALITIES.dataDoctor

  if (overdoTried && countOf('overdo_press') >= 2) {
    personality = PERSONALITIES.grinder
  } else if (dirtyFound >= 3) {
    personality = PERSONALITIES.detective
  } else if (fixStrategy === 'param_first') {
    personality = PERSONALITIES.knobBeliever
  } else if (fastSubmit) {
    personality = PERSONALITIES.rusher
  } else if (fixStrategy === 'data_first') {
    personality = PERSONALITIES.dataDoctor
  }

  return {
    personality,
    fixStrategy,
    paramCount,
    feedCount,
    dirtyFound,
    overdoTried,
    fastSubmit,
  }
}

function averageGapSafe(): number {
  return averageGap()
}

/** 埋点条数不够时不算"快"，避免开局误判成莽夫 */
function avgGapCached(): number {
  const total = countOf('feed') + countOf('param_adjust') + countOf('widen_sample')
  if (total < 8) return Number.POSITIVE_INFINITY
  return averageGapSafe()
}
