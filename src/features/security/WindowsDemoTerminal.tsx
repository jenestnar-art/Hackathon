import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export type DemoPhase = 'attacker' | 'foothold' | 'system' | 'owned'

export interface DemoProgress {
  phase: DemoPhase
  tools: string[]
  identity: string
}

interface WindowsDemoTerminalProps {
  onProgress: (progress: DemoProgress) => void
}

export interface WindowsDemoTerminalHandle {
  runCommand: (command: string) => void
}

const TARGET = '10.10.20.4'

function normalizeCommand(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
}

export const WindowsDemoTerminal = forwardRef<
  WindowsDemoTerminalHandle,
  WindowsDemoTerminalProps
>(function WindowsDemoTerminal({ onProgress }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(onProgress)
  const executeRef = useRef<(command: string) => void>(() => {})

  useEffect(() => {
    progressRef.current = onProgress
  }, [onProgress])

  useImperativeHandle(
    ref,
    () => ({
      runCommand: (command: string) => executeRef.current(command),
    }),
    [],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
      theme: {
        background: '#0d1412',
        foreground: '#d7e3df',
        cursor: '#d7ff68',
        selectionBackground: '#28433b',
      },
      convertEol: true,
      scrollback: 2000,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    fit.fit()

    const state = {
      phase: 'attacker' as DemoPhase,
      tools: new Set<string>(),
      impersonateSeen: false,
    }
    let buffer = ''

    const identity = (): string => {
      if (state.phase === 'attacker') return 'operator'
      if (state.phase === 'foothold') return 'IIS APPPOOL\\DefaultAppPool'
      return 'NT AUTHORITY\\SYSTEM'
    }

    const prompt = (): string => {
      if (state.phase === 'attacker') return '\x1b[1;32moperator@kali\x1b[0m:\x1b[1;34m~\x1b[0m$ '
      if (state.phase === 'foothold') return '\x1b[1;36mPS C:\\Windows\\system32>\x1b[0m '
      return '\x1b[1;31mnt authority\\system\x1b[0m> '
    }

    const writeln = (line = '') => term.write(`${line}\r\n`)
    const lines = (items: string[]) => items.forEach(writeln)
    const writePrompt = () => term.write(prompt())

    const emit = () => {
      progressRef.current({
        phase: state.phase,
        tools: [...state.tools],
        identity: identity(),
      })
    }

    const reset = () => {
      state.phase = 'attacker'
      state.tools.clear()
      state.impersonateSeen = false
      term.clear()
      writeln('\x1b[1;33m[ Windows Security Lab 已重置 ]\x1b[0m')
      emit()
    }

    const processCommand = (input: string) => {
      const command = input.trim()
      const lower = normalizeCommand(command)

      if (!command) return

      if (lower === 'help') {
        lines([
          '\x1b[1;33m可用命令\x1b[0m',
          '  nmap -sV <target>                       侦察 Windows 靶机',
          '  curl http://<target>/                   查看 IIS 首页',
          `  curl "http://<target>/api/ping?host=127.0.0.1;whoami"`,
          '  whoami / whoami /priv / systeminfo      查看当前权限',
          '  PrintSpoofer.exe -i -c powershell       利用 SeImpersonatePrivilege 提权',
          '  clear / reset / exit                    清屏 / 重置 / 退出当前 shell',
        ])
        return
      }

      if (lower === 'clear' || lower === 'cls') {
        term.clear()
        return
      }

      if (lower === 'reset') {
        reset()
        return
      }

      if (state.phase === 'attacker') {
        if (lower.startsWith('nmap')) {
          state.tools.add('nmap')
          lines([
            `Starting Nmap 7.94 ( https://nmap.org ) at ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
            `Nmap scan report for ${TARGET}`,
            'Host is up (0.0042s latency).',
            'Not shown: 997 filtered tcp ports (no-response)',
            'PORT     STATE SERVICE       VERSION',
            '80/tcp   open  http          Microsoft IIS httpd 10.0',
            '445/tcp  open  microsoft-ds  Windows Server 2019 microsoft-ds',
            '5985/tcp open  http          Microsoft HTTPAPI httpd 2.0 (WinRM)',
            'Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows',
            '',
            '\x1b[1;33m[!] 目标确认：Windows Server 2019 / IIS 10.0\x1b[0m',
          ])
          return
        }

        if (lower.startsWith('curl') && lower.includes('api/ping') && lower.includes('whoami')) {
          state.tools.add('curl')
          lines([
            'HTTP/1.1 200 OK',
            'Content-Type: text/plain',
            '',
            'iis apppool\\defaultapppool',
            '',
            '\x1b[1;32m[+] 命令注入成功，已获得 IIS 低权 Shell\x1b[0m',
            '\x1b[90m你现在位于目标主机的 IIS 应用池身份下。\x1b[0m',
          ])
          state.phase = 'foothold'
          emit()
          return
        }

        if (lower.startsWith('curl')) {
          state.tools.add('curl')
          lines([
            'HTTP/1.1 200 OK',
            'Server: Microsoft-IIS/10.0',
            '',
            '<html><head><title>Laboratory Intranet</title></head>',
            '<body><h1>Laboratory Intranet</h1>',
            '<p>Internal services are available to authenticated staff.</p>',
            '<!-- diag: /api/ping?host=127.0.0.1 -->',
            '</body></html>',
          ])
          return
        }

        if (lower === 'cat notes.txt' || lower === 'type notes.txt') {
          lines([
            'target: 10.10.20.4',
            'os: Windows Server 2019',
            'note: IIS diagnostic endpoint still exposed on /api/ping',
          ])
          return
        }

        if (lower === 'whoami') {
          writeln('operator')
          return
        }

        if (lower === 'id') {
          writeln('uid=1000(operator) gid=1000(operator) groups=1000(operator)')
          return
        }

        if (lower === 'pwd') {
          writeln('/home/operator')
          return
        }

        if (lower === 'ls') {
          writeln('exploit  notes.txt  wordlists')
          return
        }

        writeln(`-bash: ${command.split(' ')[0]}: command not found`)
        return
      }

      if (state.phase === 'foothold') {
        if (lower === 'whoami') {
          writeln('nt authority\\iis apppool\\defaultapppool')
          return
        }

        if (lower === 'whoami/priv' || (lower.startsWith('whoami') && lower.includes('priv'))) {
          state.impersonateSeen = true
          lines([
            'PRIVILEGES INFORMATION',
            '----------------------',
            'Privilege Name                Description                               State',
            '============================= ========================================= ========',
            'SeAssignPrimaryTokenPrivilege Replace a process level token             Disabled',
            'SeIncreaseQuotaPrivilege      Adjust memory quotas for a process        Disabled',
            'SeImpersonatePrivilege        Impersonate a client after authentication Enabled',
            'SeCreateGlobalPrivilege       Create global objects                     Enabled',
            '',
            '\x1b[1;33m[!] SeImpersonatePrivilege 已启用，可以尝试利用该权限提权。\x1b[0m',
          ])
          emit()
          return
        }

        if (lower === 'systeminfo') {
          lines([
            'Host Name:                 WIN-LAB-DC01',
            'OS Name:                   Microsoft Windows Server 2019 Standard',
            'OS Version:                10.0.17763 N/A Build 17763',
            'System Type:               x64-based PC',
            'Domain:                    LAB',
            'Hotfix(s):                 12 Hotfix(s) Installed.',
          ])
          return
        }

        if (lower.startsWith('printspoofer') || lower.startsWith('juicypotato')) {
          if (!state.impersonateSeen) {
            writeln('\x1b[31m[-] 尚未确认 SeImpersonatePrivilege 权限。先运行 whoami /priv。\x1b[0m')
            return
          }
          lines([
            '[*] Found privilege: SeImpersonatePrivilege',
            '[*] Creating process as SYSTEM...',
            '[+] Exploit completed successfully.',
            '',
            '\x1b[1;32m[+] 已提升到 NT AUTHORITY\\SYSTEM\x1b[0m',
          ])
          state.phase = 'system'
          emit()
          return
        }

        if (lower === 'exit') {
          writeln('logout')
          state.phase = 'attacker'
          emit()
          return
        }

        writeln(`'${command}' is not recognized as an internal or external command.`)
        return
      }

      if (lower === 'whoami') {
        writeln('nt authority\\system')
        if (state.phase === 'system') {
          state.phase = 'owned'
          lines([
            '',
            '\x1b[1;32m[+] 你现在是 NT AUTHORITY\\SYSTEM。\x1b[0m',
            '\x1b[1;32m[+] 这台 Windows 服务器已经落入你的控制。\x1b[0m',
          ])
          emit()
        }
        return
      }

      if (lower === 'hostname') {
        writeln('WIN-LAB-DC01')
        return
      }

      if (lower === 'dir') {
        lines([
          ' Volume in drive C has no label.',
          ' Volume Serial Number is 4C1F-9A2B',
          '',
          ' Directory of C:\\Windows\\system32',
          '',
          '10/01/2026  09:12 AM    <DIR>          config',
          '10/01/2026  09:12 AM    <DIR>          drivers',
          '10/01/2026  09:12 AM        12,288,000 ntoskrnl.exe',
          '10/01/2026  09:12 AM           445,952 lsass.exe',
          '               2 File(s)     12,733,952 bytes',
        ])
        return
      }

      if (lower === 'net user') {
        lines([
          'User accounts for \\\\WIN-LAB-DC01',
          '',
          '-------------------------------------------------------------------------------',
          'Administrator            DefaultAccount           Guest',
          'iis apppool\\defaultapppool',
          'The command completed successfully.',
        ])
        return
      }

      if (lower === 'exit') {
        writeln('logout')
        state.phase = 'foothold'
        emit()
        return
      }

      writeln(`'${command}' is not recognized as an internal or external command.`)
    }

    const executeCommand = (command: string) => {
      term.write(command)
      term.write('\r\n')
      processCommand(command)
      writePrompt()
    }
    executeRef.current = executeCommand

    lines([
      '\x1b[1;33m╔══════════════════════════════════════════════════════╗\x1b[0m',
      '\x1b[1;33m║  Windows Security Lab                                ║\x1b[0m',
      '\x1b[1;33m╚══════════════════════════════════════════════════════╝\x1b[0m',
      '',
      `目标主机：\x1b[1;36m${TARGET}\x1b[0m  (Windows Server 2019 / IIS 10.0)`,
      '输入 \x1b[1;33mhelp\x1b[0m 查看可用命令，或按左侧提示逐步推进。',
      '',
    ])
    writePrompt()
    emit()

    term.onData((data) => {
      for (let index = 0; index < data.length; index += 1) {
        const char = data[index]

        // 忽略方向键等 CSI 转义序列，避免把 "[A" 插入输入缓冲
        if (char === '\u001b') {
          if (data[index + 1] === '[') index += 2
          continue
        }

        if (char === '\r') {
          term.write('\r\n')
          processCommand(buffer)
          buffer = ''
          writePrompt()
        } else if (char === '\u007f') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1)
            term.write('\b \b')
          }
        } else if (char === '\u0003') {
          term.write('^C\r\n')
          buffer = ''
          writePrompt()
        } else if (char >= ' ') {
          buffer += char
          term.write(char)
        }
      }
    })

    const observer = new ResizeObserver(() => fit.fit())
    observer.observe(container)

    return () => {
      observer.disconnect()
      term.dispose()
      executeRef.current = () => {}
    }
  }, [])

  return <div ref={containerRef} className="h-full min-h-[460px] w-full" />
})
