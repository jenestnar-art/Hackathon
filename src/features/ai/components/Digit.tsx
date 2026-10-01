/* =============================================================================
   digits.tsx —— 手写风格的数字
   ---------------------------------------------------------------------------
   为什么不用字体？
     1. 字体渲染出来的数字太"印刷体"，看着不像手写
     2. 第 2 章要造"歪的、粗的、细的、带毛边的"样本 —— 用笔画路径可以随意变形
     3. 零资源文件，不增加任何下载量
   坐标系：60 x 90（竖长），stroke 画法，linecap 圆头，看起来像笔写的。
   ========================================================================== */

import type { CSSProperties } from 'react'

/** 每个数字由若干条笔画组成，每条笔画是一段 SVG path */
const STROKES: Record<number, string[]> = {
  0: ['M 30 12 C 12 12 8 34 8 45 C 8 62 14 80 30 80 C 46 80 52 62 52 45 C 52 34 48 12 30 12 Z'],
  1: ['M 22 26 L 34 14 L 34 80'],
  2: ['M 12 30 C 14 16 30 10 38 18 C 47 27 30 46 10 78 L 52 78'],
  3: ['M 14 22 C 24 8 48 12 46 28 C 44 42 30 44 24 45 C 36 45 52 50 50 68 C 48 84 20 88 10 74'],
  4: ['M 40 12 L 12 58 L 52 58', 'M 40 34 L 40 80'],
  5: ['M 46 14 L 18 14 L 14 42 C 26 36 48 40 48 60 C 48 80 24 86 12 72'],
  6: ['M 44 16 C 30 20 18 34 16 54 C 14 74 24 86 34 84 C 46 82 50 68 46 58 C 42 48 26 46 18 56'],
  7: ['M 10 16 L 50 16', 'M 48 16 L 26 82'],
  8: [
    'M 30 44 C 14 40 14 18 30 14 C 46 18 46 40 30 44 Z',
    'M 30 44 C 10 48 10 80 30 84 C 50 80 50 48 30 44 Z',
  ],
  9: ['M 16 76 C 30 72 42 58 44 38 C 46 18 36 6 26 8 C 14 10 10 24 14 34 C 18 44 34 46 42 36'],
}

export type DigitStyle = 'normal' | 'tilted' | 'bold' | 'thin' | 'messy'

interface DigitProps {
  value: number
  size?: number
  /** 变形风格 */
  style?: DigitStyle
  color?: string
  className?: string
}

/** 每种变形风格对应的渲染参数 */
const STYLE_MAP: Record<
  DigitStyle,
  { rotate: number; strokeWidth: number; opacity: number; dash?: string }
> = {
  normal: { rotate: 0, strokeWidth: 5, opacity: 1 },
  tilted: { rotate: -28, strokeWidth: 5, opacity: 1 },
  bold: { rotate: 3, strokeWidth: 9, opacity: 1 },
  thin: { rotate: -4, strokeWidth: 1.6, opacity: 0.95 },
  messy: { rotate: 6, strokeWidth: 5, opacity: 0.85, dash: '14 5 6 4' },
}

export function Digit({
  value,
  size = 64,
  style = 'normal',
  color = '#12201e',
  className,
}: DigitProps) {
  const strokes = STROKES[value] ?? STROKES[0]
  const spec = STYLE_MAP[style]
  const height = size * 1.5

  const wrapStyle: CSSProperties = {
    display: 'inline-block',
    lineHeight: 0,
  }

  return (
    <span className={className} style={wrapStyle}>
      <svg
        viewBox="0 0 60 90"
        width={size}
        height={height}
        role="img"
        aria-label={`数字 ${value}`}
      >
        <g
          transform={`rotate(${spec.rotate} 30 45)`}
          fill="none"
          stroke={color}
          strokeWidth={spec.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={spec.dash}
          opacity={spec.opacity}
        >
          {strokes.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </svg>
    </span>
  )
}

/** 数字的汉字读法（台词里偶尔用得上） */
export const DIGIT_CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * 生成一串测试样本，每个样本带一种变形风格。
 * BOSS 战和考试都用它 —— 风格随机，模拟真实世界的杂乱。
 */
export interface TestSample {
  id: number
  truth: number
  style: DigitStyle
}

export function buildSamples(digits: number[], rng = Math.random): TestSample[] {
  const styles: DigitStyle[] = ['normal', 'normal', 'tilted', 'bold', 'thin', 'messy']
  return digits.map((truth, id) => ({
    id,
    truth,
    style: styles[Math.floor(rng() * styles.length)],
  }))
}

/** 打乱 */
export function shuffleSamples(list: TestSample[], rng = Math.random): TestSample[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/* ---------------------------------------------------------------------------
   字迹难度：第 0 章的字都很工整，越往后 BOSS 的字越潦草。
   —— 难度要靠"题目变难"来体现，而不是靠调随机数。
   ------------------------------------------------------------------------ */

export type StyleBias = 'neat' | 'normal' | 'messy'

const STYLE_POOLS: Record<StyleBias, DigitStyle[]> = {
  neat: ['normal', 'normal', 'normal', 'bold'],
  normal: ['normal', 'normal', 'tilted', 'bold', 'thin'],
  messy: ['tilted', 'messy', 'thin', 'messy', 'tilted'],
}

export function buildStyledSamples(
  digits: number[],
  bias: StyleBias = 'normal',
  rng = Math.random
): TestSample[] {
  const pool = STYLE_POOLS[bias]
  return digits.map((truth, id) => ({
    id,
    truth,
    style: pool[Math.floor(rng() * pool.length)],
  }))
}