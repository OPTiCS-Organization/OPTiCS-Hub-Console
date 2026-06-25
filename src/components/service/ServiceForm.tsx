import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Plus, Server, X } from "lucide-react";
import { apiFetch } from "../../lib/apiFetch";
import { useAuth } from "../../context/Auth.context";
import { useModal } from "../../context/Modal.context";
import { useAgents } from "../../hooks/useAgents";
import type { EnvEntry } from "../../interfaces/EnvEntry.interface";
import type { ServiceItem } from "../../interfaces/ServiceItem.interface";

interface ServiceFormProps {
  mode: 'create' | 'redeploy';
  workspaceIndex: number;
  onSuccess: () => void;
  service?: ServiceItem;
}

type CreateStep = 'source' | 'runtime' | 'env' | 'review';
type PortMappingEntry = {
  hostPort: string;
  containerPort: string;
};
type SourceRepositoryEntry = {
  url: string;
  rootDirectory: string;
};

const createSteps: { key: CreateStep; label: string }[] = [
  { key: 'source', label: '소스' },
  { key: 'runtime', label: '설정' },
  { key: 'env', label: '환경 변수' },
  { key: 'review', label: '확인' },
];

const compactInputCls = "h-8 w-full rounded-sm border border-border-color bg-modal-box-color px-2.5 text-xs text-primary-text-color placeholder:text-secondary-text-color/40 outline-none transition-colors duration-100 focus:border-service-color";
const compactValidInputCls = "border-success-color/60 bg-success-color/5";
const compactLabelCls = "text-[10px] font-medium uppercase tracking-wider text-secondary-text-color";

function normalizeRootDirectory(value?: string | null) {
  return (value ?? '').trim().replace(/^\/+/, '');
}

function parseSourceRepositories(raw?: string, fallbackRootDirectory?: string | null): SourceRepositoryEntry[] {
  if (!raw) return [{ url: '', rootDirectory: normalizeRootDirectory(fallbackRootDirectory) }];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const entries = parsed.map((entry): SourceRepositoryEntry => {
        if (typeof entry === 'string') {
          return { url: entry, rootDirectory: '' };
        }
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          return {
            url: String(record.url ?? record.sourceUrl ?? ''),
            rootDirectory: normalizeRootDirectory(String(record.rootDirectory ?? '')),
          };
        }
        return { url: '', rootDirectory: '' };
      });
      return entries.length > 0 ? entries : [{ url: '', rootDirectory: '' }];
    }
    return [{ url: raw, rootDirectory: normalizeRootDirectory(fallbackRootDirectory) }];
  } catch {
    return [{ url: raw, rootDirectory: normalizeRootDirectory(fallbackRootDirectory) }];
  }
}

function parseEnvClipboard(text: string): EnvEntry[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.startsWith('export ') ? line.slice(7).trim() : line)
    .map(line => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) return null;

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      const value = rawValue.length >= 2 && (
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
      )
        ? rawValue.slice(1, -1)
        : rawValue;

      return key ? { key, value } : null;
    })
    .filter((entry): entry is EnvEntry => entry !== null);
}

function isValidPort(value: string) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isValidGithubRepoUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return false;
    if (url.hostname.toLowerCase() !== 'github.com') return false;
    const segments = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (segments.length !== 2) return false;
    return /^[A-Za-z0-9_.-]+$/.test(segments[0]) && /^[A-Za-z0-9_.-]+(?:\.git)?$/.test(segments[1]);
  } catch {
    return false;
  }
}

function initialPortMappings(service?: ServiceItem): PortMappingEntry[] {
  const mappings = service?.servicePortMappings;
  if (mappings && mappings.length > 0) {
    return mappings.map(mapping => ({
      hostPort: String(mapping.hostPort),
      containerPort: String(mapping.containerPort),
    }));
  }

  return [{
    hostPort: service ? String(service.serviceHostPort ?? service.servicePort) : '',
    containerPort: service ? String(service.serviceContainerPort ?? service.servicePort) : '',
  }];
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5 border-b border-border-color/50 py-2 last:border-0">
      <span className="text-xs text-secondary-text-color">{label}</span>
      <div className="min-w-0 text-xs text-primary-text-color">{value}</div>
    </div>
  );
}

export default function ServiceForm({ mode, workspaceIndex, onSuccess, service }: ServiceFormProps) {
  const { logout } = useAuth();
  const { closeModal, setCloseGuard } = useModal();
  const agents = useAgents(workspaceIndex, logout);

  const [form, setForm] = useState({
    serviceName: service?.serviceName ?? '',
    serviceHostPort: service ? String(service.serviceHostPort ?? service.servicePort) : '',
    serviceContainerPort: service ? String(service.serviceContainerPort ?? service.servicePort) : '',
    serviceRootDirectory: service?.serviceRootDirectory ?? '',
    serviceVersion: service?.serviceVersion ?? '1.0.0',
    serviceDeployPreset: (service?.serviceDeployPreset ?? 'dockerfile') as string,
    agentIndex: service ? String(service.agentIndex) : '',
  });
  const [sourceRepositories, setSourceRepositories] = useState<SourceRepositoryEntry[]>(
    () => parseSourceRepositories(service?.serviceSourceUrl, service?.serviceRootDirectory),
  );
  const [portMappings, setPortMappings] = useState<PortMappingEntry[]>(() => initialPortMappings(service));
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>(() => {
    const entries = Object.entries(service?.serviceEnv ?? {}).map(([key, value]) => ({ key, value }));
    return entries.length > 0 ? entries : [{ key: '', value: '' }];
  });
  const [currentStep, setCurrentStep] = useState<CreateStep>('source');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!form.agentIndex && agents.length > 0) {
      setForm(f => ({ ...f, agentIndex: String(agents[0].agentIndex) }));
    }
  }, [agents, form.agentIndex]);

  const isCompose = form.serviceDeployPreset === 'compose';
  const isCreateMode = mode === 'create';
  const currentStepIndex = createSteps.findIndex(step => step.key === currentStep);
  const selectedAgent = agents.find(agent => String(agent.agentIndex) === form.agentIndex);
  const envWithKeys = envEntries.filter(entry => entry.key.trim());
  const initialDirtySnapshot = useMemo(() => JSON.stringify({
    form: {
      serviceName: service?.serviceName ?? '',
      serviceRootDirectory: service?.serviceRootDirectory ?? '',
      serviceVersion: service?.serviceVersion ?? '1.0.0',
      serviceDeployPreset: service?.serviceDeployPreset ?? 'dockerfile',
      agentIndex: service ? String(service.agentIndex) : '',
    },
    sourceRepositories: parseSourceRepositories(service?.serviceSourceUrl, service?.serviceRootDirectory),
    portMappings: initialPortMappings(service),
    envEntries: Object.entries(service?.serviceEnv ?? {}).map(([key, value]) => ({ key, value })),
  }), [service]);
  const currentDirtySnapshot = useMemo(() => JSON.stringify({
    form: {
      serviceName: form.serviceName,
      serviceRootDirectory: form.serviceRootDirectory,
      serviceVersion: form.serviceVersion,
      serviceDeployPreset: form.serviceDeployPreset,
      agentIndex: form.agentIndex,
    },
    sourceRepositories,
    portMappings,
    envEntries: envEntries.filter(entry => entry.key.trim() || entry.value.trim()),
  }), [envEntries, form, portMappings, sourceRepositories]);
  const hasCreateInput = useMemo(() => (
    form.serviceName.trim() !== '' ||
    form.serviceRootDirectory.trim() !== '' ||
    form.serviceVersion.trim() !== '1.0.0' ||
    form.serviceDeployPreset !== 'dockerfile' ||
    sourceRepositories.some(repo => repo.url.trim() !== '' || repo.rootDirectory.trim() !== '') ||
    portMappings.some(mapping => mapping.hostPort.trim() !== '' || mapping.containerPort.trim() !== '') ||
    envEntries.some(entry => entry.key.trim() !== '' || entry.value.trim() !== '')
  ), [envEntries, form, portMappings, sourceRepositories]);
  const shouldConfirmClose = isCreateMode
    ? hasCreateInput
    : currentDirtySnapshot !== initialDirtySnapshot;
  const duplicateEnvKeys = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    envWithKeys.forEach(entry => {
      const key = entry.key.trim();
      if (seen.has(key)) duplicates.add(key);
      seen.add(key);
    });
    return Array.from(duplicates);
  }, [envWithKeys]);

  useEffect(() => {
    setCloseGuard(() => shouldConfirmClose);
    return () => setCloseGuard(null);
  }, [setCloseGuard, shouldConfirmClose]);

  function set(key: keyof typeof form, value: string) {
    setError(null);
    setForm(f => ({ ...f, [key]: value }));
  }

  function updateSourceRepository(index: number, field: keyof SourceRepositoryEntry, value: string) {
    setError(null);
    const normalizedValue = field === 'rootDirectory' ? normalizeRootDirectory(value) : value;
    setSourceRepositories(prev => prev.map((repo, i) => i === index ? { ...repo, [field]: normalizedValue } : repo));
  }

  function addSourceRepository() { setSourceRepositories(prev => [...prev, { url: '', rootDirectory: '' }]); }
  function removeSourceRepository(index: number) {
    setSourceRepositories(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ url: '', rootDirectory: '' }];
    });
  }
  function addPortMapping() { setPortMappings(prev => [...prev, { hostPort: '', containerPort: '' }]); }
  function updatePortMapping(index: number, field: keyof PortMappingEntry, value: string) {
    setError(null);
    setPortMappings(prev => prev.map((mapping, i) => i === index ? { ...mapping, [field]: value } : mapping));
  }
  function removePortMapping(index: number) {
    setPortMappings(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ hostPort: '', containerPort: '' }];
    });
  }
  function addEnvEntry() { setEnvEntries(prev => [...prev, { key: '', value: '' }]); }
  function updateEnvEntry(index: number, field: 'key' | 'value', value: string) {
    setError(null);
    setEnvEntries(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  }
  function removeEnvEntry(index: number) {
    setEnvEntries(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ key: '', value: '' }];
    });
  }

  function handleEnvPaste(e: React.ClipboardEvent<HTMLInputElement>, index: number) {
    const parsedEntries = parseEnvClipboard(e.clipboardData.getData('text'));
    if (parsedEntries.length === 0) return;

    e.preventDefault();
    setError(null);
    setEnvEntries(prev => {
      const next = [...prev];
      next.splice(index, parsedEntries.length, ...parsedEntries);
      return next;
    });
  }

  function getStepError(step: CreateStep) {
    if (step === 'source') {
      if (!form.serviceName.trim()) return '서비스명을 입력해주세요.';
      if (!sourceRepositories[0]?.url.trim()) return '소스 URL을 입력해주세요.';
      const invalidUrl = sourceRepositories.map(repo => repo.url.trim()).filter(Boolean).find(url => !isValidGithubRepoUrl(url));
      if (invalidUrl) return 'GitHub 레포 URL은 https://github.com/owner/repo 형식이어야 합니다.';
    }

    if (step === 'runtime') {
      for (const mapping of portMappings) {
        if (!isValidPort(mapping.hostPort)) return '외부 포트는 1-65535 사이 숫자로 입력해주세요.';
        if (!isValidPort(mapping.containerPort)) return '내부 포트는 1-65535 사이 숫자로 입력해주세요.';
      }
      const hostPorts = portMappings.map(mapping => mapping.hostPort.trim());
      const containerPorts = portMappings.map(mapping => mapping.containerPort.trim());
      if (new Set(hostPorts).size !== hostPorts.length) return '외부 포트가 중복되었습니다.';
      if (new Set(containerPorts).size !== containerPorts.length) return '내부 포트가 중복되었습니다.';
      if (!form.serviceVersion.trim()) return '버전을 입력해주세요.';
      if (agents.length === 0) return '연결된 에이전트가 없습니다.';
      if (!form.agentIndex) return '배포할 에이전트를 선택해주세요.';
    }

    if (step === 'env' && duplicateEnvKeys.length > 0) {
      return `중복된 환경 변수 키가 있습니다: ${duplicateEnvKeys.join(', ')}`;
    }

    return null;
  }

  function goToStep(step: CreateStep) {
    const targetIndex = createSteps.findIndex(item => item.key === step);
    if (targetIndex <= currentStepIndex) {
      setError(null);
      setCurrentStep(step);
      return;
    }

    for (let i = 0; i < targetIndex; i += 1) {
      const stepError = getStepError(createSteps[i].key);
      if (stepError) {
        setError(stepError);
        setCurrentStep(createSteps[i].key);
        return;
      }
    }

    setError(null);
    setCurrentStep(step);
  }

  function goNext() {
    const stepError = getStepError(currentStep);
    if (stepError) {
      setError(stepError);
      return;
    }

    const nextStep = createSteps[currentStepIndex + 1];
    if (nextStep) {
      setError(null);
      setCurrentStep(nextStep.key);
    }
  }

  function goBack() {
    const previousStep = createSteps[currentStepIndex - 1];
    if (previousStep) {
      setError(null);
      setCurrentStep(previousStep.key);
    }
  }

  async function handleDeploy() {
    if (isCreateMode && currentStep !== 'review') {
      return;
    }

    const validationSteps = isCreateMode ? createSteps.map(step => step.key) : (['source', 'runtime', 'env'] as CreateStep[]);
    for (const step of validationSteps) {
      const stepError = getStepError(step);
      if (stepError) {
        setError(stepError);
        if (isCreateMode) setCurrentStep(step);
        return;
      }
    }

    setLoading(true);
    setError(null);

    const cleanedSourceRepositories = sourceRepositories
      .map(repo => ({
        url: repo.url.trim(),
        rootDirectory: normalizeRootDirectory(repo.rootDirectory),
      }))
      .filter(repo => repo.url);
    const primaryRootDirectory = cleanedSourceRepositories[0]?.rootDirectory ?? '';
    const sourceUrl = cleanedSourceRepositories.length === 1 && !primaryRootDirectory
      ? cleanedSourceRepositories[0].url
      : cleanedSourceRepositories;
    const env = Object.fromEntries(envWithKeys.map(entry => [entry.key.trim(), entry.value]));
    const parsedPortMappings = portMappings.map(mapping => ({
      hostPort: parseInt(mapping.hostPort, 10),
      containerPort: parseInt(mapping.containerPort, 10),
    }));
    const primaryPortMapping = parsedPortMappings[0];
    const serviceRootDirectory = primaryRootDirectory;

    const url = mode === 'create'
      ? '/v1/workspace/services/deploy'
      : `/v1/workspace/services/${service!.serviceIndex}/redeploy`;

    const body = mode === 'create'
      ? {
        workspaceIdx: workspaceIndex,
        serviceName: form.serviceName.trim(),
        servicePort: primaryPortMapping.hostPort,
        serviceHostPort: primaryPortMapping.hostPort,
        serviceContainerPort: primaryPortMapping.containerPort,
        servicePortMappings: parsedPortMappings,
        serviceSourceUrl: sourceUrl,
        ...(serviceRootDirectory && { serviceRootDirectory }),
        serviceVersion: form.serviceVersion.trim(),
        serviceDeployPreset: form.serviceDeployPreset,
        agentIndex: parseInt(form.agentIndex, 10),
        env,
      }
      : {
        serviceName: form.serviceName.trim(),
        servicePort: primaryPortMapping.hostPort,
        serviceHostPort: primaryPortMapping.hostPort,
        serviceContainerPort: primaryPortMapping.containerPort,
        servicePortMappings: parsedPortMappings,
        serviceSourceUrl: sourceUrl,
        serviceRootDirectory,
        serviceVersion: form.serviceVersion.trim(),
        serviceDeployPreset: form.serviceDeployPreset,
        agentIndex: parseInt(form.agentIndex, 10),
        env,
      };

    try {
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, logout);
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        setError(data.message ?? 'Failed.');
        return;
      }
      onSuccess();
      closeModal({ force: true });
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  function renderSourceFields() {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_150px]">
          <div className="flex flex-col gap-1.5">
            <label className={compactLabelCls}>서비스명 <span className="text-service-color">*</span></label>
            <input className={compactInputCls} placeholder="my-service" value={form.serviceName} onChange={e => set('serviceName', e.target.value)} autoFocus required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={compactLabelCls}>프리셋 <span className="text-service-color">*</span></label>
            <select className={compactInputCls} value={form.serviceDeployPreset} onChange={e => set('serviceDeployPreset', e.target.value)}>
              <option value="dockerfile">Dockerfile</option>
              <option value="compose">Compose</option>
              <option value="preset_nestjs">NestJS</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2.5">
            <label className={compactLabelCls}>소스 URL <span className="text-service-color">*</span></label>
            <button type="button" onClick={addSourceRepository} className="flex items-center gap-1 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer">
              <Plus className="w-3 h-3" />
              레포지토리 추가
            </button>
          </div>
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
            {sourceRepositories.map((repo, i) => (
              <div key={i} className="optics-row-in rounded-sm border border-border-color/70 bg-modal-box-color/55 p-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-tertiary-text-color">Repository {i + 1}</span>
                  {sourceRepositories.length > 1 && (
                    <button type="button" onClick={() => removeSourceRepository(i)} className="text-secondary-text-color hover:text-red-400 transition-colors cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <div className="relative min-w-0">
                    <input
                      className={`${compactInputCls} pr-8 ${repo.url.trim() && isValidGithubRepoUrl(repo.url) ? compactValidInputCls : ''}`}
                      placeholder="https://github.com/owner/repo"
                      value={repo.url}
                      onChange={e => updateSourceRepository(i, 'url', e.target.value)}
                      required={i === 0}
                    />
                    {repo.url.trim() && isValidGithubRepoUrl(repo.url) && (
                      <Check className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-success-color" />
                    )}
                  </div>
                  <input
                    className={compactInputCls}
                    placeholder="루트 디렉터리 (예: apps/api)"
                    value={repo.rootDirectory}
                    onChange={e => updateSourceRepository(i, 'rootDirectory', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-secondary-text-color">루트 디렉터리는 앞의 /를 제거해서 저장됩니다.</p>
        </div>
      </div>
    );
  }

  function renderRuntimeFields() {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={compactLabelCls}>배포 대상 에이전트 <span className="text-service-color">*</span></label>
          {agents.length === 0 ? (
            <p className="rounded-sm border border-border-color bg-modal-box-color px-3 py-2 text-xs text-secondary-text-color">연결된 에이전트가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {agents.map(agent => {
                const selected = form.agentIndex === String(agent.agentIndex);
                return (
                  <button
                    key={agent.agentIndex}
                    type="button"
                    onClick={() => set('agentIndex', String(agent.agentIndex))}
                    className={`flex min-w-0 items-center gap-2 rounded-sm border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-service-color bg-service-color/10 text-primary-text-color'
                        : 'border-border-color bg-modal-box-color text-secondary-text-color hover:border-border-strong-color hover:text-primary-text-color'
                    }`}
                  >
                    <Server className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-service-color' : 'text-tertiary-text-color'}`} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{agent.agentName}</span>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-service-color" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2.5">
            <label className={compactLabelCls}>포트 매핑 <span className="text-service-color">*</span></label>
            <button type="button" onClick={addPortMapping} className="flex items-center gap-1 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer">
              <Plus className="w-3 h-3" />
              추가
            </button>
          </div>
          <div className="flex max-h-32 flex-col gap-1.5 overflow-y-auto pr-1">
            {portMappings.map((mapping, index) => (
              <div key={index} className="optics-row-in grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18px] items-center gap-2">
                <input
                  className={compactInputCls}
                  placeholder="외부 포트"
                  type="number"
                  min={1}
                  max={65535}
                  value={mapping.hostPort}
                  onChange={e => updatePortMapping(index, 'hostPort', e.target.value)}
                  required
                />
                <input
                  className={compactInputCls}
                  placeholder="내부 포트"
                  type="number"
                  min={1}
                  max={65535}
                  value={mapping.containerPort}
                  onChange={e => updatePortMapping(index, 'containerPort', e.target.value)}
                  required
                />
                <button type="button" onClick={() => removePortMapping(index)} className="text-secondary-text-color hover:text-red-400 transition-colors cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-secondary-text-color">
            {isCompose ? 'Compose 배포는 compose 파일의 ports 설정이 우선 적용됩니다.' : '외부 포트가 컨테이너 내부 포트로 연결됩니다.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className={compactLabelCls}>버전 <span className="text-service-color">*</span></label>
            <input className={compactInputCls} placeholder="1.0.0" value={form.serviceVersion} onChange={e => set('serviceVersion', e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={compactLabelCls}>선택된 에이전트</label>
            <div className="flex h-8 items-center rounded-sm border border-border-color bg-modal-box-color px-2.5 text-xs text-secondary-text-color">
              <span className="truncate">{selectedAgent?.agentName ?? '미선택'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderEnvFields() {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2.5">
          <label className={compactLabelCls}>환경 변수</label>
          <button type="button" onClick={addEnvEntry} className="flex items-center gap-1 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer">
            <Plus className="w-3 h-3" />
            추가
          </button>
        </div>
        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1">
          {envEntries.map((entry, i) => (
            <div key={i} className="optics-row-in grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18px] items-center gap-2">
              <input
                className={compactInputCls}
                placeholder="KEY"
                value={entry.key}
                onChange={e => updateEnvEntry(i, 'key', e.target.value)}
                onPaste={e => handleEnvPaste(e, i)}
              />
              <input
                className={compactInputCls}
                placeholder="VALUE"
                value={entry.value}
                onChange={e => updateEnvEntry(i, 'value', e.target.value)}
                onPaste={e => handleEnvPaste(e, i)}
              />
              <button type="button" onClick={() => removeEnvEntry(i)} className="text-secondary-text-color hover:text-red-400 transition-colors cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-secondary-text-color">
          .env 내용을 붙여넣으면 여러 줄이 자동으로 입력됩니다.
        </p>
      </div>
    );
  }

  function renderReview() {
    const repositories = sourceRepositories
      .map(repo => ({ url: repo.url.trim(), rootDirectory: normalizeRootDirectory(repo.rootDirectory) }))
      .filter(repo => repo.url);
    return (
      <div className="optics-panel-in rounded-sm border border-border-color bg-modal-box-color px-3 py-1">
        <SummaryRow label="서비스명" value={form.serviceName.trim() || <span className="text-secondary-text-color">미입력</span>} />
        <SummaryRow label="소스" value={
          <div className="flex flex-col gap-1">
            {repositories.map(repo => (
              <span key={`${repo.url}:${repo.rootDirectory}`} className="truncate font-mono text-[11px] text-secondary-text-color">
                {repo.url}{repo.rootDirectory ? ` / ${repo.rootDirectory}` : ''}
              </span>
            ))}
          </div>
        } />
        <SummaryRow label="프리셋" value={form.serviceDeployPreset} />
        <SummaryRow label="포트" value={
          <div className="flex flex-col gap-1 font-mono">
            {portMappings.map(mapping => (
              <span key={`${mapping.hostPort}:${mapping.containerPort}`}>:{mapping.hostPort} -&gt; :{mapping.containerPort}</span>
            ))}
          </div>
        } />
        <SummaryRow label="버전" value={`v${form.serviceVersion.trim()}`} />
        <SummaryRow label="에이전트" value={selectedAgent?.agentName ?? <span className="text-secondary-text-color">미선택</span>} />
        <SummaryRow label="환경 변수" value={`${envWithKeys.length}개`} />
      </div>
    );
  }

  function renderCreateStep() {
    if (currentStep === 'source') return renderSourceFields();
    if (currentStep === 'runtime') return renderRuntimeFields();
    if (currentStep === 'env') return renderEnvFields();
    return renderReview();
  }

  function renderRedeployFields() {
    return (
      <>
        {renderSourceFields()}
        {renderRuntimeFields()}
        {renderEnvFields()}
      </>
    );
  }

  const submitLabel = mode === 'create' ? '배포 시작' : '재배포';
  const isReviewStep = !isCreateMode || currentStep === 'review';

  return (
    <form onSubmit={e => e.preventDefault()} className="flex flex-col gap-3.5">
      {isCreateMode && (
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-tertiary-text-color">
                Step {currentStepIndex + 1} / {createSteps.length}
              </span>
              <p className="mt-0.5 text-[13px] font-semibold text-primary-text-color">
                {createSteps[currentStepIndex].label}
              </p>
            </div>
            <div className="hidden items-center gap-1 text-[11px] text-tertiary-text-color sm:flex">
              {createSteps.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => goToStep(step.key)}
                  className={`px-1.5 py-0.5 transition-colors cursor-pointer ${
                    index === currentStepIndex
                      ? 'text-primary-text-color'
                      : index < currentStepIndex
                        ? 'text-secondary-text-color hover:text-primary-text-color'
                        : 'text-tertiary-text-color hover:text-secondary-text-color'
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {createSteps.map((step, index) => (
              <button
                key={step.key}
                type="button"
                onClick={() => goToStep(step.key)}
                aria-label={step.label}
                className={`h-1.5 rounded-full transition-colors cursor-pointer ${
                  index < currentStepIndex
                    ? 'bg-service-color'
                    : index === currentStepIndex
                      ? 'optics-step-active bg-service-color'
                      : 'bg-border-color hover:bg-border-strong-color'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div key={isCreateMode ? currentStep : 'redeploy'} className="optics-panel-in min-h-[218px]">
        {isCreateMode ? renderCreateStep() : renderRedeployFields()}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border-color pt-4">
        <button
          type="button"
          onClick={isCreateMode && currentStepIndex > 0 ? goBack : () => closeModal()}
          disabled={loading}
          className="flex h-8 items-center gap-1.5 rounded-sm border border-border-color px-3 text-xs text-secondary-text-color hover:border-border-color/80 hover:bg-white/5 hover:text-primary-text-color transition-colors duration-100 cursor-pointer disabled:opacity-50"
        >
          {isCreateMode && currentStepIndex > 0 && <ChevronLeft className="h-3.5 w-3.5" />}
          {isCreateMode && currentStepIndex > 0 ? '이전' : 'Cancel'}
        </button>

        {isReviewStep ? (
          <button
            type="button"
            onClick={() => { void handleDeploy(); }}
            disabled={loading || agents.length === 0}
            className="flex h-8 items-center gap-2 rounded-sm bg-service-color px-3.5 text-xs font-semibold text-white hover:opacity-80 transition-opacity duration-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="flex h-8 items-center gap-1.5 rounded-sm bg-service-color px-3.5 text-xs font-semibold text-white hover:opacity-80 transition-opacity duration-100 cursor-pointer"
          >
            다음
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </form>
  );
}
