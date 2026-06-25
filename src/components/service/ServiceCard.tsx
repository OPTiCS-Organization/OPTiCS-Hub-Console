import { GitBranch, Package } from "lucide-react";
import type { ContainerCounts, ServiceItem } from "../../interfaces/ServiceItem.interface";
import { statusDot, statusLabel, presetLabel } from "../../constants/service";

function parseSourceRepositories(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => {
        if (typeof entry === 'string') return { url: entry, rootDirectory: null };
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          return {
            url: String(record.url ?? record.sourceUrl ?? ''),
            rootDirectory: record.rootDirectory ? String(record.rootDirectory) : null,
          };
        }
        return { url: '', rootDirectory: null };
      }).filter(entry => entry.url);
    }
  } catch {
    // fall through
  }
  return [{ url: raw, rootDirectory: null }];
}

export default function ServiceCard({ service, containerCounts }: { service: ServiceItem; containerCounts?: ContainerCounts }) {
  const portMappings = service.servicePortMappings && service.servicePortMappings.length > 0
    ? service.servicePortMappings
    : [{ hostPort: service.serviceHostPort ?? service.servicePort, containerPort: service.serviceContainerPort ?? service.servicePort }];
  const sourceRepositories = service.serviceSourceUrl ? parseSourceRepositories(service.serviceSourceUrl) : [];
  const visibleSources = sourceRepositories.slice(0, 2);
  const hiddenSourceCount = Math.max(sourceRepositories.length - visibleSources.length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border-color bg-modal-box-color">
      <div className="px-4 py-4 flex items-start gap-3">
        <div className="relative w-9 h-9 rounded-md bg-white/5 flex items-center justify-center shrink-0">
          <Package className="w-4.5 h-4.5 text-secondary-text-color" />
          <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-modal-box-color ${statusDot[service.serviceStatus]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-primary-text-color font-semibold text-sm truncate">{service.serviceName}</span>
            <span className="text-secondary-text-color/60 text-[10px] shrink-0">{presetLabel[service.serviceDeployPreset]}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className={`font-medium ${service.serviceStatus === 'running' ? 'text-green-400' : service.serviceStatus === 'failed' ? 'text-red-400' : 'text-secondary-text-color'}`}>
              {statusLabel[service.serviceStatus]}
              {service.serviceStatus === 'running' && containerCounts && containerCounts.total > 0 && (
                <span className="text-secondary-text-color/60 ml-0.5">
                  ({containerCounts.running}/{containerCounts.total})
                </span>
              )}
            </span>
            {service.agentCode && (
              <>
                <span className="text-secondary-text-color/40">·</span>
                <span className="font-mono text-secondary-text-color/60">{service.agentCode}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-[54px] flex-col gap-1.5 px-4 pb-3">
        {visibleSources.length > 0 ? (
          <>
            {visibleSources.map((source, i) => (
              <div key={i} className="flex min-w-0 items-center gap-1.5 text-xs text-secondary-text-color/70">
                <GitBranch className="w-3 h-3 shrink-0" />
                <span className="min-w-0 truncate font-mono">
                  {source.url}{source.rootDirectory ? ` / ${source.rootDirectory}` : ''}
                </span>
              </div>
            ))}
            {hiddenSourceCount > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-tertiary-text-color">
                <GitBranch className="w-3 h-3 shrink-0" />
                <span className="font-mono">+{hiddenSourceCount} repositories</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-secondary-text-color/50">
              <GitBranch className="w-3 h-3 shrink-0" />
            <span>소스 없음</span>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border-color px-4 py-2.5">
        <span className="text-secondary-text-color/60 text-[10px] font-mono">v{service.serviceVersion}</span>
        <span className="text-secondary-text-color/60 text-[10px]">
          {portMappings.map(mapping => `:${mapping.hostPort} -> :${mapping.containerPort}`).join(', ')}
        </span>
      </div>
    </div>
  );
}
