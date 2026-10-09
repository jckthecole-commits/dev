import { markOrderPaid, markOrderPaymentFailed } from '@/server/orders'
import { NETOPIA_STATUS, verifyNetopiaIpn } from '@/server/payments'

/** Netopia IPN. Must answer with { errorType, errorCode, errorMessage }. */
export async function POST(req: Request) {
  const raw = await req.text()
  const v = verifyNetopiaIpn(req.headers.get('verification-token'), raw)
  if (!v.ok) {
    console.warn('[netopia] IPN rejected:', v.reason)
    return Response.json({ errorType: 2, errorCode: 0x10000101, errorMessage: v.reason }, { status: 200 })
  }
  const number = v.payload.order?.orderID
  const status = v.payload.payment?.status
  if (number && status !== undefined) {
    if (status === NETOPIA_STATUS.PAID || status === NETOPIA_STATUS.CONFIRMED) await markOrderPaid(number, v.payload.payment?.ntpID ?? null, 'netopia')
    else if ([NETOPIA_STATUS.CANCELED, NETOPIA_STATUS.DECLINED, NETOPIA_STATUS.ERROR, NETOPIA_STATUS.FRAUD].includes(status as never)) await markOrderPaymentFailed(number, `cod Netopia ${status}`)
  }
  return Response.json({ errorType: 0, errorCode: null, errorMessage: '' })
}
