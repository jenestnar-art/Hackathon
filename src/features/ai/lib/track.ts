/* =============================================================================
   track.ts —— 行为埋点
   ---------------------------------------------------------------------------
   产品的核心卖点之一：行为画像。这个文件就是画像的"原料采集器"。
   每条事件都带 {ts, chapter, timeSinceLast}。
   timeSinceLast（距上次动作多久）是"反应速度 / 犹豫程度"这类信号的关键。
   ========================================================================== */

const STORAGE_KEY = 'code-crossroads:ai-track'

export interface TrackEvent {
  type: string
  chapter: string
  ts: number
  timeSinceLast: number | null
  [key: string]: unknown
}

let events: TrackEvent[] = []
let lastTs = 0
let currentChapter = 'ch0'

if (typeof window !== 'undefined') {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw) events = JSON.parse(raw) as TrackEvent[]
    const last = events[events.length - 1]
    if (last) lastTs = last.ts
  } catch {
    events = []
  }
}

export function setChapter(chapter: string): void {
  if (chapter !== currentChapter) {
    currentChapter = chapter
    track('chapter_enter', { chapter })
  }
}

export function track(type: string, payload: Record<string, unknown> = {}): TrackEvent {
  const now = Date.now()
  const event: TrackEvent = {
    type,
    chapter: (payload.chapter as string) ?? currentChapter,
    ts: now,
    timeSinceLast: lastTs ? now - lastTs : null,
    ...payload,
  }
  lastTs = now
  events.push(event)
  schedulePersist()
  return event
}

let persistTimer: number | null = null
function schedulePersist(): void {
  if (persistTimer !== null) return
  persistTimer = window.setTimeout(() => {
    persistTimer = null
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events))
    } catch {
      /* 存不下就算了，绝不能因为埋点把产品搞崩 */
    }
  }, 300)
}

export function getEvents(): TrackEvent[] {
  return events
}

export function countOf(type: string): number {
  return events.filter((e) => e.type === type).length
}

/** 某类事件之后，隔了多久才做出下一个动作 */
export function gapAfter(type: string): number | null {
  const idx = events.map((e) => e.type).lastIndexOf(type)
  if (idx < 0 || idx + 1 >= events.length) return null
  return events[idx + 1].ts - events[idx].ts
}

/** 平均动作间隔（出手快不快） */
export function averageGap(): number {
  const gaps = events
    .map((e) => e.timeSinceLast)
    .filter((v): v is number => typeof v === 'number')
  if (!gaps.length) return Number.POSITIVE_INFINITY
  return gaps.reduce((a, b) => a + b, 0) / gaps.length
}

export function resetEvents(): void {
  events = []
  lastTs = 0
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 忽略 */
  }
}

/* ---------------------------------------------------------------------------
   ★ 核心信号：效果不好的时候，用户的第一反应是补数据，还是调参数？
   这个信号决定宠物的性格标签和口头禅。
   ------------------------------------------------------------------------ */

export type FixStrategy = 'none' | 'param_first' | 'data_first' | 'mixed'

export function analyzeFixStrategy(): FixStrategy {
  const param = countOf('param_adjust')
  /* ★ 数据侧的动作不止 feed：
       第 2、3、4 章"喂样本"走的是 sample_add（喂变形样本、揪内鬼、挑数据卡），
       统计里必须算进去，否则那几章的玩家会被误判成"没碰过数据"。 */
  const data = countOf('feed') + countOf('sample_add') + countOf('widen_sample')
  if (param === 0 && data === 0) return 'none'
  if (param > data) return 'param_first'
  if (data > param) return 'data_first'
  return 'mixed'
}

export interface TrackSummary {
  total: number
  byType: Record<string, number>
  fixStrategy: FixStrategy
}

export function summarize(): TrackSummary {
  const byType: Record<string, number> = {}
  for (const e of events) byType[e.type] = (byType[e.type] ?? 0) + 1
  return { total: events.length, byType, fixStrategy: analyzeFixStrategy() }
}
