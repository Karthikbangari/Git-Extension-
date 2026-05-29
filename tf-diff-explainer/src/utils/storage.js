// Loaded first by the content_scripts array — exposes TFEStorage on window
window.TFEStorage = {
  get(keys) {
    return chrome.storage.local.get(keys);
  },
  set(items) {
    return chrome.storage.local.set(items);
  },
  async getApiKey() {
    const { apiKey } = await this.get('apiKey');
    return apiKey || null;
  },
  async isEnabledForHost(host) {
    const { disabledHosts = [] } = await this.get('disabledHosts');
    return !disabledHosts.includes(host);
  },
  async toggleHost(host, enabled) {
    const { disabledHosts = [] } = await this.get('disabledHosts');
    const updated = enabled
      ? disabledHosts.filter((h) => h !== host)
      : [...new Set([...disabledHosts, host])];
    return this.set({ disabledHosts: updated });
  },
};
