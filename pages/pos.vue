<script setup lang="ts">
import {
  DRIVER_ORDER_STATUSES,
  PRODUCT_CATEGORIES,
  formatPaymentMethodLabel,
  type DriverOrderItem,
  type DriverOrdersResponse,
  type DriverOrderStatus,
  type ProductItem,
  type SharedDimsumStock,
  type StockRequestItem,
  type StockRequestsResponse
} from '~/types/pos'
import { formatDateTimeWib, formatRupiah } from '~/utils/format'

definePageMeta({
  layout: 'default'
})

const config = useRuntimeConfig()
const { user, logout } = useAuth()
const cartStore = useCartStore()
const toast = useToast()
const { checkForNewDriverOrders } = useDriverOrderAlerts()

const searchInputRef = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const selectedCategory = ref<string>('Semua')
const products = ref<ProductItem[]>([])
const dimsumStock = ref<SharedDimsumStock>({
  stok_pcs: 0,
  stok_minimum_pcs: 20,
  is_low_stock: false
})
const loadingProducts = ref(true)
const nextInvoice = ref('INV-XXXXXXXX-001')
const receiptModalOpen = ref(false)
const qrisModalOpen = ref(false)
const qrisUrl = ref('/images/qris-default.svg')
const hasCustomQris = ref(false)
const editingNoteId = ref<number | null>(null)
const noteDraft = ref('')
const loggingOut = ref(false)
const mobileCartOpen = ref(false)
const driverQueueOpen = ref(false)
const driverOrders = ref<DriverOrderItem[]>([])
const driverActiveCount = ref(0)
const pendingDriverDimsumPcs = ref(0)
const loadingDriverOrders = ref(false)
const updatingDriverInvoice = ref<string | null>(null)
const cancelingDriverInvoice = ref<string | null>(null)
const creatingDriverDemo = ref(false)
const showCreateDriverForm = ref(false)
const newDriverPlatform = ref<'ShopeeFood' | 'GoFood'>('ShopeeFood')
const newDriverCode = ref('')
const newDriverItems = ref<Array<{ id_produk: number, qty: number }>>([])
const submittingDriverOrder = ref(false)

// Pengajuan pasokan stok dimsum ke Admin
const stockSupplyBannerRef = ref<{ refresh: () => Promise<void> } | null>(null)
const stockRequestModalOpen = ref(false)
const shiftModalOpen = ref(false)
const stockRequestQty = ref<number>(100)
const stockRequestNote = ref('Stok dimsum di kasir menipis/habis, mohon segera diproduksi.')
const submittingStockRequest = ref(false)
const recentStockRequests = ref<StockRequestItem[]>([])
const waNotifyStatus = ref<{
  enabled: boolean
  configured: boolean
} | null>(null)
const autoOpenWaLink = ref(true)
const lastSubmittedWaUrl = ref<string | null>(null)
const stockRequestQtyPresets = [50, 100, 150, 200]
const stockRequestNotePresets = [
  'Stok dimsum di kasir sudah habis, mohon segera diproduksi!',
  'Stok menipis, banyak antrean Takeaway & Driver Food.',
  'Mohon tambahan kloter kukusan baru.'
]

const activeStockRequest = computed(() =>
  recentStockRequests.value.find(r => r.status === 'Menunggu Admin' || r.status === 'Sedang Diproduksi') || null
)

// Menu selection animation state
const pulsingProductId = ref<number | null>(null)
const floatingPlusId = ref<number | null>(null)
const cartBumping = ref(false)

const categoryTabs = ['Semua', ...PRODUCT_CATEGORIES]
const notePresets = ['Saus dipisah', 'Extra Chili Oil', 'Tanpa saus', 'Hangat / baru kukus']
const quickCashAmounts = [20000, 50000, 100000]

async function fetchProducts() {
  loadingProducts.value = true
  try {
    const res = await $fetch<{
      success: boolean
      dimsumStock: SharedDimsumStock
      data: ProductItem[]
    }>('/api/products')
    products.value = res.data
    if (res.dimsumStock) {
      dimsumStock.value = res.dimsumStock
    }
    cartStore.syncProductsStock(res.data, res.dimsumStock?.stok_pcs ?? 0)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Gagal Memuat Menu',
      description: fetchErr?.data?.statusMessage || 'Periksa koneksi TiDB Cloud.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    loadingProducts.value = false
  }
}

async function fetchNextInvoice() {
  try {
    const res = await $fetch<{ success: boolean, no_faktur: string }>('/api/pos/next-invoice')
    nextInvoice.value = res.no_faktur
  } catch {
    // Keep previous preview if offline
  }
}

async function fetchQrisImage() {
  try {
    const res = await $fetch<{ success: boolean, hasCustomQris: boolean, url: string }>('/api/uploads/qris')
    qrisUrl.value = res.url
    hasCustomQris.value = res.hasCustomQris
  } catch {
    qrisUrl.value = '/images/qris-default.svg'
    hasCustomQris.value = false
  }
}

function handleQrisUploaded(newUrl: string) {
  qrisUrl.value = newUrl
  hasCustomQris.value = true
}

async function fetchDriverQueue() {
  loadingDriverOrders.value = true
  try {
    const res = await $fetch<DriverOrdersResponse>('/api/driver-orders', {
      query: { status: 'Semua Aktif' }
    })
    driverOrders.value = res.orders
    driverActiveCount.value = res.counts.semuaAktif
    pendingDriverDimsumPcs.value = res.pendingDimsumPcs ?? 0
  } catch {
    // Keep previous state silently
  } finally {
    loadingDriverOrders.value = false
  }
}

async function updateDriverOrderStatus(order: DriverOrderItem, nextStatus: DriverOrderStatus) {
  updatingDriverInvoice.value = order.no_faktur
  try {
    const res = await $fetch<{
      success: boolean
      message: string
      data?: { finalized_now?: boolean, deducted_dimsum_pcs?: number }
    }>(`/api/driver-orders/${encodeURIComponent(order.no_faktur)}/status`, {
      method: 'PATCH',
      body: { status_pesanan: nextStatus }
    })
    toast.add({
      title: res.data?.finalized_now ? 'Order Selesai — Stok & Omzet Tercatat!' : 'Status Driver Diperbarui',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })
    await Promise.all([
      fetchDriverQueue(),
      checkForNewDriverOrders(true),
      nextStatus === 'Diambil Driver' ? fetchProducts() : Promise.resolve()
    ])
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Update Status',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    updatingDriverInvoice.value = null
  }
}

async function cancelDriverOrderFromPos(order: DriverOrderItem) {
  if (order.status_pesanan === 'Diambil Driver') return
  cancelingDriverInvoice.value = order.no_faktur
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
    await Promise.all([fetchDriverQueue(), checkForNewDriverOrders(true)])
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Membatalkan Order',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    cancelingDriverInvoice.value = null
  }
}

function getNewDriverItemQty(idProduk: number): number {
  return newDriverItems.value.find(i => i.id_produk === idProduk)?.qty ?? 0
}

function adjustNewDriverItemQty(idProduk: number, delta: number) {
  const existing = newDriverItems.value.find(i => i.id_produk === idProduk)
  if (!existing && delta > 0) {
    newDriverItems.value.push({ id_produk: idProduk, qty: delta })
    return
  }
  if (!existing) return
  const next = existing.qty + delta
  if (next <= 0) {
    newDriverItems.value = newDriverItems.value.filter(i => i.id_produk !== idProduk)
  } else {
    existing.qty = next
  }
}

const newDriverEstimatedTotal = computed(() => {
  const map = new Map(products.value.map(p => [p.id_produk, p.harga_jual]))
  return newDriverItems.value.reduce((sum, it) => sum + (map.get(it.id_produk) || 0) * it.qty, 0)
})

async function handleCreateManualDriverOrder() {
  if (newDriverItems.value.length === 0) {
    toast.add({
      title: 'Pilih Menu Dulu',
      description: 'Tambahkan minimal 1 menu untuk dicatat ke antrean Driver Food.',
      color: 'amber',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }

  submittingDriverOrder.value = true
  try {
    const res = await $fetch<{ success: boolean, message: string }>('/api/driver-orders', {
      method: 'POST',
      body: {
        platform: newDriverPlatform.value,
        kode_order_driver: newDriverCode.value.trim() || null,
        items: newDriverItems.value
      }
    })
    toast.add({
      title: 'Order Driver Masuk Antrean',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })
    newDriverCode.value = ''
    newDriverItems.value = []
    showCreateDriverForm.value = false
    await Promise.all([fetchDriverQueue(), checkForNewDriverOrders(true)])
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Mencatat Order Driver',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    submittingDriverOrder.value = false
  }
}

async function handleAcceptOnlineOrders(orders: DriverOrderItem[]) {
  if (orders.length === 0) return

  // Perbarui status semua pesanan yang baru masuk ke 'Sedang Dibungkus' agar lanjut diproses dapur
  try {
    await Promise.all(
      orders.map(order =>
        $fetch(`/api/driver-orders/${encodeURIComponent(order.no_faktur)}/status`, {
          method: 'PATCH',
          body: { status_pesanan: 'Sedang Dibungkus' }
        }).catch(() => {})
      )
    )
  } finally {
    await fetchDriverQueue()
  }

  // Buka struk/tiket dapur untuk pesanan terbaru agar langsung bisa dicetak
  cartStore.lastReceipt = orders[0]
  receiptModalOpen.value = true

  toast.add({
    title: `${orders.length} Pesanan Online Diterima`,
    description: 'Status diperbarui ke "Sedang Dibungkus" & tiket dapur siap dicetak.',
    color: 'green',
    icon: 'i-heroicons-check-circle'
  })
}

async function createDriverDemoFromPos(platform: 'ShopeeFood' | 'GoFood' | 'pack') {
  creatingDriverDemo.value = true
  try {
    const res = await $fetch<{ success: boolean, message: string }>('/api/driver-orders/demo', {
      method: 'POST',
      body: { platform }
    })
    toast.add({
      title: 'Pesanan Demo Dibuat',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-sparkles'
    })
    await fetchDriverQueue()
    await checkForNewDriverOrders(true)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Membuat Demo',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    creatingDriverDemo.value = false
  }
}

function handleStockStatusUpdate(payload: StockRequestsResponse) {
  recentStockRequests.value = payload.requests.slice(0, 6)
}

async function fetchWaNotifyStatus() {
  try {
    const res = await $fetch<{
      success: boolean
      enabled: boolean
      configured: boolean
    }>('/api/settings/whatsapp')
    waNotifyStatus.value = {
      enabled: res.enabled,
      configured: res.configured
    }
  } catch {
    waNotifyStatus.value = null
  }
}

function openStockRequestModal() {
  lastSubmittedWaUrl.value = null
  if (cartStore.remainingDimsumPcs <= 0) {
    stockRequestNote.value = 'Stok dimsum di kasir sudah habis (0 pcs), mohon segera diproduksi!'
  } else {
    stockRequestNote.value = 'Stok dimsum menipis, mohon tambahan pasokan.'
  }
  stockRequestModalOpen.value = true
  fetchWaNotifyStatus()
}

async function handleSubmitStockRequest() {
  const qty = Number(stockRequestQty.value)
  if (!Number.isInteger(qty) || qty <= 0) {
    toast.add({
      title: 'Jumlah Tidak Valid',
      description: 'Masukkan jumlah pcs dimsum minimal 1 pcs.',
      color: 'amber',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }

  submittingStockRequest.value = true
  try {
    const res = await $fetch<{
      success: boolean
      message: string
      whatsapp?: {
        configured: boolean
        enabled: boolean
        waUrl: string | null
      }
    }>('/api/stock-requests', {
      method: 'POST',
      body: {
        qty_diminta: qty,
        catatan_kasir: stockRequestNote.value.trim() || null
      }
    })

    const waUrl = res.whatsapp?.waUrl || null
    if (waUrl) {
      lastSubmittedWaUrl.value = waUrl
      if (autoOpenWaLink.value) {
        window.open(waUrl, '_blank', 'noopener,noreferrer')
      }
      toast.add({
        title: 'Pengajuan Tersimpan & Siap Kirim WA',
        description: 'Pesan WhatsApp ke Admin sudah terisi otomatis — klik tombol Kirim WA jika belum terbuka.',
        color: 'green',
        icon: 'i-heroicons-chat-bubble-oval-left-ellipsis'
      })
    } else {
      toast.add({
        title: 'Pengajuan Terkirim ke Admin',
        description: res.message,
        color: 'green',
        icon: 'i-heroicons-paper-airplane'
      })
      stockRequestModalOpen.value = false
    }

    await stockSupplyBannerRef.value?.refresh()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Mengirim Pengajuan',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    submittingStockRequest.value = false
  }
}

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return products.value.filter((item) => {
    const matchesCategory = selectedCategory.value === 'Semua' || item.kategori === selectedCategory.value
    const matchesSearch = !q ||
      item.nama_menu.toLowerCase().includes(q) ||
      item.kode_barang.toLowerCase().includes(q)
    return matchesCategory && matchesSearch
  })
})

function triggerMenuSelectMotion(productId: number) {
  pulsingProductId.value = null
  floatingPlusId.value = null
  cartBumping.value = false

  requestAnimationFrame(() => {
    pulsingProductId.value = productId
    floatingPlusId.value = productId
    cartBumping.value = true

    setTimeout(() => {
      if (pulsingProductId.value === productId) pulsingProductId.value = null
    }, 440)
    setTimeout(() => {
      if (floatingPlusId.value === productId) floatingPlusId.value = null
    }, 660)
    setTimeout(() => {
      cartBumping.value = false
    }, 340)
  })
}

function handleAddProduct(product: ProductItem) {
  const result = cartStore.addItem(product)
  if (!result.ok && result.message) {
    toast.add({
      title: 'Stok Terbatas',
      description: result.message,
      color: 'amber',
      icon: 'i-heroicons-exclamation-circle'
    })
    return
  }

  triggerMenuSelectMotion(product.id_produk)
}

function handleIncrement(idProduk: number) {
  const result = cartStore.incrementQty(idProduk)
  if (!result.ok && result.message) {
    toast.add({
      title: 'Batas Stok Tercapai',
      description: result.message,
      color: 'amber',
      icon: 'i-heroicons-exclamation-circle'
    })
    return
  }
  cartBumping.value = true
  setTimeout(() => {
    cartBumping.value = false
  }, 320)
}

function handleSearchEnter() {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return

  const exactCodeMatch = products.value.find(p => p.kode_barang.toLowerCase() === q)
  if (exactCodeMatch) {
    handleAddProduct(exactCodeMatch)
    searchQuery.value = ''
    return
  }

  if (filteredProducts.value.length === 1) {
    handleAddProduct(filteredProducts.value[0])
    searchQuery.value = ''
  }
}

function openNoteEditor(idProduk: number, currentNote: string) {
  if (editingNoteId.value === idProduk) {
    editingNoteId.value = null
    return
  }
  editingNoteId.value = idProduk
  noteDraft.value = currentNote
}

function saveNote(idProduk: number) {
  cartStore.updateItemNote(idProduk, noteDraft.value)
  editingNoteId.value = null
}

function applyNotePreset(idProduk: number, preset: string) {
  const current = noteDraft.value.trim()
  noteDraft.value = current ? `${current}, ${preset}` : preset
  cartStore.updateItemNote(idProduk, noteDraft.value)
}

function isProductOutOfStock(product: ProductItem): boolean {
  if (product.uses_shared_dimsum_stock) {
    return cartStore.remainingDimsumPcs < Math.max(1, product.isi_pcs || 1)
  }
  return product.stok - cartStore.getItemQty(product.id_produk) <= 0
}

function getCardStockBadgeText(product: ProductItem): string {
  if (product.uses_shared_dimsum_stock) {
    const rem = cartStore.remainingDimsumPcs
    if (rem < Math.max(1, product.isi_pcs || 1)) return 'Habis'
    return `${rem} pcs`
  }
  const rem = Math.max(0, product.stok - cartStore.getItemQty(product.id_produk))
  if (rem <= 0) return 'Habis'
  return `${rem} ${product.satuan}`
}

function isProductLowStock(product: ProductItem): boolean {
  if (product.uses_shared_dimsum_stock) {
    return cartStore.remainingDimsumPcs <= dimsumStock.value.stok_minimum_pcs
  }
  const rem = Math.max(0, product.stok - cartStore.getItemQty(product.id_produk))
  return rem <= product.stok_minimum
}

function getCategoryIcon(kategori: string): string {
  switch (kategori) {
    case 'Dimsum Kukus':
      return 'i-heroicons-fire'
    case 'Dimsum Goreng':
      return 'i-heroicons-sparkles'
    case 'Paket Mix':
      return 'i-heroicons-gift'
    default:
      return 'i-heroicons-beaker'
  }
}

async function handleCheckout() {
  if (!cartStore.canCheckout) {
    toast.add({
      title: 'Belum Dapat Diproses',
      description: cartStore.checkoutValidationMessage || 'Periksa kembali keranjang dan pembayaran.',
      color: 'amber',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }

  try {
    const receipt = await cartStore.checkout()
    editingNoteId.value = null
    mobileCartOpen.value = false
    receiptModalOpen.value = true

    toast.add({
      title: `Transaksi ${receipt.no_faktur} Berhasil`,
      description: `Total ${formatRupiah(receipt.total_harga)} (${formatPaymentMethodLabel(receipt.metode_pembayaran)}) tersimpan di TiDB Cloud.`,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })

    await Promise.all([fetchProducts(), fetchNextInvoice(), fetchDriverQueue()])
    if (receipt.metode_pembayaran === 'ShopeeFood' || receipt.metode_pembayaran === 'GoFood') {
      await checkForNewDriverOrders(true)
    }
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Transaksi Dibatalkan (Rollback)',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Terjadi kesalahan saat menyimpan transaksi.',
      color: 'red',
      icon: 'i-heroicons-x-circle'
    })
    await fetchProducts()
  }
}

async function handleLogout() {
  loggingOut.value = true
  try {
    await logout()
  } finally {
    loggingOut.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'F2') {
    event.preventDefault()
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
  } else if (event.key === 'F9') {
    event.preventDefault()
    if (!receiptModalOpen.value && !cartStore.isSubmitting) {
      handleCheckout()
    }
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  await Promise.all([fetchProducts(), fetchNextInvoice(), fetchQrisImage(), fetchDriverQueue()])
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-[#f4f7fa] text-[#0f213d] transition-colors duration-200 dark:bg-[#0b1424] dark:text-slate-100 lg:h-screen lg:overflow-hidden">
    <!-- Clean Deep Navy POS Topbar -->
    <header class="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 bg-[#0f213d] px-3 text-white dark:bg-[#091326] sm:h-16 sm:px-4 lg:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <AnimatedBrandLogo size="md" :alt="config.public.storeName" dark-surface />
        <div class="min-w-0">
          <h1 class="truncate text-sm font-bold tracking-tight text-white sm:text-base">
            {{ config.public.storeName }}
          </h1>
          <p class="hidden text-[11px] font-medium text-teal-300/90 sm:block">
            Mode Kasir POS · Takeaway Cepat
          </p>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <button
          type="button"
          class="relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.08] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0d9488] sm:px-3"
          title="Antrean Pesanan Driver Food (ShopeeFood & GoFood)"
          @click="driverQueueOpen = true; fetchDriverQueue()"
        >
          <UIcon name="i-heroicons-truck" class="h-4 w-4 text-teal-300" />
          <span class="hidden sm:inline">Driver Food</span>
          <span
            v-if="driverActiveCount > 0"
            class="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ee6352] px-1 text-[10px] font-extrabold text-white tabular-nums"
          >
            {{ driverActiveCount }}
          </span>
        </button>

        <button
          type="button"
          class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-400/35 bg-[#0d9488]/20 px-2.5 text-xs font-semibold text-teal-100 transition-colors hover:bg-[#0d9488] hover:text-white sm:px-3"
          title="Tutup Kasir / Shift & Rekap Laci (Closing)"
          @click="shiftModalOpen = true"
        >
          <UIcon name="i-heroicons-banknotes" class="h-4 w-4 text-teal-300" />
          <span class="hidden sm:inline">Tutup Kasir</span>
        </button>

        <ThemeToggle compact />
        <div class="hidden sm:block">
          <TiDbStatusBadge online-label="TiDB Online" offline-label="TiDB Offline" />
        </div>

        <div class="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] py-1 pl-1.5 pr-3 md:flex">
          <div class="flex h-7 w-7 items-center justify-center rounded-full bg-[#0d9488] text-[11px] font-bold uppercase text-white">
            {{ user?.nama?.slice(0, 2) || 'KS' }}
          </div>
          <div class="leading-tight">
            <p class="text-xs font-semibold text-white">{{ user?.nama }}</p>
            <p class="text-[10px] uppercase tracking-wide text-teal-300">{{ user?.role }}</p>
          </div>
        </div>

        <button
          type="button"
          :disabled="loggingOut"
          class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.07] px-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-rose-400/50 hover:bg-[#ee6352] hover:text-white disabled:opacity-50 sm:px-3"
          title="Keluar"
          @click="handleLogout"
        >
          <UIcon name="i-heroicons-arrow-right-on-rectangle" class="h-4 w-4" />
          <span class="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>

    <!-- Main Body (Mobile: Fullscreen Menu + Sticky Bottom Bar & Cart Sheet | Desktop: 65% / 35% Split) -->
    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <!-- LEFT PANEL (Full screen on Mobile, 65% on Desktop) -->
      <section class="flex min-h-0 flex-1 flex-col lg:w-[65%]">
        <!-- Sticky Search, Categories & Live Shared Dimsum Stock Strip -->
        <div class="sticky top-14 z-20 shrink-0 space-y-2.5 border-b border-slate-200/80 bg-white px-3 py-3 dark:border-slate-800 dark:bg-[#0f1b2e] sm:top-16 sm:space-y-3 sm:px-4 sm:py-3.5 lg:static lg:px-6">
          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <UIcon
                name="i-heroicons-magnifying-glass"
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                placeholder="Cari menu atau kode barcode..."
                class="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-10 text-sm text-[#0f213d] placeholder-slate-400 transition-colors focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:placeholder-slate-500 sm:py-2.5 sm:pr-20"
                @keydown.enter.prevent="handleSearchEnter"
              >
              <div class="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                <button
                  v-if="searchQuery"
                  type="button"
                  class="rounded-full p-0.5 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  @click="searchQuery = ''"
                >
                  <UIcon name="i-heroicons-x-mark" class="h-4 w-4" />
                </button>
                <kbd class="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:inline-block">
                  F2
                </kbd>
              </div>
            </div>

            <button
              type="button"
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200 dark:hover:border-teal-500"
              title="Muat ulang stok menu"
              @click="fetchProducts"
            >
              <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" :class="{ 'animate-spin': loadingProducts }" />
            </button>
          </div>

          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
              <button
                v-for="cat in categoryTabs"
                :key="cat"
                type="button"
                class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:px-3.5"
                :class="
                  selectedCategory === cat
                    ? 'bg-[#0d9488] text-white'
                    : 'border border-slate-200 bg-slate-50/70 text-slate-600 hover:border-teal-400 hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-300 dark:hover:border-teal-500'
                "
                @click="selectedCategory = cat"
              >
                {{ cat }}
              </button>
            </div>

            <!-- Live Shared Dimsum Pool Pill -->
            <div class="flex items-center justify-between gap-2 sm:justify-end">
              <div
                class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums transition-all sm:px-3"
                :class="[
                  cartBumping ? 'cart-bump' : '',
                  cartStore.remainingDimsumPcs <= 0
                    ? 'border-rose-300 bg-rose-50 text-[#ee6352] dark:border-rose-500/40 dark:bg-rose-950/60 dark:text-rose-200'
                    : cartStore.remainingDimsumPcs <= dimsumStock.stok_minimum_pcs
                      ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-200'
                      : 'border-teal-200 bg-teal-50/80 text-[#0f213d] dark:border-teal-500/30 dark:bg-teal-950/50 dark:text-teal-200'
                ]"
              >
                <UIcon name="i-heroicons-fire" class="h-3.5 w-3.5 shrink-0 text-[#0d9488] dark:text-teal-400" />
                <span>
                  Stok Dimsum:
                  <strong class="text-[#0d9488] dark:text-white">{{ cartStore.remainingDimsumPcs }} pcs</strong>
                </span>
                <span
                  v-if="cartStore.usedDimsumPcsInCart > 0"
                  class="rounded bg-[#0f213d] px-1.5 py-0.5 text-[10px] text-white dark:bg-teal-600"
                >
                  -{{ cartStore.usedDimsumPcsInCart }}
                </span>
                <span
                  v-if="pendingDriverDimsumPcs > 0"
                  class="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/25 dark:text-amber-200"
                  title="Dimsum yang dibutuhkan oleh antrean Driver Food aktif (baru dipotong saat Diambil Driver)"
                >
                  Antrean Driver: {{ pendingDriverDimsumPcs }} pcs
                </span>
              </div>

              <!-- Tombol Lapor / Ajukan Pemasokan Stok ke Admin -->
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors"
                :class="
                  cartStore.remainingDimsumPcs <= dimsumStock.stok_minimum_pcs
                    ? 'border-[#ee6352] bg-[#ee6352] text-white hover:bg-[#dc4e3d]'
                    : activeStockRequest
                      ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200'
                "
                title="Ajukan penambahan pasokan stok dimsum ke Admin"
                @click="openStockRequestModal"
              >
                <UIcon name="i-heroicons-bell-alert" class="h-3.5 w-3.5" />
                <span>
                  {{
                    activeStockRequest
                      ? activeStockRequest.status === 'Sedang Diproduksi'
                        ? 'Diproduksi...'
                        : 'Diajukan'
                      : cartStore.remainingDimsumPcs <= 0
                        ? 'Stok Habis! Lapor'
                        : 'Ajukan Stok'
                  }}
                </span>
              </button>

              <span class="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-600 tabular-nums dark:bg-slate-800 dark:text-slate-300 lg:hidden">
                {{ nextInvoice }}
              </span>
            </div>
          </div>

          <!-- Inline Alert Strip ketika Stok Dimsum Habis / Menipis -->
          <div
            v-if="cartStore.remainingDimsumPcs <= dimsumStock.stok_minimum_pcs"
            class="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
            :class="
              cartStore.remainingDimsumPcs <= 0
                ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200'
            "
          >
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 shrink-0" />
              <span>
                <strong v-if="cartStore.remainingDimsumPcs <= 0">Stok dimsum habis (0 pcs)!</strong>
                <strong v-else>Stok dimsum menipis ({{ cartStore.remainingDimsumPcs }} pcs).</strong>
                <template v-if="activeStockRequest">
                  Status pengajuan Anda: <strong>{{ activeStockRequest.status }}</strong> (+{{ activeStockRequest.qty_diminta }} pcs).
                </template>
                <template v-else>
                  Laporkan ke Admin agar segera diproduksi &amp; dikirim ke kasir.
                </template>
              </span>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg bg-[#0f213d] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#0d9488] dark:bg-[#0d9488]"
              @click="openStockRequestModal"
            >
              {{ activeStockRequest ? 'Lihat / Ajukan Lagi' : 'Ajukan ke Admin →' }}
            </button>
          </div>
        </div>

        <!-- Menu Cards Grid (Comfortable bottom padding on mobile so sticky cart bar never covers cards) -->
        <div class="custom-scroll flex-1 p-3 pb-28 sm:p-4 sm:pb-28 lg:overflow-y-auto lg:p-6 lg:pb-6">
          <div v-if="loadingProducts && products.length === 0" class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            <div
              v-for="n in 8"
              :key="n"
              class="h-56 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#111d33] sm:h-60"
            />
          </div>

          <div
            v-else-if="filteredProducts.length === 0"
            class="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-center dark:border-slate-700 dark:bg-[#111d33]"
          >
            <UIcon name="i-heroicons-magnifying-glass" class="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p class="mt-2 text-sm font-bold text-[#0f213d] dark:text-white">Menu tidak ditemukan</p>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Coba ubah kata kunci pencarian atau pilih kategori "Semua".
            </p>
          </div>

          <div
            v-else
            class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 xl:grid-cols-4"
          >
            <div
              v-for="product in filteredProducts"
              :key="product.id_produk"
              class="saas-card group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-[#0f213d] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#0d9488]/60 dark:border-slate-800 dark:bg-[#111d33] dark:text-slate-100 dark:hover:border-teal-500/50"
              :class="[
                isProductOutOfStock(product) ? 'opacity-60' : '',
                pulsingProductId === product.id_produk ? 'card-select-pop ring-2 ring-[#0d9488]' : ''
              ]"
            >
              <span
                v-if="floatingPlusId === product.id_produk"
                class="float-plus-one pointer-events-none absolute left-1/2 top-1/3 z-30 rounded-full bg-[#0d9488] px-3 py-1 text-xs font-bold text-white shadow-md ring-2 ring-white"
              >
                +1 {{ product.satuan }}
              </span>

              <div
                class="relative flex h-28 cursor-pointer items-center justify-center overflow-hidden bg-slate-100 dark:bg-[#0b1424] sm:h-32"
                @click="handleAddProduct(product)"
              >
                <img
                  v-if="product.foto_url"
                  :src="product.foto_url"
                  :alt="product.nama_menu"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                >
                <div
                  v-else
                  class="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-400"
                >
                  <UIcon :name="getCategoryIcon(product.kategori)" class="h-7 w-7" />
                </div>

                <span class="absolute left-2 top-2 rounded bg-white/95 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-700 shadow-sm dark:bg-[#0f213d]/90 dark:text-slate-200 sm:text-[10px]">
                  {{ product.kode_barang }}
                </span>

                <span
                  class="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold shadow-sm tabular-nums sm:px-2 sm:text-[10px]"
                  :class="
                    isProductOutOfStock(product)
                      ? 'bg-[#ee6352] text-white'
                      : isProductLowStock(product)
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-[#0f213d] text-white dark:bg-teal-600'
                  "
                >
                  {{ getCardStockBadgeText(product) }}
                </span>

                <span
                  v-if="cartStore.getItemQty(product.id_produk) > 0"
                  class="absolute bottom-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#0d9488] px-1.5 text-xs font-bold text-white shadow ring-2 ring-white tabular-nums"
                >
                  {{ cartStore.getItemQty(product.id_produk) }}
                </span>
              </div>

              <div class="flex flex-1 flex-col p-2.5 sm:p-3.5">
                <div class="flex items-center justify-between gap-1">
                  <p class="truncate text-[9px] font-semibold uppercase tracking-wide text-[#0d9488] dark:text-teal-400 sm:text-[10px]">
                    {{ product.kategori }}
                  </p>
                  <span
                    v-if="product.uses_shared_dimsum_stock && product.isi_pcs > 1"
                    class="shrink-0 rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300 tabular-nums"
                  >
                    {{ product.isi_pcs }} pcs
                  </span>
                </div>
                <h3 class="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-[#0f213d] dark:text-white sm:text-sm">
                  {{ product.nama_menu }}
                </h3>

                <div class="mt-auto pt-2.5 sm:pt-3">
                  <p class="text-sm font-extrabold text-[#0f213d] dark:text-white tabular-nums sm:text-base">
                    {{ formatRupiah(product.harga_jual) }}
                    <span class="text-[10px] font-normal text-slate-400 sm:text-[11px]">/ {{ product.satuan }}</span>
                  </p>

                  <button
                    type="button"
                    :disabled="isProductOutOfStock(product)"
                    class="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[#0d9488] px-2.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 sm:mt-2.5 sm:gap-1.5 sm:px-3"
                    @click="handleAddProduct(product)"
                  >
                    <UIcon name="i-heroicons-plus" class="h-4 w-4" />
                    <span>{{ isProductOutOfStock(product) ? 'Habis' : 'Tambah' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- MOBILE STICKY FLOATING CART BAR (< lg only) -->
      <div class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-[0_-8px_24px_rgba(15,33,61,0.12)] backdrop-blur-md dark:border-slate-800 dark:bg-[#0f1b2e]/95 lg:hidden">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-white shadow-sm transition-all active:scale-[0.99]"
          :class="[
            cartBumping ? 'cart-bump' : '',
            cartStore.isEmpty ? 'bg-[#0f213d] dark:bg-[#182c4d]' : 'bg-[#0d9488] hover:bg-[#0b7a71]'
          ]"
          @click="mobileCartOpen = true"
        >
          <div class="flex items-center gap-2.5">
            <div class="relative flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
              <UIcon name="i-heroicons-shopping-cart" class="h-5 w-5" />
              <span
                v-if="cartStore.totalItemCount > 0"
                class="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ee6352] px-1 text-[10px] font-extrabold text-white tabular-nums"
              >
                {{ cartStore.totalItemCount }}
              </span>
            </div>
            <div class="text-left leading-tight">
              <p class="text-[11px] font-medium text-white/80">
                {{ cartStore.isEmpty ? 'Keranjang Kosong' : `${cartStore.totalItemCount} item · Takeaway` }}
              </p>
              <p class="text-base font-extrabold tabular-nums">
                {{ formatRupiah(cartStore.grandTotal) }}
              </p>
            </div>
          </div>

          <div class="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold">
            <span>{{ cartStore.isEmpty ? 'Keranjang' : 'Bayar' }}</span>
            <UIcon name="i-heroicons-chevron-up" class="h-4 w-4" />
          </div>
        </button>
      </div>

      <!-- MOBILE CART BACKDROP (< lg only) -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="mobileCartOpen"
          class="fixed inset-0 z-40 bg-[#091326]/60 backdrop-blur-[2px] lg:hidden"
          @click="mobileCartOpen = false"
        />
      </Transition>

      <!-- RIGHT PANEL (Desktop 35% Sidebar | Mobile Full-Height Slide-Up Bottom Sheet) -->
      <aside
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-3xl border-t border-slate-200/80 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-slate-800 dark:bg-[#0f1b2e] lg:static lg:z-auto lg:max-h-none lg:w-[35%] lg:translate-y-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none"
        :class="mobileCartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'"
      >
        <!-- Mobile Sheet Drag Handle + Close Bar -->
        <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800 lg:hidden">
          <div class="flex items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0d9488] text-white">
              <UIcon name="i-heroicons-shopping-bag" class="h-4 w-4" />
            </span>
            <div>
              <p class="text-sm font-bold text-[#0f213d] dark:text-white">Keranjang &amp; Pembayaran</p>
              <p class="text-[10px] text-slate-400">{{ cartStore.totalItemCount }} item dipilih</p>
            </div>
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-300"
            @click="mobileCartOpen = false"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>

        <!-- Invoice & Takeaway Header -->
        <div class="shrink-0 space-y-2.5 border-b border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-[#0b1424] sm:space-y-3 sm:p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Nomor Faktur Otomatis
              </p>
              <p class="font-mono text-sm font-bold text-[#0f213d] dark:text-teal-300 tabular-nums">
                {{ nextInvoice }}
              </p>
            </div>
            <button
              v-if="!cartStore.isEmpty"
              type="button"
              class="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-[#ee6352] transition-colors hover:bg-[#ee6352] hover:text-white dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-600"
              @click="cartStore.clearCart()"
            >
              <UIcon name="i-heroicons-trash" class="h-3.5 w-3.5" />
              <span>Kosongkan</span>
            </button>
          </div>

          <div class="flex items-center justify-between rounded-xl border border-teal-200/80 bg-teal-50/60 px-3 py-2 text-xs dark:border-teal-500/30 dark:bg-teal-950/35">
            <div class="flex items-center gap-2 font-semibold text-[#0f213d] dark:text-teal-200">
              <UIcon name="i-heroicons-shopping-bag" class="h-4 w-4 text-[#0d9488]" />
              <span>Pesanan Takeaway (Bungkus)</span>
            </div>
            <span class="rounded-md bg-[#0d9488] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              Takeaway
            </span>
          </div>
        </div>

        <!-- Cart Items List -->
        <div class="custom-scroll min-h-[120px] flex-1 overflow-y-auto p-3.5">
          <div
            v-if="cartStore.isEmpty"
            class="flex h-full min-h-[140px] flex-col items-center justify-center text-center"
          >
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-teal-400">
              <UIcon name="i-heroicons-shopping-cart" class="h-6 w-6" />
            </div>
            <p class="mt-2.5 text-sm font-bold text-[#0f213d] dark:text-white">Keranjang Masih Kosong</p>
            <p class="mt-1 max-w-[230px] text-xs text-slate-500 dark:text-slate-400">
              Pilih menu dimsum terlebih dahulu untuk memulai transaksi.
            </p>
            <button
              type="button"
              class="mt-3 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white lg:hidden"
              @click="mobileCartOpen = false"
            >
              Pilih Menu Dimsum
            </button>
          </div>

          <TransitionGroup v-else name="cart-list" tag="div" class="space-y-2.5">
            <div
              v-for="item in cartStore.items"
              :key="item.id_produk"
              class="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 transition-colors hover:border-teal-300 dark:border-slate-800 dark:bg-[#111d33] dark:hover:border-teal-500/40"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate text-sm font-bold text-[#0f213d] dark:text-white">
                    {{ item.nama_menu }}
                  </p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {{ formatRupiah(item.harga_jual) }} ·
                    <template v-if="item.uses_shared_dimsum_stock">
                      {{ item.qty * item.isi_pcs }} pcs dimsum
                    </template>
                    <template v-else>
                      sisa stok {{ item.stok_tersedia }} {{ item.satuan }}
                    </template>
                  </p>
                </div>
                <p class="shrink-0 text-sm font-bold text-[#0d9488] dark:text-teal-400 tabular-nums">
                  {{ formatRupiah(item.subtotal) }}
                </p>
              </div>

              <div
                v-if="item.catatan && editingNoteId !== item.id_produk"
                class="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
              >
                <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="h-3 w-3 shrink-0" />
                <span>{{ item.catatan }}</span>
              </div>

              <div class="mt-2.5 flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:border-teal-400 hover:bg-teal-50 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:hover:bg-slate-800 sm:h-7 sm:w-7"
                    @click="cartStore.decrementQty(item.id_produk)"
                  >
                    <UIcon name="i-heroicons-minus" class="h-3.5 w-3.5" />
                  </button>
                  <span class="w-8 text-center text-xs font-bold text-[#0f213d] dark:text-white tabular-nums">
                    {{ item.qty }}
                  </span>
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[#0d9488] hover:bg-[#0d9488] hover:text-white dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:hover:bg-teal-600 sm:h-7 sm:w-7"
                    @click="handleIncrement(item.id_produk)"
                  >
                    <UIcon name="i-heroicons-plus" class="h-3.5 w-3.5" />
                  </button>
                </div>

                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors"
                    :class="
                      item.catatan || editingNoteId === item.id_produk
                        ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:text-[#0f213d] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300 dark:hover:text-white'
                    "
                    @click="openNoteEditor(item.id_produk, item.catatan)"
                  >
                    <UIcon name="i-heroicons-pencil" class="h-3 w-3" />
                    <span>Catatan</span>
                  </button>
                  <button
                    type="button"
                    class="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-[#ee6352] dark:hover:bg-rose-950/50 dark:hover:text-rose-300"
                    title="Hapus item"
                    @click="cartStore.removeItem(item.id_produk)"
                  >
                    <UIcon name="i-heroicons-trash" class="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div v-if="editingNoteId === item.id_produk" class="mt-2.5 space-y-2 border-t border-slate-200 pt-2.5 dark:border-slate-800">
                <div class="flex gap-1.5">
                  <input
                    v-model="noteDraft"
                    type="text"
                    placeholder="cth: Saus dipisah, Extra Chili Oil"
                    class="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
                    @keydown.enter.prevent="saveNote(item.id_produk)"
                  >
                  <button
                    type="button"
                    class="rounded-lg bg-[#0d9488] px-2.5 py-1 text-xs font-bold text-white"
                    @click="saveNote(item.id_produk)"
                  >
                    OK
                  </button>
                </div>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="preset in notePresets"
                    :key="preset"
                    type="button"
                    class="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-teal-400 hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300"
                    @click="applyNotePreset(item.id_produk, preset)"
                  >
                    + {{ preset }}
                  </button>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>

        <!-- Summary & Payment Footer -->
        <div class="shrink-0 space-y-2.5 border-t border-slate-200/80 bg-slate-50/70 p-3.5 pb-5 dark:border-slate-800 dark:bg-[#0b1424] sm:space-y-3 sm:p-4">
          <div class="space-y-1 text-xs">
            <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Total Item ({{ cartStore.totalItemCount }} item)</span>
              <span class="tabular-nums">{{ formatRupiah(cartStore.subtotal) }}</span>
            </div>
            <div class="flex items-center justify-between pt-0.5">
              <span class="text-sm font-bold text-[#0f213d] dark:text-white">Grand Total</span>
              <span
                class="text-lg font-extrabold text-[#0f213d] tabular-nums transition-transform dark:text-white sm:text-xl"
                :class="{ 'cart-bump text-[#0d9488] dark:text-teal-400': cartBumping }"
              >
                {{ formatRupiah(cartStore.grandTotal) }}
              </span>
            </div>
          </div>

          <!-- 2 Walk-in Payment Options: Tunai & QRIS (Driver Food diproses lewat menu Driver Food) -->
          <div class="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-[#111d33]">
            <button
              type="button"
              class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors"
              :class="
                cartStore.metodePembayaran === 'Tunai'
                  ? 'bg-[#0f213d] text-white dark:bg-[#0d9488]'
                  : 'text-slate-600 hover:text-[#0f213d] dark:text-slate-400 dark:hover:text-white'
              "
              @click="cartStore.setMetodePembayaran('Tunai')"
            >
              <UIcon name="i-heroicons-banknotes" class="h-4 w-4" />
              <span>Tunai</span>
            </button>
            <button
              type="button"
              class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors"
              :class="
                cartStore.metodePembayaran === 'QRIS'
                  ? 'bg-[#0f213d] text-white dark:bg-[#0d9488]'
                  : 'text-slate-600 hover:text-[#0f213d] dark:text-slate-400 dark:hover:text-white'
              "
              @click="cartStore.setMetodePembayaran('QRIS')"
            >
              <UIcon name="i-heroicons-qr-code" class="h-4 w-4" />
              <span>QRIS</span>
            </button>
          </div>

          <div v-if="cartStore.metodePembayaran === 'Tunai'" class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-slate-600 dark:text-slate-400">Tunai</span>
              <div class="relative flex-1">
                <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <input
                  :value="cartStore.uangBayar || ''"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  step="500"
                  placeholder="0"
                  class="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-right text-sm font-extrabold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:outline-none dark:border-slate-700 dark:bg-[#111d33] dark:text-white"
                  @input="cartStore.setUangBayar(Number(($event.target as HTMLInputElement).value))"
                >
              </div>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                class="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-[#0d9488] transition-colors hover:bg-[#0d9488] hover:text-white dark:border-teal-500/40 dark:bg-teal-950/60 dark:text-teal-300"
                @click="cartStore.setUangPas()"
              >
                Uang Pas
              </button>
              <button
                v-for="amt in quickCashAmounts"
                :key="amt"
                type="button"
                class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 tabular-nums hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200 dark:hover:border-teal-500"
                @click="cartStore.setUangBayar(amt)"
              >
                {{ formatRupiah(amt) }}
              </button>
            </div>

            <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-[#111d33]">
              <span class="font-medium text-slate-500 dark:text-slate-400">
                {{ cartStore.kekuranganBayar > 0 && !cartStore.isEmpty ? 'Kurang Bayar' : 'Kembalian' }}
              </span>
              <span
                class="text-sm font-extrabold tabular-nums"
                :class="cartStore.kekuranganBayar > 0 && !cartStore.isEmpty ? 'text-[#ee6352]' : 'text-[#0d9488] dark:text-teal-400'"
              >
                {{
                  cartStore.kekuranganBayar > 0 && !cartStore.isEmpty
                    ? formatRupiah(cartStore.kekuranganBayar)
                    : formatRupiah(cartStore.kembalian)
                }}
              </span>
            </div>
          </div>

          <div
            v-else
            class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-[#0f213d] dark:border-slate-800 dark:bg-[#111d33] dark:text-slate-100"
          >
            <button
              type="button"
              class="group relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 transition-transform hover:scale-[1.03] sm:h-24 sm:w-20"
              title="Klik untuk memperbesar QRIS"
              @click="qrisModalOpen = true"
            >
              <img
                :src="qrisUrl"
                alt="QRIS Pembayaran"
                class="h-full w-full object-contain"
              >
              <span class="absolute inset-x-0 bottom-0 bg-[#0f213d]/90 py-0.5 text-[9px] font-bold text-white">
                Perbesar
              </span>
            </button>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="rounded bg-[#0d9488] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                  QRIS
                </span>
                <span class="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Nominal Pas
                </span>
              </div>
              <p class="mt-1 text-base font-extrabold text-[#0f213d] dark:text-white tabular-nums">
                {{ formatRupiah(cartStore.grandTotal) }}
              </p>
              <p class="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                Scan via GoPay, OVO, DANA, ShopeePay, atau M-Banking.
              </p>

              <button
                type="button"
                class="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-[#0f213d] px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-[#0d9488] dark:bg-teal-600 dark:hover:bg-teal-500"
                @click="qrisModalOpen = true"
              >
                <UIcon name="i-heroicons-magnifying-glass-plus" class="h-3.5 w-3.5" />
                <span>Perbesar QRIS</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            :disabled="!cartStore.canCheckout"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d9488] px-4 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[#0b7a71] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            @click="handleCheckout"
          >
            <UIcon
              :name="cartStore.isSubmitting ? 'i-heroicons-arrow-path' : 'i-heroicons-printer'"
              class="h-5 w-5"
              :class="{ 'animate-spin': cartStore.isSubmitting }"
            />
            <span>
              {{ cartStore.isSubmitting ? 'MEMPROSES TRANSAKSI...' : 'BAYAR & CETAK STRUK' }}
            </span>
          </button>
        </div>
      </aside>
    </div>

    <!-- Thermal Receipt Modal -->
    <ReceiptModal
      v-model="receiptModalOpen"
      :receipt="cartStore.lastReceipt"
    />

    <!-- Top Pop-up Notification for Incoming Driver Food Orders (Kasir Only) -->
    <DriverOrderAlertBanner
      @accept-and-print="handleAcceptOnlineOrders"
      @open-queue="driverQueueOpen = true; fetchDriverQueue()"
    />

    <!-- Top Pop-up Notification when Admin Sends Dimsum Stock Supply -->
    <PosStockSupplyBanner
      ref="stockSupplyBannerRef"
      @stock-received="fetchProducts"
      @status-updated="handleStockStatusUpdate"
    />

    <!-- Modal Pengajuan Pemasokan Stok Dimsum ke Admin -->
    <UModal v-model="stockRequestModalOpen" :ui="{ width: 'sm:max-w-lg' }">
      <form class="overflow-hidden rounded-2xl bg-white text-[#0f213d] dark:bg-[#111d33] dark:text-slate-100" @submit.prevent="handleSubmitStockRequest">
        <div class="flex items-center justify-between border-b border-slate-200 bg-[#0f213d] px-5 py-4 text-white dark:border-slate-800">
          <div class="flex items-center gap-2.5">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ee6352] text-white">
              <UIcon name="i-heroicons-bell-alert" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold">Ajukan Pemasokan Stok Dimsum</h3>
              <p class="text-[11px] text-teal-200/85">Laporan langsung terkirim sebagai notifikasi ke Admin</p>
            </div>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            @click="stockRequestModalOpen = false"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>

        <div class="max-h-[75vh] space-y-4 overflow-y-auto p-5">
          <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-[#0b1424]">
            <div>
              <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">Sisa Stok Dimsum Saat Ini</p>
              <p
                class="text-xl font-extrabold tabular-nums"
                :class="cartStore.remainingDimsumPcs <= 0 ? 'text-[#ee6352]' : 'text-[#0f213d] dark:text-white'"
              >
                {{ cartStore.remainingDimsumPcs }} Pcs
              </p>
            </div>
            <span
              class="rounded-full px-2.5 py-1 text-xs font-bold"
              :class="
                cartStore.remainingDimsumPcs <= 0
                  ? 'bg-rose-100 text-[#ee6352] dark:bg-rose-950/60 dark:text-rose-300'
                  : cartStore.remainingDimsumPcs <= dimsumStock.stok_minimum_pcs
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
              "
            >
              {{ cartStore.remainingDimsumPcs <= 0 ? 'Stok Habis' : cartStore.remainingDimsumPcs <= dimsumStock.stok_minimum_pcs ? 'Menipis' : 'Aman' }}
            </span>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Jumlah Pasokan yang Diajukan (Pcs) *
            </label>
            <input
              v-model.number="stockRequestQty"
              type="number"
              inputmode="numeric"
              min="1"
              max="10000"
              required
              class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-base font-extrabold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
            >
            <div class="mt-2 flex flex-wrap gap-1.5">
              <button
                v-for="preset in stockRequestQtyPresets"
                :key="preset"
                type="button"
                class="rounded-lg border px-3 py-1 text-xs font-semibold transition-colors tabular-nums"
                :class="
                  stockRequestQty === preset
                    ? 'border-[#0d9488] bg-[#0d9488] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300'
                "
                @click="stockRequestQty = preset"
              >
                +{{ preset }} Pcs
              </button>
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Catatan untuk Admin / Dapur
            </label>
            <input
              v-model="stockRequestNote"
              type="text"
              placeholder="cth: Stok dimsum habis, banyak pesanan!"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
            >
            <div class="mt-1.5 flex flex-wrap gap-1">
              <button
                v-for="note in stockRequestNotePresets"
                :key="note"
                type="button"
                class="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-teal-400 hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300"
                @click="stockRequestNote = note"
              >
                {{ note }}
              </button>
            </div>
          </div>

          <!-- Info & Tombol Kirim WA Manual ke Admin -->
          <div class="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 text-xs dark:border-emerald-500/30 dark:bg-emerald-950/30">
            <div class="flex items-start gap-2.5">
              <div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white">
                <UIcon name="i-heroicons-chat-bubble-oval-left-ellipsis" class="h-4 w-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-emerald-900 dark:text-emerald-200">
                  {{ waNotifyStatus?.configured && waNotifyStatus?.enabled ? 'Kirim Notif ke WhatsApp Admin Siap' : 'Nomor WhatsApp Admin Belum Diatur' }}
                </p>
                <p class="mt-0.5 text-[11px] leading-relaxed text-emerald-800/85 dark:text-emerald-300/80">
                  <template v-if="waNotifyStatus?.configured && waNotifyStatus?.enabled">
                    Saat Anda klik ajukan, laporan stok tersimpan ke sistem dan format pesan WhatsApp ke Admin langsung terbuka siap kirim.
                  </template>
                  <template v-else>
                    Minta Admin mengisi Nomor WA di menu <strong>Admin → Aksi Cepat → Notif WhatsApp</strong> agar bisa langsung kirim laporan ke WA Admin.
                  </template>
                </p>

                <label
                  v-if="waNotifyStatus?.configured && waNotifyStatus?.enabled"
                  class="mt-2 inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200"
                >
                  <input
                    v-model="autoOpenWaLink"
                    type="checkbox"
                    class="h-3.5 w-3.5 rounded accent-[#25D366]"
                  >
                  <span>Buka WhatsApp otomatis setelah klik ajukan</span>
                </label>
              </div>
            </div>

            <!-- Tombol 1-Klik Kirim WA setelah pengajuan tersimpan -->
            <div
              v-if="lastSubmittedWaUrl"
              class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-200/80 pt-2.5 dark:border-emerald-500/30"
            >
              <span class="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                Pengajuan tersimpan! Kirim ke WA Admin:
              </span>
              <a
                :href="lastSubmittedWaUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#1fb858]"
                @click="stockRequestModalOpen = false"
              >
                <UIcon name="i-heroicons-chat-bubble-oval-left-ellipsis" class="h-4 w-4" />
                <span>Kirim ke WA Admin Sekarang</span>
              </a>
            </div>
          </div>

          <!-- Riwayat Singkat Status Pengajuan Kasir -->
          <div v-if="recentStockRequests.length > 0" class="border-t border-slate-100 pt-3 dark:border-slate-800">
            <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Status Pengajuan Terakhir
            </p>
            <div class="space-y-2">
              <div
                v-for="req in recentStockRequests.slice(0, 4)"
                :key="req.id_request"
                class="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-[#0b1424]"
              >
                <div class="min-w-0">
                  <p class="font-bold text-[#0f213d] tabular-nums dark:text-white">
                    +{{ req.qty_dikirim ?? req.qty_diminta }} Pcs
                    <span class="font-normal text-slate-400">· {{ formatDateTimeWib(req.created_at) }}</span>
                  </p>
                  <p v-if="req.catatan_admin" class="truncate text-[10px] text-[#0d9488] dark:text-teal-300">
                    Admin: {{ req.catatan_admin }}
                  </p>
                </div>
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  :class="
                    req.status === 'Menunggu Admin'
                      ? 'bg-rose-50 text-[#ee6352] dark:bg-rose-950/60 dark:text-rose-300'
                      : req.status === 'Sedang Diproduksi'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        : req.status === 'Dikirim ke Kasir'
                          ? 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  "
                >
                  {{ req.status }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-[#0b1424]">
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#15243d] dark:text-slate-200"
            @click="stockRequestModalOpen = false"
          >
            Batal
          </button>
          <button
            type="submit"
            :disabled="submittingStockRequest"
            class="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-60"
          >
            <UIcon
              :name="submittingStockRequest ? 'i-heroicons-arrow-path' : 'i-heroicons-paper-airplane'"
              class="h-4 w-4"
              :class="{ 'animate-spin': submittingStockRequest }"
            />
            <span>{{ submittingStockRequest ? 'Mengirim...' : 'Kirim Pengajuan ke Admin' }}</span>
          </button>
        </div>
      </form>
    </UModal>

    <!-- Customer-Facing QRIS Modal -->
    <QrisModal
      v-model="qrisModalOpen"
      :qris-url="qrisUrl"
      :has-custom-qris="hasCustomQris"
      :amount="cartStore.grandTotal"
      :invoice-no="nextInvoice"
      :can-checkout="cartStore.canCheckout"
      :validation-message="cartStore.checkoutValidationMessage"
      :is-submitting="cartStore.isSubmitting"
      :can-upload-qris="false"
      @confirm-checkout="handleCheckout"
      @qris-uploaded="handleQrisUploaded"
    />

    <!-- Quick Driver Food Queue Modal for Kasir -->
    <UModal v-model="driverQueueOpen" :ui="{ width: 'sm:max-w-2xl' }">
      <div class="overflow-hidden rounded-2xl bg-white text-[#0f213d] dark:bg-[#111d33] dark:text-slate-100">
        <div class="flex items-center justify-between border-b border-slate-200 bg-[#0f213d] px-5 py-4 text-white dark:border-slate-800">
          <div class="flex items-center gap-2.5">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-white">
              <UIcon name="i-heroicons-truck" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold">Antrean Pesanan Driver Food (Hari Ini)</h3>
              <p class="text-[11px] text-teal-200/85">Perbarui status pengolahan untuk ShopeeFood &amp; GoFood</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
              @click="fetchDriverQueue"
            >
              <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" :class="{ 'animate-spin': loadingDriverOrders }" />
            </button>
            <button
              type="button"
              class="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              @click="driverQueueOpen = false"
            >
              <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div class="max-h-[75vh] space-y-3 overflow-y-auto p-4 sm:p-5">
          <!-- Rule Info Banner -->
          <div class="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            <UIcon name="i-heroicons-information-circle" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <span>
              Stok dimsum &amp; pencatatan pemasukan <strong>baru dihitung otomatis saat Anda menekan tombol "Diambil Driver"</strong>. Jika batal sebelum diambil, klik <strong>Batalkan</strong>.
            </span>
          </div>

          <!-- Action Bar: Catat Order Asli + Simulasi Demo -->
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200/80 bg-teal-50/60 px-3 py-2 text-xs dark:border-teal-500/30 dark:bg-teal-950/30">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-lg bg-[#0d9488] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#0b7a71]"
              @click="showCreateDriverForm = !showCreateDriverForm"
            >
              <UIcon :name="showCreateDriverForm ? 'i-heroicons-x-mark' : 'i-heroicons-plus-circle'" class="h-3.5 w-3.5" />
              <span>{{ showCreateDriverForm ? 'Tutup Form Order' : '+ Catat Order Driver' }}</span>
            </button>

            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Demo:</span>
              <button
                type="button"
                :disabled="creatingDriverDemo"
                class="rounded-md bg-[#ee4d2d] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#d94122] disabled:opacity-60"
                @click="createDriverDemoFromPos('ShopeeFood')"
              >
                + ShopeeFood
              </button>
              <button
                type="button"
                :disabled="creatingDriverDemo"
                class="rounded-md bg-[#00aa13] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#009210] disabled:opacity-60"
                @click="createDriverDemoFromPos('GoFood')"
              >
                + GoFood
              </button>
              <button
                type="button"
                :disabled="creatingDriverDemo"
                class="rounded-md bg-[#0f213d] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#19355f] disabled:opacity-60 dark:bg-slate-700"
                @click="createDriverDemoFromPos('pack')"
              >
                + 3 Demo
              </button>
            </div>
          </div>

          <!-- Inline Form: + Catat Order Driver Asli (dari HP ShopeeFood / GoBiz) -->
          <div
            v-if="showCreateDriverForm"
            class="space-y-3 rounded-xl border border-teal-300/80 bg-white p-3.5 shadow-sm dark:border-teal-500/40 dark:bg-[#0b1424]"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs font-extrabold text-[#0f213d] dark:text-white">
                Catat Order Masuk Driver Food (Asli)
              </p>
              <div class="flex gap-1.5">
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors"
                  :class="newDriverPlatform === 'ShopeeFood' ? 'bg-[#ee4d2d] text-white' : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'"
                  @click="newDriverPlatform = 'ShopeeFood'"
                >
                  ShopeeFood
                </button>
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors"
                  :class="newDriverPlatform === 'GoFood' ? 'bg-[#00aa13] text-white' : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'"
                  @click="newDriverPlatform = 'GoFood'"
                >
                  GoFood (Gojek)
                </button>
              </div>
            </div>

            <input
              v-model="newDriverCode"
              type="text"
              :placeholder="newDriverPlatform === 'ShopeeFood' ? 'Kode order / nama driver (cth: #SF-204 · Budi)' : 'Kode order / nama driver (cth: #GF-118 · Andi)'"
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#111d33] dark:text-white"
            >

            <div class="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              <div
                v-for="prod in products"
                :key="`drv-${prod.id_produk}`"
                class="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-xs dark:border-slate-800 dark:bg-[#111d33]"
              >
                <div class="min-w-0">
                  <p class="truncate font-semibold text-[#0f213d] dark:text-white">{{ prod.nama_menu }}</p>
                  <p class="text-[10px] text-slate-400 tabular-nums">{{ formatRupiah(prod.harga_jual) }}</p>
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    class="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-rose-400 hover:text-rose-500 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200"
                    @click="adjustNewDriverItemQty(prod.id_produk, -1)"
                  >
                    -
                  </button>
                  <span class="w-5 text-center text-xs font-extrabold tabular-nums">
                    {{ getNewDriverItemQty(prod.id_produk) }}
                  </span>
                  <button
                    type="button"
                    class="flex h-6 w-6 items-center justify-center rounded bg-[#0d9488] text-xs font-bold text-white hover:bg-[#0b7a71]"
                    @click="adjustNewDriverItemQty(prod.id_produk, 1)"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <span class="text-xs font-bold text-[#0f213d] tabular-nums dark:text-white">
                Estimasi: {{ formatRupiah(newDriverEstimatedTotal) }}
              </span>
              <button
                type="button"
                :disabled="submittingDriverOrder || newDriverItems.length === 0"
                class="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#0b7a71] disabled:opacity-50"
                @click="handleCreateManualDriverOrder"
              >
                <span>{{ submittingDriverOrder ? 'Menyimpan...' : 'Masukkan ke Antrean' }}</span>
              </button>
            </div>
          </div>

          <div
            v-if="driverOrders.length === 0"
            class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center dark:border-slate-700 dark:bg-[#0b1424]"
          >
            <UIcon name="i-heroicons-check-circle" class="h-9 w-9 text-[#0d9488]" />
            <p class="mt-2 text-sm font-bold text-[#0f213d] dark:text-white">Tidak Ada Antrean Driver Aktif</p>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Pesanan ShopeeFood atau GoFood yang masuk akan muncul otomatis di sini.
            </p>
          </div>

          <div
            v-for="order in driverOrders"
            :key="order.no_faktur"
            class="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-[#0b1424]"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span
                  class="rounded-md px-2 py-0.5 text-[10px] font-extrabold text-white"
                  :class="order.metode_pembayaran === 'ShopeeFood' ? 'bg-[#ee4d2d]' : 'bg-[#00aa13]'"
                >
                  {{ order.metode_pembayaran === 'ShopeeFood' ? 'ShopeeFood' : 'GoFood · Gojek' }}
                </span>
                <span class="font-mono text-xs font-bold text-[#0f213d] dark:text-white">{{ order.no_faktur }}</span>
                <span v-if="order.kode_order_driver" class="rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-[#111d33] dark:text-slate-200 dark:ring-slate-700">
                  {{ order.kode_order_driver }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-extrabold text-[#0f213d] tabular-nums dark:text-white">
                  {{ formatRupiah(order.total_harga) }}
                </span>
                <button
                  type="button"
                  :disabled="cancelingDriverInvoice === order.no_faktur"
                  class="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-[#ee6352] hover:bg-[#ee6352] hover:text-white disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300"
                  title="Batalkan order driver sebelum diambil"
                  @click="cancelDriverOrderFromPos(order)"
                >
                  Batalkan
                </button>
              </div>
            </div>

            <div class="mt-2 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
              <p v-for="(it, idx) in order.items" :key="`${order.no_faktur}-${idx}`">
                <strong class="text-[#0f213d] dark:text-white">{{ it.qty }}x</strong> {{ it.nama_menu }}
                <span v-if="it.catatan" class="italic text-amber-600 dark:text-amber-300">({{ it.catatan }})</span>
              </p>
            </div>

            <p class="mt-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              ⏳ Belum potong stok &amp; belum masuk omzet — klik <strong>Diambil Driver</strong> saat diserahkan ke driver.
            </p>

            <div class="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <button
                v-for="st in DRIVER_ORDER_STATUSES"
                :key="st"
                type="button"
                :disabled="updatingDriverInvoice === order.no_faktur"
                class="rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors"
                :class="
                  order.status_pesanan === st
                    ? st === 'Sudah Siap'
                      ? 'border-[#0d9488] bg-[#0d9488] text-white'
                      : st === 'Sedang Dibungkus'
                        ? 'border-[#2e86c1] bg-[#2e86c1] text-white'
                        : st === 'Diambil Driver'
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-amber-500 bg-amber-500 text-white'
                    : st === 'Diambil Driver'
                      ? 'border-teal-300 bg-teal-50/70 font-bold text-[#0d9488] hover:bg-[#0d9488] hover:text-white dark:border-teal-500/40 dark:bg-teal-950/40 dark:text-teal-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400 hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-300'
                "
                @click="updateDriverOrderStatus(order, st)"
              >
                {{ st }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </UModal>

    <!-- Cashier Shift / Closing & Cash Drawer Reconciliation Modal -->
    <CashierShiftModal
      v-model="shiftModalOpen"
      @logout-requested="handleLogout"
    />
  </div>
</template>

<style scoped>
.cart-list-enter-active,
.cart-list-leave-active {
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.cart-list-enter-from {
  opacity: 0;
  transform: translateX(18px) scale(0.96);
}

.cart-list-leave-to {
  opacity: 0;
  transform: translateX(-18px) scale(0.94);
}
</style>
