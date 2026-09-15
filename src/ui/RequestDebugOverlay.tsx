import { useEffect, useMemo, useState } from 'react';
import type { RequestDebugEntry } from '../engines/request/requestDebugRuntime';

type RequestDebugOverlayProps = {
  enabled: boolean;
  latestEntry: RequestDebugEntry | null;
  entryCount: number;
  clearEntries: () => void;
  onClose: () => void;
};

type JsonRecord = Record<string, unknown>;

function formatTimestamp(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function shortHash(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function summarizeText(text: string) {
  return {
    chars: text.length,
    hash: shortHash(text)
  };
}

function summarizeContentBlock(value: unknown): unknown {
  if (typeof value === 'string') {
    return {
      type: 'text',
      ...summarizeText(value)
    };
  }

  const record = asRecord(value);
  if (!record) {
    return {
      type: Array.isArray(value) ? 'array' : typeof value
    };
  }

  const summary: JsonRecord = {
    type: typeof record.type === 'string' ? record.type : 'object'
  };

  if ('cache_control' in record) summary.cache_control = record.cache_control;
  if ('cacheControl' in record) summary.cacheControl = record.cacheControl;
  if (typeof record.text === 'string') Object.assign(summary, summarizeText(record.text));
  if (typeof record.content === 'string') {
    summary.content = summarizeText(record.content);
  } else if (Array.isArray(record.content)) {
    summary.content = record.content.map(summarizeContentBlock);
  }
  if (typeof record.name === 'string') summary.name = record.name;
  if (typeof record.id === 'string') summary.id = record.id;
  if (typeof record.tool_use_id === 'string') summary.tool_use_id = record.tool_use_id;
  if (typeof record.role === 'string') summary.role = record.role;

  return summary;
}

function summarizeContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(summarizeContentBlock);
  return summarizeContentBlock(value);
}

function summarizeMessages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((message, index) => {
    const record = asRecord(message);
    if (!record) return { index, type: typeof message };
    return {
      index,
      role: typeof record.role === 'string' ? record.role : 'unknown',
      content: summarizeContent(record.content),
      cache_control: record.cache_control ?? undefined
    };
  });
}

function summarizeTools(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((tool, index) => {
    const record = asRecord(tool);
    const serialized = JSON.stringify(tool);
    if (!record) {
      return {
        index,
        hash: shortHash(serialized)
      };
    }
    return {
      index,
      name: typeof record.name === 'string' ? record.name : `tool-${index + 1}`,
      hash: shortHash(serialized),
      cache_control: record.cache_control ?? undefined
    };
  });
}

function collectCacheControlPaths(
  value: unknown,
  path = '$',
  output: string[] = [],
  depth = 0
) {
  if (depth > 10 || value === null || typeof value !== 'object') return output;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectCacheControlPaths(item, `${path}[${index}]`, output, depth + 1);
    });
    return output;
  }

  Object.entries(value as JsonRecord).forEach(([key, item]) => {
    if (key === 'cache_control' || key === 'cacheControl') {
      output.push(`${path}.${key}=${JSON.stringify(item)}`);
      return;
    }
    if (key === 'input_schema' || key === 'parameters') return;
    collectCacheControlPaths(item, `${path}.${key}`, output, depth + 1);
  });
  return output;
}

function buildOutboundDiagnostic(body: JsonRecord) {
  const scalarKeys = [
    'model',
    'max_tokens',
    'stream',
    'temperature',
    'top_p',
    'top_k',
    'tool_choice',
    'prompt_cache_key'
  ];
  const scalars = scalarKeys.reduce<JsonRecord>((result, key) => {
    if (key in body) result[key] = body[key];
    return result;
  }, {});
  const cacheControlPaths = collectCacheControlPaths(body);

  return {
    body_keys: Object.keys(body),
    ...scalars,
    cache_control_count: cacheControlPaths.length,
    cache_control_paths: cacheControlPaths,
    system: summarizeContent(body.system),
    messages: summarizeMessages(body.messages),
    tools: summarizeTools(body.tools)
  };
}

function formatUsageDebugLine(usage: RequestDebugEntry['responseSummary']['tokenUsage']) {
  if (!usage) return 'none';
  const parts = [
    usage.inputTokens ? `in ${usage.inputTokens}` : '',
    usage.outputTokens ? `out ${usage.outputTokens}` : '',
    usage.cachedInputTokens ? `cached ${usage.cachedInputTokens}` : '',
    usage.cacheMissInputTokens ? `miss ${usage.cacheMissInputTokens}` : '',
    usage.cacheCreationInputTokens ? `write ${usage.cacheCreationInputTokens}` : ''
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'reported';
}

export function RequestDebugOverlay({
  enabled,
  latestEntry,
  entryCount,
  clearEntries
}: RequestDebugOverlayProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (enabled) setDismissed(false);
  }, [enabled, latestEntry?.requestId, latestEntry?.at]);

  const outboundDiagnostic = useMemo(() => {
    const outbound = latestEntry?.outboundRequest;
    if (!outbound) return null;
    return buildOutboundDiagnostic(outbound.body);
  }, [latestEntry?.outboundRequest]);

  if (!enabled || dismissed) return null;

  const cacheApplication = latestEntry?.inspector.cache.requestApplication;
  const cacheBreakpointText = latestEntry?.inspector.cache.breakpoints
    .map((breakpoint) => `${breakpoint.name.replace('_prefix', '')} ${breakpoint.eligible ? 'eligible' : breakpoint.reason ?? 'off'}`)
    .join(' · ');
  const outboundRequestBody = latestEntry?.outboundRequest?.body
    ? JSON.stringify(latestEntry.outboundRequest.body, null, 2)
    : null;

  const overlayStyle = {
    position: 'fixed',
    zIndex: 100,
    top: 'max(8px, env(safe-area-inset-top, 0px))',
    right: '8px',
    bottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
    left: '8px',
    display: 'block',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    touchAction: 'pan-y',
    padding: '10px 12px 18px',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '14px',
    background: 'rgba(15,18,27,.96)',
    color: '#f7f9ff',
    font: "11px/1.45 'SF Mono','Fira Code',monospace",
    boxShadow: '0 12px 28px rgba(0,0,0,.3)'
  } as const;

  const rowStyle = {
    display: 'block',
    marginTop: '3px',
    overflowWrap: 'anywhere'
  } as const;

  const preStyle = {
    margin: '8px 0 12px',
    padding: '10px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,.06)',
    color: '#f7f9ff',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    font: 'inherit'
  } as const;

  return (
    <aside className="request-debug-overlay" style={overlayStyle}>
      <div
        className="request-debug-header"
        style={{
          position: 'sticky',
          top: '-10px',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '8px 0',
          background: 'rgba(15,18,27,.98)'
        }}
      >
        <strong>request debug · mobile</strong>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button type="button" onClick={clearEntries}>clear</button>
          <button
            type="button"
            className="debug-overlay-close-button"
            onClick={() => setDismissed(true)}
            aria-label="隐藏 request debug"
            title="只隐藏面板，不关闭开发者模式"
          >×</button>
        </div>
      </div>

      {latestEntry ? (
        <>
          <span style={rowStyle}>{formatTimestamp(latestEntry.at)}</span>
          <span style={rowStyle}>{`phase ${latestEntry.phase}`}</span>
          <span style={rowStyle}>{`${latestEntry.assistantName} · ${latestEntry.modelId}`}</span>
          <span style={rowStyle}>{`entries ${entryCount}`}</span>
          <span style={rowStyle}>{`cache ${cacheApplication?.status ?? 'none'}${cacheApplication?.sendsExplicitCacheControl ? ' · sent' : ''}`}</span>
          <span style={rowStyle}>{`cache bp ${cacheBreakpointText || 'none'}`}</span>
          <span style={rowStyle}>{`tools ${latestEntry.tooling.toolCount}${latestEntry.tooling.toolChoice ? ` · ${latestEntry.tooling.toolChoice}` : ''}`}</span>
          <span style={rowStyle}>{`usage ${formatUsageDebugLine(latestEntry.responseSummary.tokenUsage)}`}</span>
          <span style={rowStyle}>{latestEntry.responseSummary.error ? `error ${latestEntry.responseSummary.error.slice(0, 120)}` : 'error none'}</span>

          {latestEntry.outboundRequest && outboundDiagnostic ? (
            <section style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,.12)' }}>
              <strong style={rowStyle}>CACHE OUTBOUND DIAGNOSTIC</strong>
              <span style={rowStyle}>{`provider ${latestEntry.outboundRequest.provider} · ${latestEntry.outboundRequest.compatibilityMode}`}</span>
              <span style={rowStyle}>{latestEntry.outboundRequest.endpoint}</span>
              <pre style={preStyle}>{JSON.stringify(outboundDiagnostic, null, 2)}</pre>

              <details style={{ marginBottom: '16px' }}>
                <summary style={{ cursor: 'pointer' }}>raw outbound body（一般不用展开）</summary>
                {outboundRequestBody ? (
                  <pre
                    style={{
                      ...preStyle,
                      maxHeight: '42dvh',
                      overflow: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      touchAction: 'pan-y'
                    }}
                  >
                    {outboundRequestBody}
                  </pre>
                ) : null}
              </details>
            </section>
          ) : (
            <span style={rowStyle}>outbound none</span>
          )}
        </>
      ) : (
        <span style={rowStyle}>no request captured</span>
      )}
    </aside>
  );
}
