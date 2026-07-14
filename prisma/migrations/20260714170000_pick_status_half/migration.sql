-- Asian quarter-line settlement (OB-045): quarter handicaps/totals split the
-- stake, settling as half-win or half-loss. Add the two outcomes to PickStatus.
ALTER TYPE "PickStatus" ADD VALUE IF NOT EXISTS 'half_won';
ALTER TYPE "PickStatus" ADD VALUE IF NOT EXISTS 'half_lost';
