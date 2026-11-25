<script setup lang="ts">
const config = useRuntimeConfig()
const route = useRoute()
const { user, logout } = useAuth()

const mobileMenuOpen = ref(false)
const loggingOut = ref(false)
const qrisSettingOpen = ref(false)
const waSettingOpen = ref(false)
const quickSearch = ref('')

const navItems = [
  {
    label: 'Dashboard',
    to: '/',
    icon: 'i-heroicons-squares-2x2'
  },
  {
    label: 'Driver Food',
    to: '/driver-orders',
    icon: 'i-heroicons-truck'
  },
  {
    label: 'Produksi Harian',
    to: '/productions',
    icon: 'i-heroicons-fire'
  },
  {
    label: 'Menu & Stok',
    to: '/products',
    icon: 'i-heroicons-cube'
  },
  {
    label: 'Laporan Penjualan',
    to: '/reports',
    icon: 'i-heroicons-chart-bar-square'
  }
]

function handleQuickSearch() {
  const q = quickSearch.value.trim().toLowerCase()
  if (!q) return
  if (q.includes('driver') || q.includes('shopee') || q.includes('gofood') || q.includes('gojek')) {
    navigateTo('/driver-orders')
  } else if (q.includes('prod') || q.includes('stok') || q.includes('kukus')) {
    navigateTo('/productions')
  } else if (q.includes('lapor') || q.includes('riwayat') || q.includes('omzet') || q.includes('faktur')) {
    navigateTo('/reports')
  } else if (q.includes('menu') || q.includes('harga') || q.includes('produk')) {
    navigateTo('/products')
  } else {
    navigateTo('/products')
  }
  quickSearch.value = ''
}

async function handleLogout() {
  loggingOut.value = true
  try {
    await logout()
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-[#f4f7fa] text-[#0f213d] transition-colors duration-200 dark:bg-[#0b1424] dark:text-slate-100">
    <!-- Left Deep Navy Sidebar (Floating Rounded + Sticky — Tidak Bergerak Saat Halaman Kanan Di-scroll) -->
    <div class="sticky top-0 hidden h-screen shrink-0 py-3 pl-3 pr-1 lg:flex">
      <aside class="flex h-full w-60 flex-col overflow-hidden rounded-[26px] bg-[#0f213d] text-slate-200 shadow-lg shadow-[#0f213d]/15 ring-1 ring-white/10 dark:bg-[#091326] dark:shadow-black/35">
        <!-- Brand Logo Header -->
        <div class="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <AnimatedBrandLogo size="md" :alt="config.public.storeName" dark-surface />
          <div class="min-w-0">
            <p class="truncate text-sm font-bold tracking-tight text-white">
              {{ config.public.storeName }}
            </p>
            <p class="text-[10px] font-medium text-teal-300/80">
              Dimsum Workspace
            </p>
          </div>
        </div>

        <!-- Main Navigation + Quick Actions + Takeaway Card (Sticky Sidebar Body) -->
        <nav class="no-scrollbar flex-1 overflow-y-auto px-3 py-4">
          <div class="space-y-1">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors"
              :class="
                route.path === item.to
                  ? 'bg-[#0e8a8d] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
              "
            >
              <UIcon
                :name="item.icon"
                class="h-[18px] w-[18px] shrink-0"
                :class="route.path === item.to ? 'text-white' : 'text-slate-400 group-hover:text-teal-300'"
              />
              <span class="truncate">{{ item.label }}</span>
            </NuxtLink>
          </div>

          <!-- Quick Actions Section -->
          <div class="pt-5">
            <div class="mb-2 flex items-center justify-between px-3">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Aksi Cepat
              </span>
            </div>
            <div class="space-y-1 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
              <NuxtLink
                to="/productions"
                class="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <UIcon name="i-heroicons-plus-circle" class="h-4 w-4 text-teal-400" />
                <span>Catat Produksi</span>
              </NuxtLink>
              <NuxtLink
                to="/products"
                class="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <UIcon name="i-heroicons-squares-plus" class="h-4 w-4 text-teal-400" />
                <span>Tambah Menu Baru</span>
              </NuxtLink>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                @click="qrisSettingOpen = true"
              >
                <UIcon name="i-heroicons-qr-code" class="h-4 w-4 text-teal-400" />
                <span>Pengaturan QRIS</span>
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                @click="waSettingOpen = true"
              >
                <UIcon name="i-heroicons-chat-bubble-oval-left-ellipsis" class="h-4 w-4 text-[#25D366]" />
                <span>Notif WhatsApp</span>
              </button>
              <NuxtLink
                to="/reports"
                class="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <UIcon name="i-heroicons-document-arrow-down" class="h-4 w-4 text-teal-400" />
                <span>Rekap &amp; Export CSV</span>
              </NuxtLink>
            </div>
          </div>

          <!-- Teal Feature Card — Tepat di Bawah Rekap & Export CSV -->
          <div class="mt-4">
            <div class="rounded-2xl bg-gradient-to-br from-[#0e9f9c] to-[#0b6e82] p-4 text-white">
              <p class="text-sm font-bold leading-snug">
                Operasional Takeaway
              </p>
              <p class="mt-1 text-[11px] leading-relaxed text-teal-50/85">
                Sinkron real-time dengan stok dimsum bersama &amp; laporan kasir.
              </p>
              <NuxtLink
                to="/productions"
                class="mt-3.5 flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#0f213d] transition-colors hover:bg-slate-100"
              >
                <span>Input Produksi</span>
                <UIcon name="i-heroicons-arrow-right" class="h-3.5 w-3.5" />
              </NuxtLink>
            </div>
          </div>
        </nav>
      </aside>
    </div>

    <!-- Main Right Shell -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Clean Top Workspace Bar (Desktop Floating + Mobile Full) -->
      <div class="sticky top-0 z-20 bg-[#f4f7fa]/90 backdrop-blur-sm dark:bg-[#0b1424]/90 lg:px-6 lg:pt-3">
        <header class="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-3 dark:border-slate-800 dark:bg-[#0f1b2e] sm:h-16 sm:gap-3 sm:px-6 lg:rounded-2xl lg:border lg:px-5 lg:shadow-sm">
        <!-- Left: Mobile Brand + Quick Search -->
        <div class="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Buka menu navigasi"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <UIcon :name="mobileMenuOpen ? 'i-heroicons-x-mark' : 'i-heroicons-bars-3'" class="h-5 w-5" />
          </button>

          <div class="flex min-w-0 items-center gap-2.5 lg:hidden">
            <AnimatedBrandLogo size="sm" :alt="config.public.storeName" />
            <span class="truncate text-sm font-bold text-[#0f213d] dark:text-white">
              {{ config.public.storeName }}
            </span>
          </div>

          <form
            class="relative hidden w-full max-w-sm lg:block"
            @submit.prevent="handleQuickSearch"
          >
            <UIcon
              name="i-heroicons-magnifying-glass"
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              v-model="quickSearch"
              type="text"
              placeholder="Cari menu, produksi, atau laporan..."
              class="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-12 text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700/80 dark:bg-[#15243d] dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-teal-500"
            >
            <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-800">
              Enter
            </span>
          </form>
        </div>

        <!-- Right: Quick Add, Status, Theme, Profile & Logout -->
        <div class="flex items-center gap-2 sm:gap-2.5">
          <NuxtLink
            to="/productions"
            class="hidden h-9 w-9 items-center justify-center rounded-full bg-[#0d9488] text-white transition-colors hover:bg-[#0b7a71] sm:inline-flex"
            title="Catat Produksi Cepat"
          >
            <UIcon name="i-heroicons-plus" class="h-4 w-4" />
          </NuxtLink>

          <div class="hidden md:block">
            <TiDbStatusBadge online-label="TiDB Online" />
          </div>

          <ThemeToggle compact />

          <div class="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

          <!-- User Profile Chip -->
          <div class="hidden items-center gap-2.5 sm:flex">
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f213d] text-xs font-bold uppercase text-white dark:bg-teal-600">
              {{ user?.nama?.slice(0, 2) || 'AD' }}
            </div>
            <div class="leading-tight">
              <p class="max-w-[110px] truncate text-xs font-bold text-[#0f213d] dark:text-white">
                {{ user?.nama || 'Admin' }}
              </p>
              <p class="text-[10px] capitalize text-slate-500 dark:text-slate-400">
                {{ user?.role || 'admin' }} Kedai
              </p>
            </div>
          </div>

          <button
            type="button"
            :disabled="loggingOut"
            class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-slate-700 dark:bg-[#15243d] dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
            title="Keluar dari akun"
            @click="handleLogout"
          >
            <UIcon name="i-heroicons-arrow-right-on-rectangle" class="h-4 w-4" />
            <span class="hidden xl:inline">{{ loggingOut ? 'Keluar...' : 'Keluar' }}</span>
          </button>
        </div>
        </header>
      </div>

      <!-- Mobile Drawer Nav -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="mobileMenuOpen"
          class="border-b border-slate-700 bg-[#0f213d] px-4 py-3.5 text-white lg:hidden"
        >
          <div class="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d9488] text-xs font-bold uppercase text-white">
                {{ user?.nama?.slice(0, 2) || 'AD' }}
              </div>
              <div class="leading-tight">
                <p class="text-xs font-bold text-white">{{ user?.nama || 'Admin' }}</p>
                <p class="text-[10px] capitalize text-teal-300">{{ user?.role || 'admin' }} · @{{ user?.username }}</p>
              </div>
            </div>
            <TiDbStatusBadge online-label="TiDB Online" offline-label="Offline" />
          </div>

          <div class="flex flex-col gap-1">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              :class="route.path === item.to ? 'bg-[#0e8a8d] text-white' : 'text-slate-300 hover:bg-white/10'"
              @click="mobileMenuOpen = false"
            >
              <UIcon :name="item.icon" class="h-4 w-4" />
              <span>{{ item.label }}</span>
            </NuxtLink>
            <button
              type="button"
              class="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-white/10"
              @click="mobileMenuOpen = false; qrisSettingOpen = true"
            >
              <UIcon name="i-heroicons-qr-code" class="h-4 w-4 text-teal-400" />
              <span>Pengaturan QRIS</span>
            </button>
            <button
              type="button"
              class="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-white/10"
              @click="mobileMenuOpen = false; waSettingOpen = true"
            >
              <UIcon name="i-heroicons-chat-bubble-oval-left-ellipsis" class="h-4 w-4 text-[#25D366]" />
              <span>Notif WhatsApp Admin</span>
            </button>
          </div>
        </div>
      </Transition>

      <!-- Main Page Slot -->
      <main class="flex-1 overflow-y-auto px-3.5 py-5 pb-16 sm:px-6 sm:py-6 lg:px-6 lg:py-5 lg:pb-8">
        <div class="mx-auto max-w-[1360px]">
          <slot />
        </div>
      </main>
    </div>

    <!-- Global Store QRIS & WhatsApp Setting Modals -->
    <QrisSettingModal v-model="qrisSettingOpen" />
    <WhatsAppSettingModal v-model="waSettingOpen" />

    <!-- Global Admin Top Alert for Kasir Dimsum Stock Requests -->
    <AdminStockRequestBanner />
  </div>
</template>
