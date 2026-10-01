/* =============================================================================
   petState.ts —— 那只小生物"长什么样"的全部参数
   ---------------------------------------------------------------------------
   设计要点：不为每种形态画一张图，而是用「一组控制点 + 颜色 + 装饰」描述。
   改几个数字，形状就变。这是把美术工作量压下来的关键。
   ========================================================================== */

export type BodyKind = 'blob' | 'round' | 'fat' | 'box' | 'spiky' | 'healthy'

export type Mood =
  | 'idle'
  | 'happy'
  | 'confused'
  | 'smug'
  | 'hurt'
  | 'dead'
  | 'proud'

export interface Point {
  x: number
  y: number
}

export interface BodySpec {
  points: Point[]
  from: string
  to: string
  stroke: string
  defaultMood: Mood
}

/* ---------------------------------------------------------------------------
   六种身体，每种都带着"性格"：
     blob    开局一坨糊的（还没长开）
     round   正常可爱的圆滚身材
     fat     吃撑了，肚子鼓出来
     box     硬邦邦的方块（背下来了，没有余量）
     spiky   长刺、发红（被教坏了，很暴躁）
     healthy 成熟、匀称（长好了）
   ------------------------------------------------------------------------ */

export const BODIES: Record<BodyKind, BodySpec> = {
  blob: {
    // 一坨糊的：左右不对称、下边拖沓，看起来还没长开
    points: [
      { x: 100, y: 28 },
      { x: 160, y: 46 },
      { x: 176, y: 108 },
      { x: 140, y: 176 },
      { x: 74, y: 172 },
      { x: 28, y: 130 },
      { x: 44, y: 58 },
    ],
    from: '#cfd4dc',
    to: '#8e96a3',
    stroke: '#6b7280',
    defaultMood: 'confused',
  },
  round: {
    points: [
      { x: 100, y: 38 },
      { x: 150, y: 52 },
      { x: 162, y: 100 },
      { x: 150, y: 148 },
      { x: 100, y: 162 },
      { x: 50, y: 148 },
      { x: 38, y: 100 },
      { x: 50, y: 52 },
    ],
    from: '#ffffff',
    to: '#dfe4ec',
    stroke: '#9aa3b2',
    defaultMood: 'idle',
  },
  fat: {
    points: [
      { x: 100, y: 36 },
      { x: 156, y: 54 },
      { x: 174, y: 116 },
      { x: 148, y: 172 },
      { x: 84, y: 178 },
      { x: 30, y: 132 },
      { x: 40, y: 62 },
    ],
    from: '#fff4e6',
    to: '#f0c99a',
    stroke: '#c99a63',
    defaultMood: 'smug',
  },
  box: {
    points: [
      { x: 52, y: 42 },
      { x: 148, y: 42 },
      { x: 148, y: 158 },
      { x: 52, y: 158 },
    ],
    from: '#e8e2d5',
    to: '#c2b9a4',
    stroke: '#98907c',
    defaultMood: 'dead',
  },
  spiky: {
    points: [
      { x: 100, y: 26 },
      { x: 132, y: 44 },
      { x: 158, y: 34 },
      { x: 166, y: 74 },
      { x: 184, y: 96 },
      { x: 162, y: 128 },
      { x: 168, y: 166 },
      { x: 124, y: 162 },
      { x: 96, y: 184 },
      { x: 68, y: 158 },
      { x: 30, y: 162 },
      { x: 38, y: 122 },
      { x: 18, y: 92 },
      { x: 46, y: 68 },
      { x: 40, y: 32 },
      { x: 76, y: 46 },
    ],
    from: '#ffe3e3',
    to: '#f0a8a8',
    stroke: '#c96a6a',
    defaultMood: 'smug',
  },
  healthy: {
    points: [
      { x: 100, y: 32 },
      { x: 154, y: 50 },
      { x: 168, y: 100 },
      { x: 154, y: 150 },
      { x: 100, y: 168 },
      { x: 46, y: 150 },
      { x: 32, y: 100 },
      { x: 46, y: 50 },
    ],
    from: '#e8fff6',
    to: '#a9e6cf',
    stroke: '#5fb99a',
    defaultMood: 'proud',
  },
}

/* ---------------------------------------------------------------------------
   情绪 → 眼睛 / 嘴
   ------------------------------------------------------------------------ */

export interface FaceSpec {
  pupil: number
  eyeScaleY: number
  mouth: (y: number) => string
  extra?: 'sweat' | 'sparkle' | 'bandage' | 'blush'
  /** 瞳孔横向拉伸：>1 显呆，<1 显眯 */
  pupilWide?: number
}

const smile = (y: number) => `M 84 ${y} Q 100 ${y + 13} 116 ${y}`
const flat = (y: number) => `M 86 ${y + 2} L 114 ${y + 2}`
const frown = (y: number) => `M 84 ${y + 10} Q 100 ${y - 3} 116 ${y + 10}`
const openO = (y: number) => `M 92 ${y} Q 100 ${y + 18} 108 ${y} Q 100 ${y + 6} 92 ${y} Z`
const smugMouth = (y: number) => `M 84 ${y + 4} Q 104 ${y + 12} 118 ${y - 3}`
const wavy = (y: number) => `M 84 ${y} q 8 -7 16 0 q 8 7 16 0`

/* 情绪区分要够明显，否则用户分不出它在高兴还是得意：
     smug   —— 眯着眼、有腮红、嘴角歪（"我厉害吧"）
     proud  —— 眼睛亮而圆、没有腮红、笑得大方（"我做到了"）
     dead   —— 眼睛变成一道缝（僵住了）
     hurt   —— 瞳孔缩成一点、贴创可贴
     confused —— 浓眉下垂 + 一滴汗 + 波浪嘴
   ─────────────────────────────────────────────────────── */
export const FACES: Record<Mood, FaceSpec> = {
  idle: { pupil: 7, eyeScaleY: 1, mouth: smile },
  happy: { pupil: 8.5, eyeScaleY: 1, mouth: openO, extra: 'sparkle' },
  confused: {
    pupil: 5,
    eyeScaleY: 1.15,
    mouth: wavy,
    extra: 'sweat',
    pupilWide: 0.85,
  },
  smug: { pupil: 5.5, eyeScaleY: 0.45, mouth: smugMouth, extra: 'blush' },
  hurt: { pupil: 3, eyeScaleY: 1.4, mouth: frown, extra: 'bandage' },
  dead: { pupil: 0, eyeScaleY: 0.18, mouth: flat },
  proud: { pupil: 8, eyeScaleY: 1.05, mouth: smile, extra: 'sparkle' },
}

/** 情绪 → CSS 动画名（定义在 pet.css） */
export const MOOD_ANIM: Record<Mood, string> = {
  idle: 'pet-bob',
  happy: 'pet-hop',
  confused: 'pet-tilt',
  smug: 'pet-sway',
  hurt: 'pet-shake',
  dead: 'none',
  proud: 'pet-breathe',
}

export const PET_NAMES = [
  '小灰灰',
  '阿模',
  '团团',
  '毕设',
  '小卷',
  '参参',
  '阿凡',
  '豆豆',
]
