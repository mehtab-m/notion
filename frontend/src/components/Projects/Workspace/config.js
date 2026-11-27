/* Field schemas for the project workspace panels. Mirrors backend/routes/projectWorkspace.js. */

const opts = (list) => list.map((v) => ({ value: v, label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }));

export const TASK_STATUSES = [
  { id: 'inbox', label: 'Inbox', tone: 'var(--text-muted)' },
  { id: 'ready', label: 'Ready', tone: '#8b5cf6' },
  { id: 'in_progress', label: 'In progress', tone: 'var(--accent)' },
  { id: 'blocked', label: 'Blocked', tone: 'var(--accent-red, #EF4444)' },
  { id: 'review', label: 'Review', tone: 'var(--accent-yellow, #F59E0B)' },
  { id: 'done', label: 'Done', tone: 'var(--accent-green, #10B981)' },
];

export const TASK_PRIORITIES = [
  { id: 'urgent', label: 'Urgent', tone: 'var(--accent-red, #EF4444)' },
  { id: 'high', label: 'High', tone: '#f97316' },
  { id: 'medium', label: 'Medium', tone: 'var(--accent-yellow, #F59E0B)' },
  { id: 'low', label: 'Low', tone: 'var(--accent-green, #10B981)' },
];

export const taskStatusOf = (t) => (TASK_STATUSES.some((s) => s.id === t?.status) ? t.status : t?.done ? 'done' : 'ready');

/* type: text | textarea | select | url | bool | repo | env | vars | kv | instances | code */
export const RESOURCE_SCHEMAS = {
  repositories: {
    title: 'Repositories', singular: 'repository', titleKey: 'name', subtitleKeys: ['provider', 'purpose', 'defaultBranch'],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'sortlife-web' },
      { key: 'provider', label: 'Provider', type: 'select', options: opts(['github', 'gitlab', 'bitbucket', 'azure_devops', 'self_hosted', 'other']), def: 'github' },
      { key: 'purpose', label: 'Purpose', type: 'select', options: opts(['frontend', 'backend', 'mobile', 'infrastructure', 'docs', 'monorepo', 'other']), def: 'other' },
      { key: 'remoteUrl', label: 'Remote URL', type: 'url', placeholder: 'https://github.com/you/repo or git@github.com:you/repo.git' },
      { key: 'defaultBranch', label: 'Default branch', type: 'text', placeholder: 'main', def: 'main' },
      { key: 'primaryLanguage', label: 'Primary language', type: 'text', placeholder: 'TypeScript' },
      { key: 'localPath', label: 'Local path', type: 'text', placeholder: 'C:\\code\\repo', mono: true },
      { key: 'readmeUrl', label: 'README URL', type: 'url' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  technologies: {
    title: 'Tech stack', singular: 'technology', titleKey: 'name', subtitleKeys: ['category', 'version'],
    fields: [
      { key: 'name', label: 'Technology', type: 'text', required: true, placeholder: 'React' },
      { key: 'category', label: 'Category', type: 'select', options: opts(['frontend', 'backend', 'database', 'mobile', 'infrastructure', 'styling', 'testing', 'tooling', 'other']), def: 'other' },
      { key: 'version', label: 'Version', type: 'text', placeholder: '18.2' },
      { key: 'repositoryId', label: 'Repository', type: 'repo' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  environments: {
    title: 'Environments', singular: 'environment', titleKey: 'name', subtitleKeys: ['environmentType', 'status', 'deploymentProvider'],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Production' },
      { key: 'environmentType', label: 'Type', type: 'select', options: opts(['local', 'development', 'staging', 'production', 'custom']), def: 'development' },
      { key: 'status', label: 'Status', type: 'select', options: opts(['active', 'inactive', 'needs_review', 'archived']), def: 'active' },
      { key: 'applicationUrl', label: 'App URL', type: 'url' },
      { key: 'apiUrl', label: 'API URL', type: 'url' },
      { key: 'deploymentProvider', label: 'Deploy provider', type: 'text', placeholder: 'Vercel, Render, AWS…' },
      { key: 'deploymentBranch', label: 'Deploy branch', type: 'text', placeholder: 'main' },
      { key: 'deploymentMethod', label: 'Deploy method', type: 'textarea', placeholder: 'Push to main → auto deploy' },
      { key: 'serverHostname', label: 'Host', type: 'text', placeholder: 'api.example.com:443', mono: true },
      { key: 'operatingSystem', label: 'OS', type: 'text' },
      { key: 'machineLabel', label: 'Machine', type: 'text', placeholder: 'Work laptop' },
      { key: 'runtimeVersions', label: 'Runtime versions', type: 'kv', placeholder: 'node=20.11\npnpm=9' },
      { key: 'variables', label: 'Environment variables (names only)', type: 'vars' },
      { key: 'notes', label: 'Setup notes', type: 'textarea' },
    ],
  },
  services: {
    title: 'Services', singular: 'service', titleKey: 'name', subtitleKeys: ['category', 'provider'],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Postgres' },
      { key: 'category', label: 'Category', type: 'select', options: opts(['database', 'cache', 'hosting', 'storage', 'auth', 'payments', 'email', 'monitoring', 'search', 'queue', 'analytics', 'external_api', 'dns', 'other']), def: 'other' },
      { key: 'provider', label: 'Provider', type: 'text', placeholder: 'Neon, Stripe, Cloudinary…' },
      { key: 'purpose', label: 'Purpose', type: 'text' },
      { key: 'dashboardUrl', label: 'Dashboard URL', type: 'url' },
      { key: 'documentationUrl', label: 'Docs URL', type: 'url' },
      { key: 'instances', label: 'Per-environment instances', type: 'instances' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  commands: {
    title: 'Commands', singular: 'command', titleKey: 'title', subtitleKeys: ['category', 'shell', 'operatingSystem'],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Run migrations' },
      { key: 'commandText', label: 'Command', type: 'code', required: true, placeholder: 'npx prisma db push' },
      { key: 'category', label: 'Category', type: 'select', options: opts(['install', 'development', 'test', 'build', 'database', 'deployment', 'maintenance', 'other']), def: 'other' },
      { key: 'shell', label: 'Shell', type: 'select', options: opts(['bash', 'powershell', 'zsh', 'cmd', 'other']), def: 'bash' },
      { key: 'operatingSystem', label: 'OS', type: 'select', options: opts(['cross_platform', 'windows', 'macos', 'linux']), def: 'cross_platform' },
      { key: 'repositoryId', label: 'Repository', type: 'repo' },
      { key: 'environmentId', label: 'Environment', type: 'env' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'prerequisites', label: 'Prerequisites', type: 'textarea' },
      { key: 'isDestructive', label: 'Destructive (drops data, force pushes…)', type: 'bool' },
    ],
  },
};

export const DOC_CATEGORIES = ['general', 'architecture', 'requirements', 'setup', 'api', 'database', 'deployment', 'troubleshooting', 'adr', 'notes'];

export const VAR_STATUSES = ['unknown', 'configured', 'missing', 'not_applicable'];

/* Mirror of backend/utils/secretGuard.js — warn before the server refuses. */
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /[a-z][a-z0-9+.-]*:\/\/[^\s/?#@:]*:[^\s/?#@]+@/i,
  /(sk_live_|rk_live_|sk_test_|ghp_|gho_|ghs_|ghr_|github_pat_|glpat-|xox[abposr]-|sb_secret_|sbp_)[A-Za-z0-9_-]{8,}/,
  /AKIA[0-9A-Z]{16}/,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
];
export const looksSecret = (v) => {
  if (v == null || v === '') return false;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return SECRET_PATTERNS.some((re) => re.test(s));
};

export const prettify = (v) => String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export const isUrl = (v) => /^https?:\/\//i.test(String(v || ''));
