import { DESKTOP, type Limits, MOBILE } from '../../engine/validate';

export type Device = 'desktop' | 'mobile';
export const LIMITS: Record<Device, Limits> = { desktop: DESKTOP, mobile: MOBILE };

// A rough guess: a narrow screen or few cores probably means a phone or a slow laptop.
export const guessDevice = (width: number, cores?: number): Device =>
  width <= 640 || (cores !== undefined && cores <= 4) ? 'mobile' : 'desktop';

const KEY = 'glassbox-gpt:limits';

export function savedDevice(): Device | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'desktop' || v === 'mobile' ? v : null;
  } catch {
    return null;
  }
}

export function saveDevice(device: Device) {
  try {
    localStorage.setItem(KEY, device);
  } catch {
    // private mode or storage disabled: the choice just won't be remembered
  }
}
