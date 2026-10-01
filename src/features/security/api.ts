export interface SecuritySession {
  sessionId: string
  targetIp: string
}

export type SecurityStage = 'brief' | 'recon' | 'foothold' | 'root'

export interface SecurityProgress {
  stage: SecurityStage
  targetIp: string
  toolsUsed: string[]
  hintsUsed: number
  foothold: boolean
  serverControlled: boolean
  userFlagDone: boolean
  rootFlagDone: boolean
  elapsedMs: number
}

export interface SecurityHint {
  explanation: string
  command: string
}

export interface HintResponse {
  hint: SecurityHint
  hintsUsed: number
  maxHints: number
}

export interface FlagResponse {
  ok: boolean
  level?: 'user' | 'root'
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response

  try {
    res = await fetch(url, init)
  } catch {
    throw new Error('无法连接后端执行引擎，请先运行 pnpm dev:server')
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string }

  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error('后端执行引擎未启动，请先运行 pnpm dev:server')
    }
    throw new Error(data.error ?? `请求失败 (${res.status})`)
  }

  return data as T
}

export function createSecuritySession(): Promise<SecuritySession> {
  return request<SecuritySession>('/security/session', { method: 'POST' })
}

export function getSecurityProgress(sessionId: string): Promise<SecurityProgress> {
  return request<SecurityProgress>(`/security/session/${sessionId}/progress`)
}

export function requestSecurityHint(sessionId: string): Promise<HintResponse> {
  return request<HintResponse>(`/security/session/${sessionId}/hint`, { method: 'POST' })
}

export function submitSecurityFlag(sessionId: string, flag: string): Promise<FlagResponse> {
  return request<FlagResponse>(`/security/session/${sessionId}/flag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flag }),
  })
}

export function destroySecuritySession(sessionId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/security/session/${sessionId}`, { method: 'DELETE' })
}

export function wsUrlFor(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}${path}`
}
