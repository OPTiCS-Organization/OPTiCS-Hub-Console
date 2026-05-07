import { GitBranch, Package } from "lucide-react";
import type { ServiceItem } from "../../interfaces/ServiceItem.interface";
import { statusDot, statusLabel, presetLabel } from "../../constants/service";

export default function ServiceCard({ service }: { service: ServiceItem }) {
  return (
    <div className="border border-border-color rounded-md bg-modal-box-color overflow-hidden">
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

      <div className="px-4 pb-3 flex flex-col gap-1.5">
        {service.serviceSourceUrl && (() => {
          let urls: string[];
          try { urls = JSON.parse(service.serviceSourceUrl); if (!Array.isArray(urls)) urls = [service.serviceSourceUrl]; }
          catch { urls = [service.serviceSourceUrl]; }
          return urls.map((url, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-secondary-text-color/70">
              <GitBranch className="w-3 h-3 shrink-0" />
              <span className="font-mono truncate">{url}</span>
            </div>
          ));
        })()}
      </div>

      <div className="px-4 py-2.5 border-t border-border-color flex items-center justify-between">
        <span className="text-secondary-text-color/60 text-[10px] font-mono">v{service.serviceVersion}</span>
        <span className="text-secondary-text-color/60 text-[10px]">
          :{service.serviceHostPort ?? service.servicePort}
          {(service.serviceContainerPort ?? service.servicePort) !== (service.serviceHostPort ?? service.servicePort)
            ? ` -> :${service.serviceContainerPort ?? service.servicePort}`
            : ''}
        </span>
      </div>
    </div>
  );
}
