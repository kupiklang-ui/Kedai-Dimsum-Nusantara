<script setup lang="ts">
interface WhatsAppSettingsResponse {
  success: boolean
  enabled: boolean
  configured: boolean
  adminPhone?: string
}

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const config = useRuntimeConfig()
const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)

const enabled = ref(true)
const adminPhone = ref('')

async function fetchSettings() {
  loading.value = true
  try {
    const res = await $fetch<WhatsAppSettingsResponse>('/api/settings/whatsapp')
    enabled.value = res.enabled
    adminPhone.value = res.adminPhone || ''
  } catch {
    // Keep defaults on error
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, (opened) => {
  if (opened) {
    fetchSettings()
  }
})

async function handleSave() {
  saving.value = true
  try {
    const res = await $fetch<{
      success: boolean
      message: string
      data: { adminPhone: string }
    }>('/api/settings/whatsapp', {
      method: 'POST',
      body: {
        enabled: enabled.value,
        adminPhone: adminPhone.value.trim()
      }
    })

    adminPhone.value = res.data.adminPhone

    toast.add({
      title: 'Nomor WA Admin Tersimpan',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })
    isOpen.value = false
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Menyimpan',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Periksa kembali nomor WA Anda.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    saving.value = false
  }
}

async function handleTestOpen() {
  if (!adminPhone.value.trim()) {
    toast.add({
      title: 'Nomor WA Belum Diisi',
      description: 'Masukkan nomor WhatsApp Admin terlebih dahulu (cth: 081234567890).',
      color: 'amber',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }

  testing.value = true
  try {
    const res = await $fetch<{ success: boolean, waUrl: string | null }>('/api/settings/whatsapp-test', {
      method: 'POST',
      body: {
        adminPhone: adminPhone.value.trim()
      }
    })

    if (res.waUrl) {
      window.open(res.waUrl, '_blank', 'noopener,noreferrer')
    }
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Membuka Tes WA',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-md' }">
    <div class="overflow-hidden rounded-2xl bg-white text-[#0f213d] dark:bg-[#111d33] dark:text-slate-100">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-200 bg-[#0f213d] px-5 py-4 text-white dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm">
            <UIcon name="i-heroicons-chat-bubble-oval-left-ellipsis" class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold">Pengaturan WhatsApp Admin</h3>
            <p class="text-[11px] text-teal-200/85">
              Nomor WA tujuan saat Kasir mengajukan stok dimsum habis
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

      <div v-if="loading" class="flex items-center justify-center py-12 text-xs text-slate-400">
        Memuat pengaturan WhatsApp...
      </div>

      <form v-else class="space-y-4 p-5" @submit.prevent="handleSave">
        <!-- Active Toggle -->
        <label class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-[#0b1424]">
          <div>
            <p class="text-xs font-bold text-[#0f213d] dark:text-white">
              Aktifkan Notif WhatsApp (Manual wa.me)
            </p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              Gratis tanpa API — pesan langsung siap kirim di WhatsApp saat Kasir ajukan stok.
            </p>
          </div>
          <input
            v-model="enabled"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 accent-[#0d9488]"
          >
        </label>

        <!-- Admin WhatsApp Number -->
        <div>
          <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Nomor WhatsApp Admin *
          </label>
          <input
            v-model="adminPhone"
            type="tel"
            placeholder="cth: 081234567890 atau 6281234567890"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-semibold text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
          >
          <p class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            Format <code>08xxx</code> otomatis diubah menjadi <code>628xxx</code>.
          </p>
        </div>

        <!-- Preview Pesan WA -->
        <div class="rounded-xl border border-emerald-200/80 bg-[#e7ffdb]/60 p-3 text-[11px] leading-relaxed text-slate-700 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-slate-200">
          <p class="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Contoh Pesan yang Otomatis Terisi di WA
          </p>
          <p class="font-bold">🚨 PENGAJUAN PASOKAN DIMSUM — {{ config.public.storeName }}</p>
          <p>• Status Stok Kasir: <strong>HABIS (0 pcs)</strong> · Diajukan: <strong>+100 pcs</strong></p>
          <p>• Pelapor: Kasir · Catatan: <em>Stok dimsum di kasir sudah habis, mohon segera diproduksi!</em></p>
        </div>

        <!-- Footer Buttons -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            :disabled="testing || !adminPhone.trim()"
            class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-[#25D366] hover:text-white disabled:opacity-50 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
            @click="handleTestOpen"
          >
            <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4" />
            <span>Tes Buka WA</span>
          </button>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300"
              @click="isOpen = false"
            >
              Tutup
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-60"
            >
              <UIcon
                :name="saving ? 'i-heroicons-arrow-path' : 'i-heroicons-check'"
                class="h-4 w-4"
                :class="{ 'animate-spin': saving }"
              />
              <span>{{ saving ? 'Menyimpan...' : 'Simpan Nomor WA' }}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </UModal>
</template>
