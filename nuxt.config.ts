export default defineNuxtConfig({
  compatibilityDate: '2025-03-01',
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@pinia/nuxt'
  ],

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'light',
    fallback: 'light',
    classSuffix: ''
  },

  app: {
    pageTransition: {
      name: 'page-slide',
      mode: 'out-in'
    },
    head: {
      title: 'Dimsum POS & Manajemen Stok',
      htmlAttrs: {
        lang: 'id'
      },
      link: [
        { rel: 'icon', type: 'image/png', href: '/images/logo-kedai.png' },
        { rel: 'apple-touch-icon', href: '/images/logo-kedai.png' }
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Sistem Kasir (POS) & Manajemen Stok UMKM Dimsum berbasis Nuxt 3 dan TiDB Cloud' }
      ]
    }
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    sessionSecret: process.env.SESSION_SECRET || 'dimsum-pos-dev-secret-change-in-production-32chars',
    public: {
      storeName: process.env.NUXT_PUBLIC_STORE_NAME || 'Kedai Dimsum Nusantara'
    }
  },

  typescript: {
    strict: true,
    typeCheck: false
  }
})
