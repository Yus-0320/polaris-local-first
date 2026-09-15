export const POLARIS_DEVELOPER_MODE_EVENT = 'polaris:developer-mode-updated';
const POLARIS_DEVELOPER_MODE_STORAGE_KEY = 'polaris-developer-mode';

export type PolarisDeveloperBridge = {
  isEnabled: () => boolean;
  enable: () => boolean;
  disable: () => boolean;
  toggle: () => boolean;
  readAssetGovernanceDebugEntries: () => Promise<unknown[]>;
  clearAssetGovernanceDebugEntries: () => Promise<void>;
  readRequestDebugEntries: () => Promise<unknown[]>;
  clearRequestDebugEntries: () => Promise<void>;
  readChatQaAuditEntries: () => Promise<unknown[]>;
  clearChatQaAuditEntries: () => Promise<void>;
  summarizeChatQaAuditEntries: () => Promise<unknown>;
  readModelFlowTraceEntries: () => Promise<unknown[]>;
  clearModelFlowTraceEntries: () => Promise<void>;
  summarizeModelFlowTraceEntries: () => Promise<unknown>;
  readEnvironmentContractQaReports: () => Promise<unknown[]>;
  clearEnvironmentContractQaReports: () => Promise<void>;
  readLatestEnvironmentContractQaReport: () => Promise<unknown>;
  readRuntimePerformanceEntries: () => Promise<unknown[]>;
  clearRuntimePerformanceEntries: () => Promise<void>;
  readLatestPersistenceError: () => Promise<unknown>;
  clearLatestPersistenceError: () => Promise<void>;
  seedPerformanceScenario: (options?: import('./performanceScenarioSeed').PerformanceScenarioSeedOptions) => Promise<import('./performanceScenarioSeed').PerformanceScenarioSeedResult>;
  measurePerformanceScenario: (options?: import('./performanceScenarioMeasure').PerformanceScenarioMeasureOptions) => Promise<import('./runtime-performance/runtimePerformanceEvent').PerformanceScenarioMeasureResult>;
  pulseScreenshotDebugOverlay?: () => void;
  snapshot: () => Promise<{
    developerMode: boolean;
    assetGovernanceEntries: unknown[];
    requestEntries: unknown[];
    chatQaAuditEntries: unknown[];
    chatQaAuditSummary: unknown;
    modelFlowTraceEntries: unknown[];
    modelFlowTraceSummary: unknown;
    environmentContractQaReports: unknown[];
    latestEnvironmentContractQaReport: unknown;
    runtimePerformanceEntries: unknown[];
    latestPersistenceError: unknown;
  }>;
};

declare global {
  interface Window {
    __polarisDev?: PolarisDeveloperBridge & {
      getRunCodeSandboxProfile?: () => 'safe' | 'experimental';
      unlockRunCodeSandbox?: (passphrase: string) => 'experimental' | false;
      lockRunCodeSandbox?: () => boolean;
    };
  }
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function dispatchDeveloperModeEvent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(POLARIS_DEVELOPER_MODE_EVENT));
}

export function isDeveloperModeEnabled() {
  const storage = getLocalStorage();
  if (!storage) return false;

  try {
    const stored = storage.getItem(POLARIS_DEVELOPER_MODE_STORAGE_KEY);
    return stored === null ? true : stored === '1';
  } catch {
    return false;
  }
}

export function setDeveloperModeEnabled(enabled: boolean) {
  const storage = getLocalStorage();
  if (!storage) return false;

  try {
    storage.setItem(POLARIS_DEVELOPER_MODE_STORAGE_KEY, enabled ? '1' : '0');
    dispatchDeveloperModeEvent();
    return enabled;
  } catch {
    return false;
  }
}

export function toggleDeveloperMode() {
  return setDeveloperModeEnabled(!isDeveloperModeEnabled());
}
