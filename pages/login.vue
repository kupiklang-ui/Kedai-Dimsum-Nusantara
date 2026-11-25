<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const config = useRuntimeConfig()
const route = useRoute()
const { login } = useAuth()
const toast = useToast()

const initialRole = route.query.role === 'kasir' ? 'kasir' : 'admin'
const selectedRole = ref<'admin' | 'kasir'>(initialRole)
const slideDirection = ref<'left' | 'right'>(initialRole === 'kasir' ? 'left' : 'right')
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const loginSuccess = ref(false)
const seeding = ref(false)
const errorMessage = ref('')

const isKasirMode = computed(() => selectedRole.value === 'kasir')

const roleCopy = computed(() => {
  if (isKasirMode.value) {
    return {
      badge: 'Halo, Tim Kasir POS',
      welcomeTitle: 'Selamat Bekerja, Tim Kasir!',
      welcomeSubtitle: 'Siap melayani pelanggan dengan cepat hari ini? Masuk untuk membuka layar Kasir POS Takeaway, QRIS, ShopeeFood, dan GoFood.',
      formGreeting: 'Selamat Datang, Kasir!',
      formSub: 'Masukkan akun Kasir Anda untuk mulai melayani pesanan pelanggan hari ini.',
      switchPrompt: 'Ingin mengelola stok, produksi, atau laporan penjualan?',
      switchButton: '← Pindah ke Login Admin',
      buttonLabel: 'Masuk ke Layar Kasir'
    }
  }

  return {
    badge: 'Halo, Pengelola Kedai',
    welcomeTitle: 'Selamat Datang Kembali, Admin!',
    welcomeSubtitle: 'Senang melihat Anda kembali! Masuk ke dashboard untuk memantau omzet harian, stok produksi dimsum, dan antrean driver food secara real-time.',
    formGreeting: 'Selamat Datang, Admin!',
    formSub: 'Masukkan akun Admin Anda untuk mengelola operasional kedai dimsum hari ini.',
    switchPrompt: 'Sedang bertugas melayani pesanan di meja kasir?',
    switchButton: 'Pindah ke Login Kasir →',
    buttonLabel: 'Masuk ke Dashboard Admin'
  }
})

function switchRole(role: 'admin' | 'kasir', autoFillDemo = false) {
  if (selectedRole.value !== role) {
    slideDirection.value = role === 'kasir' ? 'left' : 'right'
    selectedRole.value = role
    errorMessage.value = ''
  }

  // Jika input kosong atau sedang terisi akun demo lain, ikut perbarui otomatis agar praktis
  const isCurrentDemoOrEmpty = !username.value || username.value === 'admin' || username.value === 'kasir'
  if (autoFillDemo || isCurrentDemoOrEmpty) {
    username.value = role
    password.value = role === 'admin' ? 'admin123' : 'kasir123'
  }
}

async function handleSeedDatabase() {
  seeding.value = true
  errorMessage.value = ''
  try {
    const res = await $fetch<{
      success: boolean
      message: string
      summary: { usersInserted: number, productsInserted: number }
    }>('/api/seed')

    toast.add({
      title: 'Database Siap Digunakan',
      description: `${res.summary.usersInserted} akun & ${res.summary.productsInserted} menu dimsum ditambahkan. Silakan login!`,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })

    switchRole(selectedRole.value, true)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    errorMessage.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Gagal menjalankan seeder database.'
  } finally {
    seeding.value = false
  }
}

async function handleLogin() {
  if (!username.value.trim() || !password.value) {
    errorMessage.value = 'Username dan password wajib diisi.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const res = await login(username.value.trim(), password.value)
    loginSuccess.value = true

    toast.add({
      title: `Selamat datang, ${res.user.nama}!`,
      description: res.user.role === 'admin'
        ? 'Masuk ke Dashboard Admin.'
        : 'Masuk ke Layar Kasir POS.',
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })

    await new Promise(resolve => setTimeout(resolve, 260))
    await navigateTo(res.redirectTo)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    errorMessage.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Gagal login. Periksa kembali akun Anda.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-screen flex-col justify-between overflow-x-clip bg-[#f4f7fa] px-4 py-5 text-[#0f213d] transition-colors duration-200 dark:bg-[#0b1424] dark:text-slate-100 sm:px-6 lg:px-8">
    <!-- Subtle 60 FPS Ambient Floating Dimsum Background Accents (Desktop Wide Screens) -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <img
        src="/images/dimsum/dimsum-mentai.png"
        alt=""
        class="login-ambient-1 absolute left-6 top-24 hidden h-20 w-20 object-contain opacity-30 drop-shadow-md dark:opacity-20 xl:block"
        draggable="false"
      >
      <img
        src="/images/dimsum/dimsum-tobiko.png"
        alt=""
        class="login-ambient-2 absolute bottom-20 left-10 hidden h-20 w-20 object-contain opacity-30 drop-shadow-md dark:opacity-20 xl:block"
        draggable="false"
      >
      <img
        src="/images/dimsum/dimsum-keju.png"
        alt=""
        class="login-ambient-3 absolute right-8 top-28 hidden h-20 w-20 object-contain opacity-30 drop-shadow-md dark:opacity-20 xl:block"
        draggable="false"
      >
      <img
        src="/images/dimsum/dimsum-chili.png"
        alt=""
        class="login-ambient-4 absolute bottom-24 right-10 hidden h-20 w-20 object-contain opacity-30 drop-shadow-md dark:opacity-20 xl:block"
        draggable="false"
      >
    </div>

    <!-- Top Utility Header -->
    <header class="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <NuxtLink
          to="/welcome"
          class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#0f213d] shadow-sm transition-colors hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200 dark:hover:border-teal-400 dark:hover:text-teal-300"
        >
          <UIcon name="i-heroicons-arrow-left" class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">Beranda</span>
        </NuxtLink>

        <AnimatedBrandLogo size="md" :alt="config.public.storeName" />
        <div class="leading-tight">
          <p class="text-sm font-extrabold tracking-tight text-[#0f213d] dark:text-white">
            {{ config.public.storeName }}
          </p>
          <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Portal Kasir &amp; Manajemen Kedai
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <TiDbStatusBadge
          online-label="TiDB Online"
          offline-label="TiDB Offline"
        />
        <ThemeToggle compact />
      </div>
    </header>

    <!-- Main 60 FPS Sliding Split-Panel Auth Card -->
    <main class="relative z-10 mx-auto my-6 w-full max-w-5xl">
      <div class="saas-card relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-[#111d33]">
        <div class="relative grid grid-cols-1 lg:min-h-[600px] lg:grid-cols-2">
          <!-- PANEL A: Deep Navy Welcoming Showcase (Slides Right on Kasir, Left on Admin at 60 FPS) -->
          <section
            class="slide-panel relative z-20 flex flex-col justify-between overflow-hidden bg-[#0f213d] p-7 text-white dark:bg-[#091326] sm:p-9 lg:p-11"
            :class="isKasirMode ? 'lg:translate-x-full' : 'lg:translate-x-0'"
          >
            <!-- Subtle Geometric Accent Circles (GPU-composited) -->
            <div
              class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#0d9488]/20 transition-transform duration-500 ease-out"
              :style="{ transform: isKasirMode ? 'translate3d(-32px, 16px, 0)' : 'translate3d(0, 0, 0)' }"
            />
            <div
              class="pointer-events-none absolute -bottom-20 -left-16 h-60 w-60 rounded-full bg-[#2e86c1]/15 transition-transform duration-500 ease-out"
              :style="{ transform: isKasirMode ? 'translate3d(28px, -16px, 0)' : 'translate3d(0, 0, 0)' }"
            />

            <!-- Top Welcome Pill -->
            <div class="relative flex items-center justify-between gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-200">
                <UIcon
                  :name="isKasirMode ? 'i-heroicons-calculator' : 'i-heroicons-shield-check'"
                  class="h-4 w-4"
                />
                <span>{{ roleCopy.badge }}</span>
              </span>

              <span class="text-[11px] font-medium text-slate-400">
                100% Takeaway POS
              </span>
            </div>

            <!-- Sliding Welcome Message Content + 60 FPS Animated Business Logo -->
            <div class="relative my-6 lg:my-0">
              <!-- Animated Kedai Dimsum Nusantara Logo Medallion (60 FPS GPU) -->
              <div class="mb-5 flex items-center gap-4">
                <div class="relative flex h-20 w-20 shrink-0 items-center justify-center">
                  <div class="login-logo-ring pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-teal-300/50" />
                  <div class="login-logo-glow pointer-events-none absolute inset-1.5 rounded-2xl bg-teal-400/20 blur-md" />
                  <div class="login-logo-float relative z-10 h-16 w-16">
                    <div
                      class="h-full w-full overflow-hidden rounded-2xl bg-white shadow-xl shadow-black/35 ring-2 ring-white/25 transition-transform duration-500 ease-out"
                      :style="{ transform: isKasirMode ? 'rotate(6deg) scale(1.04)' : 'rotate(-4deg) scale(1)' }"
                    >
                      <img
                        src="/images/logo-kedai.png"
                        :alt="config.public.storeName"
                        class="h-full w-full object-cover"
                        draggable="false"
                      >
                    </div>
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="truncate text-lg font-extrabold tracking-tight text-white sm:text-xl">
                    {{ config.public.storeName }}
                  </p>
                </div>
              </div>

              <Transition :name="slideDirection === 'left' ? 'text-slide-left' : 'text-slide-right'" mode="out-in">
                <div :key="selectedRole" class="space-y-4">
                  <h1 class="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl lg:text-[32px]">
                    {{ roleCopy.welcomeTitle }}
                  </h1>
                  <p class="text-xs leading-relaxed text-slate-300 sm:text-sm">
                    {{ roleCopy.welcomeSubtitle }}
                  </p>
                </div>
              </Transition>

              <!-- 60 FPS Animated Dimsum Strip Inside Login Showcase -->
              <FloatingDimsumShowcase
                variant="login"
                :active-role="selectedRole"
              />
            </div>

            <!-- Interactive Panel Switch Button (Desktop) -->
            <div class="relative hidden border-t border-white/10 pt-5 lg:block">
              <p class="text-xs text-slate-300">
                {{ roleCopy.switchPrompt }}
              </p>
              <button
                type="button"
                class="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-teal-400/40 bg-white/10 px-4 py-2 text-xs font-bold text-white transition-all duration-200 hover:bg-[#0d9488] hover:border-[#0d9488] active:scale-[0.98]"
                @click="switchRole(isKasirMode ? 'admin' : 'kasir')"
              >
                <span>{{ roleCopy.switchButton }}</span>
              </button>
            </div>
          </section>

          <!-- PANEL B: Clean Login Form (Slides Left on Kasir, Right on Admin at 60 FPS) -->
          <section
            class="slide-panel relative z-10 flex flex-col justify-center bg-white p-6 dark:bg-[#111d33] sm:p-9 lg:p-11"
            :class="isKasirMode ? 'lg:-translate-x-full' : 'lg:translate-x-0'"
          >
            <!-- 60 FPS Sliding Role Switcher Pill (Admin <-> Kasir) -->
            <div class="mb-6">
              <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Pilih Mode Masuk
              </p>
              <div class="relative grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100/90 p-1.5 dark:border-slate-700 dark:bg-[#0b1424]">
                <!-- GPU-Accelerated 60 FPS Sliding Background Pill -->
                <div
                  class="sliding-thumb pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 w-[calc(50%-6px)] rounded-xl shadow-sm"
                  :class="isKasirMode ? 'bg-[#0d9488]' : 'bg-[#0f213d] dark:bg-[#0d9488]'"
                  :style="{ transform: isKasirMode ? 'translate3d(100%, 0, 0)' : 'translate3d(0, 0, 0)' }"
                />

                <button
                  type="button"
                  class="relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-colors duration-200 sm:text-sm"
                  :class="!isKasirMode ? 'text-white' : 'text-slate-600 hover:text-[#0f213d] dark:text-slate-400 dark:hover:text-white'"
                  @click="switchRole('admin')"
                >
                  <UIcon name="i-heroicons-shield-check" class="h-4 w-4" />
                  <span>Admin</span>
                </button>

                <button
                  type="button"
                  class="relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-colors duration-200 sm:text-sm"
                  :class="isKasirMode ? 'text-white' : 'text-slate-600 hover:text-[#0f213d] dark:text-slate-400 dark:hover:text-white'"
                  @click="switchRole('kasir')"
                >
                  <UIcon name="i-heroicons-calculator" class="h-4 w-4" />
                  <span>Kasir</span>
                </button>
              </div>
            </div>

            <!-- Form Heading with Directional 60 FPS Slide Transition -->
            <div class="mb-5 overflow-hidden">
              <Transition :name="slideDirection === 'left' ? 'text-slide-left' : 'text-slide-right'" mode="out-in">
                <div :key="selectedRole">
                  <h2 class="text-xl font-extrabold tracking-tight text-[#0f213d] dark:text-white sm:text-2xl">
                    {{ roleCopy.formGreeting }}
                  </h2>
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {{ roleCopy.formSub }}
                  </p>
                </div>
              </Transition>
            </div>

            <!-- Login Form -->
            <form class="space-y-4" @submit.prevent="handleLogin">
              <div>
                <label for="username" class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Username
                </label>
                <div class="relative">
                  <UIcon
                    name="i-heroicons-user"
                    class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="username"
                    v-model="username"
                    type="text"
                    autocomplete="username"
                    required
                    :placeholder="isKasirMode ? 'cth: kasir' : 'cth: admin'"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-3.5 text-sm font-medium text-[#0f213d] placeholder-slate-400 transition-colors focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:placeholder-slate-500 dark:focus:border-teal-500"
                  >
                </div>
              </div>

              <div>
                <label for="password" class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <div class="relative">
                  <UIcon
                    name="i-heroicons-lock-closed"
                    class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="password"
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    autocomplete="current-password"
                    required
                    placeholder="Masukkan password Anda"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-10 text-sm font-medium text-[#0f213d] placeholder-slate-400 transition-colors focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:placeholder-slate-500 dark:focus:border-teal-500"
                  >
                  <button
                    type="button"
                    class="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white"
                    @click="showPassword = !showPassword"
                  >
                    <UIcon
                      :name="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                      class="h-4 w-4"
                    />
                  </button>
                </div>
              </div>

              <div
                v-if="errorMessage"
                class="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200"
              >
                <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>{{ errorMessage }}</span>
              </div>

              <button
                type="submit"
                :disabled="loading || loginSuccess"
                class="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-70"
                :class="isKasirMode ? 'bg-[#0d9488] hover:bg-[#0b7a71]' : 'bg-[#0f213d] hover:bg-[#19355f] dark:bg-[#0d9488] dark:hover:bg-[#0b7a71]'"
              >
                <UIcon
                  :name="
                    loginSuccess
                      ? 'i-heroicons-check-circle'
                      : loading
                        ? 'i-heroicons-arrow-path'
                        : 'i-heroicons-arrow-right-circle'
                  "
                  class="h-5 w-5"
                  :class="{ 'animate-spin': loading && !loginSuccess }"
                />
                <span>
                  {{
                    loginSuccess
                      ? 'Berhasil! Mengalihkan...'
                      : loading
                        ? 'Memverifikasi...'
                        : roleCopy.buttonLabel
                  }}
                </span>
              </button>
            </form>

            <!-- Quick Demo Fill & Seed Database -->
            <div class="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2 text-xs font-semibold text-[#0d9488] transition-colors hover:bg-[#0d9488] hover:text-white dark:border-teal-500/30 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-600 dark:hover:text-white"
                @click="switchRole(selectedRole, true)"
              >
                <UIcon name="i-heroicons-key" class="h-4 w-4" />
                <span>Isi Otomatis Akun Demo {{ isKasirMode ? 'Kasir' : 'Admin' }}</span>
              </button>

              <button
                type="button"
                :disabled="seeding"
                class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-700 disabled:opacity-60 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300 dark:hover:border-teal-500/40 dark:hover:text-teal-300"
                @click="handleSeedDatabase"
              >
                <UIcon
                  :name="seeding ? 'i-heroicons-arrow-path' : 'i-heroicons-circle-stack'"
                  class="h-4 w-4 text-[#0d9488]"
                  :class="{ 'animate-spin': seeding }"
                />
                <span>{{ seeding ? 'Mengisi data awal...' : 'Isi Data Awal (Seed Akun & 8 Menu)' }}</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
      <span>© {{ new Date().getFullYear() }} {{ config.public.storeName }}</span>
      <span>Nuxt 3 · Pinia · Drizzle ORM · TiDB Cloud</span>
    </footer>
  </div>
</template>

<style scoped>
/* GPU-accelerated 60 FPS sliding panels (transform-only, zero layout reflow) */
.slide-panel {
  will-change: transform;
  transition: transform 0.52s cubic-bezier(0.22, 1, 0.36, 1);
  backface-visibility: hidden;
}

.sliding-thumb {
  will-change: transform, background-color;
  transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.28s ease;
  backface-visibility: hidden;
}

/* Directional 60 FPS text slide when switching to Kasir (slides left) */
.text-slide-left-enter-active,
.text-slide-left-leave-active,
.text-slide-right-enter-active,
.text-slide-right-leave-active {
  will-change: transform, opacity;
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease;
}

.text-slide-left-enter-from {
  opacity: 0;
  transform: translate3d(28px, 0, 0);
}
.text-slide-left-leave-to {
  opacity: 0;
  transform: translate3d(-28px, 0, 0);
}

/* Directional 60 FPS text slide when switching to Admin (slides right) */
.text-slide-right-enter-from {
  opacity: 0;
  transform: translate3d(-28px, 0, 0);
}
.text-slide-right-leave-to {
  opacity: 0;
  transform: translate3d(28px, 0, 0);
}

/* 60 FPS GPU-composited animated business logo inside login panel */
.login-logo-ring {
  will-change: transform;
  animation: loginLogoSpin60 16s linear infinite;
}

.login-logo-float {
  will-change: transform;
  animation: loginLogoFloat60 3.6s ease-in-out infinite;
  backface-visibility: hidden;
}

.login-logo-glow {
  will-change: opacity, transform;
  animation: loginLogoPulse60 2.8s ease-in-out infinite;
}

@keyframes loginLogoSpin60 {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes loginLogoFloat60 {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -6px, 0); }
}

@keyframes loginLogoPulse60 {
  0%, 100% { opacity: 0.45; transform: scale3d(0.95, 0.95, 1); }
  50% { opacity: 0.9; transform: scale3d(1.08, 1.08, 1); }
}

/* 60 FPS GPU-composited ambient floating dimsum on login page */
.login-ambient-1 {
  will-change: transform;
  animation: loginFloatA 6.4s ease-in-out infinite;
}
.login-ambient-2 {
  will-change: transform;
  animation: loginFloatB 7.2s ease-in-out infinite;
}
.login-ambient-3 {
  will-change: transform;
  animation: loginFloatB 6.8s ease-in-out 0.6s infinite;
}
.login-ambient-4 {
  will-change: transform;
  animation: loginFloatA 7.6s ease-in-out 1.1s infinite;
}

@keyframes loginFloatA {
  0%, 100% {
    transform: translate3d(0, 0, 0) rotate(-6deg);
  }
  50% {
    transform: translate3d(10px, -16px, 0) rotate(6deg);
  }
}

@keyframes loginFloatB {
  0%, 100% {
    transform: translate3d(0, 0, 0) rotate(5deg);
  }
  50% {
    transform: translate3d(-10px, 14px, 0) rotate(-6deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .slide-panel,
  .sliding-thumb,
  .text-slide-left-enter-active,
  .text-slide-left-leave-active,
  .text-slide-right-enter-active,
  .text-slide-right-leave-active {
    transition: none !important;
  }
  .login-logo-ring,
  .login-logo-float,
  .login-logo-glow,
  .login-ambient-1,
  .login-ambient-2,
  .login-ambient-3,
  .login-ambient-4 {
    animation: none !important;
  }
}
</style>
