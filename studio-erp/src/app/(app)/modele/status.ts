export const MODEL_STATUS = {
  onboarding: { label: 'În pregătire', tone: 'info' },
  active: { label: 'Activ', tone: 'good' },
  paused: { label: 'Pauză', tone: 'accent' },
  left: { label: 'Plecat', tone: 'neutral' },
} as const
export type ModelStatus = keyof typeof MODEL_STATUS
