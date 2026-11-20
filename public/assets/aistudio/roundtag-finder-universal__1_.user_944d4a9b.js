// ==UserScript==
// @name         RoundTag Finder Universal (All Sites & Frames)
// @namespace    roundtag-finder
// @version      2.1.0
// @description  Universal multi-frame (all sites & all iframes) crash pre-signal finder: verifies 4-5 rounds before outputting unique 1x-per-round SMS/tags arriving 3-4s before crash.
// @match        *://*/*
// @include      *
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_setClipboard
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  // Target the real page window (unsafeWindow) so hooks intercept game scripts on ANY site & ANY iframe
  const pageWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const isTopFrame = window.self === window.top;
  const frameId = isTopFrame
    ? 'TOP'
    : 'IFRAME(' + (location.hostname || 'embedded') + ')#' + Math.random().toString(36).slice(2, 6);

  const CONFIG = {
    minPreEndMs: 3000,
    maxPreEndMs: 4000,
    minRoundsToVerify: 4,
    matchMode: "EXACT_PAYLOAD", // 'EXACT_PAYLOAD' | 'SIGNATURE_TEMPLATE'
    roundEndMode: "MANUAL_HOTKEY", // 'MANUAL_HOTKEY' | 'DOM_SELECTOR' | 'WS_KEYWORD' | 'FIXED_DURATION'
    roundEndSelector: ".round-result-popup",
    roundEndWsKeyword: "round_crashed",
    fixedRoundMs: 15000,
    hotkey: "F8",
    enableAudioAlert: true,
    enableDesktopNotification: false,
    hooks: {
      ws: true,
      fetchXhr: true,
      dom: true,
      css: true,
      js: true,
    },
    maxStoredRounds: 60,
  };

  // --- Shared State (Top Frame aggregates events from ALL nested iframes) ---
  let roundNumber = 1;
  let roundStartMs = Date.now();
  let currentRoundEvents = [];
  let completedRounds = [];
  let alertLogs = [];
  let verifiedPreEndSignatures = new Set();
  let windowAlertFiredThisRound = false;
  let lastAutoEndMs = 0;
  let seenFrames = new Set([frameId]);

  // --- Audio Chime (Web Audio API) ---
  function playAlertTone(freq = 880, durationMs = 140) {
    if (!CONFIG.enableAudioAlert) return;
    try {
      const AudioCtx = pageWin.AudioContext || pageWin.webkitAudioContext || window.AudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (_) {}
  }

  function triggerAlert(type, label, extraData) {
    if (!isTopFrame) return;
    const now = Date.now();
    const entry = {
      id: 'vm-alert-' + now + '-' + Math.random().toString(36).slice(2, 6),
      roundNumber,
      triggeredAtMs: now,
      isoTime: new Date(now).toISOString(),
      offsetBeforeEndMs: extraData?.estimatedRemainingMs ?? 0,
      seqInRound: currentRoundEvents.length,
      totalEventsInRound: currentRoundEvents.length,
      channel: extraData?.channel || 'WS_JSON',
      signature: label,
      alertType: type,
      payloadPreview: extraData?.payload || '',
    };
    alertLogs.push(entry);
    playAlertTone(type === 'UNIQUE_TAG_MATCH' ? 1046 : 740, 160);

    const hudBanner = document.getElementById('rtf-alert-banner');
    if (hudBanner) {
      hudBanner.textContent =
        '[' + type + '] R#' + roundNumber + ' SMS #' + entry.seqInRound + ' -> ' + label;
      hudBanner.style.display = 'block';
    }

    if (CONFIG.enableDesktopNotification && typeof GM_notification === 'function') {
      GM_notification({
        title: 'RoundTag Alert · Round #' + roundNumber,
        text: label + ' (SMS #' + entry.seqInRound + ')',
        timeout: 2500,
      });
    }

    try {
      // Optional action when pre-end tag matches:
      // console.log("[RoundTag Trigger]", entry);
    } catch (err) {
      console.error('[RoundTag CustomAction Error]', err);
    }
  }

  // --- Decode Binary or Text WS Payloads ---
  function decodePayload(data) {
    if (typeof data === 'string') return data;
    try {
      if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        if (/^[\x20-\x7E\s\u00A0-\uFFFF]{2,}$/.test(text.slice(0, 80))) {
          return text;
        }
        const hex = Array.from(bytes.slice(0, 24)).map((b) => b.toString(16).padStart(2, '0')).join(' ');
        return '[BIN:' + bytes.length + 'B] ' + hex;
      }
    } catch (_) {}
    return '[Binary/Blob WS Frame]';
  }

  // --- Signature Extraction ---
  function extractJsonSignatures(obj, prefix = '', depth = 0, out = []) {
    if (depth > 3 || obj === null || obj === undefined) return out;
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      if (prefix) {
        const str = String(obj);
        const isDynamicNum = typeof obj === 'number' && obj > 1e11;
        out.push(
          !isDynamicNum && str.length <= 42
            ? prefix + '=' + JSON.stringify(obj)
            : prefix + ':<' + typeof obj + '>'
        );
      }
      return out;
    }
    if (Array.isArray(obj)) {
      out.push(prefix + ':array[' + obj.length + ']');
      if (obj.length > 0) extractJsonSignatures(obj[0], prefix + '[0]', depth + 1, out);
      return out;
    }
    if (typeof obj === 'object') {
      const entries = Object.entries(obj).slice(0, 12);
      for (const [k, v] of entries) {
        extractJsonSignatures(v, prefix ? prefix + '.' + k : k, depth + 1, out);
      }
    }
    return out;
  }

  // --- Cross-Frame Ingestion (Top frame collects from itself & all child iframes) ---
  function ingestEventInTop(ev) {
    seenFrames.add(ev.frameId || 'TOP');
    const seqInRound = currentRoundEvents.length + 1;
    const finalized = {
      id: 'ev-' + roundNumber + '-' + seqInRound + '-' + ev.timestampMs,
      roundNumber,
      seqInRound,
      timestampMs: ev.timestampMs,
      isoTime: new Date(ev.timestampMs).toISOString(),
      channel: ev.channel,
      signature: ev.signature,
      source: '[' + (ev.frameId || 'TOP') + '] ' + ev.source,
      payload: String(ev.payload).slice(0, 1200),
    };
    currentRoundEvents.push(finalized);

    const matchKey =
      CONFIG.matchMode === 'EXACT_PAYLOAD'
        ? finalized.channel + '::EXACT::' + finalized.payload.trim()
        : finalized.channel + '::' + finalized.signature;

    if (verifiedPreEndSignatures.has(matchKey)) {
      triggerAlert('UNIQUE_TAG_MATCH', finalized.signature, {
        channel: finalized.channel,
        payload: finalized.payload,
        estimatedRemainingMs: getEstimatedRemainingMs(ev.timestampMs),
      });
    }

    if (
      CONFIG.roundEndMode === 'WS_KEYWORD' &&
      CONFIG.roundEndWsKeyword &&
      finalized.channel === 'WS_JSON' &&
      (finalized.signature.includes(CONFIG.roundEndWsKeyword) ||
        finalized.payload.includes(CONFIG.roundEndWsKeyword))
    ) {
      if (ev.timestampMs - lastAutoEndMs > 2500) {
        lastAutoEndMs = ev.timestampMs;
        markRoundEnd('WS_KEYWORD');
      }
    }

    renderHud();
  }

  function recordEvent(channel, signature, source, payloadText) {
    const timestampMs = Date.now();
    const packet = {
      __RTF_BRIDGE__: 'EVENT',
      frameId,
      timestampMs,
      channel,
      signature,
      source,
      payload: String(payloadText).slice(0, 1200),
    };

    if (isTopFrame) {
      ingestEventInTop(packet);
    } else {
      try {
        window.top.postMessage(packet, '*');
      } catch (_) {
        // Fallback if sandboxed iframe blocks top postMessage
        ingestEventInTop(packet);
      }
    }
  }

  if (isTopFrame) {
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.__RTF_BRIDGE__ === 'EVENT') {
        ingestEventInTop(d);
      } else if (d.__RTF_BRIDGE__ === 'MARK_ROUND_END') {
        markRoundEnd(d.reason || 'IFRAME_SIGNAL');
      }
    });
  }

  function getAverageRoundDurationMs() {
    if (completedRounds.length === 0) return CONFIG.fixedRoundMs || 15000;
    const sum = completedRounds.reduce((acc, r) => acc + r.durationMs, 0);
    return Math.round(sum / completedRounds.length);
  }

  function getEstimatedRemainingMs(now = Date.now()) {
    const avg = getAverageRoundDurationMs();
    return Math.max(0, avg - (now - roundStartMs));
  }

  // --- Multi-Round 1x-Per-Round Pre-Crash Tag Discovery (Checks 4-5 Rounds First) ---
  function computeUniquePreEndTags() {
    if (completedRounds.length < CONFIG.minRoundsToVerify) return [];
    const totalRounds = completedRounds.length;
    const map = new Map();

    for (const r of completedRounds) {
      for (const ev of r.events) {
        const offset = r.endTimeMs - ev.timestampMs;
        const cleanPayload = String(ev.payload || '').trim();
        const key =
          CONFIG.matchMode === 'EXACT_PAYLOAD'
            ? ev.channel + '::EXACT::' + cleanPayload
            : ev.channel + '::' + ev.signature;
        const label =
          CONFIG.matchMode === 'EXACT_PAYLOAD'
            ? cleanPayload.slice(0, 90)
            : ev.signature;
        if (!map.has(key)) {
          map.set(key, { channel: ev.channel, signature: label, byRound: new Map() });
        }
        const entry = map.get(key);
        if (!entry.byRound.has(r.roundNumber)) entry.byRound.set(r.roundNumber, []);
        entry.byRound.get(r.roundNumber).push({ ev, offset, total: r.events.length });
      }
    }

    const results = [];
    for (const [key, item] of map.entries()) {
      if (item.byRound.size !== totalRounds) continue;
      let validOnceAndWindow = true;
      const offsets = [];
      const seqs = [];
      for (const [, hits] of item.byRound.entries()) {
        if (hits.length !== 1) {
          validOnceAndWindow = false;
          break;
        }
        const h = hits[0];
        if (h.offset < CONFIG.minPreEndMs || h.offset > CONFIG.maxPreEndMs) {
          validOnceAndWindow = false;
          break;
        }
        offsets.push(h.offset);
        seqs.push(h.ev.seqInRound);
      }
      if (!validOnceAndWindow) continue;

      const avgOffset = Math.round(offsets.reduce((a, b) => a + b, 0) / offsets.length);
      const avgSeq = (seqs.reduce((a, b) => a + b, 0) / seqs.length).toFixed(1);
      results.push({
        key,
        channel: item.channel,
        signature: item.signature,
        roundsMatched: totalRounds,
        avgOffsetMs: avgOffset,
        avgSeqInRound: avgSeq,
      });
    }

    verifiedPreEndSignatures = new Set(results.map((r) => r.key));
    return results;
  }

  function markRoundEnd(reason = 'MANUAL') {
    if (!isTopFrame) {
      try {
        window.top.postMessage({ __RTF_BRIDGE__: 'MARK_ROUND_END', reason }, '*');
        return;
      } catch (_) {}
    }

    const endTimeMs = Date.now();
    const durationMs = endTimeMs - roundStartMs;
    if (durationMs < 800) return;

    completedRounds.push({
      roundNumber,
      startTimeMs: roundStartMs,
      endTimeMs,
      durationMs,
      reason,
      events: currentRoundEvents.slice(),
    });

    if (completedRounds.length > CONFIG.maxStoredRounds) {
      completedRounds.shift();
    }

    for (const al of alertLogs) {
      if (al.roundNumber === roundNumber) {
        al.offsetBeforeEndMs = endTimeMs - al.triggeredAtMs;
        al.totalEventsInRound = currentRoundEvents.length;
      }
    }

    roundNumber += 1;
    roundStartMs = endTimeMs;
    currentRoundEvents = [];
    windowAlertFiredThisRound = false;
    computeUniquePreEndTags();
    renderHud();
  }

  // --- 1. Page-Context WebSocket Hook (Text + Binary + Outgoing) ---
  if (CONFIG.hooks.ws && pageWin.WebSocket) {
    const NativeWS = pageWin.WebSocket;
    const WrappedWS = function (url, protocols) {
      const ws = protocols ? new NativeWS(url, protocols) : new NativeWS(url);
      ws.addEventListener('message', function (event) {
        const raw = decodePayload(event.data);
        let sig = 'ws:raw:' + raw.slice(0, 48);
        try {
          const json = JSON.parse(raw);
          const flat = extractJsonSignatures(json);
          const priority = flat.find((s) => /^(type|event|action|cmd|phase|status|state|msg|op|t)=/i.test(s));
          sig = 'ws:' + (priority || flat.slice(0, 2).join('&') || 'json');
        } catch (_) {
          // Handle Socket.IO style frames like 42["event_name",{...}]
          const sio = raw.match(/^\d+\["([^"]+)"/);
          if (sio) sig = 'ws:sio="' + sio[1] + '"';
        }
        recordEvent('WS_JSON', sig, String(url), raw);
      });
      return ws;
    };
    WrappedWS.prototype = NativeWS.prototype;
    Object.setPrototypeOf(WrappedWS, NativeWS);
    pageWin.WebSocket = WrappedWS;
  }

  // --- 2. Page-Context Fetch & XHR API JSON Hook ---
  if (CONFIG.hooks.fetchXhr) {
    const origFetch = pageWin.fetch;
    if (origFetch) {
      pageWin.fetch = async function (...args) {
        const res = await origFetch.apply(this, args);
        try {
          const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || 'fetch');
          const clone = res.clone();
          const ct = clone.headers.get('content-type') || '';
          if (ct.includes('json') || ct.includes('text/plain')) {
            const txt = await clone.text();
            const data = JSON.parse(txt);
            const flat = extractJsonSignatures(data);
            const priority = flat.find((s) => /(status|phase|state|lock|round|end|stage)=/i.test(s)) || flat[0] || 'json';
            const shortPath = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
            recordEvent('API_JSON', 'api:' + shortPath + ' -> ' + priority, shortPath, txt);
          }
        } catch (_) {}
        return res;
      };
    }

    const OrigXHR = pageWin.XMLHttpRequest;
    if (OrigXHR) {
      const origOpen = OrigXHR.prototype.open;
      const origSend = OrigXHR.prototype.send;
      OrigXHR.prototype.open = function (method, url) {
        this._rtfUrl = String(url || '');
        return origOpen.apply(this, arguments);
      };
      OrigXHR.prototype.send = function () {
        this.addEventListener('load', function () {
          try {
            const ct = this.getResponseHeader('content-type') || '';
            if ((ct.includes('json') || this.responseText?.trim().startsWith('{')) && this.responseText) {
              const data = JSON.parse(this.responseText);
              const flat = extractJsonSignatures(data);
              const priority = flat.find((s) => /(status|phase|state|lock|round|end|stage)=/i.test(s)) || flat[0] || 'json';
              const shortPath = (this._rtfUrl || '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
              recordEvent('API_JSON', 'xhr:' + shortPath + ' -> ' + priority, shortPath, this.responseText);
            }
          } catch (_) {}
        });
        return origSend.apply(this, arguments);
      };
    }
  }

  // --- 3. DOM Tag, Shadow DOM & CSS Class MutationObserver ---
  function observeRoot(rootNode) {
    if ((!CONFIG.hooks.dom && !CONFIG.hooks.css) || !rootNode) return;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.target && m.target.closest && m.target.closest('#rtf-hud-root')) continue;
        if (m.type === 'childList' && CONFIG.hooks.dom) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1 || node.id === 'rtf-hud-root') continue;
            const tag = node.tagName.toLowerCase();
            const idPart = node.id ? '#' + node.id : '';
            const clsPart =
              typeof node.className === 'string' && node.className.trim()
                ? '.' + node.className.trim().split(/\s+/).slice(0, 2).join('.')
                : '';
            const sig = 'dom:' + tag + idPart + clsPart;
            recordEvent('DOM_TAG', sig, 'DOM Observer', node.outerHTML.slice(0, 320));
            if (
              CONFIG.roundEndMode === 'DOM_SELECTOR' &&
              CONFIG.roundEndSelector &&
              node.matches?.(CONFIG.roundEndSelector)
            ) {
              if (Date.now() - lastAutoEndMs > 2500) {
                lastAutoEndMs = Date.now();
                markRoundEnd('DOM_SELECTOR');
              }
            }
          }
        }
        if (m.type === 'attributes' && CONFIG.hooks.css) {
          const el = m.target;
          if (!el || el.nodeType !== 1) continue;
          const tag = el.tagName.toLowerCase();
          const cls =
            typeof el.className === 'string'
              ? el.className.trim().split(/\s+/).slice(0, 3).join('.')
              : '';
          if (cls) {
            recordEvent('CSS_STATE', 'css:' + tag + '.' + cls, 'CSS Class Change', el.outerHTML.slice(0, 240));
          }
        }
      }
    });
    observer.observe(rootNode, {
      childList: true,
      subtree: true,
      attributes: CONFIG.hooks.css,
      attributeFilter: ['class', 'data-state', 'data-phase'],
    });
  }

  // Intercept Shadow DOM attachShadow so Web Component games are also monitored
  if ((CONFIG.hooks.dom || CONFIG.hooks.css) && pageWin.Element?.prototype?.attachShadow) {
    const origAttachShadow = pageWin.Element.prototype.attachShadow;
    pageWin.Element.prototype.attachShadow = function (init) {
      const shadow = origAttachShadow.apply(this, arguments);
      observeRoot(shadow);
      return shadow;
    };
  }

  // --- 4. Page-Context JS CustomEvent Hook ---
  if (CONFIG.hooks.js && pageWin.EventTarget?.prototype?.dispatchEvent) {
    const origDispatch = pageWin.EventTarget.prototype.dispatchEvent;
    pageWin.EventTarget.prototype.dispatchEvent = function (ev) {
      if (ev && ev.type && ev instanceof pageWin.CustomEvent) {
        recordEvent(
          'JS_HOOK',
          'js:CustomEvent("' + ev.type + '")',
          'dispatchEvent',
          JSON.stringify(ev.detail ?? {})
        );
      }
      return origDispatch.apply(this, arguments);
    };
  }

  // --- Real-Time Clock & Pre-End Window Alert Ticker (Top Frame) ---
  if (isTopFrame) {
    setInterval(() => {
      const now = Date.now();
      const remMs = getEstimatedRemainingMs(now);

      if (
        completedRounds.length >= 1 &&
        !windowAlertFiredThisRound &&
        remMs <= CONFIG.maxPreEndMs &&
        remMs >= CONFIG.minPreEndMs
      ) {
        windowAlertFiredThisRound = true;
        triggerAlert(
          'WINDOW_ENTER',
          'Pre-End Window (' + (CONFIG.minPreEndMs / 1000).toFixed(1) + '-' + (CONFIG.maxPreEndMs / 1000).toFixed(1) + 's)',
          {
            channel: 'JS_HOOK',
            estimatedRemainingMs: remMs,
            payload: JSON.stringify({ roundNumber, estimatedRemainingMs: remMs }),
          }
        );
      }

      if (CONFIG.roundEndMode === 'FIXED_DURATION' && now - roundStartMs >= CONFIG.fixedRoundMs) {
        markRoundEnd('FIXED_TIMER');
      }

      const clockEl = document.getElementById('rtf-clock');
      if (clockEl) {
        const elapsed = now - roundStartMs;
        clockEl.textContent = (elapsed / 1000).toFixed(3) + 's (Rem ~' + (remMs / 1000).toFixed(1) + 's)';
      }
    }, 50);
  }

  // --- Hotkey Listener (Works inside ANY iframe too!) ---
  window.addEventListener('keydown', (e) => {
    if (e.key === CONFIG.hotkey) {
      e.preventDefault();
      markRoundEnd('HOTKEY_' + CONFIG.hotkey + '_' + frameId);
    }
  });

  // --- Floating Draggable Inspector HUD (Mounted on Top Frame; aggregates all iframes) ---
  function mountHud() {
    if (!isTopFrame || document.getElementById('rtf-hud-root') || !document.body) return;
    const root = document.createElement('div');
    root.id = 'rtf-hud-root';

    let savedPos = null;
    try {
      savedPos = JSON.parse(localStorage.getItem('rtf_hud_pos') || 'null');
    } catch (_) {}

    const initLeft = savedPos && typeof savedPos.left === 'number'
      ? Math.max(8, Math.min(window.innerWidth - 390, savedPos.left))
      : Math.max(8, window.innerWidth - 396);
    const initTop = savedPos && typeof savedPos.top === 'number'
      ? Math.max(8, Math.min(window.innerHeight - 120, savedPos.top))
      : Math.max(8, window.innerHeight - 310);

    root.style.cssText =
      'position:fixed;left:' + initLeft + 'px;top:' + initTop + 'px;z-index:2147483647;width:380px;max-width:calc(100vw - 16px);background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:10px;font-family:monospace;font-size:12px;box-shadow:0 12px 32px rgba(0,0,0,0.45);overflow:hidden;';

    root.innerHTML = `
      <div id="rtf-hud-drag-handle" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#1e293b;border-bottom:1px solid #334155;cursor:move;user-select:none;touch-action:none;">
        <div style="display:flex;align-items:center;gap:6px;pointer-events:none;">
          <span style="color:#64748b;font-size:13px;">⠿</span>
          <strong style="font-size:12px;">RoundTag HUD</strong>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="rtf-round-meta" style="color:#94a3b8;font-size:11px;pointer-events:none;">R#1 · 0 SMS · 1F</span>
          <button id="rtf-btn-min" title="Minimize/Expand" style="background:#334155;color:#f8fafc;border:none;width:22px;height:22px;border-radius:4px;cursor:pointer;font-weight:bold;line-height:1;">−</button>
        </div>
      </div>
      <div id="rtf-hud-body" style="padding:10px 12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#94a3b8;">Round Clock:</span>
          <span id="rtf-clock" style="color:#38bdf8;font-weight:bold;">0.000s</span>
        </div>
        <div id="rtf-alert-banner" style="display:none;background:#78350f;color:#fef3c7;padding:6px 8px;border-radius:6px;margin-bottom:8px;font-size:11px;"></div>
        <div id="rtf-candidates" style="max-height:140px;overflow-y:auto;background:#020617;border:1px solid #1e293b;border-radius:6px;padding:6px;margin-bottom:8px;color:#cbd5e1;">
          Waiting for 2+ rounds across all frames to isolate 1x-per-round pre-end tags...
        </div>
        <div style="display:flex;gap:6px;">
          <button id="rtf-btn-end" style="flex:1;background:#0284c7;color:#fff;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-weight:bold;">End Round (${CONFIG.hotkey})</button>
          <button id="rtf-btn-copy" style="background:#334155;color:#f8fafc;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;">Copy JSON</button>
          <button id="rtf-btn-dl" style="background:#334155;color:#f8fafc;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;">Export</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    // Drag logic (mouse & touch via Pointer Events)
    const handle = document.getElementById('rtf-hud-drag-handle');
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = initLeft;
    let origTop = initTop;

    handle.addEventListener('pointerdown', (e) => {
      if (e.target && e.target.id === 'rtf-btn-min') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = root.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;
      handle.setPointerCapture?.(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const maxL = Math.max(8, window.innerWidth - root.offsetWidth - 8);
      const maxT = Math.max(8, window.innerHeight - root.offsetHeight - 8);
      const nextL = Math.max(8, Math.min(maxL, origLeft + dx));
      const nextT = Math.max(8, Math.min(maxT, origTop + dy));
      root.style.left = nextL + 'px';
      root.style.top = nextT + 'px';
    });

    window.addEventListener('pointerup', () => {
      if (!isDragging) return;
      isDragging = false;
      try {
        localStorage.setItem('rtf_hud_pos', JSON.stringify({
          left: parseFloat(root.style.left),
          top: parseFloat(root.style.top),
        }));
      } catch (_) {}
    });

    // Minimize / Expand toggle
    const bodyEl = document.getElementById('rtf-hud-body');
    const minBtn = document.getElementById('rtf-btn-min');
    let collapsed = false;
    minBtn.onclick = (e) => {
      e.stopPropagation();
      collapsed = !collapsed;
      bodyEl.style.display = collapsed ? 'none' : 'block';
      minBtn.textContent = collapsed ? '+' : '−';
    };

    document.getElementById('rtf-btn-end').onclick = () => markRoundEnd('BUTTON');
    document.getElementById('rtf-btn-copy').onclick = () => {
      const payload = JSON.stringify({ rounds: completedRounds, alerts: alertLogs }, null, 2);
      if (typeof GM_setClipboard === 'function') GM_setClipboard(payload);
      else navigator.clipboard?.writeText(payload);
    };
    document.getElementById('rtf-btn-dl').onclick = () => {
      const payload = JSON.stringify({ rounds: completedRounds, alerts: alertLogs }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'roundtag-logs-' + Date.now() + '.json';
      a.click();
    };
  }

  function renderHud() {
    if (!isTopFrame) return;
    const meta = document.getElementById('rtf-round-meta');
    if (meta) {
      meta.textContent =
        'R#' + roundNumber + ' · ' + currentRoundEvents.length + ' SMS · ' + completedRounds.length + ' Done · ' + seenFrames.size + 'F';
    }
    const box = document.getElementById('rtf-candidates');
    if (box) {
      if (completedRounds.length < CONFIG.minRoundsToVerify) {
        const remaining = CONFIG.minRoundsToVerify - completedRounds.length;
        box.innerHTML =
          '<div style="color:#fbbf24;">Checking Crash Rounds: <b>' +
          completedRounds.length +
          ' / ' +
          CONFIG.minRoundsToVerify +
          '</b> done.</div><div style="color:#94a3b8;margin-top:4px;">Need ' +
          remaining +
          ' more round(s) to verify 1x-per-round SMS (' +
          (CONFIG.minPreEndMs / 1000).toFixed(1) +
          '-' +
          (CONFIG.maxPreEndMs / 1000).toFixed(1) +
          's before crash).</div>';
      } else {
        const tags = computeUniquePreEndTags();
        if (tags.length === 0) {
          box.textContent =
            'Checked ' +
            completedRounds.length +
            ' rounds: no 1x/round tag found in ' +
            (CONFIG.minPreEndMs / 1000).toFixed(1) +
            '-' +
            (CONFIG.maxPreEndMs / 1000).toFixed(1) +
            's pre-crash window.';
        } else {
          box.innerHTML = tags
            .map(
              (t) =>
                '<div style="margin-bottom:4px;border-bottom:1px solid #1e293b;padding-bottom:3px;">[' +
                t.channel +
                '] <b>' +
                t.signature +
                '</b><br/><span style="color:#38bdf8;">-' +
                (t.avgOffsetMs / 1000).toFixed(2) +
                's · SMS #' +
                t.avgSeqInRound +
                ' (' +
                t.roundsMatched +
                '/' +
                t.roundsMatched +
                ' Verified)</span></div>'
            )
            .join('');
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observeRoot(document.documentElement);
      mountHud();
    });
  } else {
    observeRoot(document.documentElement);
    mountHud();
  }
})();
