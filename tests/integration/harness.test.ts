import { describe, expect, it } from 'vitest'
import { getCurrentUser, requireStaff } from '@/server/session'
import { actAs, createUser, DEMO, expectHttpError, expectRedirect, request } from './helpers'

describe('integration harness', () => {
  it('starts every test as an anonymous visitor with its own IP', async () => {
    expect(await getCurrentUser()).toBeNull()
    expect(request.headers.get('x-client-ip')).toMatch(/^10\.77\./)
    expect(request.cookies.size).toBe(0)
  })

  it('signs in a fresh user through Better Auth', async () => {
    const u = await createUser({ role: 'customer' })
    await actAs(u)
    const me = await getCurrentUser()
    expect(me).toMatchObject({ id: u.id, email: u.email, role: 'customer' })
  })

  it('signs in a demo staff member and enforces permissions', async () => {
    await actAs(DEMO.staff)
    expect((await requireStaff('orders:read')).role).toBe('staff')
    await expectHttpError(requireStaff('settings:write'), 403)
  })

  it('redirects anonymous visitors to sign in', async () => {
    await expectRedirect(requireStaff(), '/cont/autentificare?next=/admin')
  })
})

describe('server actions run against the test database', () => {
  it('adds a frame without lenses to a new cart and sets the cart cookie', async () => {
    const { db } = await import('./helpers')
    const { addToCart } = await import('@/app/actions/cart')
    const { loadCart, CART_COOKIE } = await import('@/server/cart')
    const v = await db.query.variant.findFirst({ where: (t, { eq }) => eq(t.active, true) })
    const fd = new FormData()
    fd.set('variantId', v!.id)
    fd.set('config', JSON.stringify({ lensType: 'none', treatments: [] }))
    const r = await addToCart(fd)
    expect(r).toMatchObject({ ok: true, data: { count: 1 } })
    const set = request.setCookies.find((c) => c.name === CART_COOKIE)
    expect(set?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' })
    expect((await loadCart()).lines).toHaveLength(1)
    expect(request.revalidated).toContain('refresh')
  })
})

describe('factories', () => {
  it('creates an isolated product with stock at every location', async () => {
    const { createProduct, db } = await import('./helpers')
    const t = await createProduct({ stock: 3, price: 25_000 })
    expect(t.product.status).toBe('active')
    expect(t.product.price).toBe(25_000)
    const inv = await db.query.inventory.findMany({ where: (i, { eq }) => eq(i.variantId, t.variant.id) })
    expect(inv.length).toBe(t.locations.length)
    expect(inv.every((i) => i.onHand === 3 && i.reserved === 0)).toBe(true)
  })
})
