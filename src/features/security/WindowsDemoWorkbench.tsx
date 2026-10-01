import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  Cpu,
  HardDrive,
  Lightbulb,
  RotateCcw,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal as TerminalIcon,
  Unlock,
  Users,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import {
  WindowsDemoTerminal,
  type DemoProgress,
  type WindowsDemoTerminalHandle,
} from './WindowsDemoTerminal'

interface DemoHint {
  title: string
  intro: string
  commands: string[]
  science: string
}

const HINTS: DemoHint[] = [
  {
    title: '侦察目标端口',
    intro: '先看看这台 Windows 服务器开放了哪些服务。nmap 是渗透测试里最常用的侦察工具。',
    commands: ['nmap -sV 10.10.20.4'],
    science: 'nmap 会逐个连接端口并读取服务版本，像在敲门确认屋里有什么。',
  },
  {
    title: '查看 IIS 首页',
    intro: '80 端口跑着 IIS 网站。用 curl 读取首页和源码，看看开发人员有没有留下线索。',
    commands: ['curl http://10.10.20.4/'],
    science: '源码注释里的 /api/ping 是内部诊断接口，真实入侵经常从这种“小尾巴”开始。',
  },
  {
    title: '利用命令注入',
    intro: '诊断接口把 host 参数直接拼进系统命令。用分号再执行一次 whoami，就能看到服务运行身份。',
    commands: ['curl "http://10.10.20.4/api/ping?host=127.0.0.1;whoami"'],
    science: '分号 ; 表示“再执行下一条命令”，这就是命令注入。',
  },
  {
    title: '查看当前权限',
    intro: '你现在是 IIS 应用池身份，还不是管理员。先确认身份，再查看自己有哪些特权。',
    commands: ['whoami', 'whoami /priv'],
    science: '重点看 SeImpersonatePrivilege。State 为 Enabled 时，可以冒充其他用户的令牌，是 Windows 提权的经典入口。',
  },
  {
    title: '提权到 SYSTEM',
    intro: '利用 SeImpersonatePrivilege，让 PrintSpoofer 伪装成 SYSTEM 用户，开启高权限 PowerShell。',
    commands: ['PrintSpoofer.exe -i -c powershell'],
    science: 'SYSTEM 是 Windows 里比 Administrator 还高的本地账户，相当于 Linux 的 root。',
  },
  {
    title: '确认接管服务器',
    intro: '在 SYSTEM shell 里再运行一次 whoami，确认当前身份。',
    commands: ['whoami'],
    science: '看到 nt authority\\system，说明你已拥有最高权限；页面会自动弹出「你已控制该服务器」。',
  },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-lg border border-[#12201e]/10 px-2.5 py-1 text-[11px] font-semibold text-[#12201e]/55 transition hover:bg-[#12201e]/5"
    >
      {copied ? '已复制' : '复制'}
    </button>
  )
}

function CapabilityCard({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#d7ff68]/12 text-[#d7ff68]">
        {icon}
      </span>
      <span className="text-sm font-medium text-white/78">{label}</span>
      <span className="ml-auto size-2 rounded-full bg-[#00a86b] shadow-[0_0_12px_rgba(0,168,107,0.9)]" />
    </div>
  )
}

export function WindowsDemoWorkbench({ onExit }: { onExit: () => void }) {
  const [progress, setProgress] = useState<DemoProgress>({
    phase: 'attacker',
    tools: [],
    identity: 'operator',
  })
  const [hints, setHints] = useState<DemoHint[]>([])
  const terminalRef = useRef<WindowsDemoTerminalHandle>(null)
  const [demoKey, setDemoKey] = useState(0)

  const controlled = progress.phase === 'owned'
  const checklist = [
    { label: '侦察 Windows 目标', done: progress.tools.includes('nmap') },
    { label: '找到 IIS 诊断接口', done: progress.tools.includes('curl') },
    { label: '获得 IIS 低权 Shell', done: progress.phase !== 'attacker' },
    { label: '提权到 SYSTEM 并接管', done: controlled },
  ]

  const handleHint = () => {
    const next = HINTS[hints.length] ?? HINTS[HINTS.length - 1]
    if (hints.length >= HINTS.length) return
    setHints((prev) => [...prev, next])
  }

  const handleReset = () => {
    setProgress({ phase: 'attacker', tools: [], identity: 'operator' })
    setHints([])
    setDemoKey((key) => key + 1)
  }

  return (
    <div className="min-h-screen bg-[#f5f3ed] text-[#12201e]">
      <header className="sticky top-0 z-40 border-b border-[#12201e]/8 bg-[#f5f3ed]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1380px] items-center justify-between gap-4 px-5 sm:px-8">
          <BrandMark compact />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-full border border-[#12201e]/10 bg-white/60 px-4 py-2.5 text-xs font-semibold text-[#12201e]/58 transition hover:border-[#12201e]/20 hover:bg-white hover:text-[#12201e]"
            >
              <RotateCcw size={15} />
              重置演示
            </button>
            <button
              type="button"
              onClick={onExit}
              className="flex items-center gap-1.5 rounded-full border border-[#12201e]/10 bg-white/60 px-4 py-2.5 text-xs font-semibold text-[#12201e]/58 transition hover:border-[#12201e]/20 hover:bg-white hover:text-[#12201e]"
            >
              <ChevronLeft size={15} />
              连接真实靶机
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1380px] px-5 py-6 sm:px-8 lg:py-9">
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <div className="relative overflow-hidden rounded-[26px] bg-[#0067b8] p-6 text-white shadow-[0_20px_60px_rgba(18,32,30,0.10)]">
              <div className="grid-pattern absolute inset-0 opacity-25" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-white/60">
                  <Target size={15} />
                  WINDOWS SECURITY LAB
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">拿下 Windows 服务器</h1>
                <p className="mt-3 text-sm leading-7 text-white/75">
                  一台暴露了 IIS 诊断接口的 Windows Server 2019。利用命令注入获得低权 Shell，
                  再通过 SeImpersonatePrivilege 提权到 SYSTEM。
                </p>
                <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white/12 px-4 py-3">
                  <ShieldCheck size={16} className="text-[#d7ff68]" />
                  <span className="font-mono text-sm">目标 10.10.20.4</span>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-[#12201e]/8 bg-white p-6 shadow-[0_18px_60px_rgba(18,32,30,0.05)]">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-[#12201e]/38">
                <CheckCircle2 size={15} />
                MISSION CHECKLIST
              </div>
              <ul className="mt-5 space-y-3">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={[
                        'grid size-6 shrink-0 place-items-center rounded-full border',
                        item.done
                          ? 'border-[#00a86b] bg-[#00a86b] text-white'
                          : 'border-[#12201e]/12 bg-[#f7f6f2] text-transparent',
                      ].join(' ')}
                    >
                      <CheckCircle2 size={14} />
                    </span>
                    <span className={item.done ? 'font-medium text-[#12201e]/78' : 'text-[#12201e]/48'}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[26px] border border-[#12201e]/8 bg-white p-6 shadow-[0_18px_60px_rgba(18,32,30,0.05)]">
              <button
                type="button"
                onClick={handleHint}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0067b8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#005da6]"
              >
                <Lightbulb size={16} className="text-[#d7ff68]" />
                我要一个提示
              </button>
              {hints.length > 0 && (
                <ol className="mt-4 space-y-3">
                  {hints.map((hint, index) => (
                    <li
                      key={hint.title}
                      className="rounded-2xl bg-[#f7f6f2] px-4 py-4 text-sm leading-6 text-[#12201e]/70"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold text-[#12201e]/38">
                          HINT {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[11px] font-semibold text-[#0067b8]">{hint.title}</span>
                      </div>

                      <p className="mt-2 whitespace-pre-line">{hint.intro}</p>

                      <div className="mt-3 space-y-2">
                        {hint.commands.map((command) => (
                          <div
                            key={command}
                            className="flex items-center gap-2 rounded-xl border border-[#12201e]/8 bg-white px-3 py-2"
                          >
                            <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs text-[#12201e]/80">
                              {command}
                            </code>
                            <CopyButton text={command} />
                            <button
                              type="button"
                              onClick={() => terminalRef.current?.runCommand(command)}
                              className="shrink-0 rounded-lg bg-[#0067b8] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#005da6]"
                            >
                              执行
                            </button>
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 rounded-xl bg-[#eaf3fb] px-3 py-2 text-xs leading-5 text-[#0067b8]/80">
                        <span className="font-semibold">科普：</span>
                        {hint.science}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>

          <section className="space-y-5">
            <div className="overflow-hidden rounded-[26px] border border-[#12201e]/8 bg-[#0d1412] shadow-[0_18px_60px_rgba(18,32,30,0.08)]">
              <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
                <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-white/60">
                  <TerminalIcon size={14} className="text-[#d7ff68]" />
                  攻击终端
                </span>
                <span className="font-mono text-[11px] text-white/32">{progress.identity}</span>
              </div>
              <div className="p-2">
                <WindowsDemoTerminal key={demoKey} ref={terminalRef} onProgress={setProgress} />
              </div>
            </div>

            <div
              className={[
                'flex items-center gap-4 rounded-[24px] border bg-white p-5 shadow-[0_18px_60px_rgba(18,32,30,0.05)] transition',
                controlled ? 'border-[#00a86b]/25' : 'border-[#12201e]/8',
              ].join(' ')}
            >
              <span
                className={[
                  'grid size-11 shrink-0 place-items-center rounded-2xl',
                  controlled ? 'bg-[#00a86b] text-white' : 'bg-[#12201e]/6 text-[#12201e]/40',
                ].join(' ')}
              >
                {controlled ? <Unlock size={20} /> : <Server size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#12201e]/78">
                  {controlled ? '服务器控制权已获取' : '等待获取 SYSTEM 控制权'}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#12201e]/46">
                  {controlled
                    ? 'nt authority\\system 已进入你的终端，WIN-LAB-DC01 现在归你控制。'
                    : '拿到 SYSTEM shell 后运行 whoami，看到 nt authority\\system 就会自动触发接管判定。'}
                </p>
              </div>
              <span
                className={[
                  'size-2.5 shrink-0 rounded-full',
                  controlled
                    ? 'bg-[#00a86b] shadow-[0_0_14px_rgba(0,168,107,0.8)]'
                    : 'animate-pulse bg-[#12201e]/18',
                ].join(' ')}
              />
            </div>
          </section>
        </div>
      </main>

      <AnimatePresence>
        {controlled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0d1412]/94 p-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative w-full max-w-xl overflow-hidden rounded-[30px] border border-white/10 bg-[#151f1d] p-8 text-center text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)]"
            >
              <div className="grid-pattern pointer-events-none absolute inset-0 opacity-40" />
              <div className="relative z-10">
                <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-[#0067b8]">
                  <Server size={32} />
                </span>
                <p className="mt-6 text-xs font-semibold tracking-[0.24em] text-[#d7ff68]">
                  SYSTEM ACCESS CONFIRMED
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">你已控制该服务器</h2>
                <p className="mt-4 text-sm leading-7 text-white/62">
                  WIN-LAB-DC01 的最高权限已经在你手上。你可以读取任意文件、查看进程、管理用户、停止服务——
                  这台 Windows 服务器现在由你控制。
                </p>

                <div className="mt-7 rounded-2xl bg-black/25 p-4 text-left font-mono text-xs leading-6 text-[#9fe6c0]">
                  <p><span className="text-[#d7ff68]">[+]</span> command injection confirmed</p>
                  <p><span className="text-[#d7ff68]">[+]</span> shell: iis apppool\defaultapppool</p>
                  <p><span className="text-[#d7ff68]">[+]</span> SeImpersonatePrivilege enabled</p>
                  <p><span className="text-[#d7ff68]">[+]</span> nt authority\system</p>
                  <p><span className="text-[#d7ff68]">[+]</span> host WIN-LAB-DC01 is now under your control</p>
                </div>

                <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
                  <CapabilityCard icon={<HardDrive size={16} />} label="文件系统" />
                  <CapabilityCard icon={<Cpu size={16} />} label="进程控制" />
                  <CapabilityCard icon={<Users size={16} />} label="用户账户" />
                  <CapabilityCard icon={<Activity size={16} />} label="服务控制" />
                </div>

                <div className="mt-8 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-2 rounded-2xl bg-[#d7ff68] px-6 py-3 text-sm font-semibold text-[#101917] transition hover:bg-[#c9ef52]"
                  >
                    <RotateCcw size={16} />
                    重新演示
                  </button>
                  <button
                    type="button"
                    onClick={onExit}
                    className="flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/5 hover:text-white"
                  >
                    <Sparkles size={16} />
                    连接真实靶机
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
