ALTER TABLE "RondaIntramural" RENAME COLUMN "eps" TO "ips";
ALTER INDEX "RondaIntramural_eps_idx" RENAME TO "RondaIntramural_ips_idx";
ALTER TABLE "RondaIntramural" ADD COLUMN "ingresoEfectivo" BOOLEAN;
