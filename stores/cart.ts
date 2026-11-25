import { defineStore } from 'pinia'
import type {
  CartItem,
  OrderType,
  PaymentMethod,
  ProductItem,
  ReceiptData
} from '~/types/pos'

export interface CartActionResult {
  ok: boolean
  message?: string
}

interface CheckoutApiResponse {
  success: boolean
  message: string
  data: ReceiptData
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const sharedDimsumPcs = ref<number>(0)
  const tipePesanan = ref<OrderType>('Takeaway')
  const nomorMeja = ref<string>('')
  const metodePembayaran = ref<PaymentMethod>('Tunai')
  const kodeOrderDriver = ref<string>('')
  const uangBayar = ref<number>(0)
  const isSubmitting = ref<boolean>(false)
  const lastReceipt = ref<ReceiptData | null>(null)

  const isNonCashExactPayment = computed(() => metodePembayaran.value !== 'Tunai')

  const totalItemCount = computed(() =>
    items.value.reduce((total, item) => total + item.qty, 0)
  )

  const uniqueItemCount = computed(() => items.value.length)

  const isEmpty = computed(() => items.value.length === 0)

  const usedDimsumPcsInCart = computed(() =>
    items.value.reduce((sum, item) => {
      if (!item.uses_shared_dimsum_stock) return sum
      return sum + item.qty * Math.max(1, item.isi_pcs || 1)
    }, 0)
  )

  const remainingDimsumPcs = computed(() =>
    Math.max(0, sharedDimsumPcs.value - usedDimsumPcsInCart.value)
  )

  const subtotal = computed(() =>
    items.value.reduce((sum, item) => sum + item.harga_jual * item.qty, 0)
  )

  const grandTotal = computed(() => subtotal.value)

  const effectiveBayar = computed(() => {
    if (isNonCashExactPayment.value) {
      return grandTotal.value
    }
    const parsed = Number(uangBayar.value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  })

  const kembalian = computed(() => {
    if (isNonCashExactPayment.value) {
      return 0
    }
    return Math.max(0, effectiveBayar.value - grandTotal.value)
  })

  const kekuranganBayar = computed(() => {
    if (isNonCashExactPayment.value) {
      return 0
    }
    return Math.max(0, grandTotal.value - effectiveBayar.value)
  })

  const isPaymentSufficient = computed(() => {
    if (isEmpty.value) {
      return false
    }
    if (isNonCashExactPayment.value) {
      return true
    }
    return effectiveBayar.value >= grandTotal.value
  })

  const isTableValid = computed(() => true)

  const canCheckout = computed(() =>
    !isEmpty.value &&
    isTableValid.value &&
    isPaymentSufficient.value &&
    !isSubmitting.value
  )

  const checkoutValidationMessage = computed(() => {
    if (isEmpty.value) {
      return 'Pilih minimal 1 menu dimsum terlebih dahulu.'
    }
    if (!isPaymentSufficient.value) {
      return 'Nominal uang tunai masih kurang dari Grand Total.'
    }
    return ''
  })

  function getItemQty(idProduk: number): number {
    const found = items.value.find(item => item.id_produk === idProduk)
    return found ? found.qty : 0
  }

  function addItem(product: ProductItem): CartActionResult {
    const usesShared = product.uses_shared_dimsum_stock
    const isiPcs = usesShared ? Math.max(1, product.isi_pcs || 1) : 0

    if (usesShared) {
      if (remainingDimsumPcs.value < isiPcs) {
        return {
          ok: false,
          message: `Sisa stok produksi dimsum tinggal ${remainingDimsumPcs.value} pcs (tidak cukup untuk ${product.nama_menu} yang butuh ${isiPcs} pcs).`
        }
      }
    } else if (product.stok <= 0) {
      return {
        ok: false,
        message: `Stok ${product.nama_menu} sedang habis.`
      }
    }

    const existing = items.value.find(item => item.id_produk === product.id_produk)
    if (existing) {
      existing.stok_tersedia = product.stok
      existing.harga_jual = product.harga_jual
      existing.isi_pcs = isiPcs
      existing.uses_shared_dimsum_stock = usesShared

      if (!usesShared && existing.qty >= product.stok) {
        return {
          ok: false,
          message: `Stok ${product.nama_menu} tersisa ${product.stok} ${product.satuan}.`
        }
      }

      existing.qty += 1
      existing.subtotal = existing.qty * existing.harga_jual
      return { ok: true }
    }

    items.value.push({
      id_produk: product.id_produk,
      kode_barang: product.kode_barang,
      nama_menu: product.nama_menu,
      kategori: product.kategori,
      satuan: product.satuan,
      isi_pcs: isiPcs,
      uses_shared_dimsum_stock: usesShared,
      harga_jual: product.harga_jual,
      stok_tersedia: product.stok,
      foto_url: product.foto_url,
      qty: 1,
      catatan: '',
      subtotal: product.harga_jual
    })

    return { ok: true }
  }

  function incrementQty(idProduk: number): CartActionResult {
    const item = items.value.find(entry => entry.id_produk === idProduk)
    if (!item) {
      return { ok: false, message: 'Item tidak ditemukan di keranjang.' }
    }

    if (item.uses_shared_dimsum_stock) {
      const pcsNeeded = Math.max(1, item.isi_pcs || 1)
      if (remainingDimsumPcs.value < pcsNeeded) {
        return {
          ok: false,
          message: `Sisa stok produksi dimsum tinggal ${remainingDimsumPcs.value} pcs (butuh ${pcsNeeded} pcs lagi).`
        }
      }
    } else if (item.qty >= item.stok_tersedia) {
      return {
        ok: false,
        message: `Maksimal stok ${item.nama_menu} yang tersedia adalah ${item.stok_tersedia} ${item.satuan}.`
      }
    }

    item.qty += 1
    item.subtotal = item.qty * item.harga_jual
    return { ok: true }
  }

  function decrementQty(idProduk: number): void {
    const index = items.value.findIndex(entry => entry.id_produk === idProduk)
    if (index === -1) {
      return
    }

    const item = items.value[index]
    if (item.qty <= 1) {
      items.value.splice(index, 1)
      return
    }

    item.qty -= 1
    item.subtotal = item.qty * item.harga_jual
  }

  function setItemQty(idProduk: number, nextQty: number): CartActionResult {
    const index = items.value.findIndex(entry => entry.id_produk === idProduk)
    if (index === -1) {
      return { ok: false, message: 'Item tidak ditemukan di keranjang.' }
    }

    if (!Number.isInteger(nextQty) || nextQty <= 0) {
      items.value.splice(index, 1)
      return { ok: true }
    }

    const item = items.value[index]

    if (item.uses_shared_dimsum_stock) {
      const pcsPerUnit = Math.max(1, item.isi_pcs || 1)
      const otherUsedPcs = usedDimsumPcsInCart.value - item.qty * pcsPerUnit
      const maxUnitsAllowed = Math.floor(Math.max(0, sharedDimsumPcs.value - otherUsedPcs) / pcsPerUnit)
      if (nextQty > maxUnitsAllowed) {
        item.qty = maxUnitsAllowed
        item.subtotal = item.qty * item.harga_jual
        if (item.qty <= 0) {
          items.value.splice(index, 1)
        }
        return {
          ok: false,
          message: `Stok produksi dimsum hanya mencukupi maksimal ${maxUnitsAllowed} ${item.satuan}.`
        }
      }
    } else if (nextQty > item.stok_tersedia) {
      item.qty = item.stok_tersedia
      item.subtotal = item.qty * item.harga_jual
      return {
        ok: false,
        message: `Stok ${item.nama_menu} hanya tersisa ${item.stok_tersedia} ${item.satuan}.`
      }
    }

    item.qty = nextQty
    item.subtotal = item.qty * item.harga_jual
    return { ok: true }
  }

  function removeItem(idProduk: number): void {
    items.value = items.value.filter(entry => entry.id_produk !== idProduk)
  }

  function updateItemNote(idProduk: number, catatan: string): void {
    const item = items.value.find(entry => entry.id_produk === idProduk)
    if (!item) {
      return
    }
    item.catatan = catatan.trim().slice(0, 255)
  }

  function syncProductsStock(latestProducts: ProductItem[], latestSharedPcs?: number): void {
    if (typeof latestSharedPcs === 'number') {
      sharedDimsumPcs.value = Math.max(0, latestSharedPcs)
    }

    const map = new Map(latestProducts.map(p => [p.id_produk, p]))
    const updated: CartItem[] = []
    let remainingPool = sharedDimsumPcs.value

    for (const item of items.value) {
      const latest = map.get(item.id_produk)
      if (!latest) continue

      if (latest.uses_shared_dimsum_stock) {
        const isiPcs = Math.max(1, latest.isi_pcs || 1)
        const maxAllowed = Math.floor(remainingPool / isiPcs)
        const clampedQty = Math.min(item.qty, maxAllowed)
        if (clampedQty <= 0) continue

        remainingPool -= clampedQty * isiPcs
        updated.push({
          ...item,
          nama_menu: latest.nama_menu,
          satuan: latest.satuan,
          isi_pcs: isiPcs,
          uses_shared_dimsum_stock: true,
          harga_jual: latest.harga_jual,
          stok_tersedia: latest.stok,
          foto_url: latest.foto_url,
          qty: clampedQty,
          subtotal: clampedQty * latest.harga_jual
        })
      } else {
        if (latest.stok <= 0) continue
        const clampedQty = Math.min(item.qty, latest.stok)
        updated.push({
          ...item,
          nama_menu: latest.nama_menu,
          satuan: latest.satuan,
          isi_pcs: 0,
          uses_shared_dimsum_stock: false,
          harga_jual: latest.harga_jual,
          stok_tersedia: latest.stok,
          foto_url: latest.foto_url,
          qty: clampedQty,
          subtotal: clampedQty * latest.harga_jual
        })
      }
    }

    items.value = updated
  }

  function setTipePesanan(tipe: OrderType): void {
    tipePesanan.value = tipe
  }

  function setNomorMeja(meja: string): void {
    nomorMeja.value = meja
  }

  function setMetodePembayaran(metode: 'Tunai' | 'QRIS'): void {
    metodePembayaran.value = metode
    if (metode !== 'Tunai') {
      uangBayar.value = grandTotal.value
    }
    kodeOrderDriver.value = ''
  }

  function setKodeOrderDriver(kode: string): void {
    kodeOrderDriver.value = kode.slice(0, 100)
  }

  function setUangBayar(nominal: number): void {
    uangBayar.value = Number.isFinite(nominal) && nominal >= 0 ? nominal : 0
  }

  function setUangPas(): void {
    uangBayar.value = grandTotal.value
  }

  function clearCart(): void {
    items.value = []
    nomorMeja.value = ''
    kodeOrderDriver.value = ''
    uangBayar.value = 0
  }

  async function checkout(): Promise<ReceiptData> {
    if (!canCheckout.value) {
      throw new Error(checkoutValidationMessage.value || 'Data pembayaran belum lengkap.')
    }

    isSubmitting.value = true
    try {
      const response = await $fetch<CheckoutApiResponse>('/api/pos/checkout', {
        method: 'POST',
        body: {
          tipe_pesanan: 'Takeaway',
          nomor_meja: null,
          metode_pembayaran: metodePembayaran.value,
          kode_order_driver: kodeOrderDriver.value.trim() || null,
          bayar: isNonCashExactPayment.value ? grandTotal.value : effectiveBayar.value,
          items: items.value.map(item => ({
            id_produk: item.id_produk,
            qty: item.qty,
            catatan: item.catatan || null
          }))
        }
      })

      lastReceipt.value = response.data
      clearCart()
      return response.data
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    items,
    sharedDimsumPcs,
    tipePesanan,
    nomorMeja,
    metodePembayaran,
    kodeOrderDriver,
    uangBayar,
    isSubmitting,
    lastReceipt,

    totalItemCount,
    uniqueItemCount,
    isEmpty,
    usedDimsumPcsInCart,
    remainingDimsumPcs,
    subtotal,
    grandTotal,
    effectiveBayar,
    kembalian,
    kekuranganBayar,
    isPaymentSufficient,
    isTableValid,
    canCheckout,
    checkoutValidationMessage,

    getItemQty,
    addItem,
    incrementQty,
    decrementQty,
    setItemQty,
    removeItem,
    updateItemNote,
    syncProductsStock,
    setTipePesanan,
    setNomorMeja,
    setMetodePembayaran,
    setKodeOrderDriver,
    setUangBayar,
    setUangPas,
    clearCart,
    checkout
  }
})
