<script setup lang="ts">
import type { CategoryStatItem } from '~/types/pos'
import { formatRupiah } from '~/utils/format'

const props = defineProps<{
  items: CategoryStatItem[]
  statsByRange?: {
    today: CategoryStatItem[]
    week: CategoryStatItem[]
    all: CategoryStatItem[]
  }
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

// Signature 4-color SaaS palette matching template: Teal, Ocean Blue, Warm Coral, Soft Slate
const sliceColors = computed(() =>
  isDark.value
    ? ['#14b8a6', '#3b82f6', '#f26b5b', '#64748b']
    : ['#0d9488', '#2e86c1', '#ee6352', '#cbd5e1']
)

const selectedRange = ref<'today' | 'week' | 'all'>('today')
const hoveredIndex = ref<number | null>(null)

const displayedItems = computed<CategoryStatItem[]>(() => {
  if (!props.statsByRange) {
    return props.items
  }
  return props.statsByRange[selectedRange.value] || props.items
})

const totalUnits = computed(() =>
  displayedItems.value.reduce((sum, item) => sum + item.totalTerjual, 0)
)

const totalRevenue = computed(() =>
  displayedItems.value.reduce((sum, item) => sum + item.totalPendapatan, 0)
)

interface DonutSlice {
  path: string
  color: string
  item: CategoryStatItem
  index: number
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  }
}

const slices = computed<DonutSlice[]>(() => {
  if (totalUnits.value <= 0) return []

  const cx = 100
  const cy = 100
  const r = 84
  let currentAngle = 0
  const result: DonutSlice[] = []

  displayedItems.value.forEach((item, index) => {
    if (item.totalTerjual <= 0) return
    const angle = (item.totalTerjual / totalUnits.value) * 360
    const color = sliceColors.value[index % sliceColors.value.length]

    if (angle >= 359.9) {
      result.push({
        path: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`,
        color,
        item,
        index
      })
      return
    }

    const start = polarToCartesian(cx, cy, r, currentAngle)
    const end = polarToCartesian(cx, cy, r, currentAngle + angle)
    const largeArcFlag = angle > 180 ? 1 : 0

    const d = [
      `M ${cx} ${cy}`,
      `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
      `A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
      'Z'
    ].join(' ')

    result.push({ path: d, color, item, index })
    currentAngle += angle
  })

  return result
})

const activeItem = computed(() => {
  if (hoveredIndex.value === null) return null
  return displayedItems.value[hoveredIndex.value] || null
})

const hasHoveredSlice = computed(() =>
  hoveredIndex.value !== null && slices.value.some(s => s.index === hoveredIndex.value)
)

const centerMainText = computed(() => {
  if (totalUnits.value <= 0) return '0'
  if (activeItem.value) return `${activeItem.value.persentase}%`
  return `${totalUnits.value}`
})

const centerSubText = computed(() => {
  if (totalUnits.value <= 0) return 'Belum terjual'
  if (activeItem.value) return activeItem.value.kategori
  return 'Total Terjual'
})
</script>

<template>
  <div class="saas-card flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 text-[#0f213d] dark:border-slate-800 dark:bg-[#111d33] dark:text-slate-100 sm:p-6">
    <!-- Header + Range Switcher -->
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="text-base font-bold tracking-tight text-[#0f213d] dark:text-white">
          Ringkasan Kategori
        </h2>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Distribusi penjualan menu dimsum
        </p>
      </div>

      <div class="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-semibold dark:border-slate-700 dark:bg-[#0b1424]">
        <button
          type="button"
          class="rounded-md px-2 py-1 transition-colors"
          :class="selectedRange === 'today' ? 'bg-[#0d9488] text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
          @click="selectedRange = 'today'; hoveredIndex = null"
        >
          Hari Ini
        </button>
        <button
          type="button"
          class="rounded-md px-2 py-1 transition-colors"
          :class="selectedRange === 'week' ? 'bg-[#0d9488] text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
          @click="selectedRange = 'week'; hoveredIndex = null"
        >
          7 Hari
        </button>
        <button
          type="button"
          class="rounded-md px-2 py-1 transition-colors"
          :class="selectedRange === 'all' ? 'bg-[#0d9488] text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
          @click="selectedRange = 'all'; hoveredIndex = null"
        >
          Semua
        </button>
      </div>
    </div>

    <!-- Clean Donut + Legend Side-by-Side (Template Leads Overview Style) -->
    <div class="my-5 flex flex-col items-center gap-5 sm:flex-row">
      <div class="shrink-0">
        <svg viewBox="0 0 200 200" class="h-36 w-36">
          <template v-if="slices.length > 0">
            <path
              v-for="slice in slices"
              :key="slice.item.kategori"
              :d="slice.path"
              :fill="slice.color"
              :stroke="isDark ? '#111d33' : '#ffffff'"
              stroke-width="3"
              class="cursor-pointer transition-all duration-200"
              :style="{
                opacity: !hasHoveredSlice || hoveredIndex === slice.index ? 1 : 0.4,
                transform: hoveredIndex === slice.index ? 'scale(1.03)' : 'scale(1)',
                transformOrigin: '100px 100px'
              }"
              @mouseenter="hoveredIndex = slice.index"
              @mouseleave="hoveredIndex = null"
            />
          </template>
          <template v-else>
            <circle cx="100" cy="100" r="84" :fill="isDark ? '#1e293b' : '#e2e8f0'" />
          </template>

          <!-- Clean Inner Hole (Thinner Ring like Template) -->
          <circle cx="100" cy="100" r="57" :fill="isDark ? '#111d33' : '#ffffff'" />
          <text
            x="100"
            y="96"
            text-anchor="middle"
            :fill="isDark ? '#f8fafc' : '#0f213d'"
            font-size="22"
            font-weight="800"
            class="tabular-nums"
          >
            {{ centerMainText }}
          </text>
          <text
            x="100"
            y="114"
            text-anchor="middle"
            :fill="isDark ? '#94a3b8' : '#64748b'"
            font-size="9.5"
            font-weight="600"
          >
            {{ centerSubText }}
          </text>
        </svg>
      </div>

      <!-- Legend Rows -->
      <div class="w-full flex-1 space-y-2">
        <div
          v-for="(item, idx) in displayedItems"
          :key="item.kategori"
          class="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs transition-colors"
          :class="hoveredIndex === idx ? 'bg-slate-100 dark:bg-slate-800/80' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'"
          @mouseenter="hoveredIndex = idx"
          @mouseleave="hoveredIndex = null"
        >
          <div class="flex min-w-0 items-center gap-2">
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: sliceColors[idx % sliceColors.length] }"
            />
            <span class="truncate font-medium text-slate-700 dark:text-slate-300">{{ item.kategori }}</span>
          </div>
          <span class="shrink-0 font-semibold text-[#0f213d] tabular-nums dark:text-white">
            {{ item.totalTerjual }}
            <span class="text-[10px] font-normal text-slate-400">({{ item.persentase }}%)</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Bottom Summary Strip -->
    <div class="flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
      <div>
        <p class="text-[11px] text-slate-500 dark:text-slate-400">
          {{ activeItem ? activeItem.kategori : 'Total Omzet Kategori' }}
        </p>
        <p class="mt-0.5 text-sm font-bold text-[#0d9488] tabular-nums dark:text-teal-400">
          {{ formatRupiah(activeItem ? activeItem.totalPendapatan : totalRevenue) }}
        </p>
      </div>
      <span class="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 tabular-nums dark:bg-slate-800 dark:text-slate-300">
        {{ activeItem ? `${activeItem.totalTerjual} unit` : `${totalUnits} unit` }}
      </span>
    </div>
  </div>
</template>
