import { assertGeneratedAppCommandHostEnvironment } from './generated-app-command-runner';

export const PROVIDER_TEST_PROFILES = [
  'clerk-node',
  'convex-public',
  'convex-better-auth',
  'convex-clerk',
] as const;

export type ProviderTestProfile = (typeof PROVIDER_TEST_PROFILES)[number];

type ProviderInputName =
  | 'betterAuthSecret'
  | 'clerkFrontendApiUrl'
  | 'clerkPublishableKey'
  | 'clerkSecretKey'
  | 'convexDeployment'
  | 'convexSiteUrl'
  | 'convexUrl';

type ProviderTestProfileDefinition = {
  inputMappings: Readonly<Partial<Record<ProviderInputName, readonly string[]>>>;
  resourceClasses: readonly string[];
};

const PROVIDER_TEST_PROFILE_DEFINITIONS = {
  'clerk-node': {
    inputMappings: {
      clerkPublishableKey: ['CLERK_PUBLISHABLE_KEY', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'],
      clerkSecretKey: ['CLERK_SECRET_KEY'],
    },
    resourceClasses: ['preprovisioned-clerk-development'],
  },
  'convex-public': {
    inputMappings: {
      convexDeployment: ['CONVEX_DEPLOYMENT'],
      convexSiteUrl: ['CONVEX_SITE_URL'],
      convexUrl: ['CONVEX_URL', 'EXPO_PUBLIC_CONVEX_URL'],
    },
    resourceClasses: ['preprovisioned-convex-development'],
  },
  'convex-better-auth': {
    inputMappings: {
      betterAuthSecret: ['BETTER_AUTH_SECRET'],
      convexDeployment: ['CONVEX_DEPLOYMENT'],
      convexSiteUrl: ['CONVEX_SITE_URL', 'EXPO_PUBLIC_CONVEX_SITE_URL', 'SITE_URL'],
      convexUrl: ['CONVEX_URL', 'EXPO_PUBLIC_CONVEX_URL'],
    },
    resourceClasses: [
      'preprovisioned-convex-development',
      'preprovisioned-better-auth-development',
    ],
  },
  'convex-clerk': {
    inputMappings: {
      clerkFrontendApiUrl: ['CLERK_FRONTEND_API_URL'],
      clerkPublishableKey: ['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'],
      convexDeployment: ['CONVEX_DEPLOYMENT'],
      convexSiteUrl: ['CONVEX_SITE_URL'],
      convexUrl: ['CONVEX_URL', 'EXPO_PUBLIC_CONVEX_URL'],
    },
    resourceClasses: ['preprovisioned-convex-development', 'preprovisioned-clerk-development'],
  },
} as const satisfies Record<ProviderTestProfile, ProviderTestProfileDefinition>;

export type GeneratedVerificationEnvironmentEvidence = {
  profile: 'deterministic' | ProviderTestProfile;
  sourceName: string;
  environmentKeys: readonly string[];
  resourceClasses: readonly string[];
};

export type GeneratedVerificationEnvironment = {
  values: Readonly<Record<string, string>>;
  evidence: GeneratedVerificationEnvironmentEvidence;
};

export type ResolveProviderTestProfileOptions = {
  profile: ProviderTestProfile;
  sourceName: string;
  baseEnvironment: Readonly<Record<string, string>>;
  inputs: Readonly<Record<string, string>>;
};

function assertSafeSourceName(sourceName: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceName)) {
    throw new Error('Provider environment evidence requires a safe source name.');
  }
}

export function resolveProviderTestProfile({
  profile,
  sourceName,
  baseEnvironment,
  inputs,
}: ResolveProviderTestProfileOptions): GeneratedVerificationEnvironment {
  assertSafeSourceName(sourceName);
  assertGeneratedAppCommandHostEnvironment(baseEnvironment);
  if (!PROVIDER_TEST_PROFILES.some((supportedProfile) => supportedProfile === profile)) {
    throw new Error(`Unsupported provider test profile: ${String(profile)}.`);
  }
  const definition: ProviderTestProfileDefinition = PROVIDER_TEST_PROFILE_DEFINITIONS[profile];
  const requiredInputs = Object.keys(definition.inputMappings).sort() as ProviderInputName[];
  const suppliedInputs = Object.keys(inputs).sort();

  for (const inputName of requiredInputs) {
    if (!(inputName in inputs)) {
      throw new Error(`Missing provider input: ${inputName}.`);
    }
    if (inputs[inputName]?.trim().length === 0) {
      throw new Error(`Provider input ${inputName} must be non-empty.`);
    }
  }

  for (const inputName of suppliedInputs) {
    if (!requiredInputs.some((requiredInput) => requiredInput === inputName)) {
      throw new Error(`Unexpected provider input: ${inputName}.`);
    }
  }

  const values: Record<string, string> = { ...baseEnvironment };
  for (const inputName of requiredInputs) {
    const inputValue = inputs[inputName];
    if (inputValue === undefined) {
      throw new Error(`Missing provider input: ${inputName}.`);
    }

    for (const environmentKey of definition.inputMappings[inputName] ?? []) {
      if (environmentKey in baseEnvironment) {
        throw new Error(`Base environment must not define provider-owned key ${environmentKey}.`);
      }
      values[environmentKey] = inputValue;
    }
  }

  const environmentKeys = Object.keys(values).sort();
  return {
    values,
    evidence: {
      environmentKeys,
      profile,
      resourceClasses: [...definition.resourceClasses],
      sourceName,
    },
  };
}
