/* =============================================================================
   DrawingCanvas.tsx —— 让用户自己写一个数字
   ---------------------------------------------------------------------------
   ★ 一个重要的设计决定：不让程序去识别用户写了什么，而是让用户先选"我要写几"。

   为什么：
     手写数字识别很容易猜错。如果程序把用户写的 7 认成 1，那么接下来
     "它认成了 1"这句反馈就变得毫无意义 —— 用户会觉得整个产品在胡说。
     所以：用户声明他写的是几，我们只考察【模型认不认这个写法】。
     这样反馈永远可信，而玩法一点没少。

   实现要点：
     · 用 Pointer Events（鼠标/触屏/触控笔都统一）
     · 坐标按容器宽度归一化到 0~1，这样不同屏幕尺寸下笔画比例一致
     · 笔画要居中、缩放到统一大小，否则"写在角落里"和"写满整块"没法比
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react'

interface Point {
  x: number
  y: number
}

interface DrawingCanvasProps {
  /** 可以选来写的数字。默认 7 / 4 / 9 —— 第 2 章重点看的那三个 */
  digits?: number[]
  disabled?: boolean
  /** 交卷：告诉外面"我写的是几"和笔画 */
  onSubmit: (digit: number, strokes: Point[][]) => void
  /** 上一次的判定结果，用来给反馈 */
  result?: { truth: number; guess: number; correct: boolean } | null
}

export function DrawingCanvas({
  digits = [7, 4, 9],
  disabled = false,
  onSubmit,
  result,
}: DrawingCanvasProps) {
  const [picked, setPicked] = useState(digits[0])
  const [strokes, setStrokes] = useState<Point[][]>([])
  const drawing = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)

  /* 换了选的数字就清空画布 —— 免得把 7 的笔画当成 4 交上去 */
  useEffect(() => {
    setStrokes([])
  }, [picked])

  /** 把页面坐标换算成 0~1 的归一化坐标 */
  const toLocal = useCallback((e: React.PointerEvent): Point | null => {
    const box = boxRef.current
    if (!box) return null
    const r = box.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    }
  }, [])

  const down = (e: React.PointerEvent) => {
    if (disabled) return
    const p = toLocal(e)
    if (!p) return
    drawing.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setStrokes((s) => [...s, [p]])
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current || disabled) return
    const p = toLocal(e)
    if (!p) return
    setStrokes((s) => {
      if (!s.length) return s
      const next = s.slice()
      next[next.length - 1] = [...next[next.length - 1], p]
      return next
    })
  }

  const up = () => {
    drawing.current = false
  }

  const clear = () => setStrokes([])
  const hasInk = strokes.some((s) => s.length > 1)

  /** 交卷 */
  const submit = () => {
    if (!hasInk || disabled) return
    onSubmit(picked, strokes)
  }

  /* 把笔画转成 SVG 的 path。用一点点平滑，让线条不那么锯齿。 */
  const paths = strokes.map((stroke) => {
    if (stroke.length === 0) return ''
    const pts = stroke.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`)
    return `M ${pts.join(' L ')}`
  })

  return (
    <div className="flex flex-wrap items-start gap-5">
      {/* 画板 */}
      <div>
        <div
          ref={boxRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="relative touch-none rounded-2xl border-2 border-dashed bg-screen-3"
          style={{
            width: 168,
            height: 168,
            borderColor: hasInk ? 'rgb(var(--lcd-rgb) / 0.55)' : 'rgb(var(--lcd-ink-rgb) / 0.18)',
            cursor: disabled ? 'not-allowed' : 'crosshair',
          }}
        >
          {/* 参考格线 */}
          <svg
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 size-full"
            preserveAspectRatio="none"
          >
            <line x1="50" y1="6" x2="50" y2="94" stroke="rgb(var(--lcd-ink-rgb) / 0.08)" strokeWidth="0.6" />
            <line x1="6" y1="50" x2="94" y2="50" stroke="rgb(var(--lcd-ink-rgb) / 0.08)" strokeWidth="0.6" />
            {paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="#e8f2ee"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          {!hasInk && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] text-lcd-ink/25">
              在这里写
            </span>
          )}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={clear}
            disabled={!hasInk || disabled}
            className="rounded-full border border-lcd-ink/12 bg-screen-3 px-3 py-1.5 text-[11px] text-lcd-ink/55 transition disabled:opacity-40"
          >
            重写
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!hasInk || disabled}
            className="rounded-full bg-lcd px-4 py-1.5 text-[11px] font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            喂给它，看它认不认
          </button>
        </div>
      </div>

      {/* 选"我要写几" + 结果 */}
      <div className="min-w-[190px] flex-1">
        <div className="mb-2 text-[11px] font-semibold text-lcd-ink/50">我要写的是：</div>
        <div className="flex gap-2">
          {digits.map((d) => (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => setPicked(d)}
              className="grid size-11 place-items-center rounded-2xl border text-lg font-semibold transition disabled:opacity-40"
              style={{
                borderColor: picked === d ? 'rgb(var(--lcd-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.16)',
                background: picked === d ? 'rgb(var(--lcd-rgb) / 0.14)' : 'rgb(var(--screen-bg-3-rgb))',
                color: picked === d ? 'rgb(var(--lcd-rgb))' : 'rgb(var(--lcd-ink-rgb))',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[10px] leading-5 text-lcd-ink/40">
          先在画板上写一个 <b className="text-lcd-ink/60">{picked}</b>，
          再点"喂给它"。它会告诉你这个写法它认不认。
        </p>

        {result && (
          <div
            className="mt-3 rounded-2xl border px-3.5 py-2.5 text-[11px] leading-5"
            style={{
              borderColor: result.correct ? 'rgb(var(--ok-rgb) / 0.5)' : 'rgb(var(--warn-rgb) / 0.5)',
              background: result.correct ? 'rgb(var(--ok-rgb) / 0.08)' : 'rgb(var(--warn-rgb) / 0.08)',
            }}
          >
            {result.correct ? (
              <span className="text-ok">✅ 它认出来了 —— 这个写法它见过</span>
            ) : (
              <span className="text-warn">
                ❌ 它认成了 <b>{result.guess}</b> —— 你这种写法它没见过
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
