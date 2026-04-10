SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='Novedad' AND column_name IN ('zonas','zona')
ORDER BY column_name;

SELECT t.typname AS enum_name, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname='public' AND t.typname IN ('Zona','Zona_old')
ORDER BY enum_name, e.enumsortorder;

SELECT migration_name, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
WHERE migration_name='20260410110000_update_novedad_zona_single';
