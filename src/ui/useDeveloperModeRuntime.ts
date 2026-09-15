import { useEffect } from 'react';
import {
  isDeveloperModeEnabled,
  setDeveloperModeEnabled,
  toggleDeveloperMode
} from '../app/developer/developerModeRuntime';
import {
  getRunCodeSandboxProfile,
  lockRunCodeSandbox,
  unlockRunCodeSandbox
} from '../infrastructure/runCodeSandboxMode';
import { pulseScreenshotDebugOverlay } from '../native/screenshotDebug';
import { DEVELOPER_MODE_SYNC_EVENTS, subscribeWindowSyncEvents } from './developer/debugSurfaceState';

function syncDeveloperModeDataset() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.developerMode = isDeveloperModeEnabled() ? 'true' : 'false';
}

function shouldIgnoreToggleTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function useDeveloperModeRuntime() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Cache-test mobile builds should recover from accidentally closing a debug
    // surface. Re-enable developer mode at app startup so /debug last remains
    // usable without a hardware keyboard.
    setDeveloperModeEnabled(true);

    window.__polarisDev = {
      isEnabled: isDeveloperModeEnabled,
      enable: () => setDeveloperModeEnabled(true),
      disable: () => setDeveloperModeEnabled(false),
      toggle: toggleDeveloperMode,
      getRunCodeSandboxProfile,
      unlockRunCodeSandbox,
      lockRunCodeSandbox,
      readAssetGovernanceDebugEntries: async () => {
        const { readAssetGovernanceDebugEntries } = await import('../app/developer/assetGovernanceDebug');
        return readAssetGovernanceDebugEntries();
      },
      clearAssetGovernanceDebugEntries: async () => {
        const { clearAssetGovernanceDebugEntries } = await import('../app/developer/assetGovernanceDebug');
        clearAssetGovernanceDebugEntries();
      },
      readRequestDebugEntries: async () => {
        const { readRequestDebugEntries } = await import('../engines/request/requestDebugRuntime');
        return readRequestDebugEntries();
      },
      clearRequestDebugEntries: async () => {
        const { clearRequestDebugEntries } = await import('../engines/request/requestDebugRuntime');
        clearRequestDebugEntries();
      },
      readChatQaAuditEntries: async () => {
        const { readChatQaAuditEntries } = await import('../app/chat/chatQaAuditRuntime');
        return readChatQaAuditEntries();
      },
      clearChatQaAuditEntries: async () => {
        const { clearChatQaAuditEntries } = await import('../app/chat/chatQaAuditRuntime');
        clearChatQaAuditEntries();
      },
      summarizeChatQaAuditEntries: async () => {
        const { summarizeChatQaAuditEntries } = await import('../app/chat/chatQaAuditRuntime');
        return summarizeChatQaAuditEntries();
      },
      readModelFlowTraceEntries: async () => {
        const { readModelFlowTraceEntries } = await import('../app/chat/modelFlowTraceRuntime');
        return readModelFlowTraceEntries();
      },
      clearModelFlowTraceEntries: async () => {
        const { clearModelFlowTraceEntries } = await import('../app/chat/modelFlowTraceRuntime');
        clearModelFlowTraceEntries();
      },
      summarizeModelFlowTraceEntries: async () => {
        const { summarizeModelFlowTraceEntries } = await import('../app/chat/modelFlowTraceRuntime');
        return summarizeModelFlowTraceEntries();
      },
      readEnvironmentContractQaReports: async () => {
        const { readEnvironmentContractQaReports } = await import('../app/chat/chatEnvironmentContractQa');
        return readEnvironmentContractQaReports();
      },
      clearEnvironmentContractQaReports: async () => {
        const { clearEnvironmentContractQaReports } = await import('../app/chat/chatEnvironmentContractQa');
        clearEnvironmentContractQaReports();
      },
      readLatestEnvironmentContractQaReport: async () => {
        const { readLatestEnvironmentContractQaReport } = await import('../app/chat/chatEnvironmentContractQa');
        return readLatestEnvironmentContractQaReport();
      },
      readRuntimePerformanceEntries: async () => {
        const { readRuntimePerformanceEntries } = await import('../app/developer/runtime-performance/runtimePerformanceLog');
        return readRuntimePerformanceEntries();
      },
      clearRuntimePerformanceEntries: async () => {
        const { clearRuntimePerformanceEntries } = await import('../app/developer/runtime-performance/runtimePerformanceLog');
        clearRuntimePerformanceEntries();
      },
      readLatestPersistenceError: async () => {
        const { readLatestPersistenceError } = await import('../infrastructure/persistenceDiagnostics');
        return readLatestPersistenceError();
      },
      clearLatestPersistenceError: async () => {
        const { clearLatestPersistenceError } = await import('../infrastructure/persistenceDiagnostics');
        clearLatestPersistenceError();
      },
      seedPerformanceScenario: async (options) => {
        if (!import.meta.env.DEV) {
          throw new Error('Performance scenario seeding is only available in development builds.');
        }
        const { seedPerformanceScenario } = await import('../app/developer/performanceScenarioSeed');
        return seedPerformanceScenario(options);
      },
      measurePerformanceScenario: async (options) => {
        if (!import.meta.env.DEV) {
          throw new Error('Performance scenario measurement is only available in development builds.');
        }
        const { measurePerformanceScenario } = await import('../app/developer/performanceScenarioMeasure');
        return measurePerformanceScenario(options);
      },
      pulseScreenshotDebugOverlay,
      snapshot: async () => {
        const [
          { readAssetGovernanceDebugEntries },
          { readRequestDebugEntries },
          { readChatQaAuditEntries, summarizeChatQaAuditEntries },
          { readModelFlowTraceEntries, summarizeModelFlowTraceEntries },
          { readEnvironmentContractQaReports, readLatestEnvironmentContractQaReport },
          { readRuntimePerformanceEntries },
          { readLatestPersistenceError }
        ] = await Promise.all([
          import('../app/developer/assetGovernanceDebug'),
          import('../engines/request/requestDebugRuntime'),
          import('../app/chat/chatQaAuditRuntime'),
          import('../app/chat/modelFlowTraceRuntime'),
          import('../app/chat/chatEnvironmentContractQa'),
          import('../app/developer/runtime-performance/runtimePerformanceLog'),
          import('../infrastructure/persistenceDiagnostics')
        ]);

        return {
          developerMode: isDeveloperModeEnabled(),
          assetGovernanceEntries: readAssetGovernanceDebugEntries(),
          requestEntries: readRequestDebugEntries(),
          chatQaAuditEntries: readChatQaAuditEntries(),
          chatQaAuditSummary: summarizeChatQaAuditEntries(),
          modelFlowTraceEntries: readModelFlowTraceEntries(),
          modelFlowTraceSummary: summarizeModelFlowTraceEntries(),
          environmentContractQaReports: readEnvironmentContractQaReports(),
          latestEnvironmentContractQaReport: readLatestEnvironmentContractQaReport(),
          runtimePerformanceEntries: readRuntimePerformanceEntries(),
          latestPersistenceError: readLatestPersistenceError()
        };
      }
    };
    syncDeveloperModeDataset();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreToggleTarget(event.target)) return;
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== 'd') return;

      event.preventDefault();
      const enabled = toggleDeveloperMode();
      console.info('[polaris-dev]', {
        developerMode: enabled,
        hint: 'Use window.__polarisDev.snapshot() to inspect captured debug entries.'
      });
    };

    const handleModeSync = () => {
      syncDeveloperModeDataset();
    };

    window.addEventListener('keydown', handleKeyDown);
    const unsubscribeModeSyncEvents = subscribeWindowSyncEvents(DEVELOPER_MODE_SYNC_EVENTS, handleModeSync);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribeModeSyncEvents();
    };
  }, []);
}
