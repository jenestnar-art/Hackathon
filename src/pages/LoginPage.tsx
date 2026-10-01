import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { authenticate, DEMO_CREDENTIALS } from '@/features/auth/authService'

interface LoginPageProps {
  onLogin: (name: string) => void
}

const directionPreview = [
  { number: '01', label: '软件工程' },
  { number: '02', label: '网络安全' },
  { number: '03', label: '人工智能' },
  { number: '04', label: '嵌入式' },
]

export function LoginPage({ onLogin }: LoginPageProps) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedName = name.trim()

    if (!normalizedName) {
      setError('先告诉我们要怎么称呼你。')
      return
    }

    if (!password) {
      setError('请输入密码。')
      return
    }

    if (!authenticate(normalizedName, password)) {
      setError('用户名或密码错误，请检查后重试。')
      return
    }

    setError(null)
    setSubmitting(true)
    window.setTimeout(() => onLogin(normalizedName), 520)
  }

  return (
    <div className="min-h-screen bg-[#f5f3ed] lg:grid lg:grid-cols-[1.04fr_0.96fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#101917] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-12">
        <div className="grid-pattern absolute inset-0 opacity-70" />
        <div className="absolute -left-36 top-1/3 size-[440px] rounded-full bg-[#d7ff68]/10 blur-[100px]" />
        <div className="absolute -right-24 -top-24 size-[340px] rounded-full bg-[#7c5cff]/20 blur-[100px]" />

        <div className="relative z-10">
          <BrandMark tone="light" />
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="mb-7 flex items-center gap-3 text-xs font-semibold tracking-[0.2em] text-[#d7ff68]/75">
            <span className="h-px w-10 bg-[#d7ff68]/50" />
            FIRST RUN / 第一次运行
          </div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.02] tracking-[-0.06em] xl:text-6xl">
            先选一条路，
            <br />
            <span className="text-[#d7ff68]">再把它走通。</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-8 text-white/58">
            这里不问你“未来想做什么”。先写代码、找线索、训练模型、点亮电路，
            答案会在亲手做完之后慢慢出现。
          </p>

          <div className="mt-12 grid max-w-xl grid-cols-2 gap-3">
            {directionPreview.map((direction) => (
              <div
                key={direction.number}
                className={[
                  'group flex items-center gap-4 rounded-2xl border px-4 py-4 backdrop-blur-sm transition'
                ].join(' ')}
              >
                <span className="font-mono text-xs text-[#d7ff68]/70">
                  {direction.number}
                </span>
                <span className="text-sm font-medium text-white/78">
                  {direction.label}
                </span>
                <span className="ml-auto size-1.5 rounded-full bg-white/25 transition group-hover:bg-[#d7ff68]" />
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-xs text-white/38">
          <Sparkles size={14} className="text-[#d7ff68]" />
          浏览器内真实体验 · 无需安装环境 · 五分钟找到第一个答案
        </div>
      </section>

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-8 lg:px-14">
        <div className="absolute right-0 top-0 size-72 rounded-full bg-[#d7ff68]/25 blur-[110px]" />
        <div className="relative z-10 w-full max-w-[460px]">
          <div className="mb-14 lg:hidden">
            <BrandMark />
          </div>

          <div className="mb-9">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#12201e]/40">
              <ShieldCheck size={15} />
              ENTER THE LAB
            </div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-[#12201e]">
              欢迎回来
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#12201e]/55">
              登录后进入四系体验地图，选择你的第一个方向。
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-semibold text-[#12201e]/75">
                用户名
              </span>
              <span className="relative mt-2 block">
                <UserRound
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#12201e]/35"
                />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="请输入用户名"
                  className="h-13 w-full rounded-2xl border border-[#12201e]/10 bg-white/70 pl-11 pr-4 text-sm text-[#12201e] outline-none transition placeholder:text-[#12201e]/30 focus:border-[#93b41a] focus:bg-white focus:ring-4 focus:ring-[#d7ff68]/25"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#12201e]/75">
                密码
              </span>
              <span className="relative mt-2 block">
                <LockKeyhole
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#12201e]/35"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  className="h-13 w-full rounded-2xl border border-[#12201e]/10 bg-white/70 pl-11 pr-12 text-sm text-[#12201e] outline-none transition placeholder:text-[#12201e]/30 focus:border-[#93b41a] focus:bg-white focus:ring-4 focus:ring-[#d7ff68]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#12201e]/38 transition hover:bg-[#12201e]/5 hover:text-[#12201e]"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-[#e4542f]/15 bg-[#fff0eb] px-4 py-3 text-sm text-[#b73b21]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group flex h-13 w-full items-center justify-center gap-3 rounded-2xl bg-[#12201e] px-5 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(18,32,30,0.18)] transition hover:-translate-y-0.5 hover:bg-[#1b2d2a] disabled:cursor-wait disabled:opacity-70"
            >
              {submitting ? '正在进入实验室…' : '进入体验地图'}
              {!submitting && (
                <ArrowRight
                  size={17}
                  className="transition-transform group-hover:translate-x-1"
                />
              )}
            </button>
          </form>

          <div className="mt-7 rounded-2xl border border-[#12201e]/8 bg-white/55 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold tracking-[0.08em] text-[#12201e]/40">
                演示账号
              </span>
              <span className="font-mono text-xs font-semibold text-[#12201e]/72">
                {DEMO_CREDENTIALS.username} / {DEMO_CREDENTIALS.password}
              </span>
            </div>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-[#12201e]/38">
            当前使用前端演示认证，真实项目应替换为服务端登录接口。
          </p>
        </div>
      </main>
    </div>
  )
}
