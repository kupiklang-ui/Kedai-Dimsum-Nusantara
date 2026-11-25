<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const config = useRuntimeConfig()
const { user } = useAuth()

const dashboardLink = computed(() => {
  if (!user.value) return '/login'
  return user.value.role === 'admin' ? '/' : '/pos'
})

const marqueeDimsums = [
  { name: 'Dimsum Mentai Lumer', badge: 'Best Seller', src: '/images/dimsum/dimsum-mentai.png' },
  { name: 'Dimsum Tobiko Ori', badge: 'Favorit', src: '/images/dimsum/dimsum-tobiko.png' },
  { name: 'Dimsum Keju Pedas', badge: 'Creamy', src: '/images/dimsum/dimsum-keju.png' },
  { name: 'Dimsum Chili Oil', badge: 'Pedas Gurih', src: '/images/dimsum/dimsum-chili.png' }
]

const features = [
  {
    icon: 'i-heroicons-fire',
    title: 'Stok Produksi Bersama (Pcs)',
    desc: 'Semua paket dimsum (4, 6, 8 pcs) otomatis memotong stok produksi harian secara akurat dan real-time.'
  },
  {
    icon: 'i-heroicons-truck',
    title: 'Integrasi Driver Food',
    desc: 'Kelola pesanan ShopeeFood & GoFood lengkap dengan status Diolah, Dibungkus, Siap, dan pop-up kasir.'
  },
  {
    icon: 'i-heroicons-bell-alert',
    title: 'Notifikasi 2 Arah Kasir ↔ Admin',
    desc: 'Saat stok dimsum menipis, kasir langsung ajukan pasokan dan admin mengirim stok dengan notif instan.'
  },
  {
    icon: 'i-heroicons-printer',
    title: 'Struk Thermal & Laporan Cloud',
    desc: 'Cetak struk 58mm/80mm, QRIS dinamis, dan rekap omzet harian/bulanan tersimpan aman di TiDB Cloud.'
  }
]
</script>

<template>
  <div class="relative min-h-screen overflow-x-clip bg-[#f4f7fa] text-[#0f213d] transition-colors duration-200 dark:bg-[#0b1424] dark:text-slate-100">
    <!-- Subtle Ambient Background Accents -->
    <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div class="landing-blob-1 absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#0d9488]/10 blur-3xl dark:bg-[#0d9488]/15" />
      <div class="landing-blob-2 absolute -right-24 top-48 h-96 w-96 rounded-full bg-[#ee6352]/10 blur-3xl dark:bg-[#ee6352]/10" />
    </div>

    <!-- Sticky Glass Navbar -->
    <header class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0f1b2e]/85">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <NuxtLink to="/welcome" class="flex items-center gap-3">
          <AnimatedBrandLogo size="md" :alt="config.public.storeName" />
          <div class="leading-tight">
            <p class="text-sm font-extrabold tracking-tight text-[#0f213d] dark:text-white">
              {{ config.public.storeName }}
            </p>
            <p class="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              UMKM Dimsum · Kasir &amp; Admin
            </p>
          </div>
        </NuxtLink>

        <nav class="hidden items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300 md:flex">
          <a href="#portal-peran" class="transition-colors hover:text-[#0d9488]">Portal Kasir &amp; Admin</a>
          <a href="#keunggulan" class="transition-colors hover:text-[#0d9488]">Keunggulan Sistem</a>
          <a href="#varian-dimsum" class="transition-colors hover:text-[#0d9488]">Varian Dimsum</a>
        </nav>

        <div class="flex items-center gap-2">
          <div class="hidden sm:block">
            <TiDbStatusBadge online-label="TiDB Online" offline-label="TiDB Offline" />
          </div>
          <ThemeToggle compact />
          <NuxtLink
            :to="dashboardLink"
            class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0f213d] px-3.5 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:bg-[#19355f] active:scale-[0.98] dark:bg-[#0d9488] dark:hover:bg-[#0b7a71]"
          >
            <UIcon name="i-heroicons-arrow-right-end-on-rectangle" class="h-4 w-4" />
            <span>{{ user ? (user.role === 'admin' ? 'Buka Admin' : 'Buka Kasir') : 'Masuk' }}</span>
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- HERO SECTION -->
    <section class="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pt-14 lg:px-8 lg:pb-16 lg:pt-16">
      <div class="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <!-- Left Welcome Copy & Role CTAs -->
        <div class="space-y-6 lg:col-span-6">
          <div class="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/90 px-3.5 py-1.5 text-xs font-bold text-[#0d9488] dark:border-teal-500/30 dark:bg-teal-950/50 dark:text-teal-300">
            <UIcon name="i-heroicons-sparkles" class="h-4 w-4" />
            <span>Selamat Datang di Portal UMKM Dimsum</span>
          </div>

          <h1 class="text-3xl font-extrabold leading-[1.15] tracking-tight text-[#0f213d] dark:text-white sm:text-4xl lg:text-[44px]">
            Kelola <span class="text-[#0d9488]">Kasir Takeaway</span> &amp; <span class="text-[#ee6352]">Produksi Dimsum</span> dalam Satu Sistem
          </h1>

          <p class="max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
            Selamat datang di pusat operasional <strong>{{ config.public.storeName }}</strong>. Layani transaksi pelanggan, pantau pesanan ShopeeFood &amp; GoFood, atur stok produksi harian, hingga laporan omzet secara real-time dengan tampilan cepat dan responsif.
          </p>

          <!-- Primary Dual-Role Entry Buttons -->
          <div class="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
            <NuxtLink
              :to="user?.role === 'kasir' ? '/pos' : '/login?role=kasir'"
              class="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0d9488] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0b7a71] active:scale-[0.98]"
            >
              <UIcon name="i-heroicons-calculator" class="h-5 w-5" />
              <span>Masuk Halaman Kasir</span>
              <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
            </NuxtLink>

            <NuxtLink
              :to="user?.role === 'admin' ? '/' : '/login?role=admin'"
              class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-[#0f213d] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0f213d] hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-[#111d33] dark:text-white dark:hover:border-teal-400"
            >
              <UIcon name="i-heroicons-shield-check" class="h-5 w-5 text-[#0d9488]" />
              <span>Masuk Dashboard Admin</span>
            </NuxtLink>
          </div>

          <!-- Quick Trust Metrics -->
          <div class="grid max-w-md grid-cols-2 gap-3 pt-2">
            <div class="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-[#111d33]">
              <p class="text-lg font-extrabold text-[#0f213d] dark:text-white">100%</p>
              <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">Fokus Takeaway</p>
            </div>
            <div class="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-[#111d33]">
              <p class="text-lg font-extrabold text-[#ee6352]">2 Portal</p>
              <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">Kasir &amp; Admin</p>
            </div>
          </div>
        </div>

        <!-- Right 60 FPS Interactive Dimsum Animation Stage -->
        <div class="lg:col-span-6">
          <FloatingDimsumShowcase variant="hero" />
        </div>
      </div>
    </section>

    <!-- 60 FPS CONTINUOUS DIMSUM CONVEYOR MARQUEE -->
    <section
      id="varian-dimsum"
      class="border-y border-slate-200/80 bg-white/80 py-5 backdrop-blur-sm dark:border-slate-800 dark:bg-[#0f1b2e]/80"
    >
      <div class="relative overflow-hidden">
        <div class="dimsum-marquee-track flex w-max items-center gap-4">
          <template v-for="loopIdx in 3" :key="loopIdx">
            <div
              v-for="item in marqueeDimsums"
              :key="`${loopIdx}-${item.name}`"
              class="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-[#f4f7fa] px-4 py-2.5 shadow-sm dark:border-slate-700/80 dark:bg-[#111d33]"
            >
              <img
                :src="item.src"
                :alt="item.name"
                class="dimsum-conveyor-wobble h-11 w-11 shrink-0 object-contain drop-shadow-[0_4px_6px_rgba(15,33,61,0.22)]"
                draggable="false"
              >
              <div class="leading-tight">
                <p class="whitespace-nowrap text-xs font-extrabold text-[#0f213d] dark:text-white">
                  {{ item.name }}
                </p>
                <span class="inline-block rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-[#0d9488] dark:text-teal-300">
                  {{ item.badge }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </section>

    <!-- DUAL PORTAL SECTION: KASIR vs ADMIN -->
    <section id="portal-peran" class="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mx-auto mb-10 max-w-2xl text-center">
        <span class="text-xs font-bold uppercase tracking-wider text-[#0d9488]">Akses Sesuai Peran</span>
        <h2 class="mt-2 text-2xl font-extrabold tracking-tight text-[#0f213d] dark:text-white sm:text-3xl">
          Pilih Halaman Kerja Anda
        </h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Pemisahan akses yang aman dan rapi antara operasional transaksi harian di meja kasir dan manajemen produksi oleh admin.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Card 1: Portal Kasir -->
        <div class="group relative overflow-hidden rounded-3xl border border-teal-200/90 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-teal-500/30 dark:bg-[#111d33]">
          <img
            src="/images/dimsum/dimsum-mentai.png"
            alt="Dimsum Mentai"
            class="dimsum-card-float pointer-events-none absolute -right-3 -top-3 h-24 w-24 object-contain opacity-90 drop-shadow-[0_10px_14px_rgba(0,0,0,0.2)] transition-transform duration-300 group-hover:scale-110"
            draggable="false"
          >

          <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0d9488] text-white shadow-md shadow-teal-600/25">
            <UIcon name="i-heroicons-calculator" class="h-6 w-6" />
          </div>

          <h3 class="mt-5 text-xl font-extrabold text-[#0f213d] dark:text-white">
            Portal Kasir POS
          </h3>
          <p class="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm">
            Dirancang khusus untuk pelayanan pelanggan yang gesit di layar tablet, HP, maupun komputer meja kasir.
          </p>

          <ul class="mt-5 space-y-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            <li class="flex items-center gap-2">
              <UIcon name="i-heroicons-check-circle" class="h-4 w-4 shrink-0 text-[#0d9488]" />
              <span>Checkout cepat Tunai, QRIS, ShopeeFood &amp; GoFood</span>
            </li>
            <li class="flex items-center gap-2">
              <UIcon name="i-heroicons-check-circle" class="h-4 w-4 shrink-0 text-[#0d9488]" />
              <span>Notifikasi pop-up antrean Driver Food &amp; cetak struk thermal</span>
            </li>
            <li class="flex items-center gap-2">
              <UIcon name="i-heroicons-check-circle" class="h-4 w-4 shrink-0 text-[#0d9488]" />
              <span>Ajukan pasokan stok dimsum ke admin saat stok hampir habis</span>
            </li>
          </ul>

          <NuxtLink
            :to="user?.role === 'kasir' ? '/pos' : '/login?role=kasir'"
            class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d9488] px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] sm:text-sm"
          >
            <span>Masuk ke Portal Kasir</span>
            <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
          </NuxtLink>
        </div>

        <!-- Card 2: Portal Admin -->
        <div class="group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-[#0f213d] p-7 text-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-[#091326]">
          <img
            src="/images/dimsum/dimsum-tobiko.png"
            alt="Dimsum Tobiko"
            class="dimsum-card-float-alt pointer-events-none absolute -right-3 -top-3 h-24 w-24 object-contain opacity-95 drop-shadow-[0_10px_14px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-110"
            draggable="false"
          >

          <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-teal-300 ring-1 ring-white/15">
            <UIcon name="i-heroicons-shield-check" class="h-6 w-6" />
          </div>

          <h3 class="mt-5 text-xl font-extrabold text-white">
            Dashboard Admin UMKM
          </h3>
          <p class="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
            Kendali penuh pemilik usaha untuk memantau performa penjualan, produksi dapur, dan kiriman stok ke kasir.
          </p>

          <ul class="mt-5 space-y-2.5 text-xs font-medium text-slate-200">
            <li class="flex items-center gap-2">
              <UIcon name="i-heroicons-check-circle" class="h-4 w-4 shrink-0 text-teal-300" />
              <span>Grafik omzet harian/bulanan &amp; kanal pembayaran real-time</span>
            </li>
            <li class="flex items-center gap-2">
              <UIcon name="i-heroicons-check-circle" class="h-4 w-4 shrink-0 text-teal-300" />
              <span>Input produksi dimsum (Pcs) &amp; kirim stok balasan ke kasir</span>
            </li>
            <li class="flex items-center gap-2">
              <UIcon name="i-heroicons-check-circle" class="h-4 w-4 shrink-0 text-teal-300" />
              <span>Kelola katalog menu, papan Driver Food &amp; export rekap CSV</span>
            </li>
          </ul>

          <NuxtLink
            :to="user?.role === 'admin' ? '/' : '/login?role=admin'"
            class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-[#0f213d] transition-colors hover:bg-teal-50 sm:text-sm"
          >
            <span>Masuk ke Dashboard Admin</span>
            <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- KEUNGGULAN FITUR -->
    <section id="keunggulan" class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="feat in features"
          :key="feat.title"
          class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-1 dark:border-slate-800 dark:bg-[#111d33]"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300">
            <UIcon :name="feat.icon" class="h-5 w-5" />
          </div>
          <h3 class="mt-3.5 text-sm font-extrabold text-[#0f213d] dark:text-white">
            {{ feat.title }}
          </h3>
          <p class="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {{ feat.desc }}
          </p>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-slate-200/80 bg-white/70 py-6 dark:border-slate-800 dark:bg-[#0f1b2e]/70">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-slate-500 dark:text-slate-400 sm:px-6 lg:px-8">
        <div class="flex items-center gap-2 font-semibold text-[#0f213d] dark:text-slate-200">
          <span>© {{ new Date().getFullYear() }} {{ config.public.storeName }}</span>
          <span class="text-slate-300 dark:text-slate-600">·</span>
          <span class="text-[11px] font-normal text-slate-500 dark:text-slate-400">Sistem Kasir &amp; Stok UMKM Dimsum</span>
        </div>
        <div class="flex items-center gap-4">
          <NuxtLink to="/login?role=kasir" class="font-semibold text-[#0d9488] hover:underline">
            Login Kasir
          </NuxtLink>
          <NuxtLink to="/login?role=admin" class="font-semibold text-[#0f213d] hover:underline dark:text-slate-200">
            Login Admin
          </NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* GPU-Composited 60 FPS Continuous Conveyor Marquee */
.dimsum-marquee-track {
  will-change: transform;
  animation: dimsumMarquee60 22s linear infinite;
  backface-visibility: hidden;
}
.dimsum-marquee-track:hover {
  animation-play-state: paused;
}

.dimsum-conveyor-wobble {
  will-change: transform;
  animation: conveyorBob60 2.6s ease-in-out infinite;
}

.dimsum-card-float {
  will-change: transform;
  animation: cardFloat60 4.6s ease-in-out infinite;
}

.dimsum-card-float-alt {
  will-change: transform;
  animation: cardFloatAlt60 5s ease-in-out infinite;
}

.landing-blob-1 {
  will-change: transform;
  animation: blobFloatA 12s ease-in-out infinite;
}
.landing-blob-2 {
  will-change: transform;
  animation: blobFloatB 14s ease-in-out infinite;
}

@keyframes dimsumMarquee60 {
  0% {
    transform: translate3d(0, 0, 0);
  }
  100% {
    transform: translate3d(-33.3333%, 0, 0);
  }
}

@keyframes conveyorBob60 {
  0%, 100% {
    transform: translate3d(0, 0, 0) rotate(-4deg);
  }
  50% {
    transform: translate3d(0, -4px, 0) rotate(4deg);
  }
}

@keyframes cardFloat60 {
  0%, 100% {
    transform: translate3d(0, 0, 0) rotate(-4deg);
  }
  50% {
    transform: translate3d(0, -8px, 0) rotate(4deg);
  }
}

@keyframes cardFloatAlt60 {
  0%, 100% {
    transform: translate3d(0, 0, 0) rotate(4deg);
  }
  50% {
    transform: translate3d(0, -8px, 0) rotate(-4deg);
  }
}

@keyframes blobFloatA {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(24px, -18px, 0); }
}

@keyframes blobFloatB {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(-24px, 20px, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .dimsum-marquee-track,
  .dimsum-conveyor-wobble,
  .dimsum-card-float,
  .dimsum-card-float-alt,
  .landing-blob-1,
  .landing-blob-2 {
    animation: none !important;
  }
}
</style>
