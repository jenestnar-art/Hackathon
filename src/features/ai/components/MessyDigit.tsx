/* =============================================================================
   MessyDigit.tsx —— "写歪了的"数字
   ---------------------------------------------------------------------------
   为什么需要它：
     第 0 章和第 1 章的数字都是工整的。第 2 章要讲"换个写法它就不认"，
     就必须真的画出【同一个数字的不同写法】，否则这个道理讲不出来。

   做法：
     拿工整数字的路径，按变形的类型做仿射变换 ——
       歪着写：斜切 + 旋转
       拉长写：纵向拉伸 + 轻微旋转
       潦草写：横向挤压 + 加粗描边
     再加一点由 id 决定的抖动，让每一张都略有不同。

     抖动用【确定性伪随机】（从 id 算），不用 Math.random ——
     否则每次重渲染都会变，动画和重绘会互相干扰。
   ========================================================================== */

import { Digit, type DigitStyle } from '@/features/ai/components/Digit'
import type { VariantKind } from '@/features/ai/games/overfitRules'

/** 由字符串算出稳定的 0~1 伪随机序列 */
function seeded(seed: string, index: number): number {
  let h = 2166136261
  const s = `${seed}#${index}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // 取低位映射到 0~1
  return ((h >>> 8) % 1000) / 1000
}

/** 把 -1~1 的偏移映射成 0~1 的"抖动幅度" */
function jitter(seed: string, index: number, amount: number): number {
  return (seeded(seed, index) - 0.5) * 2 * amount
}

interface MessyDigitProps {
  value: number
  /** 变形类型；不传就是工整的 */
  kind?: VariantKind
  /** 抖动的种子，用 variant.id 或手写样本的 id */
  seed?: string
  size?: number
  color?: string
  /** 手写样本：直接用 messy 风格 + 更强的抖动 */
  handwritten?: boolean
}

/**
 * 根据变形类型算出 CSS transform。
 */
function transformFor(kind: VariantKind | undefined, seed: string, handwritten: boolean) {
  if (kind === 'tilt') {
    const rot = jitter(seed, 1, 13)
    const skew = jitter(seed, 2, 9)
    return `rotate(${rot.toFixed(2)}deg) skewX(${skew.toFixed(2)}deg)`
  }
  if (kind === 'stretch') {
    const sy = 1.16 + jitter(seed, 3, 0.12)
    const sx = 0.9 + jitter(seed, 4, 0.08)
    const rot = jitter(seed, 5, 6)
    return `rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
  }
  if (kind === 'thin') {
    const sx = 0.86 + jitter(seed, 6, 0.1)
    const rot = jitter(seed, 7, 9)
    return `rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, 1.03)`
  }
  if (handwritten) {
    const rot = jitter(seed, 8, 15)
    const skew = jitter(seed, 9, 12)
    const sy = 1 + jitter(seed, 10, 0.14)
    return `rotate(${rot.toFixed(2)}deg) skewX(${skew.toFixed(2)}deg) scale(1, ${sy.toFixed(3)})`
  }
  return undefined
}

const STYLE_BY_KIND: Record<VariantKind, DigitStyle> = {
  tilt: 'tilted',
  stretch: 'thin',
  thin: 'messy',
}

export function MessyDigit({
  value,
  kind,
  seed = 'default',
  size = 34,
  color,
  handwritten = false,
}: MessyDigitProps) {
  const style: DigitStyle = handwritten
    ? 'messy'
    : kind
      ? STYLE_BY_KIND[kind]
      : 'normal'

  const t = transformFor(kind, seed, handwritten)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 10,
        height: size + 14,
        transform: t,
      }}
    >
      <Digit value={value} size={size} style={style} color={color} />
    </span>
  )
}
