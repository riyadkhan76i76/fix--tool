import { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  FileCode2,
  Layers,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';

type ChannelKey = 'css' | 'js' | 'dom' | 'api';

interface ExtractedTag {
  tag: string;
  category: 'CSS-STATE' | 'JS-HOOK' | 'DOM-TAG' | 'DOM' | 'API' | 'API-SIG' | 'KEY';
  source: string;
  phase: 'in-flight / signal' | 'wait / bet phase' | 'post-crash';
  matchMs: number;
}

const SCRIPT_PATH = '/TriggerTap-Turbo-v5.2-RoundTag.user.js';
const ORIGINAL_ASSET_PATH = '/assets/aistudio/TriggerTap-Turbo-v5.2__3_.user_3fe09553.js';

const PRESET_SAMPLES: Record<
  ChannelKey,
  { label: string; source: string; payload: string; armedRule: string }
> = {
  css: {
    label: 'CSS Class / Attribute Mutation',
    source: 'CSS-STATE',
    payload: 'css:div#round-banner.plane-status.in-flight[data-phase=active] Cash Out Available',
    armedRule: 'in-flight, data-phase=active',
  },
  js: {
    label: 'JS CustomEvent (Circular-Safe)',
    source: 'JS-HOOK',
    payload: 'js:CustomEvent("roundStateChanged") {"phase":"cashout_window","roundId":84920,"coef":1.42}',
    armedRule: '"phase":"cashout_window"',
  },
  dom: {
    label: 'DOM & Shadow DOM Node',
    source: 'DOM-TAG',
    payload: 'dom:button#cashout-btn.btn-primary.cashout-ready Cash Out BDT 480.00',
    armedRule: 'cashout-ready',
  },
  api: {
    label: 'API JSON Response',
    source: 'API-RES',
    payload:
      '200 POST https://game.example.com/api/v2/round/status\n{"status":"flying","cashoutOpen":true,"roundNo":90412,"coef":2.15}',
    armedRule: 'cashoutOpen=true, "status":"flying"',
  },
};

const VOLATILE_KEYS = new Set([
  'coef',
  'coeff',
  'coefficient',
  'curcoef',
  'multiplier',
  'mult',
  'mul',
  'odds',
  'rate',
  'payout',
  'winamount',
  'amount',
  'betamount',
  'balance',
  'roundid',
  'round_id',
  'gameid',
  'game_id',
  'roundno',
  'gameno',
  'ts',
  'timestamp',
  'hash',
  'seed',
  'salt',
]);

function classifyPhase(tag: string): ExtractedTag['phase'] {
  const lt = tag.toLowerCase();
  if (
    /\b(finished|finishgame|crash|crashed|endgame|round_end|busted|flew|stopcoefficient|won":false)\b/.test(
      lt
    )
  ) {
    return 'post-crash';
  }
  if (
    /\b(waiting|waitgame|betting|place bet|confirm bet|bets_open|next game|gametype|currency)\b/.test(
      lt
    )
  ) {
    return 'wait / bet phase';
  }
  return 'in-flight / signal';
}

function extractFlatJsonSigs(
  obj: unknown,
  prefix = '',
  depth = 0,
  out: string[] = []
): string[] {
  if (depth > 3 || obj === null || obj === undefined || out.length >= 16) return out;
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    if (prefix) {
      const lastKey = (prefix.split('.').pop() || '').replace(/\[\d+\]$/, '').toLowerCase();
      if (VOLATILE_KEYS.has(lastKey)) return out;
      if (typeof obj === 'number' && (!Number.isFinite(obj) || !Number.isInteger(obj) || obj > 1e11)) {
        return out;
      }
      const str = String(obj);
      if (str.length > 0 && str.length <= 44) {
        out.push(`${prefix}=${JSON.stringify(obj)}`);
      }
    }
    return out;
  }
  if (Array.isArray(obj)) {
    if (prefix) out.push(`${prefix}:array[${obj.length}]`);
    if (obj.length > 0) extractFlatJsonSigs(obj[0], `${prefix}[0]`, depth + 1, out);
    return out;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>).slice(0, 12)) {
      if (VOLATILE_KEYS.has(k.toLowerCase())) continue;
      extractFlatJsonSigs(v, prefix ? `${prefix}.${k}` : k, depth + 1, out);
    }
  }
  return out;
}

function simulateExtraction(
  channel: ChannelKey,
  rawInput: string,
  armedRules: string
): { tags: ExtractedTag[]; matchedRule: string | null; elapsedMs: number } {
  const t0 = performance.now();
  const s = rawInput.trim();
  const tags: ExtractedTag[] = [];
  const seen = new Set<string>();

  const push = (tag: string, category: ExtractedTag['category'], source: string) => {
    const clean = tag.trim();
    if (!clean || clean.length < 3 || seen.has(clean)) return;
    seen.add(clean);
    tags.push({
      tag: clean,
      category,
      source,
      phase: classifyPhase(clean),
      matchMs: Number((performance.now() - t0).toFixed(3)),
    });
  };

  if (channel === 'css') {
    const sp = s.indexOf(' ');
    const head = sp > 0 ? s.slice(0, sp) : s;
    const body = sp > 0 ? s.slice(sp + 1).trim() : '';
    push(head, 'CSS-STATE', 'CSS-STATE');
    if (body) {
      const cleaned = body
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:x|×|%|bdt|usd|eur|inr|rub|trx|usdt)\b/gi, '')
        .trim();
      if (cleaned.length >= 3) push(cleaned, 'DOM', 'CSS-STATE');
    }
  } else if (channel === 'js') {
    const evM = s.match(/^(js:CustomEvent\("[^"]+"\))/);
    const head = evM ? evM[1] : s.slice(0, 80);
    push(head, 'JS-HOOK', 'JS-HOOK');
    const jsonStart = s.indexOf('{');
    if (jsonStart >= 0) {
      try {
        const parsed = JSON.parse(s.slice(jsonStart));
        const sigs = extractFlatJsonSigs(parsed);
        if (sigs[0]) push(`${head} ${sigs[0]}`, 'JS-HOOK', 'JS-HOOK');
        for (const sg of sigs.slice(0, 3)) push(sg, 'KEY', 'JS-HOOK');
      } catch {
        // ignore partial json
      }
    }
  } else if (channel === 'dom') {
    const sp = s.indexOf(' ');
    const head = sp > 0 ? s.slice(0, sp) : s;
    const body = sp > 0 ? s.slice(sp + 1).trim() : '';
    push(head, 'DOM-TAG', 'DOM-TAG');
    if (body) {
      const cleaned = body
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:x|×|%|bdt|usd|eur|inr|rub|trx|usdt)\b/gi, '')
        .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length >= 3) push(cleaned, 'DOM', 'DOM-TAG');
    }
  } else {
    const firstNl = s.indexOf('\n');
    const firstLine = (firstNl >= 0 ? s.slice(0, firstNl) : s).trim();
    const hdr = firstLine.match(/^(?:\d{3}\s+)?(?:GET|POST|PUT|PATCH|DELETE|BEACON|TAP)\s+(\S+)/i);
    let shortPath = '';
    if (hdr) {
      try {
        const u = hdr[1].startsWith('http') ? new URL(hdr[1]) : null;
        const segs = (u ? u.pathname : hdr[1].split('?')[0]).split('/').filter(Boolean);
        shortPath = segs.length >= 2 ? `/${segs.slice(-2).join('/')}` : `/${segs[0] || ''}`;
        if (shortPath.length > 1) push(shortPath, 'API', 'API-RES');
      } catch {
        // ignore invalid url
      }
    }
    const jsonIdx = Math.min(
      ...[s.indexOf('{'), s.indexOf('[')].filter((n) => n >= 0)
    );
    if (Number.isFinite(jsonIdx) && jsonIdx >= 0) {
      try {
        const parsed = JSON.parse(s.slice(jsonIdx));
        const sigs = extractFlatJsonSigs(parsed);
        const pri =
          sigs.find((sg) => /(status|phase|state|lock|round|end|stage|cash|open)=/i.test(sg)) ||
          sigs[0];
        if (pri && shortPath) push(`api:${shortPath} -> ${pri}`, 'API-SIG', 'API-RES');
        for (const sg of sigs.slice(0, 3)) push(sg, 'KEY', 'API-RES');
      } catch {
        // ignore invalid json
      }
    }
  }

  const hay = s.toLowerCase();
  const candidates = armedRules
    .split(/[\n,]/)
    .map((r) => r.trim())
    .filter(Boolean);

  let matchedRule: string | null = null;
  for (const rule of candidates) {
    const needle = rule.toLowerCase();
    if (hay.includes(needle) || tags.some((t) => t.tag.toLowerCase().includes(needle))) {
      matchedRule = rule;
      break;
    }
    const kv = needle.match(/^([a-z0-9_.-]+)\s*=\s*(.+)$/i);
    if (kv && (hay.includes(`"${kv[1]}":${kv[2]}`) || hay.includes(`[${kv[1]}=${kv[2]}]`))) {
      matchedRule = rule;
      break;
    }
  }

  return {
    tags,
    matchedRule,
    elapsedMs: Number((performance.now() - t0).toFixed(3)),
  };
}

const BADGE_TONE: Record<ExtractedTag['category'], string> = {
  'CSS-STATE': 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  'JS-HOOK': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'DOM-TAG': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  DOM: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'API-SIG': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  API: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  KEY: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
};

export default function App() {
  const [channel, setChannel] = useState<ChannelKey>('css');
  const [sampleInput, setSampleInput] = useState<string>(PRESET_SAMPLES.css.payload);
  const [armedRule, setArmedRule] = useState<string>(PRESET_SAMPLES.css.armedRule);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copiedRule, setCopiedRule] = useState<string | null>(null);

  const simResult = useMemo(
    () => simulateExtraction(channel, sampleInput, armedRule),
    [channel, sampleInput, armedRule]
  );

  const handleSelectChannel = (next: ChannelKey) => {
    setChannel(next);
    setSampleInput(PRESET_SAMPLES[next].payload);
    setArmedRule(PRESET_SAMPLES[next].armedRule);
  };

  const handleCopyFullScript = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const res = await fetch(SCRIPT_PATH);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 1800);
    } catch {
      // ignore clipboard errors
    } finally {
      setCopying(false);
    }
  };

  const handleCopyTag = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiedRule(tag);
      setTimeout(() => setCopiedRule(null), 1200);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Action Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight text-white sm:text-base">
                  TriggerTap Turbo v5.2 + RoundTag
                </h1>
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-emerald-300">
                  Violentmonkey Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Single unified userscript · WS untouched · Fast CSS, JS, DOM &amp; API tagging
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyFullScript}
              disabled={copying}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-60"
            >
              {copiedScript ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copied Script
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  {copying ? 'Loading...' : 'Copy .user.js'}
                </>
              )}
            </button>

            <a
              href={SCRIPT_PATH}
              download="TriggerTap-Turbo-v5.2-RoundTag.user.js"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400"
            >
              <Download className="h-3.5 w-3.5" />
              Install / Download .user.js
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6">
        {/* Integration Architecture Overview */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">
                Preserved Core
              </span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Original WS Pipeline Untouched</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              RoundTag&apos;s standalone WebSocket hook was excluded. TriggerTap&apos;s native WS,
              SFS2X/MsgPack/Protobuf decoding, <code className="text-slate-200">runTurboRaw</code>,
              pre-click gate, and sub-ms clicking run identically.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-sky-400">
                Merged Discovery
              </span>
              <Layers className="h-4 w-4 text-sky-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">CSS, JS, DOM, Shadow DOM &amp; API</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Captures class/attribute state changes (<code className="text-pink-300">CSS-STATE</code>),
              custom events (<code className="text-violet-300">JS-HOOK</code>), added nodes &amp;
              Shadow roots (<code className="text-sky-300">DOM-TAG</code>), and compact JSON
              signatures (<code className="text-amber-300">API-SIG</code>).
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-amber-400">
                Fixes Applied
              </span>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Violentmonkey &amp; Speed Fixes</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Removed iframe &amp; minimized DOM discovery blocks, fixed waiting-phase misclassification,
              eliminated slow <code className="text-slate-200">outerHTML</code> &amp;{' '}
              <code className="text-slate-200">innerHTML</code>, added circular-safe JSON &amp;{' '}
              <code className="text-slate-200">GM_setClipboard</code>.
            </p>
          </div>
        </section>

        {/* Interactive Non-WS Extraction & Sub-ms Matcher Tester */}
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">
                Non-WS Tag Extraction &amp; Turbo Matcher Tester
              </h2>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PRESET_SAMPLES) as ChannelKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectChannel(key)}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition ${
                    channel === key
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                      : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {key.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 p-4 lg:grid-cols-12">
            {/* Left Inputs */}
            <div className="space-y-3 lg:col-span-6">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Captured Signal Payload ({PRESET_SAMPLES[channel].label})
                  </label>
                  <span className="font-mono text-[11px] text-slate-500">
                    src: {PRESET_SAMPLES[channel].source}
                  </span>
                </div>
                <textarea
                  value={sampleInput}
                  onChange={(e) => setSampleInput(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-950 p-3 font-mono text-xs text-slate-100 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Armed TriggerTag Rules (comma or newline separated)
                  </label>
                  <span className="font-mono text-[11px] text-emerald-400">
                    {simResult.matchedRule
                      ? `MATCH [${simResult.matchedRule}] · ${simResult.elapsedMs}ms`
                      : `No match (${simResult.elapsedMs}ms)`}
                  </span>
                </div>
                <input
                  type="text"
                  value={armedRule}
                  onChange={(e) => setArmedRule(e.target.value)}
                  placeholder='e.g. in-flight, "phase":"cashout_window", cashoutOpen=true'
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-2 font-mono text-xs text-amber-200 outline-none focus:border-emerald-500/60"
                />
              </div>
            </div>

            {/* Right Extracted Output */}
            <div className="flex flex-col rounded-lg border border-slate-800 bg-slate-950/90 p-3 lg:col-span-6">
              <div className="mb-2.5 flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Play className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Discovered Non-WS Tags ({simResult.tags.length})
                  </span>
                </div>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
                    simResult.matchedRule
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {simResult.matchedRule ? '⚡ AUTO-CLICK READY' : 'MONITORING'}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
                {simResult.tags.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">
                    Enter a CSS, JS CustomEvent, DOM, or API payload to inspect extracted keywords.
                  </p>
                ) : (
                  simResult.tags.map((item) => {
                    const isArmedHit =
                      simResult.matchedRule !== null &&
                      item.tag.toLowerCase().includes(simResult.matchedRule.toLowerCase());
                    return (
                      <div
                        key={item.tag}
                        className={`rounded-md border p-2.5 transition ${
                          isArmedHit
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-slate-800 bg-slate-900/70'
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                BADGE_TONE[item.category]
                              }`}
                            >
                              {item.category}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {item.phase}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setArmedRule(item.tag)}
                              className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                            >
                              Use Tag
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyTag(item.tag)}
                              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                            >
                              {copiedRule === item.tag ? '✓' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        <div className="break-all font-mono text-xs text-slate-100">{item.tag}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Channel Specification & Violentmonkey Setup */}
        <section className="grid gap-4 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:col-span-7">
            <div className="mb-3 flex items-center gap-2">
              <Code2 className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">Channel Routing Inside Main Script</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-3 font-medium">Channel</th>
                    <th className="py-2 pr-3 font-medium">Hook Source</th>
                    <th className="py-2 font-medium">Execution &amp; Discovery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-300">
                  <tr>
                    <td className="py-2.5 pr-3 font-mono text-emerald-300">WS / Binary</td>
                    <td className="py-2.5 pr-3 font-mono text-[11px]">TriggerTap Core</td>
                    <td className="py-2.5 text-slate-400">
                      Unchanged native WS / SSE / Worker + SFS2X / MsgPack turbo click.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-mono text-pink-300">CSS-STATE</td>
                    <td className="py-2.5 pr-3 font-mono text-[11px]">MutationObserver</td>
                    <td className="py-2.5 text-slate-400">
                      Tracks <code className="text-slate-200">class</code>,{' '}
                      <code className="text-slate-200">data-state</code>,{' '}
                      <code className="text-slate-200">data-phase</code>,{' '}
                      <code className="text-slate-200">data-status</code> with instant armed match.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-mono text-violet-300">JS-HOOK</td>
                    <td className="py-2.5 pr-3 font-mono text-[11px]">dispatchEvent</td>
                    <td className="py-2.5 text-slate-400">
                      Circular-safe <code className="text-slate-200">CustomEvent</code> interception
                      running synchronous <code className="text-slate-200">runTurboRaw</code>.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-mono text-sky-300">DOM-TAG</td>
                    <td className="py-2.5 pr-3 font-mono text-[11px]">DOM + attachShadow</td>
                    <td className="py-2.5 text-slate-400">
                      Monitors new nodes &amp; closed/open Shadow roots across all frames &amp; iframes.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-mono text-amber-300">API-SIG / KEY</td>
                    <td className="py-2.5 pr-3 font-mono text-[11px]">Fetch / XHR</td>
                    <td className="py-2.5 text-slate-400">
                      Extracts <code className="text-slate-200">api:/path -&gt; key=val</code> and
                      strips volatile multiplier/hash fields.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:col-span-5">
            <div className="mb-3 flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Violentmonkey Usage Guide</h2>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-300">
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-[11px] font-semibold text-emerald-300">
                  1
                </span>
                <span>
                  Download <code className="text-slate-100">TriggerTap-Turbo-v5.2-RoundTag.user.js</code>{' '}
                  (unique <code className="text-emerald-300">@name</code> &amp;{' '}
                  <code className="text-emerald-300">@namespace</code>: <code className="text-slate-200">ttv52-roundtag</code>)
                  and install in Violentmonkey. Toggle off older TriggerTap/RoundTag scripts before playing so hooks do not duplicate.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-[11px] font-semibold text-emerald-300">
                  2
                </span>
                <span>
                  Open the HUD <strong className="text-white">🏷 ট্যাগ / Tags</strong> tab and use
                  the source filter (<code className="text-slate-200">CSS/JS/DOM/API</code>,{' '}
                  <code className="text-slate-200">CSS</code>,{' '}
                  <code className="text-slate-200">JS</code>,{' '}
                  <code className="text-slate-200">DOM/SMS</code>) to isolate non-WS signals.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-[11px] font-semibold text-emerald-300">
                  3
                </span>
                <span>
                  For games without WS crash packets, tap{' '}
                  <code className="text-sky-300">🏁 End Round [F8]</code> after 2+ rounds to
                  verify strict <code className="text-emerald-300">1×/R</code> CSS/JS/DOM tags, then
                  click <strong className="text-white">Use Tag</strong> and arm with{' '}
                  <code className="text-slate-200">Space</code>.
                </span>
              </li>
            </ol>

            <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-[11px] text-slate-400">
              <span>Main tool file updated in place</span>
              <a
                href={ORIGINAL_ASSET_PATH}
                download="TriggerTap-Turbo-v5.2__3_.user_3fe09553.js"
                className="font-mono text-emerald-400 hover:underline"
              >
                Download Original Filename
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
