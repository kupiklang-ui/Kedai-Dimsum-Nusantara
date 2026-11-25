<script setup lang="ts">
import type { DashboardSummary, ProductItem } from '~/types/pos'
import { formatRupiah } from '~/utils/format'

definePageMeta({
  layout: 'admin'
})

const { user } = useAuth()
const toast = useToast()

const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const restockModalOpen = ref(false)
const selectedProduct = ref<ProductItem | null>(null)
const qrisSettingOpen = ref(false)

async function fetchSummary() {
  loading.value = true
  errorMessage.value = ''
  try {
    summary.value = await $fetch<DashboardSummary>('/api/reports/summary')
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    errorMessage.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Gagal memuat ringkasan dashboard.'
    toast.add({
      title: 'Gagal Memuat Laporan',
      description: errorMessage.value,
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    loading.value = false
  }
}

function openRestock(item: ProductItem) {
  selectedProduct.value = item
  restockModalOpen.value = true
}

const grossMarginPercent = computed(() => {
  const omzet = summary.value?.kpi.omzetHariIni || 0
  const laba = summary.value?.kpi.estimasiLabaKotorHariIni || 0
  if (omzet <= 0) return 0
  return Math.round((laba / omzet) * 100)
})

const stockHealthPercent = computed(() => {
  const pcs = summary.value?.dimsumStock.stok_pcs || 0
  const minPcs = Math.max(1, summary.value?.dimsumStock.stok_minimum_pcs || 20)
  // Target healthy stock = 4x minimum stock
  const healthyTarget = minPcs * 4
  return Math.min(100, Math.round((pcs / healthyTarget) * 100))
})

const stockRingCircumference = 2 * Math.PI * 22
const stockRingOffset = computed(() =>
  stockRingCircumference * (1 - stockHealthPercent.value / 100)
)

const topMenuMaxQty = computed(() => {
  const list = summary.value?.top5MenuTerlaris || []
  const maxQty = Math.max(...list.map(m => m.total_terjual), 0)
  return maxQty > 0 ? maxQty : 1
})

function formatGrowth(val: number): string {
  const rounded = Math.round(val * 10) / 10
  return rounded >= 0 ? `↑ ${rounded}%` : `↓ ${Math.abs(rounded)}%`
}

onMounted(() => {
  fetchSummary()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Greeting Header (Template Welcome Bar) -->
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
      <div>
        <h1 class="text-xl font-extrabold tracking-tight text-[#0f213d] dark:text-white sm:text-2xl">
          Selamat datang, {{ user?.nama || 'Admin' }}!
        </h1>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
          Pantau penjualan, laba kotor, dan ketersediaan stok dimsum hari ini.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-300 sm:gap-2 sm:px-3">
          <UIcon name="i-heroicons-calendar-days" class="h-4 w-4 shrink-0 text-[#0d9488]" />
          <span class="truncate">{{ summary?.tanggalLabel || 'Memuat tanggal...' }}</span>
        </div>

        <NuxtLink
          to="/driver-orders"
          class="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors"
          :class="
            (summary?.kpi.driverFoodAktifCount ?? 0) > 0
              ? 'border-orange-200 bg-orange-50 text-[#ee4d2d] hover:bg-[#ee4d2d] hover:text-white dark:border-orange-500/40 dark:bg-orange-950/50 dark:text-orange-300'
              : 'border-slate-200 bg-white text-slate-700 hover:border-teal-500/50 hover:text-teal-700 dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200'
          "
        >
          <UIcon name="i-heroicons-truck" class="h-4 w-4" />
          <span>Driver Food</span>
          <span
            v-if="(summary?.kpi.driverFoodAktifCount ?? 0) > 0"
            class="rounded-full bg-[#ee4d2d] px-1.5 py-0.5 text-[10px] font-extrabold text-white tabular-nums"
          >
            {{ summary?.kpi.driverFoodAktifCount }}
          </span>
        </NuxtLink>

        <button
          type="button"
          class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-500/50 hover:text-teal-700 dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200 dark:hover:border-teal-500/50 dark:hover:text-teal-300"
          @click="qrisSettingOpen = true"
        >
          <UIcon name="i-heroicons-qr-code" class="h-4 w-4 text-[#0d9488]" />
          <span>QRIS</span>
        </button>

        <button
          type="button"
          :disabled="loading"
          class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0d9488] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-50 sm:px-3.5"
          @click="fetchSummary"
        >
          <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Error Notice -->
    <div
      v-if="errorMessage"
      class="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200"
    >
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-exclamation-triangle" class="h-5 w-5 shrink-0 text-rose-500" />
        <span>{{ errorMessage }}</span>
      </div>
      <button
        type="button"
        class="rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700"
        @click="fetchSummary"
      >
        Coba Lagi
      </button>
    </div>

    <!-- ROW 1: 4 Crisp KPI Cards (Matching Template 4-Card Strip) -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <!-- KPI 1: Total Pesanan (Teal Icon Circle) -->
      <div class="saas-card flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33]">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-white">
          <UIcon name="i-heroicons-shopping-bag" class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
            Pesanan Hari Ini
          </p>
          <p class="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0f213d] tabular-nums dark:text-white">
            {{ summary?.kpi.totalPesananHariIni ?? 0 }}
          </p>
          <p
            class="mt-0.5 text-[11px] font-semibold tabular-nums"
            :class="(summary?.kpi.pesananGrowthPct ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'"
          >
            {{ formatGrowth(summary?.kpi.pesananGrowthPct ?? 0) }}
            <span class="font-normal text-slate-400">vs kemarin</span>
          </p>
        </div>
      </div>

      <!-- KPI 2: Estimasi Laba Kotor (Deep Navy Icon Circle) -->
      <div class="saas-card flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33]">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0f213d] text-white dark:bg-[#1e3a5f]">
          <UIcon name="i-heroicons-briefcase" class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
            Laba Kotor Hari Ini
          </p>
          <p class="mt-0.5 truncate text-2xl font-extrabold tracking-tight text-[#0f213d] tabular-nums dark:text-white">
            {{ formatRupiah(summary?.kpi.estimasiLabaKotorHariIni ?? 0) }}
          </p>
          <p class="mt-0.5 text-[11px] font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
            Margin {{ grossMarginPercent }}%
            <span class="font-normal text-slate-400">dari omzet</span>
          </p>
        </div>
      </div>

      <!-- KPI 3: Omzet Hari Ini (Warm Coral Icon Circle) -->
      <div class="saas-card flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33]">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ee6352] text-white">
          <UIcon name="i-heroicons-banknotes" class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
            Omzet Hari Ini
          </p>
          <p class="mt-0.5 truncate text-2xl font-extrabold tracking-tight text-[#0f213d] tabular-nums dark:text-white">
            {{ formatRupiah(summary?.kpi.omzetHariIni ?? 0) }}
          </p>
          <p
            class="mt-0.5 text-[11px] font-semibold tabular-nums"
            :class="(summary?.kpi.omzetGrowthPct ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'"
          >
            {{ formatGrowth(summary?.kpi.omzetGrowthPct ?? 0) }}
            <span class="font-normal text-slate-400">vs kemarin</span>
          </p>
        </div>
      </div>

      <!-- KPI 4: Stok Dimsum Bersama (Teal Icon + Circular Ring Gauge like Template "Sales Target") -->
      <div class="saas-card flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33]">
        <div class="flex min-w-0 items-center gap-3.5">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-white">
            <UIcon name="i-heroicons-fire" class="h-6 w-6" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
              Stok Dimsum
            </p>
            <p class="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0f213d] tabular-nums dark:text-white">
              {{ summary?.dimsumStock.stok_pcs ?? 0 }}
              <span class="text-xs font-semibold text-slate-400">pcs</span>
            </p>
            <p class="mt-0.5 truncate text-[11px] text-slate-400 tabular-nums">
              Prod +{{ summary?.dimsumStock.diproduksiHariIniPcs ?? 0 }} · Keluar {{ summary?.dimsumStock.terjualHariIniPcs ?? 0 }}
            </p>
          </div>
        </div>

        <!-- Mini Circular Ring Gauge -->
        <div class="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <svg viewBox="0 0 56 56" class="h-14 w-14 -rotate-90">
            <circle
              cx="28"
              cy="28"
              r="22"
              fill="none"
              class="stroke-slate-100 dark:stroke-slate-800"
              stroke-width="5"
            />
            <circle
              cx="28"
              cy="28"
              r="22"
              fill="none"
              :stroke="summary?.dimsumStock.is_low_stock ? '#ee6352' : '#0d9488'"
              stroke-width="5"
              stroke-linecap="round"
              :stroke-dasharray="stockRingCircumference"
              :stroke-dashoffset="stockRingOffset"
              class="transition-all duration-700"
            />
          </svg>
          <span
            class="absolute text-[10px] font-bold tabular-nums"
            :class="summary?.dimsumStock.is_low_stock ? 'text-[#ee6352]' : 'text-[#0d9488] dark:text-teal-400'"
          >
            {{ stockHealthPercent }}%
          </span>
        </div>
      </div>
    </div>

    <!-- ROW 2: 7-Day Trend Bar Chart (7 cols) + Payment Channel Semi-Gauge (5 cols) -->
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div class="xl:col-span-7">
        <SalesDualBarChart :points="summary?.trenPenjualan7Hari ?? []" />
      </div>

      <div class="xl:col-span-5">
        <ChannelBubbleChart
          :stats="summary?.channelStats ?? {
            totalTransaksi7Hari: 0,
            dineInCount: 0,
            dineInPct: 0,
            takeawayCount: 0,
            takeawayPct: 0,
            qrisCount: 0,
            qrisPct: 0,
            tunaiCount: 0,
            tunaiPct: 0,
            shopeeFoodCount: 0,
            shopeeFoodPct: 0,
            goFoodCount: 0,
            goFoodPct: 0
          }"
          :qris-revenue-today="summary?.kpi.totalQrisHariIni ?? 0"
          :tunai-revenue-today="summary?.kpi.totalTunaiHariIni ?? 0"
          :shopee-food-revenue-today="summary?.kpi.totalShopeeFoodHariIni ?? 0"
          :go-food-revenue-today="summary?.kpi.totalGoFoodHariIni ?? 0"
        />
      </div>
    </div>

    <!-- ROW 3: 3-Column Bento Grid (Category Donut | Top 5 Menu Leaderboard | Low Stock Reminders) -->
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <!-- Col 1: Statistik Kategori (Leads Overview style) -->
      <div class="xl:col-span-4">
        <CategoryPieChart
          class="h-full"
          :items="summary?.categoryStats ?? []"
          :stats-by-range="summary?.categoryStatsByRange"
        />
      </div>

      <!-- Col 2: Top 5 Menu Terlaris (Team Performance style) -->
      <div class="saas-card flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33] sm:p-6 xl:col-span-4">
        <div>
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-base font-bold tracking-tight text-[#0f213d] dark:text-white">
                Top 5 Menu Terlaris
              </h2>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Peringkat penjualan menu terbaik
              </p>
            </div>
            <NuxtLink
              to="/reports"
              class="text-xs font-semibold text-[#0d9488] hover:underline dark:text-teal-400"
            >
              Semua
            </NuxtLink>
          </div>

          <div
            v-if="!summary || summary.top5MenuTerlaris.length === 0"
            class="mt-6 flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center dark:border-slate-700 dark:bg-[#0b1424]"
          >
            <UIcon name="i-heroicons-trophy" class="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p class="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Belum ada data penjualan</p>
          </div>

          <div v-else class="mt-5 space-y-4">
            <div
              v-for="(menu, index) in summary.top5MenuTerlaris"
              :key="menu.id_produk"
              class="flex items-center gap-3"
            >
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                :class="
                  index === 0
                    ? 'bg-[#0d9488] text-white'
                    : index === 1
                      ? 'bg-[#0f213d] text-white dark:bg-[#1e3a5f]'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                "
              >
                {{ index + 1 }}
              </span>

              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <p class="truncate font-semibold text-[#0f213d] dark:text-white">
                    {{ menu.nama_menu }}
                  </p>
                  <p class="shrink-0 font-bold text-[#0f213d] tabular-nums dark:text-slate-100">
                    {{ formatRupiah(menu.total_pendapatan) }}
                  </p>
                </div>

                <div class="mt-1.5 flex items-center gap-2.5">
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      class="h-full rounded-full bg-[#0d9488] transition-all duration-500"
                      :style="{ width: `${Math.max(12, Math.round((menu.total_terjual / topMenuMaxQty) * 100))}%` }"
                    />
                  </div>
                  <span class="shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                    {{ menu.total_terjual }} {{ menu.satuan }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
          <NuxtLink
            to="/reports"
            class="text-xs font-semibold text-[#0d9488] hover:underline dark:text-teal-400"
          >
            Lihat Laporan Penjualan Lengkap →
          </NuxtLink>
        </div>
      </div>

      <!-- Col 3: Peringatan Stok Menipis (Follow-up Reminders style) -->
      <div class="saas-card flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33] sm:p-6 xl:col-span-4">
        <div>
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-base font-bold tracking-tight text-[#0f213d] dark:text-white">
                Pengingat Stok
              </h2>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Stok menipis yang perlu segera diisi
              </p>
            </div>
            <span
              class="rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums"
              :class="
                (summary?.kpi.jumlahStokMenipis ?? 0) > 0
                  ? 'bg-rose-50 text-[#ee6352] dark:bg-rose-950/60 dark:text-rose-300'
                  : 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
              "
            >
              {{ summary?.kpi.jumlahStokMenipis ?? 0 }} item
            </span>
          </div>

          <div class="mt-4 space-y-2.5">
            <!-- Shared Dimsum Pool Low Stock Reminder -->
            <div
              v-if="summary?.dimsumStock.is_low_stock"
              class="flex items-center justify-between gap-3 rounded-xl border border-rose-200/80 bg-rose-50/70 p-3 dark:border-rose-500/30 dark:bg-rose-950/30"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span class="shrink-0 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-[#ee6352] shadow-sm tabular-nums dark:bg-[#111d33]">
                  {{ summary.dimsumStock.stok_pcs }} pcs
                </span>
                <div class="min-w-0">
                  <p class="truncate text-xs font-bold text-[#0f213d] dark:text-white">
                    Stok Dimsum Bersama
                  </p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">
                    Min. {{ summary.dimsumStock.stok_minimum_pcs }} pcs
                  </p>
                </div>
              </div>

              <NuxtLink
                to="/productions"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ee6352] text-white transition-colors hover:bg-[#dc4e3d]"
                title="Tambah Produksi Dimsum"
              >
                <UIcon name="i-heroicons-plus" class="h-4 w-4" />
              </NuxtLink>
            </div>

            <!-- Empty State when all stocks are safe -->
            <div
              v-if="!summary?.dimsumStock.is_low_stock && (!summary || summary.stokMenipis.length === 0)"
              class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center dark:border-slate-700 dark:bg-[#0b1424]"
            >
              <div class="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-400">
                <UIcon name="i-heroicons-check-circle" class="h-6 w-6" />
              </div>
              <p class="mt-2.5 text-sm font-bold text-[#0f213d] dark:text-white">Semua Stok Aman</p>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Stok dimsum &amp; minuman di atas batas minimum.
              </p>
            </div>

            <!-- Separate Beverage/Sauce Low Stock Rows -->
            <div
              v-for="item in summary?.stokMenipis ?? []"
              :key="item.id_produk"
              class="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-[#0b1424]/70 dark:hover:bg-slate-800/40"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="shrink-0 rounded-md px-2 py-1 text-[11px] font-bold tabular-nums"
                  :class="item.stok <= 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'"
                >
                  {{ item.stok }} {{ item.satuan }}
                </span>
                <div class="min-w-0">
                  <p class="truncate text-xs font-bold text-[#0f213d] dark:text-white">
                    {{ item.nama_menu }}
                  </p>
                  <p class="text-[11px] text-slate-400">
                    {{ item.kode_barang }} · Min. {{ item.stok_minimum }}
                  </p>
                </div>
              </div>

              <button
                type="button"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488] transition-colors hover:bg-[#0d9488] hover:text-white dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-600 dark:hover:text-white"
                title="Restock Cepat"
                @click="openRestock(item)"
              >
                <UIcon name="i-heroicons-plus" class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div class="mt-5 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
          <NuxtLink
            to="/products"
            class="text-xs font-semibold text-[#0d9488] hover:underline dark:text-teal-400"
          >
            Kelola Semua Menu &amp; Stok →
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Quick Restock Modal -->
    <RestockModal
      v-model="restockModalOpen"
      :product="selectedProduct"
      @restocked="fetchSummary"
    />

    <!-- Store QRIS Image Setting Modal -->
    <QrisSettingModal v-model="qrisSettingOpen" />
  </div>
</template>
