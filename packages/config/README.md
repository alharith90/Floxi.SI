# Shared configuration

All workspace sources are checked by the root `tsconfig.json` and `eslint.config.js`, keeping strictness consistent between browser, API, worker, contracts and tests. Tool entry points at the repository root also discover the common Prisma/Vite/Vitest configuration.
