/**
 * PipelineIQ — API Client & In-Memory Token Manager
 * Pure in-memory JWT storage with zero localStorage/sessionStorage persistence.
 */

// Private in-memory token store (closure variable)
let _inMemoryToken = null;

export const api = {
  /**
   * Set the authentication token in memory
   * @param {string|null} token
   */
  setToken(token) {
    _inMemoryToken = token;
  },

  /**
   * Get the current in-memory token
   * @returns {string|null}
   */
  getToken() {
    return _inMemoryToken;
  },

  /**
   * Clear the in-memory token (logout)
   */
  clearToken() {
    _inMemoryToken = null;
  },

  /**
   * Check if user is currently authenticated in memory
   * @returns {boolean}
   */
  isAuthenticated() {
    return Boolean(_inMemoryToken && typeof _inMemoryToken === 'string' && _inMemoryToken.length > 10);
  },

  /**
   * Check URL search params for ?token=JWT after OAuth callback.
   * If found, captures token in memory and immediately sanitizes the URL.
   * @returns {string|null}
   */
  extractUrlToken() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      if (token) {
        this.setToken(token);
        // Clean URL immediately without page reload to prevent token leakage
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        return token;
      }
    } catch (err) {
      console.error('Error extracting token from URL:', err);
    }
    return null;
  },

  /**
   * Low-level fetch wrapper with Bearer token injection and error handling
   */
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (_inMemoryToken) {
      headers['Authorization'] = `Bearer ${_inMemoryToken}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized (expired or invalid token)
    if (response.status === 401) {
      this.clearToken();
      const err = new Error('Authentication expired. Please connect GitHub again.');
      err.status = 401;
      throw err;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || data.message || `HTTP ${response.status}: Request failed`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  // --------------------------------------------------------------------------
  // API Endpoints
  // --------------------------------------------------------------------------

  /**
   * Redirect browser to backend OAuth flow
   */
  startOAuth() {
    window.location.href = '/api/v1/github/auth';
  },

  /**
   * GET /api/v1/github/me — Current authenticated user profile
   */
  async getMe() {
    return this.request('/api/v1/github/me');
  },

  /**
   * GET /api/v1/github/repos — List user's GitHub repositories
   */
  async getRepos() {
    return this.request('/api/v1/github/repos');
  },

  /**
   * POST /api/v1/github/repos/monitor — Enable webhook monitoring for repo
   */
  async enableMonitoring(repoFullName) {
    return this.request('/api/v1/github/repos/monitor', {
      method: 'POST',
      body: JSON.stringify({ repoFullName }),
    });
  },

  /**
   * DELETE /api/v1/github/repos/monitor — Disable webhook monitoring for repo
   */
  async disableMonitoring(repoFullName) {
    return this.request('/api/v1/github/repos/monitor', {
      method: 'DELETE',
      body: JSON.stringify({ repoFullName }),
    });
  },

  /**
   * GET /api/v1/github/repos/monitored — List all currently monitored repos
   */
  async getMonitoredRepos() {
    return this.request('/api/v1/github/repos/monitored');
  },

  /**
   * GET /api/v1/github/dashboard — Real-time failure analysis feed
   */
  async getDashboard() {
    return this.request('/api/v1/github/dashboard');
  },

  /**
   * GET /health — System health status
   */
  async getHealth() {
    return this.request('/health');
  },
};
