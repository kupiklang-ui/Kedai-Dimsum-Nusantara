<script setup lang="ts">
interface DimsumItem {
  id: string
  name: string
  tag: string
  desc: string
  src: string
  accent: string
}

const props = withDefaults(defineProps<{
  variant?: 'hero' | 'login'
  activeRole?: 'admin' | 'kasir'
}>(), {
  variant: 'hero',
  activeRole: 'admin'
})

const dimsumItems: DimsumItem[] = [
  {
    id: 'mentai',
    name: 'Dimsum Mentai Lumer',
    tag: 'Best Seller',
    desc: 'Saus mentai creamy torch yang meleleh hangat di setiap gigitan.',
    src: '/images/dimsum/dimsum-mentai.png',
    accent: '#ee6352'
  },
  {
    id: 'tobiko',
    name: 'Dimsum Tobiko Ori',
    tag: 'Favorit Kasir',
    desc: 'Ayam udang lembut dengan topping tobiko renyah khas kedai.',
    src: '/images/dimsum/dimsum-tobiko.png',
    accent: '#0d9488'
  },
  {
    id: 'keju',
    name: 'Dimsum Keju Pedas',
    tag: 'Gurih Creamy',
    desc: 'Balutan saus pedas manis berpadu taburan keju parut melimpah.',
    src: '/images/dimsum/dimsum-keju.png',
    accent: '#f59e0b'
  },
  {
    id: 'chili',
    name: 'Dimsum Chili Oil',
    tag: 'Pedas Nampol',
    desc: 'Aroma chili oil rempah autentik, juara untuk takeaway & driver food.',
    src: '/images/dimsum/dimsum-chili.png',
    accent: '#dc2626'
  }
]

const activeIndex = ref(0)
const activeDimsum = computed(() => dimsumItems[activeIndex.value] ?? dimsumItems[0])

// Silky 60 FPS GPU-composited pointer parallax (transform: translate3d only)
const stageRef = ref<HTMLElement | null>(null)
const targetOffset = { x: 0, y: 0 }
const currentOffset = reactive({ x: 0, y: 0 })
let rafId: number | null = null
let autoRotateTimer: ReturnType<typeof setInterval> | null = null

function onPointerMove(e: PointerEvent) {
  if (!stageRef.value) return
  const rect = stageRef.value.getBoundingClientRect()
  const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2
  const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2
  targetOffset.x = nx * 14
  targetOffset.y = ny * 10
}

function onPointerLeave() {
  targetOffset.x = 0
  targetOffset.y = 0
}

function selectDimsum(idx: number) {
  activeIndex.value = idx
}

onMounted(() => {
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  if (!prefersReduced) {
    const tick = () => {
      currentOffset.x += (targetOffset.x - currentOffset.x) * 0.09
      currentOffset.y += (targetOffset.y - currentOffset.y) * 0.09
      rafId = window.requestAnimationFrame(tick)
    }
    rafId = window.requestAnimationFrame(tick)
  }

  autoRotateTimer = setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % dimsumItems.length
  }, props.variant === 'hero' ? 3800 : 3400)
})

onBeforeUnmount(() => {
  if (rafId !== null) window.cancelAnimationFrame(rafId)
  if (autoRotateTimer) clearInterval(autoRotateTimer)
})

function parallaxStyle(depth: number) {
  const x = (currentOffset.x * depth).toFixed(2)
  const y = (currentOffset.y * depth).toFixed(2)
  return {
    transform: `translate3d(${x}px, ${y}px, 0)`
  }
}
</script>

<template>
  <!-- HERO VARIANT (Landing Page) -->
  <div
    v-if="variant === 'hero'"
    ref="stageRef"
    class="relative select-none"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <div class="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-[#0f213d] via-[#132c52] to-[#0a4c56] p-6 text-white shadow-2xl shadow-[#0f213d]/20 dark:border-slate-700/80 sm:p-8">
      <!-- Ambient GPU Glows -->
      <div
        class="dimsum-orb-1 pointer-events-none absolute -right-14 -top-14 h-56 w-56 rounded-full bg-[#0d9488]/30 blur-2xl"
      />
      <div
        class="dimsum-orb-2 pointer-events-none absolute -bottom-16 -left-12 h-56 w-56 rounded-full bg-[#ee6352]/20 blur-2xl"
      />

      <!-- Top Live Indicator -->
      <div class="relative z-10 flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-teal-200 backdrop-blur-sm">
          <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Menu Hangat 60 FPS Live Showcase
        </span>
        <span class="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">
          {{ activeDimsum.tag }}
        </span>
      </div>

      <!-- Central 60 FPS Animated Dimsum Stage -->
      <div class="relative my-4 flex h-[280px] items-center justify-center sm:h-[320px]">
        <!-- Rotating Subtle Orbit Rings (60 FPS GPU) -->
        <div class="dimsum-ring-outer pointer-events-none absolute h-64 w-64 rounded-full border border-dashed border-teal-300/25 sm:h-72 sm:w-72" />
        <div class="dimsum-ring-inner pointer-events-none absolute h-44 w-44 rounded-full border border-white/15 sm:h-52 sm:w-52" />

        <!-- Subtle Rising Steam Wisps -->
        <div class="pointer-events-none absolute top-4 flex gap-6 opacity-55">
          <span class="steam-wisp steam-delay-1 h-12 w-3 rounded-full bg-gradient-to-t from-white/35 to-transparent blur-[3px]" />
          <span class="steam-wisp steam-delay-2 h-14 w-3.5 rounded-full bg-gradient-to-t from-teal-200/35 to-transparent blur-[4px]" />
          <span class="steam-wisp steam-delay-3 h-10 w-3 rounded-full bg-gradient-to-t from-white/30 to-transparent blur-[3px]" />
        </div>

        <!-- Center Featured Spotlight Dimsum -->
        <div
          class="relative z-20 flex flex-col items-center justify-center"
          :style="parallaxStyle(1.1)"
        >
          <div class="dimsum-hero-float relative flex h-40 w-44 items-center justify-center sm:h-48 sm:w-52">
            <Transition name="dimsum-pop" mode="out-in">
              <img
                :key="activeDimsum.id"
                :src="activeDimsum.src"
                :alt="activeDimsum.name"
                class="h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)]"
                draggable="false"
              >
            </Transition>
          </div>
          <!-- Ground Shadow Pulse -->
          <div class="dimsum-shadow mt-1 h-3.5 w-32 rounded-full bg-black/35 blur-md" />
        </div>

        <!-- 4 Corner Floating Satellite Dimsums (60 FPS GPU Float) -->
        <button
          v-for="(item, idx) in dimsumItems"
          :key="item.id"
          type="button"
          class="group absolute z-30 flex h-16 w-16 items-center justify-center rounded-2xl border p-1.5 backdrop-blur-md transition-all duration-300 sm:h-[74px] sm:w-[74px]"
          :class="[
            idx === 0 ? 'left-1 top-2 dimsum-sat-1 sm:left-3 sm:top-3' : '',
            idx === 1 ? 'right-1 top-2 dimsum-sat-2 sm:right-3 sm:top-3' : '',
            idx === 2 ? 'bottom-2 left-1 dimsum-sat-3 sm:bottom-3 sm:left-3' : '',
            idx === 3 ? 'bottom-2 right-1 dimsum-sat-4 sm:bottom-3 sm:right-3' : '',
            activeIndex === idx
              ? 'scale-105 border-teal-300/80 bg-white/20 shadow-lg shadow-teal-500/25 ring-2 ring-teal-300/40'
              : 'border-white/15 bg-white/10 opacity-85 hover:scale-105 hover:bg-white/20 hover:opacity-100'
          ]"
          :style="parallaxStyle(idx % 2 === 0 ? -0.65 : 0.65)"
          :title="item.name"
          @click="selectDimsum(idx)"
        >
          <img
            :src="item.src"
            :alt="item.name"
            class="h-full w-full object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-110"
            draggable="false"
          >
        </button>
      </div>

      <!-- Active Flavor Caption & Interactive Dots -->
      <div class="relative z-10 rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-md">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate text-sm font-extrabold text-white">
              {{ activeDimsum.name }}
            </p>
            <p class="mt-0.5 text-[11px] leading-relaxed text-slate-200/85">
              {{ activeDimsum.desc }}
            </p>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              v-for="(item, idx) in dimsumItems"
              :key="`dot-${item.id}`"
              type="button"
              :aria-label="`Pilih ${item.name}`"
              class="h-2 rounded-full transition-all duration-300"
              :class="activeIndex === idx ? 'w-6 bg-teal-300' : 'w-2 bg-white/30 hover:bg-white/60'"
              @click="selectDimsum(idx)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- LOGIN VARIANT (Compact Embedded 60 FPS Dimsum Motion Strip for Login Panel) -->
  <div
    v-else
    ref="stageRef"
    class="relative my-4 select-none"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3.5 backdrop-blur-sm">
      <!-- Soft Steam & Shimmer -->
      <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/50 to-transparent" />

      <div class="mb-2 flex items-center justify-between px-1">
        <span class="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" />
          {{ activeRole === 'kasir' ? 'Siap Saji di Meja Kasir' : 'Varian Dimsum Unggulan' }}
        </span>
        <span class="text-[10px] font-medium text-slate-300/80">
          {{ activeDimsum.name }}
        </span>
      </div>

      <!-- 4 Animated Dimsum Cutouts Bobbing at 60 FPS -->
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="(item, idx) in dimsumItems"
          :key="`login-${item.id}`"
          type="button"
          class="group relative flex flex-col items-center justify-center rounded-xl border p-1.5 transition-colors duration-200"
          :class="
            activeIndex === idx
              ? 'border-teal-300/60 bg-teal-400/15 shadow-sm'
              : 'border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/10'
          "
          @click="selectDimsum(idx)"
        >
          <div
            class="h-12 w-12 sm:h-14 sm:w-14"
            :class="`dimsum-mini-${idx + 1}`"
            :style="parallaxStyle(idx % 2 === 0 ? 0.35 : -0.35)"
          >
            <img
              :src="item.src"
              :alt="item.name"
              class="h-full w-full object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.45)]"
              draggable="false"
            >
          </div>
          <span class="mt-1 max-w-full truncate text-[9px] font-semibold text-slate-200">
            {{ item.name.replace('Dimsum ', '') }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* GPU-Composited 60 FPS Animations (transform & opacity only — zero reflow/repaint) */
.dimsum-hero-float {
  will-change: transform;
  animation: heroFloat60 4.4s ease-in-out infinite;
  backface-visibility: hidden;
}

.dimsum-shadow {
  will-change: transform, opacity;
  animation: shadowPulse60 4.4s ease-in-out infinite;
}

.dimsum-ring-outer {
  will-change: transform;
  animation: slowSpin60 28s linear infinite;
}

.dimsum-ring-inner {
  will-change: transform;
  animation: slowSpinReverse60 20s linear infinite;
}

.dimsum-orb-1 {
  will-change: transform;
  animation: orbDriftA 9s ease-in-out infinite;
}

.dimsum-orb-2 {
  will-change: transform;
  animation: orbDriftB 11s ease-in-out infinite;
}

.dimsum-sat-1 {
  will-change: transform;
  animation: satFloatA 4.2s ease-in-out infinite;
}
.dimsum-sat-2 {
  will-change: transform;
  animation: satFloatB 4.8s ease-in-out infinite;
}
.dimsum-sat-3 {
  will-change: transform;
  animation: satFloatB 5.1s ease-in-out infinite;
}
.dimsum-sat-4 {
  will-change: transform;
  animation: satFloatA 4.5s ease-in-out infinite;
}

.dimsum-mini-1 {
  will-change: transform;
  animation: miniBob60 3.2s ease-in-out infinite;
}
.dimsum-mini-2 {
  will-change: transform;
  animation: miniBob60 3.6s ease-in-out 0.45s infinite;
}
.dimsum-mini-3 {
  will-change: transform;
  animation: miniBob60 3.4s ease-in-out 0.9s infinite;
}
.dimsum-mini-4 {
  will-change: transform;
  animation: miniBob60 3.8s ease-in-out 1.35s infinite;
}

.steam-wisp {
  will-change: transform, opacity;
  animation: steamRise60 3.2s ease-out infinite;
}
.steam-delay-1 { animation-delay: 0s; }
.steam-delay-2 { animation-delay: 1.05s; }
.steam-delay-3 { animation-delay: 2.1s; }

/* Spotlight image swap transition */
.dimsum-pop-enter-active,
.dimsum-pop-leave-active {
  will-change: transform, opacity;
  transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease;
}
.dimsum-pop-enter-from {
  opacity: 0;
  transform: translate3d(0, 14px, 0) scale(0.86) rotate(-6deg);
}
.dimsum-pop-leave-to {
  opacity: 0;
  transform: translate3d(0, -14px, 0) scale(0.88) rotate(6deg);
}

@keyframes heroFloat60 {
  0%, 100% {
    transform: translate3d(0, 0, 0) rotate(-2deg);
  }
  50% {
    transform: translate3d(0, -14px, 0) rotate(2.5deg);
  }
}

@keyframes shadowPulse60 {
  0%, 100% {
    transform: scale3d(1, 1, 1);
    opacity: 0.42;
  }
  50% {
    transform: scale3d(0.78, 0.78, 1);
    opacity: 0.22;
  }
}

@keyframes satFloatA {
  0%, 100% {
    transform: translate3d(0, 0, 0) rotate(-3deg);
  }
  50% {
    transform: translate3d(0, -9px, 0) rotate(3deg);
  }
}

@keyframes satFloatB {
  0%, 100% {
    transform: translate3d(0, 0, 0) rotate(3deg);
  }
  50% {
    transform: translate3d(0, 9px, 0) rotate(-3deg);
  }
}

@keyframes miniBob60 {
  0%, 100% {
    transform: translate3d(0, 0, 0) rotate(-3deg);
  }
  50% {
    transform: translate3d(0, -6px, 0) rotate(3deg);
  }
}

@keyframes slowSpin60 {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes slowSpinReverse60 {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

@keyframes orbDriftA {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(-18px, 14px, 0) scale(1.08); }
}

@keyframes orbDriftB {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(18px, -12px, 0) scale(1.06); }
}

@keyframes steamRise60 {
  0% {
    opacity: 0;
    transform: translate3d(0, 14px, 0) scaleY(0.8);
  }
  35% {
    opacity: 0.65;
  }
  100% {
    opacity: 0;
    transform: translate3d(6px, -28px, 0) scaleY(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dimsum-hero-float,
  .dimsum-shadow,
  .dimsum-ring-outer,
  .dimsum-ring-inner,
  .dimsum-orb-1,
  .dimsum-orb-2,
  .dimsum-sat-1,
  .dimsum-sat-2,
  .dimsum-sat-3,
  .dimsum-sat-4,
  .dimsum-mini-1,
  .dimsum-mini-2,
  .dimsum-mini-3,
  .dimsum-mini-4,
  .steam-wisp {
    animation: none !important;
  }
}
</style>
