import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Cpu,
  Crosshair,
  Fingerprint,
  HardDrive,
  Lightbulb,
  Lock,
  Radar,
  RotateCcw,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal as TerminalIcon,
  Unlock,
  Users,
  Wifi,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrandMark } from '@/components/BrandMark'
import { getTrack } from '@/data/tracks'
import {
  createSecuritySession,
  destroySecuritySession,
  getSecurityProgress,
  requestSecurityHint,
  wsUrlFor,
  type SecurityHint,
  type SecurityProgress,
  type SecuritySession,
  type SecurityStage,
} from '@/features/security/api'
import { TerminalPane } from '@/features/security/TerminalPane'

const DEFAULT_HINT_LIMIT = 10

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function CapabilityCard({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#4daf72]/12 bg-[#4daf72]/[0.045] px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#4daf72]/10 text-[#4daf72]">
        {icon}
      </span>
      <span className="text-sm font-medium text-white/78">{label}</span>
      <span className="ml-auto size-1.5 rounded-full bg-[#4daf72] shadow-[0_0_12px_rgba(77,175,114,0.28)]" />
    </div>
  )
}

function HintCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[#4daf72]/12 bg-[#050807]">
      <div className="flex items-center justify-between gap-2 border-b border-white/6 px-3 py-2">
        <span className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#4daf72]/65">
          <span className="text-[#8d9891]">$</span>
          PAYLOAD
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#aeb8b2] transition hover:bg-[#aeb8b2]/8"
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <code className="block whitespace-pre-wrap break-all px-3 py-3 font-mono text-xs leading-5 text-[#d7e3df]/78">
        {command}
      </code>
    </div>
  )
}

export function SecurityWorkbenchPage() {
  const track = getTrack('security')!
  const [session, setSession] = useState<SecuritySession | null>(null)
  const [progress, setProgress] = useState<SecurityProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hints, setHints] = useState<SecurityHint[]>([])
  const [hintLimit, setHintLimit] = useState(DEFAULT_HINT_LIMIT)
  const [hintError, setHintError] = useState<string | null>(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [restarting, setRestarting] = useState(false)

  const sessionRef = useRef<SecuritySession | null>(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    let cancelled = false
    let createdId: string | null = null

    createSecuritySession()
      .then((created) => {
        if (cancelled) {
          void destroySecuritySession(created.sessionId).catch(() => {})
          return
        }
        createdId = created.sessionId
        setSession(created)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '创建靶机环境失败')
      })

    return () => {
      cancelled = true
      if (createdId) void destroySecuritySession(createdId).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const tick = async () => {
      try {
        const next = await getSecurityProgress(session.sessionId)
        if (!cancelled) setProgress(next)
      } catch {
        // 轮询失败不影响终端；创建阶段已经有明确错误提示
      }
    }

    void tick()
    const timer = window.setInterval(tick, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [session])

  const handleHint = async () => {
    if (!session || hints.length >= hintLimit) return
    setHintLoading(true)
    setHintError(null)
    try {
      const res = await requestSecurityHint(session.sessionId)
      setHints((prev) => [...prev, res.hint])
      setHintLimit(res.maxHints)
    } catch (err) {
      const message = err instanceof Error ? err.message : '提示获取失败'
      setHintError(message)
    } finally {
      setHintLoading(false)
    }
  }

  const handleRestart = async () => {
    setRestarting(true)
    const current = sessionRef.current
    if (current) await destroySecuritySession(current.sessionId).catch(() => {})

    setError(null)
    setSession(null)
    setProgress(null)
    setHints([])
    setHintLimit(DEFAULT_HINT_LIMIT)
    setHintError(null)

    try {
      const created = await createSecuritySession()
      setSession(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建靶机环境失败')
    } finally {
      setRestarting(false)
    }
  }

  const tools = progress?.toolsUsed ?? []
  const serverControlled = progress?.serverControlled ?? false
  const checklist = [
    { label: '侦察目标端口', done: tools.some((tool) => ['nmap', 'curl', 'gobuster', 'ffuf'].includes(tool)) },
    { label: '找到漏洞入口', done: tools.includes('curl') || (progress?.stage ?? 'brief') !== 'brief' },
    { label: '获得低权 Shell', done: progress?.foothold ?? false },
    { label: '提权并控制服务器', done: serverControlled },
  ]

  const currentStage: SecurityStage = progress?.stage ?? 'brief'
  const stageOrder: SecurityStage[] = ['brief', 'recon', 'foothold', 'root']
  const stageLabels: Record<SecurityStage, string> = {
    brief: '简报',
    recon: '侦察',
    foothold: '突破',
    root: '接管',
  }
  const currentStageIndex = Math.max(0, stageOrder.indexOf(currentStage))
  const hintsExhausted = hints.length >= hintLimit
  const targetIp = session?.targetIp ?? '10.10.20.4'

  const termUrl = session ? wsUrlFor(`/security/session/${session.sessionId}/term`) : ''

  return (
    <div className="security-ops min-h-screen text-[#d7e3df]">
      <header className="sticky top-0 z-40 border-b border-[#4daf72]/12 bg-[#070b0a]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[72px] lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <BrandMark compact tone="light" />
            <span className="hidden h-7 w-px bg-white/10 lg:block" />
            <div className="hidden lg:block">
              <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-[#4daf72]">
                SECURITY OPERATIONS
              </p>
              <p className="mt-1 text-[10px] tracking-[0.12em] text-white/32">AUTHORIZED PENTEST LAB</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session && (
              <span className="hidden items-center gap-2 rounded-lg border border-[#4daf72]/16 bg-[#4daf72]/[0.055] px-3 py-2 font-mono text-[10px] font-semibold text-[#a8c9b5] md:flex">
                <span className="status-pulse size-1.5 rounded-full bg-[#4daf72]" />
                TARGET <span className="text-[#4daf72]">{session.targetIp}</span>
              </span>
            )}
            <span className="hidden items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 font-mono text-[10px] text-white/35 xl:flex">
              <Wifi size={12} className="text-[#aeb8b2]" />
              ATTACKER 10.10.14.9
            </span>
            <button
              type="button"
              onClick={handleRestart}
              disabled={restarting}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 text-xs font-semibold text-white/58 transition hover:border-[#4daf72]/30 hover:bg-[#4daf72]/8 hover:text-[#4daf72] disabled:opacity-50 sm:px-4"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">{restarting ? '重置中…' : '重置靶机'}</span>
            </button>
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 text-xs font-semibold text-white/58 transition hover:border-white/20 hover:bg-white/8 hover:text-white sm:px-4"
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">退出任务</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <section className="security-panel security-command-brief relative mb-4 overflow-hidden p-5 sm:p-6">
          <div className="security-panel__corner" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(290px,0.86fr)_minmax(290px,0.76fr)] xl:items-stretch">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] font-semibold tracking-[0.16em]">
                <span className="text-[#4daf72]/75">ROOT / SECURITY / OP-LUMEN</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d64f4f]/18 bg-[#d64f4f]/[0.06] px-2.5 py-1 text-[#df7a7a]">
                  <span className="status-pulse size-1.5 rounded-full bg-[#d64f4f]" />
                  LIVE MISSION
                </span>
              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.055em] text-white sm:text-4xl">
                授权渗透控制台
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/42">
                观察目标、找到入口、建立 Shell。终端里的每一次回车都会改变战局。
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {['AUTHORIZED', 'LINUX TARGET', 'WEB SERVICE', 'ROOT REQUIRED'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-1.5 font-mono text-[9px] font-semibold tracking-[0.1em] text-white/36"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/7">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#4daf72] via-[#aeb8b2] to-[#8d9891] shadow-[0_0_18px_rgba(77,175,114,0.08)] transition-all duration-500"
                    style={{ width: `${Math.round(((currentStageIndex + 1) / stageOrder.length) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] font-semibold text-[#4daf72]">
                  {Math.round(((currentStageIndex + 1) / stageOrder.length) * 100)}% COMPLETE
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="security-metric-card rounded-xl border border-white/7 bg-white/[0.022] px-3.5 py-3">
                <p className="font-mono text-[9px] tracking-[0.16em] text-white/28">SESSION</p>
                <p className="mt-1.5 truncate font-mono text-xs font-semibold text-[#4daf72]">
                  {session ? session.sessionId.slice(0, 8) : 'PENDING'}
                </p>
              </div>
              <div className="security-metric-card rounded-xl border border-white/7 bg-white/[0.022] px-3.5 py-3">
                <p className="font-mono text-[9px] tracking-[0.16em] text-white/28">STAGE</p>
                <p className="mt-1.5 font-mono text-xs font-semibold text-[#8d9891]">
                  {stageLabels[currentStage].toUpperCase()}
                </p>
              </div>
              <div className="security-metric-card rounded-xl border border-white/7 bg-white/[0.022] px-3.5 py-3">
                <p className="font-mono text-[9px] tracking-[0.16em] text-white/28">ELAPSED</p>
                <p className="mt-1.5 font-mono text-xs font-semibold text-[#aeb8b2]">
                  {formatElapsed(progress?.elapsedMs ?? 0)}
                </p>
              </div>
              <div className="security-metric-card rounded-xl border border-white/7 bg-white/[0.022] px-3.5 py-3">
                <p className="font-mono text-[9px] tracking-[0.16em] text-white/28">INTEL</p>
                <p className="mt-1.5 font-mono text-xs font-semibold text-[#d64f4f]">
                  {hints.length}/{hintLimit}
                </p>
              </div>
            </div>

            <div className="security-target-dossier flex flex-col justify-between rounded-xl border border-[#4daf72]/10 bg-[#050807]/72 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-mono text-[9px] font-semibold tracking-[0.16em] text-[#4daf72]/65">
                    <Target size={12} />
                    TARGET DOSSIER
                  </p>
                  <p className="mt-2 text-lg font-semibold tracking-[-0.035em] text-white">pixelforge</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-md border border-[#4daf72]/14 bg-[#4daf72]/[0.05] px-2 py-1 font-mono text-[9px] text-[#4daf72]">
                  <span className="status-pulse size-1.5 rounded-full bg-[#4daf72]" />
                  ONLINE
                </span>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
                <div>
                  <p className="font-mono text-[9px] tracking-[0.15em] text-white/26">NETWORK ADDRESS</p>
                  <p className="mt-1.5 font-mono text-xl font-semibold tracking-[-0.02em] text-[#df7a7a]">
                    {targetIp}
                  </p>
                </div>
                <Crosshair size={34} className="text-[#4daf72]/28" strokeWidth={1.3} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3 font-mono text-[9px] text-white/28">
                <span>ATTACKER 10.10.14.9</span>
                <span className="text-[#aeb8b2]">SCOPE AUTHORIZED</span>
              </div>
            </div>
          </div>
        </section>

        <div className="security-workspace grid gap-4">
          <aside className="security-zone security-zone--rail space-y-4">
            <section className="security-panel relative overflow-hidden p-5">
              <div className="security-panel__corner" />
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-[#4daf72]">
                  <Target size={14} />
                  MISSION BRIEF
                </span>
                <span className="font-mono text-[9px] text-white/26">CLEARANCE A1</span>
              </div>

              <div className="relative mt-5 overflow-hidden rounded-xl border border-[#4daf72]/10 bg-[#050807]/80 p-5">
                <div className="absolute -right-10 -top-12 size-32 rounded-full bg-[#4daf72]/8 blur-3xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-xl border border-[#4daf72]/20 bg-[#4daf72]/8 text-[#4daf72]">
                      <Crosshair size={21} />
                    </span>
                    <div>
                      <p className="font-mono text-[9px] tracking-[0.18em] text-[#8d9891]/65">OPERATION LUMEN</p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-white">
                        {track.subtitle}
                      </h2>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/52">
                    内网图片处理服务存在未公开攻击面。取得 root shell 并确认控制权，任务即完成。
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/7 bg-white/[0.025] px-3 py-3">
                  <p className="font-mono text-[9px] tracking-[0.15em] text-white/26">TARGET</p>
                  <p className="mt-1.5 truncate font-mono text-xs font-semibold text-[#df7a7a]">{targetIp}</p>
                </div>
                <div className="rounded-xl border border-white/7 bg-white/[0.025] px-3 py-3">
                  <p className="font-mono text-[9px] tracking-[0.15em] text-white/26">OPERATOR</p>
                  <p className="mt-1.5 truncate font-mono text-xs font-semibold text-[#aeb8b2]">operator@kali</p>
                </div>
              </div>

            </section>

            <section className="security-panel p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-white/52">
                  <Fingerprint size={14} className="text-[#4daf72]" />
                  OBJECTIVES
                </span>
                <span className="font-mono text-[9px] text-white/26">
                  {checklist.filter((item) => item.done).length}/{checklist.length}
                </span>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {checklist.map((item, index) => (
                  <li
                    key={item.label}
                    className={[
                      'group flex items-center gap-3 rounded-xl border px-3 py-3 transition',
                      item.done
                        ? 'border-[#4daf72]/13 bg-[#4daf72]/[0.045]'
                        : 'border-white/6 bg-white/[0.018]',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'font-mono text-[10px] font-semibold',
                        item.done ? 'text-[#4daf72]' : 'text-white/22',
                      ].join(' ')}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={item.done ? 'min-w-0 flex-1 text-xs font-medium text-white/72' : 'min-w-0 flex-1 text-xs text-white/36'}>
                      {item.label}
                    </span>
                    <span
                      className={[
                        'font-mono text-[8px] font-semibold tracking-[0.12em]',
                        item.done ? 'text-[#4daf72]' : 'text-white/18',
                      ].join(' ')}
                    >
                      {item.done ? 'CLEARED' : 'WAITING'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>

          <section className="security-zone security-zone--terminal min-w-0 space-y-4">
            {error && (
              <div className="security-panel border-[#d64f4f]/18 bg-[#d64f4f]/[0.035] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d64f4f]/18 bg-[#d64f4f]/8 text-[#df7a7a]">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#df7a7a]">
                      LAB CONNECTION FAILED
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white/78">靶机环境不可用</p>
                    <p className="mt-2 text-sm leading-6 text-white/48">{error}</p>
                    <p className="mt-3 font-mono text-[10px] leading-6 text-white/30">
                      CHECK 01: Docker Desktop ONLINE<br />
                      CHECK 02: pnpm docker:build COMPLETED<br />
                      CHECK 03: pnpm dev:server RUNNING
                    </p>
                    <button
                      type="button"
                      onClick={handleRestart}
                      disabled={restarting}
                      className="mt-5 rounded-xl border border-[#d64f4f]/20 bg-[#d64f4f]/8 px-4 py-2.5 text-xs font-semibold text-[#ff9a9a] transition hover:bg-[#d64f4f]/12 disabled:opacity-50"
                    >
                      {restarting ? '重试中…' : '重新连接靶机'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!session && !error && (
              <div className="security-panel grid min-h-[500px] place-items-center overflow-hidden p-8">
                <div className="text-center">
                  <div className="security-radar mx-auto grid size-28 place-items-center rounded-full text-[#4daf72]">
                    <Radar size={34} strokeWidth={1.5} />
                  </div>
                  <p className="mt-6 font-mono text-[10px] font-semibold tracking-[0.2em] text-[#4daf72]">
                    INITIALIZING TARGET ENVIRONMENT
                  </p>
                  <p className="mt-3 text-sm text-white/52">正在建立攻击终端与靶机通道…</p>
                  <div className="mx-auto mt-5 w-fit rounded-lg border border-white/7 bg-black/25 px-4 py-3 text-left font-mono text-[10px] leading-6 text-white/32">
                    <p><span className="text-[#4daf72]">[*]</span> pulling container image</p>
                    <p><span className="text-[#8d9891]">[~]</span> creating isolated network</p>
                    <p><span className="text-white/18">[ ]</span> opening secure tty</p>
                  </div>
                  <p className="mt-4 text-xs text-white/26">首次启动可能需要拉取镜像，请稍候</p>
                </div>
              </div>
            )}

            {session && (
              <>
                <div className="security-panel overflow-hidden rounded-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/7 px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#4daf72]">
                        <Wifi size={13} />
                        ATTACK NETWORK ONLINE
                      </span>
                      <span className="hidden h-4 w-px bg-white/8 sm:block" />
                      <span className="hidden font-mono text-[10px] text-white/28 sm:block">
                        10.10.14.9 <span className="mx-2 text-[#4daf72]">→</span>
                        <span className="text-[#df7a7a]">{session.targetIp}</span>
                      </span>
                    </div>
                    <span className="flex items-center gap-2 font-mono text-[9px] text-white/28">
                      <span className="status-pulse size-1.5 rounded-full bg-[#4daf72]" />
                      ENCRYPTED CHANNEL
                    </span>
                  </div>

                  <div className="terminal-shell m-2 sm:m-3">
                    <div className="terminal-shell__bar">
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-[#d64f4f] shadow-[0_0_10px_rgba(214,79,79,0.14)]" />
                        <span className="size-3 rounded-full bg-[#8d9891] shadow-[0_0_10px_rgba(141,152,145,0.18)]" />
                        <span className="size-3 rounded-full bg-[#4daf72] shadow-[0_0_10px_rgba(77,175,114,0.08)]" />
                      </div>
                      <span className="flex min-w-0 items-center gap-2 font-mono text-[10px] text-white/42">
                        <TerminalIcon size={12} className="text-[#4daf72]" />
                        <span className="truncate">operator@kali: ~ — zsh</span>
                      </span>
                      <span className="font-mono text-[9px] text-white/24">TTY 001</span>
                    </div>
                    <div className="terminal-shell__tabs">
                      <span className="terminal-tab terminal-tab--active">operator@kali</span>
                      <span className="terminal-tab">bash</span>
                    </div>
                    <div className="security-terminal-host relative">
                      <div className="terminal-scanline pointer-events-none" aria-hidden="true" />
                      <TerminalPane
                        wsUrl={termUrl}
                        intro="Kali GNU/Linux Rolling 2026.2 · operator@kali — authorized penetration testing session"
                      />
                    </div>
                    <div className="terminal-statusbar">
                      <span className="text-[#4daf72]">● NORMAL</span>
                      <span>UTF-8</span>
                      <span>bash</span>
                      <span className="ml-auto text-[#aeb8b2]">WS / SECURE</span>
                      <span className="hidden sm:inline">100%</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
                  <section className="security-panel p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-white/52">
                        <Crosshair size={14} className="text-[#df7a7a]" />
                        ATTACK PATH
                      </span>
                      <span className="font-mono text-[9px] text-white/24">KILL CHAIN</span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      {checklist.map((item, index) => (
                        <div
                          key={item.label}
                          className={[
                            'relative rounded-xl border px-3 py-3',
                            item.done
                              ? 'border-[#4daf72]/15 bg-[#4daf72]/[0.045]'
                              : 'border-white/7 bg-white/[0.018]',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={item.done ? 'font-mono text-[9px] text-[#4daf72]' : 'font-mono text-[9px] text-white/22'}>
                              0{index + 1}
                            </span>
                            {item.done ? (
                              <CheckCircle2 size={13} className="text-[#4daf72]" />
                            ) : (
                              <Circle size={10} className="text-white/16" />
                            )}
                          </div>
                          <p className={item.done ? 'mt-3 text-xs font-medium text-white/68' : 'mt-3 text-xs text-white/30'}>
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section
                    className={[
                      'security-panel flex items-center gap-4 p-5 transition',
                      serverControlled ? 'border-[#4daf72]/28 bg-[#4daf72]/[0.045]' : '',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'grid size-12 shrink-0 place-items-center rounded-xl border',
                        serverControlled
                          ? 'border-[#4daf72]/30 bg-[#4daf72]/12 text-[#4daf72]'
                          : 'border-white/8 bg-white/[0.025] text-white/24',
                      ].join(' ')}
                    >
                      {serverControlled ? <Unlock size={22} /> : <Lock size={22} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[9px] tracking-[0.15em] text-white/28">CONTROL STATUS</p>
                      <p className={serverControlled ? 'mt-1 text-sm font-semibold text-[#4daf72]' : 'mt-1 text-sm font-semibold text-white/58'}>
                        {serverControlled ? 'ROOT SHELL ESTABLISHED' : 'TARGET LOCKED'}
                      </p>
                      <p className="mt-1 truncate font-mono text-[10px] text-white/30">
                        {serverControlled ? 'root@pixelforge' : 'uid=0(root) pending'}
                      </p>
                    </div>
                    <span
                      className={[
                        'size-2 shrink-0 rounded-full',
                        serverControlled
                          ? 'bg-[#4daf72] shadow-[0_0_14px_rgba(77,175,114,0.28)]'
                          : 'animate-pulse bg-[#d64f4f]/60',
                      ].join(' ')}
                    />
                  </section>
                </div>
              </>
            )}
          </section>

          <aside className="security-panel security-zone security-zone--intel flex min-h-0 flex-col overflow-hidden p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-[#8d9891]">
                  <Lightbulb size={14} />
                  INTEL FEED
                </span>
                <p className="mt-2 text-xs leading-5 text-white/34">
                  独立滚动，不打断终端操作。
                </p>
              </div>
              <span className="rounded-md border border-[#8d9891]/12 bg-[#8d9891]/[0.045] px-2 py-1 font-mono text-[9px] text-[#8d9891]/60">
                {hints.length}/{hintLimit}
              </span>
            </div>

            <button
              type="button"
              onClick={handleHint}
              disabled={!session || hintLoading || hintsExhausted}
              className="mt-4 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[#4daf72]/20 bg-[#4daf72] px-4 py-3 text-xs font-bold tracking-[0.04em] text-[#06100a] shadow-[0_0_28px_rgba(77,175,114,0.10)] transition hover:bg-[#5cbc7f] disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-white/25 disabled:shadow-none"
            >
              <Lightbulb size={15} />
              {hintLoading ? '解密情报中…' : hintsExhausted ? '情报已全部解密' : '请求一条情报'}
            </button>

            <div className="intel-feed-list mt-4 min-h-0 flex-1">
              {hints.length > 0 ? (
                <ol className="space-y-3">
                  {hints.map((item, index) => (
                    <li
                      key={`${index}-${item.explanation}`}
                      className="intel-card rounded-xl border border-white/7 bg-white/[0.022] p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[9px] font-semibold tracking-[0.14em] text-[#8d9891]/60">
                          INTEL_{String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="size-1.5 rounded-full bg-[#4daf72] shadow-[0_0_10px_rgba(77,175,114,0.08)]" />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/58">{item.explanation}</p>
                      <HintCommand command={item.command} />
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-white/8 bg-black/10 px-6 text-center">
                  <div>
                    <Radar size={25} className="mx-auto text-[#4daf72]/35" />
                    <p className="mt-3 font-mono text-[9px] tracking-[0.16em] text-white/22">
                      NO INTEL DECRYPTED
                    </p>
                    <p className="mt-2 text-xs leading-5 text-white/30">
                      卡住时再请求提示，获得的情报会固定显示在这里。
                    </p>
                  </div>
                </div>
              )}
            </div>

            {hintError && (
              <p className="mt-3 shrink-0 rounded-xl border border-[#d64f4f]/15 bg-[#d64f4f]/[0.055] px-3 py-2 font-mono text-[10px] leading-5 text-[#df7a7a]">
                ERR: {hintError}
              </p>
            )}

            <p className="mt-4 shrink-0 border-t border-white/6 pt-3 font-mono text-[9px] leading-5 text-white/24">
              提示会计入个人画像。建议先完成一次独立侦察。
            </p>
          </aside>
        </div>
      </main>

      <AnimatePresence>
        {serverControlled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#030504]/94 p-5 backdrop-blur-md sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.94, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="access-modal relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#4daf72]/20 bg-[#09100d] p-6 text-center text-white shadow-[0_40px_140px_rgba(0,0,0,0.72),0_0_80px_rgba(77,175,114,0.07)] sm:p-8"
            >
              <div className="terminal-scanline pointer-events-none" aria-hidden="true" />
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-2 font-mono text-[9px] tracking-[0.2em] text-white/28">
                  <span className="size-1.5 rounded-full bg-[#4daf72]" />
                  SESSION TERMINATED BY OPERATOR
                </div>
                <span className="mx-auto mt-6 grid size-16 place-items-center rounded-2xl border border-[#4daf72]/24 bg-[#4daf72]/10 text-[#4daf72] shadow-[0_0_40px_rgba(77,175,114,0.08)]">
                  <Server size={31} />
                </span>
                <p className="mt-6 font-mono text-xs font-semibold tracking-[0.24em] text-[#4daf72]">
                  ROOT ACCESS CONFIRMED
                </p>
                <h2 className="access-granted mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                  你已控制该服务器
                </h2>
                <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/48">
                  你拿到了 pixelforge 的 root 权限。文件系统、进程、用户与服务控制权现已在你的终端中。
                </p>

                <div className="mt-7 overflow-hidden rounded-xl border border-[#4daf72]/12 bg-[#040706] text-left font-mono text-[11px] leading-6 text-[#a9cbb6]">
                  <div className="border-b border-white/6 px-4 py-2 text-[9px] tracking-[0.16em] text-white/25">
                    EXPLOIT LOG / VERIFIED
                  </div>
                  <div className="p-4">
                    <p><span className="text-[#4daf72]">[+]</span> reverse shell established</p>
                    <p><span className="text-[#4daf72]">[+]</span> privilege escalation confirmed</p>
                    <p><span className="text-[#4daf72]">[+]</span> uid=0(root) gid=0(root)</p>
                    <p><span className="text-[#4daf72]">[+]</span> host pixelforge is now under your control</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-left sm:grid-cols-2">
                  <CapabilityCard icon={<HardDrive size={16} />} label="文件系统" />
                  <CapabilityCard icon={<Cpu size={16} />} label="进程控制" />
                  <CapabilityCard icon={<Users size={16} />} label="用户账户" />
                  <CapabilityCard icon={<Activity size={16} />} label="服务控制" />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/7 bg-white/[0.025] px-4 py-4">
                    <p className="font-mono text-lg font-semibold text-[#aeb8b2]">{formatElapsed(progress?.elapsedMs ?? 0)}</p>
                    <p className="mt-1 font-mono text-[9px] text-white/26">TIME</p>
                  </div>
                  <div className="rounded-xl border border-white/7 bg-white/[0.025] px-4 py-4">
                    <p className="font-mono text-lg font-semibold text-[#8d9891]">{progress?.hintsUsed ?? 0}</p>
                    <p className="mt-1 font-mono text-[9px] text-white/26">INTEL</p>
                  </div>
                  <div className="rounded-xl border border-white/7 bg-white/[0.025] px-4 py-4">
                    <p className="font-mono text-lg font-semibold text-[#4daf72]">{tools.length}</p>
                    <p className="mt-1 font-mono text-[9px] text-white/26">TOOLS</p>
                  </div>
                </div>

                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleRestart}
                    disabled={restarting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4daf72] px-6 py-3 text-sm font-bold text-[#06100a] shadow-[0_0_30px_rgba(77,175,114,0.08)] transition hover:bg-[#5cbc7f] disabled:opacity-60 sm:w-auto"
                  >
                    <RotateCcw size={16} />
                    {restarting ? '重置中…' : '再次入侵'}
                  </button>
                  <Link
                    to="/"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.025] px-6 py-3 text-sm font-semibold text-white/62 transition hover:border-white/20 hover:bg-white/6 hover:text-white sm:w-auto"
                  >
                    <Sparkles size={16} />
                    返回体验地图
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
