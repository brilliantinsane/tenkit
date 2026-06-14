# Expo Tenant Kit

Domain language for a prototype kit that can produce distinct Expo applications and later support multiple tenants inside a broader business model.

## Language

**Tenant**:
An independently branded application identity. Each Tenant is configured as its own application.
_Avoid_: App Variant

**Tenant ID**:
A required numeric identifier for a Tenant.
_Avoid_: Tenant name, Tenant slug

**Tenant Slug**:
A build-time selector for a Tenant.
_Avoid_: Optional tenant selector

**Tenant Environment**:
An EAS environment selected for a Tenant during build preparation. Supported values are `development`, `preview`, and `production`.
_Avoid_: App environment, build env

**Build Preparation**:
The Tenant-specific preparation step that applies EAS environment values and refreshes native project state before a native build or run.
_Avoid_: Build setup, prebuild only

**EAS Project**:
The Expo Application Services project attached to exactly one Tenant.
_Avoid_: Shared EAS project

**EAS Project ID**:
The public identifier for the EAS Project attached to a Tenant.
_Avoid_: EAS_PROJECT_ID

**Expo Owner**:
The Expo account or organization that owns all Tenant EAS Projects in this starter. The starter defaults to `brilliant-insane`, and downstream apps replace it with their own owner.
_Avoid_: Per-Tenant owner

**Business Model**:
A future concept that may group or shape Tenant behaviour, but is intentionally out of scope for the current prototype.
_Avoid_: BM
