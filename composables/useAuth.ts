import type { SessionUser } from '~/types/pos'

interface MeResponse {
  authenticated: boolean
  user: SessionUser | null
}

interface LoginResponse {
  success: boolean
  message: string
  user: SessionUser
  redirectTo: string
}

export function useAuth() {
  const user = useState<SessionUser | null>('auth:user', () => null)
  const initialized = useState<boolean>('auth:initialized', () => false)

  async function fetchSession(force = false): Promise<SessionUser | null> {
    if (initialized.value && !force) {
      return user.value
    }

    try {
      const requestFetch = useRequestFetch()
      const res = await requestFetch<MeResponse>('/api/auth/me')
      user.value = res.authenticated ? res.user : null
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }

    return user.value
  }

  async function login(username: string, password: string): Promise<LoginResponse> {
    const res = await $fetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    })
    user.value = res.user
    initialized.value = true
    return res
  }

  async function logout(): Promise<void> {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
      initialized.value = true
      await navigateTo('/login')
    }
  }

  return {
    user,
    initialized,
    isAuthenticated: computed(() => Boolean(user.value)),
    isAdmin: computed(() => user.value?.role === 'admin'),
    isKasir: computed(() => user.value?.role === 'kasir'),
    fetchSession,
    login,
    logout
  }
}
