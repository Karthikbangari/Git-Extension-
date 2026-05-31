// GFE screenshot generator — renders faithful HTML mockups at 1280×800
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../git-file-explainer/store/screenshots'
);

mkdirSync(OUT_DIR, { recursive: true });

const SIDEBAR_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  #git-file-explainer-sidebar {
    position: fixed; top: 0; right: 0; width: 340px; height: 100vh;
    z-index: 9999; display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px; box-shadow: -2px 0 12px rgba(0,0,0,0.15);
    background: #ffffff;
  }
  .gfe-header {
    background: linear-gradient(135deg, #1b1f27 0%, #0d1117 100%);
    padding: 10px 12px 8px; flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .gfe-header-row { display: flex; align-items: center; gap: 8px; }
  .gfe-title {
    flex: 1; font-size: 12px; font-weight: 600; color: #f0f6fc;
    letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .gfe-title::before { content: '◈ '; color: #34d399; font-size: 10px; }
  .gfe-toggle {
    background: none; border: none; color: #8b949e; font-size: 16px; cursor: pointer;
    padding: 2px 6px; border-radius: 4px; line-height: 1; flex-shrink: 0;
  }
  .gfe-body {
    flex: 1; overflow-y: auto; padding: 12px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .gfe-chip {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;
    border-radius: 12px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
    align-self: flex-start;
  }
  .gfe-chip-medium { background: #fef9c3; color: #854d0e; }
  .gfe-chip-high   { background: #fee2e2; color: #991b1b; }
  .gfe-summary { font-size: 12.5px; line-height: 1.6; color: #1f2328; }
  .gfe-subheading {
    font-size: 11px; font-weight: 600; color: #57606a;
    text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px;
  }
  .gfe-list { padding-left: 16px; display: flex; flex-direction: column; gap: 5px; }
  .gfe-list li { font-size: 12px; line-height: 1.55; color: #1f2328; }
  .gfe-separator { border: none; border-top: 1px solid #d0d7de; margin: 4px 0; }
  .gfe-qa-section { display: flex; flex-direction: column; gap: 8px; }
  .gfe-qa-input {
    width: 100%; box-sizing: border-box; resize: vertical; min-height: 60px;
    padding: 8px; font-size: 12px; font-family: inherit;
    border: 1px solid #d0d7de; border-radius: 6px;
    color: #1f2328; background: #f6f8fa;
  }
  .gfe-qa-btn {
    align-self: flex-end; padding: 5px 14px; font-size: 12px; font-weight: 600;
    color: #fff; background: #0969da; border: none; border-radius: 6px; cursor: pointer;
  }
  .gfe-qa-answer { display: flex; flex-direction: column; gap: 6px; }
  .gfe-qa-text {
    font-size: 12.5px; line-height: 1.6; color: #1f2328; padding: 10px;
    background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px;
  }
`;

const POPUP_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 300px; font-family: -apple-system, BlinkMacSystemFont,'Segoe UI',sans-serif; font-size: 13px; color: #1f2328; background: #fff; }
  header { padding: 13px 16px 12px; background: linear-gradient(135deg,#1b1f27 0%,#0d1117 100%); border-bottom:1px solid rgba(255,255,255,0.06); }
  h1 { font-size:13px; font-weight:600; color:#f0f6fc; display:flex; align-items:center; gap:7px; letter-spacing:0.01em; }
  h1::before { content:'◈'; font-size:9px; color:#34d399; }
  main { padding:14px 16px; display:flex; flex-direction:column; gap:16px; }
  .field { display:flex; flex-direction:column; gap:6px; }
  label { font-weight:500; font-size:12px; color:#57606a; }
  .input-row { display:flex; gap:6px; }
  input[type=password] {
    flex:1; padding:6px 9px; border:1px solid #d0d7de; border-radius:6px;
    font-size:12px; font-family:ui-monospace,'SFMono-Regular',monospace;
    background:#f6f8fa; color:#1f2328;
  }
  button#save-key {
    padding:6px 13px; background:#0969da; color:#fff; border:none;
    border-radius:6px; font-size:12px; font-weight:500; cursor:pointer;
  }
  .hint { font-size:11px; color:#57606a; line-height:1.4; }
  .hint.success { color:#1a7f37; }
  .toggle-label { display:flex; align-items:center; justify-content:space-between; cursor:pointer; font-weight:500; font-size:12px; color:#57606a; }
  .toggle-switch {
    width:36px; height:20px; background:#0969da; border-radius:10px; position:relative; flex-shrink:0;
    transition:background 0.2s;
  }
  .toggle-switch::after {
    content:''; position:absolute; top:2px; left:18px; width:16px; height:16px;
    background:#fff; border-radius:50%; transition:left 0.2s;
  }
  .onboarding-banner {
    background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 14px;
    display:flex; flex-direction:column; gap:8px;
  }
  .onboarding-title { font-size:12px; font-weight:600; color:#166534; }
  .onboarding-steps { padding-left:18px; display:flex; flex-direction:column; gap:4px; }
  .onboarding-steps li { font-size:12px; color:#1f2328; line-height:1.5; }
  .onboarding-steps a { color:#0969da; }
`;

// ── GitHub file-view background (simplified) ──────────────────────────────
const GITHUB_BG = `
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0d1117; color:#e6edf3; }
  .gh-header { background:#161b22; border-bottom:1px solid #30363d; padding:16px 32px; display:flex; align-items:center; gap:12px; }
  .gh-logo { color:#e6edf3; font-size:24px; font-weight:900; }
  .gh-breadcrumb { font-size:14px; color:#8b949e; }
  .gh-breadcrumb a { color:#58a6ff; text-decoration:none; }
  .gh-content { padding:24px 32px 0; padding-right:380px; }
  .gh-file-header { background:#161b22; border:1px solid #30363d; border-radius:6px 6px 0 0; padding:10px 16px; display:flex; align-items:center; justify-content:space-between; }
  .gh-file-name { font-size:13px; color:#e6edf3; font-family:ui-monospace,'SFMono-Regular',monospace; }
  .gh-file-meta { font-size:12px; color:#8b949e; }
  .gh-code-area { background:#0d1117; border:1px solid #30363d; border-top:none; border-radius:0 0 6px 6px; }
  .gh-line { display:flex; font-family:ui-monospace,'SFMono-Regular',monospace; font-size:12px; line-height:20px; }
  .gh-ln { color:#8b949e; padding:0 12px 0 16px; user-select:none; min-width:48px; text-align:right; border-right:1px solid #21262d; }
  .gh-lc { padding:0 16px; color:#e6edf3; white-space:pre; }
  .kw { color:#ff7b72; } .fn { color:#d2a8ff; } .st { color:#a5d6ff; } .cm { color:#8b949e; }
  .num { color:#79c0ff; } .ty { color:#ffa657; }
`;

// ── Page 1: full sidebar with summary + key points + Q&A input ────────────
const PAGE1_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
${GITHUB_BG}
${SIDEBAR_CSS}
</style></head><body>
<div class="gh-header">
  <div class="gh-logo">◈</div>
  <div class="gh-breadcrumb">
    <a href="#">anthropics</a> / <a href="#">anthropic-sdk-python</a> / blob / main /
    <strong style="color:#e6edf3">src/anthropic/_client.py</strong>
  </div>
</div>
<div class="gh-content">
  <div class="gh-file-header">
    <span class="gh-file-name">src/anthropic/_client.py</span>
    <span class="gh-file-meta">842 lines · 28.4 KB</span>
  </div>
  <div class="gh-code-area">
    <div class="gh-line"><span class="gh-ln">1</span><span class="gh-lc"><span class="kw">from</span> __future__ <span class="kw">import</span> annotations</span></div>
    <div class="gh-line"><span class="gh-ln">2</span><span class="gh-lc"></span></div>
    <div class="gh-line"><span class="gh-ln">3</span><span class="gh-lc"><span class="kw">import</span> os</span></div>
    <div class="gh-line"><span class="gh-ln">4</span><span class="gh-lc"><span class="kw">import</span> asyncio</span></div>
    <div class="gh-line"><span class="gh-ln">5</span><span class="gh-lc"><span class="kw">from</span> typing <span class="kw">import</span> Union, Mapping</span></div>
    <div class="gh-line"><span class="gh-ln">6</span><span class="gh-lc"></span></div>
    <div class="gh-line"><span class="gh-ln">7</span><span class="gh-lc"><span class="kw">from</span> ._base_client <span class="kw">import</span> SyncAPIClient, AsyncAPIClient</span></div>
    <div class="gh-line"><span class="gh-ln">8</span><span class="gh-lc"><span class="kw">from</span> .resources <span class="kw">import</span> Messages, AsyncMessages</span></div>
    <div class="gh-line"><span class="gh-ln">9</span><span class="gh-lc"></span></div>
    <div class="gh-line"><span class="gh-ln">10</span><span class="gh-lc"><span class="ty">DEFAULT_MAX_RETRIES</span> = <span class="num">2</span></span></div>
    <div class="gh-line"><span class="gh-ln">11</span><span class="gh-lc"><span class="ty">DEFAULT_TIMEOUT</span> = <span class="num">600.0</span></span></div>
    <div class="gh-line"><span class="gh-ln">12</span><span class="gh-lc"></span></div>
    <div class="gh-line"><span class="gh-ln">13</span><span class="gh-lc"><span class="kw">class</span> <span class="fn">Anthropic</span>(SyncAPIClient):</span></div>
    <div class="gh-line"><span class="gh-ln">14</span><span class="gh-lc">    <span class="cm"># Sync client — wraps SyncAPIClient</span></span></div>
    <div class="gh-line"><span class="gh-ln">15</span><span class="gh-lc">    messages: Messages</span></div>
    <div class="gh-line"><span class="gh-ln">16</span><span class="gh-lc"></span></div>
    <div class="gh-line"><span class="gh-ln">17</span><span class="gh-lc">    <span class="kw">def</span> <span class="fn">__init__</span>(</span></div>
    <div class="gh-line"><span class="gh-ln">18</span><span class="gh-lc">        self,</span></div>
    <div class="gh-line"><span class="gh-ln">19</span><span class="gh-lc">        *,</span></div>
    <div class="gh-line"><span class="gh-ln">20</span><span class="gh-lc">        api_key: str | None = <span class="kw">None</span>,</span></div>
    <div class="gh-line"><span class="gh-ln">21</span><span class="gh-lc">        base_url: str | None = <span class="kw">None</span>,</span></div>
    <div class="gh-line"><span class="gh-ln">22</span><span class="gh-lc">        timeout: float = <span class="ty">DEFAULT_TIMEOUT</span>,</span></div>
    <div class="gh-line"><span class="gh-ln">23</span><span class="gh-lc">        max_retries: int = <span class="ty">DEFAULT_MAX_RETRIES</span>,</span></div>
    <div class="gh-line"><span class="gh-ln">24</span><span class="gh-lc">    ) -> <span class="kw">None</span>:</span></div>
    <div class="gh-line"><span class="gh-ln">25</span><span class="gh-lc">        <span class="fn">super</span>().__init__(api_key=api_key or os.environ.get(<span class="st">"ANTHROPIC_API_KEY"</span>, <span class="st">""</span>))</span></div>
    <div class="gh-line"><span class="gh-ln">26</span><span class="gh-lc">        self.messages = <span class="fn">Messages</span>(self)</span></div>
    <div class="gh-line"><span class="gh-ln">27</span><span class="gh-lc"></span></div>
    <div class="gh-line"><span class="gh-ln">28</span><span class="gh-lc">    <span class="kw">async def</span> <span class="fn">close</span>(self) -> <span class="kw">None</span>:</span></div>
    <div class="gh-line"><span class="gh-ln">29</span><span class="gh-lc">        await self._client.aclose()</span></div>
  </div>
</div>

<div id="git-file-explainer-sidebar">
  <div class="gfe-header">
    <div class="gfe-header-row">
      <button class="gfe-toggle gfe-collapse-btn" aria-label="Collapse sidebar">‹</button>
      <span class="gfe-title">Git File Explainer</span>
      <button class="gfe-toggle gfe-expand-btn" aria-label="Expand sidebar">›</button>
    </div>
  </div>
  <div class="gfe-body">
    <span class="gfe-chip gfe-chip-medium">● MEDIUM</span>
    <p class="gfe-summary">
      The main entry point for the Anthropic Python SDK. Exports both a synchronous
      <code>Anthropic</code> client and an asynchronous <code>AsyncAnthropic</code> client,
      each wrapping a shared <code>_BaseClient</code> with retry logic, timeout configuration,
      and API key resolution from the environment.
    </p>
    <p class="gfe-subheading">Key Points</p>
    <ul class="gfe-list">
      <li>Synchronous <code>Anthropic</code> and async <code>AsyncAnthropic</code> classes share a common base</li>
      <li>API key falls back to <code>ANTHROPIC_API_KEY</code> env var if not passed directly</li>
      <li>Default timeout is 600 s; default retry count is 2 — both configurable per-instance</li>
      <li>All resource namespaces (Messages, Models, Files) are instantiated in <code>__init__</code></li>
      <li>Streaming helpers live on the resource classes, not the top-level client</li>
    </ul>
    <hr class="gfe-separator">
    <div class="gfe-qa-section">
      <p class="gfe-subheading">Ask a question</p>
      <textarea class="gfe-qa-input" placeholder="Ask about this file… (280 chars max)"></textarea>
      <button class="gfe-qa-btn">Ask</button>
    </div>
  </div>
</div>
</body></html>`;

// ── Page 2: Q&A interaction close-up ─────────────────────────────────────
const PAGE2_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
${GITHUB_BG}
${SIDEBAR_CSS}
#git-file-explainer-sidebar { width: 420px; font-size: 13.5px; }
</style></head><body>
<div class="gh-header">
  <div class="gh-logo">◈</div>
  <div class="gh-breadcrumb">
    <a href="#">anthropics</a> / <a href="#">anthropic-sdk-python</a> / blob / main /
    <strong style="color:#e6edf3">src/anthropic/_client.py</strong>
  </div>
</div>
<div class="gh-content" style="padding-right:460px;">
  <div class="gh-file-header">
    <span class="gh-file-name">src/anthropic/_client.py</span>
    <span class="gh-file-meta">842 lines · 28.4 KB</span>
  </div>
  <div class="gh-code-area">
    <div class="gh-line"><span class="gh-ln">13</span><span class="gh-lc"><span class="kw">class</span> <span class="fn">Anthropic</span>(SyncAPIClient):</span></div>
    <div class="gh-line"><span class="gh-ln">14</span><span class="gh-lc">    messages: Messages</span></div>
    <div class="gh-line"><span class="gh-ln">15</span><span class="gh-lc">    <span class="kw">def</span> <span class="fn">__init__</span>(self, *, api_key=<span class="kw">None</span>, timeout=<span class="num">600.0</span>, max_retries=<span class="num">2</span>):</span></div>
    <div class="gh-line"><span class="gh-ln">16</span><span class="gh-lc">        <span class="fn">super</span>().__init__(api_key=api_key or os.environ.get(<span class="st">"ANTHROPIC_API_KEY"</span>))</span></div>
    <div class="gh-line"><span class="gh-ln">17</span><span class="gh-lc">        self.messages = <span class="fn">Messages</span>(self)</span></div>
  </div>
</div>

<div id="git-file-explainer-sidebar">
  <div class="gfe-header">
    <div class="gfe-header-row">
      <button class="gfe-toggle gfe-collapse-btn" aria-label="Collapse sidebar">‹</button>
      <span class="gfe-title">Git File Explainer</span>
      <button class="gfe-toggle gfe-expand-btn" aria-label="Expand sidebar">›</button>
    </div>
  </div>
  <div class="gfe-body">
    <span class="gfe-chip gfe-chip-medium">● MEDIUM</span>
    <p class="gfe-summary">
      The main entry point for the Anthropic Python SDK, exporting sync and async clients with
      configurable retry, timeout, and API key resolution.
    </p>
    <hr class="gfe-separator">
    <div class="gfe-qa-section">
      <p class="gfe-subheading">Ask a question</p>
      <textarea class="gfe-qa-input" style="border-color:#0969da;background:#fff;">What happens if I don't pass an api_key to the constructor?</textarea>
      <div class="gfe-qa-answer">
        <div class="gfe-qa-text">
          If you omit <code>api_key</code>, the constructor falls back to
          <code>os.environ.get("ANTHROPIC_API_KEY", "")</code> on line 25. This means the SDK
          reads the key from your environment at instantiation time. If the variable is unset,
          the client initialises with an empty string and every API call will return a 401
          authentication error — no exception is raised at construction time.
        </div>
      </div>
      <button class="gfe-qa-btn" style="background:#6e7781;">Clear</button>
    </div>
  </div>
</div>
</body></html>`;

// ── Page 3: popup centred on dark bg ─────────────────────────────────────
const PAGE3_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
body { margin:0; background:#0d1117; display:flex; align-items:center; justify-content:center; height:100vh; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
.popup-wrap { box-shadow:0 8px 32px rgba(0,0,0,0.6); border-radius:8px; overflow:hidden; border:1px solid #30363d; }
${POPUP_CSS}
</style></head><body>
<div class="popup-wrap">
<div id="popup-root">
  <header><h1>Git File Explainer</h1></header>
  <main>
    <div class="onboarding-banner">
      <p class="onboarding-title">Set up AI explanations</p>
      <ol class="onboarding-steps">
        <li>Get a free API key at <a href="#">console.anthropic.com ↗</a></li>
        <li>Paste it in the field below and click Save</li>
      </ol>
    </div>
    <div class="field">
      <label for="api-key">Anthropic API Key</label>
      <div class="input-row">
        <input type="password" id="api-key" placeholder="sk-ant-..." />
        <button id="save-key">Save</button>
      </div>
      <p class="hint">Your key is stored locally and never shared.</p>
    </div>
    <div class="field">
      <label class="toggle-label">
        <span>Enable on this site</span>
        <span class="toggle-switch"></span>
      </label>
      <p class="hint" id="site-hint">github.com</p>
    </div>
  </main>
</div>
</div>
</body></html>`;

async function screenshot(html, outPath) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath, type: 'png' });
  await browser.close();
  console.log('✓', outPath);
}

await screenshot(PAGE1_HTML, `${OUT_DIR}/01-sidebar-summary.png`);
await screenshot(PAGE2_HTML, `${OUT_DIR}/02-qa-interaction.png`);
await screenshot(PAGE3_HTML, `${OUT_DIR}/03-popup.png`);
console.log('\nAll 3 GFE screenshots written to', OUT_DIR);
