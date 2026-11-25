<script setup lang="ts">
import { PRODUCT_CATEGORIES, type ProductItem, type SharedDimsumStock } from '~/types/pos'
import { formatRupiah } from '~/utils/format'

definePageMeta({
  layout: 'admin'
})

const toast = useToast()

const products = ref<ProductItem[]>([])
const dimsumStock = ref<SharedDimsumStock>({
  stok_pcs: 0,
  stok_minimum_pcs: 20,
  is_low_stock: false
})
const loading = ref(true)
const searchQuery = ref('')
const selectedCategory = ref('Semua')
const lowStockOnly = ref(false)

const formModalOpen = ref(false)
const editingProduct = ref<ProductItem | null>(null)

const restockModalOpen = ref(false)
const restockingProduct = ref<ProductItem | null>(null)

const deleteModalOpen = ref(false)
const deletingProduct = ref<ProductItem | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const settingZeroStock = ref(false)

const categoryTabs = ['Semua', ...PRODUCT_CATEGORIES]

async function fetchProducts() {
  loading.value = true
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
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Gagal Memuat Daftar Menu',
      description: fetchErr?.data?.statusMessage || 'Periksa koneksi database TiDB Cloud.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    loading.value = false
  }
}

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return products.value.filter((item) => {
    const matchesCat = selectedCategory.value === 'Semua' || item.kategori === selectedCategory.value
    const matchesSearch = !q ||
      item.nama_menu.toLowerCase().includes(q) ||
      item.kode_barang.toLowerCase().includes(q)
    const matchesLow = !lowStockOnly.value || item.stok <= item.stok_minimum
    return matchesCat && matchesSearch && matchesLow
  })
})

const totalLowStock = computed(() =>
  products.value.filter(p => !p.uses_shared_dimsum_stock && p.stok <= p.stok_minimum).length
)

function openCreateModal() {
  editingProduct.value = null
  formModalOpen.value = true
}

function openEditModal(product: ProductItem) {
  editingProduct.value = product
  formModalOpen.value = true
}

function openRestockModal(product: ProductItem) {
  restockingProduct.value = product
  restockModalOpen.value = true
}

function openDeleteModal(product: ProductItem) {
  deletingProduct.value = product
  deleteError.value = ''
  deleteModalOpen.value = true
}

async function confirmDeleteProduct() {
  if (!deletingProduct.value) return

  deleting.value = true
  deleteError.value = ''
  try {
    const res = await $fetch<{ success: boolean, message: string }>(
      `/api/products/${deletingProduct.value.id_produk}`,
      { method: 'DELETE' }
    )

    toast.add({
      title: 'Menu Dihapus',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })

    deleteModalOpen.value = false
    deletingProduct.value = null
    await fetchProducts()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    deleteError.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Gagal menghapus menu.'
  } finally {
    deleting.value = false
  }
}

async function handleSetStockZero() {
  if (!deletingProduct.value) return

  settingZeroStock.value = true
  try {
    await $fetch(`/api/products/${deletingProduct.value.id_produk}`, {
      method: 'PUT',
      body: { stok: 0 }
    })

    toast.add({
      title: 'Stok Diatur ke 0',
      description: `${deletingProduct.value.nama_menu} kini berstatus Habis di layar Kasir (riwayat transaksi tetap terjaga).`,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })

    deleteModalOpen.value = false
    deletingProduct.value = null
    await fetchProducts()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    deleteError.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Gagal mengubah stok.'
  } finally {
    settingZeroStock.value = false
  }
}

onMounted(() => {
  fetchProducts()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Clean Page Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-[#0f213d] dark:text-white">
          Manajemen Menu &amp; Stok
        </h1>
        <div class="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-slate-500 tabular-nums dark:text-slate-400">
          <span>Total Menu: <strong class="text-[#0f213d] dark:text-white">{{ products.length }}</strong></span>
          <span>·</span>
          <span>
            Stok Dimsum Bersama:
            <strong :class="dimsumStock.is_low_stock ? 'text-[#ee6352]' : 'text-[#0d9488] dark:text-teal-400'">
              {{ dimsumStock.stok_pcs }} Pcs
            </strong>
          </span>
          <span>·</span>
          <span>Minuman/Saus Menipis: <strong class="text-[#ee6352]">{{ totalLowStock }}</strong></span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <NuxtLink
          to="/productions"
          class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-200 dark:hover:border-teal-500"
        >
          <UIcon name="i-heroicons-fire" class="h-4 w-4 text-[#0d9488]" />
          <span>Input Produksi Pcs</span>
        </NuxtLink>
        <button
          type="button"
          class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0b7a71]"
          @click="openCreateModal"
        >
          <UIcon name="i-heroicons-plus" class="h-4 w-4" />
          <span>Tambah Menu</span>
        </button>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="saas-card space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#111d33]">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <UIcon
            name="i-heroicons-magnifying-glass"
            class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama menu atau kode barang..."
            class="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-10 pr-4 text-sm text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:placeholder-slate-500"
          >
        </div>

        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors"
          :class="
            lowStockOnly
              ? 'border-[#ee6352] bg-[#ee6352] text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:text-[#ee6352] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200 dark:hover:border-rose-500/50'
          "
          @click="lowStockOnly = !lowStockOnly"
        >
          <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4" />
          <span>Stok Menipis ({{ totalLowStock }})</span>
        </button>
      </div>

      <!-- Category Filter Pills -->
      <div class="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
        <button
          v-for="cat in categoryTabs"
          :key="cat"
          type="button"
          class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="
            selectedCategory === cat
              ? 'bg-[#0f213d] text-white dark:bg-[#0d9488]'
              : 'border border-slate-200 bg-slate-50/70 text-slate-600 hover:border-teal-400 hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300 dark:hover:border-teal-500'
          "
          @click="selectedCategory = cat"
        >
          {{ cat }}
        </button>
      </div>
    </div>

    <!-- Adaptive Menu Table -->
    <div class="saas-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111d33]">
      <div v-if="loading && products.length === 0" class="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Memuat daftar menu dimsum...
      </div>

      <div
        v-else-if="filteredProducts.length === 0"
        class="flex flex-col items-center justify-center px-6 py-12 text-center"
      >
        <UIcon name="i-heroicons-archive-box-x-mark" class="h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p class="mt-3 text-sm font-bold text-[#0f213d] dark:text-white">Tidak ada menu yang cocok</p>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Ubah kata kunci pencarian, kategori, atau klik "+ Tambah Menu" untuk membuat menu baru.
        </p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-left text-xs dark:divide-slate-800">
          <thead class="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#0b1424]/70 dark:text-slate-400">
            <tr>
              <th class="px-5 py-3.5">Menu Dimsum</th>
              <th class="px-5 py-3.5">Kategori</th>
              <th class="px-5 py-3.5 text-right">Harga Modal</th>
              <th class="px-5 py-3.5 text-right">Harga Jual</th>
              <th class="px-5 py-3.5 text-right">Stok</th>
              <th class="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="product in filteredProducts"
              :key="product.id_produk"
              class="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/35"
            >
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    class="group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-teal-50 text-[#0d9488] ring-1 ring-slate-200 transition-all hover:ring-[#0d9488] dark:bg-teal-950/50 dark:text-teal-400 dark:ring-slate-700"
                    title="Klik untuk upload atau ganti foto menu"
                    @click="openEditModal(product)"
                  >
                    <img
                      v-if="product.foto_url"
                      :src="product.foto_url"
                      :alt="product.nama_menu"
                      class="h-full w-full object-cover"
                    >
                    <UIcon v-else name="i-heroicons-camera" class="h-5 w-5 opacity-75" />
                    <span class="absolute inset-0 flex items-center justify-center bg-[#0f213d]/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <UIcon name="i-heroicons-camera" class="h-4 w-4" />
                    </span>
                  </button>
                  <div>
                    <p class="text-sm font-bold text-[#0f213d] dark:text-white">{{ product.nama_menu }}</p>
                    <p class="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {{ product.kode_barang }} · {{ product.satuan }}
                    </p>
                  </div>
                </div>
              </td>

              <td class="whitespace-nowrap px-5 py-3.5">
                <span class="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {{ product.kategori }}
                </span>
              </td>

              <td class="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                {{ formatRupiah(product.harga_modal) }}
              </td>

              <td class="whitespace-nowrap px-5 py-3.5 text-right">
                <p class="text-sm font-bold text-[#0f213d] dark:text-white tabular-nums">
                  {{ formatRupiah(product.harga_jual) }}
                </p>
                <p class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  Laba +{{ formatRupiah(product.harga_jual - product.harga_modal) }}
                </p>
              </td>

              <td class="whitespace-nowrap px-5 py-3.5 text-right">
                <template v-if="product.uses_shared_dimsum_stock">
                  <span
                    class="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold tabular-nums"
                    :class="
                      dimsumStock.stok_pcs <= 0
                        ? 'bg-rose-50 text-[#ee6352] dark:bg-rose-950/60 dark:text-rose-300'
                        : dimsumStock.is_low_stock
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
                    "
                  >
                    {{ dimsumStock.stok_pcs }} Pcs (Bersama)
                  </span>
                  <p class="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Potong {{ product.isi_pcs }} pcs / {{ product.satuan }}
                  </p>
                </template>
                <template v-else>
                  <span
                    class="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold tabular-nums"
                    :class="
                      product.stok <= 0
                        ? 'bg-rose-50 text-[#ee6352] dark:bg-rose-950/60 dark:text-rose-300'
                        : product.stok <= product.stok_minimum
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
                    "
                  >
                    {{ product.stok }} {{ product.satuan }}
                  </span>
                  <p class="mt-0.5 text-[10px] text-slate-400 tabular-nums">
                    Stok Terpisah · Min. {{ product.stok_minimum }}
                  </p>
                </template>
              </td>

              <td class="whitespace-nowrap px-5 py-3.5 text-right">
                <div class="inline-flex items-center justify-end gap-1.5">
                  <button
                    v-if="!product.uses_shared_dimsum_stock"
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg bg-[#0d9488] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0b7a71]"
                    @click="openRestockModal(product)"
                  >
                    <UIcon name="i-heroicons-plus" class="h-3.5 w-3.5" />
                    <span>Stok</span>
                  </button>
                  <NuxtLink
                    v-else
                    to="/productions"
                    class="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-[#0d9488] transition-colors hover:bg-[#0d9488] hover:text-white dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-600 dark:hover:text-white"
                  >
                    <UIcon name="i-heroicons-fire" class="h-3.5 w-3.5" />
                    <span>Produksi</span>
                  </NuxtLink>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200 dark:hover:bg-slate-800"
                    @click="openEditModal(product)"
                  >
                    <UIcon name="i-heroicons-pencil-square" class="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-[#ee6352] transition-colors hover:bg-[#ee6352] hover:text-white dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white"
                    title="Hapus menu"
                    @click="openDeleteModal(product)"
                  >
                    <UIcon name="i-heroicons-trash" class="h-3.5 w-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add / Edit Product Modal -->
    <ProductFormModal
      v-model="formModalOpen"
      :product="editingProduct"
      @saved="fetchProducts"
    />

    <!-- Quick Restock Modal -->
    <RestockModal
      v-model="restockModalOpen"
      :product="restockingProduct"
      @restocked="fetchProducts"
    />

    <!-- Delete Confirmation Modal -->
    <UModal v-model="deleteModalOpen" :ui="{ width: 'sm:max-w-md' }">
      <div v-if="deletingProduct" class="overflow-hidden rounded-2xl bg-white text-[#0f213d] dark:bg-[#111d33] dark:text-slate-100">
        <div class="flex items-center justify-between border-b border-slate-200 bg-[#0f213d] px-5 py-4 text-white dark:border-slate-800">
          <div class="flex items-center gap-2.5">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ee6352] text-white">
              <UIcon name="i-heroicons-trash" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold">Hapus Menu Dimsum</h3>
              <p class="text-[11px] text-slate-300">{{ deletingProduct.kode_barang }}</p>
            </div>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            @click="deleteModalOpen = false"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-3 p-5">
          <p class="text-sm text-slate-700 dark:text-slate-300">
            Apakah Anda yakin ingin menghapus menu
            <strong class="text-[#0f213d] dark:text-white">{{ deletingProduct.nama_menu }}</strong>?
          </p>
          <p class="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-400">
            Tindakan ini akan menghapus menu secara permanen dari database TiDB Cloud dan tidak dapat dibatalkan.
          </p>

          <div
            v-if="deleteError"
            class="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <p class="font-semibold">{{ deleteError }}</p>
            <button
              v-if="deletingProduct.stok > 0"
              type="button"
              :disabled="settingZeroStock"
              class="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
              @click="handleSetStockZero"
            >
              <UIcon name="i-heroicons-no-symbol" class="h-4 w-4" />
              <span>{{ settingZeroStock ? 'Mengubah...' : 'Atur Stok Jadi 0 Saja' }}</span>
            </button>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-[#0b1424]">
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#15243d] dark:text-slate-200 dark:hover:bg-slate-800"
            @click="deleteModalOpen = false"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="deleting"
            class="inline-flex items-center gap-1.5 rounded-lg bg-[#ee6352] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#dc4e3d] disabled:opacity-60"
            @click="confirmDeleteProduct"
          >
            <UIcon
              :name="deleting ? 'i-heroicons-arrow-path' : 'i-heroicons-trash'"
              class="h-4 w-4"
              :class="{ 'animate-spin': deleting }"
            />
            <span>{{ deleting ? 'Menghapus...' : 'Ya, Hapus Menu' }}</span>
          </button>
        </div>
      </div>
    </UModal>
  </div>
</template>
