import { clsx, type ClassValue } from 'clsx';

/** Conditional className joiner. Thin wrapper over clsx for variant composition. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
