import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Join classes; later Tailwind classes win over conflicting earlier ones (e.g. `w-44` over a base `w-full`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
