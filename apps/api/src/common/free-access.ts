import { ConflictException } from '@nestjs/common';

/** The API is authoritative; access remains paid/closed unless explicitly enabled. */
export function isFreeAccessMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FREE_ACCESS_MODE === 'true';
}

export function assertPaymentsEnabled(env: NodeJS.ProcessEnv = process.env): void {
  if (isFreeAccessMode(env)) {
    throw new ConflictException({
      code: 'PAYMENTS_DISABLED',
      message: 'Payments are disabled while free access is enabled.',
    });
  }
}

export function assertPayoutsEnabled(env: NodeJS.ProcessEnv = process.env): void {
  if (isFreeAccessMode(env)) {
    throw new ConflictException({
      code: 'PAYOUTS_DISABLED',
      message: 'Payouts are paused while free access is enabled.',
    });
  }
}
