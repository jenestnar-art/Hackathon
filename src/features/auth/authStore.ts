const AUTH_STORAGE_KEY = 'code-crossroads:demo-user'

export interface DemoUser {
  name: string
  signedInAt: number
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function readDemoUser(): DemoUser | null {
  const storage = getSessionStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null

    const user = JSON.parse(raw) as Partial<DemoUser>
    if (!user.name || typeof user.signedInAt !== 'number') return null

    return { name: user.name, signedInAt: user.signedInAt }
  } catch {
    return null
  }
}

export function saveDemoUser(name: string): DemoUser {
  const user = { name, signedInAt: Date.now() }
  getSessionStorage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  return user
}

export function removeDemoUser(): void {
  getSessionStorage()?.removeItem(AUTH_STORAGE_KEY)
}
