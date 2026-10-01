import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalPaneProps {
  wsUrl: string
  intro: string
}

export function TerminalPane({ wsUrl, intro }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
      fontWeight: '400',
      fontWeightBold: '700',
      lineHeight: 1.42,
      letterSpacing: 0.1,
      theme: {
        background: '#050807',
        foreground: '#d7e3df',
        cursor: '#4daf72',
        cursorAccent: '#050807',
        selectionBackground: '#214c31',
        black: '#21222c',
        red: '#d64f4f',
        green: '#4daf72',
        yellow: '#8d9891',
        blue: '#737e78',
        magenta: '#d64f4f',
        cyan: '#aeb8b2',
        white: '#f8f8f2',
        brightBlack: '#737e78',
        brightRed: '#e06a6a',
        brightGreen: '#66c98c',
        brightYellow: '#d8ddd9',
        brightBlue: '#9aa49e',
        brightMagenta: '#e07b7b',
        brightCyan: '#d8ddd9',
        brightWhite: '#ffffff',
      },
      scrollback: 3000,
      macOptionIsMeta: true,
    })

    const encoder = new TextEncoder()
    const fit = new FitAddon()
    termRef.current = term
    term.loadAddon(fit)
    term.open(container)
    fit.fit()
    term.writeln(`\x1b[90m${intro}\x1b[0m`)
    window.requestAnimationFrame(() => term.focus())

    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'
    const pendingInput: string[] = []

    const sendResize = () => {
      if (ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data))
      } else {
        pendingInput.push(data)
      }
    })
    term.onResize(sendResize)

    ws.onopen = () => {
      while (pendingInput.length > 0) {
        const data = pendingInput.shift()
        if (data) ws.send(encoder.encode(data))
      }
      term.writeln('\x1b[90m[连接已建立]\x1b[0m')
      sendResize()
      term.focus()
    }
    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data)
      } else {
        term.write(new Uint8Array(event.data))
      }
    }
    ws.onclose = () => {
      term.writeln('\x1b[90m[连接已关闭]\x1b[0m')
    }
    ws.onerror = () => {
      term.writeln('\x1b[31m[连接错误]\x1b[0m')
    }

    let resizeFrame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => fit.fit())
    })
    observer.observe(container)

    return () => {
      window.cancelAnimationFrame(resizeFrame)
      observer.disconnect()
      ws.close()
      term.dispose()
      termRef.current = null
    }
  }, [wsUrl, intro])

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[360px] w-full"
      onMouseDown={() => termRef.current?.focus()}
    />
  )
}
