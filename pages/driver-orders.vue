<script setup lang="ts">
import {
  DRIVER_ORDER_STATUSES,
  type DriverOrderItem,
  type DriverOrdersResponse,
  type DriverOrderStatus,
  type ReceiptData
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

const selectedDate = ref(getLocalTodayString())
const selectedPlatform = ref<'Semua' | 'ShopeeFood' | 'GoFood'>('Semua')
const selectedStatus = ref<'Semua Aktif' | DriverOrderStatus | 'Semua'>('Semua Aktif')

const data = ref<DriverOrdersResponse | null>(null)
const loading = ref(true)
const updatingFaktur = ref<string | null>(null)
const cancelingFaktur = ref<string | null>(null)
const creatingDemo = ref<'ShopeeFood' | 'GoFood' | 'pack' | null>(null)
const clearingDemo = ref(false)
const selectedReceipt = ref<ReceiptData | null>(null)
const receiptModalOpen = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

async function fetchOrders(silent = false) {
  if (!silent) {
    loading.value = true
  }
  try {
    data.value = await $fetch<DriverOrdersResponse>('/api/driver-orders', {
      query: {
        date: selectedDate.value,
        platform: selectedPlatform.value,
        status: selectedStatus.value
      }
    })
  } catch (err: unknown) {
    if (!silent) {
      const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
      toast.add({
        title: 'Gagal Memuat Pesanan Driver',
        description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Periksa koneksi TiDB Cloud.',
        color: 'red',
        icon: 'i-heroicons-exclamation-triangle'
      })
    }
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

watch([selectedDate, selectedPlatform, selectedStatus], () => {
  fetchOrders()
})

async function changeStatus(order: DriverOrderItem, nextStatus: DriverOrderStatus) {
  if (order.status_pesanan === nextStatus) return

  updatingFaktur.value = order.no_faktur
  try {
    const res = await $fetch<{ success: boolean, message: string }>(
      `/api/driver-orders/${encodeURIComponent(order.no_faktur)}/status`,
      {
        method: 'PATCH',
        body: { status_pesanan: nextStatus }
      }
    )

    toast.add({
      title: 'Status Diperbarui',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })

    await fetchOrders(true)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Memperbarui Status',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    updatingFaktur.value = null
  }
}

async function cancelOrder(order: DriverOrderItem) {
  if (order.status_pesanan === 'Diambil Driver') return
  cancelingFaktur.value = order.no_faktur
  try {
    const res = await $fetch<{ success: boolean, message: string }>(
      `/api/driver-orders/${encodeURIComponent(order.no_faktur)}`,
      { method: 'DELETE' }
    )
    toast.add({
      title: 'Order Driver Dibatalkan',
      description: res.message,
      color: 'amber',
      icon: 'i-heroicons-trash'
    })
    await fetchOrders(true)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Membatalkan Order',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    cancelingFaktur.value = null
  }
}

function getNextStep(status: DriverOrderStatus): { nextStatus: DriverOrderStatus, label: string } | null {
  switch (status) {
    case 'Sedang Diolah':
      return { nextStatus: 'Sedang Dibungkus', label: 'Lanjut: Bungkus Pesanan' }
    case 'Sedang Dibungkus':
      return { nextStatus: 'Sudah Siap', label: 'Tandai Sudah Siap' }
    case 'Sudah Siap':
      return { nextStatus: 'Diambil Driver', label: 'Diambil Driver (Potong Stok & Hitung Omzet)' }
    default:
      return null
  }
}

function getStepIndex(status: DriverOrderStatus): number {
  return DRIVER_ORDER_STATUSES.indexOf(status)
}

function openReceipt(order: DriverOrderItem) {
  selectedReceipt.value = order
  receiptModalOpen.value = true
}

const hasDemoOrders = computed(() =>
  Boolean(data.value?.orders.some(o => o.kode_order_driver?.includes('(Demo)')))
)

async function createDemoOrder(platform: 'ShopeeFood' | 'GoFood' | 'pack') {
  creatingDemo.value = platform
  try {
    const res = await $fetch<{ success: boolean, message: string }>('/api/driver-orders/demo', {
      method: 'POST',
      body: { platform }
    })

    toast.add({
      title: 'Simulasi Pesanan Masuk',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-sparkles'
    })

    selectedDate.value = getLocalTodayString()
    if (selectedStatus.value === 'Diambil Driver') {
      selectedStatus.value = 'Semua Aktif'
    }
    if (platform !== 'pack' && selectedPlatform.value !== 'Semua' && selectedPlatform.value !== platform) {
      selectedPlatform.value = 'Semua'
    }
    await fetchOrders()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Membuat Pesanan Demo',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    creatingDemo.value = null
  }
}

async function clearDemoOrders() {
  clearingDemo.value = true
  try {
    const res = await $fetch<{ success: boolean, message: string }>('/api/driver-orders/demo', {
      method: 'DELETE'
    })

    toast.add({
      title: 'Data Demo Dibersihkan',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-trash'
    })

    await fetchOrders()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Membersihkan Demo',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    clearingDemo.value = false
  }
}

const statusTabs: Array<{ value: 'Semua Aktif' | DriverOrderStatus | 'Semua', label: string }> = [
  { value: 'Semua Aktif', label: 'Semua Aktif' },
  { value: 'Sedang Diolah', label: 'Sedang Diolah' },
  { value: 'Sedang Dibungkus', label: 'Sedang Dibungkus' },
  { value: 'Sudah Siap', label: 'Sudah Siap' },
  { value: 'Diambil Driver', label: 'Diambil Driver' },
  { value: 'Semua', label: 'Semua Hari Ini' }
]

onMounted(() => {
  fetchOrders()
  pollTimer = setInterval(() => {
    fetchOrders(true)
  }, 15000)
})

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Clean Page Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
      <div>
        <h1 class="text-xl font-extrabold tracking-tight text-[#0f213d] dark:text-white sm:text-2xl">
          Kelola Pesanan Driver Food
        </h1>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
          Pantau &amp; ubah status pesanan <strong>ShopeeFood</strong> dan <strong>GoFood (Gojek)</strong> dari proses masak hingga siap diambil driver.
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
          class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200"
          @click="selectedDate = getLocalTodayString()"
        >
          Hari Ini
        </button>
        <button
          type="button"
          :disabled="loading"
          class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0d9488] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-50"
          @click="fetchOrders()"
        >
          <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Demo Simulation Toolbar -->
    <div class="saas-card flex flex-col gap-3 rounded-2xl border border-teal-200/80 bg-teal-50/50 p-4 dark:border-teal-500/30 dark:bg-teal-950/20 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex items-start gap-3">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0d9488] text-white">
          <UIcon name="i-heroicons-beaker" class="h-5 w-5" />
        </div>
        <div>
          <p class="text-xs font-bold text-[#0f213d] dark:text-white">
            Mode Simulasi / Uji Coba Driver Food
          </p>
          <p class="text-[11px] text-slate-600 dark:text-slate-300">
            Klik tombol di samping untuk mensimulasikan pesanan masuk dari ShopeeFood atau GoFood (tanpa mengurangi stok asli &amp; bisa dihapus kapan saja).
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          :disabled="creatingDemo !== null || clearingDemo"
          class="inline-flex items-center gap-1.5 rounded-lg bg-[#ee4d2d] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#d94122] disabled:opacity-60"
          @click="createDemoOrder('ShopeeFood')"
        >
          <UIcon
            :name="creatingDemo === 'ShopeeFood' ? 'i-heroicons-arrow-path' : 'i-heroicons-plus'"
            class="h-3.5 w-3.5"
            :class="{ 'animate-spin': creatingDemo === 'ShopeeFood' }"
          />
          <span>Simulasi ShopeeFood</span>
        </button>

        <button
          type="button"
          :disabled="creatingDemo !== null || clearingDemo"
          class="inline-flex items-center gap-1.5 rounded-lg bg-[#00aa13] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#009210] disabled:opacity-60"
          @click="createDemoOrder('GoFood')"
        >
          <UIcon
            :name="creatingDemo === 'GoFood' ? 'i-heroicons-arrow-path' : 'i-heroicons-plus'"
            class="h-3.5 w-3.5"
            :class="{ 'animate-spin': creatingDemo === 'GoFood' }"
          />
          <span>Simulasi GoFood (Gojek)</span>
        </button>

        <button
          type="button"
          :disabled="creatingDemo !== null || clearingDemo"
          class="inline-flex items-center gap-1.5 rounded-lg bg-[#0f213d] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#19355f] disabled:opacity-60 dark:bg-[#0d9488] dark:hover:bg-[#0b7a71]"
          @click="createDemoOrder('pack')"
        >
          <UIcon
            :name="creatingDemo === 'pack' ? 'i-heroicons-arrow-path' : 'i-heroicons-sparkles'"
            class="h-3.5 w-3.5"
            :class="{ 'animate-spin': creatingDemo === 'pack' }"
          />
          <span>Buat 3 Paket Demo</span>
        </button>

        <button
          type="button"
          :disabled="clearingDemo || creatingDemo !== null"
          class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
          :class="
            hasDemoOrders
              ? 'border-rose-300 bg-rose-50 text-[#ee6352] hover:bg-[#ee6352] hover:text-white dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-300'
              : 'border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-[#ee6352] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-300'
          "
          @click="clearDemoOrders"
        >
          <UIcon
            :name="clearingDemo ? 'i-heroicons-arrow-path' : 'i-heroicons-trash'"
            class="h-3.5 w-3.5"
            :class="{ 'animate-spin': clearingDemo }"
          />
          <span>Hapus Demo</span>
        </button>
      </div>
    </div>

    <!-- 4 Status Stage Cards (Clickable Filters) -->
    <div class="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
      <button
        type="button"
        class="saas-card flex items-center gap-3.5 rounded-2xl border bg-white p-4 text-left transition-all dark:bg-[#111d33] sm:p-5"
        :class="selectedStatus === 'Sedang Diolah' ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-200/80 hover:border-amber-300 dark:border-slate-800'"
        @click="selectedStatus = 'Sedang Diolah'"
      >
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
          <UIcon name="i-heroicons-fire" class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Sedang Diolah</p>
          <p class="mt-0.5 text-2xl font-extrabold text-[#0f213d] tabular-nums dark:text-white">
            {{ data?.counts.sedangDiolah ?? 0 }}
          </p>
          <p class="text-[10px] text-amber-600 dark:text-amber-400">Dimasak di dapur</p>
        </div>
      </button>

      <button
        type="button"
        class="saas-card flex items-center gap-3.5 rounded-2xl border bg-white p-4 text-left transition-all dark:bg-[#111d33] sm:p-5"
        :class="selectedStatus === 'Sedang Dibungkus' ? 'border-[#2e86c1] ring-2 ring-[#2e86c1]/30' : 'border-slate-200/80 hover:border-sky-300 dark:border-slate-800'"
        @click="selectedStatus = 'Sedang Dibungkus'"
      >
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2e86c1] text-white">
          <UIcon name="i-heroicons-archive-box" class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Sedang Dibungkus</p>
          <p class="mt-0.5 text-2xl font-extrabold text-[#0f213d] tabular-nums dark:text-white">
            {{ data?.counts.sedangDibungkus ?? 0 }}
          </p>
          <p class="text-[10px] text-[#2e86c1] dark:text-sky-400">Packing &amp; saus</p>
        </div>
      </button>

      <button
        type="button"
        class="saas-card flex items-center gap-3.5 rounded-2xl border bg-white p-4 text-left transition-all dark:bg-[#111d33] sm:p-5"
        :class="selectedStatus === 'Sudah Siap' ? 'border-[#0d9488] ring-2 ring-teal-500/30' : 'border-slate-200/80 hover:border-teal-300 dark:border-slate-800'"
        @click="selectedStatus = 'Sudah Siap'"
      >
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-white">
          <UIcon name="i-heroicons-check-badge" class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Sudah Siap</p>
          <p class="mt-0.5 text-2xl font-extrabold text-[#0f213d] tabular-nums dark:text-white">
            {{ data?.counts.sudahSiap ?? 0 }}
          </p>
          <p class="text-[10px] text-[#0d9488] dark:text-teal-400">Menunggu driver</p>
        </div>
      </button>

      <button
        type="button"
        class="saas-card flex items-center gap-3.5 rounded-2xl border bg-white p-4 text-left transition-all dark:bg-[#111d33] sm:p-5"
        :class="selectedStatus === 'Diambil Driver' ? 'border-[#0f213d] ring-2 ring-[#0f213d]/25 dark:border-slate-500' : 'border-slate-200/80 hover:border-slate-300 dark:border-slate-800'"
        @click="selectedStatus = 'Diambil Driver'"
      >
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0f213d] text-white dark:bg-[#1e3a5f]">
          <UIcon name="i-heroicons-truck" class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Diambil Driver</p>
          <p class="mt-0.5 text-2xl font-extrabold text-[#0f213d] tabular-nums dark:text-white">
            {{ data?.counts.diambilDriver ?? 0 }}
          </p>
          <p class="text-[10px] text-slate-500 dark:text-slate-400">Selesai diserahkan</p>
        </div>
      </button>
    </div>

    <!-- Filter Bar (Status + Platform) -->
    <div class="saas-card flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#111d33] lg:flex-row lg:items-center lg:justify-between">
      <div class="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          type="button"
          class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="
            selectedStatus === tab.value
              ? 'bg-[#0f213d] text-white dark:bg-[#0d9488]'
              : 'border border-slate-200 bg-slate-50/70 text-slate-600 hover:border-teal-400 hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300'
          "
          @click="selectedStatus = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="
            selectedPlatform === 'Semua'
              ? 'bg-[#0d9488] text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-teal-400 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300'
          "
          @click="selectedPlatform = 'Semua'"
        >
          Semua Driver
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="
            selectedPlatform === 'ShopeeFood'
              ? 'bg-[#ee4d2d] text-white'
              : 'border border-orange-200 bg-orange-50/60 text-[#ee4d2d] hover:bg-[#ee4d2d] hover:text-white dark:border-orange-500/30 dark:bg-orange-950/40 dark:text-orange-300'
          "
          @click="selectedPlatform = 'ShopeeFood'"
        >
          ShopeeFood
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="
            selectedPlatform === 'GoFood'
              ? 'bg-[#00aa13] text-white'
              : 'border border-emerald-200 bg-emerald-50/60 text-[#00aa13] hover:bg-[#00aa13] hover:text-white dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300'
          "
          @click="selectedPlatform = 'GoFood'"
        >
          GoFood (Gojek)
        </button>
      </div>
    </div>

    <!-- Orders Grid -->
    <div v-if="loading && !data" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div v-for="n in 3" :key="n" class="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#111d33]" />
    </div>

    <div
      v-else-if="!data || data.orders.length === 0"
      class="saas-card flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-[#111d33]"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-400">
        <UIcon name="i-heroicons-truck" class="h-6 w-6" />
      </div>
      <p class="mt-3 text-sm font-bold text-[#0f213d] dark:text-white">
        Belum ada pesanan Driver Food pada filter ini
      </p>
      <p class="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
        Setiap transaksi dengan metode <strong>ShopeeFood</strong> atau <strong>GoFood (Gojek)</strong> yang dicatat Kasir di layar POS akan muncul otomatis di sini.
      </p>
      <button
        type="button"
        :disabled="creatingDemo !== null"
        class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-60"
        @click="createDemoOrder('pack')"
      >
        <UIcon name="i-heroicons-sparkles" class="h-4 w-4" />
        <span>Coba Buat 3 Pesanan Demo Sekarang</span>
      </button>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="order in data.orders"
        :key="order.no_faktur"
        class="saas-card flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111d33]"
      >
        <!-- Card Top Header -->
        <div>
          <div class="flex items-start justify-between gap-2 border-b border-slate-100 p-4 dark:border-slate-800">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span
                  class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold text-white"
                  :class="order.metode_pembayaran === 'ShopeeFood' ? 'bg-[#ee4d2d]' : 'bg-[#00aa13]'"
                >
                  <UIcon :name="order.metode_pembayaran === 'ShopeeFood' ? 'i-heroicons-shopping-bag' : 'i-heroicons-truck'" class="h-3.5 w-3.5" />
                  <span>{{ order.metode_pembayaran === 'ShopeeFood' ? 'ShopeeFood' : 'GoFood (Gojek)' }}</span>
                </span>
                <span
                  v-if="order.kode_order_driver"
                  class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-[#0f213d] dark:bg-slate-800 dark:text-white"
                >
                  {{ order.kode_order_driver }}
                </span>
              </div>
              <p class="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                {{ order.no_faktur }}
              </p>
            </div>

            <div class="text-right">
              <span
                class="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                :class="
                  order.status_pesanan === 'Sudah Siap'
                    ? 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/70 dark:text-teal-300'
                    : order.status_pesanan === 'Sedang Dibungkus'
                      ? 'bg-sky-50 text-[#2e86c1] dark:bg-sky-950/70 dark:text-sky-300'
                      : order.status_pesanan === 'Diambil Driver'
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                "
              >
                {{ order.status_pesanan }}
              </span>
              <p class="mt-1 text-[10px] text-slate-400 tabular-nums">
                {{ formatDateTimeWib(order.tanggal_transaksi) }}
              </p>
            </div>
          </div>

          <!-- Payment Origin & Finalization Status Banner -->
          <div class="flex flex-wrap items-center justify-between gap-1 bg-slate-50/80 px-4 py-2 text-xs dark:bg-[#0b1424]/70">
            <span class="font-medium text-slate-600 dark:text-slate-300">
              Pembayaran dari <strong>Driver {{ order.metode_pembayaran === 'ShopeeFood' ? 'ShopeeFood' : 'GoFood (Gojek)' }}</strong>
            </span>
            <span class="font-extrabold text-[#0f213d] tabular-nums dark:text-white">
              {{ formatRupiah(order.total_harga) }}
            </span>
            <p class="w-full text-[10px] font-semibold" :class="order.status_pesanan === 'Diambil Driver' ? 'text-[#0d9488]' : 'text-amber-600 dark:text-amber-300'">
              {{ order.status_pesanan === 'Diambil Driver' ? '✓ Final: Stok dimsum sudah dipotong & pemasukan sudah masuk laporan' : '⏳ Belum potong stok & belum masuk omzet sampai klik Diambil Driver' }}
            </p>
          </div>

          <!-- 3-Step Visual Progress Stepper -->
          <div class="px-4 pt-3.5">
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10px] font-semibold">
              <div
                class="rounded-md py-1"
                :class="getStepIndex(order.status_pesanan) >= 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'"
              >
                1. Diolah
              </div>
              <div
                class="rounded-md py-1"
                :class="getStepIndex(order.status_pesanan) >= 1 ? 'bg-[#2e86c1]/15 text-[#2e86c1] dark:text-sky-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'"
              >
                2. Dibungkus
              </div>
              <div
                class="rounded-md py-1"
                :class="getStepIndex(order.status_pesanan) >= 2 ? 'bg-[#0d9488]/15 text-[#0d9488] dark:text-teal-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'"
              >
                3. Sudah Siap
              </div>
            </div>
          </div>

          <!-- Itemized Order List -->
          <div class="space-y-1.5 p-4">
            <div
              v-for="(item, idx) in order.items"
              :key="`${order.no_faktur}-${item.id_produk}-${idx}`"
              class="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-[#0b1424]/50"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="font-semibold text-[#0f213d] dark:text-white">
                  <span class="text-[#0d9488]">{{ item.qty }}x</span> {{ item.nama_menu }}
                </p>
                <span class="shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                  {{ formatRupiah(item.subtotal) }}
                </span>
              </div>
              <p v-if="item.catatan" class="mt-0.5 text-[11px] italic text-amber-700 dark:text-amber-300">
                Catatan: {{ item.catatan }}
              </p>
            </div>
          </div>
        </div>

        <!-- Bottom Action Controls -->
        <div class="space-y-2 border-t border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-[#0b1424]/60">
          <!-- Direct Status Selector Pills -->
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="st in DRIVER_ORDER_STATUSES"
              :key="st"
              type="button"
              :disabled="updatingFaktur === order.no_faktur || (order.status_pesanan === 'Diambil Driver' && st !== 'Diambil Driver')"
              class="rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              :class="
                order.status_pesanan === st
                  ? st === 'Sudah Siap'
                    ? 'border-[#0d9488] bg-[#0d9488] text-white'
                    : st === 'Sedang Dibungkus'
                      ? 'border-[#2e86c1] bg-[#2e86c1] text-white'
                      : st === 'Diambil Driver'
                        ? 'border-[#0f213d] bg-[#0f213d] text-white dark:border-slate-500 dark:bg-slate-600'
                        : 'border-amber-500 bg-amber-500 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400 hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-300'
              "
              @click="changeStatus(order, st)"
            >
              {{ st }}
            </button>
          </div>

          <div class="flex items-center gap-2 pt-0.5">
            <button
              v-if="getNextStep(order.status_pesanan)"
              type="button"
              :disabled="updatingFaktur === order.no_faktur"
              class="flex-1 rounded-lg bg-[#0d9488] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-50"
              @click="changeStatus(order, getNextStep(order.status_pesanan)!.nextStatus)"
            >
              {{ updatingFaktur === order.no_faktur ? 'Memproses...' : getNextStep(order.status_pesanan)!.label }}
            </button>
            <span
              v-else
              class="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              ✓ Selesai Diambil Driver
            </span>

            <button
              v-if="order.status_pesanan !== 'Diambil Driver'"
              type="button"
              :disabled="cancelingFaktur === order.no_faktur"
              class="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-[#ee6352] hover:bg-[#ee6352] hover:text-white disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300"
              title="Batalkan order driver (belum potong stok)"
              @click="cancelOrder(order)"
            >
              <UIcon name="i-heroicons-trash" class="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              class="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200"
              title="Cetak Struk Dapur"
              @click="openReceipt(order)"
            >
              <UIcon name="i-heroicons-printer" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reprint Receipt Modal -->
    <ReceiptModal
      v-model="receiptModalOpen"
      :receipt="selectedReceipt"
    />
  </div>
</template>
