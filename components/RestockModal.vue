<script setup lang="ts">
import type { ProductItem } from '~/types/pos'

const props = defineProps<{
  modelValue: boolean
  product: ProductItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  restocked: [updatedProduct: ProductItem]
}>()

const toast = useToast()
const qtyMasuk = ref<number>(10)
const catatan = ref<string>('Batch Produksi Tambahan')
const submitting = ref(false)
const errorMessage = ref('')

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const quickPresets = [10, 25, 50, 100]

watch(() => props.modelValue, (opened) => {
  if (opened) {
    qtyMasuk.value = 10
    catatan.value = 'Batch Produksi Tambahan'
    errorMessage.value = ''
  }
})

const projectedStock = computed(() => {
  if (!props.product) return 0
  const add = Number.isInteger(Number(qtyMasuk.value)) && Number(qtyMasuk.value) > 0
    ? Number(qtyMasuk.value)
    : 0
  return props.product.stok + add
})

async function handleSubmit() {
  if (!props.product) return

  const qty = Number(qtyMasuk.value)
  if (!Number.isInteger(qty) || qty <= 0) {
    errorMessage.value = 'Jumlah tambah stok harus bilangan bulat lebih dari 0.'
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    const res = await $fetch<{ success: boolean, message: string, data: ProductItem }>('/api/stock/restock', {
      method: 'PATCH',
      body: {
        id_produk: props.product.id_produk,
        qty_masuk: qty,
        catatan: catatan.value.trim() || 'Batch Produksi Tambahan'
      }
    })

    toast.add({
      title: 'Stok Berhasil Ditambahkan',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })

    emit('restocked', res.data)
    isOpen.value = false
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    errorMessage.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Gagal menambah stok.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-md' }">
    <form v-if="product" class="overflow-hidden rounded-2xl bg-white text-[#0f213d] dark:bg-[#111d33] dark:text-slate-100" @submit.prevent="handleSubmit">
      <div class="flex items-center justify-between border-b border-slate-200 bg-[#0f213d] px-5 py-4 text-white dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-white">
            <UIcon name="i-heroicons-plus-circle" class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold">Tambah Stok Produksi</h3>
            <p class="text-[11px] text-teal-200/85">{{ product.kode_barang }}</p>
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

      <div class="space-y-4 p-5">
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-[#0b1424]">
          <p class="text-sm font-bold text-[#0f213d] dark:text-white">{{ product.nama_menu }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ product.kategori }}</p>

          <div class="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div class="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-[#111d33]">
              <p class="text-[11px] text-slate-500 dark:text-slate-400">Stok Saat Ini</p>
              <p
                class="mt-0.5 text-base font-extrabold tabular-nums"
                :class="product.stok <= product.stok_minimum ? 'text-[#ee6352]' : 'text-[#0f213d] dark:text-white'"
              >
                {{ product.stok }} {{ product.satuan }}
              </p>
            </div>
            <div class="rounded-lg border border-teal-200 bg-teal-50 p-2.5 dark:border-teal-500/30 dark:bg-teal-950/40">
              <p class="text-[11px] text-[#0d9488] dark:text-teal-300">Estimasi Setelah Restock</p>
              <p class="mt-0.5 text-base font-extrabold text-[#0f213d] tabular-nums dark:text-teal-200">
                {{ projectedStock }} {{ product.satuan }}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Jumlah Stok Masuk ({{ product.satuan }})
          </label>
          <input
            v-model.number="qtyMasuk"
            type="number"
            min="1"
            step="1"
            required
            class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-bold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
          >
          <div class="mt-2 flex flex-wrap gap-1.5">
            <button
              v-for="preset in quickPresets"
              :key="preset"
              type="button"
              class="rounded-lg border px-3 py-1 text-xs font-semibold transition-colors"
              :class="
                qtyMasuk === preset
                  ? 'border-[#0d9488] bg-[#0d9488] text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-400 hover:bg-teal-50/50 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300 dark:hover:border-teal-500/50'
              "
              @click="qtyMasuk = preset"
            >
              +{{ preset }} {{ product.satuan }}
            </button>
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Catatan Batch Produksi (Opsional)
          </label>
          <input
            v-model="catatan"
            type="text"
            placeholder="cth: Batch Pagi, Kukusan Kloter 2"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-[#0b1424] dark:text-white dark:placeholder-slate-500"
          >
        </div>

        <p
          v-if="errorMessage"
          class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {{ errorMessage }}
        </p>
      </div>

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
          :disabled="submitting"
          class="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-50"
        >
          <UIcon name="i-heroicons-arrow-up-tray" class="h-4 w-4" />
          <span>{{ submitting ? 'Menyimpan...' : 'Simpan Tambah Stok' }}</span>
        </button>
      </div>
    </form>
  </UModal>
</template>
