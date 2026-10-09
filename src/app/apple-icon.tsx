import { ImageResponse } from 'next/og'
import { AppIcon } from '@/server/app-icon'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  // iOS rounds the corners itself → square background
  return new ImageResponse(<AppIcon size={180} radius={0} />, size)
}
