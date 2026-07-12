import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SettlementService } from './workers/settlement.service';

/**
 * Worker entrypoint (docs/ARCHITECTURE.md §3.3). Runs the settlement pipeline
 * separately from the HTTP API. In v1 this runs a single cycle on an interval;
 * migrate to BullMQ-scheduled jobs (ingest-events, capture-closing-odds,
 * settle-picks, compute-clv, recompute-stats, dispatch-notifications,
 * run-payouts) as volume grows.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const settlement = app.get(SettlementService);

  const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);
  // eslint-disable-next-line no-console
  console.log(`Overlay worker started; cycle every ${intervalMs}ms`);

  const tick = async () => {
    try {
      await settlement.runOnce();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('settlement cycle failed', err);
    }
  };

  await tick();
  setInterval(tick, intervalMs);
}

main();
