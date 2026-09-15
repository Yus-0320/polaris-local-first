import { useCallback, useEffect, useState } from 'react';
import { auditStoredAssets } from '../engines/assetGovernance';
import {
  ASSET_GOVERNANCE_DEBUG_EVENT,
  buildAssetGovernanceDebugEntry,
  clearAssetGovernanceDebugEntries,
  readAssetGovernanceDebugEntries,
  recordAssetGovernanceDebugEntry,
  type AssetGovernanceDebugEntry
} from '../app/developer/assetGovernanceDebug';
import {
  DEVELOPER_DEBUG_ROUTE_SYNC_EVENTS,
  readDebugSurfaceEnabled,
  subscribeWindowSyncEvents
} from './developer/debugSurfaceState';
import { buildStableAssetGovernanceReferences } from '../app/data-work/assetGovernanceReferences';

type AssetGovernanceDebugState = {
  enabled: boolean;
  latestEntry: AssetGovernanceDebugEntry | null;
  entryCount: number;
  clearEntries: () => void;
  refresh: () => Promise<void>;
};

const ASSET_GOVERNANCE_DEBUG_SYNC_EVENTS = [
  ASSET_GOVERNANCE_DEBUG_EVENT,
  ...DEVELOPER_DEBUG_ROUTE_SYNC_EVENTS
] as const;

function readDebugEnabled() {
  // Keep the cache-test mobile build focused on request debugging. Asset audit
  // remains available explicitly through ?debugAssets=1, but enabling developer
  // mode no longer opens a second overlay that blocks the request body on phone.
  return readDebugSurfaceEnabled({ developerMode: false, queryParams: ['debugAssets'] });
}

export function useAssetGovernanceDebugState(): AssetGovernanceDebugState {
  const [state, setState] = useState<Omit<AssetGovernanceDebugState, 'clearEntries' | 'refresh'>>({
    enabled: readDebugEnabled(),
    latestEntry: null,
    entryCount: 0
  });

  const syncState = useCallback(() => {
    const enabled = readDebugEnabled();
    if (!enabled) {
      setState({
        enabled: false,
        latestEntry: null,
        entryCount: 0
      });
      return;
    }

    const entries = readAssetGovernanceDebugEntries();
    setState({
      enabled: true,
      latestEntry: entries[entries.length - 1] ?? null,
      entryCount: entries.length
    });
  }, []);

  useEffect(() => {
    syncState();

    const handleSync = () => syncState();
    const unsubscribeSyncEvents = subscribeWindowSyncEvents(ASSET_GOVERNANCE_DEBUG_SYNC_EVENTS, handleSync);

    return () => {
      unsubscribeSyncEvents();
    };
  }, [syncState]);

  const refresh = useCallback(async () => {
    const audit = await auditStoredAssets(await buildStableAssetGovernanceReferences());

    recordAssetGovernanceDebugEntry(buildAssetGovernanceDebugEntry({
      audit,
      reason: 'manual-refresh'
    }));
    syncState();
  }, [syncState]);

  return {
    ...state,
    clearEntries: () => {
      clearAssetGovernanceDebugEntries();
      syncState();
    },
    refresh
  };
}
