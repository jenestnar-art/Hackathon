/* =============================================================================
   chapters.ts —— 五章配置
   加一章、改一章只动这个文件，界面不用改。
   ========================================================================== */

import type { BodyKind, Mood } from '@/features/ai/pet/petState'
import type { BrainState } from '@/features/ai/lib/modelBrain'
import type { ChapterId } from '@/features/ai/store/petStore'

export interface BossSpec {
  name: string
  /** BOSS 放的样本（数字序列） */
  digits: number[]
  /** 每个数字出几个 */
  perDigit: number
  taunt: string
  /** 过关线（答对比例） */
  passRatio: number
}

export interface ChapterSpec {
  id: ChapterId
  order: string
  title: string
  subtitle: string
  goal: string
  /** 这一章教的一个词 */
  term: string
  /** 章节开始时宠物的样子 */
  startLook: { body: BodyKind; mood: Mood; spots?: number }
  /** 章节开始时的大脑状态 */
  startBrain: BrainState
  /** 通关后宠物的样子 */
  endLook: { body: BodyKind; mood: Mood; spots?: number }
  /** 通关后的大脑状态 */
  endBrain: BrainState
  badge: string
  boss: BossSpec
}

export const CHAPTERS: ChapterSpec[] = [
  {
    id: 'ch0',
    order: '00',
    title: '开局一只啥也不会的',
    subtitle: '它连 1 和 7 都分不清',
    goal: '喂它足够的样本，让它第一次认出你自己写的字',
    term: '样本',
    startLook: { body: 'blob', mood: 'confused' },
    startBrain: 'untrained',
    endLook: { body: 'round', mood: 'happy' },
    endBrain: 'fledgling',
    badge: '启蒙者',
    boss: {
      name: '五五开',
      digits: [1, 7, 4, 0, 3, 6, 8, 1, 4, 7],
      perDigit: 1,
      taunt: '你连 1 和 7 都分不清，也好意思出来混？',
      passRatio: 0.7,
    },
  },
  {
    id: 'ch1',
    order: '01',
    title: '它偏食了',
    subtitle: '6 和 8 它一口没吃过',
    goal: '把它认不出的数字喂饱',
    term: '数据不平衡',
    startLook: { body: 'fat', mood: 'smug' },
    startBrain: 'biased',
    endLook: { body: 'round', mood: 'proud' },
    endBrain: 'balanced',
    badge: '数据医生',
    boss: {
      name: '六八不分',
      digits: [6, 8, 6, 8, 6, 8, 6, 6, 8, 8],
      perDigit: 1,
      taunt: '我出十个 6 和 8，看它能接住几个。',
      passRatio: 0.8,
    },
  },
  {
    id: 'ch2',
    order: '02',
    title: '它只会做原题',
    subtitle: '换个写法它就不认了',
    goal: '让它认得各种写法的同一个数字',
    term: '过拟合',
    startLook: { body: 'box', mood: 'dead' },
    startBrain: 'overfit',
    endLook: { body: 'healthy', mood: 'proud' },
    endBrain: 'generalized',
    badge: '吹哨人',
    boss: {
      name: '歪七扭八',
      digits: [7, 4, 9, 7, 4, 9, 1, 7, 4, 9],
      perDigit: 1,
      taunt: '我出十个手写体的 7、4、9，字写得丑你别怪我。',
      passRatio: 0.7,
    },
  },
  {
    id: 'ch3',
    order: '03',
    title: '它被人教坏了',
    subtitle: '有人在数据里动了手脚',
    goal: '把标错标签的样本揪出来',
    term: '数据质量',
    startLook: { body: 'spiky', mood: 'smug', spots: 5 },
    startBrain: 'poisoned',
    endLook: { body: 'healthy', mood: 'proud', spots: 0 },
    endBrain: 'clean',
    badge: '内鬼猎人',
    boss: {
      name: '内鬼样本',
      digits: [3, 8, 3, 8, 3, 8, 3, 3, 8, 8],
      perDigit: 1,
      taunt: '我混在四十张图里，你找得出我吗？',
      passRatio: 0.8,
    },
  },
  {
    id: 'ch4',
    order: '04',
    title: '出道',
    subtitle: '最后一次考试，题目它一道都没见过',
    goal: '通过真实现场测试',
    term: '泛化',
    startLook: { body: 'healthy', mood: 'idle' },
    startBrain: 'clean',
    endLook: { body: 'healthy', mood: 'proud' },
    endBrain: 'healthy',
    badge: '出师',
    boss: {
      name: '真实现场',
      digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      perDigit: 1,
      taunt: '这里没有工整的字，也没有你做过的题。',
      passRatio: 0.8,
    },
  },
]

export function getChapter(id: ChapterId): ChapterSpec | undefined {
  return CHAPTERS.find((c) => c.id === id)
}

/** 下一个章节（用于"进入下一关"按钮） */
export function nextChapter(id: ChapterId): ChapterId {
  const idx = CHAPTERS.findIndex((c) => c.id === id)
  if (idx < 0 || idx === CHAPTERS.length - 1) return 'card'
  return CHAPTERS[idx + 1].id
}
