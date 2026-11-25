export default defineNuxtRouteMiddleware(async (to) => {
  const { fetchSession } = useAuth()
  const user = await fetchSession()

  // Landing page selamat datang UMKM dapat diakses siapa saja (sebelum/sesudah login)
  if (to.path === '/welcome') {
    return
  }

  if (to.path === '/login') {
    if (user) {
      return navigateTo(user.role === 'admin' ? '/' : '/pos')
    }
    return
  }

  // Pengunjung belum login yang membuka root '/' diarahkan ke Landing Page '/welcome'
  if (!user) {
    if (to.path === '/') {
      return navigateTo('/welcome')
    }
    return navigateTo('/login')
  }

  const adminOnlyPaths = ['/', '/driver-orders', '/productions', '/products', '/reports']
  if (adminOnlyPaths.includes(to.path) && user.role !== 'admin') {
    return navigateTo('/pos')
  }

  if (to.path === '/pos' && user.role !== 'kasir') {
    return navigateTo('/')
  }
})
