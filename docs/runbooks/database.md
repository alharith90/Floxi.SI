# Database preservation, upgrade and recovery

Use `/workspace/.postgres/start.sh` at the beginning of a task. Do not initialize a cluster, enable TCP, rename either existing database, reset migrations, or drop data during routine setup.

Before applying new migrations to a database with user data:

```bash
mkdir -p /workspace/backups
/workspace/.postgres/root/usr/lib/postgresql/17/bin/pg_dump \
  -h /workspace/.postgres/socket -U agent -d floxi.si -Fc \
  -f /workspace/backups/floxi-before-upgrade.dump
/workspace/.postgres/root/usr/lib/postgresql/17/bin/pg_restore \
  --list /workspace/backups/floxi-before-upgrade.dump
```

The foundation backup is `/workspace/backups/floxi-before-foundation.dump`. Backup files may contain sensitive data; restrict access and use approved encryption/storage before off-machine transfer. This release does not automate backup retention or encryption.

Review migration SQL. Generate new additive SQL from a copy of the previous Prisma schema using `prisma migrate diff --from-schema-datamodel <previous> --to-schema-datamodel apps/api/prisma/schema.prisma --script`. Store it in a new ordered migration directory. Never edit applied SQL. Run `pnpm db:migrate`, then repeat it to verify idempotence, run integration checks, and verify the vector extension. The transaction ledger prevents partial application and detects checksum drift. Do not substitute `prisma migrate reset/dev/deploy`; see ADR 001.

A worker may be stopped and restarted without resetting the DB. Queued runs remain claimable; waiting runs resume at their saved wake time. Only pure nodes are admitted, so transaction rollback/replay cannot repeat external side effects. A run cancelled during a wait is excluded from future claims. Restore drills should target a **separate temporary database**, never overwrite `floxi.si` or `floxi`. A local application backup/restore smoke drill passed using `node_modules/.bin/tsx scripts/backup-smoke.ts`: an actual completed execution, pgvector 0.8.0, and exact migration checksums survived restoration into a new temporary database. Only that temporary database and generated source fixtures were removed afterward. Encrypted/offsite recovery and operational restore drills remain release gates.

Rollback: stop API and worker; return application code to a revision compatible with the additive schema. These migrations have no destructive down migration. Do not drop the new tables as an automatic rollback. A data restore requires a reviewed recovery plan and an explicitly selected destination.
