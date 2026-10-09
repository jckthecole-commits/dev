/**
 * Client IP behind reverse proxies. Each trusted proxy *appends* the address it
 * received the request from to X-Forwarded-For, so the real client is the entry
 * `TRUSTED_PROXY_HOPS` positions from the end (default 1: one proxy — Nginx,
 * Caddy, Vercel, a load balancer). Anything to the left of that was supplied by
 * the client and is ignored, so the header cannot be spoofed to dodge limits.
 */
export function clientIpFrom(h: Headers, hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1)): string | null {
  const chain = (h.get('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const n = Math.max(1, Math.floor(hops) || 1)
  const ip = chain.length ? chain[Math.max(0, chain.length - n)] : h.get('x-real-ip')
  return ip && /^[0-9a-f:.]{3,45}$/i.test(ip) ? ip : null
}

/** Request header set by src/proxy.ts with the resolved address (overwrites anything the client sent). */
export const CLIENT_IP_HEADER = 'x-client-ip'
