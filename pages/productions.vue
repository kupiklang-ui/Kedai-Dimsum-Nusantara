<script setup lang="ts">
import type {
  DailyProductionResponse,
  ProductionInputType,
  StockRequestItem,
  StockRequestsResponse
} from '~/types/pos'
import { formatDateTimeWib } from '~/utils/format'

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

const selectedDate = ref(getLocalTodayString())
const inputType = ref<ProductionInputType>('tambah')
const qtyProduksi = ref<number>(200)
const stokMinimumPcs = ref<number>(20)
const batchNote = ref('Batch Pagi')

const data = ref<DailyProductionResponse | null>(null)
const loading = ref(true)
const submitting = ref(false)

// Pengajuan pasokan stok dari Kasir
const stockRequests = ref<StockRequestItem[]>([])
const loadingRequests = ref(false)
const processingRequestId = ref<number | null>(null)
const sendQtyDraft = reactive<Record<number, number>>({})
const sendNoteDraft = reactive<Record<number, string>>({})
let requestPollTimer: ReturnType<typeof setInterval> | null = null

const activeKasirRequests = computed(() =>
  stockRequests.value.filter(r => r.status === 'Menunggu Admin' || r.status === 'Sedang Diproduksi')
)

const recentFulfilledRequests = computed(() =>
  stockRequests.value.filter(r => r.status === 'Dikirim ke Kasir' || r.status === 'Diterima Kasir').slice(0, 5)
)

const qtyPresets = [50, 100, 200, 300]
const notePresets = ['Batch Pagi', 'Batch Siang', 'Tambahan Sore', 'Stok Fresh Harian']

const validQtyProduksi = computed(() => {
  const qty = Number(qtyProduksi.value)
  return Number.isInteger(qty) && qty > 0 ? qty : 0
})

async function fetchProductions() {
  loading.value = true
  try {
    const res = await $fetch<DailyProductionResponse>('/api/productions', {
      query: { date: selectedDate.value }
    })
    data.value = res
    stokMinimumPcs.value = res.dimsumStock.stok_minimum_pcs
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Memuat Data Produksi',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Periksa koneksi TiDB Cloud.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    loading.value = false
  }
}

watch(selectedDate, () => {
  fetchProductions()
})

const isViewingToday = computed(() => selectedDate.value === getLocalTodayString())

const projectedStockPcs = computed(() => {
  const current = data.value?.dimsumStock.stok_pcs ?? 0
  const qty = Number(qtyProduksi.value)
  if (!Number.isInteger(qty) || qty <= 0) return current
  return inputType.value === 'set_harian' ? qty : current + qty
})

async function handleSaveProduction() {
  const qty = Number(qtyProduksi.value)
  if (!Number.isInteger(qty) || qty <= 0) {
    toast.add({
      title: 'Jumlah Tidak Valid',
      description: 'Masukkan jumlah produksi dimsum minimal 1 pcs.',
      color: 'amber',
      icon: 'i-heroicons-exclamation-circle'
    })
    return
  }

  submitting.value = true
  try {
    const res = await $fetch<{ success: boolean, message: string }>('/api/productions', {
      method: 'POST',
      body: {
        tipe_input: inputType.value,
        qty_produksi: qty,
        stok_minimum_pcs: Number(stokMinimumPcs.value),
        catatan: batchNote.value.trim() || null
      }
    })

    toast.add({
      title: 'Stok Produksi Dimsum Diperbarui',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })

    selectedDate.value = getLocalTodayString()
    await fetchProductions()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Menyimpan Produksi',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Terjadi kesalahan saat menyimpan produksi.',
      color: 'red',
      icon: 'i-heroicons-x-circle'
    })
  } finally {
    submitting.value = false
  }
}

async function fetchStockRequests(silent = false) {
  if (!silent) loadingRequests.value = true
  try {
    const res = await $fetch<StockRequestsResponse>('/api/stock-requests')
    stockRequests.value = res.requests
    for (const req of res.requests) {
      if (sendQtyDraft[req.id_request] === undefined) {
        sendQtyDraft[req.id_request] = req.qty_diminta
      }
      if (sendNoteDraft[req.id_request] === undefined) {
        sendNoteDraft[req.id_request] = `Pasokan +${req.qty_diminta} pcs sudah diproduksi & dikirim ke Kasir.`
      }
    }
  } catch {
    // Keep previous state silently
  } finally {
    if (!silent) loadingRequests.value = false
  }
}

async function handleStartProductionForRequest(req: StockRequestItem) {
  processingRequestId.value = req.id_request
  try {
    const res = await $fetch<{ success: boolean, message: string }>(`/api/stock-requests/${req.id_request}`, {
      method: 'PATCH',
      body: {
        action: 'start_production',
        catatan_admin: 'Dimsum sedang diproduksi di dapur, sebentar lagi dikirim ke Kasir.'
      }
    })
    toast.add({
      title: 'Status Diperbarui',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-fire'
    })
    await fetchStockRequests(true)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Memperbarui',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    processingRequestId.value = null
  }
}

async function handleProduceAndSendToKasir(req: StockRequestItem) {
  const qty = Number(sendQtyDraft[req.id_request] || req.qty_diminta)
  if (!Number.isInteger(qty) || qty <= 0) {
    toast.add({
      title: 'Jumlah Tidak Valid',
      description: 'Masukkan jumlah pcs produksi yang dikirim minimal 1 pcs.',
      color: 'amber',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }

  processingRequestId.value = req.id_request
  try {
    const res = await $fetch<{ success: boolean, message: string }>(`/api/stock-requests/${req.id_request}`, {
      method: 'PATCH',
      body: {
        action: 'produce_and_send',
        qty_dikirim: qty,
        catatan_admin: (sendNoteDraft[req.id_request] || '').trim() || `Pasokan +${qty} pcs sudah diproduksi & dikirim ke Kasir.`
      }
    })
    toast.add({
      title: 'Dimsum Diproduksi & Dikirim ke Kasir!',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })
    selectedDate.value = getLocalTodayString()
    await Promise.all([fetchProductions(), fetchStockRequests(true)])
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Mengirim Pasokan',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-x-circle'
    })
  } finally {
    processingRequestId.value = null
  }
}

onMounted(() => {
  fetchProductions()
  fetchStockRequests()
  requestPollTimer = setInterval(() => fetchStockRequests(true), 8000)
})

onBeforeUnmount(() => {
  if (requestPollTimer) clearInterval(requestPollTimer)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Clean Page Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-[#0f213d] dark:text-white">
          Produksi Dimsum Harian
        </h1>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
          Tanggal: <strong class="text-[#0f213d] dark:text-white">{{ data?.dateLabel || '...' }}</strong> ·
          Seluruh menu dimsum otomatis berbagi dari total stok pcs bersama.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="selectedDate"
          type="date"
          class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#0f213d] focus:border-[#0d9488] focus:outline-none dark:border-slate-700 dark:bg-[#111d33] dark:text-white"
        >
        <button
          type="button"
          class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200 dark:hover:border-teal-500"
          @click="selectedDate = getLocalTodayString()"
        >
          Hari Ini
        </button>
        <button
          type="button"
          class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200 dark:hover:border-teal-500"
          @click="selectedDate = getLocalYesterdayString()"
        >
          Kemarin
        </button>
      </div>
    </div>

    <!-- 3 Summary KPI Cards -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div class="saas-card flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33]">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-white">
          <UIcon name="i-heroicons-fire" class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
            Diproduksi ({{ isViewingToday ? 'Hari Ini' : selectedDate }})
          </p>
          <p class="mt-0.5 text-2xl font-extrabold text-[#0f213d] tabular-nums dark:text-white">
            {{ data?.summary.totalDimsumDiproduksiPcs ?? 0 }}
            <span class="text-xs font-semibold text-slate-400">Pcs</span>
          </p>
          <p class="mt-0.5 text-[11px] text-slate-400 tabular-nums">
            Total {{ data?.summary.jumlahBatchHariIni ?? 0 }} batch dicatat
          </p>
        </div>
      </div>

      <div class="saas-card flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-[#111d33]">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0f213d] text-white dark:bg-[#1e3a5f]">
          <UIcon name="i-heroicons-shopping-bag" class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
            Terjual di Kasir ({{ isViewingToday ? 'Hari Ini' : selectedDate }})
          </p>
          <p class="mt-0.5 text-2xl font-extrabold text-[#0f213d] tabular-nums dark:text-white">
            {{ data?.summary.totalDimsumTerjualPcs ?? 0 }}
            <span class="text-xs font-semibold text-slate-400">Pcs</span>
          </p>
          <p class="mt-0.5 text-[11px] text-slate-400">
            Otomatis terpotong dari stok bersama
          </p>
        </div>
      </div>

      <div
        class="saas-card flex items-center gap-4 rounded-2xl border p-5"
        :class="
          data?.dimsumStock.is_low_stock
            ? 'border-rose-200 bg-rose-50/70 dark:border-rose-500/40 dark:bg-rose-950/30'
            : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111d33]'
        "
      >
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
          :class="data?.dimsumStock.is_low_stock ? 'bg-[#ee6352]' : 'bg-[#2e86c1]'"
        >
          <UIcon name="i-heroicons-archive-box" class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
            Sisa Stok Dimsum Bersama
          </p>
          <p
            class="mt-0.5 text-2xl font-extrabold tabular-nums"
            :class="data?.dimsumStock.is_low_stock ? 'text-[#ee6352]' : 'text-[#0f213d] dark:text-white'"
          >
            {{ data?.dimsumStock.stok_pcs ?? 0 }}
            <span class="text-xs font-semibold text-slate-400">Pcs</span>
          </p>
          <p class="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
            Batas menipis: <strong>{{ data?.dimsumStock.stok_minimum_pcs ?? 20 }} pcs</strong>
          </p>
        </div>
      </div>
    </div>

    <!-- Panel Pengajuan Pemasokan Stok dari Kasir -->
    <div
      v-if="activeKasirRequests.length > 0 || recentFulfilledRequests.length > 0"
      class="saas-card overflow-hidden rounded-2xl border bg-white dark:bg-[#111d33]"
      :class="activeKasirRequests.length > 0 ? 'border-rose-200 dark:border-rose-500/40' : 'border-slate-200/80 dark:border-slate-800'"
    >
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
        <div class="flex items-center gap-2.5">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            :class="activeKasirRequests.length > 0 ? 'bg-[#ee6352]' : 'bg-[#0d9488]'"
          >
            <UIcon name="i-heroicons-bell-alert" class="h-5 w-5" />
          </div>
          <div>
            <h2 class="text-base font-bold text-[#0f213d] dark:text-white">
              Pengajuan Pemasokan Stok dari Kasir
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Produksi dimsum &amp; kirim pemberitahuan langsung ke layar Kasir agar stok otomatis bertambah
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
            :class="
              activeKasirRequests.length > 0
                ? 'bg-rose-50 text-[#ee6352] dark:bg-rose-950/60 dark:text-rose-300'
                : 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
            "
          >
            {{ activeKasirRequests.length }} Menunggu Proses
          </span>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300"
            @click="fetchStockRequests()"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" :class="{ 'animate-spin': loadingRequests }" />
          </button>
        </div>
      </div>

      <!-- Active Requests Needing Production & Delivery -->
      <div v-if="activeKasirRequests.length > 0" class="divide-y divide-slate-100 dark:divide-slate-800">
        <div
          v-for="req in activeKasirRequests"
          :key="req.id_request"
          class="grid grid-cols-1 gap-4 p-5 sm:px-6 lg:grid-cols-12 lg:items-center"
        >
          <div class="space-y-1.5 lg:col-span-5">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                :class="
                  req.status === 'Menunggu Admin'
                    ? 'bg-rose-100 text-[#c94538] dark:bg-rose-950/70 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                "
              >
                {{ req.status }}
              </span>
              <span class="text-xs font-bold text-[#0f213d] dark:text-white">
                {{ req.kasir_nama }}
              </span>
              <span class="text-[11px] text-slate-400 tabular-nums">
                · {{ formatDateTimeWib(req.created_at) }}
              </span>
            </div>

            <p class="text-sm font-extrabold text-[#0f213d] tabular-nums dark:text-white">
              Mengajukan <span class="text-[#ee6352]">+{{ req.qty_diminta }} Pcs</span>
              <span class="ml-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                (Sisa saat lapor: {{ req.stok_saat_lapor }} pcs)
              </span>
            </p>
            <p v-if="req.catatan_kasir" class="text-xs italic text-slate-600 dark:text-slate-300">
              "{{ req.catatan_kasir }}"
            </p>
          </div>

          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-12 lg:col-span-7">
            <div class="sm:col-span-4">
              <label class="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Qty Diproduksi &amp; Dikirim (Pcs)
              </label>
              <input
                v-model.number="sendQtyDraft[req.id_request]"
                type="number"
                min="1"
                step="1"
                class="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm font-extrabold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
              >
            </div>
            <div class="sm:col-span-8">
              <label class="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Pesan Pemberitahuan ke Kasir
              </label>
              <input
                v-model="sendNoteDraft[req.id_request]"
                type="text"
                placeholder="cth: Kukusan baru 100 pcs sedang diantar ke kasir"
                class="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-[#0f213d] focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
              >
            </div>

            <div class="flex flex-wrap items-center gap-2 pt-0.5 sm:col-span-12">
              <button
                v-if="req.status === 'Menunggu Admin'"
                type="button"
                :disabled="processingRequestId === req.id_request"
                class="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-500 hover:text-white disabled:opacity-60 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300"
                @click="handleStartProductionForRequest(req)"
              >
                <UIcon name="i-heroicons-fire" class="h-4 w-4" />
                <span>Tandai Sedang Diproduksi</span>
              </button>

              <button
                type="button"
                :disabled="processingRequestId === req.id_request"
                class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-60 sm:flex-none"
                @click="handleProduceAndSendToKasir(req)"
              >
                <UIcon
                  :name="processingRequestId === req.id_request ? 'i-heroicons-arrow-path' : 'i-heroicons-paper-airplane'"
                  class="h-4 w-4"
                  :class="{ 'animate-spin': processingRequestId === req.id_request }"
                />
                <span>
                  {{ processingRequestId === req.id_request ? 'Memproses...' : `Produksi & Kirim ke Kasir (+${sendQtyDraft[req.id_request] || req.qty_diminta} Pcs)` }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Fulfilled Requests Summary Strip -->
      <div
        v-if="recentFulfilledRequests.length > 0"
        class="border-t border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-[#0b1424]/70 sm:px-6"
      >
        <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Pasokan Terakhir yang Dikirim ke Kasir
        </p>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="doneReq in recentFulfilledRequests"
            :key="doneReq.id_request"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] dark:border-slate-700 dark:bg-[#111d33]"
          >
            <span class="font-bold text-[#0d9488] tabular-nums">+{{ doneReq.qty_dikirim ?? doneReq.qty_diminta }} pcs</span>
            <span class="text-slate-500 dark:text-slate-400">ke {{ doneReq.kasir_nama }}</span>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-bold"
              :class="
                doneReq.status === 'Diterima Kasir'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
              "
            >
              {{ doneReq.status }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Single-Pool Dimsum Production Input Card -->
    <form
      class="saas-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111d33]"
      @submit.prevent="handleSaveProduction"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
        <div>
          <h2 class="text-base font-bold text-[#0f213d] dark:text-white">
            Input Jumlah Produksi Dimsum (Pcs)
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Misal produksi pagi 200 pcs — seluruh menu dimsum di kasir otomatis berbagi dari stok ini.
          </p>
        </div>

        <div class="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs dark:border-slate-700 dark:bg-[#0b1424]">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 font-semibold transition-colors"
            :class="
              inputType === 'tambah'
                ? 'bg-[#0d9488] text-white'
                : 'text-slate-600 hover:text-[#0f213d] dark:text-slate-400 dark:hover:text-white'
            "
            @click="inputType = 'tambah'"
          >
            + Tambah Batch
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 font-semibold transition-colors"
            :class="
              inputType === 'set_harian'
                ? 'bg-[#ee6352] text-white'
                : 'text-slate-600 hover:text-[#0f213d] dark:text-slate-400 dark:hover:text-white'
            "
            @click="inputType = 'set_harian'"
          >
            Reset &amp; Set Stok Pagi
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-5 p-5 sm:p-6 lg:grid-cols-12">
        <!-- Left Input Form -->
        <div class="space-y-4 lg:col-span-7">
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Jumlah Dimsum Diproduksi (Pcs) *
            </label>
            <div class="flex flex-wrap items-center gap-2">
              <input
                v-model.number="qtyProduksi"
                type="number"
                min="1"
                step="1"
                required
                class="w-36 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2 text-lg font-extrabold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
              >
              <button
                v-for="preset in qtyPresets"
                :key="preset"
                type="button"
                class="rounded-lg border px-3 py-2 text-xs font-semibold transition-colors tabular-nums"
                :class="
                  qtyProduksi === preset
                    ? 'border-[#0d9488] bg-[#0d9488] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400 hover:bg-teal-50/50 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300 dark:hover:border-teal-500/50'
                "
                @click="qtyProduksi = preset"
              >
                {{ preset }} Pcs
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Catatan Batch Produksi
              </label>
              <input
                v-model="batchNote"
                type="text"
                placeholder="cth: Batch Pagi 07:00"
                class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-medium text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:placeholder-slate-500"
              >
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button
                  v-for="preset in notePresets"
                  :key="preset"
                  type="button"
                  class="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-teal-400 hover:text-teal-700 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300 dark:hover:border-teal-500"
                  @click="batchNote = preset"
                >
                  {{ preset }}
                </button>
              </div>
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Batas Peringatan Menipis (Pcs)
              </label>
              <input
                v-model.number="stokMinimumPcs"
                type="number"
                min="0"
                step="1"
                class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-bold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
              >
              <p class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                Dashboard &amp; Kasir memberi peringatan bila sisa ≤ angka ini.
              </p>
            </div>
          </div>
        </div>

        <!-- Right Live Projection Box -->
        <div class="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-[#0b1424] lg:col-span-5">
          <div>
            <p class="text-xs font-bold text-[#0f213d] dark:text-white">
              {{ inputType === 'set_harian' ? 'Mode Reset & Set Stok Pagi' : 'Mode Tambah Batch Produksi (+)' }}
            </p>
            <p class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {{
                inputType === 'set_harian'
                  ? 'Sisa stok lama diganti langsung sesuai jumlah produksi baru hari ini.'
                  : 'Jumlah pcs baru ditambahkan langsung ke sisa stok dimsum saat ini.'
              }}
            </p>

            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-[#111d33]">
                <p class="text-[10px] font-semibold uppercase text-slate-400">Sisa Saat Ini</p>
                <p class="mt-0.5 text-xl font-extrabold text-[#0f213d] tabular-nums dark:text-white">
                  {{ data?.dimsumStock.stok_pcs ?? 0 }} <span class="text-xs font-semibold text-slate-400">Pcs</span>
                </p>
                <p class="mt-1 text-[10px] text-slate-500 tabular-nums dark:text-slate-400">
                  Stok jadi: <strong class="text-[#0f213d] dark:text-white">{{ projectedStockPcs }} Pcs</strong>
                </p>
              </div>

              <div class="rounded-xl bg-[#0f213d] p-3 text-white dark:bg-[#0d9488]">
                <p class="text-[10px] font-semibold uppercase text-teal-200/90">
                  {{ inputType === 'set_harian' ? 'Stok Pagi Baru' : 'Pcs Ditambah' }}
                </p>
                <p class="mt-0.5 text-xl font-extrabold text-white tabular-nums">
                  {{ inputType === 'set_harian' ? '' : '+' }}{{ validQtyProduksi }}
                  <span class="text-xs font-semibold text-teal-200">Pcs</span>
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            :disabled="submitting"
            class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d9488] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-60"
          >
            <UIcon
              :name="submitting ? 'i-heroicons-arrow-path' : 'i-heroicons-check-circle'"
              class="h-4 w-4"
              :class="{ 'animate-spin': submitting }"
            />
            <span>{{ submitting ? 'Menyimpan...' : 'Simpan Produksi Dimsum Sekarang' }}</span>
          </button>
        </div>
      </div>
    </form>

    <!-- Menu Consumption Breakdown Today -->
    <div class="saas-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111d33]">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
        <div>
          <h2 class="text-sm font-bold text-[#0f213d] dark:text-white">
            Menu Dimsum Berbagi Stok Produksi ({{ data?.dimsumStock.stok_pcs ?? 0 }} Pcs)
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Atur potongan pcs per menu (misal 1 pcs, 4 pcs, atau 10 pcs) di halaman Menu &amp; Stok
          </p>
        </div>
        <NuxtLink
          to="/products"
          class="text-xs font-semibold text-[#0d9488] hover:underline dark:text-teal-400"
        >
          Atur Isi Pcs Menu →
        </NuxtLink>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-left text-xs dark:divide-slate-800">
          <thead class="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#0b1424]/70 dark:text-slate-400">
            <tr>
              <th class="px-5 py-3">Menu Dimsum</th>
              <th class="px-5 py-3">Kategori</th>
              <th class="px-5 py-3 text-right">Potongan Stok</th>
              <th class="px-5 py-3 text-right">Terjual ({{ isViewingToday ? 'Hari Ini' : selectedDate }})</th>
              <th class="px-5 py-3 text-right">Pcs Terpakai</th>
              <th class="px-5 py-3 text-right">Maks. Tersedia di POS</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="menu in data?.dimsumMenus ?? []"
              :key="menu.id_produk"
              class="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/35"
            >
              <td class="px-5 py-3 font-semibold text-[#0f213d] dark:text-white">
                {{ menu.nama_menu }}
                <span class="ml-1 font-mono text-[10px] font-normal text-slate-400">{{ menu.kode_barang }}</span>
              </td>
              <td class="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-400">
                {{ menu.kategori }}
              </td>
              <td class="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                {{ menu.isi_pcs }} pcs / {{ menu.satuan }}
              </td>
              <td class="whitespace-nowrap px-5 py-3 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                {{ menu.qty_terjual_hari_ini }} {{ menu.satuan }}
              </td>
              <td class="whitespace-nowrap px-5 py-3 text-right font-bold text-[#ee6352] tabular-nums">
                -{{ menu.pcs_terpakai_hari_ini }} pcs
              </td>
              <td class="whitespace-nowrap px-5 py-3 text-right font-bold text-[#0d9488] dark:text-teal-400 tabular-nums">
                {{ menu.max_porsi_tersisa }} {{ menu.satuan }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Production History Audit Log Table -->
    <div class="saas-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111d33]">
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
        <div>
          <h2 class="text-sm font-bold text-[#0f213d] dark:text-white">
            Riwayat Catatan Produksi · {{ data?.dateLabel }}
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Log semua penambahan produksi dimsum bersama dan restock minuman/saus
          </p>
        </div>
        <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 tabular-nums dark:bg-slate-800 dark:text-slate-300">
          {{ data?.logs.length ?? 0 }} Log
        </span>
      </div>

      <div
        v-if="!data || data.logs.length === 0"
        class="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400"
      >
        Belum ada catatan produksi pada tanggal {{ data?.dateLabel }}.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-left text-xs dark:divide-slate-800">
          <thead class="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#0b1424]/70 dark:text-slate-400">
            <tr>
              <th class="px-5 py-3">Waktu (WIB)</th>
              <th class="px-5 py-3">Target Stok</th>
              <th class="px-5 py-3">Mode</th>
              <th class="px-5 py-3 text-right">Qty Masuk</th>
              <th class="px-5 py-3 text-right">Perubahan Stok</th>
              <th class="px-5 py-3">Admin &amp; Catatan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="log in data.logs"
              :key="log.id_produksi"
              class="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/35"
            >
              <td class="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400 tabular-nums">
                {{ formatDateTimeWib(log.tanggal_produksi) }}
              </td>
              <td class="px-5 py-3 font-semibold text-[#0f213d] dark:text-white">
                {{ log.nama_menu }}
              </td>
              <td class="whitespace-nowrap px-5 py-3">
                <span
                  class="inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold"
                  :class="
                    log.tipe_input === 'set_harian'
                      ? 'bg-rose-50 text-[#ee6352] dark:bg-rose-950/60 dark:text-rose-300'
                      : 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
                  "
                >
                  {{ log.tipe_input === 'set_harian' ? 'Set Stok Pagi' : 'Tambah Batch' }}
                </span>
              </td>
              <td class="whitespace-nowrap px-5 py-3 text-right font-bold text-[#0d9488] dark:text-teal-400 tabular-nums">
                {{ log.tipe_input === 'set_harian' ? '' : '+' }}{{ log.qty_produksi }} {{ log.satuan }}
              </td>
              <td class="whitespace-nowrap px-5 py-3 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                {{ log.stok_sebelum }} → <strong class="text-[#0f213d] dark:text-white">{{ log.stok_sesudah }}</strong>
              </td>
              <td class="px-5 py-3">
                <p class="font-semibold text-slate-700 dark:text-slate-200">{{ log.admin_nama }}</p>
                <p v-if="log.catatan" class="text-[11px] text-slate-500 dark:text-slate-400">{{ log.catatan }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
