CREATE TABLE "app_variant" (
  "appVariantId" INTEGER NOT NULL,
  "role" TEXT,
  "standaloneRuntimeTenantId" INTEGER,
  "profileName" TEXT,
  "profileDescription" TEXT,
  CONSTRAINT "app_variant_pkey" PRIMARY KEY ("appVariantId")
);

CREATE TABLE "runtime_tenant" (
  "runtimeTenantId" INTEGER NOT NULL,
  "profileName" TEXT NOT NULL,
  "profileDescription" TEXT NOT NULL,
  CONSTRAINT "runtime_tenant_pkey" PRIMARY KEY ("runtimeTenantId")
);

CREATE TABLE "app_variant_runtime_tenant_access" (
  "appVariantId" INTEGER NOT NULL,
  "runtimeTenantId" INTEGER NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "app_variant_runtime_tenant_access_pkey" PRIMARY KEY ("appVariantId", "runtimeTenantId")
);

ALTER TABLE "app_variant_runtime_tenant_access"
  ADD CONSTRAINT "app_variant_runtime_tenant_access_app_variant_fkey"
  FOREIGN KEY ("appVariantId")
  REFERENCES "app_variant" ("appVariantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_variant_runtime_tenant_access"
  ADD CONSTRAINT "app_variant_runtime_tenant_access_runtime_tenant_fkey"
  FOREIGN KEY ("runtimeTenantId")
  REFERENCES "runtime_tenant" ("runtimeTenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;
