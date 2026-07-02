import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, GitBranch, Globe, Loader2, Plus, Server, X } from "lucide-react";
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
type EndpointEntry = {
  componentName: string;
  subdomain: string;
  hostPort: string;
  containerPort: string;
};
type ServiceEndpointPayload = {
  componentName: string;
  subdomain: string | null;
  hostPort: number;
  containerPort: number;
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

const stepMeta: Record<CreateStep, { title: string; description: string }> = {
  source: {
    title: '소스 연결',
    description: '서비스 이름과 배포할 GitHub 레포지토리를 지정합니다.',
  },
  runtime: {
    title: '배포 설정',
    description: '에이전트, 포트, 버전처럼 실행에 필요한 값을 정리합니다.',
  },
  env: {
    title: '환경 변수',
    description: '.env 내용을 붙여넣거나 필요한 키를 직접 추가합니다.',
  },
  review: {
    title: '최종 확인',
    description: '입력한 내용을 확인한 뒤 배포를 시작합니다.',
  },
};

const compactInputCls = "h-9 w-full rounded-sm border border-border-color bg-background-color px-2.5 text-xs text-primary-text-color placeholder:text-secondary-text-color/40 outline-none transition-colors duration-100 focus:border-service-color";
const compactValidInputCls = "border-success-color/60 bg-success-color/5";
const compactLabelCls = "text-[10px] font-medium uppercase tracking-wider text-secondary-text-color";

function FormSection({ title, description, action, modified, compact, children }: { title: string; description?: string; action?: React.ReactNode; modified?: boolean; compact?: boolean; children?: React.ReactNode }) {
  const hasBody = children !== null && children !== undefined && children !== false;

  return (
    <section className="rounded-sm border border-border-color bg-modal-box-color/45">
      <div className={`flex items-start justify-between gap-3 ${hasBody ? 'border-b border-border-color/60' : ''} ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="text-xs font-semibold text-primary-text-color">{title}</h3>
            {modified && (
              <span className="shrink-0 rounded-sm border border-service-color/25 bg-service-color/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-service-color">
                Modified
              </span>
            )}
          </div>
          {description && <p className="mt-0.5 text-[11px] leading-relaxed text-secondary-text-color">{description}</p>}
        </div>
        {action}
      </div>
      {hasBody && (
        <div className={compact ? 'p-2.5' : 'p-3'}>
          {children}
        </div>
      )}
    </section>
  );
}

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

function isValidSubdomain(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === '@' || /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized);
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

function initialEndpoints(service?: ServiceItem): EndpointEntry[] {
  const endpoints = service?.endpoints;
  if (!endpoints || endpoints.length === 0) return [];

  return endpoints.map(endpoint => ({
    componentName: endpoint.componentName ?? '',
    subdomain: endpoint.subdomain === '' ? '@' : endpoint.subdomain ?? '',
    hostPort: String(endpoint.hostPort),
    containerPort: String(endpoint.containerPort),
  }));
}

function cleanSourceRepositories(entries: SourceRepositoryEntry[]) {
  return entries.map(repo => ({
    url: repo.url.trim(),
    rootDirectory: normalizeRootDirectory(repo.rootDirectory),
  }));
}

function cleanEnvEntries(entries: EnvEntry[]) {
  return entries
    .filter(entry => entry.key.trim() || entry.value.trim())
    .map(entry => ({ key: entry.key.trim(), value: entry.value }));
}

function cleanEndpointEntries(entries: EndpointEntry[]) {
  return entries
    .filter(entry =>
      entry.componentName.trim() ||
      entry.subdomain.trim() ||
      entry.hostPort.trim() ||
      entry.containerPort.trim()
    )
    .map(entry => ({
      componentName: entry.componentName.trim(),
      subdomain: entry.subdomain.trim().toLowerCase(),
      hostPort: entry.hostPort.trim(),
      containerPort: entry.containerPort.trim(),
    }));
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
  const [endpointEntries, setEndpointEntries] = useState<EndpointEntry[]>(() => initialEndpoints(service));
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>(() => {
    const entries = Object.entries(service?.serviceEnv ?? {}).map(([key, value]) => ({ key, value }));
    return entries.length > 0 ? entries : [{ key: '', value: '' }];
  });
  const [currentStep, setCurrentStep] = useState<CreateStep>('source');
  const [redeployEnvExpanded, setRedeployEnvExpanded] = useState(false);
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
  const initialForm = useMemo(() => ({
    serviceName: service?.serviceName ?? '',
    serviceVersion: service?.serviceVersion ?? '1.0.0',
    serviceDeployPreset: service?.serviceDeployPreset ?? 'dockerfile',
    agentIndex: service ? String(service.agentIndex) : '',
  }), [service]);
  const initialSourceRepositories = useMemo(
    () => parseSourceRepositories(service?.serviceSourceUrl, service?.serviceRootDirectory),
    [service],
  );
  const initialPorts = useMemo(() => initialPortMappings(service), [service]);
  const initialEndpointEntries = useMemo(() => initialEndpoints(service), [service]);
  const initialEnvEntries = useMemo(
    () => Object.entries(service?.serviceEnv ?? {}).map(([key, value]) => ({ key, value })),
    [service],
  );
  const modifiedGroups = useMemo(() => {
    const basic = form.serviceName !== initialForm.serviceName || form.serviceDeployPreset !== initialForm.serviceDeployPreset;
    const repositories = JSON.stringify(cleanSourceRepositories(sourceRepositories)) !== JSON.stringify(cleanSourceRepositories(initialSourceRepositories));
    const agent = form.agentIndex !== initialForm.agentIndex;
    const ports = JSON.stringify(portMappings) !== JSON.stringify(initialPorts);
    const endpoints = JSON.stringify(cleanEndpointEntries(endpointEntries)) !== JSON.stringify(cleanEndpointEntries(initialEndpointEntries));
    const release = form.serviceVersion !== initialForm.serviceVersion;
    const env = JSON.stringify(cleanEnvEntries(envEntries)) !== JSON.stringify(cleanEnvEntries(initialEnvEntries));
    return { basic, repositories, agent, ports, endpoints, release, env };
  }, [endpointEntries, envEntries, form, initialEndpointEntries, initialEnvEntries, initialForm, initialPorts, initialSourceRepositories, portMappings, sourceRepositories]);
  const modifiedLabels = useMemo(() => {
    const labels: string[] = [];
    if (modifiedGroups.basic) labels.push('기본 정보');
    if (modifiedGroups.repositories) labels.push('레포지토리');
    if (modifiedGroups.agent) labels.push('배포 대상');
    if (modifiedGroups.ports) labels.push('포트');
    if (modifiedGroups.endpoints) labels.push('엔드포인트');
    if (modifiedGroups.release) labels.push('릴리즈');
    if (modifiedGroups.env) labels.push('환경 변수');
    return labels;
  }, [modifiedGroups]);
  const modifiedCount = modifiedLabels.length;
  const initialDirtySnapshot = useMemo(() => JSON.stringify({
    form: {
      serviceName: service?.serviceName ?? '',
      serviceRootDirectory: service?.serviceRootDirectory ?? '',
      serviceVersion: service?.serviceVersion ?? '1.0.0',
      serviceDeployPreset: service?.serviceDeployPreset ?? 'dockerfile',
      agentIndex: service ? String(service.agentIndex) : '',
    },
    sourceRepositories: cleanSourceRepositories(parseSourceRepositories(service?.serviceSourceUrl, service?.serviceRootDirectory)),
    portMappings: initialPortMappings(service),
    endpointEntries: cleanEndpointEntries(initialEndpoints(service)),
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
    sourceRepositories: cleanSourceRepositories(sourceRepositories),
    portMappings,
    endpointEntries: cleanEndpointEntries(endpointEntries),
    envEntries: envEntries.filter(entry => entry.key.trim() || entry.value.trim()),
  }), [endpointEntries, envEntries, form, portMappings, sourceRepositories]);
  const hasCreateInput = useMemo(() => (
    form.serviceName.trim() !== '' ||
    form.serviceRootDirectory.trim() !== '' ||
    form.serviceVersion.trim() !== '1.0.0' ||
    form.serviceDeployPreset !== 'dockerfile' ||
    sourceRepositories.some(repo => repo.url.trim() !== '' || repo.rootDirectory.trim() !== '') ||
    portMappings.some(mapping => mapping.hostPort.trim() !== '' || mapping.containerPort.trim() !== '') ||
    endpointEntries.some(endpoint => endpoint.componentName.trim() !== '' || endpoint.subdomain.trim() !== '' || endpoint.hostPort.trim() !== '' || endpoint.containerPort.trim() !== '') ||
    envEntries.some(entry => entry.key.trim() !== '' || entry.value.trim() !== '')
  ), [endpointEntries, envEntries, form, portMappings, sourceRepositories]);
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
    setSourceRepositories(prev => prev.map((repo, i) => i === index ? { ...repo, [field]: value } : repo));
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
  function defaultEndpointComponentName() {
    if (form.serviceDeployPreset === 'compose') return form.serviceName.trim();
    return 'app';
  }
  function addEndpoint() {
    const firstPortMapping = portMappings[0] ?? { hostPort: '', containerPort: '' };
    setEndpointEntries(prev => [
      ...prev,
      {
        componentName: defaultEndpointComponentName(),
        subdomain: prev.length === 0 ? '@' : '',
        hostPort: firstPortMapping.hostPort,
        containerPort: firstPortMapping.containerPort,
      },
    ]);
  }
  function updateEndpoint(index: number, field: keyof EndpointEntry, value: string) {
    setError(null);
    setEndpointEntries(prev => prev.map((endpoint, i) => i === index ? { ...endpoint, [field]: value } : endpoint));
  }
  function removeEndpoint(index: number) {
    setEndpointEntries(prev => prev.filter((_, i) => i !== index));
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
      const endpoints = cleanEndpointEntries(endpointEntries);
      for (const endpoint of endpoints) {
        if (!isValidPort(endpoint.hostPort)) return '엔드포인트 외부 포트는 1-65535 사이 숫자로 입력해주세요.';
        if (!isValidPort(endpoint.containerPort)) return '엔드포인트 내부 포트는 1-65535 사이 숫자로 입력해주세요.';
        if (!isValidSubdomain(endpoint.subdomain)) return '엔드포인트 서브도메인은 소문자/숫자/하이픈 또는 @만 사용할 수 있습니다.';
      }
      const publicSubdomains = endpoints
        .map(endpoint => endpoint.subdomain === '@' ? '' : endpoint.subdomain)
        .filter(subdomain => subdomain !== '');
      if (new Set(publicSubdomains).size !== publicSubdomains.length) return '엔드포인트 서브도메인이 중복되었습니다.';
      const rootEndpointCount = endpoints.filter(endpoint => endpoint.subdomain === '@').length;
      if (rootEndpointCount > 1) return '루트 엔드포인트(@)는 하나만 등록할 수 있습니다.';
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
    const parsedEndpoints: ServiceEndpointPayload[] = cleanEndpointEntries(endpointEntries).map(endpoint => ({
      componentName: endpoint.componentName || defaultEndpointComponentName(),
      subdomain: endpoint.subdomain === '' ? null : endpoint.subdomain,
      hostPort: parseInt(endpoint.hostPort, 10),
      containerPort: parseInt(endpoint.containerPort, 10),
    }));
    const primaryPortMapping = parsedPortMappings[0];
    const serviceRootDirectory = primaryRootDirectory;

    const url = mode === 'create'
      ? '/v1/service/deploy'
      : `/v1/service/${service!.serviceIndex}/redeploy`;

    const body = mode === 'create'
      ? {
        workspaceIdx: workspaceIndex,
        serviceName: form.serviceName.trim(),
        servicePort: primaryPortMapping.hostPort,
        serviceHostPort: primaryPortMapping.hostPort,
        serviceContainerPort: primaryPortMapping.containerPort,
        servicePortMappings: parsedPortMappings,
        serviceEndpoints: parsedEndpoints,
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
        serviceEndpoints: parsedEndpoints,
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
      <div className={`flex flex-col ${isCreateMode ? 'gap-3' : 'gap-2.5'}`}>
        <FormSection title="기본 정보" description="콘솔에서 표시될 서비스 이름과 빌드 방식을 선택합니다." modified={!isCreateMode && modifiedGroups.basic} compact={!isCreateMode}>
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
        </FormSection>

        <FormSection
          title="레포지토리"
          description="여러 레포를 추가하고 각 레포의 루트 디렉터리를 지정할 수 있습니다."
          modified={!isCreateMode && modifiedGroups.repositories}
          compact={!isCreateMode}
          action={(
            <button type="button" onClick={addSourceRepository} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border border-border-color px-2 text-xs text-secondary-text-color transition-colors hover:border-border-strong-color hover:text-primary-text-color cursor-pointer">
              <Plus className="w-3 h-3" />
              추가
            </button>
          )}
        >
          <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
            {sourceRepositories.map((repo, i) => (
              <div key={i} className={`optics-row-in rounded-sm border border-border-color/70 bg-background-color/55 ${isCreateMode ? 'p-2.5' : 'p-2'}`}>
                <div className={`${isCreateMode ? 'mb-1.5' : 'mb-1'} flex items-center justify-between gap-2`}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5 shrink-0 text-tertiary-text-color" />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-tertiary-text-color">Repository {i + 1}</span>
                  </div>
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
        </FormSection>
      </div>
    );
  }

  function renderRuntimeFields() {
    return (
      <div className={`flex flex-col ${isCreateMode ? 'gap-3' : 'gap-2.5'}`}>
        <FormSection title="배포 대상" description="서비스를 실행할 워크스페이스 에이전트를 선택합니다." modified={!isCreateMode && modifiedGroups.agent} compact={!isCreateMode}>
          {agents.length === 0 ? (
            <p className="rounded-sm border border-border-color bg-background-color px-3 py-2 text-xs text-secondary-text-color">연결된 에이전트가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {agents.map(agent => {
                const selected = form.agentIndex === String(agent.agentIndex);
                return (
                  <button
                    key={agent.agentIndex}
                    type="button"
                    onClick={() => set('agentIndex', String(agent.agentIndex))}
                    className={`group flex min-w-0 items-center gap-2 rounded-sm border px-2.5 text-left transition-colors cursor-pointer ${isCreateMode ? 'py-2.5' : 'py-2'} ${
                      selected
                        ? 'border-service-color bg-service-color/10 text-primary-text-color'
                        : 'border-border-color bg-background-color text-secondary-text-color hover:border-border-strong-color hover:text-primary-text-color'
                    }`}
                  >
                    <div className={`flex shrink-0 items-center justify-center rounded-sm border ${isCreateMode ? 'h-7 w-7' : 'h-6 w-6'} ${selected ? 'border-service-color/30 bg-service-color/15 text-service-color' : 'border-border-color bg-modal-box-color text-tertiary-text-color group-hover:text-secondary-text-color'}`}>
                      <Server className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{agent.agentName}</span>
                      <span className="mt-0.5 block text-[10px] text-tertiary-text-color">Agent #{agent.agentIndex}</span>
                    </div>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-service-color" />}
                  </button>
                );
              })}
            </div>
          )}
        </FormSection>

        <FormSection
          title="포트 매핑"
          description={isCompose ? 'Compose 배포는 compose 파일의 ports 설정이 우선 적용됩니다.' : '외부 포트가 컨테이너 내부 포트로 연결됩니다.'}
          modified={!isCreateMode && modifiedGroups.ports}
          compact={!isCreateMode}
          action={(
            <button type="button" onClick={addPortMapping} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border border-border-color px-2 text-xs text-secondary-text-color transition-colors hover:border-border-strong-color hover:text-primary-text-color cursor-pointer">
              <Plus className="w-3 h-3" />
              추가
            </button>
          )}
        >
          <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18px] gap-2 px-0.5">
            <span className={compactLabelCls}>외부 포트 <span className="text-service-color">*</span></span>
            <span className={compactLabelCls}>내부 포트 <span className="text-service-color">*</span></span>
            <span />
          </div>
          <div className="flex max-h-36 flex-col gap-1.5 overflow-y-auto pr-1">
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
        </FormSection>

        <FormSection
          title="엔드포인트"
          description="공개 서브도메인과 연결할 컴포넌트/포트를 등록합니다. @는 워크스페이스 루트 도메인을 의미합니다."
          modified={!isCreateMode && modifiedGroups.endpoints}
          compact={!isCreateMode}
          action={(
            <button type="button" onClick={addEndpoint} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border border-border-color px-2 text-xs text-secondary-text-color transition-colors hover:border-border-strong-color hover:text-primary-text-color cursor-pointer">
              <Plus className="w-3 h-3" />
              추가
            </button>
          )}
        >
          {endpointEntries.length === 0 ? (
            <div className="flex items-center gap-2 rounded-sm border border-border-color bg-background-color px-3 py-2 text-xs text-secondary-text-color">
              <Globe className="h-3.5 w-3.5 shrink-0 text-tertiary-text-color" />
              <span>엔드포인트를 추가하지 않으면 첫 번째 포트 매핑으로 기본 엔드포인트가 생성됩니다.</span>
            </div>
          ) : (
            <>
              <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_18px] gap-2 px-0.5">
                <span className={compactLabelCls}>컴포넌트</span>
                <span className={compactLabelCls}>서브도메인</span>
                <span className={compactLabelCls}>외부 포트</span>
                <span className={compactLabelCls}>내부 포트</span>
                <span />
              </div>
              <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1">
                {endpointEntries.map((endpoint, index) => (
                  <div key={index} className="optics-row-in grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_18px] items-center gap-2">
                    <input
                      className={compactInputCls}
                      placeholder={defaultEndpointComponentName() || 'app'}
                      value={endpoint.componentName}
                      onChange={e => updateEndpoint(index, 'componentName', e.target.value)}
                    />
                    <input
                      className={compactInputCls}
                      placeholder="api 또는 @"
                      value={endpoint.subdomain}
                      onChange={e => updateEndpoint(index, 'subdomain', e.target.value)}
                    />
                    <input
                      className={compactInputCls}
                      placeholder="외부"
                      type="number"
                      min={1}
                      max={65535}
                      value={endpoint.hostPort}
                      onChange={e => updateEndpoint(index, 'hostPort', e.target.value)}
                    />
                    <input
                      className={compactInputCls}
                      placeholder="내부"
                      type="number"
                      min={1}
                      max={65535}
                      value={endpoint.containerPort}
                      onChange={e => updateEndpoint(index, 'containerPort', e.target.value)}
                    />
                    <button type="button" onClick={() => removeEndpoint(index)} className="text-secondary-text-color hover:text-red-400 transition-colors cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </FormSection>

        <FormSection title="릴리즈 정보" description="이번 배포에서 표시될 버전을 입력합니다." modified={!isCreateMode && modifiedGroups.release} compact={!isCreateMode}>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={compactLabelCls}>버전 <span className="text-service-color">*</span></label>
              <input className={compactInputCls} placeholder="1.0.0" value={form.serviceVersion} onChange={e => set('serviceVersion', e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={compactLabelCls}>선택된 에이전트</label>
              <div className="flex h-9 items-center gap-2 rounded-sm border border-border-color bg-background-color px-2.5 text-xs text-secondary-text-color">
                <Server className="h-3.5 w-3.5 shrink-0 text-tertiary-text-color" />
                <span className="truncate">{selectedAgent?.agentName ?? '미선택'}</span>
              </div>
            </div>
          </div>
        </FormSection>
      </div>
    );
  }

  function renderEnvFields() {
    const isCollapsed = !isCreateMode && !redeployEnvExpanded;

    return (
      <FormSection
        title="환경 변수"
        description={isCollapsed ? `${envWithKeys.length}개의 환경 변수가 설정되어 있습니다.` : ".env 형식의 여러 줄을 붙여넣으면 자동으로 행이 채워집니다."}
        modified={!isCreateMode && modifiedGroups.env}
        compact={!isCreateMode}
        action={(
          <div className="flex shrink-0 items-center gap-1.5">
            {!isCreateMode && (
              <button
                type="button"
                onClick={() => setRedeployEnvExpanded(open => !open)}
                className="inline-flex h-7 items-center rounded-sm border border-border-color px-2 text-xs text-secondary-text-color transition-colors hover:border-border-strong-color hover:text-primary-text-color cursor-pointer"
              >
                {isCollapsed ? '편집' : '접기'}
              </button>
            )}
            {!isCollapsed && (
              <button type="button" onClick={addEnvEntry} className="inline-flex h-7 items-center gap-1 rounded-sm border border-border-color px-2 text-xs text-secondary-text-color transition-colors hover:border-border-strong-color hover:text-primary-text-color cursor-pointer">
                <Plus className="w-3 h-3" />
                추가
              </button>
            )}
          </div>
        )}
      >
        {isCollapsed ? (
          null
        ) : (
          <>
        <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18px] gap-2 px-0.5">
          <span className={compactLabelCls}>Key</span>
          <span className={compactLabelCls}>Value</span>
          <span />
        </div>
        <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
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
          </>
        )}
      </FormSection>
    );
  }

  function renderReview() {
    const repositories = sourceRepositories
      .map(repo => ({ url: repo.url.trim(), rootDirectory: normalizeRootDirectory(repo.rootDirectory) }))
      .filter(repo => repo.url);
    const endpoints = cleanEndpointEntries(endpointEntries);
    return (
      <FormSection title="배포 요약" description="아래 내용으로 서비스 배포를 시작합니다.">
        <div className="rounded-sm border border-border-color bg-background-color px-3 py-1">
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
          <SummaryRow label="엔드포인트" value={
            endpoints.length === 0 ? (
              <span className="text-secondary-text-color">기본값</span>
            ) : (
              <div className="flex flex-col gap-1 font-mono">
                {endpoints.map(endpoint => (
                  <span key={`${endpoint.subdomain}:${endpoint.hostPort}:${endpoint.containerPort}`} className="truncate">
                    {endpoint.subdomain || 'internal'} -&gt; {endpoint.componentName || defaultEndpointComponentName()}:{endpoint.containerPort}
                  </span>
                ))}
              </div>
            )
          } />
          <SummaryRow label="버전" value={`v${form.serviceVersion.trim()}`} />
          <SummaryRow label="에이전트" value={selectedAgent?.agentName ?? <span className="text-secondary-text-color">미선택</span>} />
          <SummaryRow label="환경 변수" value={`${envWithKeys.length}개`} />
        </div>
      </FormSection>
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
      <div className="flex flex-col gap-2.5">
        {renderSourceFields()}
        {renderRuntimeFields()}
        {renderEnvFields()}
      </div>
    );
  }

  const submitLabel = mode === 'create' ? '배포 시작' : '재배포';
  const isReviewStep = !isCreateMode || currentStep === 'review';

  return (
    <form onSubmit={e => e.preventDefault()} className={`flex flex-col ${isCreateMode ? 'gap-3.5' : 'gap-3'}`}>
      {isCreateMode && (
        <div className="border-b border-border-color/70 pb-2.5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-widest text-tertiary-text-color">Step {currentStepIndex + 1} / {createSteps.length}</div>
              <p className="mt-0.5 text-[13px] font-semibold text-primary-text-color">{stepMeta[currentStep].title}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-secondary-text-color">{stepMeta[currentStep].description}</p>
            </div>

            <div className="relative mt-1.5 w-[104px] shrink-0 px-1">
              <div className="absolute left-1.5 right-1.5 top-[7px] h-px bg-border-color" />
              <div
                className="absolute left-1.5 top-[7px] h-px bg-service-color/80 transition-all duration-200"
                style={{ width: `${currentStepIndex === 0 ? 0 : (currentStepIndex / (createSteps.length - 1)) * 100}%` }}
              />
              <div className="relative grid grid-cols-4">
                {createSteps.map((step, index) => {
                  const isCurrent = index === currentStepIndex;
                  const isDone = index < currentStepIndex;
                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => goToStep(step.key)}
                      aria-label={step.label}
                      className="group flex min-w-0 justify-center cursor-pointer"
                    >
                      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-modal-background-color transition-colors ${
                        isCurrent
                          ? 'border-service-color text-service-color'
                          : isDone
                            ? 'border-service-color/70 text-service-color'
                          : 'border-border-color text-tertiary-text-color group-hover:border-border-strong-color group-hover:text-secondary-text-color'
                      }`}>
                        {isDone ? <Check className="h-2 w-2" /> : <span className={`h-1 w-1 rounded-full ${isCurrent ? 'bg-service-color' : 'bg-current'}`} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isCreateMode && (
        <div className="rounded-sm border border-border-color bg-modal-box-color/45 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-[10px] font-medium uppercase leading-3 tracking-widest text-tertiary-text-color">Redeploy</span>
              <p className="mt-1 truncate text-sm font-semibold leading-4 text-primary-text-color">{form.serviceName || service?.serviceName || '서비스 재배포'}</p>
              <p className="mt-1 text-[11px] leading-3 text-secondary-text-color">
                {modifiedCount > 0 ? `${modifiedLabels.join(', ')} 변경 후 재배포합니다.` : '변경 사항 없이 다시 빌드 후 배포합니다.'}
              </p>
            </div>
            <div className="flex h-6 shrink-0 items-center rounded-sm border border-border-color bg-background-color px-2 text-[10px] font-medium leading-none text-secondary-text-color">
              {modifiedCount > 0 ? `변경 ${modifiedCount}개` : '변경 없음'}
            </div>
          </div>
        </div>
      )}

      <div key={isCreateMode ? currentStep : 'redeploy'} className={`optics-panel-in ${isCreateMode ? 'min-h-[248px]' : 'max-h-[58vh] overflow-y-auto pr-1'}`}>
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
            {!isCreateMode && (
              <span className="rounded-sm bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">
                {modifiedCount > 0 ? `변경 ${modifiedCount}개` : '동일'}
              </span>
            )}
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
