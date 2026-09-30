export const DEMO_CREDENTIALS = {
  username: 'admin',
  password: 'passwd',
} as const

export function authenticate(username: string, password: string): boolean {
  return (
    username === DEMO_CREDENTIALS.username &&
    password === DEMO_CREDENTIALS.password
  )
}
