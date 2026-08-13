CREATE TABLE "app_variant" (
	"appVariantId" integer PRIMARY KEY NOT NULL,
	"role" text,
	"standaloneRuntimeTenantId" integer,
	"profileName" text,
	"profileDescription" text
);
--> statement-breakpoint
CREATE TABLE "runtime_tenant" (
	"runtimeTenantId" integer PRIMARY KEY NOT NULL,
	"profileName" text NOT NULL,
	"profileDescription" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_variant_runtime_tenant_access" (
	"appVariantId" integer NOT NULL,
	"runtimeTenantId" integer NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	CONSTRAINT "app_variant_runtime_tenant_access_appVariantId_runtimeTenantId_pk" PRIMARY KEY("appVariantId","runtimeTenantId")
);
--> statement-breakpoint
ALTER TABLE "app_variant_runtime_tenant_access" ADD CONSTRAINT "app_variant_runtime_tenant_access_appVariantId_app_variant_appVariantId_fk" FOREIGN KEY ("appVariantId") REFERENCES "public"."app_variant"("appVariantId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_variant_runtime_tenant_access" ADD CONSTRAINT "app_variant_runtime_tenant_access_runtimeTenantId_runtime_tenant_runtimeTenantId_fk" FOREIGN KEY ("runtimeTenantId") REFERENCES "public"."runtime_tenant"("runtimeTenantId") ON DELETE cascade ON UPDATE no action;
