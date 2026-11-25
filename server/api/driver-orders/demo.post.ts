import { asc, desc, like } from 'drizzle-orm'
import { getDb } from '../../database'
import {
  products,
  transactionDetails,
  transactions,
  type DriverFoodMethod,
  type DriverOrderStatus
} from '../../database/schema'
import { getWibCompactDate, toDecimalString } from '../../utils/datetime'
import { ensureProductionLogsTable } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

interface DemoBody {
  platform?: 'ShopeeFood' | 'GoFood' | 'pack'
}

const DEMO_DRIVERS: Record<DriverFoodMethod, string[]> = {
  ShopeeFood: ['Raka', 'Dimas', 'Bagas', 'Fajar', 'Reza'],
  GoFood: ['Andi', 'Budi', 'Wahyu', 'Agus', 'Hendra']
}

const DEMO_NOTES = [
  'Saus dipisah, Extra Chili Oil',
  'Minta hangat / baru kukus',
  'Tambah sumpit 2 pasang',
  'Tanpa saus pedas',
  null
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomCode(prefix: string): string {
  return `#${prefix}-${Math.floor(100 + Math.random() * 899)}`
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event, ['admin', 'kasir'])
  const body = await readBody<DemoBody>(event).catch(() => ({} as DemoBody))
  const mode = body?.platform || 'pack'

  const db = getDb()
  await ensureProductionLogsTable()

  const allProducts = await db
    .select()
    .from(products)
    .orderBy(asc(products.id_produk))

  if (allProducts.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Belum ada data menu di database. Jalankan "Isi Data Awal (Seed)" terlebih dahulu di halaman Login.'
    })
  }

  const dimsumList = allProducts.filter(p => p.kategori !== 'Minuman & Saus')
  const drinkList = allProducts.filter(p => p.kategori === 'Minuman & Saus')
  const menuPool = dimsumList.length > 0 ? dimsumList : allProducts

  const specs: Array<{ platform: DriverFoodMethod, status: DriverOrderStatus, minutesAgo: number }> =
    mode === 'ShopeeFood'
      ? [{ platform: 'ShopeeFood', status: 'Sedang Diolah', minutesAgo: 0 }]
      : mode === 'GoFood'
        ? [{ platform: 'GoFood', status: 'Sedang Diolah', minutesAgo: 0 }]
        : [
            { platform: 'ShopeeFood', status: 'Sedang Diolah', minutesAgo: 2 },
            { platform: 'GoFood', status: 'Sedang Dibungkus', minutesAgo: 7 },
            { platform: 'ShopeeFood', status: 'Sudah Siap', minutesAgo: 14 }
          ]

  const createdInvoices = await db.transaction(async (tx) => {
    const now = new Date()
    const datePart = getWibCompactDate(now)
    const invoicePrefix = `INV-${datePart}-`

    const [latestInvoice] = await tx
      .select({ no_faktur: transactions.no_faktur })
      .from(transactions)
      .where(like(transactions.no_faktur, `${invoicePrefix}%`))
      .orderBy(desc(transactions.no_faktur))
      .limit(1)
      .for('update')

    let nextSeq = 1
    if (latestInvoice?.no_faktur) {
      const suffix = latestInvoice.no_faktur.slice(invoicePrefix.length)
      const parsed = Number.parseInt(suffix, 10)
      if (Number.isFinite(parsed) && parsed >= 1) {
        nextSeq = parsed + 1
      }
    }

    const inserted: Array<{ no_faktur: string, platform: DriverFoodMethod, status: DriverOrderStatus, kode: string }> = []

    for (const spec of specs) {
      const noFaktur = `${invoicePrefix}${String(nextSeq).padStart(3, '0')}`
      nextSeq += 1

      const mainItem = pickRandom(menuPool)
      const mainQty = Math.floor(1 + Math.random() * 2) // 1 - 2 porsi
      const orderLines: Array<{
        id_produk: number
        harga_satuan: number
        qty: number
        subtotal: number
        catatan: string | null
      }> = [
        {
          id_produk: mainItem.id_produk,
          harga_satuan: Number(mainItem.harga_jual),
          qty: mainQty,
          subtotal: Number(mainItem.harga_jual) * mainQty,
          catatan: pickRandom(DEMO_NOTES)
        }
      ]

      // Tambahkan 1 item kedua (minuman atau varian dimsum lain) agar terasa realistis
      const extraSource = drinkList.length > 0 && Math.random() > 0.4
        ? drinkList
        : menuPool.filter(p => p.id_produk !== mainItem.id_produk)
      if (extraSource.length > 0) {
        const extraItem = pickRandom(extraSource)
        orderLines.push({
          id_produk: extraItem.id_produk,
          harga_satuan: Number(extraItem.harga_jual),
          qty: 1,
          subtotal: Number(extraItem.harga_jual),
          catatan: null
        })
      }

      const totalHarga = orderLines.reduce((sum, l) => sum + l.subtotal, 0)
      const driverName = pickRandom(DEMO_DRIVERS[spec.platform])
      const codePrefix = spec.platform === 'ShopeeFood' ? 'SF' : 'GF'
      const kodeOrderDriver = `${randomCode(codePrefix)} · ${driverName} (Demo)`
      const orderTime = new Date(now.getTime() - spec.minutesAgo * 60 * 1000)

      await tx.insert(transactions).values({
        no_faktur: noFaktur,
        id_user: user.id_user,
        tanggal_transaksi: orderTime,
        tipe_pesanan: 'Takeaway',
        nomor_meja: null,
        total_harga: toDecimalString(totalHarga),
        bayar: toDecimalString(totalHarga),
        kembalian: '0.00',
        metode_pembayaran: spec.platform,
        status_pesanan: spec.status,
        kode_order_driver: kodeOrderDriver
      })

      await tx.insert(transactionDetails).values(
        orderLines.map(line => ({
          no_faktur: noFaktur,
          id_produk: line.id_produk,
          harga_satuan: toDecimalString(line.harga_satuan),
          qty: line.qty,
          subtotal: toDecimalString(line.subtotal),
          catatan: line.catatan
        }))
      )

      inserted.push({
        no_faktur: noFaktur,
        platform: spec.platform,
        status: spec.status,
        kode: kodeOrderDriver
      })
    }

    return inserted
  })

  setResponseStatus(event, 201)

  return {
    success: true,
    message:
      createdInvoices.length === 1
        ? `Pesanan demo ${createdInvoices[0].platform} (${createdInvoices[0].kode}) berhasil dibuat.`
        : `${createdInvoices.length} pesanan demo ShopeeFood & GoFood berhasil dibuat (Diolah, Dibungkus, Sudah Siap).`,
    data: createdInvoices
  }
})
