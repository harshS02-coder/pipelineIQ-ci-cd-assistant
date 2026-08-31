/**
 * PipelineIQ — Pure Monochromatic Terminal / CLI Interface
 */

import { api } from './api.js';

// Default Sample Telemetry
const SAMPLE_MONITORED_REPOS = [
  {
    repoFullName: 'octocat/api-gateway',
    isPrivate: false,
    defaultBranch: 'main',
    language: 'TypeScript',
    lastEventAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    status: 'failed'
  },
  {
    repoFullName: 'octocat/web-frontend',
    isPrivate: false,
    defaultBranch: 'main',
    language: 'JavaScript',
    lastEventAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    status: 'healthy'
  },
  {
    repoFullName: 'octocat/payment-worker',
    isPrivate: true,
    defaultBranch: 'main',
    language: 'Go',
    lastEventAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    status: 'healthy'
  }
];

const SAMPLE_FAILURES = [
  {
    id: 'sample-f1',
    repoFullName: 'octocat/api-gateway',
    pipelineName: 'CI / Test & Build',
    branch: 'feat/rate-limits',
    commitSha: 'b72d9e4fa32c',
    status: 'failed',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    rawLogs: [
      '2026-08-31T11:42:01.120Z ##[section]Starting: CI / Test & Build',
      '2026-08-31T11:42:02.340Z ##[command]git clone --depth=1 https://github.com/octocat/api-gateway.git .',
      '2026-08-31T11:42:04.110Z ##[command]pnpm install --frozen-lockfile',
      '2026-08-31T11:42:12.890Z Scope: all 4 packages',
      '2026-08-31T11:42:15.020Z ##[command]pnpm build',
      '2026-08-31T11:42:18.450Z > next build',
      '2026-08-31T11:42:21.320Z Checking validity of types...',
      '2026-08-31T11:42:24.890Z ##[error]app/page.tsx:14:28 - error TS2307: Cannot find module \'@/components/hero\' or its corresponding type declarations.',
      '2026-08-31T11:42:24.891Z ##[error]  14 | import { Hero } from \'@/components/hero\';',
      '2026-08-31T11:42:24.892Z ##[error]     |                      ~~~~~~~~~~~~~~~~~~~',
      '2026-08-31T11:42:24.893Z ##[error]Type error occurred in app/page.tsx',
      '2026-08-31T11:42:25.100Z ##[error]Process completed with exit code 1.'
    ].join('\n'),
    analysis: {
      id: 'analysis-1',
      summary: 'Module resolution failed during Next.js TypeScript build.',
      rootCause: 'Cannot find module \'@/components/hero\' referenced in app/page.tsx. The component was renamed to HeroSection without updating imports.',
      confidence: 0.94,
      suggestedFixes: [
        {
          id: 'fix-101',
          title: 'Update stale component import in app/page.tsx',
          description: 'Change the import path to reference the newly named HeroSection component.',
          severity: 'critical',
          isSafe: true,
          commands: ['sed -i "s/@\\/components\\/hero/@\\/components\\/HeroSection/g" app/page.tsx', 'pnpm build'],
          estimatedTime: '2m'
        },
        {
          id: 'fix-102',
          title: 'Verify package exports in tsconfig.json',
          description: 'Ensure tsconfig.json paths alias matches the components directory layout.',
          severity: 'medium',
          isSafe: true,
          commands: ['cat tsconfig.json | grep -A 5 "paths"'],
          estimatedTime: '5m'
        }
      ]
    }
  },
  {
    id: 'sample-f2',
    repoFullName: 'octocat/web-frontend',
    pipelineName: 'Production E2E Suite',
    branch: 'main',
    commitSha: 'f1a2b3c4d5e6',
    status: 'failed',
    createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    rawLogs: [
      '2026-08-31T09:15:00.010Z ##[section]Starting: Production E2E Suite',
      '2026-08-31T09:15:02.100Z ##[command]playwright test',
      '2026-08-31T09:15:10.420Z Running 24 tests using 4 workers',
      '2026-08-31T09:15:24.890Z ##[error]FAIL tests/checkout.spec.ts:42:5 › Checkout Flow with Card Payment',
      '2026-08-31T09:15:24.891Z ##[error]  Error: 401 Unauthorized - Stripe API key STRIPE_SECRET_KEY missing in environment',
      '2026-08-31T09:15:25.000Z ##[error]Process completed with exit code 1.'
    ].join('\n'),
    analysis: {
      id: 'analysis-2',
      summary: 'E2E test suite timeout on checkout flow.',
      rootCause: 'Stripe API key environment variable STRIPE_SECRET_KEY was missing in the CI secret store, causing checkout integration tests to throw 401 Unauthorized.',
      confidence: 0.89,
      suggestedFixes: [
        {
          id: 'fix-201',
          title: 'Inject mock STRIPE_SECRET_KEY into test runner',
          description: 'Configure mock environment secret in the GitHub Actions workflow file.',
          severity: 'high',
          isSafe: true,
          commands: ['export STRIPE_SECRET_KEY=sk_test_mock_12345', 'npm test'],
          estimatedTime: '3m'
        }
      ]
    }
  }
];

const SAMPLE_ALL_REPOS = [
  ...SAMPLE_MONITORED_REPOS.map(r => ({ ...r, fullName: r.repoFullName, isMonitored: true })),
  {
    fullName: 'octocat/auth-microservice',
    name: 'auth-microservice',
    isPrivate: false,
    defaultBranch: 'main',
    language: 'Node.js',
    isMonitored: false
  },
  {
    fullName: 'octocat/infra-terraform',
    name: 'infra-terraform',
    isPrivate: true,
    defaultBranch: 'main',
    language: 'HCL',
    isMonitored: false
  }
];

// Application State
const state = {
  route: '#/',
  routeParams: {},
  timeFilter: '48h', // '48h' | '7d' | 'all'
  user: null,
  repos: [],
  monitoredRepos: [],
  dashboardItems: [],
  searchTerm: '',
  loading: false,
  health: null,
};

let elements = {};

function initElements() {
  elements = {
    userSection: document.getElementById('user-section'),
    contentArea: document.getElementById('content-area'),
    navItems: document.querySelectorAll('.nav-item'),
    searchInput: document.getElementById('search-input'),
    toastContainer: document.getElementById('toast-container'),
    healthIndicator: document.getElementById('health-indicator'),
  };
}

export function showToast(message, type = 'info') {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  const prefix = type === 'success' ? '[✓]' : type === 'error' ? '[!]' : '[i]';
  toast.innerHTML = `<span style="color:#737373;">${prefix}</span> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'just now';
  const date = new Date(dateString);
  const diffSecs = Math.floor((Date.now() - date) / 1000);
  if (diffSecs < 60) return 'just now';
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  return `${Math.floor(diffSecs / 86400)}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates an ASCII Block Progress Bar e.g. [██████████░░] 85%
 */
function renderAsciiProgressBar(confidence, totalBlocks = 14) {
  if (confidence === null || confidence === undefined) return '[░░░░░░░░░░░░░░] N/A';
  const pct = Math.round(confidence * 100);
  const filled = Math.min(totalBlocks, Math.max(0, Math.round((pct / 100) * totalBlocks)));
  const empty = totalBlocks - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${pct}%`;
}

/**
 * Filter failures list by selected time range ('48h' | '7d' | 'all')
 */
function filterFailuresByTime(items, range = '48h') {
  if (!items || items.length === 0) return [];
  if (range === 'all') return items;

  const now = Date.now();
  const maxAgeMs = range === '48h' 
    ? 48 * 60 * 60 * 1000 
    : 7 * 24 * 60 * 60 * 1000;

  return items.filter(item => {
    if (!item.createdAt) return true;
    const itemTime = new Date(item.createdAt).getTime();
    return (now - itemTime) <= maxAgeMs;
  });
}

function renderTimeFilterDropdown() {
  return `
    <div class="time-filter-wrapper">
      <label for="time-filter-select" class="time-filter-label">
        <span style="color:#737373;">filter:</span>
      </label>
      <select id="time-filter-select" class="time-filter-select" data-action="change-time-filter">
        <option value="48h" ${state.timeFilter === '48h' ? 'selected' : ''}>last-48h</option>
        <option value="7d" ${state.timeFilter === '7d' ? 'selected' : ''}>last-7d</option>
        <option value="all" ${state.timeFilter === 'all' ? 'selected' : ''}>all-time</option>
      </select>
    </div>
  `;
}

/**
 * Format terminal log lines with color coding & line numbers
 */
function formatTerminalLogs(rawLogs, repoFullName, pipelineName) {
  let text = rawLogs;
  if (!text || text.trim() === '') {
    text = [
      `2026-08-31T11:42:01.120Z ##[section]Starting: ${pipelineName || 'CI Pipeline'}`,
      `2026-08-31T11:42:02.340Z ##[command]git clone --depth=1 https://github.com/${repoFullName || 'repo'}.git .`,
      `2026-08-31T11:42:04.110Z ##[command]pnpm install --frozen-lockfile`,
      `2026-08-31T11:42:15.890Z added 842 packages in 11.2s`,
      `2026-08-31T11:42:16.020Z ##[command]pnpm test`,
      `2026-08-31T11:42:18.450Z > jest --ci --coverage`,
      `2026-08-31T11:42:24.890Z ##[error]FAIL src/controllers/auth.test.ts`,
      `2026-08-31T11:42:24.891Z ##[error]  ● Auth Controller › should authenticate valid token`,
      `2026-08-31T11:42:24.892Z ##[error]    Error: JWT_SECRET environment variable is missing or invalid`,
      `2026-08-31T11:42:25.100Z ##[error]Process completed with exit code 1.`
    ].join('\n');
  }

  const lines = text.split('\n');
  return {
    raw: text,
    lineCount: lines.length,
    html: lines.map((line, idx) => {
      const lineNum = idx + 1;
      let lineClass = '';
      
      if (/##\[error\]|\[ERROR\]|Error:|ERR!|FAIL|FAILED|FATAL/i.test(line)) {
        lineClass = 'log-error';
      } else if (/##\[command\]|\[command\]|^\$ |^Run /i.test(line)) {
        lineClass = 'log-command';
      } else if (/##\[warning\]|\[WARN\]|Warning:/i.test(line)) {
        lineClass = 'log-warning';
      } else if (/##\[section\]|PASS|✓|SUCCESS/i.test(line)) {
        lineClass = 'log-success';
      }

      const formattedText = escapeHtml(line).replace(
        /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z|\[\d{2}:\d{2}:\d{2}\])/,
        '<span class="log-timestamp">$1</span>'
      );

      return `<div class="log-line ${lineClass}"><span class="log-line-num">${lineNum}</span><span class="log-line-text">${formattedText}</span></div>`;
    }).join('')
  };
}

/**
 * Hash Routing Parser & Dispatcher
 */
function handleHashRoute() {
  const hash = window.location.hash || '#/';
  state.route = hash;
  state.routeParams = {};

  if (hash.startsWith('#/repo/')) {
    const parts = hash.replace('#/repo/', '').split('/');
    if (parts.length >= 2) {
      state.routeParams = {
        owner: decodeURIComponent(parts[0]),
        name: decodeURIComponent(parts[1]),
        repoFullName: `${decodeURIComponent(parts[0])}/${decodeURIComponent(parts[1])}`,
      };
    }
  }

  // Update sidebar active items
  elements.navItems.forEach(item => {
    const targetHash = item.getAttribute('href');
    if (targetHash === hash || (hash.startsWith('#/repo/') && targetHash === '#/dashboard')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  renderView();
}

/**
 * Global Event Delegation
 */
function setupEventDelegation() {
  window.addEventListener('hashchange', handleHashRoute);

  document.addEventListener('click', async (e) => {
    // 1. Copy Raw Logs
    const copyLogsBtn = e.target.closest('[data-action="copy-logs"]');
    if (copyLogsBtn) {
      e.preventDefault();
      const logId = copyLogsBtn.dataset.logId;
      const rawTextEl = document.getElementById('raw-log-content-' + logId);
      if (rawTextEl) {
        navigator.clipboard.writeText(rawTextEl.value).then(() => {
          showToast('logs copied to clipboard', 'success');
          copyLogsBtn.textContent = 'COPIED!';
          setTimeout(() => copyLogsBtn.textContent = 'COPY LOGS', 1500);
        }).catch(() => {
          showToast('failed to copy logs', 'error');
        });
      }
      return;
    }

    // 2. Connect GitHub
    const connectBtn = e.target.closest('[data-action="connect-github"]');
    if (connectBtn) {
      e.preventDefault();
      api.startOAuth();
      return;
    }

    // 3. Disconnect GitHub
    const disconnectBtn = e.target.closest('[data-action="disconnect-github"]');
    if (disconnectBtn) {
      e.preventDefault();
      api.clearToken();
      state.user = null;
      state.repos = [];
      state.monitoredRepos = [];
      state.dashboardItems = [];
      window.location.hash = '#/';
      renderUserBadge();
      renderView();
      showToast('logged out', 'info');
      return;
    }

    // 4. Refresh Data
    const refreshBtn = e.target.closest('[data-action="refresh-data"]');
    if (refreshBtn) {
      e.preventDefault();
      if (api.isAuthenticated()) {
        await loadDashboardData();
      }
      showToast('telemetry refreshed', 'info');
      return;
    }

    // 5. Toggle Fix Drawer Accordion
    const drawerToggle = e.target.closest('[data-action="toggle-fix-drawer"]');
    if (drawerToggle) {
      e.preventDefault();
      const targetId = drawerToggle.dataset.target;
      const drawer = document.getElementById(targetId);
      if (drawer) {
        const isHidden = drawer.style.display === 'none' || !drawer.style.display;
        drawer.style.display = isHidden ? 'flex' : 'none';
      }
      return;
    }

    // 6. Copy Fix Command
    const copyBtn = e.target.closest('[data-action="copy-command"]');
    if (copyBtn) {
      e.preventDefault();
      const command = copyBtn.dataset.command;
      if (command) {
        navigator.clipboard.writeText(command).then(() => {
          showToast('command copied', 'success');
          const original = copyBtn.textContent;
          copyBtn.textContent = '[✓]';
          setTimeout(() => copyBtn.textContent = original, 1500);
        }).catch(() => {
          showToast('copy failed', 'error');
        });
      }
      return;
    }
  });

  // Time Range Filter Change
  document.addEventListener('change', async (e) => {
    const timeFilterSelect = e.target.closest('[data-action="change-time-filter"]');
    if (timeFilterSelect) {
      state.timeFilter = timeFilterSelect.value;
      renderView();
      showToast(`filter: ${state.timeFilter}`, 'info');
      return;
    }

    // Repository Switchboard Toggle
    const toggleInput = e.target.closest('input[data-repo-toggle]');
    if (toggleInput) {
      const repoFullName = toggleInput.dataset.repoToggle;
      const willMonitor = toggleInput.checked;
      toggleInput.disabled = true;

      if (!api.isAuthenticated()) {
        setTimeout(() => {
          toggleInput.disabled = false;
          showToast(`${repoFullName} monitoring ${willMonitor ? 'enabled' : 'disabled'} [preview]`, 'info');
        }, 300);
        return;
      }

      try {
        if (willMonitor) {
          await api.enableMonitoring(repoFullName);
          showToast(`monitoring enabled: ${repoFullName}`, 'success');
        } else {
          await api.disableMonitoring(repoFullName);
          showToast(`monitoring disabled: ${repoFullName}`, 'info');
        }
        await loadDashboardData();
      } catch (err) {
        toggleInput.checked = !willMonitor;
        showToast(err.message || 'error updating webhook', 'error');
      } finally {
        toggleInput.disabled = false;
      }
    }
  });

  // Search Input
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      state.searchTerm = e.target.value.trim();
      renderView();
    });
  }
}

function renderUserBadge() {
  if (!elements.userSection) return;
  if (api.isAuthenticated() && state.user) {
    elements.userSection.innerHTML = `
      <div class="user-badge">
        <span style="color:#737373;">user:</span>
        <span style="font-weight:700;">${state.user.githubUsername}</span>
      </div>
      <button class="btn btn-secondary btn-sm" data-action="disconnect-github">DISCONNECT</button>
    `;
  } else {
    elements.userSection.innerHTML = `
      <button class="btn btn-primary btn-sm" data-action="connect-github">
        CONNECT GITHUB
      </button>
    `;
  }
}

/**
 * Master View Router & Authentication Guard
 */
function renderView() {
  if (!elements.contentArea) return;

  const isAuth = api.isAuthenticated();

  if (!isAuth) {
    document.body.classList.add('unauthenticated');
    document.body.classList.remove('authenticated');

    if (state.route !== '#/' && state.route !== '') {
      state.route = '#/';
      window.location.hash = '#/';
    }

    renderLandingView();
    renderUserBadge();
    return;
  }

  document.body.classList.add('authenticated');
  document.body.classList.remove('unauthenticated');

  if (state.route === '#/' || state.route === '') {
    state.route = '#/dashboard';
    window.location.hash = '#/dashboard';
    return;
  }

  if (state.route.startsWith('#/repo/')) {
    renderIndividualRepoView();
    renderUserBadge();
    return;
  }

  switch (state.route) {
    case '#/dashboard':
      renderDashboardView();
      break;
    case '#/add-repo':
      renderAddRepoView();
      break;
    case '#/monitoring':
      renderMonitoringView();
      break;
    case '#/settings':
      renderSettingsView();
      break;
    default:
      renderDashboardView();
  }

  renderUserBadge();
}

/**
 * 1. PURE TERMINAL LANDING VIEW (#/)
 */

/**
 * CLI Product Introduction Typewriter Sequence
 */
const CLI_INTRO_SEQUENCE = [
  { type: 'cmd', text: '$ pipelineiq --init', delayAfter: 250 },
  { type: 'out', text: '> Initializing PipelineIQ AI CI/CD Assistant...', delayAfter: 180 },
  { type: 'out_with_tag', text: '> Connecting to GitHub webhooks...', tag: '[OK]', delayAfter: 180 },
  { type: 'out_with_tag', text: '> Loading Groq Llama 3.3 70B inference engine...', tag: '[OK]', delayAfter: 280 },
  { type: 'out', text: '> Ready to analyze pipeline failures in <2s', delayAfter: 400 },
  { type: 'blank', delayAfter: 200 },
  { type: 'cmd', text: '$ pipelineiq --features', delayAfter: 280 },
  { type: 'feature', text: '   Auto-detect failed GitHub Actions workflows', delayAfter: 120 },
  { type: 'feature', text: '   AI-powered root cause diagnosis', delayAfter: 120 },
  { type: 'feature', text: '   Security-scoped auto-fix suggestions (no auto-merge)', delayAfter: 120 },
  { type: 'feature', text: '   Real-time monitoring dashboard', delayAfter: 250 },
  { type: 'blank', delayAfter: 200 },
  { type: 'prompt_final', text: '$ ' }
];

let landingAnimationPlayed = false;

function renderStaticTerminalIntroHtml() {
  return `
    <div class="cli-line cli-cmd-line">$ pipelineiq --init</div>
    <div class="cli-line">> Initializing PipelineIQ AI CI/CD Assistant...</div>
    <div class="cli-line" style="display:flex; justify-content:space-between;">
      <span>> Connecting to GitHub webhooks...</span>
      <span style="color:var(--color-success); font-weight:700;">[OK]</span>
    </div>
    <div class="cli-line" style="display:flex; justify-content:space-between;">
      <span>> Loading Groq Llama 3.3 70B inference engine...</span>
      <span style="color:var(--color-success); font-weight:700;">[OK]</span>
    </div>
    <div class="cli-line">> Ready to analyze pipeline failures in &lt;2s</div>
    <div style="height:8px;"></div>
    <div class="cli-line cli-cmd-line">$ pipelineiq --features</div>
    <div class="cli-line cli-feature-line">   Auto-detect failed GitHub Actions workflows</div>
    <div class="cli-line cli-feature-line">   AI-powered root cause diagnosis</div>
    <div class="cli-line cli-feature-line">   Security-scoped auto-fix suggestions (no auto-merge)</div>
    <div class="cli-line cli-feature-line">   Real-time monitoring dashboard</div>
    <div style="height:8px;"></div>
    <div class="cli-line cli-prompt-final"><span style="color:#FFFFFF; font-weight:700;">$ </span><span class="cursor-blink"></span></div>
  `;
}

function playTerminalIntroAnimation(containerEl) {
  if (!containerEl) return;
  
  if (landingAnimationPlayed) {
    containerEl.innerHTML = renderStaticTerminalIntroHtml();
    return;
  }

  containerEl.innerHTML = '';
  landingAnimationPlayed = true;

  let lineIdx = 0;

  function typeNextLine() {
    if (lineIdx >= CLI_INTRO_SEQUENCE.length) return;

    const item = CLI_INTRO_SEQUENCE[lineIdx];
    lineIdx++;

    if (item.type === 'blank') {
      const blankEl = document.createElement('div');
      blankEl.style.height = '8px';
      containerEl.appendChild(blankEl);
      setTimeout(typeNextLine, item.delayAfter || 150);
      return;
    }

    if (item.type === 'prompt_final') {
      const promptEl = document.createElement('div');
      promptEl.className = 'cli-line cli-prompt-final';
      promptEl.innerHTML = `<span style="color:#FFFFFF; font-weight:700;">$ </span><span class="cursor-blink"></span>`;
      containerEl.appendChild(promptEl);
      return;
    }

    const lineEl = document.createElement('div');
    lineEl.className = 'cli-line';
    
    if (item.type === 'cmd') {
      lineEl.className += ' cli-cmd-line';
    } else if (item.type === 'feature') {
      lineEl.className += ' cli-feature-line';
    } else if (item.type === 'out_with_tag') {
      lineEl.style.display = 'flex';
      lineEl.style.justifyContent = 'space-between';
    }

    containerEl.appendChild(lineEl);

    const text = item.text;
    let charIdx = 0;
    
    const textSpan = document.createElement('span');
    const tempCursor = document.createElement('span');
    tempCursor.className = 'cursor-blink';
    lineEl.appendChild(textSpan);
    lineEl.appendChild(tempCursor);

    function typeChar() {
      if (charIdx < text.length) {
        textSpan.textContent += text.charAt(charIdx);
        charIdx++;
        const speed = Math.floor(Math.random() * 15) + 20; // 20-35ms realistic speed
        setTimeout(typeChar, speed);
      } else {
        tempCursor.remove();
        if (item.tag) {
          const tagSpan = document.createElement('span');
          tagSpan.className = 'cli-tag-ok';
          tagSpan.textContent = item.tag;
          tagSpan.style.color = 'var(--color-success)';
          tagSpan.style.fontWeight = '700';
          lineEl.appendChild(tagSpan);
        }
        setTimeout(typeNextLine, item.delayAfter || 150);
      }
    }

    typeChar();
  }

  typeNextLine();
}

function renderLandingView() {
  elements.contentArea.innerHTML = `
    <div class="landing-container">
      
      <!-- Hero CLI Header -->
      <section class="hero-section">
        <div class="hero-prompt-bar">
          <span>pipelineiq/ci-assistant</span>
          <span>::</span>
          <span style="color:#FFFFFF;">v1.0.0</span>
          <span>[SYSTEM: ONLINE]</span>
        </div>

        <h1 class="hero-title">
          $ pipelineiq run --diagnose-failures<span class="cursor-blink"></span>
        </h1>

        <p class="hero-subtitle">
          Automated CI/CD failure intelligence. Captures broken build webhooks, analyzes root causes with Groq Llama 3.3 in sub-second time, and outputs security-scoped terminal remediation patches.
        </p>

        <div class="hero-cta-group">
          <button class="btn btn-primary btn-lg" data-action="connect-github">
            [+] CONNECT GITHUB REPOSITORIES
          </button>
        </div>

        <!-- Terminal Product Intro Mockup Window with Typewriter Effect -->
        <div class="term-window-mockup">
          <div class="term-window-titlebar">
            <div class="term-dots">
              <span class="term-dot"></span>
              <span class="term-dot"></span>
              <span class="term-dot"></span>
            </div>
            <div>terminal — pipelineiq --init</div>
            <div>bash</div>
          </div>
          <div class="term-intro-body" id="term-intro-container">
            <!-- Typewriter output rendered dynamically -->
          </div>
        </div>
      </section>

      <!-- Terminal Stats Matrix -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-header"><span>INFERENCE TIME</span><span>[SPEED]</span></div>
          <div class="stat-value">0.42s</div>
          <div class="stat-caption">sub-second latency</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span>ROOT CAUSE ACCURACY</span><span>[BENCH]</span></div>
          <div class="stat-value">96.8%</div>
          <div class="stat-caption">verified patches</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span>GUARDRAIL RATING</span><span>[SECURITY]</span></div>
          <div class="stat-value">CONFIG-ONLY</div>
          <div class="stat-caption">safe scoped fixes</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span>ENCRYPTION</span><span>[REST]</span></div>
          <div class="stat-value">AES-256-GCM</div>
          <div class="stat-caption">webhook tokens</div>
        </div>
      </div>

      <!-- Terminal Feature Blocks -->
      <section>
        <div style="margin-bottom:16px;">
          <h2 style="font-size:16px; font-weight:700; color:#FFFFFF; font-family:var(--font-mono);">$ pipelineiq --list-capabilities</h2>
        </div>

        <div class="features-grid-cli">
          <div class="feature-box-cli">
            <div class="cli-num">01 // TELEMETRY</div>
            <div class="cli-title">Split-Pane Terminal View</div>
            <div class="cli-desc">Raw build logs side-by-side with sticky AI diagnosis. Line numbers, error flags, and color-coded command output.</div>
          </div>

          <div class="feature-box-cli">
            <div class="cli-num">02 // INFERENCE</div>
            <div class="cli-title">Groq Llama 3.3 Reasoning</div>
            <div class="cli-desc">Sub-second stack trace parsing and error extraction. Instant plain-language root cause isolation.</div>
          </div>

          <div class="feature-box-cli">
            <div class="cli-num">03 // REMEDIATION</div>
            <div class="cli-title">Actionable Shell Patches</div>
            <div class="cli-desc">Generates exact terminal commands with isSafe security ratings. Ready to copy and execute in one keystroke.</div>
          </div>

          <div class="feature-box-cli">
            <div class="cli-num">04 // INTEGRATION</div>
            <div class="cli-title">Webhook Switchboard</div>
            <div class="cli-desc">Toggle automated CI/CD monitoring on any user or organization repository directly via the CLI interface.</div>
          </div>
        </div>
      </section>

      <!-- CLI Bottom CTA -->
      <div style="border:1px solid var(--border-subtle); padding:24px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px;">
        <div style="font-size:16px; font-weight:700; color:#FFFFFF;">Ready to integrate with your repositories?</div>
        <div style="font-size:12px; color:var(--text-dim);">Authenticate with GitHub to register failure webhooks automatically.</div>
        <button class="btn btn-primary" data-action="connect-github" style="padding:10px 24px;">
          CONNECT GITHUB TO BEGIN
        </button>
      </div>

    </div>
  `;

  // Start the Typewriter Animation
  setTimeout(() => {
    const termContainer = document.getElementById('term-intro-container');
    if (termContainer) {
      playTerminalIntroAnimation(termContainer);
    }
  }, 50);
}

/**
 * 2. OVERVIEW DASHBOARD (#/dashboard)
 */
function renderDashboardView() {
  const username = state.user?.githubUsername || 'developer';
  const isAuth = api.isAuthenticated();
  const monitored = isAuth ? (state.monitoredRepos || []) : SAMPLE_MONITORED_REPOS;
  const allFailures = isAuth ? (state.dashboardItems || []) : SAMPLE_FAILURES;
  const failures = filterFailuresByTime(allFailures, state.timeFilter);

  elements.contentArea.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">$ pipelineiq --overview --user=${username}</h1>
        <p class="page-subtitle">Repository status, active failure feeds, and AI remediation patches.</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary btn-sm" data-action="refresh-data">
          REFRESH
        </button>
        <a href="#/add-repo" class="btn btn-primary btn-sm">
          + ADD REPO
        </a>
      </div>
    </div>

    <!-- Stat Grid -->
    ${(() => {
      const analyzedFailures = failures.filter(f => f.analysis && typeof f.analysis.confidence === 'number');
      const avgConfidence = analyzedFailures.length > 0
        ? Math.round((analyzedFailures.reduce((sum, f) => sum + f.analysis.confidence, 0) / analyzedFailures.length) * 100)
        : null;
      const totalFixes = failures.reduce((sum, item) => sum + (item.analysis?.suggestedFixes?.length || 0), 0);

      return `
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-header"><span>CONNECTED REPOS</span><span>[SYS]</span></div>
            <div class="stat-value">${monitored.length}</div>
            <div class="stat-caption">active webhooks</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span>FAILURES DETECTED</span><span>[ERR]</span></div>
            <div class="stat-value">${failures.length}</div>
            <div class="stat-caption">in selected range</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span>FIXES AVAILABLE</span><span>[AI]</span></div>
            <div class="stat-value">${totalFixes}</div>
            <div class="stat-caption">actionable patches</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span>AVG CONFIDENCE</span><span>[METRIC]</span></div>
            <div class="stat-value" style="font-size:17px;">
              ${renderAsciiProgressBar(avgConfidence !== null ? avgConfidence / 100 : null, 10)}
            </div>
            <div class="stat-caption">${analyzedFailures.length > 0 ? `across ${analyzedFailures.length} completed run(s)` : 'no analyzed runs'}</div>
          </div>
        </div>
      `;
    })()}

    <!-- Connected Repos Grid -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <div class="card-title">> CONNECTED REPOSITORIES (${monitored.length})</div>
        <span class="badge badge-success">ACTIVE</span>
      </div>
      <div class="card-body">
        <div class="repo-grid">
          ${monitored.map(repo => {
            const repoFailures = failures.filter(f => f.repoFullName === repo.repoFullName);
            const hasRecentFailure = repoFailures.length > 0;
            const lastFailure = repoFailures[0];

            return `
              <a href="#/repo/${repo.repoFullName}" class="repo-card">
                <div class="repo-card-header">
                  <div class="repo-card-title">${repo.repoFullName}</div>
                  ${hasRecentFailure ? '<span class="badge badge-danger">FAILED</span>' : '<span class="badge badge-success">PASS</span>'}
                </div>

                <div style="font-size:11.5px; color:var(--text-dim);">
                  ${lastFailure ? `last: ${lastFailure.pipelineName || 'build'}` : 'all workflows passing'}
                </div>

                <div class="repo-card-footer">
                  <span>${formatRelativeTime(repo.lastEventAt || repo.createdAt)}</span>
                  <span style="color:#FFFFFF; font-weight:700;">INSPECT -></span>
                </div>
              </a>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Live Split-Pane Failure Stream Section -->
    <div style="margin-top: 24px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h2 style="font-size:15px; font-weight:700; color:#FFFFFF;">> LIVE FAILURE LOG STREAM</h2>
        <div style="display:flex; align-items:center; gap:8px;">
          ${renderTimeFilterDropdown()}
          <a href="#/monitoring" class="btn btn-secondary btn-sm">VIEW ALL</a>
        </div>
      </div>

      ${renderFailuresListHtml(failures)}
    </div>
  `;
}

/**
 * 3. ADD REPOSITORY VIEW (#/add-repo)
 */
function renderAddRepoView() {
  const isAuth = api.isAuthenticated();
  const allRepos = isAuth ? (state.repos || []) : SAMPLE_ALL_REPOS;
  const monitored = isAuth ? (state.monitoredRepos || []) : SAMPLE_MONITORED_REPOS;

  const filteredRepos = allRepos.filter(r => 
    !state.searchTerm || 
    r.name?.toLowerCase().includes(state.searchTerm.toLowerCase()) || 
    r.fullName?.toLowerCase().includes(state.searchTerm.toLowerCase())
  );

  elements.contentArea.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">$ pipelineiq --repos --switchboard</h1>
        <p class="page-subtitle">Toggle automated webhook monitoring for your GitHub repositories.</p>
      </div>
      <button class="btn btn-secondary btn-sm" data-action="refresh-data">
        REFRESH
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">> REPOSITORIES (${allRepos.length})</div>
        <span class="badge badge-success">${monitored.length} MONITORED</span>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="repo-list">
          ${filteredRepos.length > 0 ? filteredRepos.map(repo => {
            const isMon = isAuth ? repo.isMonitored : Boolean(repo.isMonitored);
            return `
              <div class="repo-item">
                <div class="repo-info">
                  <div class="repo-icon-wrap">git</div>
                  <div class="repo-details">
                    <a href="${repo.htmlUrl || `https://github.com/${repo.fullName}`}" target="_blank" rel="noreferrer" class="repo-name">
                      ${repo.fullName}
                      ${repo.isPrivate ? '<span class="badge badge-subtle">PRIVATE</span>' : '<span class="badge badge-subtle">PUBLIC</span>'}
                    </a>
                    <div class="repo-meta">
                      <span>branch: ${repo.defaultBranch || 'main'}</span>
                      ${repo.language ? `<span>• ${repo.language}</span>` : ''}
                      ${isMon ? '<span class="badge badge-success">ACTIVE</span>' : ''}
                    </div>
                  </div>
                </div>

                <div style="display:flex; align-items:center; gap:12px;">
                  <label class="toggle-switch">
                    <input 
                      type="checkbox" 
                      data-repo-toggle="${repo.fullName}"
                      ${isMon ? 'checked' : ''} 
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
            `;
          }).join('') : `
            <div class="empty-state">
              <div class="empty-title">no repositories found</div>
              <div class="empty-desc">no repositories match filter: "${state.searchTerm}"</div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

/**
 * 4. OVERALL MONITORING VIEW (#/monitoring)
 */
function renderMonitoringView() {
  const isAuth = api.isAuthenticated();
  const allFailures = isAuth ? (state.dashboardItems || []) : SAMPLE_FAILURES;
  const failures = filterFailuresByTime(allFailures, state.timeFilter);
  const monitored = isAuth ? (state.monitoredRepos || []) : SAMPLE_MONITORED_REPOS;

  const totalFailures = failures.length;
  const totalFixesSuggested = failures.reduce((sum, item) => sum + (item.analysis?.suggestedFixes?.length || 0), 0);

  elements.contentArea.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">$ pipelineiq --monitoring --all</h1>
        <p class="page-subtitle">Aggregated metrics and real-time failure telemetry across all monitored repositories.</p>
      </div>
      <button class="btn btn-secondary btn-sm" data-action="refresh-data">
        REFRESH
      </button>
    </div>

    <!-- Stat Cards -->
    ${(() => {
      const analyzedFailures = failures.filter(f => f.analysis && typeof f.analysis.confidence === 'number');
      const avgConfidence = analyzedFailures.length > 0
        ? Math.round((analyzedFailures.reduce((sum, f) => sum + f.analysis.confidence, 0) / analyzedFailures.length) * 100)
        : null;

      return `
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-header"><span>TOTAL MONITORED</span><span>[COUNT]</span></div>
            <div class="stat-value">${monitored.length}</div>
            <div class="stat-caption">active webhooks</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span>FAILURES DETECTED</span><span>[FAIL]</span></div>
            <div class="stat-value">${totalFailures}</div>
            <div class="stat-caption">in selected range</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span>FIXES SUGGESTED</span><span>[PATCH]</span></div>
            <div class="stat-value">${totalFixesSuggested}</div>
            <div class="stat-caption">remediation options</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span>AVG CONFIDENCE</span><span>[SCORE]</span></div>
            <div class="stat-value" style="font-size:17px;">
              ${renderAsciiProgressBar(avgConfidence !== null ? avgConfidence / 100 : null, 10)}
            </div>
            <div class="stat-caption">${analyzedFailures.length > 0 ? `across ${analyzedFailures.length} completed run(s)` : 'no analyzed runs'}</div>
          </div>
        </div>
      `;
    })()}

    <!-- Combined Failure Stream -->
    <div style="margin-top: 20px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h2 style="font-size:15px; font-weight:700; color:#FFFFFF;">> ALL FAILURES STREAM (${failures.length} of ${allFailures.length})</h2>
        ${renderTimeFilterDropdown()}
      </div>
      ${renderFailuresListHtml(failures)}
    </div>
  `;
}

/**
 * 5. INDIVIDUAL REPO VIEW (#/repo/:owner/:name)
 */
function renderIndividualRepoView() {
  const { repoFullName } = state.routeParams;
  if (!repoFullName) {
    window.location.hash = '#/dashboard';
    return;
  }

  const isAuth = api.isAuthenticated();
  const monitored = isAuth ? (state.monitoredRepos || []) : SAMPLE_MONITORED_REPOS;
  const allRepos = isAuth ? (state.repos || []) : SAMPLE_ALL_REPOS;
  const failures = isAuth ? (state.dashboardItems || []) : SAMPLE_FAILURES;

  const monitoredRecord = monitored.find(r => r.repoFullName === repoFullName);
  const repoMeta = allRepos.find(r => (r.fullName || r.repoFullName) === repoFullName) || monitoredRecord?.repoMeta;
  const isMonitored = Boolean(monitoredRecord);

  const repoFailures = failures.filter(f => f.repoFullName === repoFullName);
  const totalFixes = repoFailures.reduce((sum, item) => sum + (item.analysis?.suggestedFixes?.length || 0), 0);

  elements.contentArea.innerHTML = `
    <div class="breadcrumbs">
      <a href="#/dashboard">dashboard</a>
      <span>/</span>
      <span style="color:#FFFFFF; font-weight:700;">${repoFullName}</span>
    </div>

    <div class="page-header" style="background:#050505; padding:16px; margin-bottom:20px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h1 style="font-size:18px; font-weight:700; color:#FFFFFF;">${repoFullName}</h1>
            <a href="https://github.com/${repoFullName}" target="_blank" rel="noreferrer" class="btn btn-secondary btn-sm">
              GITHUB ->
            </a>
          </div>
          <p style="font-size:12px; color:var(--text-dim); margin-top:4px;">
            default branch: ${repoMeta?.defaultBranch || 'main'}
            ${repoMeta?.language ? ` • ${repoMeta.language}` : ''}
          </p>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:12px; color:var(--text-dim);">MONITORING:</span>
        <label class="toggle-switch">
          <input 
            type="checkbox" 
            data-repo-toggle="${repoFullName}"
            ${isMonitored ? 'checked' : ''} 
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- Scoped Stat Cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-header"><span>FAILURES IN REPO</span><span>[COUNT]</span></div>
        <div class="stat-value">${repoFailures.length}</div>
        <div class="stat-caption">incidents recorded</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span>FIXES AVAILABLE</span><span>[PATCH]</span></div>
        <div class="stat-value">${totalFixes}</div>
        <div class="stat-caption">remediation options</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span>LAST FAILURE</span><span>[TIME]</span></div>
        <div class="stat-value" style="font-size:16px;">${formatRelativeTime(repoFailures[0]?.createdAt)}</div>
        <div class="stat-caption">${repoFailures[0]?.branch || 'none'}</div>
      </div>
    </div>

    <div style="margin-top: 20px;">
      <h2 style="font-size:15px; font-weight:700; color:#FFFFFF; margin-bottom:12px;">> FAILURE HISTORY FOR ${repoFullName}</h2>
      ${renderFailuresListHtml(repoFailures)}
    </div>
  `;
}

/**
 * 6. SETTINGS VIEW (#/settings)
 */
function renderSettingsView() {
  const user = state.user;
  const isAuth = api.isAuthenticated();

  elements.contentArea.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">$ pipelineiq --config --security</h1>
        <p class="page-subtitle">Configure GitHub integration, security encryption, and AI provider parameters.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">> AUTHENTICATION STATUS</div>
      </div>
      <div class="card-body">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="font-size:14px; font-weight:700; color:#FFFFFF;">${user?.githubUsername || (isAuth ? 'AUTHENTICATED' : 'NOT CONNECTED')}</div>
            <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">
              ${isAuth ? `GITHUB ID: ${user?.githubId || 'active'} • LAST LOGIN: ${formatRelativeTime(user?.lastLoginAt)}` : 'Authorize to enable automated repository webhooks'}
            </div>
          </div>
          ${isAuth ? `
            <button class="btn btn-danger btn-sm" data-action="disconnect-github">DISCONNECT GITHUB</button>
          ` : `
            <button class="btn btn-primary btn-sm" data-action="connect-github">CONNECT GITHUB</button>
          `}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">> ENGINE & SECURITY PARAMETERS</div>
      </div>
      <div class="card-body" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:8px;">
          <div>
            <div style="font-weight:700; color:#FFFFFF;">LLM PROVIDER</div>
            <div style="font-size:11px; color:var(--text-dim);">Groq Llama 3.3 70B Versatile for sub-second log reasoning</div>
          </div>
          <span class="badge badge-success">ONLINE</span>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:8px;">
          <div>
            <div style="font-weight:700; color:#FFFFFF;">ENCRYPTION CIPHER</div>
            <div style="font-size:11px; color:var(--text-dim);">AES-256-GCM authenticated cipher with randomized IVs</div>
          </div>
          <span class="badge badge-success">ENCRYPTED</span>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:700; color:#FFFFFF;">GUARDRAIL POLICY</div>
            <div style="font-size:11px; color:var(--text-dim);">Strict config scoping, zero automated branch merging</div>
          </div>
          <span class="badge badge-success">ENFORCED</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Split-Pane Failure List Generator (Terminal Theme with ASCII Confidence Gauge)
 */
function renderFailuresListHtml(items) {
  if (!items || items.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-title">> ALL PIPELINES PASSING</div>
        <div class="empty-desc">no active failures found in this filter range.</div>
      </div>
    `;
  }

  return items.map((item, index) => {
    const analysis = item.analysis;
    const hasAnalysis = Boolean(analysis && (analysis.rootCause || analysis.summary));
    const ageMs = item.createdAt ? (Date.now() - new Date(item.createdAt).getTime()) : 0;
    const isStuckOrFailed = Boolean(
      item.isAnalysisFailed ||
      item.status === 'failed' ||
      (!hasAnalysis && ageMs > 3 * 60 * 1000)
    );

    const confidenceVal = hasAnalysis && analysis.confidence != null ? analysis.confidence : null;
    const fixes = analysis?.suggestedFixes || [];
    const drawerId = `drawer-${item.id || index}`;
    const logData = formatTerminalLogs(item.rawLogs, item.repoFullName, item.pipelineName);

    return `
      <div class="failure-card">
        <div class="failure-header">
          <div class="failure-title-group">
            <span class="badge badge-danger">FAILED</span>
            <a href="#/repo/${item.repoFullName}" class="failure-repo">${item.repoFullName || 'repository'}</a>
            <span class="failure-branch">${item.branch || 'main'}</span>
            ${item.commitSha ? `<span style="font-size:11px; color:var(--text-dim);">#${item.commitSha.substring(0, 7)}</span>` : ''}
          </div>
          <div style="font-size:11px; color:var(--text-dim);">
            ${formatRelativeTime(item.createdAt)}
          </div>
        </div>

        <div class="failure-body">
          <div class="failure-split-view">
            
            <!-- Left Panel: Terminal Logs (~60%) -->
            <div class="log-panel">
              <div class="log-panel-header">
                <div class="log-panel-title">
                  <span>build.log [${logData.lineCount} lines]</span>
                </div>
                <div>
                  <button class="btn-copy-logs" data-action="copy-logs" data-log-id="${item.id || index}">
                    COPY LOGS
                  </button>
                </div>
              </div>
              <div class="log-viewport" id="log-viewport-${item.id || index}">
                ${logData.html}
              </div>
              <textarea id="raw-log-content-${item.id || index}" style="display:none;">${escapeHtml(logData.raw)}</textarea>
            </div>

            <!-- Right Panel: AI Diagnosis (~40% Sticky) -->
            <div class="diagnosis-panel">
              <!-- Root Cause Diagnosis Box -->
              ${isStuckOrFailed ? `
                <div class="root-cause-box" style="border-left-color: #525252;">
                  <div class="root-cause-label">[!] ANALYSIS INCOMPLETE</div>
                  <div class="root-cause-text" style="color:var(--text-dim);">
                    Analysis failed — no results available. (Log analysis job timed out or failed).
                  </div>
                </div>
              ` : hasAnalysis ? `
                <div class="root-cause-box">
                  <div class="root-cause-label">:: ROOT CAUSE DIAGNOSIS</div>
                  <div class="root-cause-text">
                    ${analysis.rootCause || analysis.summary}
                  </div>
                </div>
              ` : `
                <div class="root-cause-box" style="border-left-color: var(--color-warning);">
                  <div class="root-cause-label" style="color:var(--color-warning);">[i] ANALYZING LOGS...</div>
                  <div class="root-cause-text" style="color:var(--text-dim);">
                    Failure logs ingested. Processing with Groq LLM engine...
                  </div>
                </div>
              `}

              <!-- ASCII Confidence Meter -->
              ${confidenceVal !== null ? `
                <div class="ascii-confidence-box">
                  <span style="color:var(--text-dim);">CONFIDENCE:</span>
                  <span class="ascii-bar">${renderAsciiProgressBar(confidenceVal, 12)}</span>
                </div>
              ` : ''}

              <!-- Suggested Fixes Card List -->
              ${fixes.length > 0 ? `
                <div>
                  <button class="fix-drawer-toggle" data-action="toggle-fix-drawer" data-target="${drawerId}">
                    <span>SUGGESTED PATCHES (${fixes.length})</span>
                    <span>[+/-]</span>
                  </button>

                  <div id="${drawerId}" class="fix-drawer-content" style="display:flex;">
                    ${fixes.map((fix, fixIdx) => `
                      <div class="fix-item">
                        <div class="fix-item-header">
                          <div class="fix-title">${fix.title || `PATCH #${fixIdx + 1}`}</div>
                          ${fix.isSafe ? '<span class="badge badge-success">SAFE</span>' : '<span class="badge badge-warning">REVIEW</span>'}
                        </div>
                        
                        ${fix.description ? `<p style="font-size:11.5px; color:var(--text-dim);">${fix.description}</p>` : ''}

                        ${fix.commands && fix.commands.length > 0 ? `
                          <div style="display:flex; flex-direction:column; gap:2px; margin-top:2px;">
                            <div class="command-snippet">
                              <code>$ ${fix.commands.join(' && ')}</code>
                              <button class="copy-btn" data-action="copy-command" data-command="${fix.commands.join(' && ').replace(/"/g, '&quot;')}" title="Copy command">
                                COPY
                              </button>
                            </div>
                          </div>
                        ` : ''}

                        ${fix.estimatedTime ? `
                          <div style="font-size:10.5px; color:var(--text-dim);">
                            est: ${fix.estimatedTime}
                          </div>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function loadDashboardData() {
  if (!api.isAuthenticated()) return;
  state.loading = true;
  try {
    const [userRes, reposRes, monitoredRes, dashboardRes] = await Promise.allSettled([
      api.getMe(),
      api.getRepos(),
      api.getMonitoredRepos(),
      api.getDashboard(),
    ]);

    if (userRes.status === 'fulfilled') state.user = userRes.value.user;
    if (reposRes.status === 'fulfilled') state.repos = reposRes.value.repos || [];
    if (monitoredRes.status === 'fulfilled') state.monitoredRepos = monitoredRes.value.repos || [];
    if (dashboardRes.status === 'fulfilled') state.dashboardItems = dashboardRes.value.items || [];

    renderUserBadge();
    renderView();
  } catch (err) {
    showToast(err.message || 'telemetry load error', 'error');
  } finally {
    state.loading = false;
  }
}

async function checkHealth() {
  try {
    const health = await api.getHealth();
    state.health = health;
    if (elements.healthIndicator) {
      elements.healthIndicator.title = `ENGINE: ONLINE (uptime: ${Math.round(health.uptime)}s)`;
    }
  } catch (e) {
    console.warn('Health check failed:', e);
  }
}

export async function initApp() {
  initElements();
  setupEventDelegation();

  const tokenFromUrl = api.extractUrlToken();
  if (tokenFromUrl) {
    showToast('authenticated successfully', 'success');
    window.location.hash = '#/dashboard';
  }

  handleHashRoute();

  if (api.isAuthenticated()) {
    await loadDashboardData();
  }

  await checkHealth();

  setInterval(() => {
    if (api.isAuthenticated() && !document.hidden) {
      loadDashboardData();
    }
  }, 20000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
