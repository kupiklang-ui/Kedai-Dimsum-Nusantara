<script setup lang="ts">
import {
  formatPaymentMethodLabel,
  isDriverFoodPayment,
  type ReceiptData,
  type SalesHistoryTransaction,
  type SalesReportResponse,
  type ShiftHistoryResponse
} from '~/types/pos'
import { formatDateTimeWib, formatRupiah } from '~/utils/format'

definePageMeta({
  layout: 'admin'
})

const toast = useToast()

function getLocalTodayString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getLocalYesterdayString(): string {
  const dt = new Date()
  dt.setDate(dt.getDate() - 1)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getLocalMonthString(offsetMonths = 0): string {
  const dt = new Date()
  dt.setDate(1)
  dt.setMonth(dt.getMonth() + offsetMonths)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const mode = ref<'daily' | 'monthly'>('daily')
const selectedDate = ref(getLocalTodayString())
const selectedMonth = ref(getLocalMonthString(0))
const paymentFilter = ref<'Semua' | 'Tunai' | 'QRIS' | 'DriverFood' | 'ShopeeFood' | 'GoFood'>('Semua')
const searchQuery = ref('')

const report = ref<SalesReportResponse | null>(null)
const shiftReport = ref<ShiftHistoryResponse | null>(null)
const loading = ref(true)
const selectedReceipt = ref<ReceiptData | null>(null)
const receiptModalOpen = ref(false)

async function fetchShiftHistory() {
  try {
    shiftReport.value = await $fetch<ShiftHistoryResponse>('/api/shifts', {
      query: {
        mode: mode.value,
        date: selectedDate.value,
        month: selectedMonth.value
      }
    })
  } catch {
    shiftReport.value = null
  }
}

async function fetchReport() {
  loading.value = true
  try {
    const [salesRes] = await Promise.all([
      $fetch<SalesReportResponse>('/api/reports/sales', {
        query: {
          mode: mode.value,
          date: selectedDate.value,
          month: selectedMonth.value,
          payment: paymentFilter.value,
          search: searchQuery.value.trim() || undefined
        }
      }),
      fetchShiftHistory()
    ])
    report.value = salesRes
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Memuat Riwayat Penjualan',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Periksa koneksi TiDB Cloud.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    loading.value = false
  }
}

watch([mode, selectedDate, selectedMonth, paymentFilter], () => {
  fetchReport()
})

let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    fetchReport()
  }, 300)
})

const grossMarginPct = computed(() => {
  const omzet = report.value?.summary.totalOmzet || 0
  const laba = report.value?.summary.totalLabaKotor || 0
  if (omzet <= 0) return 0
  return Math.round((laba / omzet) * 100)
})

const avgOrderValue = computed(() => {
  const omzet = report.value?.summary.totalOmzet || 0
  const trx = report.value?.summary.totalTransaksi || 0
  if (trx <= 0) return 0
  return Math.round(omzet / trx)
})

const monthlyMaxDayOmzet = computed(() => {
  const rows = report.value?.dailyBreakdown || []
  const maxVal = Math.max(...rows.map(r => r.totalOmzet), 0)
  return maxVal > 0 ? maxVal : 1
})

function openReceipt(trx: SalesHistoryTransaction) {
  selectedReceipt.value = trx
  receiptModalOpen.value = true
}

function drillDownToDay(dateKey: string) {
  selectedDate.value = dateKey
  mode.value = 'daily'
}

function exportCsv() {
  if (!report.value || report.value.transactions.length === 0) {
    toast.add({
      title: 'Tidak Ada Data',
      description: 'Tidak ada transaksi pada periode ini untuk diekspor.',
      color: 'amber',
      icon: 'i-heroicons-information-circle'
    })
    return
  }

  const headers = [
    'No Faktur',
    'Tanggal & Waktu',
    'Kasir',
    'Tipe Pesanan',
    'Metode Pembayaran',
    'Jumlah Item',
    'Total Omzet',
    'Estimasi Laba',
    'Rincian Menu'
  ]

  const rows = report.value.transactions.map((trx) => {
    const itemsText = trx.items
      .map(i => `${i.nama_menu} x${i.qty}${i.catatan ? ` (${i.catatan})` : ''}`)
      .join('; ')

    return [
      trx.no_faktur,
      formatDateTimeWib(trx.tanggal_transaksi),
      trx.kasir.nama,
      'Takeaway',
      formatPaymentMethodLabel(trx.metode_pembayaran),
      trx.total_qty,
      trx.total_harga,
      trx.estimasi_laba,
      itemsText
    ]
  })

  const csvContent = [headers, ...rows]
    .map(cols => cols.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `laporan-penjualan-${report.value.mode}-${report.value.period}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function exportShiftCsv() {
  if (!shiftReport.value || shiftReport.value.shifts.length === 0) {
    toast.add({
      title: 'Tidak Ada Data Shift',
      description: 'Belum ada riwayat tutup kasir pada periode ini.',
      color: 'amber',
      icon: 'i-heroicons-information-circle'
    })
    return
  }

  const headers = [
    'ID Shift',
    'Kasir',
    'Waktu Buka',
    'Waktu Tutup',
    'Jml Order',
    'Modal Awal',
    'Tunai Sistem',
    'Target Kas Laci',
    'Uang Fisik Laci',
    'Selisih Kas',
    'QRIS',
    'ShopeeFood',
    'GoFood',
    'Total Omzet',
    'Catatan'
  ]

  const rows = shiftReport.value.shifts.map(s => [
    `#${s.id_shift}`,
    s.kasir_nama,
    formatDateTimeWib(s.waktu_buka),
    s.waktu_tutup ? formatDateTimeWib(s.waktu_tutup) : '-',
    s.total_transaksi,
    s.modal_awal,
    s.total_tunai_sistem,
    s.ekspektasi_kas_laci,
    s.uang_fisik_laci ?? 0,
    s.selisih_kas ?? 0,
    s.total_qris_sistem,
    s.total_shopeefood_sistem,
    s.total_gofood_sistem,
    s.total_omzet,
    s.catatan || ''
  ])

  const csvContent = [headers, ...rows]
    .map(cols => cols.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `rekap-tutup-kasir-${shiftReport.value.mode}-${shiftReport.value.period}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  fetchReport()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Clean Page Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-[#0f213d] dark:text-white">
          Laporan &amp; Riwayat Penjualan
        </h1>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
          Periode aktif:
          <strong class="text-[#0f213d] dark:text-white">{{ report?.periodLabel || '...' }}</strong>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          :disabled="loading"
          class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0d9488] hover:text-[#0d9488] disabled:opacity-50 dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200 dark:hover:border-teal-500"
          @click="fetchReport"
        >
          <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          <span>Muat Ulang</span>
        </button>

        <button
          type="button"
          class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0b7a71]"
          @click="exportCsv"
        >
          <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>

    <!-- Mode Switcher & Period Filters -->
    <div class="saas-card space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#111d33]">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div class="grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-[#0b1424] sm:inline-flex sm:w-auto">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:px-3.5"
            :class="
              mode === 'daily'
                ? 'bg-[#0d9488] text-white'
                : 'text-slate-600 hover:text-[#0f213d] dark:text-slate-400 dark:hover:text-white'
            "
            @click="mode = 'daily'"
          >
            <UIcon name="i-heroicons-calendar-days" class="h-4 w-4 shrink-0" />
            <span>Per Hari</span>
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:px-3.5"
            :class="
              mode === 'monthly'
                ? 'bg-[#0d9488] text-white'
                : 'text-slate-600 hover:text-[#0f213d] dark:text-slate-400 dark:hover:text-white'
            "
            @click="mode = 'monthly'"
          >
            <UIcon name="i-heroicons-calendar" class="h-4 w-4 shrink-0" />
            <span>Per Bulan</span>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <template v-if="mode === 'daily'">
            <input
              v-model="selectedDate"
              type="date"
              class="h-9 rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-[#0f213d] focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
            >
            <button
              type="button"
              class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200 dark:hover:border-teal-500"
              @click="selectedDate = getLocalTodayString()"
            >
              Hari Ini
            </button>
            <button
              type="button"
              class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200 dark:hover:border-teal-500"
              @click="selectedDate = getLocalYesterdayString()"
            >
              Kemarin
            </button>
          </template>

          <template v-else>
            <input
              v-model="selectedMonth"
              type="month"
              class="h-9 rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-[#0f213d] focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
            >
            <button
              type="button"
              class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200 dark:hover:border-teal-500"
              @click="selectedMonth = getLocalMonthString(0)"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200 dark:hover:border-teal-500"
              @click="selectedMonth = getLocalMonthString(-1)"
            >
              Bulan Lalu
            </button>
          </template>
        </div>
      </div>

      <!-- Secondary Filters (Search & Payment) -->
      <div class="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-2">
        <div class="relative">
          <UIcon
            name="i-heroicons-magnifying-glass"
            class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nomor faktur atau nama kasir..."
            class="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-10 pr-4 text-xs text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:placeholder-slate-500"
          >
        </div>

        <select
          v-model="paymentFilter"
          class="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-semibold text-[#0f213d] focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
        >
          <option value="Semua">Semua Metode Pembayaran</option>
          <option value="Tunai">Hanya Tunai</option>
          <option value="QRIS">Hanya QRIS</option>
          <option value="DriverFood">Semua Driver Food (ShopeeFood &amp; GoFood)</option>
          <option value="ShopeeFood">Pembayaran Driver · ShopeeFood</option>
          <option value="GoFood">Pembayaran Driver · GoFood (Gojek)</option>
        </select>
      </div>
    </div>

    <!-- 4 Summary KPI Cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="saas-card rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33]">
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
          Total Omzet ({{ mode === 'daily' ? 'Harian' : 'Bulanan' }})
        </p>
        <p class="mt-1.5 text-2xl font-extrabold text-[#0f213d] tabular-nums dark:text-white">
          {{ formatRupiah(report?.summary.totalOmzet ?? 0) }}
        </p>
        <div class="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5 text-[10px] dark:border-slate-800">
          <span class="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 tabular-nums dark:bg-slate-800 dark:text-slate-200">
            Tunai: {{ formatRupiah(report?.summary.totalTunai ?? 0) }}
          </span>
          <span class="rounded-md bg-teal-50 px-2 py-0.5 font-semibold text-[#0d9488] tabular-nums dark:bg-teal-950/60 dark:text-teal-300">
            QRIS: {{ formatRupiah(report?.summary.totalQris ?? 0) }}
          </span>
          <span
            v-if="(report?.summary.totalShopeeFood ?? 0) > 0"
            class="rounded-md bg-orange-50 px-2 py-0.5 font-semibold text-[#ee4d2d] tabular-nums dark:bg-orange-950/60 dark:text-orange-300"
          >
            ShopeeFood: {{ formatRupiah(report?.summary.totalShopeeFood ?? 0) }}
          </span>
          <span
            v-if="(report?.summary.totalGoFood ?? 0) > 0"
            class="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-[#00aa13] tabular-nums dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            GoFood: {{ formatRupiah(report?.summary.totalGoFood ?? 0) }}
          </span>
        </div>
      </div>

      <div class="saas-card rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33]">
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
          Estimasi Laba Kotor
        </p>
        <p class="mt-1.5 text-2xl font-extrabold text-[#0d9488] tabular-nums dark:text-teal-400">
          {{ formatRupiah(report?.summary.totalLabaKotor ?? 0) }}
        </p>
        <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] dark:border-slate-800">
          <span class="text-slate-500 dark:text-slate-400">Margin Kotor</span>
          <span class="rounded-md bg-teal-50 px-2 py-0.5 font-bold text-[#0d9488] tabular-nums dark:bg-teal-950/60 dark:text-teal-300">
            {{ grossMarginPct }}%
          </span>
        </div>
      </div>

      <div class="saas-card rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33]">
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
          Total Transaksi
        </p>
        <p class="mt-1.5 text-2xl font-extrabold text-[#0f213d] tabular-nums dark:text-white">
          {{ report?.summary.totalTransaksi ?? 0 }}
          <span class="text-xs font-semibold text-slate-400">Faktur</span>
        </p>
        <div class="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5 text-[10px] dark:border-slate-800">
          <span class="rounded-md bg-sky-50 px-2 py-0.5 font-semibold text-[#2e86c1] dark:bg-sky-950/60 dark:text-sky-300">
            100% Takeaway (Bungkus)
          </span>
        </div>
      </div>

      <div class="saas-card rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33]">
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
          Total Item Terjual
        </p>
        <p class="mt-1.5 text-2xl font-extrabold text-[#0f213d] tabular-nums dark:text-white">
          {{ report?.summary.totalItemTerjual ?? 0 }}
          <span class="text-xs font-semibold text-slate-400">Item</span>
        </p>
        <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] dark:border-slate-800">
          <span class="text-slate-500 dark:text-slate-400">Rata-rata / Faktur</span>
          <span class="font-bold text-[#0f213d] tabular-nums dark:text-slate-200">
            {{ formatRupiah(avgOrderValue) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Monthly Daily Breakdown Table (Only shown in Monthly mode) -->
    <div
      v-if="mode === 'monthly'"
      class="saas-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111d33]"
    >
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
        <div>
          <h2 class="text-sm font-bold text-[#0f213d] dark:text-white">
            Rekap Penjualan Harian · {{ report?.periodLabel }}
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Klik "Detail Hari" pada salah satu tanggal untuk melihat rincian transaksinya
          </p>
        </div>
        <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 tabular-nums dark:bg-slate-800 dark:text-slate-300">
          {{ report?.dailyBreakdown.length ?? 0 }} Hari Aktif
        </span>
      </div>

      <div
        v-if="!report || report.dailyBreakdown.length === 0"
        class="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400"
      >
        Belum ada transaksi penjualan pada bulan {{ report?.periodLabel }}.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-left text-xs dark:divide-slate-800">
          <thead class="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#0b1424]/70 dark:text-slate-400">
            <tr>
              <th class="px-5 py-3">Tanggal</th>
              <th class="px-5 py-3 text-right">Faktur</th>
              <th class="px-5 py-3 text-right">Item</th>
              <th class="px-5 py-3 text-right">Tunai</th>
              <th class="px-5 py-3 text-right">QRIS</th>
              <th class="px-5 py-3 text-right">Driver Food</th>
              <th class="px-5 py-3 text-right">Omzet Harian</th>
              <th class="px-5 py-3 text-right">Estimasi Laba</th>
              <th class="px-5 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="row in report.dailyBreakdown"
              :key="row.date"
              class="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/35"
            >
              <td class="whitespace-nowrap px-5 py-3.5">
                <p class="font-semibold text-[#0f213d] dark:text-white">{{ row.label }}</p>
                <div class="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    class="h-full rounded-full bg-[#0d9488]"
                    :style="{ width: `${Math.max(8, Math.round((row.totalOmzet / monthlyMaxDayOmzet) * 100))}%` }"
                  />
                </div>
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                {{ row.totalTransaksi }}
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                {{ row.totalItem }}
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                {{ formatRupiah(row.totalTunai) }}
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                {{ formatRupiah(row.totalQris) }}
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-[#ee4d2d] dark:text-orange-300 tabular-nums">
                {{ formatRupiah((row.totalShopeeFood || 0) + (row.totalGoFood || 0)) }}
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 text-right font-bold text-[#0f213d] dark:text-white tabular-nums">
                {{ formatRupiah(row.totalOmzet) }}
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 text-right font-bold text-[#0d9488] dark:text-teal-400 tabular-nums">
                {{ formatRupiah(row.totalLabaKotor) }}
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 text-right">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-[#0d9488] transition-colors hover:bg-[#0d9488] hover:text-white dark:border-teal-500/30 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-600 dark:hover:text-white"
                  @click="drillDownToDay(row.date)"
                >
                  <span>Detail Hari</span>
                  <UIcon name="i-heroicons-arrow-right" class="h-3 w-3" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detailed Transaction History Table -->
    <div class="saas-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111d33]">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
        <div>
          <h2 class="text-sm font-bold text-[#0f213d] dark:text-white">
            Daftar Riwayat Transaksi · {{ report?.periodLabel }}
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Menampilkan setiap nomor faktur lengkap beserta rincian item dan tombol cetak ulang struk
          </p>
        </div>
        <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 tabular-nums dark:bg-slate-800 dark:text-slate-300">
          {{ report?.transactions.length ?? 0 }} Transaksi
        </span>
      </div>

      <div v-if="loading && !report" class="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Memuat riwayat penjualan...
      </div>

      <div
        v-else-if="!report || report.transactions.length === 0"
        class="flex flex-col items-center justify-center px-6 py-12 text-center"
      >
        <UIcon name="i-heroicons-receipt-percent" class="h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p class="mt-3 text-sm font-bold text-[#0f213d] dark:text-white">Belum ada transaksi penjualan</p>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Tidak ditemukan transaksi pada periode <strong>{{ report?.periodLabel }}</strong> dengan filter aktif.
        </p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-left text-xs dark:divide-slate-800">
          <thead class="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#0b1424]/70 dark:text-slate-400">
            <tr>
              <th class="px-5 py-3">Faktur &amp; Waktu</th>
              <th class="px-5 py-3">Kasir</th>
              <th class="px-5 py-3">Rincian Item</th>
              <th class="px-5 py-3">Bayar</th>
              <th class="px-5 py-3 text-right">Total &amp; Laba</th>
              <th class="px-5 py-3 text-right">Struk</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="trx in report.transactions"
              :key="trx.no_faktur"
              class="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/35"
            >
              <td class="whitespace-nowrap px-5 py-3.5">
                <p class="font-mono font-bold text-[#0f213d] dark:text-white tabular-nums">
                  {{ trx.no_faktur }}
                </p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {{ formatDateTimeWib(trx.tanggal_transaksi) }}
                </p>
              </td>

              <td class="whitespace-nowrap px-5 py-3.5">
                <p class="font-semibold text-slate-700 dark:text-slate-200">{{ trx.kasir.nama }}</p>
                <p class="text-[10px] text-slate-400">@{{ trx.kasir.username }}</p>
              </td>

              <td class="max-w-xs px-5 py-3.5">
                <div class="space-y-0.5">
                  <p
                    v-for="(item, idx) in trx.items.slice(0, 3)"
                    :key="`${trx.no_faktur}-${item.id_produk}-${idx}`"
                    class="truncate text-[11px] text-slate-600 dark:text-slate-300"
                  >
                    <span class="font-bold text-[#0f213d] dark:text-white">{{ item.qty }}x</span> {{ item.nama_menu }}
                    <span v-if="item.catatan" class="italic text-amber-600 dark:text-amber-300">({{ item.catatan }})</span>
                  </p>
                  <p v-if="trx.items.length > 3" class="text-[10px] font-medium text-slate-400">
                    +{{ trx.items.length - 3 }} menu lainnya
                  </p>
                </div>
              </td>

              <td class="whitespace-nowrap px-5 py-3.5">
                <div class="space-y-1">
                  <span
                    class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold"
                    :class="
                      trx.metode_pembayaran === 'ShopeeFood'
                        ? 'bg-orange-50 text-[#ee4d2d] ring-1 ring-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-500/30'
                        : trx.metode_pembayaran === 'GoFood'
                          ? 'bg-emerald-50 text-[#00aa13] ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-500/30'
                          : trx.metode_pembayaran === 'QRIS'
                            ? 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    "
                  >
                    <UIcon
                      v-if="isDriverFoodPayment(trx.metode_pembayaran)"
                      :name="trx.metode_pembayaran === 'ShopeeFood' ? 'i-heroicons-shopping-bag' : 'i-heroicons-truck'"
                      class="h-3 w-3"
                    />
                    <span>
                      {{
                        trx.metode_pembayaran === 'ShopeeFood'
                          ? 'Pembayaran Driver · ShopeeFood'
                          : trx.metode_pembayaran === 'GoFood'
                            ? 'Pembayaran Driver · GoFood (Gojek)'
                            : trx.metode_pembayaran
                      }}
                    </span>
                  </span>
                  <div v-if="isDriverFoodPayment(trx.metode_pembayaran)" class="flex flex-wrap items-center gap-1 text-[10px]">
                    <span
                      v-if="trx.status_pesanan"
                      class="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {{ trx.status_pesanan }}
                    </span>
                    <span v-if="trx.kode_order_driver" class="font-mono text-slate-500 dark:text-slate-400">
                      {{ trx.kode_order_driver }}
                    </span>
                  </div>
                </div>
              </td>

              <td class="whitespace-nowrap px-5 py-3.5 text-right">
                <p class="text-sm font-bold text-[#0f213d] dark:text-white tabular-nums">
                  {{ formatRupiah(trx.total_harga) }}
                </p>
                <p class="text-[10px] font-semibold text-[#0d9488] dark:text-teal-400 tabular-nums">
                  Laba +{{ formatRupiah(trx.estimasi_laba) }}
                </p>
              </td>

              <td class="whitespace-nowrap px-5 py-3.5 text-right">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg bg-[#0f213d] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0d9488] dark:bg-[#0d9488] dark:hover:bg-[#0b7a71]"
                  @click="openReceipt(trx)"
                >
                  <UIcon name="i-heroicons-printer" class="h-3.5 w-3.5" />
                  <span>Struk</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Riwayat Tutup Kasir / Shift (Closing & Rekap Laci) -->
    <div class="saas-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111d33]">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300">
            <UIcon name="i-heroicons-banknotes" class="h-5 w-5" />
          </div>
          <div>
            <h2 class="text-sm font-extrabold text-[#0f213d] dark:text-white">
              Riwayat Tutup Kasir &amp; Rekap Laci (Closing Shift)
            </h2>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              Pencocokan uang fisik laci kasir terhadap penjualan tunai sistem pada periode {{ report?.periodLabel || '...' }}
            </p>
          </div>
        </div>

        <button
          type="button"
          class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200"
          @click="exportShiftCsv"
        >
          <UIcon name="i-heroicons-arrow-down-tray" class="h-3.5 w-3.5" />
          <span>Export CSV Shift</span>
        </button>
      </div>

      <!-- Mini Summary Strip -->
      <div
        v-if="shiftReport"
        class="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-[#0b1424]/50 sm:grid-cols-4"
      >
        <div>
          <p class="text-[10px] font-semibold uppercase text-slate-400">Shift Ditutup</p>
          <p class="mt-0.5 text-sm font-extrabold text-[#0f213d] tabular-nums dark:text-white">
            {{ shiftReport.summary.totalShifts }} Shift
          </p>
        </div>
        <div>
          <p class="text-[10px] font-semibold uppercase text-slate-400">Status Kas Laci</p>
          <p class="mt-0.5 text-xs font-bold tabular-nums">
            <span class="text-[#0d9488]">{{ shiftReport.summary.pasCount }} Pas</span>
            <span class="mx-1 text-slate-300">·</span>
            <span class="text-[#2e86c1]">{{ shiftReport.summary.lebihCount }} Lebih</span>
            <span class="mx-1 text-slate-300">·</span>
            <span class="text-[#ee6352]">{{ shiftReport.summary.kurangCount }} Kurang</span>
          </p>
        </div>
        <div>
          <p class="text-[10px] font-semibold uppercase text-slate-400">Total Tunai Fisik Laci</p>
          <p class="mt-0.5 text-sm font-extrabold text-[#0f213d] tabular-nums dark:text-white">
            {{ formatRupiah(shiftReport.summary.totalUangFisik) }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-semibold uppercase text-slate-400">Total Selisih Kas</p>
          <p
            class="mt-0.5 text-sm font-extrabold tabular-nums"
            :class="
              shiftReport.summary.totalSelisihBersih === 0
                ? 'text-[#0d9488]'
                : shiftReport.summary.totalSelisihBersih > 0
                  ? 'text-[#2e86c1]'
                  : 'text-[#ee6352]'
            "
          >
            {{
              shiftReport.summary.totalSelisihBersih === 0
                ? 'Rp 0 (Pas)'
                : shiftReport.summary.totalSelisihBersih > 0
                  ? `+${formatRupiah(shiftReport.summary.totalSelisihBersih)}`
                  : `-${formatRupiah(Math.abs(shiftReport.summary.totalSelisihBersih))}`
            }}
          </p>
        </div>
      </div>

      <div
        v-if="!shiftReport || shiftReport.shifts.length === 0"
        class="flex flex-col items-center justify-center px-5 py-10 text-center"
      >
        <UIcon name="i-heroicons-clipboard-document-check" class="h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p class="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          Belum Ada Laporan Tutup Kasir pada Periode Ini
        </p>
        <p class="mt-0.5 text-[11px] text-slate-400">
          Riwayat akan muncul otomatis setiap kali Kasir menyelesaikan menu Tutup Kasir (Closing) di layar POS.
        </p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-xs dark:divide-slate-800">
          <thead class="bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-[#0b1424]/70">
            <tr>
              <th class="px-5 py-3 text-left">Shift &amp; Kasir</th>
              <th class="px-4 py-3 text-right">Modal Awal</th>
              <th class="px-4 py-3 text-right">Tunai Sistem</th>
              <th class="px-4 py-3 text-right">Target Laci</th>
              <th class="px-4 py-3 text-right">Fisik Laci</th>
              <th class="px-4 py-3 text-right">Selisih Kas</th>
              <th class="px-5 py-3 text-right">Non-Tunai &amp; Omzet</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="s in shiftReport.shifts"
              :key="s.id_shift"
              class="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
            >
              <td class="px-5 py-3.5">
                <p class="font-extrabold text-[#0f213d] dark:text-white">
                  Shift #{{ s.id_shift }} · {{ s.kasir_nama }}
                </p>
                <p class="mt-0.5 text-[10px] text-slate-400">
                  {{ formatDateTimeWib(s.waktu_buka) }} → {{ s.waktu_tutup ? formatDateTimeWib(s.waktu_tutup) : '-' }}
                </p>
                <p v-if="s.catatan" class="mt-1 text-[11px] italic text-slate-500 dark:text-slate-400">
                  "{{ s.catatan }}"
                </p>
              </td>
              <td class="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-slate-600 tabular-nums dark:text-slate-300">
                {{ formatRupiah(s.modal_awal) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-slate-700 tabular-nums dark:text-slate-200">
                {{ formatRupiah(s.total_tunai_sistem) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3.5 text-right font-bold text-[#0f213d] tabular-nums dark:text-white">
                {{ formatRupiah(s.ekspektasi_kas_laci) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3.5 text-right font-extrabold text-[#0d9488] tabular-nums dark:text-teal-300">
                {{ formatRupiah(s.uang_fisik_laci ?? 0) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3.5 text-right">
                <span
                  class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums"
                  :class="
                    (s.selisih_kas ?? 0) === 0
                      ? 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
                      : (s.selisih_kas ?? 0) > 0
                        ? 'bg-blue-50 text-[#2e86c1] dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-rose-50 text-[#ee6352] dark:bg-rose-950/60 dark:text-rose-300'
                  "
                >
                  {{
                    (s.selisih_kas ?? 0) === 0
                      ? 'Pas Rp 0'
                      : (s.selisih_kas ?? 0) > 0
                        ? `Lebih +${formatRupiah(s.selisih_kas ?? 0)}`
                        : `Kurang -${formatRupiah(Math.abs(s.selisih_kas ?? 0))}`
                  }}
                </span>
              </td>
              <td class="whitespace-nowrap px-5 py-3.5 text-right">
                <p class="font-extrabold text-[#0f213d] tabular-nums dark:text-white">
                  {{ formatRupiah(s.total_omzet) }}
                </p>
                <p class="text-[10px] text-slate-400 tabular-nums">
                  {{ s.total_transaksi }} order · QRIS {{ formatRupiah(s.total_qris_sistem) }} · Driver {{ formatRupiah(s.total_shopeefood_sistem + s.total_gofood_sistem) }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Reprint Receipt Modal -->
    <ReceiptModal
      v-model="receiptModalOpen"
      :receipt="selectedReceipt"
    />
  </div>
</template>
