import { Module } from '@nestjs/common';
import { MockPaymentProvider } from './mock.provider';
import { StripePaymentProvider } from './stripe.provider';
import { CryptoPaymentProvider } from './crypto.provider';
import { MobileMoneyPaymentProvider } from './mobile-money.provider';
import { PaymentProviderRegistry } from './payment-provider.registry';
import type { PaymentProvider } from './payment-provider.interface';

/** DI token for the default (env-selected) payment provider. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/** DI token for the registry of all wired payment providers. */
export const PAYMENT_REGISTRY = Symbol('PAYMENT_REGISTRY');

/** Resolve the default provider name from env (defaults to the mock). */
function defaultProviderName(): string {
  const explicit = process.env.PAYMENTS_PROVIDER?.toLowerCase();
  const name =
    explicit === 'stripe' || explicit === 'crypto' || explicit === 'mobile_money'
      ? explicit
      : 'mock';
  // The mock provider grants entitlement without taking real money. Refuse to
  // boot with it as the default in production so a misconfiguration can never
  // hand out free subscriptions or trigger payouts against uncollected funds.
  if (name === 'mock' && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to start: PAYMENTS_PROVIDER must be a real provider ' +
        '(stripe | crypto | mobile_money) in production, not the mock.',
    );
  }
  return name;
}

@Module({
  providers: [
    MockPaymentProvider,
    StripePaymentProvider,
    CryptoPaymentProvider,
    MobileMoneyPaymentProvider,
    {
      provide: PAYMENT_REGISTRY,
      inject: [
        MockPaymentProvider,
        StripePaymentProvider,
        CryptoPaymentProvider,
        MobileMoneyPaymentProvider,
      ],
      useFactory: (
        mock: MockPaymentProvider,
        stripe: StripePaymentProvider,
        crypto: CryptoPaymentProvider,
        mobileMoney: MobileMoneyPaymentProvider,
      ): PaymentProviderRegistry => {
        const defaultName = defaultProviderName();
        // The mock settles every method, so it must NOT be registered alongside
        // real providers (it would shadow them in forMethod). Include it only
        // when it's the default (dev / staging without real keys).
        const providers =
          defaultName === 'mock'
            ? [mock, stripe, crypto, mobileMoney]
            : [stripe, crypto, mobileMoney];
        return new PaymentProviderRegistry(providers, defaultName);
      },
    },
    {
      provide: PAYMENT_PROVIDER,
      inject: [PAYMENT_REGISTRY],
      useFactory: (registry: PaymentProviderRegistry): PaymentProvider =>
        registry.default,
    },
  ],
  exports: [PAYMENT_PROVIDER, PAYMENT_REGISTRY],
})
export class PaymentsModule {}
