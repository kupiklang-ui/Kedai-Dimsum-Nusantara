<script setup lang="ts">
withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false
})

const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')

function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <ClientOnly>
    <button
      type="button"
      class="inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors active:scale-95"
      :class="[
        compact ? 'h-9 w-9 p-0' : 'px-3 py-1.5 text-xs',
        isDark
          ? 'border-slate-700 bg-[#15243d] text-amber-300 hover:border-teal-500/50 hover:bg-[#1b2e4d]'
          : 'border-slate-200 bg-white text-slate-700 hover:border-teal-500/40 hover:bg-teal-50/60 hover:text-teal-700'
      ]"
      :title="isDark ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'"
      @click="toggleTheme"
    >
      <UIcon
        :name="isDark ? 'i-heroicons-sun' : 'i-heroicons-moon'"
        class="h-4 w-4 shrink-0"
      />
      <span v-if="!compact">
        {{ isDark ? 'Mode Gelap' : 'Mode Terang' }}
      </span>
    </button>
    <template #fallback>
      <div :class="compact ? 'h-9 w-9' : 'h-8 w-24'" />
    </template>
  </ClientOnly>
</template>
