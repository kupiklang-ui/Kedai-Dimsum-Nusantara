<script setup lang="ts">
const config = useRuntimeConfig()
const visible = ref(true)
const progressReady = ref(false)

onMounted(() => {
  // Start smooth 60 FPS GPU progress bar immediately on next frame
  requestAnimationFrame(() => {
    progressReady.value = true
  })

  // Hold just long enough for a crisp, memorable brand welcome before revealing page
  setTimeout(() => {
    visible.value = false
  }, 1350)
})
</script>

<template>
  <Transition name="splash-reveal">
    <div
      v-if="visible"
      class="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#f4f7fa] px-6 text-[#0f213d] dark:bg-[#0b1424] dark:text-white"
      role="status"
      aria-live="polite"
      aria-label="Memuat website Kedai Dimsum Nusantara"
    >
      <!-- Ambient 60 FPS Soft Glow Orbs -->
      <div class="pointer-events-none absolute inset-0 overflow-hidden">
        <div class="splash-orb-1 absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0d9488]/20 blur-3xl dark:bg-[#0d9488]/25" />
        <div class="splash-orb-2 absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-400/10" />
      </div>

      <!-- Center Animated Dimsum Brand Logo -->
      <div class="relative flex flex-col items-center">
        <!-- Subtle Rising Steam Above Logo -->
        <div class="pointer-events-none mb-1 flex gap-4 opacity-70">
          <span class="splash-steam splash-steam-1 h-7 w-2 rounded-full bg-gradient-to-t from-[#0d9488]/45 to-transparent blur-[2px]" />
          <span class="splash-steam splash-steam-2 h-9 w-2.5 rounded-full bg-gradient-to-t from-amber-500/45 to-transparent blur-[2px]" />
          <span class="splash-steam splash-steam-3 h-7 w-2 rounded-full bg-gradient-to-t from-[#0d9488]/40 to-transparent blur-[2px]" />
        </div>

        <!-- Rotating Orbit Rings + Floating Center Logo -->
        <div class="relative flex h-40 w-40 items-center justify-center sm:h-44 sm:w-44">
          <div class="splash-ring-outer pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-[#0d9488]/45 dark:border-teal-400/40" />
          <div class="splash-ring-inner pointer-events-none absolute inset-2.5 rounded-full border border-amber-500/35 dark:border-amber-300/30" />
          <div class="splash-pulse-ring pointer-events-none absolute inset-3 rounded-[30px] bg-[#0d9488]/15" />

          <div class="splash-logo-float relative z-10 h-28 w-28 overflow-hidden rounded-[26px] bg-white shadow-2xl shadow-[#0f213d]/20 ring-2 ring-[#0d9488]/30 dark:shadow-black/50 sm:h-32 sm:w-32">
            <img
              src="/images/logo-kedai.png"
              :alt="config.public.storeName"
              class="h-full w-full object-cover"
              draggable="false"
            >
          </div>
        </div>

        <!-- Brand Title & Subtitle -->
        <div class="mt-5 text-center">
          <p class="text-lg font-extrabold tracking-tight text-[#0f213d] dark:text-white sm:text-xl">
            {{ config.public.storeName }}
          </p>
          <p class="mt-1 text-xs font-semibold text-[#0d9488] dark:text-teal-300">
            Menyiapkan Portal Kasir &amp; Admin UMKM...
          </p>
        </div>

        <!-- 60 FPS GPU-Accelerated Progress Bar -->
        <div class="mt-5 h-1.5 w-52 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800 sm:w-60">
          <div
            class="splash-progress-bar h-full w-full origin-left rounded-full bg-gradient-to-r from-[#0f213d] via-[#0d9488] to-[#ee6352] dark:from-teal-400 dark:via-[#0d9488] dark:to-amber-400"
            :class="{ 'is-filling': progressReady }"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* GPU-Composited 60 FPS Animations (transform & opacity only) */
.splash-logo-float {
  will-change: transform;
  animation: splashFloat60 2.2s ease-in-out infinite;
  backface-visibility: hidden;
}

.splash-ring-outer {
  will-change: transform;
  animation: splashSpin60 12s linear infinite;
}

.splash-ring-inner {
  will-change: transform;
  animation: splashSpinReverse60 9s linear infinite;
}

.splash-pulse-ring {
  will-change: transform, opacity;
  animation: splashPulse60 1.8s ease-out infinite;
}

.splash-orb-1 {
  will-change: transform;
  animation: splashOrb60 4s ease-in-out infinite;
}
.splash-orb-2 {
  will-change: transform;
  animation: splashOrb60 4.6s ease-in-out 0.6s infinite reverse;
}

.splash-steam {
  will-change: transform, opacity;
  animation: splashSteam60 1.9s ease-out infinite;
}
.splash-steam-1 { animation-delay: 0s; }
.splash-steam-2 { animation-delay: 0.55s; }
.splash-steam-3 { animation-delay: 1.1s; }

.splash-progress-bar {
  will-change: transform;
  transform: scale3d(0.06, 1, 1);
  transition: transform 1.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.splash-progress-bar.is-filling {
  transform: scale3d(1, 1, 1);
}

/* Smooth 60 FPS exit reveal */
.splash-reveal-leave-active {
  will-change: transform, opacity;
  transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1), transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.splash-reveal-leave-to {
  opacity: 0;
  transform: scale3d(1.04, 1.04, 1);
}

@keyframes splashFloat60 {
  0%, 100% {
    transform: translate3d(0, 0, 0) scale3d(1, 1, 1);
  }
  50% {
    transform: translate3d(0, -8px, 0) scale3d(1.03, 1.03, 1);
  }
}

@keyframes splashSpin60 {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes splashSpinReverse60 {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

@keyframes splashPulse60 {
  0% {
    transform: scale3d(0.92, 0.92, 1);
    opacity: 0.55;
  }
  100% {
    transform: scale3d(1.22, 1.22, 1);
    opacity: 0;
  }
}

@keyframes splashOrb60 {
  0%, 100% {
    transform: translate3d(-50%, -50%, 0) scale3d(1, 1, 1);
  }
  50% {
    transform: translate3d(-50%, -50%, 0) scale3d(1.12, 1.12, 1);
  }
}

@keyframes splashSteam60 {
  0% {
    opacity: 0;
    transform: translate3d(0, 8px, 0) scaleY(0.8);
  }
  40% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: translate3d(4px, -18px, 0) scaleY(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .splash-logo-float,
  .splash-ring-outer,
  .splash-ring-inner,
  .splash-pulse-ring,
  .splash-orb-1,
  .splash-orb-2,
  .splash-steam {
    animation: none !important;
  }
}
</style>
