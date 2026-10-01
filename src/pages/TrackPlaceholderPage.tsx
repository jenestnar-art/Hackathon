import { ChevronLeft, Construction, Sparkles } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BrandMark } from '@/components/BrandMark'
import { getTrack } from '@/data/tracks'
// ═══ 人工智能方向：完整模块（和 security 一样走独立实现，不落在占位页）═══
import { ChapterPlay } from '@/features/ai/ChapterPlay'

export function TrackPlaceholderPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const track = getTrack(trackId)
  const navigate = useNavigate()

  if (!track) return <Navigate to="/" replace />

  /* 人工智能方向已经有完整的五章玩法了。
     这里只是把路由指向它 —— AI 模块本身完全自包含在 src/features/ai/ 里，
     除这一行以外不需要动产品里任何其它代码。 */
  if (track.id === 'ai') {
    return <ChapterPlay onExit={() => navigate('/')} />
  }

  const Icon = track.icon

  return (
    <div className="min-h-screen bg-[#f5f3ed] text-[#12201e]">
      <header className="border-b border-[#12201e]/8">
        <div className="mx-auto flex h-18 max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <BrandMark compact />
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full border border-[#12201e]/10 bg-white/60 px-4 py-2.5 text-xs font-semibold text-[#12201e]/58 transition hover:border-[#12201e]/20 hover:bg-white hover:text-[#12201e]"
          >
            <ChevronLeft size={15} />
            返回方向选择
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8 lg:py-18">
        <div className="relative overflow-hidden rounded-[32px] bg-white p-7 shadow-[0_24px_80px_rgba(18,32,30,0.07)] sm:p-10 lg:p-14">
          <div
            className="absolute -right-24 -top-24 size-80 rounded-full blur-[100px]"
            style={{ backgroundColor: track.softColor }}
          />
          <div className="relative z-10">
            <div
              className="grid size-16 place-items-center rounded-3xl"
              style={{ backgroundColor: track.softColor, color: track.color }}
            >
              <Icon size={31} strokeWidth={1.7} />
            </div>
            <div className="mt-8 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-[#12201e]/38">
              <Construction size={15} />
              WORKBENCH IN PROGRESS
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              {track.title}工作台
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#12201e]/56 sm:text-base sm:leading-8">
              {track.description}
            </p>

            <div className="mt-9 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#12201e]/8 bg-[#f7f6f2] p-5">
                <p className="text-xs font-semibold text-[#12201e]/38">建议时长</p>
                <p className="mt-2 text-lg font-semibold">{track.duration}</p>
              </div>
              <div className="rounded-2xl border border-[#12201e]/8 bg-[#f7f6f2] p-5">
                <p className="text-xs font-semibold text-[#12201e]/38">观察信号</p>
                <p className="mt-2 text-lg font-semibold">{track.signal}</p>
              </div>
              <div className="rounded-2xl border border-[#12201e]/8 bg-[#f7f6f2] p-5">
                <p className="text-xs font-semibold text-[#12201e]/38">完成产出</p>
                <p className="mt-2 text-lg font-semibold">{track.outcome}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {track.tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ backgroundColor: track.softColor, color: track.color }}
                >
                  {tool}
                </span>
              ))}
            </div>

            <div className="mt-10 flex items-start gap-3 rounded-2xl bg-[#101917] px-5 py-4 text-white">
              <Sparkles size={17} className="mt-0.5 shrink-0 text-[#d7ff68]" />
              <p className="text-sm leading-6 text-white/70">
                当前是通用占位页。下一阶段会把这里替换成该方向专属的工作台文件与交互逻辑。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
