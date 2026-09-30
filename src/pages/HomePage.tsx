import {
  ArrowRight,
  CheckCircle2,
  Compass,
  LogOut,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { TrackCard } from '@/components/TrackCard'
import { tracks } from '@/data/tracks'
import type { DemoUser } from '@/features/auth/authStore'

interface HomePageProps {
  user: DemoUser
  onLogout: () => void
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function HomePage({ user, onLogout }: HomePageProps) {
  return (
    <div className="min-h-screen bg-[#f5f3ed] text-[#12201e]">
      <header className="sticky top-0 z-40 border-b border-[#12201e]/8 bg-[#f5f3ed]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1380px] items-center gap-6 px-5 sm:px-8 lg:px-10">
          <BrandMark compact />
          <nav className="ml-8 hidden items-center gap-1 rounded-full border border-[#12201e]/8 bg-white/55 p-1 md:flex">
            <span className="rounded-full bg-[#12201e] px-4 py-2 text-xs font-semibold text-white">
              体验地图
            </span>
            <span className="px-4 py-2 text-xs font-medium text-[#12201e]/42">
              我的画像
            </span>
            <span className="px-4 py-2 text-xs font-medium text-[#12201e]/42">
              同行者
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-full border border-[#12201e]/8 bg-white/60 py-1.5 pl-1.5 pr-4 sm:flex">
              <span className="grid size-8 place-items-center rounded-full bg-[#d7ff68] text-xs font-bold">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-24 truncate text-xs font-semibold text-[#12201e]/70">
                {user.name}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label="退出登录"
              className="grid size-10 place-items-center rounded-full border border-[#12201e]/10 bg-white/60 text-[#12201e]/52 transition hover:border-[#12201e]/20 hover:bg-white hover:text-[#12201e]"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1380px] px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pt-14">
        <section className="grid gap-6 lg:grid-cols-[1.28fr_0.72fr]">
          <div className="relative overflow-hidden rounded-[32px] bg-white p-7 shadow-[0_24px_80px_rgba(18,32,30,0.06)] sm:p-9 lg:p-11">
            <div className="absolute -right-16 -top-20 size-72 rounded-full bg-[#d7ff68]/35 blur-[90px]" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.18em] text-[#12201e]/42">
                <span className="h-px w-8 bg-[#12201e]/20" />
                YOUR FIRST RUN
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.06em] sm:text-5xl lg:text-6xl">
                {getGreeting()}，{user.name}。
                <br />
                <span className="text-[#7c5cff]">先试，再决定。</span>
              </h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-[#12201e]/58 sm:text-base sm:leading-8">
                四个方向不是四张资料卡，而是四种真实工作台。每个只花 5–10
                分钟，做完一个就带走一个成果，也让你的方向画像更清楚一点。
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#tracks"
                  className="group flex items-center gap-2 rounded-full bg-[#12201e] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#1b2d2a]"
                >
                  选择第一个方向
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </a>
                <span className="flex items-center gap-2 rounded-full border border-[#12201e]/10 bg-[#f7f6f2] px-4 py-3 text-xs font-medium text-[#12201e]/48">
                  <Compass size={15} />
                  不需要提前确定目标
                </span>
              </div>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[32px] bg-[#101917] p-7 text-white shadow-[0_24px_80px_rgba(18,32,30,0.12)] sm:p-8">
            <div className="grid-pattern absolute inset-0 opacity-45" />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-white/48">
                  <Target size={15} className="text-[#d7ff68]" />
                  今日探索进度
                </div>
                <span className="font-mono text-xs text-[#d7ff68]">0 / 4</span>
              </div>

              <div className="mt-8 grid grid-cols-4 gap-2">
                {tracks.map((track) => {
                  const Icon = track.icon
                  return (
                    <div
                      key={track.id}
                      className="grid aspect-square place-items-center rounded-2xl border border-white/9 bg-white/[0.045] text-white/32"
                    >
                      <Icon size={20} />
                    </div>
                  )
                })}
              </div>

              <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/9">
                <div className="h-full w-0 rounded-full bg-[#d7ff68]" />
              </div>

              <div className="mt-7 border-t border-white/10 pt-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#d7ff68] text-[#101917]">
                    <Sparkles size={15} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">完成第一个关卡后</p>
                    <p className="mt-2 text-xs leading-6 text-white/48">
                      解锁你的第一份行为画像和方向建议。每多试一个方向，结论都会更新。
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8">
                <div className="flex items-center gap-2 text-xs text-white/38">
                  <Zap size={14} className="text-[#d7ff68]" />
                  全程浏览器内完成，无需安装环境
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section id="tracks" className="scroll-mt-28 pt-18 lg:pt-24">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#12201e]/38">
                <CheckCircle2 size={15} />
                CHOOSE YOUR TRACK
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                选择你的第一个岔路口
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#12201e]/52">
                不用按顺序。挑一个最想试的，进去亲手做一遍。
              </p>
            </div>
            <div className="hidden items-center gap-3 text-xs text-[#12201e]/38 sm:flex">
              <span className="size-1.5 rounded-full bg-[#00a86b]" />
              四个工作台将在下一阶段逐步接入
            </div>
          </div>

          <div className="mt-9 grid gap-5 md:grid-cols-2">
            {tracks.map((track, index) => (
              <TrackCard key={track.id} track={track} index={index} />
            ))}
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-[28px] border border-[#12201e]/8 bg-[#e8e5dc] px-7 py-7 sm:px-9">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-lg font-semibold tracking-[-0.03em]">
                还不确定自己适合什么？
              </p>
              <p className="mt-2 text-sm leading-6 text-[#12201e]/52">
                那正是这个平台存在的意义。先随便选一个，开始比想象更重要。
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#12201e]/65">
              <Sparkles size={16} className="text-[#7c5cff]" />
              画像会在体验后自动生成
            </span>
          </div>
        </section>
      </main>
    </div>
  )
}
