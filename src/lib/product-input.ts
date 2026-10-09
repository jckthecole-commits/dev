import { z } from 'zod'
import { COLOR_FAMILIES } from './product-derive'

/** Admin product editor payload. Prices are in lei here, stored in bani. */
const lei = z.coerce.number().min(0).max(100000)
const optLei = z.union([z.literal('').transform(() => null), z.null(), lei]).optional()

export const swatchSchema = z.object({
  kind: z.enum(['solid', 'havana', 'crystal', 'metal', 'gradient']),
  primary: z.string().min(1).max(32),
  secondary: z.string().max(32).optional(),
  temple: z.string().max(32).optional(),
  lens: z.string().max(32).optional(),
  lensGradient: z.boolean().optional(),
  mirror: z.string().max(32).optional(),
})

export const variantInput = z.object({
  id: z.string().uuid().optional(),
  colorName: z.string().trim().min(2, 'Numele culorii').max(60),
  colorCode: z.string().trim().regex(/^[A-Za-z0-9]{2,5}$/, 'Cod culoare: 2–5 litere/cifre'),
  colorFamily: z.enum(COLOR_FAMILIES),
  swatch: swatchSchema,
  ean: z.string().trim().regex(/^(\d{8}|\d{12,14})?$/, 'EAN/GTIN invalid').optional(),
  priceDelta: z.coerce.number().min(-1000).max(1000).default(0),
  active: z.boolean(),
  isDefault: z.boolean(),
  stock: z.record(z.string().uuid(), z.object({ onHand: z.coerce.number().int().min(0).max(100000), reorderPoint: z.coerce.number().int().min(0).max(1000) })),
})

export const productInput = z
  .object({
    family: z.string().trim().min(2, 'Familia / numele modelului').max(40),
    slug: z.string().trim().regex(/^[a-z0-9-]*$/, 'Doar litere mici, cifre și cratimă').max(80).optional(),
    category: z.enum(['optical', 'sun']),
    status: z.enum(['draft', 'active', 'archived']),
    audience: z.enum(['unisex', 'women', 'men', 'kids']),
    shape: z.enum(['rectangular', 'square', 'round', 'oval', 'cat-eye', 'pilot', 'browline', 'geometric']),
    material: z.enum(['acetat', 'metal', 'titan', 'tr90', 'combinat']),
    rim: z.enum(['full', 'semi', 'rimless']),
    lensWidth: z.coerce.number().int().min(38, 'A între 38 și 66 mm').max(66, 'A între 38 și 66 mm'),
    bridgeWidth: z.coerce.number().int().min(12, 'Puntea între 12 și 26 mm').max(26, 'Puntea între 12 și 26 mm'),
    templeLength: z.coerce.number().int().min(115, 'Brațul între 115 și 155 mm').max(155, 'Brațul între 115 și 155 mm'),
    lensHeight: z.coerce.number().int().min(22, 'B între 22 și 62 mm').max(62, 'B între 22 și 62 mm'),
    weightGrams: z.union([z.literal('').transform(() => null), z.null(), z.coerce.number().min(1).max(120)]).optional(),
    geometry: z.object({
      rim: z.coerce.number().min(0.6).max(9),
      bridgeStyle: z.enum(['keyhole', 'saddle', 'double', 'straight']),
      tension: z.coerce.number().min(1.6).max(7).optional(),
      lift: z.coerce.number().min(0).max(1).optional(),
      browWeight: z.coerce.number().min(1).max(3).optional(),
      pads: z.boolean().optional(),
    }),
    tagline: z.string().trim().max(140).optional(),
    description: z.string().trim().max(6000).optional(),
    highlights: z.array(z.string().trim().min(1).max(120)).max(8),
    features: z.array(z.string().trim().min(1).max(60)).max(12),
    filterCategory: z.union([z.null(), z.coerce.number().int().min(0).max(4)]).optional(),
    polarized: z.boolean(),
    price: lei.refine((v) => v > 0, 'Prețul este obligatoriu'),
    compareAtPrice: optLei,
    wholesalePrice: optLei,
    vatClass: z.enum(['standard', 'reduced', 'exempt']),
    badge: z.string().trim().max(24).optional(),
    featured: z.boolean(),
    manufacturer: z.string().trim().max(120).optional(),
    countryOfOrigin: z.string().trim().max(120).optional(),
    ceMarking: z.string().trim().max(160).optional(),
    metaTitle: z.string().trim().max(90).optional(),
    metaDescription: z.string().trim().max(200).optional(),
    variants: z.array(variantInput).min(1, 'Adaugă cel puțin o culoare').max(24),
  })
  .refine((p) => p.compareAtPrice == null || p.compareAtPrice > p.price, { message: 'Prețul vechi trebuie să fie mai mare decât prețul curent', path: ['compareAtPrice'] })
  .refine((p) => p.category === 'optical' || p.filterCategory != null, { message: 'Ochelarii de soare au nevoie de categoria filtrului (EN ISO 12312-1)', path: ['filterCategory'] })
  .refine((p) => new Set(p.variants.map((v) => v.colorCode.toUpperCase())).size === p.variants.length, { message: 'Codurile de culoare trebuie să fie unice', path: ['variants'] })

export type ProductInput = z.output<typeof productInput>
export type VariantInput = z.output<typeof variantInput>
