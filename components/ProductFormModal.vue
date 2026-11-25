<script setup lang="ts">
import { PRODUCT_CATEGORIES, type ProductCategory, type ProductItem } from '~/types/pos'
import { formatRupiah } from '~/utils/format'

const props = defineProps<{
  modelValue: boolean
  product?: ProductItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [product: ProductItem]
}>()

const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const isEditMode = computed(() => Boolean(props.product))

const form = reactive({
  kode_barang: '',
  nama_menu: '',
  kategori: 'Dimsum Kukus' as ProductCategory,
  satuan: 'Pcs',
  isi_pcs: 1,
  harga_modal: 0,
  harga_jual: 0,
  stok: 20,
  stok_minimum: 5,
  foto_url: ''
})

const usesSharedDimsumStock = computed(() => form.kategori !== 'Minuman & Saus')

const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingPhoto = ref(false)
const isDragging = ref(false)
const submitting = ref(false)
const errorMessage = ref('')

function hydrateForm() {
  errorMessage.value = ''
  uploadingPhoto.value = false
  isDragging.value = false

  if (props.product) {
    form.kode_barang = props.product.kode_barang
    form.nama_menu = props.product.nama_menu
    form.kategori = props.product.kategori
    form.satuan = props.product.satuan
    form.isi_pcs = props.product.uses_shared_dimsum_stock ? Math.max(1, props.product.isi_pcs || 1) : 0
    form.harga_modal = props.product.harga_modal
    form.harga_jual = props.product.harga_jual
    form.stok = props.product.stok
    form.stok_minimum = props.product.stok_minimum
    form.foto_url = props.product.foto_url || ''
  } else {
    form.kode_barang = ''
    form.nama_menu = ''
    form.kategori = 'Dimsum Kukus'
    form.satuan = 'Pcs'
    form.isi_pcs = 1
    form.harga_modal = 0
    form.harga_jual = 0
    form.stok = 20
    form.stok_minimum = 5
    form.foto_url = ''
  }
}

watch(() => props.modelValue, (opened) => {
  if (opened) {
    hydrateForm()
  }
})

const estimatedMargin = computed(() => Number(form.harga_jual || 0) - Number(form.harga_modal || 0))
const estimatedMarginPct = computed(() => {
  const jual = Number(form.harga_jual || 0)
  if (jual <= 0) return 0
  return Math.round((estimatedMargin.value / jual) * 100)
})

function triggerFilePicker() {
  fileInputRef.value?.click()
}

async function uploadSelectedFile(file: File) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    errorMessage.value = 'Format foto harus JPG, PNG, WEBP, atau GIF.'
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'Ukuran file foto maksimal 5 MB.'
    return
  }

  uploadingPhoto.value = true
  errorMessage.value = ''

  try {
    const body = new FormData()
    body.append('file', file)

    const res = await $fetch<{ success: boolean, message: string, url: string }>('/api/uploads/product-image', {
      method: 'POST',
      body
    })

    form.foto_url = res.url
    toast.add({
      title: 'Foto Diunggah',
      description: 'Foto makanan siap disimpan bersama data menu.',
      color: 'green',
      icon: 'i-heroicons-photo'
    })
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    errorMessage.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Gagal mengunggah foto.'
  } finally {
    uploadingPhoto.value = false
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    uploadSelectedFile(file)
  }
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    uploadSelectedFile(file)
  }
}

function clearPhoto() {
  form.foto_url = ''
}

async function handleSubmit() {
  if (uploadingPhoto.value) return

  submitting.value = true
  errorMessage.value = ''

  try {
    const payload = {
      kode_barang: form.kode_barang.trim().toUpperCase(),
      nama_menu: form.nama_menu.trim(),
      kategori: form.kategori,
      satuan: form.satuan.trim() || (usesSharedDimsumStock.value ? 'Pcs' : 'Porsi'),
      isi_pcs: usesSharedDimsumStock.value ? Number(form.isi_pcs) : 0,
      harga_modal: Number(form.harga_modal),
      harga_jual: Number(form.harga_jual),
      stok: usesSharedDimsumStock.value ? 0 : Number(form.stok),
      stok_minimum: usesSharedDimsumStock.value ? 5 : Number(form.stok_minimum),
      foto_url: form.foto_url.trim() || null
    }

    const endpoint = isEditMode.value && props.product
      ? `/api/products/${props.product.id_produk}`
      : '/api/products'

    const method = isEditMode.value ? 'PUT' : 'POST'

    const res = await $fetch<{ success: boolean, message: string, data: ProductItem }>(endpoint, {
      method,
      body: payload
    })

    toast.add({
      title: isEditMode.value ? 'Menu Diperbarui' : 'Menu Ditambahkan',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })

    emit('saved', res.data)
    isOpen.value = false
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    errorMessage.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Gagal menyimpan data menu.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-xl' }">
    <form class="overflow-hidden rounded-2xl bg-white text-[#0f213d] dark:bg-[#111d33] dark:text-slate-100" @submit.prevent="handleSubmit">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-200 bg-[#0f213d] px-5 py-4 text-white dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-white">
            <UIcon :name="isEditMode ? 'i-heroicons-pencil-square' : 'i-heroicons-plus'" class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold">
              {{ isEditMode ? 'Edit Menu Dimsum' : 'Tambah Menu Dimsum Baru' }}
            </h3>
            <p class="text-[11px] text-teal-200/85">
              Unggah foto makanan &amp; kelola harga serta stok menu
            </p>
          </div>
        </div>
        <button
          type="button"
          class="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
          @click="isOpen = false"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="grid max-h-[75vh] grid-cols-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">
        <!-- Food Photo Uploader Section -->
        <div class="sm:col-span-2">
          <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Foto Makanan (JPG / PNG / WEBP · Maks. 5 MB)
          </label>

          <div
            class="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors sm:flex-row"
            :class="
              isDragging
                ? 'border-[#0d9488] bg-teal-50 dark:bg-teal-950/35'
                : 'border-slate-200 bg-slate-50/70 hover:border-[#0d9488]/60 dark:border-slate-700 dark:bg-[#0b1424]/80 dark:hover:border-teal-500/50'
            "
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <!-- Preview Thumbnail -->
            <div class="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#15243d]">
              <img
                v-if="form.foto_url"
                :src="form.foto_url"
                alt="Preview foto menu"
                class="h-full w-full object-cover"
              >
              <div v-else class="flex flex-col items-center text-slate-400">
                <UIcon name="i-heroicons-photo" class="h-8 w-8" />
                <span class="mt-0.5 text-[10px] font-medium">Belum ada</span>
              </div>

              <div
                v-if="uploadingPhoto"
                class="absolute inset-0 flex items-center justify-center bg-[#0f213d]/60 text-white"
              >
                <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin" />
              </div>
            </div>

            <!-- Upload Controls -->
            <div class="flex-1 text-center sm:text-left">
              <p class="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Seret &amp; lepas foto ke sini, atau pilih dari perangkat
              </p>
              <p class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Foto akan tampil di kartu katalog Kasir (POS) dan daftar Menu.
              </p>

              <input
                ref="fileInputRef"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="hidden"
                @change="handleFileChange"
              >

              <div class="mt-2.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <button
                  type="button"
                  :disabled="uploadingPhoto"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-60"
                  @click="triggerFilePicker"
                >
                  <UIcon name="i-heroicons-arrow-up-tray" class="h-3.5 w-3.5" />
                  <span>{{ uploadingPhoto ? 'Mengunggah...' : form.foto_url ? 'Ganti Foto' : 'Upload Foto' }}</span>
                </button>

                <button
                  v-if="form.foto_url"
                  type="button"
                  :disabled="uploadingPhoto"
                  class="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-[#ee6352] hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300"
                  @click="clearPhoto"
                >
                  <UIcon name="i-heroicons-trash" class="h-3.5 w-3.5" />
                  <span>Hapus</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Optional Manual URL Input -->
          <div class="mt-2">
            <input
              v-model="form.foto_url"
              type="text"
              placeholder="Atau tempel URL foto langsung (opsional, cth: https://...)"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200 dark:placeholder-slate-500"
            >
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Kode Barang / Barcode *</label>
          <input
            v-model="form.kode_barang"
            type="text"
            required
            placeholder="cth: DSM-009"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm uppercase text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:placeholder-slate-500"
          >
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Kategori *</label>
          <select
            v-model="form.kategori"
            required
            class="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-[#0f213d] focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
          >
            <option v-for="cat in PRODUCT_CATEGORIES" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>

        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Menu *</label>
          <input
            v-model="form.nama_menu"
            type="text"
            required
            placeholder="cth: Siomay Nori Spesial"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:placeholder-slate-500"
          >
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Harga Modal (Rp) *</label>
          <input
            v-model.number="form.harga_modal"
            type="number"
            min="0"
            step="100"
            required
            class="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-semibold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
          >
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Harga Jual (Rp) *</label>
          <input
            v-model.number="form.harga_jual"
            type="number"
            min="0"
            step="100"
            required
            class="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-semibold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
          >
        </div>

        <!-- Margin Indicator -->
        <div class="sm:col-span-2">
          <div
            class="flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-semibold"
            :class="estimatedMargin >= 0 ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300' : 'bg-rose-50 text-[#ee6352] dark:bg-rose-950/50 dark:text-rose-300'"
          >
            <span>Estimasi Laba Kotor / Unit</span>
            <span class="tabular-nums">
              {{ formatRupiah(estimatedMargin) }} ({{ estimatedMarginPct }}%)
            </span>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Satuan</label>
          <input
            v-model="form.satuan"
            type="text"
            placeholder="Pcs / Porsi / Paket / Cup / Gelas"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:placeholder-slate-500"
          >
        </div>

        <div v-if="usesSharedDimsumStock">
          <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Potong Stok Dimsum (Pcs / Unit) *</label>
          <input
            v-model.number="form.isi_pcs"
            type="number"
            min="1"
            step="1"
            required
            class="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-bold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
          >
          <p class="mt-1 text-[10px] text-[#0d9488] dark:text-teal-300">
            Stok menu ini mengikuti <strong>Stok Produksi Dimsum Bersama</strong> (cth: 1 untuk satuan, 4 untuk porsi isi 4, 10 untuk Paket Mix 10 Pcs).
          </p>
        </div>

        <div v-else class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Stok Terpisah *</label>
            <input
              v-model.number="form.stok"
              type="number"
              min="0"
              step="1"
              required
              class="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-semibold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
            >
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Stok Min. *</label>
            <input
              v-model.number="form.stok_minimum"
              type="number"
              min="0"
              step="1"
              required
              class="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-semibold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
            >
          </div>
        </div>

        <p
          v-if="errorMessage"
          class="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {{ errorMessage }}
        </p>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-[#0b1424]">
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#15243d] dark:text-slate-200 dark:hover:bg-slate-800"
          @click="isOpen = false"
        >
          Batal
        </button>
        <button
          type="submit"
          :disabled="submitting || uploadingPhoto"
          class="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-50"
        >
          <UIcon name="i-heroicons-check" class="h-4 w-4" />
          <span>{{ submitting ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Tambah Menu' }}</span>
        </button>
      </div>
    </form>
  </UModal>
</template>
