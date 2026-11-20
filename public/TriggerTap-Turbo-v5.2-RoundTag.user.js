// ==UserScript==
// @name         TriggerTap Turbo v5.2 + RoundTag [TTV52-RTF]
// @namespace    https://triggertap.local/ttv52-roundtag
// @version      5.2.1
// @description  Sub-millisecond WebSocket, SFS2X/MsgPack/Gzip/Base64, CSS/JS/DOM/ShadowDOM/API RoundTag discovery & auto-click + Dual-Transport Encrypted WSS & HTTP Relay
// @match        *://*/*
// @include      *
// @inject-into  auto
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_setValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM.getValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_addElement
// @grant        GM.addElement
// @grant        GM_setClipboard
// @grant        GM.setClipboard
// @grant        unsafeWindow
// @connect      *
// @all-frames   true
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';
  const targetWin = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
  const WIN = targetWin;
  const rawPageWin = (targetWin && targetWin.wrappedJSObject) ? targetWin.wrappedJSObject : targetWin;
  const FRAME_ID = Math.random().toString(36).slice(2, 8);
  const BOOT_TS = Date.now();
  let activeSessionId = '';
  let lastUserCfgEditAt = 0;

  const CFG = {
    tags: "",
    matchMode: "contains",
    caseSensitive: false,
    listenWS: true,
    listenDOM: true,
    listenCSS: true,
    listenJS: true,
    listenRTF: true,
    listenAPI: true,
    decodeBinary: true,
    showFeed: true,
    cooldownMs: 1200,
    oneShot: false,
    roundOnce: true,
    armed: false,
    size: 52,
    lang: "bn",
    enableHotkey: true,
    hotkeyCode: "Space",
    relayEnabled: true,
    relayUrl: "https://ais-dev-ict72ogu7fcoxq34zetsdf-518590153352.asia-east1.run.app",
    roomId: "TT-2026",
    targetText: "Cash Out",
    targetSelector: "",
    zeroDelay: true,
    zeroDelayMicroMs: 0,
    humanTap: false,
    humanJitter: false,
    fingerprintShuffle: false,
    networkTap: true,
    preClickGate: true,
    wsLeadMs: 10,
    gateHoldMs: 30,
    holdEvents: "",
    inspectorEnabled: true,
    inspectorAutoClick: false,
    inspectorHoldAllWs: false,
    inspectorHoldMs: 32,
    inspectorKeywords: "finishGame, stopCoefficient, crashPoint, newStateId",
    inspectorRegexes: "\"amount\"\\s*:\\s*[1-9]\\d{2,}\n\\b(round_end|status_update)\\b",
    inspectorJsonPaths: "$.round.status\n$..status\n{\"path\": \"$.event\", \"equals\": \"end\"}",
    crashBuzzer: true,
    smartSmsSegmenter: true,
    smsSegmentThreshold: 30,
    smsExpectedTotal: 60,
    asyncWorker: true,
    autoApplyVerifiedTag: false,
    autoSiteProfile: true,
    opClickMode: true,
    directWsCashout: true,
    netLagAutoShift: true,
    fallbackMultX: 0,
    autoCashoutCeilingX: 0,
    preCrashMinFrames: 10,
    preCrashMaxFrames: 20,
    rtfPreEndMinMs: 2500,
    rtfPreEndMaxMs: 4500,
    rtfMinRounds: 2,
    autoConfigOnTag: true,
    manualTagPin: false
  };

  const BOT_BASE_URL = (CFG.relayUrl || '').replace(/\/+$/, '');
  const SHARED_BASE_URL = (BOT_BASE_URL.includes('ais-dev-')
    ? BOT_BASE_URL.replace('ais-dev-', 'ais-pre-')
    : BOT_BASE_URL
  ).replace(/\/+$/, '');
  const HTTP_BASES = [BOT_BASE_URL, SHARED_BASE_URL].filter((u, i, a) => Boolean(u) && a.indexOf(u) === i);

  let host = '';
  let currentOrigin = '';
  try {
    host = (targetWin.location && targetWin.location.hostname) ? targetWin.location.hostname.toLowerCase() : '';
    currentOrigin = (targetWin.location && targetWin.location.origin) ? targetWin.location.origin.toLowerCase() : '';
  } catch {
    try {
      host = window.location.hostname.toLowerCase();
      currentOrigin = window.location.origin.toLowerCase();
    } catch {}
  }

  const isTriggerTapApp =
    (BOT_BASE_URL && currentOrigin === BOT_BASE_URL.toLowerCase()) ||
    (SHARED_BASE_URL && currentOrigin === SHARED_BASE_URL.toLowerCase()) ||
    host.includes('ais-dev-') ||
    host.includes('ais-pre-') ||
    host.includes('aistudio.google.com') ||
    Boolean(document.documentElement && document.documentElement.dataset && document.documentElement.dataset.triggertapApp === '1');

  if (isTriggerTapApp) {
    if (CFG.relayEnabled && typeof GM_setValue === 'function' && typeof GM_getValue === 'function') {
      try {
        WIN.__TRIGGERTAP_GM_BRIDGE__ = true;
        window.__TRIGGERTAP_GM_BRIDGE__ = true;
        const gmBridgeKey = '__tt_bridge_' + CFG.roomId;
        const deliveredBatches = new Set();
        const deliveredUids = new Set();

        const forwardEvents = (list) => {
          if (!Array.isArray(list) || !list.length) return;
          const fresh = [];
          for (let i = 0; i < list.length; i++) {
            const ev = list[i];
            if (!ev || typeof ev !== 'object') continue;
            if (ev.uid) {
              if (deliveredUids.has(ev.uid)) continue;
              deliveredUids.add(ev.uid);
              if (deliveredUids.size > 900) {
                const first = deliveredUids.values().next().value;
                if (first !== undefined) deliveredUids.delete(first);
              }
            }
            fresh.push(ev);
          }
          if (!fresh.length) return;
          try { WIN.postMessage({ __tt_gm_msg: true, roomId: CFG.roomId, events: fresh }, '*'); } catch {}
          try { WIN.dispatchEvent(new CustomEvent('__triggertap_bridge__', { detail: fresh })); } catch {}
        };

        const consumeGmBridgeValue = (rawVal) => {
          if (!rawVal) return;
          let obj = rawVal;
          if (typeof rawVal === 'string') {
            try { obj = JSON.parse(rawVal); } catch { return; }
          }
          if (Array.isArray(obj)) {
            forwardEvents(obj);
            return;
          }
          if (obj && Array.isArray(obj.batches)) {
            for (let i = 0; i < obj.batches.length; i++) {
              const b = obj.batches[i];
              if (!b || !b.id || deliveredBatches.has(b.id)) continue;
              deliveredBatches.add(b.id);
              if (deliveredBatches.size > 120) {
                const first = deliveredBatches.values().next().value;
                if (first !== undefined) deliveredBatches.delete(first);
              }
              forwardEvents(b.events);
            }
          } else if (obj && Array.isArray(obj.events)) {
            if (!obj.id || !deliveredBatches.has(obj.id)) {
              if (obj.id) deliveredBatches.add(obj.id);
              forwardEvents(obj.events);
            }
          }
        };

        if (typeof GM_addValueChangeListener === 'function') {
          GM_addValueChangeListener(gmBridgeKey, function (_name, _oldVal, newVal) {
            consumeGmBridgeValue(newVal);
          });
        }
        const pullCurrent = () => {
          try {
            if (typeof GM_getValue === 'function') {
              consumeGmBridgeValue(GM_getValue(gmBridgeKey, null));
            } else if (typeof GM !== 'undefined' && typeof GM.getValue === 'function') {
              GM.getValue(gmBridgeKey, null).then(consumeGmBridgeValue).catch(() => {});
            }
          } catch {}
        };
        WIN.addEventListener('__triggertap_pull__', pullCurrent);
        window.addEventListener('__triggertap_pull__', pullCurrent);
        setInterval(pullCurrent, 60);
        setTimeout(pullCurrent, 5);
      } catch {}
    }
    return;
  }

  let isIframe = false;
  try {
    isIframe = (targetWin.top !== targetWin.self);
  } catch {
    isIframe = true;
  }
  if (!isIframe) {
    activeSessionId = FRAME_ID + '_' + BOOT_TS;
  }

  if (WIN.__TRIGGERTAP_ACTIVE__ || window.__TRIGGERTAP_ACTIVE__) {
    try { (WIN.__TRIGGERTAP_DESTROY__ || window.__TRIGGERTAP_DESTROY__)(); } catch (e) {}
  }
  WIN.__TRIGGERTAP_ACTIVE__ = true;
  window.__TRIGGERTAP_ACTIVE__ = true;

  // Keep native references BEFORE hooking page WebSocket / fetch / XHR
  const NativeWebSocket = targetWin.WebSocket || window.WebSocket;
  const rawProtoSendGlobal = NativeWebSocket && NativeWebSocket.prototype ? NativeWebSocket.prototype.send : null;
  const NativeFetch = targetWin.fetch || window.fetch;
  const nativeFetchOwner = (targetWin && typeof targetWin.fetch === 'function' && NativeFetch === targetWin.fetch) ? targetWin : window;
  const NativeXHR = targetWin.XMLHttpRequest || window.XMLHttpRequest;
  const nativeBeacon = (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function')
    ? navigator.sendBeacon.bind(navigator)
    : null;

  const RELAY_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt'
  ];
  const utf8Enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const utf8Dec = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null;

  function isRelayBrokerUrl(u) {
    const s = String(u || '');
    return s.includes('broker.emqx.io') || s.includes('broker.hivemq.com') || s.includes('test.mosquitto.org');
  }
  function isInternalRelayUrl(u) {
    const s = String(u || '').toLowerCase();
    return s.includes('/api/relay/') || isRelayBrokerUrl(s);
  }

  let wssSyncState = 'WAIT';
  let httpSyncState = 'WAIT';
  let activeHttpIdx = 0;
  let lastHttpRetryAt = 0;
  let httpFailCount = 0;
  let childIframeActive = false;

  function getHttpOriginLabel(baseUrl) {
    const b = baseUrl || HTTP_BASES[activeHttpIdx] || BOT_BASE_URL;
    return b.includes('ais-pre-') ? 'pre' : b.includes('ais-dev-') ? 'dev' : 'http';
  }

  const T = CFG.lang === 'bn' ? {
    armed: 'চালু (ON)',
    paused: 'বন্ধ (OFF)',
    lock: 'লক',
    unlock: 'আনলক',
    test: 'টেস্ট ক্লিক',
    tagPlaceholder: 'ট্যাগ বা JSON লিখুন (যেমন: "hash":, "status":"active")',
    tabWs: 'WS / SMS',
    tabApi: 'API JSON',
    tabTags: '🏷 ট্যাগ',
    clear: 'মুছুন',
    pauseFeed: '⏸ ফ্রিজ',
    resumeFeed: '▶ রিজিউম',
    expand: 'বড় ভিউ',
    collapse: 'ছোট ভিউ',
    copyJson: 'JSON কপি',
    useTag: 'ট্যাগে নিন',
    addTag: '+যোগ',
    searchPlaceholder: 'খুঁজুন: Waiting, state, c...',
    searchEmpty: 'খোঁজার সাথে মেলে এমন কোনো ডেটা নেই',
    emptyWs: 'এখনো কোনো WS / Binary / SMS ডেটা আসেনি',
    emptyApi: 'এখনো কোনো API Request / Response JSON আসেনি',
    emptyTags: 'এখনো কোনো নন-মাল্টিপ্লায়ার লাইভ ট্যাগ পাওয়া যায়নি (২–৩ রাউন্ড গেম চললে স্বয়ংক্রিয়ভাবে বের হবে)',
    preCrashHdr: '🔴 ২–৩ রাউন্ড চেক: পুরো রাউন্ডে মাত্র ১ বার (মাঝে বা শেষের SMS) আসে এমন ট্যাগ',
    liveTagsHdr: '🏷 সব নন-মাল্টিপ্লায়ার সার্ভার ট্যাগ',
    tagPreCrash: 'শেষের দিকের SMS (১×/R)',
    tagMidRound: 'রাউন্ডের মাঝে SMS (১×/R)',
    tagPostCrash: '⚠ শেষ/ক্র্যাশ (পরে)',
    tagEarlyWarn: '❌ ১ রাউন্ডে ২+ বার এসেছে — বৈধ ট্যাগ নয়',
    tagTimeBefore: '⏱ Crash হওয়ার ঠিক {dt} আগে এই SMS আসে',
    tagPosLast: 'শেষ থেকে {pos}নং SMS',
    tagPosMid: 'রাউন্ডের মাঝের SMS ({pos}/{tot})',
    tagGuaranteeOnce: '✅ প্রতি রাউন্ডে মাঝে/শেষে ১ বার এই ট্যাগ থাকবেই (১×/R)',
    tagFirstRoundOnce: '🟡 ১ম রাউন্ডে ১×/R — প্রতি রাউন্ডে ১টা থাকলে নিশ্চিত হবে',
    tagLive: 'লাইভ',
    tagActiveRed: '🔴 ব্যবহৃত (Active)',
    tagRecRed: '🔴 ব্যবহার করুন',
    tagPhaseWait: '⏸ ওয়েট/বেটিং ফেজ',
    roundProgWait: '🔄 রাউন্ড চেক: {n}/3 — ১ রাউন্ডে ২ বার এলেই বাদ দিয়ে পুরো রাউন্ডে মাত্র ১ বার আসা ভিন্ন SMS খোঁজা হচ্ছে...',
    roundProgAlmost: '🟡 রাউন্ড চেক: 2/3 — ২+ বার আসা ট্যাগ বাদ দিয়ে 🔴 প্রতি রাউন্ডে ১ বার থাকা ভিন্ন SMS নিশ্চিত হচ্ছে',
    roundProgReady: '🔴 {n} রাউন্ড ভেরিফাইড — প্রতি রাউন্ডে ১ বার (মাঝে বা শেষের SMS) থাকবেই এমন 🔴 ট্যাগ নিশ্চিত হয়েছে',
    noLateTagHint: 'ℹ ১ রাউন্ডে ২+ বার আসা ট্যাগ (এটি বৈধ ট্যাগ নয়) ও বেটিং/রেজাল্ট ট্যাগ বাদ দেওয়া হয়েছে — পুরো রাউন্ডে ১ বার আসে এমন ভিন্ন SMS এখনো নিশ্চিত হয়নি',
    autoPickLate: '🔴 সেরা ১×/R ট্যাগ বসান',
    hint: 'পাইপলাইন: Server ➔ টুল (আগে ম্যাচ+ক্লিক) ➔ Game WS ➔ Display View',
    raceWait: '🛡️ পাইপলাইন: Server ➔ টুল (আগে ম্যাচ) ➔ WS ➔ Display · অপেক্ষায়...',
    raceShow: 'টাইমলাইন',
    raceHide: 'লুকান',
    gaugeTitle: '📊 ল্যাটেন্সি গেজ · Raw WS → ক্লিক',
    gaugeStandby: 'অপেক্ষায় (১০–২০ms লিড)',
    gaugeBeat: '⚡ ১০–২০ms লিড সফল',
    gaugeWindow: '✓ ১০–২০ms উইন্ডো',
    gaugeLate: '⚠ ২০ms ছাড়িয়েছে',
    gaugeDtLbl: 'WS → ক্লিক Δt',
    gaugeLead10Lbl: '১০ms লিড মার্জিন',
    gaugeLead20Lbl: '২০ms লিড মার্জিন',
    gaugeAvgLbl: 'গড় / সেরা',
    gaugeFast: '০–১০ms ফাস্ট',
    gaugeBand: '১০–২০ms লিড',
    metricSpeed: 'সর্বশেষ স্পিড',
    metricTarget: 'পিন টার্গেট',
    metricHits: 'অটো-ক্লিক',
    tunerBtn: '⚙️ গেট',
    tunerLead: 'WS লিড (ms)',
    tunerHold: 'গেট হোল্ড (ms)',
    tunerInspHold: 'Insp হোল্ড (ms)',
    tunerInspOn: 'Inspector চালু',
    tunerAutoClick: 'হোল্ড → ১–২ms ক্লিক',
    tunerHoldAll: 'সব WS হোল্ড',
    tunerKw: 'Keywords (কমা)',
    tunerRx: 'Regex (প্রতি লাইনে)',
    tunerJp: 'JSONPath ($.path)',
    roundOnceOn: '১×/R',
    roundOnceOff: '∞/R',
    pickBtn: '⊕ সিলেক্ট',
    pickActive: 'বাটনে ক্লিক করুন...',
    pickPrompt: '⊕ গেমের যেকোনো বাটনে ক্লিক/ট্যাপ করুন (বাতিল করতে এখানে চাপুন বা Esc)',
    pickDone: '✓ পিন: {label}',
    earlyConfiguredWarn: '⚠ "{tag}" প্রতি রাউন্ডে একাধিকবার (বারবার) আসে! পুরো রাউন্ডে ১ বার (মাঝে বা Crash আগে) আসা 🔴 ১×/R ট্যাগ নিন ও ১×/R লক চালু রাখুন',
    postResultConfiguredWarn: '⚠ "{tag}" রাউন্ড রেজাল্ট / Crash-পরের ট্যাগ! সার্ভার এই মেসেজ পাঠানোর আগেই Cashout বন্ধ করে দেয় — এর আগের লাইভ ফ্লাইট ট্যাগ দিন',
    waitPhaseConfiguredWarn: '⚠ "{tag}" বেটিং / ওয়েট / DOM ফেজ ট্যাগ! এটি আসল ইন-ফ্লাইট Cashout ট্যাগ নয়',
    crashBuzzerOn: '🔔 সংকেত',
    crashBuzzerOff: '🔇 মিউট',
    crashBannerText: '🚨 বাজার CRASH! · {time}',
    secLogTitle: '🛡️ সিকিউরিটি লগ · বাইপাস',
    secLogShow: 'লগ',
    secLogHide: 'লুকান',
    secLogStandby: 'নিরীক্ষণ চালু',
    secLogEmpty: 'এখনো কোনো ফিল্টার বাইপাস ইভেন্ট লগ হয়নি',
    secLogClear: 'মুছুন',
    secVarLbl: 'ল্যাটেন্সি ভ্যারিয়েন্স',
    secVarStandby: 'অপেক্ষায় (০ms চেক)',
    secVarZeroOk: '✅ ০ms বাইপাস নির্ভুল',
    secVarLow: '🟢 লো ভ্যারিয়েন্স',
    secVarDrift: '⚠ জিটর / ভ্যারিয়েন্স',
    secVarHold: 'ℹ হোল্ড মোড',
    rtfEndRoundBtn: '🏁 রাউন্ড শেষ [F8]'
  } : {
    armed: 'ARMED',
    paused: 'PAUSED',
    lock: 'Lock',
    unlock: 'Unlock',
    test: 'Test Click',
    tagPlaceholder: 'Tags or JSON (e.g. "hash":, "status":"active")',
    tabWs: 'WS / SMS',
    tabApi: 'API JSON',
    tabTags: '🏷 Tags',
    clear: 'Clear',
    pauseFeed: '⏸ Freeze',
    resumeFeed: '▶ Resume',
    expand: 'Expand',
    collapse: 'Compact',
    copyJson: 'Copy JSON',
    useTag: 'Use Tag',
    addTag: '+Add',
    searchPlaceholder: 'Search: Waiting, state, c...',
    searchEmpty: 'No captured logs match this filter',
    emptyWs: 'No WS / Binary / SMS frames captured yet',
    emptyApi: 'No API Request / Response JSON captured yet',
    emptyTags: 'No non-multiplier live tags discovered yet (play 2–3 rounds to verify automatically)',
    preCrashHdr: '🔴 2–3 Round Verified: Unique SMS Appearing Strictly 1×/Round (Mid or Last Few)',
    liveTagsHdr: '🏷 All Non-Multiplier Server Tags',
    tagPreCrash: 'Last-Few SMS (1×/R)',
    tagMidRound: 'Mid-Round SMS (1×/R)',
    tagPostCrash: '⚠ End/Crash (Post)',
    tagEarlyWarn: '❌ Repeated 2+× in 1 Round — Not Valid',
    tagTimeBefore: '⏱ Arrives {dt} right before Crash',
    tagPosLast: '#{pos} from end',
    tagPosMid: 'Mid-round #{pos}/{tot}',
    tagGuaranteeOnce: '✅ Guaranteed 1× Every Round (Mid or Pre-Crash)',
    tagFirstRoundOnce: '🟡 1× in Round 1 — waiting 1 more round to guarantee',
    tagLive: 'Live',
    tagActiveRed: '🔴 IN USE (Active)',
    tagRecRed: '🔴 USE THIS',
    tagPhaseWait: '⏸ Wait/Bet Phase',
    roundProgWait: '🔄 Checking rounds: {n}/3 — rejecting any tag that repeats 2+× in a round; finding unique 1×/round SMS...',
    roundProgAlmost: '🟡 Round Check: 2/3 — filtering repeating ticks to confirm 🔴 guaranteed 1×/round mid/last-few SMS',
    roundProgReady: '🔴 {n} Rounds Verified — guaranteed 🔴 1× every round (mid-round or last-few before crash) SMS confirmed',
    noLateTagHint: 'ℹ Tags appearing 2+× in any single round & betting/result tags excluded — no unique 1×/round SMS confirmed yet',
    autoPickLate: '🔴 Apply Best 1×/R Tag',
    hint: 'Pipeline: Server ➔ Tool (Match+Click First) ➔ Game WS ➔ Display View',
    raceWait: '🛡️ Pipeline: Server ➔ Tool (Match First) ➔ WS ➔ Display · Waiting...',
    raceShow: 'Timeline',
    raceHide: 'Hide',
    gaugeTitle: '📊 Latency Gauge · Raw WS → Click',
    gaugeStandby: 'Standby (10–20ms Lead)',
    gaugeBeat: '⚡ 10–20ms Lead Beat',
    gaugeWindow: '✓ In 10–20ms Window',
    gaugeLate: '⚠ Exceeded 20ms Lead',
    gaugeDtLbl: 'WS → Click Δt',
    gaugeLead10Lbl: 'vs 10ms Lead',
    gaugeLead20Lbl: 'vs 20ms Lead',
    gaugeAvgLbl: 'Avg / Best',
    gaugeFast: '0–10ms Fast',
    gaugeBand: '10–20ms Lead',
    metricSpeed: 'Last Speed',
    metricTarget: 'Pinned Target',
    metricHits: 'Auto Clicks',
    tunerBtn: '⚙️ Gate',
    tunerLead: 'WS Lead (ms)',
    tunerHold: 'Gate Hold (ms)',
    tunerInspHold: 'Insp Hold (ms)',
    tunerInspOn: 'Inspector ON',
    tunerAutoClick: 'Hold → 1–2ms Click',
    tunerHoldAll: 'Hold ALL WS',
    tunerKw: 'Keywords (comma)',
    tunerRx: 'Regex (per line)',
    tunerJp: 'JSONPath ($.path)',
    roundOnceOn: '1×/R',
    roundOnceOff: '∞/R',
    pickBtn: '⊕ Select',
    pickActive: 'Click Target...',
    pickPrompt: '⊕ Click/tap any button on the game page (click here or press Esc to cancel)',
    pickDone: '✓ Pinned: {label}',
    earlyConfiguredWarn: '⚠ "{tag}" repeats multiple times per round! Switch to a 🔴 1×/R (mid-round or pre-crash) tag & keep 1×/R lock ON',
    postResultConfiguredWarn: '⚠ "{tag}" is a Round Result / Post-Cutoff tag! Server closes cashouts before sending this — switch to an earlier in-flight tag',
    waitPhaseConfiguredWarn: '⚠ "{tag}" is a betting / waiting / DOM UI tag, not an in-flight Cashout trigger',
    crashBuzzerOn: '🔔 Alert',
    crashBuzzerOff: '🔇 Muted',
    crashBannerText: '🚨 MARKET CRASH! · {time}',
    secLogTitle: '🛡️ Security Log · Bypass',
    secLogShow: 'Log',
    secLogHide: 'Hide',
    secLogStandby: 'Monitoring',
    secLogEmpty: 'No filter-bypass events logged yet',
    secLogClear: 'Clear',
    secVarLbl: 'Latency Variance',
    secVarStandby: 'Standby (0ms Check)',
    secVarZeroOk: '✅ Zero-Delay Verified',
    secVarLow: '🟢 Low Variance',
    secVarDrift: '⚠ Jitter / Variance',
    secVarHold: 'ℹ Hold Mode',
    rtfEndRoundBtn: '🏁 End Round [F8]'
  };

  function copyTextSafe(txt) {
    const s = String(txt == null ? '' : txt);
    if (!s) return;
    try {
      if (typeof GM_setClipboard === 'function') { GM_setClipboard(s, 'text'); return; }
    } catch {}
    try {
      if (typeof GM !== 'undefined' && typeof GM.setClipboard === 'function') { GM.setClipboard(s, 'text'); return; }
    } catch {}
    try {
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(s).catch(() => {});
        return;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = s;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
      (document.body || document.documentElement).appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      if (ta.parentNode) ta.parentNode.removeChild(ta);
    } catch {}
  }

  let locked = (() => {
    try {
      if (localStorage.getItem('__tt_locked') === '1') return true;
    } catch {}
    try {
      if (typeof GM_getValue === 'function') {
        const gmSt = GM_getValue('__tt_state_' + CFG.roomId, null);
        const o = typeof gmSt === 'string' ? JSON.parse(gmSt) : gmSt;
        if (o && typeof o.locked === 'boolean') return o.locked;
      }
    } catch {}
    return false;
  })();
  try {
    const savedArmed = sessionStorage.getItem('__tt_armed');
    if (savedArmed === '1') CFG.armed = true;
    else if (savedArmed === '0') CFG.armed = false;
    const savedRoundOnce = sessionStorage.getItem('__tt_round_once');
    if (savedRoundOnce === '1') CFG.roundOnce = true;
    else if (savedRoundOnce === '0') CFG.roundOnce = false;
    const savedZeroDelay = sessionStorage.getItem('__tt_zero_delay');
    if (savedZeroDelay === '1') CFG.zeroDelay = true;
    else if (savedZeroDelay === '0') CFG.zeroDelay = false;
    const savedZeroMicro = sessionStorage.getItem('__tt_zero_delay_micro');
    if (savedZeroMicro !== null && savedZeroMicro !== '' && !isNaN(Number(savedZeroMicro))) {
      CFG.zeroDelayMicroMs = Math.max(0, Math.min(5, Math.round(Number(savedZeroMicro) * 2) / 2));
    }
    const savedHumanJitter = sessionStorage.getItem('__tt_human_jitter');
    if (savedHumanJitter === '1') CFG.humanJitter = true;
    else if (savedHumanJitter === '0') CFG.humanJitter = false;
    const savedFpShuffle = sessionStorage.getItem('__tt_fp_shuffle');
    if (savedFpShuffle === '1') CFG.fingerprintShuffle = true;
    else if (savedFpShuffle === '0') CFG.fingerprintShuffle = false;
    const savedCrashBuzzer = sessionStorage.getItem('__tt_crash_buzzer');
    if (savedCrashBuzzer === '1') CFG.crashBuzzer = true;
    else if (savedCrashBuzzer === '0') CFG.crashBuzzer = false;
    const savedSmartSeg = sessionStorage.getItem('__tt_smart_sms_seg');
    if (savedSmartSeg === '1') CFG.smartSmsSegmenter = true;
    else if (savedSmartSeg === '0') CFG.smartSmsSegmenter = false;
    const savedSegThresh = sessionStorage.getItem('__tt_sms_seg_thresh');
    if (savedSegThresh !== null && savedSegThresh !== '' && !isNaN(Number(savedSegThresh))) {
      CFG.smsSegmentThreshold = Math.max(2, Math.min(500, Math.round(Number(savedSegThresh))));
    }
    const savedSegTotal = sessionStorage.getItem('__tt_sms_seg_total');
    if (savedSegTotal !== null && savedSegTotal !== '' && !isNaN(Number(savedSegTotal))) {
      CFG.smsExpectedTotal = Math.max(CFG.smsSegmentThreshold, Math.min(1000, Math.round(Number(savedSegTotal))));
    }
    if (typeof GM_getValue === 'function') {
      const gmSt = GM_getValue('__tt_state_' + CFG.roomId, null);
      const o = typeof gmSt === 'string' ? JSON.parse(gmSt) : gmSt;
      if (o && typeof o.zeroDelayMicroMs === 'number' && (savedZeroMicro === null || savedZeroMicro === '')) {
        CFG.zeroDelayMicroMs = Math.max(0, Math.min(5, Math.round(o.zeroDelayMicroMs * 2) / 2));
      }
      if (o && typeof o.fingerprintShuffle === 'boolean' && savedFpShuffle === null) {
        CFG.fingerprintShuffle = o.fingerprintShuffle;
      }
      if (o && typeof o.smartSmsSegmenter === 'boolean' && savedSmartSeg === null) {
        CFG.smartSmsSegmenter = o.smartSmsSegmenter;
      }
      if (o && typeof o.smsSegmentThreshold === 'number' && (savedSegThresh === null || savedSegThresh === '')) {
        CFG.smsSegmentThreshold = Math.max(2, Math.min(500, Math.round(o.smsSegmentThreshold)));
      }
      if (o && typeof o.smsExpectedTotal === 'number' && (savedSegTotal === null || savedSegTotal === '')) {
        CFG.smsExpectedTotal = Math.max(CFG.smsSegmentThreshold, Math.min(1000, Math.round(o.smsExpectedTotal)));
      }
    }
  } catch {}
  function persistHudControlState() {
    try { localStorage.setItem('__tt_locked', locked ? '1' : '0'); } catch {}
    try { sessionStorage.setItem('__tt_armed', CFG.armed ? '1' : '0'); } catch {}
    try { sessionStorage.setItem('__tt_round_once', CFG.roundOnce ? '1' : '0'); } catch {}
    try { sessionStorage.setItem('__tt_zero_delay', CFG.zeroDelay ? '1' : '0'); } catch {}
    try { sessionStorage.setItem('__tt_zero_delay_micro', String(CFG.zeroDelayMicroMs || 0)); } catch {}
    try { sessionStorage.setItem('__tt_human_jitter', CFG.humanJitter ? '1' : '0'); } catch {}
    try { sessionStorage.setItem('__tt_fp_shuffle', CFG.fingerprintShuffle ? '1' : '0'); } catch {}
    try { sessionStorage.setItem('__tt_crash_buzzer', CFG.crashBuzzer ? '1' : '0'); } catch {}
    try { sessionStorage.setItem('__tt_smart_sms_seg', CFG.smartSmsSegmenter ? '1' : '0'); } catch {}
    try { sessionStorage.setItem('__tt_sms_seg_thresh', String(CFG.smsSegmentThreshold || 30)); } catch {}
    try { sessionStorage.setItem('__tt_sms_seg_total', String(CFG.smsExpectedTotal || 60)); } catch {}
    if (typeof GM_setValue === 'function') {
      try {
        GM_setValue('__tt_state_' + CFG.roomId, JSON.stringify({
          locked: Boolean(locked),
          zeroDelay: Boolean(CFG.zeroDelay),
          zeroDelayMicroMs: Math.max(0, Math.min(5, Math.round((Number(CFG.zeroDelayMicroMs) || 0) * 2) / 2)),
          fingerprintShuffle: Boolean(CFG.fingerprintShuffle),
          smartSmsSegmenter: Boolean(CFG.smartSmsSegmenter),
          smsSegmentThreshold: Math.max(2, Math.min(500, Math.round(Number(CFG.smsSegmentThreshold) || 30))),
          smsExpectedTotal: Math.max(4, Math.min(1000, Math.round(Number(CFG.smsExpectedTotal) || 60))),
          targetX: typeof targetX === 'number' ? Math.round(targetX) : undefined,
          targetY: typeof targetY === 'number' ? Math.round(targetY) : undefined,
          ts: Date.now()
        }));
      } catch {}
    }
  }
  let crashAudioCtx = null;
  let lastCrashAlertAt = 0;
  let crashAlertSentForRound = false;
  let crashAlertLastRoundId = '';
  let crashAlertBannerTimer = null;
  let lastGmWinnerSig = '';
  let lastGmWinnerAt = 0;
  let lastGmClaimSig = '';
  let lastGmClaimAt = 0;
  let roundClickLocked = false;
  let roundClickLockedAt = 0;
  let roundSawFlightAfterLock = false;
  let roundSawCrashAfterLock = false;
  let roundLastFlightAt = 0;
  let roundClickLockedRoundId = '';
  let currentTagRoundId = '';
  let roundUnlockSeq = 0;
  let tagFlightSeenInRound = false;
  let isDraggingTarget = false;
  let lastTriggerAt = 0;
  let triggerCount = 0;
  let totalWsCount = 0;
  let totalApiCount = 0;
  let localWsCount = 0;
  let localApiCount = 0;
  let userTouchedHud = false;
  let userClosed = false;
  let hudHidden = isIframe;
  let hudCoordTimer = null;
  let iframeFallbackActive = false;
  let topAcked = false;
  let lastTopMsgAt = 0;
  let lastTopAckSentAt = 0;
  let iframeNoAckBatches = 0;
  let topReportedWss = 'WAIT';
  let topReportedHttp = 'WAIT';
  let topReportedOrigin = '';
  let childSourceWin = null;
  let gmBridgeSeq = 0;
  let gmBridgeQueue = [];
  const httpPendingQueue = [];
  const topSeenUids = new Set();
  const hudClaims = new Map();
  let currentHudWinner = null;
  const seenFrameClickIds = new Set();
  let nextFrameClickSeq = 1;
  const gmListenerIds = [];
  let lastHitTag = '';
  let lastMatchPreview = '';
  let renderLogsTimer = null;
  let domBatchTimer = null;
  let minimized = false;
  let showLogs = CFG.showFeed;
  let feedFrozen = false;
  let expandedView = false;
  let activeTab = 'ws';
  let feedQuery = '';
  let feedSrcFilter = 'all';
  const wsLogs = [];
  const apiLogs = [];
  const triggeredLogs = [];
  const hitLogs = [];
  const liveTagMap = new Map();
  const liveTagList = [];
  const preCrashTags = [];
  const serverRejectedTagMap = new Map();
  let lastOutCashSentAt = 0;
  let lastFiredTagForRace = '';
  let lastFiredTagAt = 0;
  let rollingServerRttMs = 0;
  let lastServerAcceptMs = 0;
  let lastServerAcceptDeltaMs = 0;
  let latestRoundMeta = { roundId: '', betId: '', updatedAt: 0 };
  let lastAutoMultFiredAt = 0;
  let lastGameBoxSyncAt = 0;
  let tagRoundCount = 0;
  let lastTagRoundEndMono = 0;
  let currentRoundStartMono = 0;
  let currentRoundMsgSeq = 0;
  const currentRoundTagEntries = new Map();
  const currentRoundAllTicks = new Map();
  const roundDurationHistory = [];
  const aiCurRoundFrames = [];
  let aiCurRoundRawCount = 0;
  let aiLastRoundFrames = [];
  let aiLastRoundRawCount = 0;
  let aiFrameSeq = 1;
  let aiHudLoading = false;
  let aiHudAuto = false;
  let aiHudLastAutoAt = 0;
  let aiHudError = '';
  let aiHudAnalysis = null;
  const latencySamples = [];
  let showLatencyGauge = false;
  let showGateTuner = false;
  let lastReactionMsStr = '0.00';
  const raceTimeline = [];
  const gateEntryById = new Map();
  const pendingGateFlushMap = new Map();
  let lastClickRace = null;
  let showRaceTimeline = false;
  const securityLogs = [];
  const secLatencyDeltas = [];
  let showSecurityLog = true;
  let secUiTimer = null;
  let lastGateSecLogAt = 0;
  let lastDomClickMeta = null;
  let fbGlobalClickUntil = 0;
  let fbLastClickDoneAt = 0;
  let fbActiveClickCount = 0;
  let nextFbGateId = 1;
  let tightenFbCrashHolds = null;
  let elementPickMode = false;
  let pickBannerEl = null;
  let pickBoxEl = null;
  let pickTipEl = null;
  let prevDocCursor = '';
  let pickCleanupFns = [];

  const savedPos = (() => {
    try {
      const p = JSON.parse(localStorage.getItem('__tt_pos') || 'null');
      if (p && typeof p.x === 'number') return p;
    } catch {}
    try {
      if (typeof GM_getValue === 'function') {
        const g = GM_getValue('__tt_pos_' + CFG.roomId, null);
        const o = typeof g === 'string' ? JSON.parse(g) : g;
        if (o && typeof o.x === 'number') return o;
      }
    } catch {}
    return null;
  })();
  const savedAnchor = (() => {
    try {
      const a = JSON.parse(localStorage.getItem('__tt_anchor') || 'null');
      if (a) return a;
    } catch {}
    try {
      if (typeof GM_getValue === 'function') {
        const g = GM_getValue('__tt_anchor_' + CFG.roomId, null);
        const o = typeof g === 'string' ? JSON.parse(g) : g;
        if (o) return o;
      }
    } catch {}
    return null;
  })();

  const getSafeVisibleHeight = () => {
    const vh = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 640;
    const scrH = (typeof window.screen === 'object' && window.screen && (window.screen.availHeight || window.screen.height)) || 840;
    try {
      if (isIframe && window.frameElement && window.top) {
        const fr = window.frameElement.getBoundingClientRect();
        const topH = window.top.innerHeight || scrH;
        const visBottom = Math.min(vh, Math.max(280, topH - fr.top));
        if (visBottom >= 240) return visBottom;
      }
    } catch {}
    if (isIframe && vh > scrH * 1.1) {
      return Math.min(vh, Math.max(420, Math.round(scrH * 0.78)));
    }
    return vh;
  };

  const rawInitW = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
  const rawInitH = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
  const initVw = rawInitW >= 120 ? rawInitW : 360;
  const initVh = rawInitH >= 120 ? rawInitH : 640;
  const initVisH = Math.min(initVh, getSafeVisibleHeight());

  let targetX = savedPos && typeof savedPos.x === 'number' ? savedPos.x : Math.round(initVw * 0.5);
  let targetY = savedPos && typeof savedPos.y === 'number' ? savedPos.y : Math.round((isIframe ? initVisH : initVh) * 0.58);
  if (isIframe && targetY > initVisH - 24 && !(savedAnchor && typeof savedAnchor.absY === 'number')) {
    targetY = Math.round(initVisH * 0.58);
  }

  const hasSavedManualPos = Boolean((savedAnchor && savedAnchor.manual) || (!savedAnchor && savedPos));
  const sanitizeSavedTargetTxt = (v) => {
    const t = String(v || '').trim();
    if (!t) return '';
    const l = t.toLowerCase().replace(/\s+/g, ' ');
    if (
      l === 'bet' || l === 'বাজি' || l.startsWith('bet ') || l.startsWith('place bet') ||
      l.includes('cancel') || l.includes('বাতিল') || l === 'wait' || l.includes('waiting') ||
      l.includes('অপেক্ষা') || l.includes('auto cash') || l.includes('autocash') ||
      l.includes('auto-cash') || l.includes('auto bet') || l.includes('autobet') || l.includes('অটো ক্যাশ')
    ) return '';
    return t;
  };
  const anchor = {
    el: null,
    slotEl: null,
    slotSelector: (savedAnchor && savedAnchor.slotSelector) ? savedAnchor.slotSelector : '',
    slotStructPath: (savedAnchor && savedAnchor.slotStructPath) ? savedAnchor.slotStructPath : '',
    structPath: (savedAnchor && savedAnchor.structPath) ? savedAnchor.structPath : '',
    slotRelX: savedAnchor && typeof savedAnchor.slotRelX === 'number' ? savedAnchor.slotRelX : 0.5,
    slotRelY: savedAnchor && typeof savedAnchor.slotRelY === 'number' ? savedAnchor.slotRelY : 0.5,
    lockedExplicit: Boolean(savedAnchor && savedAnchor.lockedExplicit),
    manual: hasSavedManualPos,
    selector: (CFG.targetSelector && (!savedAnchor || !savedAnchor.manual))
      ? CFG.targetSelector
      : ((savedAnchor && savedAnchor.selector) ? savedAnchor.selector : (CFG.targetSelector || '')),
    text: (savedAnchor && savedAnchor.manual)
      ? sanitizeSavedTargetTxt(savedAnchor.text || '')
      : (hasSavedManualPos ? '' : sanitizeSavedTargetTxt(CFG.targetText || (savedAnchor && savedAnchor.text ? savedAnchor.text : ''))),
    relX: savedAnchor && typeof savedAnchor.relX === 'number' ? savedAnchor.relX : 0.5,
    relY: savedAnchor && typeof savedAnchor.relY === 'number' ? savedAnchor.relY : 0.5,
    absX: savedAnchor && typeof savedAnchor.absX === 'number' ? savedAnchor.absX : targetX,
    absY: savedAnchor && typeof savedAnchor.absY === 'number'
      ? (isIframe && savedAnchor.absY > initVisH - 24 ? Math.round(initVisH * 0.58) : savedAnchor.absY)
      : targetY,
    baseVw: savedAnchor && typeof savedAnchor.baseVw === 'number' ? savedAnchor.baseVw : initVw,
    baseVh: savedAnchor && typeof savedAnchor.baseVh === 'number' ? savedAnchor.baseVh : initVh,
    scrollX: savedAnchor && typeof savedAnchor.scrollX === 'number' ? savedAnchor.scrollX : (window.scrollX || 0),
    scrollY: savedAnchor && typeof savedAnchor.scrollY === 'number' ? savedAnchor.scrollY : (window.scrollY || 0),
    pctX: savedAnchor && typeof savedAnchor.pctX === 'number' ? savedAnchor.pctX : (targetX / Math.max(1, initVw)),
    pctY: savedAnchor && typeof savedAnchor.pctY === 'number' ? savedAnchor.pctY : (targetY / Math.max(1, initVisH))
  };

  const clampTarget = () => {
    const r = CFG.size / 2;
    const vw = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
    const vh = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
    if (vw < 120 || vh < 120) return;
    targetX = Math.max(r, Math.min(vw - r, targetX));
    targetY = Math.max(r, Math.min(vh - r, targetY));
  };
  clampTarget();

  const decoder = utf8Dec;

  function prettyJsonIfPossible(str) {
    if (!str) return '';
    const trimmed = String(str).trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {}
    }
    const idxObj = trimmed.indexOf('{');
    const idxArr = trimmed.indexOf('[');
    const startIdx = (idxObj >= 0 && idxArr >= 0) ? Math.min(idxObj, idxArr) : Math.max(idxObj, idxArr);
    if (startIdx > 0) {
      const prefix = trimmed.slice(0, startIdx).trim();
      const rest = trimmed.slice(startIdx).trim();
      try {
        return prefix + '\n' + JSON.stringify(JSON.parse(rest), null, 2);
      } catch {}
    }
    return trimmed;
  }

  function decodeSFSObjectSync(bytes) {
    try {
      if (!bytes || bytes.length < 3 || bytes[0] !== 0x12) return null;
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const ptr = { i: 1 };
      const readStr = (len) => {
        if (ptr.i + len > bytes.length) return '';
        const sub = bytes.subarray(ptr.i, ptr.i + len);
        ptr.i += len;
        return decoder ? decoder.decode(sub) : '';
      };
      const readI64 = (off) => {
        const hi = dv.getInt32(off, false);
        const lo = dv.getUint32(off + 4, false);
        const v = hi * 4294967296 + lo;
        return Number.isSafeInteger(v) ? v : String(v);
      };
      const parseVal = (typeId) => {
        switch (typeId) {
          case 0: return null;
          case 1: return bytes[ptr.i++] !== 0;
          case 2: return dv.getInt8(ptr.i++);
          case 3: { const v = dv.getInt16(ptr.i, false); ptr.i += 2; return v; }
          case 4: { const v = dv.getInt32(ptr.i, false); ptr.i += 4; return v; }
          case 5: { const v = readI64(ptr.i); ptr.i += 8; return v; }
          case 6: { const v = dv.getFloat32(ptr.i, false); ptr.i += 4; return Math.round(v * 10000) / 10000; }
          case 7: { const v = dv.getFloat64(ptr.i, false); ptr.i += 8; return Math.round(v * 10000) / 10000; }
          case 8: { const l = dv.getUint16(ptr.i, false); ptr.i += 2; return readStr(l); }
          case 9: { const n = dv.getUint16(ptr.i, false); ptr.i += 2; const a = []; for (let k = 0; k < n && ptr.i < bytes.length; k++) a.push(bytes[ptr.i++] !== 0); return a; }
          case 10: {
            const n = dv.getInt32(ptr.i, false); ptr.i += 4;
            if (n < 0 || ptr.i + n > bytes.length) { ptr.i = bytes.length; return null; }
            const sub = bytes.subarray(ptr.i, ptr.i + n); ptr.i += n;
            if (n > 2 && sub[0] === 0x12) { const nested = decodeSFSObjectSync(sub); if (nested) return nested; }
            const s = decoder ? decoder.decode(sub) : '';
            if (s.trim().startsWith('{') || s.trim().startsWith('[')) { try { return JSON.parse(s); } catch {} }
            return '<bytes:' + n + '>';
          }
          case 11: { const n = dv.getUint16(ptr.i, false); ptr.i += 2; const a = []; for (let k = 0; k < n && ptr.i + 2 <= bytes.length; k++) { a.push(dv.getInt16(ptr.i, false)); ptr.i += 2; } return a; }
          case 12: { const n = dv.getUint16(ptr.i, false); ptr.i += 2; const a = []; for (let k = 0; k < n && ptr.i + 4 <= bytes.length; k++) { a.push(dv.getInt32(ptr.i, false)); ptr.i += 4; } return a; }
          case 13: { const n = dv.getUint16(ptr.i, false); ptr.i += 2; const a = []; for (let k = 0; k < n && ptr.i + 8 <= bytes.length; k++) { a.push(readI64(ptr.i)); ptr.i += 8; } return a; }
          case 14: { const n = dv.getUint16(ptr.i, false); ptr.i += 2; const a = []; for (let k = 0; k < n && ptr.i + 4 <= bytes.length; k++) { a.push(Math.round(dv.getFloat32(ptr.i, false) * 10000) / 10000); ptr.i += 4; } return a; }
          case 15: { const n = dv.getUint16(ptr.i, false); ptr.i += 2; const a = []; for (let k = 0; k < n && ptr.i + 8 <= bytes.length; k++) { a.push(Math.round(dv.getFloat64(ptr.i, false) * 10000) / 10000); ptr.i += 8; } return a; }
          case 16: { const n = dv.getUint16(ptr.i, false); ptr.i += 2; const a = []; for (let k = 0; k < n && ptr.i + 2 <= bytes.length; k++) { const l = dv.getUint16(ptr.i, false); ptr.i += 2; a.push(readStr(l)); } return a; }
          case 17: { const n = dv.getUint16(ptr.i, false); ptr.i += 2; const a = []; for (let k = 0; k < n && ptr.i < bytes.length; k++) { const et = bytes[ptr.i++]; a.push(parseVal(et)); } return a; }
          case 18: { const n = dv.getUint16(ptr.i, false); ptr.i += 2; const o = {}; for (let k = 0; k < n && ptr.i + 2 <= bytes.length; k++) { const kl = dv.getUint16(ptr.i, false); ptr.i += 2; const key = readStr(kl); if (ptr.i >= bytes.length) break; const vt = bytes[ptr.i++]; o[key] = parseVal(vt); } return o; }
          case 19: { const l = dv.getUint16(ptr.i, false); ptr.i += 2; return readStr(l); }
          case 20: { const l = dv.getInt32(ptr.i, false); ptr.i += 4; return l > 0 ? readStr(l) : ''; }
          default: throw new Error('SFS');
        }
      };
      return parseVal(18);
    } catch { return null; }
  }

  function decodeMsgPack(bytes) {
    let offset = 0;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    function readU64(signed) {
      const hi = signed ? view.getInt32(offset) : view.getUint32(offset);
      const lo = view.getUint32(offset + 4);
      offset += 8;
      const val = hi * 4294967296 + lo;
      return Number.isSafeInteger(val) ? val : String(val);
    }
    function skipBytes(len) {
      if (len < 0 || offset + len > bytes.length) throw new Error('EOF');
      offset += len;
      return '<ext:' + len + '>';
    }
    function read(depth) {
      if (offset >= bytes.length || (depth || 0) > 16) throw new Error('EOF');
      const d = (depth || 0) + 1;
      const b = bytes[offset++];
      if (b <= 0x7f) return b;
      if (b >= 0xe0) return b - 256;
      if ((b & 0xf0) === 0x80) return readMap(b & 0x0f, d);
      if ((b & 0xf0) === 0x90) return readArray(b & 0x0f, d);
      if ((b & 0xe0) === 0xa0) return readStr(b & 0x1f);
      switch (b) {
        case 0xc0: return null;
        case 0xc2: return false;
        case 0xc3: return true;
        case 0xc4: return readBin(bytes[offset++]);
        case 0xc5: { const l = view.getUint16(offset); offset += 2; return readBin(l); }
        case 0xc6: { const l = view.getUint32(offset); offset += 4; return readBin(l); }
        case 0xc7: { const l = bytes[offset++]; offset += 1; return skipBytes(l); }
        case 0xc8: { const l = view.getUint16(offset); offset += 3; return skipBytes(l); }
        case 0xc9: { const l = view.getUint32(offset); offset += 5; return skipBytes(l); }
        case 0xca: { const v = view.getFloat32(offset); offset += 4; return Number(v.toFixed(6)); }
        case 0xcb: { const v = view.getFloat64(offset); offset += 8; return v; }
        case 0xcc: return bytes[offset++];
        case 0xcd: { const v = view.getUint16(offset); offset += 2; return v; }
        case 0xce: { const v = view.getUint32(offset); offset += 4; return v; }
        case 0xcf: return readU64(false);
        case 0xd0: { const v = view.getInt8(offset); offset += 1; return v; }
        case 0xd1: { const v = view.getInt16(offset); offset += 2; return v; }
        case 0xd2: { const v = view.getInt32(offset); offset += 4; return v; }
        case 0xd3: return readU64(true);
        case 0xd4: return skipBytes(2);
        case 0xd5: return skipBytes(3);
        case 0xd6: return skipBytes(5);
        case 0xd7: return skipBytes(9);
        case 0xd8: return skipBytes(17);
        case 0xd9: return readStr(bytes[offset++]);
        case 0xda: { const l = view.getUint16(offset); offset += 2; return readStr(l); }
        case 0xdb: { const l = view.getUint32(offset); offset += 4; return readStr(l); }
        case 0xdc: { const l = view.getUint16(offset); offset += 2; return readArray(l, d); }
        case 0xdd: { const l = view.getUint32(offset); offset += 4; return readArray(l, d); }
        case 0xde: { const l = view.getUint16(offset); offset += 2; return readMap(l, d); }
        case 0xdf: { const l = view.getUint32(offset); offset += 4; return readMap(l, d); }
        default: throw new Error('Unsupported');
      }
    }
    function readStr(len) {
      if (len < 0 || offset + len > bytes.length) throw new Error('EOF');
      const sub = bytes.subarray(offset, offset + len);
      offset += len;
      if (decoder) return decoder.decode(sub);
      let s = '';
      for (let i = 0; i < sub.length; i += 32768) {
        s += String.fromCharCode.apply(null, sub.subarray(i, Math.min(sub.length, i + 32768)));
      }
      return s;
    }
    function readBin(len) {
      if (len < 0 || offset + len > bytes.length) throw new Error('EOF');
      const sub = bytes.subarray(offset, offset + len);
      offset += len;
      return decoder ? cleanReadable(decoder.decode(sub)) : '';
    }
    function readArray(len, d) {
      if (len > 4096) throw new Error('Limit');
      const arr = [];
      for (let i = 0; i < len; i++) arr.push(read(d));
      return arr;
    }
    function readMap(len, d) {
      if (len > 4096) throw new Error('Limit');
      const obj = {};
      for (let i = 0; i < len; i++) {
        const k = read(d);
        obj[String(k)] = read(d);
      }
      return obj;
    }
    const val = read(0);
    if (offset !== bytes.length) throw new Error('Trailing');
    return val;
  }

  function decodeProtobufSync(bytes, depth) {
    try {
      const d = depth || 0;
      if (!bytes || bytes.length < 2 || d > 4) return null;
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let o = 0;
      const end = bytes.length;
      const readVi = () => {
        let lo = 0, hi = 0, shift = 0;
        for (let c = 0; c < 10; c++) {
          if (o >= end) return null;
          const b = bytes[o++];
          if (shift < 28) lo |= (b & 0x7f) << shift;
          else hi |= (b & 0x7f) << (shift - 28);
          if ((b & 0x80) === 0) {
            if (hi === 0) return lo >>> 0;
            const big = hi * 268435456 + (lo >>> 0);
            return Number.isSafeInteger(big) ? big : String(big);
          }
          shift += 7;
        }
        return null;
      };
      const out = {};
      let count = 0;
      let goodStrOrFloat = 0;
      while (o < end && count < 64) {
        const tag = readVi();
        if (typeof tag !== 'number' || tag <= 0) return null;
        const wt = tag & 7;
        const fn = tag >>> 3;
        if (fn <= 0 || fn > 50000) return null;
        const key = 'f' + fn;
        let val;
        if (wt === 0) {
          val = readVi();
          if (val === null) return null;
        } else if (wt === 1) {
          if (o + 8 > end) return null;
          const f64 = dv.getFloat64(o, true);
          o += 8;
          if (Number.isFinite(f64) && (f64 === 0 || (Math.abs(f64) >= 1e-5 && Math.abs(f64) < 1e9))) {
            val = Math.round(f64 * 100000) / 100000;
            goodStrOrFloat++;
          } else {
            val = '<i64>';
          }
        } else if (wt === 2) {
          const len = readVi();
          if (typeof len !== 'number' || len < 0 || o + len > end) return null;
          const sub = bytes.subarray(o, o + len);
          o += len;
          if (len === 0) {
            val = '';
          } else {
            const nested = len >= 3 ? decodeProtobufSync(sub, d + 1) : null;
            if (nested) {
              val = nested;
              goodStrOrFloat++;
            } else {
              const rawS = decoder ? decoder.decode(sub) : '';
              const cl = cleanReadable(rawS);
              const ratio = rawS.length ? (cl.replace(/\s/g, '').length / rawS.length) : 0;
              if (cl && ratio >= 0.72) {
                if ((cl.startsWith('{') || cl.startsWith('['))) {
                  try { val = JSON.parse(cl); } catch { val = cl; }
                } else {
                  val = cl;
                }
                goodStrOrFloat++;
              } else {
                val = '<bytes:' + len + '>';
              }
            }
          }
        } else if (wt === 5) {
          if (o + 4 > end) return null;
          const f32 = dv.getFloat32(o, true);
          o += 4;
          val = (Number.isFinite(f32) && (f32 === 0 || (Math.abs(f32) >= 1e-5 && Math.abs(f32) < 1e8)))
            ? Math.round(f32 * 10000) / 10000
            : dv.getInt32(o - 4, true);
        } else {
          return null;
        }
        if (Object.prototype.hasOwnProperty.call(out, key)) {
          if (Array.isArray(out[key])) out[key].push(val);
          else out[key] = [out[key], val];
        } else {
          out[key] = val;
        }
        count++;
      }
      if (o !== end || count === 0 || (d === 0 && goodStrOrFloat === 0 && count < 2)) return null;
      return out;
    } catch { return null; }
  }

  function cleanReadable(str) {
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  function toHex(bytes, maxLen) {
    const out = [];
    const lim = Math.min(bytes.length, maxLen || 64);
    for (let i = 0; i < lim; i++) {
      out.push(bytes[i].toString(16).padStart(2, '0'));
    }
    return out.join(' ') + (bytes.length > lim ? ' ...' : '');
  }

  function tryDecodeStringExtras(str) {
    const trimmed = str.trim();
    if (!trimmed) return { text: '', kind: 'TEXT' };

    if (/^\d{1,3}\[/.test(trimmed) || /^\d{1,3}\{/.test(trimmed) || /^\d{1,4}-\[/.test(trimmed)) {
      return { text: trimmed, kind: 'SIO' };
    }

    if (CFG.decodeBinary && trimmed.length >= 8 && trimmed.length % 4 === 0 && /^[A-Za-z0-9+/]+=*$/.test(trimmed)) {
      try {
        const binStr = atob(trimmed);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        const decoded = decoder ? decoder.decode(bytes) : binStr;
        const cleaned = cleanReadable(decoded);
        if (cleaned && cleaned.length >= 2 && (cleaned.startsWith('{') || cleaned.startsWith('[') || /^[\x20-\x7E\u0980-\u09FF]+$/.test(cleaned))) {
          return { text: cleaned, kind: 'B64' };
        }
      } catch {}
    }

    if (CFG.decodeBinary && (trimmed.includes('%7B') || trimmed.includes('%22'))) {
      try {
        return { text: decodeURIComponent(trimmed), kind: 'URL' };
      } catch {}
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return { text: trimmed, kind: 'JSON' };
      } catch {}
      return { text: trimmed, kind: 'JSON' };
    }

    return { text: cleanReadable(trimmed) || trimmed, kind: 'TEXT' };
  }

  function decodeBytesSync(bytes) {
    if (!bytes || !bytes.length) return { text: '', kind: 'BIN', compressed: false };

    if (CFG.decodeBinary && (bytes[0] & 0x80) !== 0 && bytes.length >= 4) {
      const isCompressed = (bytes[0] & 0x20) !== 0;
      const isBigSized = (bytes[0] & 0x08) !== 0;
      const hdrLen = isBigSized ? 5 : 3;
      if (bytes.length > hdrLen) {
        const body = bytes.subarray(hdrLen);
        if (isCompressed || (body.length > 2 && body[0] === 0x78)) {
          return { text: '', kind: 'SFS2X-Z', compressed: 'deflate', bytes: body };
        }
        if (body[0] === 0x12) {
          const sfs = decodeSFSObjectSync(body);
          if (sfs && typeof sfs === 'object') return { text: JSON.stringify(sfs), kind: 'SFS2X', compressed: false };
        }
      }
    }
    if (CFG.decodeBinary && bytes.length >= 3 && bytes[0] === 0x12) {
      const sfs = decodeSFSObjectSync(bytes);
      if (sfs && typeof sfs === 'object') return { text: JSON.stringify(sfs), kind: 'SFS2X', compressed: false };
    }

    if (CFG.decodeBinary && bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      return { text: '', kind: 'GZIP', compressed: 'gzip', bytes };
    }
    if (CFG.decodeBinary && bytes.length >= 2 && bytes[0] === 0x78 && (bytes[1] === 0x9c || bytes[1] === 0xda || bytes[1] === 0x01 || bytes[1] === 0x5e)) {
      return { text: '', kind: 'ZLIB', compressed: 'deflate', bytes };
    }

    if (CFG.decodeBinary && bytes[0] !== 0x7b && bytes[0] !== 0x5b) {
      try {
        const mp = decodeMsgPack(bytes);
        if (mp !== null && typeof mp === 'object') {
          return { text: JSON.stringify(mp), kind: 'MSGPACK', compressed: false };
        }
      } catch {}
    }

    // Check length-prefixed binary framing around JSON/UTF8 (e.g. 2-byte/4-byte header before '{' or '[')
    const rawUtf8 = decoder ? decoder.decode(bytes) : '';
    const trimmedUtf8 = rawUtf8.trim();
    if (trimmedUtf8.startsWith('{') || trimmedUtf8.startsWith('[')) {
      try {
        JSON.parse(trimmedUtf8);
        return { text: trimmedUtf8, kind: 'JSON', compressed: false };
      } catch {}
    }
    if (CFG.decodeBinary && bytes.length >= 4 && bytes[0] !== 0x7b && bytes[0] !== 0x5b) {
      let jsonOff = -1;
      for (let i = 1; i < Math.min(bytes.length, 16); i++) {
        if (bytes[i] === 0x7b || bytes[i] === 0x5b) { jsonOff = i; break; }
      }
      if (jsonOff > 0) {
        const subS = (decoder ? decoder.decode(bytes.subarray(jsonOff)) : '').trim();
        if (subS.startsWith('{') || subS.startsWith('[')) {
          try {
            JSON.parse(subS);
            return { text: subS, kind: 'BIN→JSON', compressed: false };
          } catch {}
        }
      }
      const pb = decodeProtobufSync(bytes, 0);
      if (pb) {
        return { text: JSON.stringify(pb), kind: 'PROTOBUF', compressed: false };
      }
    }

    const cleaned = cleanReadable(rawUtf8);
    const printableRatio = rawUtf8.length ? (cleaned.replace(/\s/g, '').length / rawUtf8.length) : 0;
    if (cleaned && (cleaned.includes('{') || cleaned.includes('[') || printableRatio > 0.35)) {
      const extra = tryDecodeStringExtras(cleaned);
      return { text: extra.text, kind: extra.kind === 'JSON' ? 'BIN→JSON' : 'BIN→UTF8', compressed: false };
    }

    return { text: (cleaned ? cleaned + ' | ' : '') + 'HEX: ' + toHex(bytes, 48), kind: 'HEX', compressed: false };
  }

  function decompressAndHandle(src, algo, bytes, metaPrefix, gateInfo) {
    if (typeof DecompressionStream === 'undefined') {
      const fallback = cleanReadable(decoder ? decoder.decode(bytes) : '') || ('HEX: ' + toHex(bytes, 48));
      handleDecoded(src, algo, (metaPrefix || '') + fallback, null, gateInfo);
      return;
    }
    const tryAlgo = (curAlgo, canRetryRaw) => {
      try {
        const ds = new DecompressionStream(curAlgo);
        const stream = new Blob([bytes]).stream().pipeThrough(ds);
        new Response(stream).arrayBuffer().then((buf) => {
          const outBytes = new Uint8Array(buf);
          const res = decodeBytesSync(outBytes);
          handleDecoded(src, curAlgo + '→' + res.kind, (metaPrefix || '') + (res.text || ('HEX: ' + toHex(outBytes, 48))), null, gateInfo);
        }).catch(() => {
          if (canRetryRaw) {
            tryAlgo(curAlgo === 'deflate' ? 'deflate-raw' : 'deflate', false);
            return;
          }
          const fallback = cleanReadable(decoder ? decoder.decode(bytes) : '') || ('HEX: ' + toHex(bytes, 48));
          handleDecoded(src, 'BIN', (metaPrefix || '') + fallback, null, gateInfo);
        });
      } catch {
        if (canRetryRaw) {
          tryAlgo(curAlgo === 'deflate' ? 'deflate-raw' : 'deflate', false);
          return;
        }
        const fallback = cleanReadable(decoder ? decoder.decode(bytes) : '') || ('HEX: ' + toHex(bytes, 48));
        handleDecoded(src, 'BIN', (metaPrefix || '') + fallback, null, gateInfo);
      }
    };
    tryAlgo(algo, algo === 'deflate' || algo === 'deflate-raw');
  }

  function processRawData(src, data, metaPrefix, turboInfo, gateInfo) {
    const gInfo = gateInfo || (turboInfo && turboInfo.gate) || null;
    if (data == null) {
      if (metaPrefix) handleDecoded(src, 'EMPTY', metaPrefix.trim(), turboInfo, gInfo);
      return;
    }
    if (typeof data === 'string') {
      const parts = data.includes('\x1e') ? data.split('\x1e').filter(Boolean) : [data];
      for (let i = 0; i < parts.length; i++) {
        const res = tryDecodeStringExtras(parts[i]);
        handleDecoded(src, res.kind, (metaPrefix || '') + res.text, i === 0 ? turboInfo : null, i === 0 ? gInfo : null);
      }
      return;
    }
    if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
      const obj = {};
      data.forEach((v, k) => { obj[k] = v; });
      handleDecoded(src, 'FORM', (metaPrefix || '') + JSON.stringify(obj), turboInfo, gInfo);
      return;
    }
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      const obj = {};
      data.forEach((v, k) => { obj[k] = typeof v === 'string' ? v : (v && v.name ? '[File:' + v.name + ']' : '[Blob]'); });
      handleDecoded(src, 'FORM', (metaPrefix || '') + JSON.stringify(obj), turboInfo, gInfo);
      return;
    }
    const objTag = (typeof data === 'object' && data !== null) ? Object.prototype.toString.call(data) : '';
    if (
      data instanceof Blob ||
      objTag === '[object Blob]' ||
      (typeof data === 'object' && typeof data.arrayBuffer === 'function' && typeof data.size === 'number')
    ) {
      data.arrayBuffer().then((buf) => processRawData(src, buf, metaPrefix, null, gInfo)).catch(() => {});
      return;
    }
    if (
      data instanceof ArrayBuffer ||
      objTag === '[object ArrayBuffer]' ||
      objTag === '[object SharedArrayBuffer]'
    ) {
      const bytes = new Uint8Array(data);
      const res = decodeBytesSync(bytes);
      if (res.compressed) {
        decompressAndHandle(src, res.compressed, res.bytes, metaPrefix, gInfo);
      } else {
        handleDecoded(src, res.kind, (metaPrefix || '') + res.text, turboInfo, gInfo);
      }
      return;
    }
    if (
      ArrayBuffer.isView(data) ||
      /^\[object (Uint|Int|Float|BigInt|DataView)/.test(objTag)
    ) {
      let bytes;
      try {
        bytes = new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength != null ? data.byteLength : data.length);
      } catch {
        bytes = new Uint8Array(data);
      }
      const res = decodeBytesSync(bytes);
      if (res.compressed) {
        decompressAndHandle(src, res.compressed, res.bytes, metaPrefix, gInfo);
      } else {
        handleDecoded(src, res.kind, (metaPrefix || '') + res.text, turboInfo, gInfo);
      }
      return;
    }
    if (typeof data === 'object') {
      try {
        handleDecoded(src, 'JSON', (metaPrefix || '') + JSON.stringify(data), turboInfo, gInfo);
      } catch {
        handleDecoded(src, 'OBJ', (metaPrefix || '') + String(data), turboInfo, gInfo);
      }
    }
  }

  function sliceBalancedJsonOuter(str, startIdx) {
    if (!str || startIdx < 0 || startIdx >= str.length) return null;
    const openCh = str[startIdx];
    if (openCh !== '{' && openCh !== '[') return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = startIdx; i < str.length; i++) {
      const ch = str[i];
      if (esc) { esc = false; continue; }
      if (inStr) {
        if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) return str.slice(startIdx, i + 1);
        if (depth < 0) return null;
      }
    }
    return null;
  }

  function extractJsonPayload(str, skipCompact) {
    if (!str) return null;
    const rawStr = String(str);
    const segments = rawStr.includes('\x1e')
      ? rawStr.split('\x1e').map(s => s.trim()).filter(Boolean)
      : [rawStr.trim()];
    for (let si = 0; si < segments.length; si++) {
      const trimmed = segments[si];
      if (!trimmed) continue;
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return { jsonText: trimmed, parsed, compact: skipCompact ? '' : JSON.stringify(parsed) };
        } catch {
          const bal = sliceBalancedJsonOuter(trimmed, 0);
          if (bal && bal !== trimmed) {
            try {
              const parsed = JSON.parse(bal);
              return { jsonText: bal, parsed, compact: skipCompact ? '' : JSON.stringify(parsed) };
            } catch {}
          }
        }
      }
      const idxObj = trimmed.indexOf('{');
      const idxArr = trimmed.indexOf('[');
      const candidates = [idxObj, idxArr].filter(i => i >= 0).sort((a, b) => a - b);
      for (let i = 0; i < candidates.length; i++) {
        const sub = trimmed.slice(candidates[i]).trim();
        try {
          const parsed = JSON.parse(sub);
          return { jsonText: sub, parsed, compact: skipCompact ? '' : JSON.stringify(parsed) };
        } catch {
          const bal = sliceBalancedJsonOuter(sub, 0);
          if (bal) {
            try {
              const parsed = JSON.parse(bal);
              return { jsonText: bal, parsed, compact: skipCompact ? '' : JSON.stringify(parsed) };
            } catch {}
          }
        }
      }
    }
    return null;
  }

  function unwrapNestedJson(val, depth) {
    if (depth > 4 || val == null) return val;
    if (typeof val === 'string') {
      const s = val.trim();
      if (s.length >= 2 && s.length <= 4000 && ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']')))) {
        try { return unwrapNestedJson(JSON.parse(s), depth + 1); } catch {}
      }
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((it) => unwrapNestedJson(it, depth + 1));
    }
    if (typeof val === 'object') {
      const keys = Object.keys(val);
      const out = {};
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        out[k] = unwrapNestedJson(val[k], depth + 1);
      }
      return out;
    }
    return val;
  }

  function isProofOrHashKey(key) {
    const lk = String(key || '').trim().toLowerCase();
    if (!lk) return false;
    return (
      lk === 'hash' || lk === 'roundhash' || lk === 'round_hash' ||
      lk === 'serverhash' || lk === 'server_hash' || lk === 'clienthash' || lk === 'client_hash' ||
      lk === 'gamehash' || lk === 'game_hash' || lk === 'txhash' || lk === 'tx_hash' ||
      lk === 'blockhash' || lk === 'block_hash' || lk === 'seed' || lk === 'serverseed' ||
      lk === 'server_seed' || lk === 'clientseed' || lk === 'client_seed' || lk === 'nextseed' ||
      lk === 'salt' || lk === 'signature' || lk === 'sig' || lk === 'proof' ||
      lk === 'digest' || lk === 'checksum' || lk === 'hmac' || lk === 'merkle'
    );
  }

  function isMultiplierOrVolatileKey(key) {
    const lk = String(key || '').trim().toLowerCase();
    if (!lk) return true;
    if (
      lk === 'coef' || lk === 'coeff' || lk === 'coefficient' || lk === 'curcoef' || lk === 'currentcoef' ||
      lk === 'livecoef' || lk === 'wincoef' || lk === 'stopcoef' || lk === 'stopcoeff' || lk === 'stopcoefficient' ||
      lk === 'stop_coefficient' || lk === 'multiplier' || lk === 'mult' || lk === 'multi' || lk === 'mul' ||
      lk === 'curmultiplier' || lk === 'currentmultiplier' || lk === 'livemultiplier' ||
      lk === 'maxmultiplier' || lk === 'payoutmultiplier' || lk === 'winmultiplier' || lk === 'cashoutmultiplier' ||
      lk === 'finalvalue' || lk === 'crashpoint' || lk === 'crash_point' || lk === 'crashvalue' ||
      lk === 'crash_value' || lk === 'crashcoef' || lk === 'odds' || lk === 'odd' || lk === 'rate' ||
      lk === 'factor' || lk === 'scale' || lk === 'payout' ||
      lk === 'winamount' || lk === 'amount' || lk === 'betamount' || lk === 'sum' || lk === 'balance' ||
      lk === 'totalwin' || lk === 'profit' || lk === 'roundid' || lk === 'round_id' || lk === 'gameid' || lk === 'game_id' ||
      lk === 'gid' || lk === 'roundno' || lk === 'gameno' || lk === 'roundnumber' || lk === 'gamenumber' || lk === 'sessionid' ||
      lk === 'betid' || lk === 'userid' || lk === 'playerid' || lk === 'accountid' || lk === 'ts' ||
      lk === 'timestamp' || lk === 'time' || lk === 'date' || lk === 'createdat' || lk === 'updatedat' ||
      lk === 'resulttime' || lk === 'endtime' || lk === 'closetime' || lk === 'starttime' || lk === 'servertime' ||
      lk === 'crashtime' || lk === 'settletime' || lk === 'decisiontime' || lk === 'gametime' || lk === 'gr' ||
      lk === 'gameresult' || lk === 'roundresult' ||
      lk === 'nonce' || lk === 'uuid' || lk === 'token' ||
      lk === 'players' || lk === 'bets' || lk === 'onlineplayers' || lk === 'clients' || lk === 'users' ||
      lk === 'count' || lk === 'seq' || lk === 'step' || lk === 'ping' || lk === 'pong' || lk === 'ttl' ||
      lk === 'x' || lk === 'k' || lk === 'm' || lk === 'f' || lk === 'cf' || lk === 'tick' ||
      lk === 'progress' || lk === 'elapsed' || lk === 'duration' || lk === 'id' || lk === 'cid' ||
      lk === 'be' || lk === 'browser' || lk === 'os' || lk === 'platform' || lk === 'device' ||
      lk === 'ua' || lk === 'useragent' || lk === 'engine' || lk === 'vendor' || lk === 'screen' ||
      lk === 'viewport' || lk === 'timezone' || lk === 'tz' || lk === 'locale' || lk === 'language' ||
      lk === 'lang' || lk === 'theme' || lk === 'version' || lk === 'appversion' || lk === 'sdk' ||
      lk === 'build' || lk === 'referer' || lk === 'referrer' || lk === 'ip' || lk === 'country' ||
      lk === 'currency' || lk === 'symbol' || lk === 'decimals' || lk === 'icon' || lk === 'avatar' ||
      lk === 'nickname' || lk === 'username' || lk === 'playername' || lk === 'channel' || lk === 'room' ||
      lk === 'identifier' || lk === 'protocol' || lk === 'transport' || lk === 'host' || lk === 'url' ||
      lk === 'href' || lk === 'path' || lk === 'pointer' || lk === 'clientid' || lk === 'deviceid'
    ) {
      return true;
    }
    return /^(?:cur|live|win|stop|max|min|final|payout|cashout|crash|base)?_?(?:coef|coeff|coefficient|multipl|mult|mul|odd|odds|crashpoint|crash_point|stopcoeff)/i.test(lk);
  }

  function isMultiplierLikeValue(v) {
    if (v == null) return true;
    if (typeof v === 'number') return true;
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (!s || s.length > 72) return true;
    if (/^[+-]?\d+(?:[.,]\d+)?\s*(?:[x×%]|bdt|usd|eur|inr|rub|trx|usdt|btc)?$/i.test(s)) return true;
    if (/^[x×@]\s*[+-]?\d+(?:[.,]\d+)?$/i.test(s)) return true;
    if (/^[0-9a-f-]{16,}$/i.test(s)) return true;
    if (/^\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}/i.test(s)) return true;
    return false;
  }

  function isPureMultiplierTagText(tag) {
    const t = String(tag || '').trim().toLowerCase();
    if (!t) return true;
    if (/^[x×@+-]?\d+(?:[.,]\d+)?\s*[x×%]?$/.test(t)) return true;
    if (/^<\/?[a-z0-9_:-]*(?:mul|mult|coef|tick|odd|rate)[a-z0-9_:-]*(?:\b|>|\s|$)/.test(t)) return true;
    if (/^<[a-z0-9_:-]+\b[^>]*\b(?:mul|mult|multiplier|coef|coeff|odds)\s*=\s*["']?[x×+-]?\d+(?:[.,]\d+)?/.test(t) && !/\b(end|crash|finish|bust|start|wait|bet|cash|win)\b/.test(t)) return true;
    if (/\bgid\s*=\s*["']?\d+["']?/.test(t) && /\b(?:mul|mult|coef|odds)\s*=/.test(t)) return true;
    if (/^\{?\s*["']?[a-z0-9_.-]*(?:coef|coeff|coefficient|multipl|mult|mul|odds|crashpoint|stopcoeff|payoutmult|finalvalue|rate|cur_?x|cf|gid|roundid|gameid)["']?\s*(?:>=|<=|>|<|==|=|:)/i.test(t)) return true;
    if (/^\{?\s*["']?(?:coef|coeff|coefficient|multiplier|mult|mul|odds|odd|rate|cf|x|m|k|f)["']?\s*(?:[:=]|>=|<=|>|<)/.test(t)) return true;
    if (/^\{?\s*["']?[a-z0-9_.-]+["']?\s*(?:>=|<=|>|<|==|=|:)\s*["']?[x×+-]?\d+(?:[.,]\d+)?\s*[x×%]?["']?\s*\}?$/i.test(t) && !/\b(state|status|phase|stage|code|step|type|event|cmd|round|error|err)\b/i.test(t)) return true;
    return false;
  }

  const SKIP_CONTAINER_KEYS = new Set([
    'bets', 'activebets', 'otherbets', 'userbets', 'playerbets', 'mybets',
    'players', 'users', 'winners', 'losers', 'cashouts', 'history', 'previous',
    'lastrounds', 'roundhistory', 'gamehistory', 'pastrounds', 'roundresults',
    'results', 'stats', 'recent', 'notifications', 'events', 'leaderboard',
    'top', 'statistics', 'chat', 'messages', 'identifier', 'channel',
    'onlineplayers', 'clients', 'outcomes', 'activeplayers', 'betlist',
    'entries', 'payouts', 'jackpots', 'playerslist', 'decisions'
  ]);

  function sanitizeGameJsonNode(node, depth) {
    if (depth > 5 || node == null || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      const arr = [];
      for (let i = 0; i < Math.min(node.length, 6); i++) arr.push(sanitizeGameJsonNode(node[i], depth + 1));
      return arr;
    }
    const out = {};
    const ks = Object.keys(node);
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i];
      if (SKIP_CONTAINER_KEYS.has(k.toLowerCase())) continue;
      out[k] = sanitizeGameJsonNode(node[k], depth + 1);
    }
    return out;
  }

  let _lastUnwrapKey = '';
  let _lastUnwrapVal = null;
  function getCachedUnwrappedJson(rawText) {
    const s = String(rawText || '');
    if (!s) return null;
    if (s === _lastUnwrapKey) return _lastUnwrapVal;
    let u = null;
    if (s.includes('{') || s.includes('[')) {
      const info = extractJsonPayload(s, true);
      if (info && info.parsed) u = unwrapNestedJson(info.parsed, 0);
    }
    _lastUnwrapKey = s;
    _lastUnwrapVal = u;
    return u;
  }

  function parseXmlGamePacket(rawText) {
    const s = String(rawText || '').trim();
    if (!s || s.charAt(0) !== '<') return null;
    if (s.startsWith('<binary') || s.startsWith('<bytes') || s.startsWith('<!') || /^<html\b/i.test(s)) return null;
    const m = s.match(/^<([a-zA-Z_][a-zA-Z0-9_:-]{1,48})([^>]*)>/);
    if (!m) return null;
    const tag = m[1];
    const lt = tag.toLowerCase();
    const attrStr = m[2] || '';
    const attrs = {};
    const attrPairs = [];
    const attrRe = /([a-zA-Z_][a-zA-Z0-9_:-]{0,36})\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let am;
    while ((am = attrRe.exec(attrStr)) !== null) {
      const ak = am[1];
      const av = am[2] !== undefined ? am[2] : (am[3] || '');
      attrs[ak.toLowerCase()] = av;
      attrPairs.push({ key: ak, val: av });
    }
    const roundId = String(attrs.gid || attrs.roundid || attrs.round_id || attrs.gameid || attrs.game_id || attrs.roundno || attrs.gameno || '').trim();
    const stateVal = String(attrs.state || attrs.status || attrs.phase || attrs.stage || attrs.event || attrs.type || '').trim().toLowerCase();
    const isCash = /(cashout|cash_out|takewin|take_win|^win$|won)/.test(lt) || attrs.won === 'true' || attrs.win === 'true' || attrs.cashout === 'true' || attrs.cashedout === 'true' || stateVal === 'cashout' || stateVal === 'cashed_out';
    const isCrash = !isCash && (
      /(?:^|_|-)(?:end|crash|crashed|finish|finished|bust|busted|over|stop|close|flew|explode)(?:$|_|-)/.test(lt) ||
      lt === 'hf_end' || lt === 'hf_crash' ||
      stateVal === 'end' || stateVal === 'ended' || stateVal === 'crash' || stateVal === 'crashed' || stateVal === 'finish' || stateVal === 'finished' || stateVal === 'bust' || stateVal === 'over' || stateVal === '3' ||
      attrs.crashed === 'true' || attrs.ended === 'true' || attrs.finished === 'true' || attrs.won === 'false' || attrs.win === 'false' ||
      attrs.stopcoef != null || attrs.stopcoeff != null || attrs.stop_coefficient != null || attrs.crashpoint != null
    );
    const mulRaw = attrs.mul || attrs.mult || attrs.multiplier || attrs.coef || attrs.coeff || attrs.coefficient || attrs.odds || attrs.rate || '';
    const mulNum = mulRaw ? parseFloat(String(mulRaw).replace(/,/g, '.').replace(/[x×%]/gi, '')) : NaN;
    const isStart = !isCash && !isCrash && (
      /(?:^|_|-)(?:start|wait|waiting|bet|betting|open|new|init|ready|idle|prepare|countdown)(?:$|_|-)/.test(lt) ||
      lt === 'hf_start' || lt === 'hf_bet' || lt === 'hf_wait' ||
      stateVal === 'waiting' || stateVal === 'betting' || stateVal === 'bet' || stateVal === 'start' || stateVal === 'open' || stateVal === 'idle' || stateVal === '1'
    );
    const inFlight = !isCash && !isCrash && !isStart && (
      /(?:^|_|-)(?:mul|mult|coef|coeff|tick|fly|prog|run|step)(?:$|_|-)/.test(lt) ||
      lt === 'hf_mul' ||
      (!Number.isNaN(mulNum) && mulNum >= 1 && mulNum < 1000000) ||
      stateVal === 'game' || stateVal === 'running' || stateVal === 'flying' || stateVal === 'active' || stateVal === '2'
    );
    return { tag, lt, attrs, attrPairs, roundId, isCrash, isStart, inFlight, isCash };
  }

  function extractJsonRoundId(node, depth) {
    if (depth > 4 || node == null || typeof node !== 'object') return '';
    if (Array.isArray(node)) {
      for (let i = 0; i < Math.min(node.length, 4); i++) {
        const sub = extractJsonRoundId(node[i], depth + 1);
        if (sub) return sub;
      }
      return '';
    }
    const ks = Object.keys(node);
    const idKeys = new Set(['gid', 'roundid', 'round_id', 'gameid', 'game_id', 'roundno', 'gameno', 'roundnumber', 'gamenumber']);
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i];
      const lk = k.toLowerCase();
      if (SKIP_CONTAINER_KEYS.has(lk)) continue;
      if (idKeys.has(lk)) {
        const v = node[k];
        if ((typeof v === 'string' && v.trim() && v.trim().length <= 48) || (typeof v === 'number' && Number.isFinite(v) && v > 0)) {
          return String(v).trim();
        }
      }
    }
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i];
      const lk = k.toLowerCase();
      if (SKIP_CONTAINER_KEYS.has(lk)) continue;
      const v = node[k];
      if (v && typeof v === 'object') {
        const sub = extractJsonRoundId(v, depth + 1);
        if (sub) return sub;
      }
    }
    return '';
  }

  let _lastAnKey = '';
  let _lastAnRes = null;
  function analyzeGamePacket(src, rawText, preUnwrapped) {
    const cacheKey = !preUnwrapped && rawText ? (String(src || '') + '|' + String(rawText)) : '';
    if (cacheKey && cacheKey === _lastAnKey && _lastAnRes) {
      return _lastAnRes;
    }
    const res = { hasJson: false, hasXml: false, isCrash: false, isStart: false, inFlight: false, isCash: false, roundId: '', sanitizedText: '' };
    if (!rawText && !preUnwrapped) return res;
    const unwrapped = preUnwrapped || getCachedUnwrappedJson(rawText);
    if (!unwrapped || typeof unwrapped !== 'object') {
      const xp = rawText ? parseXmlGamePacket(rawText) : null;
      if (xp) {
        res.hasXml = true;
        res.isCrash = xp.isCrash;
        res.isStart = xp.isStart;
        res.inFlight = xp.inFlight;
        res.isCash = xp.isCash;
        res.roundId = xp.roundId || '';
        res.sanitizedText = String(rawText).toLowerCase();
      }
      if (cacheKey) { _lastAnKey = cacheKey; _lastAnRes = res; }
      return res;
    }
    res.hasJson = true;
    res.roundId = extractJsonRoundId(unwrapped, 0);

    let hasGameCrash = false;
    let hasActiveFlight = false;
    let hasStart = false;
    let hasCash = false;

    const crashStrSet = new Set([
      'crash', 'crashed', 'oncrash', 'crashx', 'finish', 'finished', 'onfinish',
      'round_finish', 'roundfinish', 'game_finish', 'gamefinish', 'end', 'ended',
      'endgame', 'game_end', 'game_over', 'round_end', 'round_over', 'onroundend',
      'ongameend', 'stopgame', 'stop_game', 'bust', 'busted', 'flew', 'flew_off', 'flew_away', 'fly_away',
      'exploded', 'lost', 'loss', 'over', 'stopped', 'destroyed', 'terminated', 'halted', 'boom',
      'round_settled', 'settled', 'cashout_closed', 'decision_closed', 'betting_closed'
    ]);
    const flightStrSet = new Set([
      'game', 'running', 'flying', 'active', 'in_progress', 'inprogress',
      'in_game', 'ingame', 'started', 'play', 'playing', 'live', 'multiplier_update', 'tick'
    ]);
    const startStrSet = new Set([
      'waiting', 'betting', 'bet', 'open', 'start', 'startgame', 'start_game',
      'waitgame', 'wait_game', 'newgame', 'new_game', 'round_start', 'game_start',
      'onbetting', 'onstart', 'ready', 'idle', 'next_round', 'next_game', 'bets_open', 'betsopen', 'place_bet', 'placebet'
    ]);
    const cashStrSet = new Set([
      'cash', 'cashout', 'cash_out', 'cashed_out', 'cashedout', 'cashout_success',
      'cash_out_success', 'take_win'
    ]);
    const gameFieldKeys = new Set([
      'state', 'status', 'stage', 'phase', 'newstate', 'newstateid', 'gamestate',
      'roundstate', 'roundstatus', 'action', 'event', 'eventtype', 'type', 'target',
      'cmd', 'c', 'result', 'outcome'
    ]);
    const crashBoolKeys = new Set(['crashed', 'ended', 'finished', 'busted', 'cashoutclosed', 'decisionclosed']);
    const crashNumKeys = new Set(['stopcoefficient', 'stop_coefficient', 'stopcoeff', 'crashpoint', 'crash_point']);
    const resultObjOrTimeKeys = new Set(['resulttime', 'gameresult', 'roundresult', 'crashtime', 'settletime']);

    if (Array.isArray(unwrapped) && typeof unwrapped[0] === 'string') {
      const ev0 = unwrapped[0].trim().toLowerCase();
      if (crashStrSet.has(ev0)) hasGameCrash = true;
      else if (flightStrSet.has(ev0)) hasActiveFlight = true;
      else if (startStrSet.has(ev0)) hasStart = true;
      else if (cashStrSet.has(ev0)) hasCash = true;
    }

    const walkSafe = (node, depth) => {
      if (depth > 5 || node == null || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (let i = 0; i < Math.min(node.length, 6); i++) walkSafe(node[i], depth + 1);
        return;
      }
      const ks = Object.keys(node);
      for (let i = 0; i < ks.length; i++) {
        const k = ks[i];
        const lk = k.toLowerCase();
        if (SKIP_CONTAINER_KEYS.has(lk)) continue;
        const v = node[k];
        if (lk === 'gr' && v && typeof v === 'object') {
          hasGameCrash = true;
          walkSafe(v, depth + 1);
          continue;
        } else if (resultObjOrTimeKeys.has(lk) && v != null && v !== false && v !== 0 && v !== '') {
          hasGameCrash = true;
        } else if (crashNumKeys.has(lk)) {
          const nv = typeof v === 'number' ? v : parseFloat(String(v));
          if (!Number.isNaN(nv) && nv > 0) hasGameCrash = true;
        } else if (crashBoolKeys.has(lk) && v === true) {
          hasGameCrash = true;
        } else if ((lk === 'won' || lk === 'win' || lk === 'iswin') && v === false) {
          hasGameCrash = true;
        } else if ((lk === 'won' || lk === 'win' || lk === 'iswin' || lk === 'cashout' || lk === 'cashedout') && v === true) {
          hasCash = true;
        } else if (lk === 'newstateid' || lk === 'state' || lk === 'status') {
          if (v === 3) hasGameCrash = true;
          else if (v === 2) hasActiveFlight = true;
          else if (v === 1) hasStart = true;
        }
        if (typeof v === 'string' && gameFieldKeys.has(lk)) {
          const sv = v.trim().toLowerCase();
          if (crashStrSet.has(sv)) hasGameCrash = true;
          else if (flightStrSet.has(sv)) hasActiveFlight = true;
          else if (startStrSet.has(sv)) hasStart = true;
          else if (cashStrSet.has(sv)) hasCash = true;
        } else if ((lk === 'coef' || lk === 'coeff' || lk === 'coefficient' || lk === 'multiplier' || lk === 'mult' || lk === 'mul' || lk === 'odds' || lk === 'rate') && !crashNumKeys.has(lk)) {
          const mv = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '').replace(/[x×%]/gi, '').trim());
          if (Number.isFinite(mv) && mv > 1.005 && mv < 1000000) hasActiveFlight = true;
        } else if (v && typeof v === 'object') {
          walkSafe(v, depth + 1);
        }
      }
    };
    walkSafe(unwrapped, 0);

    try {
      res.sanitizedText = JSON.stringify(sanitizeGameJsonNode(unwrapped, 0)).toLowerCase();
    } catch {
      res.sanitizedText = '';
    }

    res.isCash = hasCash;
    if (hasGameCrash) {
      res.isCrash = true;
    } else if (hasActiveFlight) {
      res.inFlight = true;
    } else if (hasStart) {
      res.isStart = true;
    }
    if (cacheKey) { _lastAnKey = cacheKey; _lastAnRes = res; }
    return res;
  }

  function isCrashLikeTagText(str) {
    const rawLc = String(str || '').toLowerCase();
    if (!rawLc) return false;
    if (rawLc.includes('{') || rawLc.includes('[')) {
      const p = analyzeGamePacket('', rawLc);
      if (p.hasJson) return p.isCrash;
    }
    if (rawLc.trim().startsWith('<')) {
      const xp = parseXmlGamePacket(rawLc);
      if (xp) return xp.isCrash;
      if (/^<\/?(?:hf_end|hf_crash|round_end|game_end|crash)\b/.test(rawLc.trim())) return true;
    }
    const lc = rawLc
      .replace(/\\*"identifier\\*"\s*:\s*"(?:\\.|[^"\\])*"/g, '')
      .replace(/\\*"channel\\*"\s*:\s*"(?:\\.|[^"\\])*"/g, '');
    return (
      /\b(finished|finishgame|finish_game|crash|crashed|oncrash|endgame|game_end|game_over|round_end|round_over|round_finish|round_settled|busted|flew|fly_away|flew_off|stopcoefficient|resulttime|gameresult|roundresult|cashouterror|cashoutclosed|decisionclosed|bettingclosed)\b/.test(lc) ||
      lc.includes('flew off') || lc.includes('flew away') ||
      lc.includes('"gr":') || lc.includes('"resulttime"') ||
      lc.includes('"status":"end"') || lc.includes('"state":"end"') ||
      lc.includes('"status":"finish"') || lc.includes('"newstateid":3') || lc.includes('"state":3') ||
      lc.includes('"status":3') || lc.includes('"won":false') || lc.includes('"win":false')
    );
  }

  function isWaitingOrBetPhaseTag(tag, src) {
    const lt = String(tag || '').toLowerCase();
    if (!lt) return true;
    const isWaitWords = /\b(expected_betting_phase|next game|waiting|waitgame|wait_game|startgame|start_game|newgame|new_game|new_round|round_start|game_start|onbetting|acceptbet|confirm bet|place bet|bets open|bets_open|bets closed|betting|gametype|currency|balance|countdown|cancel|in play|total bets)\b/.test(lt) ||
      lt.includes('"gametype"') || lt.includes('"currency"') || lt.includes('next game') ||
      /"(?:newstateid|state|status)"\s*:\s*1\b/.test(lt) ||
      /(?:^|[.\s\[_-])(?:waiting|betting|place-?bet|wait-?round)(?:$|[.\s\]_-])/.test(lt);
    if (isWaitWords) return true;
    if (src === 'SMS/DOM' && /^(?:[\d.,x×\s]+|demo|fun|history|chat|rules)$/i.test(lt.trim())) return true;
    return false;
  }

  function isAnalyticsOrNoiseTag(tag, src, rawText) {
    const lt = String(tag || '').toLowerCase();
    if (!lt) return true;
    if (lt.includes('pointer') || lt.includes('gecko') || lt.includes('webkit') || lt.includes('chromium') ||
        lt.includes('mozilla') || lt.includes('android') || lt.includes('iphone') || lt.includes('windows') ||
        lt.includes('/collect') || lt.includes('/analytics') || lt.includes('/telemetry') || lt.includes('/track') ||
        lt.includes('/metrics') || lt.includes('/sentry') || lt.includes('/gtag') || lt.includes('/beacon')) {
      return true;
    }
    if (src === 'API-REQ' && rawText) {
      const rl = String(rawText).toLowerCase();
      if (/(\/collect|\/analytics|\/telemetry|\/track|\/metrics|\/events|\/log|\/sentry|\/gtag|amplitude|mixpanel|fingerprint)/.test(rl.slice(0, 260))) {
        return true;
      }
    }
    return false;
  }

  function getSmartSegmentWindow(totalSeq) {
    const rawCount = Math.max(0, Number(totalSeq) || 0);
    const enabled = Boolean(CFG.smartSmsSegmenter);
    const threshold = Math.max(2, Math.min(500, Math.round(Number(CFG.smsSegmentThreshold) || 30)));
    const expectedTotal = Math.max(threshold, Math.min(1000, Math.round(Number(CFG.smsExpectedTotal) || 60)));
    const active = Boolean(enabled && rawCount >= threshold);
    const keepCount = active ? Math.max(1, Math.ceil(rawCount * 0.5)) : rawCount;
    const cutoffSeq = active ? Math.max(1, rawCount - keepCount + 1) : 1;
    return { enabled, active, rawCount, threshold, expectedTotal, keepCount, cutoffSeq };
  }

  function sliceFramesForSmartSegmenter(frames, explicitRawTotal) {
    if (!Array.isArray(frames) || !frames.length) return [];
    const rawTotal = Math.max(frames.length, Number(explicitRawTotal) || 0);
    const segWin = getSmartSegmentWindow(rawTotal);
    if (!segWin.active) return frames.slice();
    return frames.slice(-Math.min(frames.length, segWin.keepCount));
  }

  function pruneSegmenterWindow(segWin) {
    if (!segWin || !segWin.active) return;
    const cutoffSeq = segWin.cutoffSeq;
    let changedTags = false;
    currentRoundTagEntries.forEach((rEnt, tagKey) => {
      if (!rEnt || !Array.isArray(rEnt.seqs)) return;
      if (rEnt.seqs.length && rEnt.seqs[0] < cutoffSeq) {
        const keptSeqs = rEnt.seqs.filter((sq) => sq >= cutoffSeq);
        rEnt.seqs = keptSeqs;
        rEnt.ticks = keptSeqs.length;
        const trueRoundTicks = currentRoundAllTicks.get(tagKey) || rEnt.totalTicks || rEnt.ticks;
        if (rEnt.ticks === 0) {
          currentRoundTagEntries.delete(tagKey);
          const liveEnt = liveTagMap.get(tagKey);
          if (liveEnt && trueRoundTicks <= 1 && liveEnt.earlyRoundCount === 0) {
            const histMax = (liveEnt.roundTickCounts && liveEnt.roundTickCounts.length)
              ? Math.max.apply(null, liveEnt.roundTickCounts)
              : 0;
            liveEnt.maxRoundTicks = histMax;
            if ((!liveEnt.preCrashRounds || liveEnt.preCrashRounds.size === 0) && liveEnt.roundTickCounts.length === 0) {
              liveEnt.isEarlyOrContinuous = false;
            }
          }
          changedTags = true;
        } else {
          rEnt.lastSeq = keptSeqs[keptSeqs.length - 1];
          const liveEnt = liveTagMap.get(tagKey);
          if (liveEnt) {
            const histMax = (liveEnt.roundTickCounts && liveEnt.roundTickCounts.length)
              ? Math.max.apply(null, liveEnt.roundTickCounts)
              : 0;
            liveEnt.maxRoundTicks = Math.max(histMax, trueRoundTicks);
            if (trueRoundTicks > 1) {
              liveEnt.isEarlyOrContinuous = true;
            }
          }
        }
      }
    });
    if (changedTags) refreshPreCrashCandidates();
    if (aiCurRoundFrames.length > segWin.keepCount) {
      let cutIdx = 0;
      while (cutIdx < aiCurRoundFrames.length - segWin.keepCount && (aiCurRoundFrames[cutIdx].segSeq || 0) < cutoffSeq) {
        cutIdx++;
      }
      if (cutIdx === 0 && aiCurRoundFrames.length > segWin.keepCount) {
        cutIdx = aiCurRoundFrames.length - segWin.keepCount;
      }
      if (cutIdx > 0) aiCurRoundFrames.splice(0, cutIdx);
    }
  }

  function recordDiscoveredTag(tag, category, src, monoMs, timeStr, sample, isCrashTag, fromCrashPkt, msgSeq) {
    if (!tag || tag.length < 3 || tag.length > 1800 || isPureMultiplierTagText(tag)) return;
    let ent = liveTagMap.get(tag);
    const nonCashPhase = isWaitingOrBetPhaseTag(tag, src);
    if (!ent) {
      ent = {
        tag,
        category,
        src,
        count: 0,
        firstMono: monoMs,
        lastMono: monoMs,
        lastTime: timeStr,
        sample: sample || '',
        isCrashTag: Boolean(isCrashTag || isPostCrashTagPattern(tag)),
        isNonCashoutPhase: Boolean(nonCashPhase),
        isEarlyOrContinuous: false,
        earlyRoundCount: 0,
        lateRoundCount: 0,
        preCrashDeltaMs: null,
        minDeltaMs: null,
        maxDeltaMs: null,
        avgDeltaMs: null,
        lastPosFromCrash: null,
        lastRoundTotalMsgs: 0,
        lastPhase: 'pre-crash',
        preCrashCount: 0,
        preCrashRounds: new Set(),
        preCrashDeltas: [],
        roundTickCounts: [],
        avgRoundTicks: 0,
        maxRoundTicks: 0,
        shortRoundHits: 0,
        longRoundHits: 0
      };
      liveTagMap.set(tag, ent);
      liveTagList.unshift(ent);
      if (liveTagList.length > 450) {
        const activeTagSet = new Set(parseTagList((elTags && elTags.value) || CFG.tags || ''));
        let dropIdx = -1;
        for (let di = liveTagList.length - 1; di >= 0; di--) {
          const cand = liveTagList[di];
          if (!cand || activeTagSet.has(cand.tag)) continue;
          if ((!cand.preCrashRounds || cand.preCrashRounds.size === 0) && cand.lateRoundCount === 0 && (cand.isEarlyOrContinuous || cand.isCrashTag || cand.isNonCashoutPhase || cand.src === 'SMS/DOM')) {
            dropIdx = di;
            break;
          }
        }
        if (dropIdx === -1) {
          for (let di = liveTagList.length - 1; di >= 0; di--) {
            const cand = liveTagList[di];
            if (!cand || activeTagSet.has(cand.tag)) continue;
            if ((!cand.preCrashRounds || cand.preCrashRounds.size === 0) && cand.lateRoundCount === 0) {
              dropIdx = di;
              break;
            }
          }
        }
        if (dropIdx === -1) {
          for (let di = liveTagList.length - 1; di >= 0; di--) {
            const cand = liveTagList[di];
            if (!cand || activeTagSet.has(cand.tag)) continue;
            dropIdx = di;
            break;
          }
        }
        if (dropIdx === -1) dropIdx = liveTagList.length - 1;
        const dropped = liveTagList.splice(dropIdx, 1)[0];
        if (dropped) liveTagMap.delete(dropped.tag);
      }
    }
    ent.count += 1;
    ent.src = src;
    ent.lastMono = monoMs;
    ent.lastTime = timeStr;
    if (sample && !ent.sample) ent.sample = sample;
    if (isCrashTag || isPostCrashTagPattern(tag)) ent.isCrashTag = true;
    if (nonCashPhase) ent.isNonCashoutPhase = true;

    const isServerStream = (
      src === 'WS-IN' || src === 'SSE' || src === 'WORKER' ||
      src === 'TAP-RTC' || src === 'TAP-WT' || src === 'TAP-PM' ||
      src === 'API-RES' || src === 'TAP-RES' ||
      src === 'CSS-STATE' || src === 'JS-HOOK' || src === 'DOM-TAG' || src === 'API-SIG'
    );
    if (!ent.isCrashTag && !ent.isNonCashoutPhase && !fromCrashPkt && isServerStream) {
      if (currentRoundStartMono === 0 || currentRoundStartMono <= lastTagRoundEndMono) {
        currentRoundStartMono = monoMs;
      }
      const nextRoundAllTick = (currentRoundAllTicks.get(tag) || 0) + 1;
      currentRoundAllTicks.set(tag, nextRoundAllTick);
      let rEnt = currentRoundTagEntries.get(tag);
      if (!rEnt) {
        rEnt = {
          tag,
          category,
          src,
          firstMono: monoMs,
          lastMono: monoMs,
          lastSeq: msgSeq || 1,
          seqs: [],
          lastTime: timeStr,
          sample: ent.sample,
          ticks: 0,
          totalTicks: 0
        };
        currentRoundTagEntries.set(tag, rEnt);
      }
      rEnt.seqs.push(msgSeq || 1);
      rEnt.ticks = rEnt.seqs.length;
      rEnt.totalTicks = Math.max(rEnt.totalTicks || 0, nextRoundAllTick);
      rEnt.lastMono = monoMs;
      rEnt.lastSeq = msgSeq || rEnt.lastSeq || 1;
      rEnt.lastTime = timeStr;
      ent.maxRoundTicks = Math.max(ent.maxRoundTicks || 0, rEnt.totalTicks);
      // STRICT 1x/Round enforcement across both short & long rounds
      if (rEnt.totalTicks > 1) {
        ent.isEarlyOrContinuous = true;
        if (ent.preCrashRounds && ent.preCrashRounds.size) ent.preCrashRounds.clear();
        refreshPreCrashCandidates();
      }
    }
  }

  function refreshPreCrashCandidates() {
    const candidates = [];
    const reqSafeMarginMs = (CFG.netLagAutoShift !== false && rollingServerRttMs > 0)
      ? Math.min(900, Math.max(85, Math.round(rollingServerRttMs * 1.35 + 20)))
      : 120;
    for (let i = 0; i < liveTagList.length; i++) {
      const e = liveTagList[i];
      if (!e || e.isCrashTag || e.isNonCashoutPhase || e.isEarlyOrContinuous || e.earlyRoundCount >= 1 || (e.maxRoundTicks && e.maxRoundTicks > 1) || isPureMultiplierTagText(e.tag)) continue;
      if (e.src === 'SMS/DOM' && !e.preCrashRounds?.size) continue;
      if (!e.preCrashRounds || e.preCrashRounds.size === 0) continue;
      const dMs = e.avgDeltaMs != null ? e.avgDeltaMs : (e.preCrashDeltaMs != null ? e.preCrashDeltaMs : 0);
      if (dMs < 0) continue;
      candidates.push({
        tag: e.tag,
        category: e.category,
        src: e.src,
        roundsCount: e.preCrashRounds.size,
        shortRoundHits: e.shortRoundHits || 0,
        longRoundHits: e.longRoundHits || 0,
        deltaMs: e.preCrashDeltaMs != null ? e.preCrashDeltaMs : (e.avgDeltaMs != null ? e.avgDeltaMs : 0),
        minDeltaMs: e.minDeltaMs != null ? e.minDeltaMs : dMs,
        maxDeltaMs: e.maxDeltaMs != null ? e.maxDeltaMs : dMs,
        avgDeltaMs: dMs,
        reqAcceptMs: reqSafeMarginMs,
        lastPosFromCrash: e.lastPosFromCrash,
        lastRoundTotalMsgs: e.lastRoundTotalMsgs || 0,
        maxRoundTicks: e.maxRoundTicks || 1,
        avgRoundTicks: e.avgRoundTicks || 1,
        phase: e.lastPhase || ((e.lastPosFromCrash != null && e.lastPosFromCrash >= (CFG.preCrashMinFrames || 10) && e.lastPosFromCrash <= (CFG.preCrashMaxFrames || 20)) ? 'pre-crash' : 'mid-round'),
        time: e.lastTime,
        sample: e.sample,
        preCrashCount: e.preCrashCount
      });
    }
    const minW = Math.max(2, Number(CFG.preCrashMinFrames) || 10);
    const maxW = Math.max(minW, Number(CFG.preCrashMaxFrames) || 20);
    candidates.sort((a, b) => {
      const aRej = serverRejectedTagMap.get(a.tag) || 0;
      const bRej = serverRejectedTagMap.get(b.tag) || 0;
      if (aRej !== bRej) return aRej - bRej;
      const aBoth = (a.shortRoundHits > 0 && a.longRoundHits > 0) ? 1 : 0;
      const bBoth = (b.shortRoundHits > 0 && b.longRoundHits > 0) ? 1 : 0;
      if (bBoth !== aBoth) return bBoth - aBoth;
      if (b.roundsCount !== a.roundsCount) return b.roundsCount - a.roundsCount;
      const aSafe = ((a.minDeltaMs != null ? a.minDeltaMs : a.avgDeltaMs) >= reqSafeMarginMs) ? 0 : 1;
      const bSafe = ((b.minDeltaMs != null ? b.minDeltaMs : b.avgDeltaMs) >= reqSafeMarginMs) ? 0 : 1;
      if (aSafe !== bSafe) return aSafe - bSafe;
      const aInW = (a.lastPosFromCrash != null && a.lastPosFromCrash >= minW && a.lastPosFromCrash <= maxW) ? 0 : 1;
      const bInW = (b.lastPosFromCrash != null && b.lastPosFromCrash >= minW && b.lastPosFromCrash <= maxW) ? 0 : 1;
      if (aInW !== bInW) return aInW - bInW;
      const aDist = Math.abs((a.lastPosFromCrash || 15) - 15);
      const bDist = Math.abs((b.lastPosFromCrash || 15) - 15);
      if (aDist !== bDist) return aDist - bDist;
      return b.avgDeltaMs - a.avgDeltaMs;
    });
    preCrashTags.length = 0;
    for (let i = 0; i < Math.min(candidates.length, 16); i++) {
      preCrashTags.push(candidates[i]);
    }
    // Auto-apply verified 1x/R pre-crash tag (10-20 SMS before end) automatically when confirmed across 2+ rounds
    if (CFG.autoApplyVerifiedTag && !CFG.manualTagPin && candidates.length) {
      const best = candidates[0];
      const inWindow = best.lastPosFromCrash == null || (best.lastPosFromCrash >= Math.max(4, minW - 3) && best.lastPosFromCrash <= maxW + 5);
      const bestRejected = (serverRejectedTagMap.get(best.tag) || 0) > 0;
      if (best && !bestRejected && best.roundsCount >= 2 && best.maxRoundTicks <= 1 && inWindow) {
        const curTags = parseTagList((elTags && elTags.value) || CFG.tags || '');
        const hasValidActive = curTags.some((t) => {
          const lt = liveTagMap.get(t);
          return lt && !lt.isEarlyOrContinuous && !lt.isCrashTag && !lt.isNonCashoutPhase && (lt.maxRoundTicks || 1) <= 1;
        });
        if (!hasValidActive || !curTags.length) {
          if (CFG.tags !== best.tag) {
            CFG.tags = best.tag;
            CFG.roundOnce = true;
            if (CFG.matchMode !== 'contains' && CFG.matchMode !== 'json') CFG.matchMode = 'contains';
            if (typeof elTags !== 'undefined' && elTags) elTags.value = best.tag;
            if (typeof elMode !== 'undefined' && elMode) elMode.value = CFG.matchMode;
            lastMatchPreview = 'AUTO-1x/R: ' + best.tag.slice(0, 18);
            if (typeof applyAutoTagConfig === 'function') applyAutoTagConfig('AUTO_VERIFIED');
            if (typeof persistHudControlState === 'function') persistHudControlState();
            if (typeof syncTurboCfg === 'function') syncTurboCfg(true, true);
            if (typeof scheduleSyncUI === 'function') scheduleSyncUI();
          }
        }
      }
    }
  }

  function extractJsonSignaturesRtf(obj, prefix, depth, out) {
    if (depth > 3 || obj === null || obj === undefined || out.length >= 24) return out;
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      if (prefix) {
        const lastKey = prefix.split('.').pop().replace(/\[\d+\]$/, '');
        if (isMultiplierOrVolatileKey(lastKey) || isProofOrHashKey(lastKey)) return out;
        const str = String(obj);
        if (typeof obj === 'number' && (!Number.isFinite(obj) || obj > 1e11 || !Number.isInteger(obj))) return out;
        if (str.length > 0 && str.length <= 44 && !isMultiplierLikeValue(str)) {
          out.push(prefix + '=' + JSON.stringify(obj));
        }
      }
      return out;
    }
    if (Array.isArray(obj)) {
      if (prefix) out.push(prefix + ':array[' + obj.length + ']');
      if (obj.length > 0) extractJsonSignaturesRtf(obj[0], (prefix || '') + '[0]', depth + 1, out);
      return out;
    }
    if (typeof obj === 'object') {
      const entries = Object.entries(obj).slice(0, 14);
      for (let i = 0; i < entries.length; i++) {
        const k = entries[i][0];
        const v = entries[i][1];
        const lk = k.toLowerCase();
        if (SKIP_CONTAINER_KEYS.has(lk) || isMultiplierOrVolatileKey(k) || isProofOrHashKey(k)) continue;
        extractJsonSignaturesRtf(v, prefix ? (prefix + '.' + k) : k, depth + 1, out);
      }
    }
    return out;
  }

  function finalizeRoundTagDiscovery(monoMs) {
    lastTagRoundEndMono = monoMs;
    tagFlightSeenInRound = false;
    const finishedRoundIdx = tagRoundCount;
    const roundDurMs = currentRoundStartMono > 0 ? Math.max(80, Math.round(monoMs - currentRoundStartMono)) : 0;
    const isShortRound = roundDurMs > 0 && roundDurMs < 5500;
    const isLongRound = roundDurMs >= 5500;
    if (roundDurMs > 0) {
      roundDurationHistory.push(roundDurMs);
      if (roundDurationHistory.length > 20) roundDurationHistory.shift();
    }
    const totalMsgsInRound = Math.max(1, currentRoundMsgSeq);
    const endSegWin = getSmartSegmentWindow(totalMsgsInRound);
    if (endSegWin.active) {
      pruneSegmenterWindow(endSegWin);
    }
    tagRoundCount += 1;

    currentRoundTagEntries.forEach((h) => {
      const liveEnt = liveTagMap.get(h.tag);
      if (!liveEnt || liveEnt.isCrashTag) return;

      const roundTicks = Math.max(h.ticks || 1, h.totalTicks || 0, currentRoundAllTicks.get(h.tag) || 0);
      liveEnt.maxRoundTicks = Math.max(liveEnt.maxRoundTicks || 0, roundTicks);
      liveEnt.roundTickCounts.push(roundTicks);
      if (liveEnt.roundTickCounts.length > 12) liveEnt.roundTickCounts.shift();
      let tSum = 0;
      for (let ti = 0; ti < liveEnt.roundTickCounts.length; ti++) tSum += liveEnt.roundTickCounts[ti];
      liveEnt.avgRoundTicks = Number((tSum / liveEnt.roundTickCounts.length).toFixed(1));

      const dt = Math.max(0, monoMs - h.lastMono);
      if (roundTicks > 1) liveEnt.earlyRoundCount += 1;
      const isRepeating = (roundTicks > 1) || (liveEnt.earlyRoundCount >= 1) || liveEnt.isEarlyOrContinuous;

      if (isRepeating) {
        liveEnt.isEarlyOrContinuous = true;
        if (liveEnt.preCrashRounds && liveEnt.preCrashRounds.size) liveEnt.preCrashRounds.clear();
      } else if (roundTicks === 1 && dt >= 0) {
        const dtMs = Math.round(dt);
        const posFromCrash = Math.max(1, totalMsgsInRound - (h.lastSeq || totalMsgsInRound) + 1);
        liveEnt.lateRoundCount += 1;
        liveEnt.preCrashCount += 1;
        if (isShortRound) liveEnt.shortRoundHits = (liveEnt.shortRoundHits || 0) + 1;
        else if (isLongRound) liveEnt.longRoundHits = (liveEnt.longRoundHits || 0) + 1;
        liveEnt.lastPosFromCrash = posFromCrash;
        liveEnt.lastRoundTotalMsgs = totalMsgsInRound;
        liveEnt.lastPhase = (posFromCrash >= (CFG.preCrashMinFrames || 10) && posFromCrash <= (CFG.preCrashMaxFrames || 20)) ? 'pre-crash' : (dtMs <= 4500 && dtMs >= 800) ? 'pre-crash' : 'mid-round';
        liveEnt.preCrashDeltaMs = dtMs;
        liveEnt.minDeltaMs = liveEnt.minDeltaMs == null ? dtMs : Math.min(liveEnt.minDeltaMs, dtMs);
        liveEnt.maxDeltaMs = liveEnt.maxDeltaMs == null ? dtMs : Math.max(liveEnt.maxDeltaMs, dtMs);
        liveEnt.preCrashRounds.add(finishedRoundIdx + 1);
        liveEnt.preCrashDeltas.push(dtMs);
        if (liveEnt.preCrashDeltas.length > 12) liveEnt.preCrashDeltas.shift();
        let dSum = 0;
        for (let di = 0; di < liveEnt.preCrashDeltas.length; di++) dSum += liveEnt.preCrashDeltas[di];
        liveEnt.avgDeltaMs = Math.round(dSum / liveEnt.preCrashDeltas.length);
      }
    });

    currentRoundTagEntries.clear();
    currentRoundAllTicks.clear();
    currentRoundStartMono = 0;
    currentRoundMsgSeq = 0;
    refreshPreCrashCandidates();
    if (aiCurRoundFrames.length >= 4) {
      const roundRawTotal = Math.max(aiCurRoundRawCount, aiCurRoundFrames.length);
      aiLastRoundRawCount = roundRawTotal;
      aiLastRoundFrames = sliceFramesForSmartSegmenter(aiCurRoundFrames, roundRawTotal);
    }
    aiCurRoundFrames.length = 0;
    aiCurRoundRawCount = 0;
    if (aiHudAuto && aiLastRoundFrames.length >= 4 && (Date.now() - aiHudLastAutoAt >= 5000) && typeof runHudAiRoundCheck === 'function') {
      aiHudLastAutoAt = Date.now();
      runHudAiRoundCheck(aiLastRoundFrames, aiLastRoundRawCount);
    }
  }

  function markManualRoundEnd(reason) {
    const monoNow = performance.now();
    if (currentRoundStartMono > 0 && monoNow - currentRoundStartMono < 260) return false;
    if (monoNow - lastTagRoundEndMono < 260 && tagRoundCount > 0) return false;
    finalizeRoundTagDiscovery(monoNow);
    if (CFG.armed && CFG.roundOnce && roundClickLocked) {
      roundClickLocked = false;
      roundSawFlightAfterLock = false;
      roundSawCrashAfterLock = false;
      roundLastFlightAt = 0;
      roundClickLockedRoundId = '';
      roundUnlockSeq += 1;
      syncTurboCfg(true, false);
      if (!hudHidden) broadcastDownToIframes({ __TT_SNIFFER__: true, kind: 'ROUND_UNLOCK' });
    }
    if (typeof scheduleRenderLogs === 'function') scheduleRenderLogs();
    if (typeof syncUI === 'function' && !hudHidden) syncUI();
    return true;
  }

  function discoverNonMultiplierTags(src, rawText, monoMs, timeStr) {
    if (!rawText || src === 'CLICK' || src === 'WS-OUT' || src === 'API-REQ' || src === 'TAP-NET' || src === 'ELEMENT_PICK') return;
    const s = String(rawText).trim();
    if (!s || s.length > 24000 || s === '2' || s === '3' || s === 'h' || s === 'o' || s === 'ping' || s === 'pong' || s === 'hb') return;
    if ((src === 'API-RES' || src === 'TAP-RES') && (s.length > 16000 || (/^(?:\d{3}\s+)?GET\s+/i.test(s.slice(0, 48)) && !/(coef|mul|cash|bet|round|crash|game|finish|start|state|status|phase|stage|open|active|win|result|tick|timer|play|live)/i.test(s.slice(0, 2400))))) return;
    if (s.startsWith('<binary') || s.startsWith('<bytes')) return;
    if (s.startsWith('{') && s.length <= 96 && (s.includes('"ping"') || s.includes('"pong"') || s.includes('"welcome"') || s.includes('"confirm_subscription"') || s.includes('"type":6'))) {
      try {
        const hb = JSON.parse(s);
        if (hb && (hb.type === 6 || hb.type === 'ping' || hb.type === 'pong' || hb.type === 'welcome' || hb.type === 'confirm_subscription')) return;
      } catch {}
    }

    const unwrappedEarly = (s.includes('{') || s.includes('[')) ? getCachedUnwrappedJson(s) : null;
    const pktInfo = analyzeGamePacket(src, s, unwrappedEarly);
    const raceKind = classifyRaceKind(src, s);
    if (pktInfo.inFlight) {
      tagFlightSeenInRound = true;
    }
    if (raceKind === 'START' || pktInfo.inFlight) {
      if (currentRoundStartMono === 0 || currentRoundStartMono <= lastTagRoundEndMono) {
        currentRoundStartMono = monoMs;
      }
    }
    const roundIdChangedEnd = Boolean(
      pktInfo.roundId &&
      currentTagRoundId &&
      pktInfo.roundId !== currentTagRoundId &&
      currentRoundMsgSeq >= 1 &&
      (monoMs - lastTagRoundEndMono >= 280)
    );
    if (pktInfo.roundId) {
      currentTagRoundId = pktInfo.roundId;
    }
    const isRtfNonWsSrc = (src === 'CSS-STATE' || src === 'JS-HOOK' || src === 'DOM-TAG' || src === 'SMS/DOM');
    const isCrashPkt = Boolean(
      !isRtfNonWsSrc && (
        pktInfo.hasJson
          ? (pktInfo.isCrash || (pktInfo.isStart && tagFlightSeenInRound) || (roundIdChangedEnd && tagFlightSeenInRound))
          : pktInfo.hasXml
          ? (pktInfo.isCrash || (pktInfo.isStart && tagFlightSeenInRound) || roundIdChangedEnd)
          : (isCrashLikeTagText(s) || (raceKind === 'CRASH') || roundIdChangedEnd)
      )
    );
    const foundTags = [];
    const seenThisFrame = new Set();
    const pushTag = (tag, cat, sample) => {
      if (!tag || seenThisFrame.has(tag) || isAnalyticsOrNoiseTag(tag, src, s)) return;
      seenThisFrame.add(tag);
      foundTags.push({ tag, cat, sample: sample || '' });
    };

    if (src === 'CSS-STATE') {
      const spIdx = s.indexOf(' ');
      const cssHead = spIdx > 0 ? s.slice(0, spIdx).trim() : s.slice(0, 140);
      const cssText = spIdx > 0 ? s.slice(spIdx + 1).trim() : '';
      if (cssHead.length >= 5) pushTag(cssHead.slice(0, 160), 'CSS-STATE', s.slice(0, 140));
      if (cssText && cssText.length >= 3 && !isPureMultiplierTagText(cssText)) {
        const cleanedCssTxt = cssText.replace(/\b\d+(?:[.,]\d+)?\s*(?:x|×|%|bdt|usd|eur|inr|rub|trx|usdt)\b/gi, '').trim();
        if (cleanedCssTxt.length >= 3 && /[a-zA-Z\u0980-\u09FF]{3,}/.test(cleanedCssTxt)) {
          pushTag(cleanedCssTxt.slice(0, 80), 'DOM', s.slice(0, 140));
        }
      }
    } else if (src === 'JS-HOOK') {
      const evM = s.match(/^(js:CustomEvent\("[^"]+"\))/);
      const jsHead = evM ? evM[1] : s.slice(0, 96);
      pushTag(jsHead, 'JS-HOOK', s.slice(0, 160));
      if (unwrappedEarly && typeof unwrappedEarly === 'object') {
        const jsSigs = extractJsonSignaturesRtf(unwrappedEarly, '', 0, []);
        const jsPriority = jsSigs.find((sg) => /(status|phase|state|lock|round|end|stage|event|action|type|cmd|crash|cash)=/i.test(sg)) || jsSigs[0];
        if (jsPriority) pushTag(jsHead + ' ' + jsPriority, 'JS-HOOK', s.slice(0, 160));
        for (let ji = 0; ji < Math.min(2, jsSigs.length); ji++) {
          if (!isPureMultiplierTagText(jsSigs[ji])) pushTag(jsSigs[ji], 'KEY', s.slice(0, 140));
        }
      }
    } else if (src === 'DOM-TAG') {
      const spIdx = s.indexOf(' ');
      const domHead = spIdx > 0 ? s.slice(0, spIdx).trim() : s.slice(0, 120);
      const domBody = spIdx > 0 ? s.slice(spIdx + 1).trim() : '';
      if (domHead.length >= 5) pushTag(domHead.slice(0, 140), 'DOM-TAG', s.slice(0, 140));
      if (domBody && domBody.length >= 3 && !isPureMultiplierTagText(domBody)) {
        const cleanedDomTxt = domBody.replace(/\b\d+(?:[.,]\d+)?\s*(?:x|×|%|bdt|usd|eur|inr|rub|trx|usdt)\b/gi, '').replace(/\s+/g, ' ').trim();
        if (cleanedDomTxt.length >= 3 && /[a-zA-Z\u0980-\u09FF]{3,}/.test(cleanedDomTxt)) {
          pushTag(cleanedDomTxt.slice(0, 80), 'DOM', s.slice(0, 140));
        }
      }
    } else if (src === 'SMS/DOM') {
      const cleaned = s
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:x|×|%|bdt|usd|eur|inr|rub|trx|usdt)\b/gi, '')
        .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length >= 3 && /[a-zA-Z\u0980-\u09FF]{3,}/.test(cleaned)) {
        const domTag = cleaned.slice(0, 64);
        pushTag(domTag, 'DOM', s.slice(0, 100));
      }
    } else {
      const firstNl = s.indexOf('\n');
      const firstLine = (firstNl >= 0 ? s.slice(0, firstNl) : s).trim();
      const apiHdr = firstLine.match(/^(?:\d{3}\s+)?(GET|POST|PUT|PATCH|DELETE|BEACON|TAP)\s+(https?:\/\/[^\s]+|\S+)/i);
      let apiShortPath = '';
      if (apiHdr) {
        try {
          const u = apiHdr[2].startsWith('http') ? new URL(apiHdr[2]) : null;
          const segs = (u ? u.pathname : apiHdr[2].split('?')[0]).split('/').filter(Boolean);
          const apiTag = segs.length >= 2 ? ('/' + segs.slice(-2).join('/')) : (segs[0] ? ('/' + segs[0]) : '');
          if (apiTag && !/\.(js|css|png|jpg|svg|webp|woff2?)$/i.test(apiTag)) {
            apiShortPath = apiTag;
            pushTag(apiTag, 'API', firstLine.slice(0, 110));
          }
        } catch {}
      }

      const unwrapped = unwrappedEarly;
      const xmlPkt = !unwrapped ? parseXmlGamePacket(s) : null;
      const stripVolatileOuter = (node, depth, stats) => {
        if (depth > 6 || node == null) return node;
        if (Array.isArray(node)) {
          const outA = [];
          for (let i = 0; i < Math.min(node.length, 12); i++) {
            const c = stripVolatileOuter(node[i], depth + 1, stats);
            if (c !== undefined) outA.push(c);
          }
          return outA;
        }
        if (typeof node === 'object') {
          const outO = {};
          const ks = Object.keys(node);
          for (let i = 0; i < Math.min(ks.length, 40); i++) {
            const k = ks[i];
            const lk = k.toLowerCase();
            if (SKIP_CONTAINER_KEYS.has(lk) || isMultiplierOrVolatileKey(k) || isProofOrHashKey(k)) {
              stats.stripped = true;
              continue;
            }
            const c = stripVolatileOuter(node[k], depth + 1, stats);
            if (c !== undefined) outO[k] = c;
          }
          return Object.keys(outO).length > 0 ? outO : undefined;
        }
        if (typeof node === 'number' && !Number.isInteger(node) && depth >= 1) {
          stats.stripped = true;
          return undefined;
        }
        return node;
      };

      if (unwrapped && typeof unwrapped === 'object') {
        const fullSample = s.slice(0, 1800);
        if (src === 'API-RES' || src === 'TAP-RES') {
          const flatApiSigs = extractJsonSignaturesRtf(unwrapped, '', 0, []);
          const priApiSig = flatApiSigs.find((sg) => /(status|phase|state|lock|round|end|stage|event|action|type|cmd)=/i.test(sg)) || flatApiSigs[0];
          if (priApiSig && apiShortPath) {
            pushTag('api:' + apiShortPath + ' -> ' + priApiSig, 'API-SIG', firstLine.slice(0, 120));
          }
          for (let ai = 0; ai < Math.min(2, flatApiSigs.length); ai++) {
            if (!isPureMultiplierTagText(flatApiSigs[ai])) pushTag(flatApiSigs[ai], 'KEY', firstLine.slice(0, 110));
          }
        }
        const stStats = { stripped: false };
        const cleanTree = stripVolatileOuter(unwrapped, 0, stStats);
        let skipPureCoef = false;
        if (Array.isArray(cleanTree) && cleanTree.length === 1 && typeof cleanTree[0] === 'string' && /^(?:coef|coeff|coefficient|curcoef|tick|mul|mult|x)$/i.test(cleanTree[0].trim())) {
          skipPureCoef = true;
        }
        if (cleanTree !== undefined && !skipPureCoef) {
          try {
            const cleanJson = JSON.stringify(cleanTree);
            if (cleanJson && cleanJson !== '{}' && cleanJson !== '[]' && !isPureMultiplierTagText(cleanJson)) {
              const ibS = s.indexOf('{');
              const iaS = s.indexOf('[');
              const firstStructIdx = (ibS >= 0 && iaS >= 0) ? Math.min(ibS, iaS) : Math.max(ibS, iaS);
              const rawPrefix = firstStructIdx > 0 ? s.slice(0, firstStructIdx).trim() : '';
              const sioPrefix = /^(?:\d{1,4}(?:\/[^,\[]*)?[, -]*)$/.test(rawPrefix) ? rawPrefix : '';
              const normalizedFullWs = !stStats.stripped && s.length <= 1800 && !/[\r\n]/.test(s)
                ? s
                : (sioPrefix + cleanJson);
              if (normalizedFullWs.length >= 6 && normalizedFullWs.length <= 1800 && !isPureMultiplierTagText(normalizedFullWs)) {
                pushTag(normalizedFullWs, 'FULL-WS', fullSample);
              }
              if (cleanJson !== normalizedFullWs && cleanJson.length >= 6 && cleanJson.length <= 1800 && !isPureMultiplierTagText(cleanJson)) {
                pushTag(cleanJson, 'JSON-SMS', fullSample);
              }
              if (Array.isArray(cleanTree) && cleanTree.length >= 2 && cleanTree[1] && typeof cleanTree[1] === 'object') {
                const innerJson = JSON.stringify(cleanTree[1]);
                if (innerJson && innerJson !== '{}' && innerJson !== '[]' && innerJson.length >= 6 && innerJson.length <= 1800 && !isPureMultiplierTagText(innerJson)) {
                  pushTag(innerJson, 'JSON-SMS', fullSample);
                }
              }
            }
          } catch {}
        }
      } else if (xmlPkt) {
        const xmlSample = s.slice(0, 1800);
        if (!xmlPkt.inFlight || xmlPkt.isCrash || xmlPkt.isStart || xmlPkt.isCash) {
          const safeAttrs = [];
          for (let ai = 0; ai < xmlPkt.attrPairs.length; ai++) {
            const ap = xmlPkt.attrPairs[ai];
            if (!ap || isMultiplierOrVolatileKey(ap.key) || isProofOrHashKey(ap.key)) continue;
            const av = String(ap.val || '').trim();
            if (!av || isMultiplierLikeValue(av) || isPureMultiplierTagText(av)) continue;
            safeAttrs.push(ap.key + '="' + av + '"');
          }
          const fullXmlSig = safeAttrs.length ? ('<' + xmlPkt.tag + ' ' + safeAttrs.join(' ')) : ('<' + xmlPkt.tag);
          if (fullXmlSig.length <= 1800) pushTag(fullXmlSig, 'FULL-WS', xmlSample);
        }
      } else if (!apiHdr) {
        const cleanedTxt = s.replace(/[\x00-\x1f]+/g, ' ').trim();
        if (cleanedTxt.length >= 4 && cleanedTxt.length <= 1800 && !isMultiplierLikeValue(cleanedTxt) && !isPureMultiplierTagText(cleanedTxt) && /[a-zA-Z\u0980-\u09FF]{2,}/.test(cleanedTxt)) {
          pushTag(cleanedTxt, 'FULL-WS', cleanedTxt);
        }
      }
    }

    const isStreamFrame = (
      src === 'WS-IN' || src === 'SSE' || src === 'WORKER' ||
      src === 'TAP-RTC' || src === 'TAP-WT' || src === 'TAP-PM' ||
      src === 'API-RES' || src === 'TAP-RES' ||
      src === 'CSS-STATE' || src === 'JS-HOOK' || src === 'DOM-TAG' || src === 'API-SIG'
    );
    if (isStreamFrame && !isCrashPkt) {
      currentRoundMsgSeq += 1;
    }
    if (isStreamFrame) {
      aiCurRoundRawCount += 1;
      aiCurRoundFrames.push({
        seq: aiFrameSeq++,
        segSeq: currentRoundMsgSeq || aiCurRoundRawCount,
        src: src,
        time: timeStr,
        monoMs: monoMs,
        text: s.length > 1800 ? s.slice(0, 1800) : s
      });
      if (aiCurRoundFrames.length > 260) aiCurRoundFrames.shift();
    }

    for (let i = 0; i < foundTags.length; i++) {
      const f = foundTags[i];
      recordDiscoveredTag(f.tag, f.cat, src, monoMs, timeStr, f.sample, isCrashLikeTagText(f.tag), isCrashPkt, currentRoundMsgSeq);
    }

    const activeSegWin = getSmartSegmentWindow(currentRoundMsgSeq);
    if (activeSegWin.active) {
      pruneSegmenterWindow(activeSegWin);
    }

    if (isCrashPkt && (monoMs - lastTagRoundEndMono >= 280 || tagRoundCount === 0)) {
      finalizeRoundTagDiscovery(monoMs);
    }
    if (typeof updateEarlyTagWarning === 'function') updateEarlyTagWarning();
  }

  function extractTagCandidate(text) {
    const rawStr = String(text || '');
    const firstNl = rawStr.indexOf('\n');
    const firstLine = (firstNl >= 0 ? rawStr.slice(0, firstNl) : rawStr).trim();
    const apiHdr = firstLine.match(/^(?:\d{3}\s+)?(GET|POST|PUT|PATCH|DELETE|BEACON)\s+(https?:\/\/[^\s]+|\S+)/i);
    let apiPathTag = '';
    if (apiHdr) {
      try {
        const u = apiHdr[2].startsWith('http') ? new URL(apiHdr[2]) : null;
        const segs = (u ? u.pathname : apiHdr[2].split('?')[0]).split('/').filter(Boolean);
        apiPathTag = segs.length >= 2 ? ('/' + segs.slice(-2).join('/')) : (segs[0] ? ('/' + segs[0]) : apiHdr[2].slice(0, 48));
      } catch {
        apiPathTag = apiHdr[2].slice(0, 48);
      }
    }

    const info = extractJsonPayload(text);
    if (!info) {
      if (apiPathTag) return apiPathTag;
      const xmlCand = parseXmlGamePacket(rawStr);
      if (xmlCand) {
        for (let ai = 0; ai < xmlCand.attrPairs.length; ai++) {
          const ap = xmlCand.attrPairs[ai];
          if (!ap || isMultiplierOrVolatileKey(ap.key) || isProofOrHashKey(ap.key)) continue;
          const av = String(ap.val || '').trim();
          if (av && !isMultiplierLikeValue(av) && !isPureMultiplierTagText(av)) return ap.key + '="' + av + '"';
        }
        return '<' + xmlCand.tag;
      }
      const lines = rawStr.split(/\x1e|\r?\n/).map(s => s.trim()).filter(Boolean);
      const nonMultLine = lines.find((ln) => !isMultiplierLikeValue(ln) && !isPureMultiplierTagText(ln)) || '';
      return nonMultLine.length > 120 ? nonMultLine.slice(0, 120) : nonMultLine;
    }
    const parsed = unwrapNestedJson(info.parsed, 0);
    const stripCand = (node, depth, st) => {
      if (depth > 6 || node == null) return node;
      if (Array.isArray(node)) {
        const a = [];
        for (let i = 0; i < Math.min(node.length, 12); i++) {
          const c = stripCand(node[i], depth + 1, st);
          if (c !== undefined) a.push(c);
        }
        return a;
      }
      if (typeof node === 'object') {
        const o = {};
        const ks = Object.keys(node);
        for (let i = 0; i < Math.min(ks.length, 40); i++) {
          const k = ks[i];
          const lk = k.toLowerCase();
          if (SKIP_CONTAINER_KEYS.has(lk) || isMultiplierOrVolatileKey(k) || isProofOrHashKey(k)) { st.stripped = true; continue; }
          const c = stripCand(node[k], depth + 1, st);
          if (c !== undefined) o[k] = c;
        }
        return Object.keys(o).length > 0 ? o : undefined;
      }
      if (typeof node === 'number' && !Number.isInteger(node) && depth >= 1) { st.stripped = true; return undefined; }
      return node;
    };
    const stC = { stripped: false };
    const cleanP = stripCand(parsed, 0, stC);
    if (cleanP !== undefined) {
      try {
        const cleanS = JSON.stringify(cleanP);
        const ibC = rawStr.indexOf('{');
        const iaC = rawStr.indexOf('[');
        const firstIdx = (ibC >= 0 && iaC >= 0) ? Math.min(ibC, iaC) : Math.max(ibC, iaC);
        const pfx = firstIdx > 0 ? rawStr.slice(0, firstIdx).trim() : '';
        const sioPfx = /^(?:\d{1,4}(?:\/[^,\[]*)?[, -]*)$/.test(pfx) ? pfx : '';
        const outFull = !stC.stripped && rawStr.trim().length <= 1800 && !/[\r\n]/.test(rawStr.trim()) ? rawStr.trim() : (sioPfx + cleanS);
        if (outFull && outFull !== '{}' && outFull !== '[]' && outFull.length <= 1800 && !isPureMultiplierTagText(outFull)) {
          return outFull;
        }
      } catch {}
    }
    if (apiPathTag) return apiPathTag;
    if (info.compact.length <= 1800 && !isPureMultiplierTagText(info.compact)) return info.compact;
    return '';
  }

  function parseTagList(rawInput) {
    const raw = String(rawInput !== undefined ? rawInput : (CFG.tags || ''));
    const out = [];
    let cur = '';
    let braceDepth = 0;
    let bracketDepth = 0;
    let inQuote = '';
    let escaped = false;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (escaped) {
        cur += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\' && inQuote) {
        cur += ch;
        escaped = true;
        continue;
      }
      if (inQuote) {
        if (ch === '\n' || ch === '\r') {
          inQuote = '';
          braceDepth = 0;
          bracketDepth = 0;
          const tBroken = cur.trim();
          if (tBroken) out.push(tBroken);
          cur = '';
          continue;
        }
        cur += ch;
        if (ch === inQuote) inQuote = '';
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        cur += ch;
        continue;
      }
      if (ch === '{') braceDepth++;
      else if (ch === '}' && braceDepth > 0) braceDepth--;
      else if (ch === '[') bracketDepth++;
      else if (ch === ']' && bracketDepth > 0) bracketDepth--;

      if ((ch === ',' || ch === '\n' || ch === '\r') && braceDepth === 0 && bracketDepth === 0) {
        const t = cur.trim();
        if (t) out.push(t);
        cur = '';
        continue;
      }
      cur += ch;
    }
    const tail = cur.trim();
    if (tail) out.push(tail);
    return out;
  }

  function resolveKeyOuter(obj, key) {
    if (!obj || typeof obj !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, key)) return key;
    if (CFG.caseSensitive) return undefined;
    const lk = String(key).toLowerCase();
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === lk) return keys[i];
    }
    return undefined;
  }

  function findKeyDeep(obj, key) {
    if (!obj || typeof obj !== 'object') return undefined;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const found = findKeyDeep(obj[i], key);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    const rk = resolveKeyOuter(obj, key);
    if (rk !== undefined) return obj[rk];
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const found = findKeyDeep(obj[keys[i]], key);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  function parseNumLikeOuter(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    if (typeof v !== 'string') return NaN;
    let raw = v.trim().replace(/^["']|["']$/g, '').trim().replace(/^[x×]/i, '').trim().replace(/\s*[x×%]$/i, '').trim();
    if (!raw) return NaN;
    if (raw.includes(',') && !raw.includes('.')) {
      raw = /^\d+,\d{1,2}$/.test(raw) ? raw.replace(',', '.') : raw.replace(/,/g, '');
    } else {
      raw = raw.replace(/,/g, '');
    }
    if (!raw || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) return NaN;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : NaN;
  }

  function lookupJsonPath(parsed, path) {
    if (parsed == null || !path) return undefined;
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let cur = parsed;
    for (let i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') {
        cur = undefined;
        break;
      }
      if (Array.isArray(cur)) {
        const idx = /^\d+$/.test(parts[i]) ? Number(parts[i]) : -1;
        cur = idx >= 0 && idx < cur.length ? cur[idx] : undefined;
      } else {
        const rk = resolveKeyOuter(cur, parts[i]);
        cur = rk !== undefined ? cur[rk] : undefined;
      }
    }
    if (cur !== undefined) return cur;
    if (parts.length === 1) {
      const deep = findKeyDeep(parsed, parts[0]);
      if (deep !== undefined) return deep;
      if (Array.isArray(parsed) && parsed.length >= 2 && typeof parsed[0] === 'string' && parsed[0].toLowerCase() === parts[0].toLowerCase()) {
        return parsed[1];
      }
      if (typeof parsed === 'object' && !Array.isArray(parsed) && typeof parsed.target === 'string' && parsed.target.toLowerCase() === parts[0].toLowerCase() && Array.isArray(parsed.arguments) && (typeof parsed.arguments[0] === 'number' || typeof parsed.arguments[0] === 'string')) {
        return parsed.arguments[0];
      }
    }
    return undefined;
  }

  function jsonValuesMatch(haystack, needle, depth) {
    if (depth > 8) return false;
    if (needle === haystack) return true;
    if (needle == null || haystack == null) return needle === haystack;
    if (typeof needle === 'string' && typeof haystack === 'string') {
      if (CFG.caseSensitive ? haystack === needle : haystack.toLowerCase() === needle.toLowerCase()) return true;
      const nh = parseNumLikeOuter(haystack);
      const nn = parseNumLikeOuter(needle);
      return !Number.isNaN(nh) && !Number.isNaN(nn) && nh === nn;
    }
    if (typeof needle !== 'object') {
      if (String(haystack) === String(needle)) return true;
      const nh = parseNumLikeOuter(haystack);
      const nn = parseNumLikeOuter(needle);
      return !Number.isNaN(nh) && !Number.isNaN(nn) && nh === nn;
    }
    if (typeof haystack !== 'object') {
      if (typeof haystack === 'string' && depth < 6) {
        const st = haystack.trim();
        if (st.length >= 2 && st.length <= 4000 && ((st[0] === '{' && st[st.length - 1] === '}') || (st[0] === '[' && st[st.length - 1] === ']'))) {
          try { return jsonValuesMatch(JSON.parse(st), needle, depth + 1); } catch {}
        }
      }
      return false;
    }
    if (Array.isArray(needle)) {
      if (!Array.isArray(haystack)) return false;
      for (let i = 0; i < needle.length; i++) {
        let ok = false;
        for (let j = 0; j < haystack.length; j++) {
          if (jsonValuesMatch(haystack[j], needle[i], depth + 1)) { ok = true; break; }
        }
        if (!ok) return false;
      }
      return true;
    }
    if (Array.isArray(haystack)) {
      for (let i = 0; i < haystack.length; i++) {
        if (jsonValuesMatch(haystack[i], needle, depth + 1)) return true;
      }
      return false;
    }
    const nKeys = Object.keys(needle);
    let allDirectMatch = nKeys.length > 0;
    for (let i = 0; i < nKeys.length; i++) {
      const k = nKeys[i];
      const rk = resolveKeyOuter(haystack, k);
      if (rk === undefined || !jsonValuesMatch(haystack[rk], needle[k], depth + 1)) {
        allDirectMatch = false;
        break;
      }
    }
    if (allDirectMatch) return true;
    const hKeys = Object.keys(haystack);
    for (let i = 0; i < hKeys.length; i++) {
      const v = haystack[hKeys[i]];
      if (v && typeof v === 'object' && jsonValuesMatch(v, needle, depth + 1)) return true;
      if (typeof v === 'string' && depth < 6) {
        const st = v.trim();
        if (st.length >= 2 && st.length <= 4000 && ((st[0] === '{' && st[st.length - 1] === '}') || (st[0] === '[' && st[st.length - 1] === ']'))) {
          try { if (jsonValuesMatch(JSON.parse(st), needle, depth + 1)) return true; } catch {}
        }
      }
    }
    return false;
  }

  let cachedTagKey = '';
  let cachedTagEntries = [];
  function getCompiledTags() {
    const rawTags = String(CFG.tags || '');
    const key = CFG.matchMode + '|' + (CFG.caseSensitive ? '1' : '0') + '|' + rawTags;
    if (key === cachedTagKey) return cachedTagEntries;
    cachedTagKey = key;
    const patterns = parseTagList(rawTags);
    const entries = [];
    for (let i = 0; i < patterns.length; i++) {
      const p = patterns[i];
      const clean = p.replace(/,+\s*$/, '').trim();
      if (!clean) continue;
      const apiSigMatch = clean.match(/^api:([^\s]+)\s*->\s*(.+)$/i);
      const apiSig = apiSigMatch ? {
        pathNeedle: CFG.caseSensitive ? apiSigMatch[1].trim() : apiSigMatch[1].trim().toLowerCase(),
        condRaw: apiSigMatch[2].trim(),
        condNeedle: CFG.caseSensitive ? apiSigMatch[2].trim() : apiSigMatch[2].trim().toLowerCase(),
        condKv: apiSigMatch[2].trim().match(/^([\w.$\[\]]+)\s*(>=|<=|>|<|==|=)\s*(.+)$/)
      } : null;
      const jsSigMatch = !apiSig ? clean.match(/^(js:CustomEvent\("[^"]+"\))\s+(.+)$/) : null;
      const jsSig = jsSigMatch ? {
        evNeedle: CFG.caseSensitive ? jsSigMatch[1].trim() : jsSigMatch[1].trim().toLowerCase(),
        condRaw: jsSigMatch[2].trim(),
        condNeedle: CFG.caseSensitive ? jsSigMatch[2].trim() : jsSigMatch[2].trim().toLowerCase(),
        condKv: jsSigMatch[2].trim().match(/^([\w.$\[\]]+)\s*(>=|<=|>|<|==|=)\s*(.+)$/)
      } : null;
      let tagJson = (!apiSig && !jsSig && (clean.startsWith('{') || clean.startsWith('[') || clean.includes('{') || clean.includes('[')))
        ? extractJsonPayload(clean)
        : null;
      if (!apiSig && !jsSig && !tagJson && clean.includes(':')) {
        tagJson = extractJsonPayload('{' + clean + '}');
        if (!tagJson) {
          const normKey = clean.replace(/^(['"])([^'"]+)\1\s*:/, '"$2":').replace(/^([a-zA-Z0-9_.-]+)\s*:/, '"$1":');
          tagJson = extractJsonPayload('{' + normKey + '}');
        }
      }
      const kv = (!apiSig && !jsSig) ? clean.match(/^([\w.$\[\]]+)\s*(>=|<=|>|<|==|=)\s*(.+)$/) : null;
      const unquoted = (!clean.includes(':') && ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) && clean.length >= 4)
        ? clean.slice(1, -1).trim()
        : '';
      const compactNoSpace = clean.replace(/\s+/g, '');
      let re = null;
      if (CFG.matchMode === 'regex') {
        try {
          const rm = clean.match(/^\/(.+)\/([gimsuy]*)$/);
          if (rm) {
            let fl = rm[2] || '';
            if (!CFG.caseSensitive && !fl.includes('i')) fl += 'i';
            re = new RegExp(rm[1], fl);
          } else {
            re = new RegExp(p, CFG.caseSensitive ? '' : 'i');
          }
        } catch {}
      }
      entries.push({
        raw: p,
        clean,
        needle: CFG.caseSensitive ? clean : clean.toLowerCase(),
        compactNoSpace: CFG.caseSensitive ? compactNoSpace : compactNoSpace.toLowerCase(),
        unquoted: CFG.caseSensitive ? unquoted : unquoted.toLowerCase(),
        tagJson,
        tagJsonCompact: tagJson ? (CFG.caseSensitive ? tagJson.compact : tagJson.compact.toLowerCase()) : '',
        kv,
        apiSig,
        jsSig,
        re
      });
    }
    cachedTagEntries = entries;
    return entries;
  }

  function matchPayload(rawText) {
    if (!rawText) return null;
    try {
      if (typeof elTags !== 'undefined' && elTags && elTags.value !== CFG.tags) {
        CFG.tags = elTags.value;
      }
    } catch {}
    const entries = getCompiledTags();
    if (!entries.length) return null;

    if (typeof rawText === 'string' && rawText.includes('\x1e')) {
      const parts = rawText.split('\x1e');
      for (let pi = 0; pi < parts.length; pi++) {
        const pt = parts[pi].trim();
        if (pt) {
          const hit = matchSinglePayload(pt, entries);
          if (hit !== null) return hit;
        }
      }
      return null;
    }
    return matchSinglePayload(rawText, entries);
  }

  function matchSinglePayload(rawText, entries) {
    if (!rawText) return null;

    let haystack = null;
    const getHaystack = () => {
      if (haystack === null) haystack = CFG.caseSensitive ? rawText : rawText.toLowerCase();
      return haystack;
    };
    let unescapedHs = null;
    const getUnescapedHs = () => {
      if (unescapedHs === null) {
        const hs = getHaystack();
        unescapedHs = hs.includes('\\"') ? hs.split('\\"').join('"') : '';
      }
      return unescapedHs;
    };
    let rawNoSpace = null;
    const getRawNoSpace = () => {
      if (rawNoSpace === null) rawNoSpace = getHaystack().replace(/\s+/g, '');
      return rawNoSpace;
    };

    if (CFG.matchMode === 'contains') {
      const hsF = getHaystack();
      const uHsF = getUnescapedHs();
      for (let i = 0; i < entries.length; i++) {
        const ent = entries[i];
        if (!ent.kv) {
          if (CFG.caseSensitive ? rawText.includes(ent.clean) : hsF.includes(ent.needle)) {
            return ent.raw;
          }
          if (uHsF && uHsF.includes(ent.needle)) {
            return ent.raw;
          }
          if (ent.unquoted && (hsF.includes(ent.unquoted) || (uHsF && uHsF.includes(ent.unquoted)))) {
            return ent.raw;
          }
          if (!ent.tagJson && ent.compactNoSpace && getRawNoSpace().includes(ent.compactNoSpace)) {
            return ent.raw;
          }
        }
      }
    }

    const mayHaveJson = rawText.includes('{') || rawText.includes('[');
    const needCompact = (CFG.matchMode === 'exact' || CFG.matchMode === 'regex');
    const jsonInfo = mayHaveJson ? extractJsonPayload(rawText, !needCompact) : null;
    let compactPayload = jsonInfo ? jsonInfo.compact : '';
    const getCompactPayload = () => {
      if (!compactPayload && jsonInfo) {
        compactPayload = JSON.stringify(jsonInfo.parsed);
        jsonInfo.compact = compactPayload;
      }
      return compactPayload;
    };
    let compactHaystack = null;
    const getCompactHaystack = () => {
      if (compactHaystack === null) {
        const cp = getCompactPayload();
        compactHaystack = cp ? (CFG.caseSensitive ? cp : cp.toLowerCase()) : '';
      }
      return compactHaystack;
    };

    const isKvWordChar = (ch) => !!ch && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '_');
    const evalKvText = (txt, path, op, expectedRaw) => {
      const pkRaw = path.split('.').pop() || path;
      const pk = CFG.caseSensitive ? pkRaw : pkRaw.toLowerCase();
      const s = String(txt || '');
      const lc = CFG.caseSensitive ? s : s.toLowerCase();
      let idx = lc.indexOf(pk);
      while (idx !== -1) {
        const after = idx + pk.length;
        const beforeCh = idx > 0 ? lc.charAt(idx - 1) : '';
        const c = lc.charAt(after);
        if (!isKvWordChar(beforeCh) && (c === '"' || c === "'" || c === ':' || c === '=' || c === ' ')) {
          const rest = s.slice(after, after + 48);
          let sepI = -1;
          for (let si = 0; si < rest.length; si++) {
            const ch = rest.charAt(si);
            if (ch === ':' || ch === '=') { sepI = si + 1; break; }
            if (ch !== '"' && ch !== "'" && ch !== ' ' && ch !== '\t') break;
          }
          if (sepI !== -1) {
            const valStr = rest.slice(sepI).trim();
            let endI = valStr.length;
            for (let vi = 0; vi < valStr.length; vi++) {
              const vc = valStr.charAt(vi);
              if (vc === ',' || vc === '}' || vc === ']' || vc === ' ' || vc === ';') {
                if (vi > 0) { endI = vi; break; }
              }
            }
            const tok = valStr.slice(0, endI).trim().replace(/^["']|["']$/g, '');
            if (tok) {
              const numVal = parseNumLikeOuter(tok);
              const numExp = parseNumLikeOuter(expectedRaw);
              if (op === '>=' && !Number.isNaN(numVal) && !Number.isNaN(numExp) && numVal >= numExp) return true;
              if (op === '<=' && !Number.isNaN(numVal) && !Number.isNaN(numExp) && numVal <= numExp) return true;
              if (op === '>' && !Number.isNaN(numVal) && !Number.isNaN(numExp) && numVal > numExp) return true;
              if (op === '<' && !Number.isNaN(numVal) && !Number.isNaN(numExp) && numVal < numExp) return true;
              if (op === '=' || op === '==') {
                const cleanExp = expectedRaw.replace(/^["']|["']$/g, '');
                if (CFG.caseSensitive ? tok === cleanExp : tok.toLowerCase() === cleanExp.toLowerCase()) return true;
                if (!Number.isNaN(numVal) && !Number.isNaN(numExp) && numVal === numExp) return true;
              }
            }
          }
        }
        idx = lc.indexOf(pk, idx + 1);
      }
      return false;
    };

    for (let i = 0; i < entries.length; i++) {
      const ent = entries[i];

      if (CFG.matchMode === 'regex') {
        if (ent.re && (ent.re.test(rawText) || (jsonInfo && (ent.re.test(jsonInfo.jsonText) || ent.re.test(getCompactPayload()))))) {
          return ent.raw;
        }
      } else if (CFG.matchMode === 'exact') {
        const h = getHaystack().trim();
        if (rawText.trim() === ent.raw || rawText.trim() === ent.clean || h === ent.needle) return ent.raw;
        if (jsonInfo && (jsonInfo.jsonText === ent.clean || (ent.tagJson && getCompactPayload() === ent.tagJson.compact))) return ent.raw;
        if (ent.unquoted && h === ent.unquoted) return ent.raw;
      } else {
        if (ent.apiSig) {
          const hsApi = getHaystack();
          if (hsApi.includes(ent.apiSig.pathNeedle)) {
            if (ent.apiSig.condKv) {
              const [, aPath, aOp, aExp] = ent.apiSig.condKv;
              let aKvFound = false;
              if (jsonInfo) {
                const aVal = lookupJsonPath(jsonInfo.parsed, aPath);
                if (aVal !== undefined) {
                  aKvFound = true;
                  const nV = parseNumLikeOuter(aVal);
                  const nE = parseNumLikeOuter(aExp);
                  if (aOp === '>=' && !Number.isNaN(nV) && !Number.isNaN(nE) && nV >= nE) return ent.raw;
                  if (aOp === '<=' && !Number.isNaN(nV) && !Number.isNaN(nE) && nV <= nE) return ent.raw;
                  if (aOp === '>' && !Number.isNaN(nV) && !Number.isNaN(nE) && nV > nE) return ent.raw;
                  if (aOp === '<' && !Number.isNaN(nV) && !Number.isNaN(nE) && nV < nE) return ent.raw;
                  if (aOp === '=' || aOp === '==') {
                    const cE = aExp.replace(/^["']|["']$/g, '');
                    if (CFG.caseSensitive ? String(aVal) === cE : String(aVal).toLowerCase() === cE.toLowerCase()) return ent.raw;
                    if (!Number.isNaN(nV) && !Number.isNaN(nE) && nV === nE) return ent.raw;
                  }
                }
              }
              if (!aKvFound && evalKvText(rawText, aPath, aOp, aExp)) return ent.raw;
            } else if (hsApi.includes(ent.apiSig.condNeedle)) {
              return ent.raw;
            }
          }
        }
        if (ent.jsSig) {
          const hsJs = getHaystack();
          if (hsJs.includes(ent.jsSig.evNeedle)) {
            if (ent.jsSig.condKv) {
              const [, jPath, jOp, jExp] = ent.jsSig.condKv;
              let jKvFound = false;
              if (jsonInfo) {
                const jVal = lookupJsonPath(jsonInfo.parsed, jPath);
                if (jVal !== undefined) {
                  jKvFound = true;
                  const njV = parseNumLikeOuter(jVal);
                  const njE = parseNumLikeOuter(jExp);
                  if (jOp === '>=' && !Number.isNaN(njV) && !Number.isNaN(njE) && njV >= njE) return ent.raw;
                  if (jOp === '<=' && !Number.isNaN(njV) && !Number.isNaN(njE) && njV <= njE) return ent.raw;
                  if (jOp === '>' && !Number.isNaN(njV) && !Number.isNaN(njE) && njV > njE) return ent.raw;
                  if (jOp === '<' && !Number.isNaN(njV) && !Number.isNaN(njE) && njV < njE) return ent.raw;
                  if (jOp === '=' || jOp === '==') {
                    const cjE = jExp.replace(/^["']|["']$/g, '');
                    if (CFG.caseSensitive ? String(jVal) === cjE : String(jVal).toLowerCase() === cjE.toLowerCase()) return ent.raw;
                    if (!Number.isNaN(njV) && !Number.isNaN(njE) && njV === njE) return ent.raw;
                  }
                }
              }
              if (!jKvFound && evalKvText(rawText, jPath, jOp, jExp)) return ent.raw;
            } else if (hsJs.includes(ent.jsSig.condNeedle)) {
              return ent.raw;
            }
          }
        }
        if (ent.kv) {
          const [, path, op, expectedRaw] = ent.kv;
          let kvPathFound = false;
          if (jsonInfo) {
            const val = lookupJsonPath(jsonInfo.parsed, path);
            if (val !== undefined) {
              kvPathFound = true;
              const numVal = parseNumLikeOuter(val);
              const numExp = parseNumLikeOuter(expectedRaw);
              if (op === '>=' && !Number.isNaN(numVal) && !Number.isNaN(numExp) && numVal >= numExp) return ent.raw;
              if (op === '<=' && !Number.isNaN(numVal) && !Number.isNaN(numExp) && numVal <= numExp) return ent.raw;
              if (op === '>' && !Number.isNaN(numVal) && !Number.isNaN(numExp) && numVal > numExp) return ent.raw;
              if (op === '<' && !Number.isNaN(numVal) && !Number.isNaN(numExp) && numVal < numExp) return ent.raw;
              if (op === '=' || op === '==') {
                const cleanExp = expectedRaw.replace(/^["']|["']$/g, '');
                if (CFG.caseSensitive ? String(val) === cleanExp : String(val).toLowerCase() === cleanExp.toLowerCase()) return ent.raw;
                if (!Number.isNaN(numVal) && !Number.isNaN(numExp) && numVal === numExp) return ent.raw;
              }
            }
          }
          if (!kvPathFound && evalKvText(rawText, path, op, expectedRaw)) {
            return ent.raw;
          }
        }
        if (jsonInfo && ent.tagJson) {
          if (jsonValuesMatch(jsonInfo.parsed, ent.tagJson.parsed, 0)) return ent.raw;
          continue;
        }
        const h = getHaystack();
        const uH = getUnescapedHs();
        if (CFG.matchMode !== 'json' || !jsonInfo) {
          if (
            h.includes(ent.needle) ||
            (uH && uH.includes(ent.needle)) ||
            (ent.compactNoSpace && getRawNoSpace().includes(ent.compactNoSpace)) ||
            (jsonInfo && (
              getCompactHaystack().includes(ent.needle) ||
              (ent.compactNoSpace && getCompactHaystack().includes(ent.compactNoSpace)) ||
              (ent.tagJsonCompact && getCompactHaystack().includes(ent.tagJsonCompact))
            )) ||
            (ent.unquoted && (h.includes(ent.unquoted) || (uH && uH.includes(ent.unquoted))))
          ) {
            return ent.raw;
          }
        } else if (
          h.includes(ent.needle) ||
          (uH && uH.includes(ent.needle)) ||
          (ent.compactNoSpace && getRawNoSpace().includes(ent.compactNoSpace)) ||
          (jsonInfo && (
            getCompactHaystack().includes(ent.needle) ||
            (ent.compactNoSpace && getCompactHaystack().includes(ent.compactNoSpace)) ||
            (ent.tagJsonCompact && getCompactHaystack().includes(ent.tagJsonCompact))
          ))
        ) {
          return ent.raw;
        }
      }
    }
    return null;
  }

  function srcToDirection(src) {
    const s = String(src || '').toUpperCase();
    if (s === 'WS-OUT' || s === 'API-REQ' || s === 'CLIENT->SERVER') return 'CLIENT->SERVER';
    if (s === 'CLICK' || s === 'SYSTEM') return 'SYSTEM';
    return 'SERVER->CLIENT';
  }

  function tokenizeJsonPathOuter(expr) {
    let s = String(expr || '').trim();
    if (s.startsWith('$')) s = s.slice(1);
    const tokens = [];
    let pos = 0;
    const isIdCh = (cc) => (cc >= 48 && cc <= 57) || (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122) || cc === 95 || cc === 42 || cc === 45;
    while (pos < s.length) {
      if (s[pos] === '.' && s[pos + 1] === '.') {
        pos += 2;
        const st = pos;
        while (pos < s.length && isIdCh(s.charCodeAt(pos))) pos++;
        if (pos === st) return [];
        tokens.push({ kind: 'recursive', key: s.slice(st, pos) });
      } else if (s[pos] === '.') {
        pos += 1;
        const st = pos;
        while (pos < s.length && isIdCh(s.charCodeAt(pos))) pos++;
        if (pos === st) return [];
        const k = s.slice(st, pos);
        tokens.push(k === '*' ? { kind: 'wildcard' } : { kind: 'child', key: k });
      } else if (s[pos] === '[') {
        const endBr = s.indexOf(']', pos + 1);
        if (endBr === -1) return [];
        const inner = s.slice(pos + 1, endBr).trim();
        if (inner === '*') {
          tokens.push({ kind: 'wildcard' });
        } else if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) {
          tokens.push({ kind: 'child', key: inner.slice(1, -1) });
        } else {
          const n = parseInt(inner, 10);
          if (Number.isNaN(n)) return [];
          tokens.push({ kind: 'index', index: n });
        }
        pos = endBr + 1;
      } else {
        return [];
      }
    }
    return tokens;
  }

  function walkJsonPathRecOuter(node, targetKey, out) {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) walkJsonPathRecOuter(node[i], targetKey, out);
    } else if (node !== null && typeof node === 'object') {
      const ks = Object.keys(node);
      for (let i = 0; i < ks.length; i++) {
        const k = ks[i];
        if (targetKey === '*' || k === targetKey) out.push(node[k]);
        walkJsonPathRecOuter(node[k], targetKey, out);
      }
    }
  }

  function evalJsonPathOuter(data, expr) {
    const tokens = tokenizeJsonPathOuter(expr);
    if (!tokens.length && String(expr || '').trim() !== '$') return [];
    let current = [data];
    for (let t = 0; t < tokens.length; t++) {
      const tok = tokens[t];
      const nextVals = [];
      if (tok.kind === 'child') {
        for (let i = 0; i < current.length; i++) {
          const nd = current[i];
          if (nd !== null && typeof nd === 'object' && !Array.isArray(nd) && Object.prototype.hasOwnProperty.call(nd, tok.key)) {
            nextVals.push(nd[tok.key]);
          }
        }
      } else if (tok.kind === 'index') {
        for (let i = 0; i < current.length; i++) {
          const nd = current[i];
          if (Array.isArray(nd)) {
            const idx = tok.index < 0 ? nd.length + tok.index : tok.index;
            if (idx >= 0 && idx < nd.length) nextVals.push(nd[idx]);
          }
        }
      } else if (tok.kind === 'wildcard') {
        for (let i = 0; i < current.length; i++) {
          const nd = current[i];
          if (Array.isArray(nd)) {
            for (let j = 0; j < nd.length; j++) nextVals.push(nd[j]);
          } else if (nd !== null && typeof nd === 'object') {
            const ks = Object.keys(nd);
            for (let j = 0; j < ks.length; j++) nextVals.push(nd[ks[j]]);
          }
        }
      } else if (tok.kind === 'recursive') {
        for (let i = 0; i < current.length; i++) walkJsonPathRecOuter(current[i], tok.key, nextVals);
      }
      current = nextVals;
      if (!current.length) break;
    }
    return current;
  }

  let cachedInspKey = '';
  let cachedInspObj = { enabled: false, kws: [], rxs: [], jps: [] };
  function getCompiledInspector() {
    const k = (CFG.inspectorEnabled ? '1' : '0') + '|' + String(CFG.inspectorKeywords || '') + '|' + String(CFG.inspectorRegexes || '') + '|' + String(CFG.inspectorJsonPaths || '');
    if (k === cachedInspKey) return cachedInspObj;
    cachedInspKey = k;
    const kws = String(CFG.inspectorKeywords || '').split(/[,\n\r]+/).map((s) => s.trim()).filter(Boolean);
    const rxs = [];
    const rxLines = String(CFG.inspectorRegexes || '').split(/[\n\r]+/).map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < rxLines.length; i++) {
      try { rxs.push({ raw: rxLines[i], re: new RegExp(rxLines[i], 'i') }); } catch {}
    }
    const jps = [];
    const jpLines = String(CFG.inspectorJsonPaths || '').split(/[\n\r]+/).map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < jpLines.length; i++) {
      const ln = jpLines[i];
      if (ln.startsWith('{')) {
        try {
          const ob = JSON.parse(ln);
          if (ob && typeof ob.path === 'string' && ob.path.trim()) {
            let jr = null;
            if (typeof ob.regex === 'string' && ob.regex) { try { jr = new RegExp(ob.regex, 'i'); } catch {} }
            jps.push({ path: ob.path.trim(), equals: ob.equals, regex: jr, regexRaw: ob.regex || '' });
          }
        } catch {}
      } else {
        jps.push({ path: ln });
      }
    }
    cachedInspObj = { enabled: Boolean(CFG.inspectorEnabled), kws, rxs, jps };
    return cachedInspObj;
  }

  function inspectTextPayload(rawText) {
    const reasons = [];
    const comp = getCompiledInspector();
    if (!comp.enabled || !rawText) return { matched: false, reasons };
    const info = (rawText.includes('{') || rawText.includes('[')) ? extractJsonPayload(rawText, false) : null;
    const searchable = info ? info.compact : String(rawText);
    const lower = searchable.toLowerCase();
    for (let i = 0; i < comp.kws.length; i++) {
      if (lower.includes(comp.kws[i].toLowerCase())) reasons.push('keyword:' + comp.kws[i]);
    }
    for (let i = 0; i < comp.rxs.length; i++) {
      if (comp.rxs[i].re.test(searchable)) reasons.push('regex:' + comp.rxs[i].raw);
    }
    if (info && info.parsed !== null) {
      for (let i = 0; i < comp.jps.length; i++) {
        const rule = comp.jps[i];
        try {
          const vals = evalJsonPathOuter(info.parsed, rule.path);
          if (rule.equals !== undefined) {
            if (vals.some((v) => v === rule.equals)) reasons.push('jsonpath:' + rule.path + '==' + String(rule.equals));
          } else if (rule.regex) {
            if (vals.some((v) => v !== null && v !== undefined && rule.regex.test(String(v)))) reasons.push('jsonpath:' + rule.path + '~=' + rule.regexRaw);
          } else if (vals.some((v) => v !== null && v !== undefined)) {
            reasons.push('jsonpath:' + rule.path);
          }
        } catch {}
      }
    }
    return { matched: reasons.length > 0, reasons };
  }

  // --- Floating UI Setup (Closed Shadow DOM + Neutral Host ID) ---
  const HUD_HOST_ID = '_ui_' + FRAME_ID;
  const root = document.createElement('div');
  root.id = HUD_HOST_ID;
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;';
  const hudShadow = (root && typeof root.attachShadow === 'function') ? root.attachShadow({ mode: 'closed' }) : null;
  const hudContainer = hudShadow || root;
  function isOwnHudNode(n) {
    if (!n) return false;
    if (n === root || root.contains(n)) return true;
    if (hudShadow && typeof hudShadow.contains === 'function' && hudShadow.contains(n)) return true;
    try { if (hudShadow && typeof n.getRootNode === 'function' && n.getRootNode() === hudShadow) return true; } catch {}
    return false;
  }

  const crosshair = document.createElement('div');
  const half = CFG.size / 2;
  crosshair.style.cssText = [
    'position:fixed',
    'z-index:15',
    'left:' + (targetX - half) + 'px',
    'top:' + (targetY - half) + 'px',
    'width:' + CFG.size + 'px',
    'height:' + CFG.size + 'px',
    'border-radius:9999px',
    'border:2.5px solid #22c55e',
    'background:rgba(16,185,129,0.14)',
    'box-shadow:0 0 0 2px rgba(0,0,0,0.55),0 6px 20px rgba(0,0,0,0.45)',
    'pointer-events:auto',
    'touch-action:none',
    'user-select:none',
    '-webkit-user-select:none',
    '-webkit-touch-callout:none',
    '-webkit-user-drag:none',
    'cursor:grab',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'transition:transform 0.08s ease,border-color 0.12s ease'
  ].join(';');

  function mkEl(tag, css, text) {
    const el = document.createElement(tag);
    if (css) el.style.cssText = css;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  const crossWrap = mkEl('div', 'position:relative;width:100%;height:100%;pointer-events:none;');
  crossWrap.appendChild(mkEl('div', 'position:absolute;left:50%;top:4px;bottom:4px;width:1.5px;background:rgba(255,255,255,0.85);transform:translateX(-50%);'));
  crossWrap.appendChild(mkEl('div', 'position:absolute;top:50%;left:4px;right:4px;height:1.5px;background:rgba(255,255,255,0.85);transform:translateY(-50%);'));
  crossWrap.appendChild(mkEl('div', 'position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:9999px;background:#ef4444;border:1.5px solid #fff;transform:translate(-50%,-50%);'));
  const elCrossLock = mkEl('span', 'display:none;position:absolute;right:-6px;top:-6px;width:16px;height:16px;border-radius:9999px;background:#f59e0b;color:#0b0f17;font-size:10px;line-height:16px;text-align:center;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,0.6);', 'L');
  elCrossLock.id = '__tt_cross_lock';
  crossWrap.appendChild(elCrossLock);
  crosshair.appendChild(crossWrap);

  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed',
    'z-index:20',
    'right:8px',
    'top:6px',
    'width:min(312px, calc(100vw - 16px))',
    'max-height:68vh',
    'display:flex',
    'flex-direction:column',
    'overflow:hidden',
    'background:rgba(11,15,23,0.95)',
    'color:#f1f5f9',
    'border:1px solid rgba(255,255,255,0.15)',
    'border-radius:12px',
    'box-shadow:0 16px 40px rgba(0,0,0,0.65)',
    'pointer-events:auto',
    'user-select:none',
    '-webkit-user-select:none',
    'font-size:12px'
  ].join(';');

  const elHdr = mkEl('div', 'flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);cursor:move;touch-action:none;user-select:none;');
  elHdr.id = '__tt_hdr';
  elHdr.appendChild(mkEl('span', 'font-weight:700;letter-spacing:0.2px;color:#fff;font-size:12px;', 'TriggerTap WS+API'));

  const hdrRight = mkEl('div', 'display:flex;align-items:center;gap:5px;');
  const elPerf = mkEl('span', 'font-family:monospace;font-size:11px;color:#94a3b8;', '0.00ms');
  elPerf.id = '__tt_perf';
  const elExp = mkEl('button', 'background:rgba(255,255,255,0.08);border:none;color:#38bdf8;border-radius:6px;padding:4px 7px;font-size:11px;cursor:pointer;touch-action:manipulation;', T.expand);
  elExp.id = '__tt_exp';
  elExp.type = 'button';
  const elMin = mkEl('button', 'background:rgba(255,255,255,0.08);border:none;color:#e2e8f0;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;touch-action:manipulation;', '—');
  elMin.id = '__tt_min';
  elMin.type = 'button';
  const elClose = mkEl('button', 'background:rgba(239,68,68,0.18);border:none;color:#fca5a5;border-radius:6px;padding:4px 7px;font-size:11px;cursor:pointer;touch-action:manipulation;', '✕');
  elClose.id = '__tt_close';
  elClose.type = 'button';
  elClose.title = 'Close';
  hdrRight.appendChild(elPerf);
  hdrRight.appendChild(elExp);
  hdrRight.appendChild(elMin);
  hdrRight.appendChild(elClose);
  elHdr.appendChild(hdrRight);
  panel.appendChild(elHdr);

  const elBody = mkEl('div', 'padding:9px;display:flex;flex-direction:column;gap:7px;overflow-y:auto;flex:1;min-height:0;');
  elBody.id = '__tt_body';
  elBody.appendChild(mkEl('div', 'flex-shrink:0;font-size:10.5px;color:#94a3b8;line-height:1.35;', T.hint));

  const elTags = mkEl('textarea', 'flex-shrink:0;min-height:46px;width:100%;box-sizing:border-box;background:#0f172a;color:#f8fafc;border:1px solid rgba(255,255,255,0.16);border-radius:8px;padding:6px 8px;font-family:monospace;font-size:12px;resize:vertical;outline:none;user-select:text;-webkit-user-select:text;touch-action:manipulation;');
  elTags.id = '__tt_tags';
  elTags.rows = 2;
  elTags.placeholder = T.tagPlaceholder;
  elBody.appendChild(elTags);

  const elEarlyWarn = mkEl('div', 'flex-shrink:0;display:none;background:rgba(245,158,11,0.16);border:1px solid rgba(245,158,11,0.45);border-radius:7px;padding:4px 7px;font-size:10px;font-weight:700;color:#fde68a;line-height:1.35;', '');
  elEarlyWarn.id = '__tt_early_warn';
  elBody.appendChild(elEarlyWarn);

  const elAutoTuneBar = mkEl('div', 'flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap;background:rgba(16,185,129,0.10);border:1px solid rgba(16,185,129,0.32);border-radius:7px;padding:4px 7px;font-family:monospace;font-size:9.5px;font-weight:700;color:#6ee7b7;line-height:1.35;', '');
  elAutoTuneBar.id = '__tt_auto_tune_bar';
  elBody.appendChild(elAutoTuneBar);

  const elCrashBanner = mkEl('div', 'flex-shrink:0;display:none;background:rgba(225,29,72,0.24);border:1px solid rgba(251,113,133,0.7);border-radius:7px;padding:5px 8px;font-size:11px;font-weight:800;color:#ffe4e6;text-align:center;letter-spacing:0.2px;', '');
  elCrashBanner.id = '__tt_crash_banner';
  elBody.appendChild(elCrashBanner);

  const rowCfg = mkEl('div', 'flex-shrink:0;display:flex;gap:5px;flex-wrap:wrap;');
  const elMode = mkEl('select', 'flex:1;min-width:96px;background:#0f172a;color:#f8fafc;border:1px solid rgba(255,255,255,0.16);border-radius:8px;padding:5px 6px;font-size:11px;');
  elMode.id = '__tt_mode';
  [['contains', 'Contains'], ['exact', 'Exact'], ['json', 'JSON / Key=Val'], ['regex', 'Regex']].forEach(([val, lbl]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    elMode.appendChild(opt);
  });
  const elCd = mkEl('input', 'width:54px;background:#0f172a;color:#f8fafc;border:1px solid rgba(255,255,255,0.16);border-radius:8px;padding:5px 5px;font-family:monospace;font-size:11px;user-select:text;-webkit-user-select:text;');
  elCd.id = '__tt_cd';
  elCd.type = 'number';
  elCd.min = '0';
  elCd.step = '100';
  elCd.title = 'Cooldown ms';
  const elRoundOnce = mkEl('button', 'background:#065f46;color:#ecfdf5;border:1px solid rgba(16,185,129,0.45);border-radius:8px;padding:5px 6px;font-family:monospace;font-size:10.5px;font-weight:700;cursor:pointer;touch-action:manipulation;white-space:nowrap;', T.roundOnceOn);
  elRoundOnce.id = '__tt_round_once';
  elRoundOnce.type = 'button';
  elRoundOnce.title = CFG.lang === 'bn' ? 'প্রতি রাউন্ডে ১ বার অটো-ক্লিক লক (Crash/নতুন রাউন্ডে আনলক)' : 'Max 1 auto-click per round (unlocks on Crash / next round)';
  const elZeroDelay = mkEl('button', 'background:#059669;color:#ffffff;border:1px solid #34d399;border-radius:8px;padding:5px 6px;font-family:monospace;font-size:10.5px;font-weight:700;cursor:pointer;touch-action:manipulation;white-space:nowrap;', '⚡ 0ms');
  elZeroDelay.id = '__tt_zero_delay';
  elZeroDelay.type = 'button';
  elZeroDelay.title = CFG.lang === 'bn'
    ? 'Zero-Delay: ব্রাউজার টাস্ক কিউ বাইপাস করে সরাসরি সিঙ্ক্রোনাস 0ms ফ্রেম এক্সিকিউশন'
    : 'Zero-Delay: Bypass browser task queues for synchronous 0ms earliest-frame click execution';
  const elTapMode = mkEl('button', 'background:#0f172a;color:#cbd5e1;border:1px solid rgba(255,255,255,0.16);border-radius:8px;padding:5px 6px;font-family:monospace;font-size:10.5px;cursor:pointer;touch-action:manipulation;white-space:nowrap;');
  elTapMode.id = '__tt_tap_mode';
  elTapMode.type = 'button';
  elTapMode.title = 'Toggle 0ms Instant vs 35ms Bet-Safe Hold';
  const elJitterBtn = mkEl('button', 'background:#0f172a;color:#cbd5e1;border:1px solid rgba(255,255,255,0.16);border-radius:8px;padding:5px 6px;font-family:monospace;font-size:10.5px;cursor:pointer;touch-action:manipulation;white-space:nowrap;', '🎲 Fixed');
  elJitterBtn.id = '__tt_jitter_btn';
  elJitterBtn.type = 'button';
  elJitterBtn.title = CFG.lang === 'bn'
    ? 'Human-like Jitter: অ্যান্টি-বট বাইপাস করতে বাটনের ভেতরে র‍্যান্ডম পয়েন্টে ক্লিক'
    : 'Human-like Jitter: randomize click coordinates within target element bounds';
  const elFpBtn = mkEl('button', 'background:#0f172a;color:#94a3b8;border:1px solid rgba(255,255,255,0.16);border-radius:8px;padding:5px 6px;font-family:monospace;font-size:10.5px;cursor:pointer;touch-action:manipulation;white-space:nowrap;', '🧬 FP: Static');
  elFpBtn.id = '__tt_fp_btn';
  elFpBtn.type = 'button';
  elFpBtn.title = CFG.lang === 'bn'
    ? 'Fingerprint Shuffle: প্রতিটি ক্লিকের জন্য আলাদা ইউনিক সল্ট দিয়ে pointerId, চাপ ও টাচ রেডিয়াস র‍্যান্ডমাইজ করে'
    : 'Fingerprint Shuffle: generate a unique random salt per click to distinct pointerId, pressure, and touch signature';
  const elGateMode = mkEl('button', 'background:#312e81;color:#e0e7ff;border:1px solid rgba(129,140,248,0.4);border-radius:8px;padding:5px 6px;font-family:monospace;font-size:10.5px;cursor:pointer;touch-action:manipulation;white-space:nowrap;');
  elGateMode.id = '__tt_gate_mode';
  elGateMode.type = 'button';
  elGateMode.title = 'Network TAP (0ms Passive Mirror) / Click-First Gate (Lead+Hold+C250)';
  const elTunerBtn = mkEl('button', 'background:#0f172a;color:#fde68a;border:1px solid rgba(251,191,36,0.35);border-radius:8px;padding:5px 6px;font-size:10.5px;font-weight:600;cursor:pointer;touch-action:manipulation;white-space:nowrap;', T.tunerBtn);
  elTunerBtn.id = '__tt_tuner_btn';
  elTunerBtn.type = 'button';
  const elCrashBtn = mkEl('button', 'background:#881337;color:#ffe4e6;border:1px solid rgba(251,113,133,0.45);border-radius:8px;padding:5px 6px;font-size:10.5px;font-weight:700;cursor:pointer;touch-action:manipulation;white-space:nowrap;', T.crashBuzzerOn);
  elCrashBtn.id = '__tt_crash_btn';
  elCrashBtn.type = 'button';
  elCrashBtn.title = CFG.lang === 'bn' ? 'বাজার Crash করলে সাউন্ড ও ফ্ল্যাশ সংকেত চালু/বন্ধ' : 'Toggle audible & visual buzzer alert on Market Crash';
  rowCfg.appendChild(elMode);
  rowCfg.appendChild(elCd);
  rowCfg.appendChild(elRoundOnce);
  rowCfg.appendChild(elZeroDelay);
  rowCfg.appendChild(elTapMode);
  rowCfg.appendChild(elJitterBtn);
  rowCfg.appendChild(elFpBtn);
  rowCfg.appendChild(elGateMode);
  rowCfg.appendChild(elTunerBtn);
  rowCfg.appendChild(elCrashBtn);
  elBody.appendChild(rowCfg);

  const elZeroTuneRow = mkEl('div', 'flex-shrink:0;display:flex;align-items:center;gap:6px;background:#080c13;border:1px solid rgba(52,211,153,0.28);border-radius:8px;padding:4px 7px;');
  elZeroTuneRow.id = '__tt_zero_tune_row';
  const elZeroTuneLbl = mkEl('span', 'font-size:10px;font-weight:700;color:#6ee7b7;white-space:nowrap;', CFG.lang === 'bn' ? '⚡ মাইক্রো-ডিলে' : '⚡ Fine-Tune');
  const elZeroTuneRange = mkEl('input', 'flex:1;min-width:60px;accent-color:#10b981;cursor:pointer;touch-action:pan-x;margin:0;height:16px;');
  elZeroTuneRange.id = '__tt_zero_tune_range';
  elZeroTuneRange.type = 'range';
  elZeroTuneRange.min = '0';
  elZeroTuneRange.max = '5';
  elZeroTuneRange.step = '0.5';
  const elZeroTuneVal = mkEl('span', 'font-family:monospace;font-size:10.5px;font-weight:700;color:#ecfdf5;background:rgba(16,185,129,0.18);border:1px solid rgba(52,211,153,0.4);border-radius:5px;padding:1px 5px;min-width:42px;text-align:center;white-space:nowrap;', '0.0ms');
  elZeroTuneVal.id = '__tt_zero_tune_val';
  elZeroTuneRow.appendChild(elZeroTuneLbl);
  elZeroTuneRow.appendChild(elZeroTuneRange);
  elZeroTuneRow.appendChild(elZeroTuneVal);
  elBody.appendChild(elZeroTuneRow);

  const rowAct = mkEl('div', 'flex-shrink:0;display:flex;gap:5px;align-items:stretch;');
  const elArm = mkEl('button', 'flex:1;border:none;border-radius:8px;padding:8px 8px;font-weight:700;font-size:12px;cursor:pointer;touch-action:manipulation;');
  elArm.id = '__tt_arm';
  elArm.type = 'button';
  const elLock = mkEl('button', 'background:#1e293b;color:#e2e8f0;border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:8px 8px;font-weight:600;font-size:11px;cursor:pointer;touch-action:manipulation;white-space:nowrap;');
  elLock.id = '__tt_lock';
  elLock.type = 'button';
  const elPickEl = mkEl('button', 'background:#0f172a;color:#6ee7b7;border:1px solid rgba(16,185,129,0.4);border-radius:8px;padding:8px 8px;font-weight:600;font-size:11px;cursor:pointer;touch-action:manipulation;white-space:nowrap;', T.pickBtn);
  elPickEl.id = '__tt_pick_el';
  elPickEl.type = 'button';
  elPickEl.title = CFG.lang === 'bn' ? 'গেমের যেকোনো বাটন ক্লিক করে অটো টেক্সট ও CSS সিলেক্টর সেট করুন' : 'Select Element — click any button on page to auto-populate text & CSS selector';
  const elCenter = mkEl('button', 'background:#1e293b;color:#38bdf8;border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:8px 7px;font-size:12px;cursor:pointer;touch-action:manipulation;', '🎯');
  elCenter.id = '__tt_center';
  elCenter.type = 'button';
  elCenter.title = 'Center Target';
  const elTest = mkEl('button', 'background:#1e293b;color:#e2e8f0;border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:8px 8px;font-size:11px;cursor:pointer;touch-action:manipulation;white-space:nowrap;', T.test);
  elTest.id = '__tt_test';
  elTest.type = 'button';
  rowAct.appendChild(elArm);
  rowAct.appendChild(elLock);
  rowAct.appendChild(elPickEl);
  rowAct.appendChild(elCenter);
  rowAct.appendChild(elTest);
  elBody.appendChild(rowAct);

  // Organized Target Button Text + CSS Selector Pin Card
  const elTargetBox = mkEl('div', 'flex-shrink:0;display:flex;flex-direction:column;gap:4px;background:#080c13;border:1px solid rgba(16,185,129,0.22);border-radius:8px;padding:5px 6px;');
  elTargetBox.id = '__tt_target_box';
  const targetTopHdr = mkEl('div', 'display:flex;align-items:center;justify-content:space-between;gap:4px;');
  targetTopHdr.appendChild(mkEl('span', 'font-size:9.5px;font-weight:700;color:#6ee7b7;', CFG.lang === 'bn' ? '🎯 টার্গেট বাটন পিন (Text / CSS Selector)' : '🎯 Target Pin (Text / CSS Selector)'));
  const elTargetClrBtn = mkEl('button', 'background:transparent;border:none;color:#94a3b8;font-size:9.5px;cursor:pointer;padding:0 4px;touch-action:manipulation;', CFG.lang === 'bn' ? 'মুছুন' : 'Clear');
  elTargetClrBtn.type = 'button';
  targetTopHdr.appendChild(elTargetClrBtn);
  const targetInpGrid = mkEl('div', 'display:grid;grid-template-columns:1fr 1fr;gap:4px;');
  const elTargetTxtInp = mkEl('input', 'width:100%;box-sizing:border-box;background:#0f172a;color:#6ee7b7;border:1px solid rgba(255,255,255,0.14);border-radius:6px;padding:4px 6px;font-family:monospace;font-size:10.5px;outline:none;user-select:text;-webkit-user-select:text;');
  elTargetTxtInp.id = '__tt_target_txt_inp';
  elTargetTxtInp.type = 'text';
  elTargetTxtInp.placeholder = CFG.lang === 'bn' ? 'Button Text (Cash Out)' : 'Button Text (Cash Out)';
  const elTargetSelInp = mkEl('input', 'width:100%;box-sizing:border-box;background:#0f172a;color:#7dd3fc;border:1px solid rgba(255,255,255,0.14);border-radius:6px;padding:4px 6px;font-family:monospace;font-size:10.5px;outline:none;user-select:text;-webkit-user-select:text;');
  elTargetSelInp.id = '__tt_target_sel_inp';
  elTargetSelInp.type = 'text';
  elTargetSelInp.placeholder = 'CSS Selector (#id / .btn)';
  targetInpGrid.appendChild(elTargetTxtInp);
  targetInpGrid.appendChild(elTargetSelInp);
  elTargetBox.appendChild(targetTopHdr);
  elTargetBox.appendChild(targetInpGrid);
  elBody.appendChild(elTargetBox);

  // Collapsible Gate & Inspector Quick-Tuner Drawer
  const elGateTunerBox = mkEl('div', 'flex-shrink:0;display:none;flex-direction:column;gap:5px;background:#080c13;border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:6px 7px;');
  elGateTunerBox.id = '__tt_tuner_box';
  const tunerNums = mkEl('div', 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;');
  const mkNumField = (lbl, id, minV, maxV, stepV) => {
    const w = mkEl('div', 'display:flex;flex-direction:column;gap:2px;');
    w.appendChild(mkEl('span', 'font-size:9.5px;color:#cbd5e1;', lbl));
    const inp = mkEl('input', 'width:100%;box-sizing:border-box;background:#0f172a;color:#fde68a;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:3px 5px;font-family:monospace;font-size:11px;user-select:text;-webkit-user-select:text;');
    inp.id = id;
    inp.type = 'number';
    inp.min = String(minV);
    inp.max = String(maxV);
    inp.step = String(stepV);
    w.appendChild(inp);
    return { w, inp };
  };
  const fLead = mkNumField(T.tunerLead, '__tt_tuner_lead', 0, 100, 1);
  const fHold = mkNumField(T.tunerHold, '__tt_tuner_hold', 0, 250, 5);
  const fInspHold = mkNumField(T.tunerInspHold, '__tt_tuner_insp_hold', 0, 2000, 10);
  const elLeadInp = fLead.inp;
  const elGateHoldInp = fHold.inp;
  const elInspHoldInp = fInspHold.inp;
  tunerNums.appendChild(fLead.w);
  tunerNums.appendChild(fHold.w);
  tunerNums.appendChild(fInspHold.w);
  elGateTunerBox.appendChild(tunerNums);

  const tunerToggles = mkEl('div', 'display:flex;gap:4px;flex-wrap:wrap;');
  const elInspOnBtn = mkEl('button', 'flex:1;min-width:80px;border-radius:6px;padding:4px 5px;font-size:10px;font-weight:600;border:1px solid rgba(255,255,255,0.14);cursor:pointer;touch-action:manipulation;', T.tunerInspOn);
  elInspOnBtn.type = 'button';
  const elInspAutoBtn = mkEl('button', 'flex:1;min-width:105px;border-radius:6px;padding:4px 5px;font-size:10px;font-weight:600;border:1px solid rgba(255,255,255,0.14);cursor:pointer;touch-action:manipulation;', T.tunerAutoClick);
  elInspAutoBtn.type = 'button';
  const elInspAllBtn = mkEl('button', 'flex:1;min-width:85px;border-radius:6px;padding:4px 5px;font-size:10px;font-weight:600;border:1px solid rgba(255,255,255,0.14);cursor:pointer;touch-action:manipulation;', T.tunerHoldAll);
  elInspAllBtn.type = 'button';
  tunerToggles.appendChild(elInspOnBtn);
  tunerToggles.appendChild(elInspAutoBtn);
  tunerToggles.appendChild(elInspAllBtn);
  elGateTunerBox.appendChild(tunerToggles);

  const mkTxtField = (ph, multiLine) => {
    const inp = mkEl(multiLine ? 'textarea' : 'input', 'width:100%;box-sizing:border-box;background:#0f172a;color:#f1f5f9;border:1px solid rgba(255,255,255,0.14);border-radius:6px;padding:3px 6px;font-family:monospace;font-size:10px;user-select:text;-webkit-user-select:text;' + (multiLine ? 'resize:vertical;min-height:34px;line-height:1.3;' : ''));
    if (multiLine) inp.rows = 2;
    else inp.type = 'text';
    inp.placeholder = ph;
    return inp;
  };
  const elInspKw = mkTxtField(T.tunerKw, false);
  const elInspRx = mkTxtField(T.tunerRx, true);
  const elInspJp = mkTxtField(T.tunerJp, true);
  elGateTunerBox.appendChild(elInspKw);
  elGateTunerBox.appendChild(elInspRx);
  elGateTunerBox.appendChild(elInspJp);
  elBody.appendChild(elGateTunerBox);

  const rowStatus = mkEl('div', 'flex-shrink:0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px 6px;font-size:10.5px;color:#94a3b8;padding-top:4px;border-top:1px solid rgba(255,255,255,0.08);');
  const elStatus = mkEl('span', 'flex-shrink:0;white-space:nowrap;color:#cbd5e1;font-weight:600;', 'Hits: 0');
  elStatus.id = '__tt_status';
  const statusRight = mkEl('div', 'display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end;');
  const elRoomBadge = mkEl('span', 'font-family:monospace;font-size:10px;color:#38bdf8;white-space:nowrap;');
  elRoomBadge.id = '__tt_room_badge';
  const elRelayBadge = mkEl('span', 'font-family:monospace;font-size:10px;color:#cbd5e1;white-space:nowrap;');
  elRelayBadge.id = '__tt_relay_badge';
  const elFreeze = mkEl('button', 'background:transparent;border:none;color:#fbbf24;font-size:11px;cursor:pointer;padding:2px 4px;touch-action:manipulation;', T.pauseFeed);
  elFreeze.id = '__tt_freeze';
  elFreeze.type = 'button';
  const elClear = mkEl('button', 'background:transparent;border:none;color:#94a3b8;font-size:11px;cursor:pointer;padding:2px 4px;touch-action:manipulation;', T.clear);
  elClear.id = '__tt_clear';
  elClear.type = 'button';
  const elToggleFeed = mkEl('button', 'background:transparent;border:none;color:#38bdf8;font-size:12px;cursor:pointer;padding:2px 4px;touch-action:manipulation;', '▾');
  elToggleFeed.id = '__tt_toggle_feed';
  elToggleFeed.type = 'button';
  statusRight.appendChild(elRoomBadge);
  statusRight.appendChild(elRelayBadge);
  statusRight.appendChild(elFreeze);
  statusRight.appendChild(elClear);
  statusRight.appendChild(elToggleFeed);
  rowStatus.appendChild(elStatus);
  rowStatus.appendChild(statusRight);
  elBody.appendChild(rowStatus);

  // Metrics Strip (Reaction Speed | Pinned Target | Auto Clicks)
  const elMetricsStrip = mkEl('div', 'flex-shrink:0;display:grid;grid-template-columns:1fr 1.2fr 0.8fr;gap:4px;background:#070a10;border:1px solid rgba(255,255,255,0.09);border-radius:8px;padding:4px 6px;font-size:10px;');
  const mkMet = (lbl, valTxt, valColor) => {
    const box = mkEl('div', 'min-width:0;');
    box.appendChild(mkEl('div', 'font-size:9px;color:#64748b;white-space:nowrap;', lbl));
    const vEl = mkEl('div', 'font-family:monospace;font-weight:700;font-size:11px;color:' + valColor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;', valTxt);
    box.appendChild(vEl);
    return { box, vEl };
  };
  const mSpeed = mkMet(T.metricSpeed, '0.00 ms', '#4ade80');
  const mTarget = mkMet(T.metricTarget, '-', '#f1f5f9');
  const mHits = mkMet(T.metricHits, '0', '#38bdf8');
  const elMetricSpeed = mSpeed.vEl;
  const elMetricTarget = mTarget.vEl;
  const elMetricHits = mHits.vEl;
  elMetricsStrip.appendChild(mSpeed.box);
  elMetricsStrip.appendChild(mTarget.box);
  elMetricsStrip.appendChild(mHits.box);
  elBody.appendChild(elMetricsStrip);

  // Live Latency Gauge Card (10ms-20ms Lead Visualizer)
  const elGaugeBox = mkEl('div', 'flex-shrink:0;background:#070b14;border:1px solid rgba(56,189,248,0.22);border-radius:8px;padding:5px 7px;display:flex;flex-direction:column;gap:5px;');
  elGaugeBox.id = '__tt_gauge_box';
  const elGaugeHdr = mkEl('div', 'display:flex;align-items:center;justify-content:space-between;gap:5px;cursor:pointer;');
  const elGaugeTitle = mkEl('span', 'font-size:10.5px;font-weight:700;color:#e2e8f0;white-space:nowrap;', T.gaugeTitle);
  const elGaugeRight = mkEl('div', 'display:flex;align-items:center;gap:4px;min-width:0;');
  const elGaugeZoneBadge = mkEl('span', 'font-family:monospace;font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:4px;background:rgba(148,163,184,0.14);color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;', T.gaugeStandby);
  const elGaugeToggle = mkEl('button', 'background:rgba(255,255,255,0.08);border:none;color:#cbd5e1;border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;touch-action:manipulation;', showLatencyGauge ? '▾' : '▸');
  elGaugeToggle.type = 'button';
  elGaugeRight.appendChild(elGaugeZoneBadge);
  elGaugeRight.appendChild(elGaugeToggle);
  elGaugeHdr.appendChild(elGaugeTitle);
  elGaugeHdr.appendChild(elGaugeRight);
  elGaugeBox.appendChild(elGaugeHdr);

  const elGaugeBody = mkEl('div', 'display:' + (showLatencyGauge ? 'flex' : 'none') + ';flex-direction:column;gap:5px;');
  const elGaugeGrid = mkEl('div', 'display:grid;grid-template-columns:1fr 1fr;gap:4px;font-family:monospace;');
  const mkGCard = (lbl, initV, col) => {
    const c = mkEl('div', 'background:#0b101b;border:1px solid rgba(255,255,255,0.08);border-radius:5px;padding:3px 5px;');
    c.appendChild(mkEl('div', 'font-size:9px;color:#64748b;', lbl));
    const v = mkEl('div', 'font-size:11px;font-weight:700;color:' + col + ';', initV);
    c.appendChild(v);
    return { c, v };
  };
  const gDt = mkGCard(T.gaugeDtLbl, '0.00 ms', '#cbd5e1');
  const gL10 = mkGCard(T.gaugeLead10Lbl, '+10.00 ms', '#6ee7b7');
  const gL20 = mkGCard(T.gaugeLead20Lbl, '+20.00 ms', '#6ee7b7');
  const gAvg = mkGCard(T.gaugeAvgLbl, '— / —', '#38bdf8');
  const elGaugeDtVal = gDt.v;
  const elGaugeLead10Val = gL10.v;
  const elGaugeLead20Val = gL20.v;
  const elGaugeAvgVal = gAvg.v;
  elGaugeGrid.appendChild(gDt.c);
  elGaugeGrid.appendChild(gL10.c);
  elGaugeGrid.appendChild(gL20.c);
  elGaugeGrid.appendChild(gAvg.c);
  elGaugeBody.appendChild(elGaugeGrid);

  const elGaugeTrackWrap = mkEl('div', 'display:flex;flex-direction:column;gap:2px;');
  const elGaugeTrack = mkEl('div', 'position:relative;height:16px;border-radius:5px;background:#080c13;border:1px solid rgba(255,255,255,0.14);overflow:hidden;');
  elGaugeTrack.appendChild(mkEl('div', 'position:absolute;top:0;bottom:0;left:0;width:40%;background:rgba(16,185,129,0.16);border-right:1px solid rgba(52,211,153,0.4);'));
  elGaugeTrack.appendChild(mkEl('div', 'position:absolute;top:0;bottom:0;left:40%;width:40%;background:rgba(245,158,11,0.16);border-right:1px solid rgba(251,191,36,0.4);'));
  elGaugeTrack.appendChild(mkEl('div', 'position:absolute;top:0;bottom:0;right:0;width:20%;background:rgba(244,63,94,0.16);'));
  const zLbls = mkEl('div', 'position:relative;z-index:2;height:100%;display:grid;grid-template-columns:2fr 2fr 1fr;align-items:center;font-family:monospace;font-size:8.5px;font-weight:700;pointer-events:none;');
  zLbls.appendChild(mkEl('span', 'padding-left:4px;color:#6ee7b7;', T.gaugeFast));
  zLbls.appendChild(mkEl('span', 'text-align:center;color:#fde68a;', T.gaugeBand));
  zLbls.appendChild(mkEl('span', 'padding-right:3px;text-align:right;color:#fda4af;', '>20ms'));
  elGaugeTrack.appendChild(zLbls);
  const elGaugeFill = mkEl('div', 'position:absolute;top:0;bottom:0;left:0;width:0%;background:rgba(16,185,129,0.35);transition:width 0.16s ease;');
  const elGaugeNeedle = mkEl('div', 'display:none;position:absolute;top:0;bottom:0;left:0%;width:2px;margin-left:-1px;z-index:3;background:#4ade80;box-shadow:0 0 6px #4ade80;');
  const elGaugeGateMark = mkEl('div', 'display:none;position:absolute;top:0;bottom:0;left:0%;border-left:1px dashed #7dd3fc;z-index:3;pointer-events:none;');
  elGaugeTrack.appendChild(elGaugeFill);
  elGaugeTrack.appendChild(elGaugeNeedle);
  elGaugeTrack.appendChild(elGaugeGateMark);
  elGaugeTrackWrap.appendChild(elGaugeTrack);

  const elGaugeBottomRow = mkEl('div', 'display:flex;align-items:center;justify-content:space-between;gap:4px;font-family:monospace;font-size:9px;color:#64748b;');
  elGaugeBottomRow.appendChild(mkEl('span', '', '0ms · 10ms · 20ms · 25ms+'));
  const elGaugeBars = mkEl('div', 'display:flex;align-items:flex-end;gap:2px;height:12px;');
  elGaugeBottomRow.appendChild(elGaugeBars);
  elGaugeTrackWrap.appendChild(elGaugeBottomRow);
  elGaugeBody.appendChild(elGaugeTrackWrap);
  elGaugeBox.appendChild(elGaugeBody);
  elBody.appendChild(elGaugeBox);

  const elRaceBox = mkEl('div', 'flex-shrink:0;background:#070a10;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:5px 7px;display:flex;flex-direction:column;gap:4px;');
  elRaceBox.id = '__tt_race_box';
  const elRaceHdr = mkEl('div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;');
  const elRaceVerdict = mkEl('span', 'font-size:10.5px;font-weight:600;color:#94a3b8;line-height:1.3;word-break:break-word;', T.raceWait);
  elRaceVerdict.id = '__tt_race_verdict';
  const elRaceToggle = mkEl('button', 'background:rgba(255,255,255,0.08);border:none;color:#cbd5e1;border-radius:5px;padding:2px 6px;font-size:10px;cursor:pointer;flex-shrink:0;touch-action:manipulation;', T.raceShow);
  elRaceToggle.id = '__tt_race_toggle';
  elRaceToggle.type = 'button';
  elRaceHdr.appendChild(elRaceVerdict);
  elRaceHdr.appendChild(elRaceToggle);
  const elRaceSub = mkEl('div', 'display:none;font-family:monospace;font-size:9.5px;color:#cbd5e1;line-height:1.35;word-break:break-word;');
  elRaceSub.id = '__tt_race_sub';
  const elRaceList = mkEl('div', 'display:none;flex-direction:column;gap:2px;border-top:1px solid rgba(255,255,255,0.08);padding-top:4px;font-family:monospace;font-size:10px;line-height:1.35;max-height:110px;overflow:auto;');
  elRaceList.id = '__tt_race_list';
  elRaceBox.appendChild(elRaceHdr);
  elRaceBox.appendChild(elRaceSub);
  elRaceBox.appendChild(elRaceList);
  elBody.appendChild(elRaceBox);

  const elSecBox = mkEl('div', 'flex-shrink:0;background:#070a10;border:1px solid rgba(16,185,129,0.24);border-radius:8px;padding:5px 7px;display:flex;flex-direction:column;gap:4px;');
  elSecBox.id = '__tt_sec_box';
  const elSecHdr = mkEl('div', 'display:flex;align-items:center;justify-content:space-between;gap:5px;cursor:pointer;');
  const elSecTitle = mkEl('span', 'font-size:10.5px;font-weight:700;color:#6ee7b7;white-space:nowrap;', T.secLogTitle);
  const elSecRight = mkEl('div', 'display:flex;align-items:center;gap:4px;min-width:0;');
  const elSecBadge = mkEl('span', 'font-family:monospace;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:rgba(16,185,129,0.14);color:#6ee7b7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;', T.secLogStandby);
  const elSecClear = mkEl('button', 'background:rgba(255,255,255,0.06);border:none;color:#94a3b8;border-radius:4px;padding:1px 5px;font-size:9.5px;cursor:pointer;flex-shrink:0;touch-action:manipulation;', T.secLogClear);
  elSecClear.id = '__tt_sec_clear';
  elSecClear.type = 'button';
  const elSecToggle = mkEl('button', 'background:rgba(255,255,255,0.08);border:none;color:#cbd5e1;border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;flex-shrink:0;touch-action:manipulation;', showSecurityLog ? '▾' : '▸');
  elSecToggle.id = '__tt_sec_toggle';
  elSecToggle.type = 'button';
  elSecRight.appendChild(elSecBadge);
  elSecRight.appendChild(elSecClear);
  elSecRight.appendChild(elSecToggle);
  elSecHdr.appendChild(elSecTitle);
  elSecHdr.appendChild(elSecRight);
  const elSecVarRow = mkEl('div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;border-top:1px solid rgba(16,185,129,0.14);padding-top:3px;font-family:monospace;font-size:9.5px;');
  elSecVarRow.id = '__tt_sec_variance';
  const elSecVarLeft = mkEl('div', 'display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;');
  const elSecVarLbl = mkEl('span', 'color:#94a3b8;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;', T.secVarLbl + ' (0)');
  const elSecVarStats = mkEl('span', 'color:#cbd5e1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;', 'Δt: — · ±σ: — · Min–Max: —');
  elSecVarStats.id = '__tt_sec_var_stats';
  elSecVarLeft.appendChild(elSecVarLbl);
  elSecVarLeft.appendChild(elSecVarStats);
  const elSecVarBadge = mkEl('span', 'font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:rgba(148,163,184,0.14);color:#94a3b8;white-space:nowrap;flex-shrink:0;', T.secVarStandby);
  elSecVarBadge.id = '__tt_sec_var_badge';
  elSecVarRow.appendChild(elSecVarLeft);
  elSecVarRow.appendChild(elSecVarBadge);
  const elSecList = mkEl('div', 'display:' + (showSecurityLog ? 'flex' : 'none') + ';flex-direction:column;gap:2px;border-top:1px solid rgba(16,185,129,0.16);padding-top:4px;font-family:monospace;font-size:9.5px;line-height:1.35;max-height:92px;overflow:auto;');
  elSecList.id = '__tt_sec_list';
  elSecBox.appendChild(elSecHdr);
  elSecBox.appendChild(elSecVarRow);
  elSecBox.appendChild(elSecList);
  elBody.appendChild(elSecBox);

  const elFeedWrap = mkEl('div', 'flex-shrink:0;display:' + (showLogs ? 'flex' : 'none') + ';flex-direction:column;gap:6px;');
  elFeedWrap.id = '__tt_feed_wrap';
  const tabGrid = mkEl('div', 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;background:#070a10;padding:3px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);');
  const elTabWs = mkEl('button', 'background:#1e293b;color:#4ade80;border:none;border-radius:6px;padding:5px 4px;font-size:10.5px;font-weight:600;cursor:pointer;touch-action:manipulation;white-space:nowrap;', T.tabWs + ' (0)');
  elTabWs.id = '__tt_tab_ws';
  elTabWs.type = 'button';
  const elTabApi = mkEl('button', 'background:transparent;color:#94a3b8;border:none;border-radius:6px;padding:5px 4px;font-size:10.5px;font-weight:600;cursor:pointer;touch-action:manipulation;white-space:nowrap;', T.tabApi + ' (0)');
  elTabApi.id = '__tt_tab_api';
  elTabApi.type = 'button';
  const elTabTags = mkEl('button', 'background:transparent;color:#94a3b8;border:none;border-radius:6px;padding:5px 4px;font-size:10.5px;font-weight:600;cursor:pointer;touch-action:manipulation;white-space:nowrap;', T.tabTags + ' (0)');
  elTabTags.id = '__tt_tab_tags';
  elTabTags.type = 'button';
  tabGrid.appendChild(elTabWs);
  tabGrid.appendChild(elTabApi);
  tabGrid.appendChild(elTabTags);
  const searchBar = mkEl('div', 'display:flex;gap:4px;align-items:center;');
  const elSearch = mkEl('input', 'flex:1;min-width:0;background:#0f172a;color:#f8fafc;border:1px solid rgba(255,255,255,0.14);border-radius:6px;padding:4px 7px;font-family:monospace;font-size:11px;outline:none;user-select:text;-webkit-user-select:text;');
  elSearch.id = '__tt_search';
  elSearch.type = 'text';
  elSearch.placeholder = T.searchPlaceholder;
  const elSearchClear = mkEl('button', 'background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:4px 7px;font-size:10.5px;cursor:pointer;touch-action:manipulation;', '✕');
  elSearchClear.id = '__tt_search_clear';
  elSearchClear.type = 'button';
  elSearchClear.title = 'Clear search';
  const elSrcFilter = mkEl('select', 'background:#0f172a;color:#cbd5e1;border:1px solid rgba(255,255,255,0.14);border-radius:6px;padding:4px 5px;font-size:10.5px;cursor:pointer;');
  elSrcFilter.id = '__tt_src_filter';
  [
    ['all', CFG.lang === 'bn' ? 'সব' : 'All'],
    ['ws', 'WS'],
    ['rtf', 'CSS/JS/DOM/API'],
    ['css', 'CSS'],
    ['js', 'JS'],
    ['sms', 'DOM/SMS'],
    ['api', 'API'],
    ['hit', 'Match'],
    ['triggered', CFG.lang === 'bn' ? 'ট্রিগারড' : 'Triggered']
  ].forEach(([val, lbl]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    elSrcFilter.appendChild(opt);
  });
  const elExportLog = mkEl('button', 'background:#064e3b;color:#6ee7b7;border:1px solid rgba(16,185,129,0.35);border-radius:6px;padding:4px 6px;font-family:monospace;font-size:10px;font-weight:600;cursor:pointer;touch-action:manipulation;white-space:nowrap;', '.log');
  elExportLog.id = '__tt_export_log';
  elExportLog.type = 'button';
  elExportLog.title = CFG.lang === 'bn' ? 'ডাউনলোড intercepted_messages.log' : 'Export .log file';
  searchBar.appendChild(elSearch);
  searchBar.appendChild(elSearchClear);
  searchBar.appendChild(elSrcFilter);
  searchBar.appendChild(elExportLog);
  const elPeek = mkEl('div', 'display:none;margin-bottom:5px;padding:4px 6px;border-radius:6px;background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.4);color:#fde68a;font-family:monospace;font-size:10px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;');
  elPeek.id = '__tt_peek';
  const elLogs = mkEl('div', 'max-height:170px;overflow:auto;background:#070a10;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px;font-family:monospace;font-size:11px;line-height:1.45;');
  elLogs.id = '__tt_logs';
  elFeedWrap.appendChild(tabGrid);
  elFeedWrap.appendChild(searchBar);
  elFeedWrap.appendChild(elPeek);
  elFeedWrap.appendChild(elLogs);
  elBody.appendChild(elFeedWrap);
  panel.appendChild(elBody);

  hudContainer.appendChild(crosshair);
  hudContainer.appendChild(panel);
  if (hudHidden) {
    crosshair.style.display = 'none';
    root.style.display = 'none';
  }
  const mountRootEl = () => {
    const hostNode = document.body || document.documentElement;
    if (hostNode && root.parentNode !== hostNode && !userClosed) {
      try { hostNode.appendChild(root); } catch {}
    }
  };
  if (!hudHidden) {
    if (document.body) {
      mountRootEl();
    } else {
      const tryMountOnReady = () => {
        if (document.body || document.readyState !== 'loading') {
          mountRootEl();
          if (document.body) document.removeEventListener('readystatechange', tryMountOnReady);
        }
      };
      document.addEventListener('readystatechange', tryMountOnReady);
      document.addEventListener('DOMContentLoaded', mountRootEl, { once: true });
      window.addEventListener('DOMContentLoaded', mountRootEl, { once: true });
      window.addEventListener('load', mountRootEl, { once: true });
      setTimeout(() => { if (!hudHidden && !root.parentNode) mountRootEl(); }, 280);
    }
  }

  try {
    const savedPanelPos = JSON.parse(localStorage.getItem('__tt_panel_pos') || 'null');
    if (savedPanelPos && typeof savedPanelPos.left === 'number' && typeof savedPanelPos.top === 'number') {
      const pVw = window.innerWidth || 360;
      const pVh = window.innerHeight || 640;
      if (pVw >= 160 && pVh >= 160) {
        panel.style.right = 'auto';
        panel.style.left = Math.max(4, Math.min(pVw - 120, Math.round(savedPanelPos.left))) + 'px';
        panel.style.top = Math.max(4, Math.min(pVh - 44, Math.round(savedPanelPos.top))) + 'px';
      }
    }
  } catch {}
  elTags.value = CFG.tags;
  elMode.value = CFG.matchMode;
  elCd.value = String(CFG.cooldownMs);
  if (elRoomBadge) elRoomBadge.textContent = CFG.relayEnabled ? ('R:' + CFG.roomId) : '';

  function unlockCrashAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!crashAudioCtx) crashAudioCtx = new AC();
      if (crashAudioCtx.state === 'suspended' && typeof crashAudioCtx.resume === 'function') {
        crashAudioCtx.resume().catch(() => {});
      }
      return crashAudioCtx;
    } catch { return null; }
  }

  function playCrashBuzzerTone() {
    try {
      const ctx = unlockCrashAudio();
      if (!ctx) return;
      const now = ctx.currentTime || 0;
      const playBeep = (freq, startOff, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + startOff);
        gain.gain.setValueAtTime(0.001, now + startOff);
        gain.gain.linearRampToValueAtTime(0.16, now + startOff + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOff + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOff);
        osc.stop(now + startOff + dur + 0.02);
      };
      playBeep(720, 0, 0.11);
      playBeep(460, 0.13, 0.15);
    } catch {}
  }

  function maybeTriggerCrashSignal(src, rawText, pktAnOpt) {
    try {
      if (!rawText) return;
      const isLiveIn = (src === 'WS-IN' || src === 'SSE' || src === 'WORKER' || src === 'API-RES' || src === 'TAP-RES' || src === 'TAP-RTC' || src === 'TAP-WT' || src === 'TAP-PM');
      if (!isLiveIn) return;
      const an = pktAnOpt || analyzeGamePacket(src, rawText);
      const rc = (!an.hasJson && !an.hasXml && !an.isCrash && !an.isStart && !an.inFlight) ? classifyRaceKind(src, rawText) : '';
      const isCrashNow = Boolean(an.isCrash || rc === 'CRASH');
      const isFreshNow = Boolean(an.isStart || an.inFlight || rc === 'START');
      const ridNow = String(an.roundId || '');
      if (ridNow && crashAlertLastRoundId && ridNow !== crashAlertLastRoundId) {
        crashAlertSentForRound = false;
      }
      if (!isCrashNow && isFreshNow) {
        crashAlertSentForRound = false;
        if (ridNow) crashAlertLastRoundId = ridNow;
        return;
      }
      if (!isCrashNow) return;
      const nowA = Date.now();
      if (crashAlertSentForRound && (!ridNow || ridNow === crashAlertLastRoundId)) return;
      if (nowA - lastCrashAlertAt < 900) return;
      crashAlertSentForRound = true;
      lastCrashAlertAt = nowA;
      if (ridNow) crashAlertLastRoundId = ridNow;
      if (!CFG.crashBuzzer || hudHidden) return;
      if (elCrashBanner) {
        elCrashBanner.textContent = T.crashBannerText.replace('{time}', fmtTimeMs(new Date()));
        elCrashBanner.style.display = 'block';
      }
      if (panel) {
        panel.style.borderColor = '#f43f5e';
        panel.style.boxShadow = '0 0 22px rgba(244,63,94,0.45)';
      }
      if (elPeek) {
        elPeek.textContent = '🚨 CRASH SIGNAL · ' + String(rawText).replace(/\s+/g, ' ').slice(0, 105);
        elPeek.style.display = 'block';
        elPeek.style.background = 'rgba(225,29,72,0.22)';
        elPeek.style.borderColor = 'rgba(251,113,133,0.65)';
        elPeek.style.color = '#ffe4e6';
      }
      if (crashAlertBannerTimer) clearTimeout(crashAlertBannerTimer);
      crashAlertBannerTimer = setTimeout(() => {
        crashAlertBannerTimer = null;
        if (elCrashBanner) elCrashBanner.style.display = 'none';
        if (panel) {
          panel.style.borderColor = 'rgba(255,255,255,0.15)';
          panel.style.boxShadow = '0 16px 40px rgba(0,0,0,0.65)';
        }
      }, 2500);
      playCrashBuzzerTone();
    } catch {}
  }

  function bindTap(el, fn) {
    if (!el) return;
    el.style.touchAction = 'manipulation';
    el.style.webkitTapHighlightColor = 'transparent';
    let lastFireAt = 0;
    let lastPointerUpAt = 0;
    let lastCancelAt = 0;
    let sx = 0, sy = 0, tracking = false;
    const fireOnce = () => {
      const now = Date.now();
      if (now - lastFireAt < 380) return;
      lastFireAt = now;
      if (CFG.crashBuzzer) unlockCrashAudio();
      fn();
    };
    const onDown = (e) => {
      e.stopPropagation();
      const pt = (e.touches && e.touches[0]) ? e.touches[0] : e;
      sx = pt.clientX || 0;
      sy = pt.clientY || 0;
      tracking = true;
    };
    const onUp = (e) => {
      e.stopPropagation();
      if (!tracking) return;
      tracking = false;
      const pt = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
      const dx = Math.abs((pt.clientX || 0) - sx);
      const dy = Math.abs((pt.clientY || 0) - sy);
      if (dx < 14 && dy < 14) {
        lastPointerUpAt = Date.now();
        if (e.cancelable) e.preventDefault();
        fireOnce();
      } else {
        lastCancelAt = Date.now();
      }
    };
    if (window.PointerEvent) {
      el.addEventListener('pointerdown', onDown, true);
      el.addEventListener('pointerup', onUp, true);
      el.addEventListener('pointercancel', () => { tracking = false; lastCancelAt = Date.now(); }, true);
    } else {
      el.addEventListener('touchstart', onDown, { capture: true, passive: true });
      el.addEventListener('touchend', onUp, { capture: true, passive: false });
      el.addEventListener('mousedown', onDown, true);
    }
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const now = Date.now();
      if (now - lastPointerUpAt < 1000 || now - lastCancelAt < 650) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      fireOnce();
    }, true);
  }

  function updateSyncDot() {
    if (!elRelayBadge) return;
    if (!CFG.relayEnabled) {
      elRelayBadge.textContent = '';
      return;
    }
    if (childSourceWin) {
      try {
        childSourceWin.postMessage({
          __TT_SNIFFER__: true,
          kind: 'RELAY_STATUS',
          wss: wssSyncState,
          http: httpSyncState,
          httpOrigin: getHttpOriginLabel()
        }, '*');
      } catch {}
    }
    if (isIframe && !iframeFallbackActive) {
      if (topAcked) {
        const wDot = topReportedWss === 'OK' ? '🟢' : topReportedWss === 'ERR' ? '🔴' : '🟡';
        const hDot = topReportedHttp === 'OK'
          ? ('🟢(' + (topReportedOrigin || 'ok') + ')')
          : topReportedHttp === 'AUTH_BLOCKED'
          ? '🔒'
          : '🟡';
        elRelayBadge.textContent = 'WSS:' + wDot + ' HTTP:' + hDot;
      } else {
        elRelayBadge.textContent = 'Top↗';
      }
      return;
    }
    const wDot = wssSyncState === 'OK' ? '🟢' : wssSyncState === 'ERR' ? '🔴' : '🟡';
    const hDot = httpSyncState === 'OK'
      ? ('🟢(' + getHttpOriginLabel() + ')')
      : httpSyncState === 'AUTH_BLOCKED'
      ? '🔒'
      : '🟡';
    elRelayBadge.textContent = 'WSS:' + wDot + ' HTTP:' + hDot;
  }

  function syncUI() {
    const hkSuffix = CFG.enableHotkey && CFG.hotkeyCode ? ' [' + CFG.hotkeyCode.replace(/^Key/, '') + ']' : '';
    elArm.textContent = (CFG.armed ? T.armed : T.paused) + hkSuffix;
    elArm.style.background = CFG.armed ? '#16a34a' : '#334155';
    elArm.style.color = '#ffffff';
    elLock.textContent = locked ? T.unlock : T.lock;
    elLock.style.background = locked ? '#d97706' : '#1e293b';
    elLock.style.color = locked ? '#ffffff' : '#e2e8f0';
    elLock.style.borderColor = locked ? '#f59e0b' : 'rgba(255,255,255,0.14)';
    if (elPickEl) {
      elPickEl.textContent = elementPickMode ? T.pickActive : T.pickBtn;
      elPickEl.style.background = elementPickMode ? '#059669' : '#0f172a';
      elPickEl.style.color = elementPickMode ? '#ffffff' : '#6ee7b7';
      elPickEl.style.borderColor = elementPickMode ? '#34d399' : 'rgba(16,185,129,0.4)';
    }
    elFreeze.textContent = feedFrozen ? T.resumeFeed : T.pauseFeed;
    elFreeze.style.background = feedFrozen ? '#b45309' : 'transparent';
    elFreeze.style.color = feedFrozen ? '#ffffff' : '#fbbf24';
    elFreeze.style.borderRadius = '5px';
    elFreeze.style.padding = feedFrozen ? '2px 6px' : '2px 4px';
    elExp.textContent = expandedView ? T.collapse : T.expand;
    elToggleFeed.textContent = showLogs ? '▾' : '▸';
    elFeedWrap.style.display = showLogs ? 'flex' : 'none';
    elTabWs.style.background = activeTab === 'ws' ? '#1e293b' : 'transparent';
    elTabWs.style.color = activeTab === 'ws' ? '#4ade80' : '#94a3b8';
    elTabApi.style.background = activeTab === 'api' ? '#1e293b' : 'transparent';
    elTabApi.style.color = activeTab === 'api' ? '#38bdf8' : '#94a3b8';
    if (elTabTags) {
      elTabTags.style.background = activeTab === 'tags' ? '#1e293b' : 'transparent';
      elTabTags.style.color = activeTab === 'tags' ? '#fbbf24' : '#94a3b8';
    }
    panel.style.width = expandedView ? 'min(540px, calc(100vw - 16px))' : 'min(312px, calc(100vw - 16px))';
    panel.style.maxHeight = expandedView ? '84vh' : '62vh';
    elLogs.style.maxHeight = expandedView ? '52vh' : '170px';
    if (!hudHidden && !userClosed) {
      root.style.display = 'block';
      crosshair.style.display = 'flex';
    }
    crosshair.style.pointerEvents = locked ? 'none' : 'auto';
    crosshair.style.touchAction = locked ? 'auto' : 'none';
    crosshair.style.borderColor = locked ? '#f59e0b' : (CFG.armed ? '#22c55e' : '#94a3b8');
    crosshair.style.background = locked
      ? 'rgba(245,158,11,0.14)'
      : (CFG.armed ? 'rgba(16,185,129,0.14)' : 'rgba(148,163,184,0.14)');
    crosshair.style.cursor = locked ? 'default' : 'grab';
    if (elCrossLock) elCrossLock.style.display = locked ? 'block' : 'none';
    if (elRoundOnce) {
      elRoundOnce.textContent = CFG.roundOnce ? (T.roundOnceOn + (roundClickLocked ? ' 🔒' : '')) : T.roundOnceOff;
      elRoundOnce.style.background = CFG.roundOnce ? (roundClickLocked ? '#92400e' : '#065f46') : '#0f172a';
      elRoundOnce.style.color = CFG.roundOnce ? (roundClickLocked ? '#fef3c7' : '#ecfdf5') : '#94a3b8';
      elRoundOnce.style.borderColor = CFG.roundOnce ? (roundClickLocked ? '#f59e0b' : '#10b981') : 'rgba(255,255,255,0.16)';
    }
    if (elZeroDelay) {
      const mMs = Math.max(0, Math.min(5, Math.round((Number(CFG.zeroDelayMicroMs) || 0) * 2) / 2));
      elZeroDelay.textContent = CFG.zeroDelay ? ('⚡ ' + (mMs > 0 ? mMs.toFixed(1) : '0') + 'ms') : '⚡ Delay';
      elZeroDelay.style.background = CFG.zeroDelay ? '#059669' : '#0f172a';
      elZeroDelay.style.color = CFG.zeroDelay ? '#ffffff' : '#94a3b8';
      elZeroDelay.style.borderColor = CFG.zeroDelay ? '#34d399' : 'rgba(255,255,255,0.16)';
    }
    if (elZeroTuneRow) {
      elZeroTuneRow.style.display = CFG.zeroDelay ? 'flex' : 'none';
    }
    if (elZeroTuneRange && document.activeElement !== elZeroTuneRange) {
      elZeroTuneRange.value = String(Math.max(0, Math.min(5, Math.round((Number(CFG.zeroDelayMicroMs) || 0) * 2) / 2)));
    }
    if (elZeroTuneVal) {
      const mVal = Math.max(0, Math.min(5, Math.round((Number(CFG.zeroDelayMicroMs) || 0) * 2) / 2));
      elZeroTuneVal.textContent = mVal.toFixed(1) + 'ms';
      elZeroTuneVal.style.color = mVal > 0 ? '#fde68a' : '#ecfdf5';
      elZeroTuneVal.style.borderColor = mVal > 0 ? 'rgba(251,191,36,0.45)' : 'rgba(52,211,153,0.4)';
    }
    if (elTapMode) {
      const safeTapActive = Boolean(CFG.humanTap && !CFG.zeroDelay);
      elTapMode.textContent = safeTapActive ? '35ms' : '0ms';
      elTapMode.style.background = safeTapActive ? '#0369a1' : '#0f172a';
      elTapMode.style.color = safeTapActive ? '#ffffff' : '#cbd5e1';
      elTapMode.style.borderColor = safeTapActive ? '#38bdf8' : 'rgba(255,255,255,0.16)';
    }
    if (elJitterBtn) {
      const jitterActive = Boolean(CFG.humanJitter);
      elJitterBtn.textContent = jitterActive ? '🎲 Jitter' : '🎲 Fixed';
      elJitterBtn.style.background = jitterActive ? '#7c3aed' : '#0f172a';
      elJitterBtn.style.color = jitterActive ? '#ffffff' : '#94a3b8';
      elJitterBtn.style.borderColor = jitterActive ? '#a78bfa' : 'rgba(255,255,255,0.16)';
    }
    if (elFpBtn) {
      const fpActive = Boolean(CFG.fingerprintShuffle);
      elFpBtn.textContent = fpActive ? '🧬 FP: Shuffle' : '🧬 FP: Static';
      elFpBtn.style.background = fpActive ? '#0e7490' : '#0f172a';
      elFpBtn.style.color = fpActive ? '#ffffff' : '#94a3b8';
      elFpBtn.style.borderColor = fpActive ? '#22d3ee' : 'rgba(255,255,255,0.16)';
    }
    if (elGateMode) {
      elGateMode.textContent = CFG.preClickGate
        ? ((CFG.networkTap ? 'TAP+' : '') + 'Lead ' + CFG.wsLeadMs + '+G' + CFG.gateHoldMs + '·C45')
        : (CFG.networkTap ? 'TAP 0ms' : 'Gate OFF');
      elGateMode.style.background = CFG.preClickGate ? '#4f46e5' : (CFG.networkTap ? '#065f46' : '#0f172a');
      elGateMode.style.color = (CFG.preClickGate || CFG.networkTap) ? '#ffffff' : '#94a3b8';
      elGateMode.style.borderColor = CFG.preClickGate ? '#818cf8' : (CFG.networkTap ? '#10b981' : 'rgba(255,255,255,0.16)');
    }
    if (elTunerBtn) {
      elTunerBtn.style.background = showGateTuner ? '#92400e' : '#0f172a';
      elTunerBtn.style.color = showGateTuner ? '#ffffff' : '#fde68a';
      elTunerBtn.style.borderColor = showGateTuner ? '#fbbf24' : 'rgba(251,191,36,0.35)';
    }
    if (elCrashBtn) {
      elCrashBtn.textContent = CFG.crashBuzzer ? T.crashBuzzerOn : T.crashBuzzerOff;
      elCrashBtn.style.background = CFG.crashBuzzer ? '#881337' : '#0f172a';
      elCrashBtn.style.color = CFG.crashBuzzer ? '#ffe4e6' : '#94a3b8';
      elCrashBtn.style.borderColor = CFG.crashBuzzer ? '#fb7185' : 'rgba(255,255,255,0.16)';
    }
    if (elGateTunerBox) {
      elGateTunerBox.style.display = showGateTuner ? 'flex' : 'none';
    }
    if (elTargetTxtInp && document.activeElement !== elTargetTxtInp) elTargetTxtInp.value = String(CFG.targetText || (anchor && anchor.text) || '');
    if (elTargetSelInp && document.activeElement !== elTargetSelInp) elTargetSelInp.value = String(CFG.targetSelector || (anchor && anchor.selector) || '');
    if (elLeadInp && document.activeElement !== elLeadInp) elLeadInp.value = String(CFG.wsLeadMs || 0);
    if (elGateHoldInp && document.activeElement !== elGateHoldInp) elGateHoldInp.value = String(CFG.gateHoldMs || 0);
    if (elInspHoldInp && document.activeElement !== elInspHoldInp) elInspHoldInp.value = String(CFG.inspectorHoldMs || 0);
    if (elInspKw && document.activeElement !== elInspKw) elInspKw.value = String(CFG.inspectorKeywords || '');
    if (elInspRx && document.activeElement !== elInspRx) elInspRx.value = String(CFG.inspectorRegexes || '');
    if (elInspJp && document.activeElement !== elInspJp) elInspJp.value = String(CFG.inspectorJsonPaths || '');
    if (elInspOnBtn) {
      elInspOnBtn.style.background = CFG.inspectorEnabled ? '#b45309' : '#0f172a';
      elInspOnBtn.style.color = CFG.inspectorEnabled ? '#ffffff' : '#94a3b8';
    }
    if (elInspAutoBtn) {
      elInspAutoBtn.style.background = CFG.inspectorAutoClick ? '#065f46' : '#0f172a';
      elInspAutoBtn.style.color = CFG.inspectorAutoClick ? '#6ee7b7' : '#94a3b8';
    }
    if (elInspAllBtn) {
      elInspAllBtn.style.background = CFG.inspectorHoldAllWs ? '#4f46e5' : '#0f172a';
      elInspAllBtn.style.color = CFG.inspectorHoldAllWs ? '#e0e7ff' : '#94a3b8';
    }
    if (elGaugeGrid) {
      elGaugeGrid.style.gridTemplateColumns = expandedView ? 'repeat(4,1fr)' : '1fr 1fr';
    }
    const activeTagsCount = parseTagList((elTags && elTags.value) || CFG.tags || '').length;
    const readyLbl = CFG.armed
      ? (activeTagsCount > 0
          ? (' 🎯 ' + activeTagsCount + (CFG.lang === 'bn' ? ' ট্যাগ চালু' : ' tag(s) ON'))
          : (CFG.lang === 'bn' ? ' ⚠ ট্যাগ খালি' : ' ⚠ No tags'))
      : (activeTagsCount > 0
          ? (' ' + activeTagsCount + (CFG.lang === 'bn' ? ' ট্যাগ প্রস্তুত' : ' tag(s) ready'))
          : '');
    elStatus.textContent = 'Hits: ' + triggerCount + (lastHitTag ? (' · ' + lastHitTag) : (lastMatchPreview ? (' · Match✓ ' + lastMatchPreview) : (readyLbl ? (' ·' + readyLbl) : '')));
    updateEarlyTagWarning();
    updateAutoTuneBar();
    updateLatencyGaugeUI();
    updateSyncDot();
    syncTurboCfg(false, !hudHidden && userTouchedHud);
  }

  function computeServerAcceptanceProfile() {
    const measuredRtt = rollingServerRttMs > 0 ? Math.round(rollingServerRttMs) : 0;
    const lastAck = lastServerAcceptMs > 0 ? Math.round(lastServerAcceptMs) : 0;
    const reqAcceptMs = measuredRtt > 0 ? Math.min(900, Math.max(85, Math.round(measuredRtt * 1.35 + 20))) : 120;
    const optLeadMs = measuredRtt > 0 ? Math.min(45, Math.max(8, Math.round(measuredRtt * 0.22))) : 10;
    const optGateMs = measuredRtt > 0 ? Math.min(120, Math.max(20, Math.round(measuredRtt * 0.45))) : 28;
    const optInspMs = measuredRtt > 0 ? Math.min(140, Math.max(24, Math.round(measuredRtt * 0.50))) : 30;
    const optCdMs = measuredRtt > 0 ? Math.min(1200, Math.max(450, Math.round(measuredRtt * 3 + 350))) : 650;
    return { measuredRtt, lastAck, reqAcceptMs, optLeadMs, optGateMs, optInspMs, optCdMs };
  }

  function applyAutoTagConfig(reason) {
    const prof = computeServerAcceptanceProfile();
    const rawTags = String((elTags && elTags.value) || CFG.tags || '').trim();
    const parsedTags = parseTagList(rawTags);
    const hasTags = parsedTags.length > 0 && rawTags.length >= 2;
    if (reason === 'TAG_SET' || reason === 'AUTO_VERIFIED') {
      CFG.zeroDelay = true;
      CFG.zeroDelayMicroMs = 0;
      CFG.humanTap = false;
      CFG.humanJitter = false;
      CFG.roundOnce = true;
      CFG.directWsCashout = true;
      CFG.opClickMode = true;
      CFG.netLagAutoShift = true;
      CFG.asyncWorker = true;
      CFG.preClickGate = true;
      if (hasTags && parsedTags.length === 1 && /^\/.+\/[a-z]*$/i.test(parsedTags[0])) {
        CFG.matchMode = 'regex';
      } else if (hasTags && parsedTags.some((pt) => /^api:|^js:CustomEvent\(/i.test(pt))) {
        CFG.matchMode = 'contains';
      } else if (CFG.matchMode === 'exact' && hasTags) {
        CFG.matchMode = 'contains';
      }
      if (hasTags) {
        CFG.armed = true;
      } else {
        CFG.armed = false;
      }
    }
    if (CFG.netLagAutoShift !== false || reason === 'TAG_SET' || reason === 'AUTO_VERIFIED') {
      CFG.wsLeadMs = prof.optLeadMs;
      CFG.gateHoldMs = prof.optGateMs;
      CFG.inspectorHoldMs = prof.optInspMs;
      CFG.cooldownMs = prof.optCdMs;
    }
    if (typeof elZeroTuneRange !== 'undefined' && elZeroTuneRange) elZeroTuneRange.value = String(CFG.zeroDelayMicroMs || 0);
    if (typeof elLeadInp !== 'undefined' && elLeadInp) elLeadInp.value = String(CFG.wsLeadMs || 0);
    if (typeof elGateHoldInp !== 'undefined' && elGateHoldInp) elGateHoldInp.value = String(CFG.gateHoldMs || 0);
    if (typeof elInspHoldInp !== 'undefined' && elInspHoldInp) elInspHoldInp.value = String(CFG.inspectorHoldMs || 0);
    if (typeof elCd !== 'undefined' && elCd) elCd.value = String(CFG.cooldownMs || 0);
    if (typeof elMode !== 'undefined' && elMode) elMode.value = String(CFG.matchMode || 'contains');
    updateAutoTuneBar();
    return prof;
  }

  function updateAutoTuneBar() {
    if (!elAutoTuneBar) return;
    const prof = computeServerAcceptanceProfile();
    const configured = parseTagList((elTags && elTags.value) || CFG.tags || '');
    const primary = configured[0] || '';
    const ent = primary ? liveTagMap.get(primary) : null;
    const srvTxt = prof.measuredRtt > 0
      ? (CFG.lang === 'bn' ? ('সারভার একসেপ্ট: ~' + prof.measuredRtt + 'ms (নিরাপদ ≥' + prof.reqAcceptMs + 'ms)') : ('Server Accept: ~' + prof.measuredRtt + 'ms (need ≥' + prof.reqAcceptMs + 'ms)'))
      : (CFG.lang === 'bn' ? ('সারভার একসেপ্ট: ~' + prof.reqAcceptMs + 'ms প্রাক-সেট (লাইভ মাপ চলছে)') : ('Server Accept: ~' + prof.reqAcceptMs + 'ms preset (calibrating)'));
    let tagLeadTxt = CFG.zeroDelay ? '⚡0.0ms ক্লিক' : 'Delay ক্লিক';
    let isTight = false;
    if (ent && ent.minDeltaMs != null) {
      if (ent.minDeltaMs < prof.reqAcceptMs) {
        isTight = true;
        tagLeadTxt = (CFG.lang === 'bn' ? ('⚠ ট্যাগ ' + ent.minDeltaMs + 'ms আগে (< ' + prof.reqAcceptMs + 'ms)') : ('⚠ Lead ' + ent.minDeltaMs + 'ms < ' + prof.reqAcceptMs + 'ms'));
      } else {
        tagLeadTxt = (CFG.lang === 'bn' ? ('✓ ট্যাগ ' + ent.minDeltaMs + 'ms আগে (সেফ)') : ('✓ Lead ' + ent.minDeltaMs + 'ms (Safe)'));
      }
    } else if (configured.length) {
      tagLeadTxt = '⚡0.0ms · L' + CFG.wsLeadMs + '/G' + CFG.gateHoldMs + 'ms';
    }
    elAutoTuneBar.style.borderColor = isTight ? 'rgba(245,158,11,0.55)' : 'rgba(16,185,129,0.32)';
    elAutoTuneBar.style.background = isTight ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.10)';
    elAutoTuneBar.style.color = isTight ? '#fde68a' : '#6ee7b7';
    elAutoTuneBar.textContent = srvTxt + '  |  ' + tagLeadTxt;
  }

  function updateEarlyTagWarning() {
    if (!elEarlyWarn) return;
    const configured = parseTagList((elTags && elTags.value) || CFG.tags || '');
    let warnText = '';
    for (let i = 0; i < configured.length; i++) {
      const t = configured[i];
      const ent = liveTagMap.get(t);
      if (isPostCrashTagPattern(t) || isCrashLikeTagText(t) || (ent && ent.isCrashTag)) {
        warnText = T.postResultConfiguredWarn.replace('{tag}', t);
        break;
      }
      if (isWaitingOrBetPhaseTag(t, ent ? ent.src : '') || (ent && ent.isNonCashoutPhase)) {
        warnText = T.waitPhaseConfiguredWarn.replace('{tag}', t);
        break;
      }
      if (ent && (ent.isEarlyOrContinuous || (ent.maxRoundTicks && ent.maxRoundTicks > 1) || (ent.avgRoundTicks && ent.avgRoundTicks > 1))) {
        warnText = T.earlyConfiguredWarn.replace('{tag}', t);
        break;
      }
    }
    if (warnText) {
      elEarlyWarn.textContent = warnText;
      elEarlyWarn.style.display = 'block';
    } else {
      elEarlyWarn.style.display = 'none';
    }
  }

  function updateLatencyGaugeUI() {
    if (elMetricSpeed) elMetricSpeed.textContent = (lastReactionMsStr || '0.00') + ' ms';
    if (elMetricTarget) {
      const pTxt = CFG.targetText || (anchor && anchor.text) || (anchor && anchor.selector) || CFG.targetSelector || (Math.round(targetX) + ',' + Math.round(targetY));
      elMetricTarget.textContent = String(pTxt).slice(0, 22);
    }
    if (elMetricHits) elMetricHits.textContent = String(triggerCount);
    if (!elGaugeBox || !elGaugeZoneBadge) return;
    elGaugeBody.style.display = showLatencyGauge ? 'flex' : 'none';
    elGaugeToggle.textContent = showLatencyGauge ? '▾' : '▸';
    const latest = latencySamples.length ? latencySamples[0] : null;
    const gateWinMs = Math.max(
      CFG.preClickGate ? (Number(CFG.wsLeadMs) || 0) : 0,
      CFG.preClickGate ? (Number(CFG.gateHoldMs) || 0) : 0,
      CFG.inspectorEnabled ? (Number(CFG.inspectorHoldMs) || 0) : 0
    );
    if (elGaugeGateMark) {
      if (gateWinMs > 0 && gateWinMs <= 25) {
        elGaugeGateMark.style.display = 'block';
        elGaugeGateMark.style.left = ((gateWinMs / 25) * 100) + '%';
      } else {
        elGaugeGateMark.style.display = 'none';
      }
    }
    if (!latest) {
      elGaugeZoneBadge.textContent = T.gaugeStandby;
      elGaugeZoneBadge.style.background = 'rgba(148,163,184,0.14)';
      elGaugeZoneBadge.style.color = '#94a3b8';
      elGaugeDtVal.textContent = '0.00 ms';
      elGaugeDtVal.style.color = '#cbd5e1';
      elGaugeLead10Val.textContent = '+10.00 ms';
      elGaugeLead10Val.style.color = '#6ee7b7';
      elGaugeLead20Val.textContent = '+20.00 ms';
      elGaugeLead20Val.style.color = '#6ee7b7';
      elGaugeAvgVal.textContent = '— / —';
      elGaugeFill.style.width = '0%';
      elGaugeNeedle.style.display = 'none';
      elGaugeBars.textContent = '';
      return;
    }
    const d = latest.deltaMs;
    const zone = d <= 10 ? 'optimal' : (d <= 20 ? 'window' : 'late');
    const col = zone === 'optimal' ? '#4ade80' : (zone === 'window' ? '#fbbf24' : '#fb7185');
    elGaugeZoneBadge.textContent = (zone === 'optimal' ? T.gaugeBeat : (zone === 'window' ? T.gaugeWindow : T.gaugeLate)) +
      ' (' + (latest.lead20Ms >= 0 ? '+' : '') + latest.lead20Ms.toFixed(2) + 'ms)';
    elGaugeZoneBadge.style.background = zone === 'optimal' ? 'rgba(16,185,129,0.18)' : (zone === 'window' ? 'rgba(245,158,11,0.18)' : 'rgba(244,63,94,0.2)');
    elGaugeZoneBadge.style.color = col;
    elGaugeDtVal.textContent = d.toFixed(2) + ' ms';
    elGaugeDtVal.style.color = col;
    elGaugeLead10Val.textContent = (latest.lead10Ms >= 0 ? '+' : '') + latest.lead10Ms.toFixed(2) + ' ms';
    elGaugeLead10Val.style.color = latest.lead10Ms >= 0 ? '#6ee7b7' : '#fbbf24';
    elGaugeLead20Val.textContent = (latest.lead20Ms >= 0 ? '+' : '') + latest.lead20Ms.toFixed(2) + ' ms';
    elGaugeLead20Val.style.color = latest.lead20Ms >= 0 ? '#6ee7b7' : '#fb7185';
    let sumD = 0, bestD = d;
    for (let i = 0; i < latencySamples.length; i++) {
      sumD += latencySamples[i].deltaMs;
      if (latencySamples[i].deltaMs < bestD) bestD = latencySamples[i].deltaMs;
    }
    const avgD = sumD / latencySamples.length;
    elGaugeAvgVal.textContent = avgD.toFixed(2) + ' / ' + bestD.toFixed(2) + 'ms (' + latencySamples.length + ')';
    const pct = Math.min(100, Math.max(1.5, (d / 25) * 100));
    elGaugeFill.style.width = pct + '%';
    elGaugeFill.style.background = zone === 'optimal' ? 'rgba(16,185,129,0.38)' : (zone === 'window' ? 'rgba(245,158,11,0.38)' : 'rgba(244,63,94,0.4)');
    elGaugeNeedle.style.display = 'block';
    elGaugeNeedle.style.left = Math.min(99, Math.max(1, pct)) + '%';
    elGaugeNeedle.style.background = col;
    elGaugeNeedle.style.boxShadow = '0 0 6px ' + col;
    elGaugeBars.textContent = '';
    for (let i = latencySamples.length - 1; i >= 0; i--) {
      const s = latencySamples[i];
      const hPct = Math.max(20, Math.min(100, (s.deltaMs / 25) * 100));
      const bCol = s.deltaMs <= 10 ? '#4ade80' : (s.deltaMs <= 20 ? '#fbbf24' : '#fb7185');
      const bar = mkEl('span', 'width:3px;border-radius:1px 1px 0 0;background:' + bCol + ';height:' + hPct + '%;');
      bar.title = s.time + ' · ' + s.src + ': ' + s.deltaMs.toFixed(2) + 'ms';
      elGaugeBars.appendChild(bar);
    }
  }

  function recordLatencySample(deltaMs, src, timeStr, gateHoldMs) {
    const d = Math.max(0, Number(deltaMs) || 0);
    lastReactionMsStr = d.toFixed(2);
    latencySamples.unshift({
      deltaMs: d,
      lead10Ms: 10 - d,
      lead20Ms: 20 - d,
      src: String(src || 'WS').slice(0, 22),
      time: timeStr || fmtTimeMs(),
      gateHoldMs: Number(gateHoldMs) || 0
    });
    if (latencySamples.length > 14) latencySamples.length = 14;
    updateLatencyGaugeUI();
  }

  function updateSecurityLogUI() {
    if (!elSecBox || !elSecList || !elSecToggle || !elSecBadge) return;
    elSecList.style.display = showSecurityLog ? 'flex' : 'none';
    elSecToggle.textContent = showSecurityLog ? '▾' : '▸';
    if (elSecVarLbl && elSecVarStats && elSecVarBadge) {
      if (!secLatencyDeltas.length) {
        elSecVarLbl.textContent = T.secVarLbl + ' (0)';
        elSecVarStats.textContent = 'Δt: — · ±σ: — · Min–Max: —';
        elSecVarStats.style.color = '#94a3b8';
        elSecVarBadge.textContent = T.secVarStandby;
        elSecVarBadge.style.background = 'rgba(148,163,184,0.14)';
        elSecVarBadge.style.color = '#94a3b8';
      } else {
        const vn = secLatencyDeltas.length;
        const lastD = secLatencyDeltas[0];
        let vSum = 0, vMin = lastD, vMax = lastD;
        for (let vi = 0; vi < vn; vi++) {
          const vv = secLatencyDeltas[vi];
          vSum += vv;
          if (vv < vMin) vMin = vv;
          if (vv > vMax) vMax = vv;
        }
        const vMean = vSum / vn;
        let sqSum = 0;
        for (let vi = 0; vi < vn; vi++) {
          const df = secLatencyDeltas[vi] - vMean;
          sqSum += df * df;
        }
        const stdDev = Math.sqrt(sqSum / vn);
        elSecVarLbl.textContent = T.secVarLbl + ' (' + vn + ')';
        elSecVarStats.textContent = 'Δt:' + lastD.toFixed(2) + 'ms · ±σ:' + stdDev.toFixed(2) + 'ms · ' + vMin.toFixed(1) + '–' + vMax.toFixed(1) + 'ms';
        if (!CFG.zeroDelay) {
          elSecVarBadge.textContent = T.secVarHold;
          elSecVarBadge.style.background = 'rgba(56,189,248,0.16)';
          elSecVarBadge.style.color = '#38bdf8';
          elSecVarStats.style.color = '#bae6fd';
        } else if (lastD <= 2.5 && stdDev <= 1.25) {
          elSecVarBadge.textContent = T.secVarZeroOk;
          elSecVarBadge.style.background = 'rgba(16,185,129,0.18)';
          elSecVarBadge.style.color = '#34d399';
          elSecVarStats.style.color = '#6ee7b7';
        } else if (lastD <= 10 && stdDev <= 3.5) {
          elSecVarBadge.textContent = T.secVarLow;
          elSecVarBadge.style.background = 'rgba(74,222,128,0.16)';
          elSecVarBadge.style.color = '#4ade80';
          elSecVarStats.style.color = '#bbf7d0';
        } else {
          elSecVarBadge.textContent = T.secVarDrift;
          elSecVarBadge.style.background = 'rgba(245,158,11,0.18)';
          elSecVarBadge.style.color = '#fbbf24';
          elSecVarStats.style.color = '#fde68a';
        }
      }
    }
    if (!securityLogs.length) {
      elSecBadge.textContent = T.secLogStandby;
      elSecBadge.style.background = 'rgba(148,163,184,0.14)';
      elSecBadge.style.color = '#94a3b8';
      if (showSecurityLog) {
        elSecList.textContent = '';
        elSecList.appendChild(mkEl('div', 'color:#64748b;', T.secLogEmpty));
      }
      return;
    }
    const topEnt = securityLogs[0];
    elSecBadge.textContent = securityLogs.length + ' · ' + topEnt.label;
    elSecBadge.style.background = 'rgba(16,185,129,0.16)';
    elSecBadge.style.color = '#6ee7b7';
    if (!showSecurityLog) return;
    elSecList.textContent = '';
    const colorMap = {
      sync: '#34d399',
      variance: '#34d399',
      warn: '#fbbf24',
      jitter: '#a78bfa',
      fp: '#22d3ee',
      hold: '#fbbf24',
      gate: '#38bdf8',
      retry: '#fb923c',
      trust: '#2dd4bf'
    };
    const maxRows = Math.min(securityLogs.length, 30);
    for (let i = 0; i < maxRows; i++) {
      const it = securityLogs[i];
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:baseline;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const tm = document.createElement('span');
      tm.style.cssText = 'color:#64748b;flex-shrink:0;';
      tm.textContent = it.time;
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-weight:700;flex-shrink:0;color:' + (colorMap[it.level] || '#4ade80') + ';';
      lbl.textContent = it.label;
      row.appendChild(tm);
      row.appendChild(lbl);
      if (it.detail) {
        const dt = document.createElement('span');
        dt.style.cssText = 'color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;';
        dt.textContent = '· ' + it.detail;
        row.appendChild(dt);
      }
      elSecList.appendChild(row);
    }
  }
  updateSecurityLogUI();

  function scheduleSecurityUiUpdate() {
    if (secUiTimer) return;
    secUiTimer = setTimeout(() => {
      secUiTimer = null;
      updateSecurityLogUI();
    }, 16);
  }

  function pushSecurityLog(label, detail, level, timeStr) {
    if (!label) return;
    securityLogs.unshift({
      time: timeStr || fmtTimeMs(new Date()),
      label: String(label),
      detail: detail ? String(detail).slice(0, 60) : '',
      level: level || 'trust'
    });
    if (securityLogs.length > 50) securityLogs.length = 50;
    scheduleSecurityUiUpdate();
  }

  function recordSecurityLatency(deltaMs, sourceLabel, clickTime) {
    const d = Math.max(0, Number(deltaMs) || 0);
    secLatencyDeltas.unshift(d);
    if (secLatencyDeltas.length > 20) secLatencyDeltas.length = 20;
    let sum = 0, minD = d, maxD = d;
    for (let i = 0; i < secLatencyDeltas.length; i++) {
      const v = secLatencyDeltas[i];
      sum += v;
      if (v < minD) minD = v;
      if (v > maxD) maxD = v;
    }
    const mean = sum / secLatencyDeltas.length;
    let sq = 0;
    for (let i = 0; i < secLatencyDeltas.length; i++) {
      const df = secLatencyDeltas[i] - mean;
      sq += df * df;
    }
    const std = Math.sqrt(sq / secLatencyDeltas.length);
    const spread = maxD - minD;
    const statusTxt = !CFG.zeroDelay
      ? 'Hold'
      : (d <= 2.5 && std <= 1.25 ? '0ms-OK' : (d <= 10 && std <= 3.5 ? 'LowVar' : 'Drift'));
    const lvl = !CFG.zeroDelay ? 'hold' : (d <= 10 && std <= 3.5 ? 'variance' : 'warn');
    const srcShort = sourceLabel ? String(sourceLabel).slice(0, 14) : 'WS';
    pushSecurityLog(
      'Latency Variance',
      srcShort + ' Δt:' + d.toFixed(2) + 'ms ±σ:' + std.toFixed(2) + 'ms (' + spread.toFixed(1) + 'ms) ' + statusTxt,
      lvl,
      clickTime
    );
  }

  let lastTurboCfgStr = '';
  let lastBroadcastCfgStr = '';
  let iframeLocalTarget = { active: false, x: -1, y: -1, locked: false };
  let lastIframeSyncUpAt = 0;
  let lastIframeSyncUpSig = '';
  let lastIframeLockReplyAt = 0;
  const lastLocalTargetByFrame = typeof WeakMap === 'function' ? new WeakMap() : null;
  function dispatchPageStrEvent(evName, strPayload, alsoTargetWin) {
    const s = String(strPayload == null ? '' : strPayload);
    if (typeof cloneInto === 'function' && targetWin && targetWin.CustomEvent) {
      try {
        const opts = cloneInto({ detail: s }, targetWin);
        document.dispatchEvent(new targetWin.CustomEvent(evName, opts));
        if (alsoTargetWin && targetWin !== document && targetWin.dispatchEvent) {
          targetWin.dispatchEvent(new targetWin.CustomEvent(evName, opts));
        }
        return true;
      } catch {}
    }
    try {
      if (typeof CustomEvent === 'function') {
        document.dispatchEvent(new CustomEvent(evName, { detail: s }));
        if (alsoTargetWin && targetWin !== document && targetWin.dispatchEvent) {
          targetWin.dispatchEvent(new CustomEvent(evName, { detail: s }));
        }
        return true;
      }
    } catch {}
    if (targetWin && targetWin.CustomEvent) {
      try {
        document.dispatchEvent(new targetWin.CustomEvent(evName, { detail: s }));
        if (alsoTargetWin && targetWin !== document && targetWin.dispatchEvent) {
          targetWin.dispatchEvent(new targetWin.CustomEvent(evName, { detail: s }));
        }
        return true;
      } catch {}
    }
    return false;
  }
  function syncIframeLocalTargets(forceSend) {
    if (hudHidden || isDraggingTarget) return;
    if (!forceSend && Date.now() - lastIframeLockReplyAt < 180) return;
    try {
      const frames = document.querySelectorAll('iframe');
      if (!frames || !frames.length) return;
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        let msg = { __TT_SNIFFER__: true, kind: 'LOCAL_TARGET', active: false, x: -1, y: -1, locked: Boolean(locked), forceCapture: Boolean(forceSend) };
        try {
          const r = f.getBoundingClientRect();
          if (r.width > 10 && r.height > 10 && targetX >= r.left && targetX <= r.right && targetY >= r.top && targetY <= r.bottom) {
            msg = {
              __TT_SNIFFER__: true,
              kind: 'LOCAL_TARGET',
              active: true,
              x: Math.round(targetX - r.left),
              y: Math.round(targetY - r.top),
              locked: Boolean(locked),
              forceCapture: Boolean(forceSend)
            };
          }
          const sig = (msg.active ? '1:' : '0:') + msg.x + ':' + msg.y + ':' + (msg.locked ? '1' : '0');
          if (!forceSend && lastLocalTargetByFrame && lastLocalTargetByFrame.get(f) === sig) continue;
          if (lastLocalTargetByFrame) lastLocalTargetByFrame.set(f, sig);
          if (f.contentWindow) f.contentWindow.postMessage(msg, '*');
        } catch {}
      }
    } catch {}
  }
  function syncTurboCfg(force, allowCrossFrameBroadcast) {
    try {
      if (!hudHidden) syncIframeLocalTargets(Boolean(force));
      const cfgObj = {
        armed: Boolean(CFG.armed),
        tags: String(CFG.tags || ''),
        matchMode: String(CFG.matchMode || 'contains'),
        caseSensitive: Boolean(CFG.caseSensitive),
        cooldownMs: Number(CFG.cooldownMs) || 0,
        oneShot: Boolean(CFG.oneShot),
        roundOnce: Boolean(CFG.roundOnce),
        zeroDelay: Boolean(CFG.zeroDelay),
        zeroDelayMicroMs: Math.max(0, Math.min(5, Math.round((Number(CFG.zeroDelayMicroMs) || 0) * 2) / 2)),
        holdMs: CFG.zeroDelay
          ? Math.max(0, Math.min(5, Math.round((Number(CFG.zeroDelayMicroMs) || 0) * 2) / 2))
          : (CFG.humanTap ? 35 : 0),
        humanJitter: Boolean(CFG.humanJitter),
        fingerprintShuffle: Boolean(CFG.fingerprintShuffle),
        opClickMode: Boolean(CFG.opClickMode !== false),
        directWsCashout: Boolean(CFG.directWsCashout !== false),
        netLagAutoShift: Boolean(CFG.netLagAutoShift !== false),
        fallbackMultX: Number(CFG.fallbackMultX) || 0,
        autoCashoutCeilingX: Number(CFG.autoCashoutCeilingX) || 0,
        networkTap: Boolean(CFG.networkTap),
        preClickGate: Boolean(CFG.preClickGate),
        leadMs: CFG.preClickGate ? (Number(CFG.wsLeadMs) || 0) : 0,
        gateMs: CFG.preClickGate ? (Number(CFG.gateHoldMs) || 0) : 0,
        holdEvents: String(CFG.holdEvents || ''),
        inspectorEnabled: Boolean(CFG.inspectorEnabled),
        inspectorAutoClick: Boolean(CFG.inspectorAutoClick),
        inspectorHoldAllWs: Boolean(CFG.inspectorHoldAllWs),
        inspectorHoldMs: Number(CFG.inspectorHoldMs) || 0,
        inspectorKeywords: String(CFG.inspectorKeywords || ''),
        inspectorRegexes: String(CFG.inspectorRegexes || ''),
        inspectorJsonPaths: String(CFG.inspectorJsonPaths || ''),
        x: Math.round(targetX),
        y: Math.round(targetY),
        localActive: Boolean(isIframe && iframeLocalTarget.active),
        localX: isIframe ? Math.round(iframeLocalTarget.x) : -1,
        localY: isIframe ? Math.round(iframeLocalTarget.y) : -1,
        targetText: String(CFG.targetText || ''),
        targetSelector: String(CFG.targetSelector || ''),
        locked: Boolean(locked),
        hudHidden: Boolean(hudHidden),
        listenRTF: Boolean(CFG.listenRTF !== false),
        listenCSS: Boolean(CFG.listenCSS !== false),
        listenJS: Boolean(CFG.listenJS !== false),
        listenDOM: Boolean(CFG.listenDOM !== false),
        roundUnlockSeq: roundUnlockSeq
      };
      const payload = JSON.stringify(cfgObj);
      try { if (typeof TTAsyncWorkerEngine !== 'undefined') TTAsyncWorkerEngine.syncConfig(); } catch {}
      if (force || payload !== lastTurboCfgStr) {
        lastTurboCfgStr = payload;
        try { targetWin.__ttCfgStr = payload; } catch {}
        try { if (rawPageWin && rawPageWin !== targetWin) rawPageWin.__ttCfgStr = payload; } catch {}
        try { if (targetWin !== window) window.__ttCfgStr = payload; } catch {}
        try { if (document.documentElement && document.documentElement.setAttribute) document.documentElement.setAttribute('data-tt-cfg', payload); } catch {}
        try {
          const cfgSym = typeof Symbol === 'function' ? Symbol.for('__tt.cfg') : null;
          if (cfgSym) {
            try { Object.defineProperty(targetWin, cfgSym, { value: payload, writable: true, configurable: true, enumerable: false }); } catch { targetWin[cfgSym] = payload; }
            if (targetWin !== window) {
              try { Object.defineProperty(window, cfgSym, { value: payload, writable: true, configurable: true, enumerable: false }); } catch { window[cfgSym] = payload; }
            }
          }
        } catch {}
        dispatchPageStrEvent('__TT_PAGE_CFG__', payload, false);
      }
      if (allowCrossFrameBroadcast && !hudHidden && userTouchedHud) {
        const syncPayload = buildSyncCfgPayload();
        const syncStr = JSON.stringify(syncPayload);
        if (force || syncStr !== lastBroadcastCfgStr) {
          publishUserCfgToFrames(syncPayload);
        }
      }
    } catch {}
  }

  function buildSyncCfgPayload() {
    return {
      armed: Boolean(CFG.armed),
      locked: Boolean(locked),
      tags: String(CFG.tags || ''),
      matchMode: String(CFG.matchMode || 'contains'),
      caseSensitive: Boolean(CFG.caseSensitive),
      cooldownMs: Number(CFG.cooldownMs) || 0,
      oneShot: Boolean(CFG.oneShot),
      roundOnce: Boolean(CFG.roundOnce),
      zeroDelay: Boolean(CFG.zeroDelay),
      zeroDelayMicroMs: Math.max(0, Math.min(5, Math.round((Number(CFG.zeroDelayMicroMs) || 0) * 2) / 2)),
      humanTap: Boolean(CFG.humanTap),
      humanJitter: Boolean(CFG.humanJitter),
      fingerprintShuffle: Boolean(CFG.fingerprintShuffle),
      opClickMode: Boolean(CFG.opClickMode !== false),
      directWsCashout: Boolean(CFG.directWsCashout !== false),
      netLagAutoShift: Boolean(CFG.netLagAutoShift !== false),
      fallbackMultX: Number(CFG.fallbackMultX) || 0,
      autoCashoutCeilingX: Number(CFG.autoCashoutCeilingX) || 0,
      networkTap: Boolean(CFG.networkTap),
      preClickGate: Boolean(CFG.preClickGate),
      wsLeadMs: Number(CFG.wsLeadMs) || 0,
      gateHoldMs: Number(CFG.gateHoldMs) || 0,
      holdEvents: String(CFG.holdEvents || ''),
      inspectorEnabled: Boolean(CFG.inspectorEnabled),
      inspectorAutoClick: Boolean(CFG.inspectorAutoClick),
      inspectorHoldAllWs: Boolean(CFG.inspectorHoldAllWs),
      inspectorHoldMs: Number(CFG.inspectorHoldMs) || 0,
      inspectorKeywords: String(CFG.inspectorKeywords || ''),
      inspectorRegexes: String(CFG.inspectorRegexes || ''),
      inspectorJsonPaths: String(CFG.inspectorJsonPaths || ''),
      targetText: String(CFG.targetText || ''),
      targetSelector: String(CFG.targetSelector || ''),
      crashBuzzer: Boolean(CFG.crashBuzzer),
      smartSmsSegmenter: Boolean(CFG.smartSmsSegmenter),
      smsSegmentThreshold: Math.max(2, Math.min(500, Math.round(Number(CFG.smsSegmentThreshold) || 30))),
      smsExpectedTotal: Math.max(4, Math.min(1000, Math.round(Number(CFG.smsExpectedTotal) || 60)))
    };
  }

  function publishUserCfgToFrames(syncPayload, directTargetWin) {
    try {
      const payload = syncPayload || buildSyncCfgPayload();
      lastBroadcastCfgStr = JSON.stringify(payload);
      const editTs = Math.max(Date.now(), (lastUserCfgEditAt || 0) + 1);
      lastUserCfgEditAt = editTs;
      const msg = {
        __TT_SNIFFER__: true,
        kind: 'SYNC_CFG',
        fromUser: true,
        srcFrame: FRAME_ID,
        sessionId: activeSessionId,
        ts: editTs,
        cfg: payload
      };
      if (directTargetWin && typeof directTargetWin.postMessage === 'function') {
        try { directTargetWin.postMessage(msg, '*'); } catch {}
      }
      if (isIframe) sendToTop(msg);
      else broadcastDownToIframes(msg);
      if (typeof GM_setValue === 'function') {
        try { GM_setValue('__tt_sync_cfg_' + CFG.roomId, JSON.stringify(msg)); } catch {}
      }
    } catch {}
  }
  syncUI();

  const syncTagsFromInput = () => {
    CFG.tags = elTags.value;
    CFG.manualTagPin = true;
    if (lastHitTag === 'TEST') lastHitTag = '';
    lastMatchPreview = '';
    roundClickLocked = false;
    roundSawFlightAfterLock = false;
    roundSawCrashAfterLock = false;
    roundClickLockedRoundId = '';
    roundUnlockSeq += 1;
    lastUserCfgEditAt = Date.now();
    markUserTouched();
    if (CFG.autoConfigOnTag !== false) {
      applyAutoTagConfig('TAG_SET');
    }
    persistHudControlState();
    updateEarlyTagWarning();
    syncUI();
    syncTurboCfg(true, true);
    scheduleRaceUiUpdate();
    if (activeTab === 'tags') renderLogs(true);
  };
  const stopInputBubble = (el) => {
    if (!el) return;
    ['pointerdown', 'touchstart', 'mousedown'].forEach((ev) => {
      el.addEventListener(ev, (e) => { e.stopPropagation(); }, true);
    });
  };
  stopInputBubble(elZeroTuneRange);
  stopInputBubble(elTags);
  stopInputBubble(elCd);
  stopInputBubble(elSearch);
  stopInputBubble(elTargetTxtInp);
  stopInputBubble(elTargetSelInp);
  stopInputBubble(elLeadInp);
  stopInputBubble(elGateHoldInp);
  stopInputBubble(elInspHoldInp);
  stopInputBubble(elInspKw);
  stopInputBubble(elInspRx);
  stopInputBubble(elInspJp);
  const onZeroTuneChange = () => {
    CFG.zeroDelayMicroMs = Math.max(0, Math.min(5, Math.round((Number(elZeroTuneRange.value) || 0) * 2) / 2));
    lastUserCfgEditAt = Date.now();
    persistHudControlState();
    markUserTouched();
    syncUI();
    syncTurboCfg(true, true);
  };
  elZeroTuneRange.addEventListener('input', onZeroTuneChange);
  elZeroTuneRange.addEventListener('change', onZeroTuneChange);
  const syncTargetPinFromInputs = () => {
    CFG.targetText = elTargetTxtInp.value.trim();
    CFG.targetSelector = elTargetSelInp.value.trim();
    anchor.el = null;
    anchor.text = CFG.targetText;
    anchor.selector = CFG.targetSelector;
    anchor.manual = Boolean(CFG.targetText || CFG.targetSelector);
    markUserTouched();
    saveAnchor();
    if (typeof syncPositionFromAnchor === 'function') syncPositionFromAnchor();
    if (typeof preWarmFbHit === 'function') preWarmFbHit();
    syncUI();
    syncTurboCfg(true, true);
  };
  elTargetTxtInp.addEventListener('input', syncTargetPinFromInputs);
  elTargetSelInp.addEventListener('input', syncTargetPinFromInputs);
  bindTap(elTargetClrBtn, () => {
    elTargetTxtInp.value = '';
    elTargetSelInp.value = '';
    CFG.targetText = '';
    CFG.targetSelector = '';
    anchor.el = null;
    anchor.text = '';
    anchor.selector = '';
    anchor.manual = false;
    markUserTouched();
    saveAnchor();
    syncUI();
    syncTurboCfg(true, true);
  });
  elTags.addEventListener('input', syncTagsFromInput);
  elTags.addEventListener('compositionend', syncTagsFromInput);
  elTags.addEventListener('change', syncTagsFromInput);
  elTags.addEventListener('keyup', syncTagsFromInput);
  elTags.addEventListener('paste', () => { setTimeout(syncTagsFromInput, 0); });
  elTags.addEventListener('blur', syncTagsFromInput);
  elTags.addEventListener('focus', () => { markUserTouched(); });
  elMode.addEventListener('change', () => { CFG.matchMode = elMode.value; lastMatchPreview = ''; lastUserCfgEditAt = Date.now(); markUserTouched(); syncTurboCfg(true, true); });
  elCd.addEventListener('input', () => { CFG.cooldownMs = Math.max(0, Number(elCd.value) || 0); lastUserCfgEditAt = Date.now(); markUserTouched(); syncTurboCfg(true, true); });
  bindTap(elRoundOnce, () => {
    CFG.roundOnce = !CFG.roundOnce;
    roundClickLocked = false;
    roundSawFlightAfterLock = false;
    roundUnlockSeq += 1;
    lastUserCfgEditAt = Date.now();
    persistHudControlState();
    markUserTouched();
    syncUI();
    syncTurboCfg(true, true);
  });
  bindTap(elZeroDelay, () => {
    CFG.zeroDelay = !CFG.zeroDelay;
    lastUserCfgEditAt = Date.now();
    persistHudControlState();
    markUserTouched();
    syncUI();
    syncTurboCfg(true, true);
  });
  bindTap(elTapMode, () => {
    CFG.humanTap = !CFG.humanTap;
    if (CFG.humanTap) CFG.zeroDelay = false;
    lastUserCfgEditAt = Date.now();
    persistHudControlState();
    markUserTouched();
    syncUI();
    syncTurboCfg(true, true);
  });
  bindTap(elJitterBtn, () => {
    CFG.humanJitter = !CFG.humanJitter;
    lastUserCfgEditAt = Date.now();
    persistHudControlState();
    markUserTouched();
    syncUI();
    syncTurboCfg(true, true);
  });
  bindTap(elFpBtn, () => {
    CFG.fingerprintShuffle = !CFG.fingerprintShuffle;
    lastUserCfgEditAt = Date.now();
    persistHudControlState();
    markUserTouched();
    syncUI();
    syncTurboCfg(true, true);
  });
  bindTap(elGateMode, () => { CFG.preClickGate = !CFG.preClickGate; lastUserCfgEditAt = Date.now(); markUserTouched(); syncUI(); syncTurboCfg(true, true); });
  bindTap(elTunerBtn, () => { showGateTuner = !showGateTuner; markUserTouched(); syncUI(); });
  bindTap(elCrashBtn, () => {
    CFG.crashBuzzer = !CFG.crashBuzzer;
    if (CFG.crashBuzzer) unlockCrashAudio();
    lastUserCfgEditAt = Date.now();
    persistHudControlState();
    markUserTouched();
    syncUI();
    syncTurboCfg(true, true);
  });
  bindTap(elGaugeHdr, () => { showLatencyGauge = !showLatencyGauge; markUserTouched(); updateLatencyGaugeUI(); });
  elLeadInp.addEventListener('input', () => { CFG.wsLeadMs = Math.max(0, Math.min(100, Number(elLeadInp.value) || 0)); lastUserCfgEditAt = Date.now(); markUserTouched(); syncUI(); syncTurboCfg(true, true); });
  elGateHoldInp.addEventListener('input', () => { CFG.gateHoldMs = Math.max(0, Math.min(250, Number(elGateHoldInp.value) || 0)); lastUserCfgEditAt = Date.now(); markUserTouched(); syncUI(); syncTurboCfg(true, true); });
  elInspHoldInp.addEventListener('input', () => { CFG.inspectorHoldMs = Math.max(0, Math.min(2000, Number(elInspHoldInp.value) || 0)); lastUserCfgEditAt = Date.now(); markUserTouched(); syncUI(); syncTurboCfg(true, true); });
  const syncInspRulesFromHud = () => {
    CFG.inspectorKeywords = elInspKw.value;
    CFG.inspectorRegexes = elInspRx.value;
    CFG.inspectorJsonPaths = elInspJp.value;
    cachedInspKey = '';
    lastUserCfgEditAt = Date.now();
    markUserTouched();
    syncTurboCfg(true, true);
  };
  elInspKw.addEventListener('input', syncInspRulesFromHud);
  elInspRx.addEventListener('input', syncInspRulesFromHud);
  elInspJp.addEventListener('input', syncInspRulesFromHud);
  bindTap(elInspOnBtn, () => { CFG.inspectorEnabled = !CFG.inspectorEnabled; cachedInspKey = ''; lastUserCfgEditAt = Date.now(); markUserTouched(); syncUI(); syncTurboCfg(true, true); });
  bindTap(elInspAutoBtn, () => { CFG.inspectorAutoClick = !CFG.inspectorAutoClick; lastUserCfgEditAt = Date.now(); markUserTouched(); syncUI(); syncTurboCfg(true, true); });
  bindTap(elInspAllBtn, () => { CFG.inspectorHoldAllWs = !CFG.inspectorHoldAllWs; lastUserCfgEditAt = Date.now(); markUserTouched(); syncUI(); syncTurboCfg(true, true); });
  bindTap(elArm, () => {
    CFG.tags = elTags.value;
    CFG.armed = !CFG.armed;
    if (lastHitTag === 'TEST') lastHitTag = '';
    roundClickLocked = false;
    roundSawFlightAfterLock = false;
    roundSawCrashAfterLock = false;
    roundUnlockSeq += 1;
    lastUserCfgEditAt = Date.now();
    persistHudControlState();
    markUserTouched();
    syncUI();
    syncTurboCfg(true, true);
  });

  function resolveInteractiveTarget(rawEl, docObj) {
    if (!rawEl || rawEl.nodeType !== 1 || isOwnHudNode(rawEl)) return null;
    const ownerDoc = docObj || rawEl.ownerDocument || document;
    if (rawEl === ownerDoc.documentElement || rawEl === ownerDoc.body) return null;
    const ownerWin = ownerDoc.defaultView || window;
    const vw = Math.max(1, ownerWin.innerWidth || window.innerWidth || 360);
    const vh = Math.max(1, ownerWin.innerHeight || window.innerHeight || 640);
    const strictClosest = rawEl.closest && rawEl.closest('button, a, [role="button"], input[type="button"], input[type="submit"], canvas');
    if (strictClosest && !isOwnHudNode(strictClosest) && strictClosest !== ownerDoc.documentElement && strictClosest !== ownerDoc.body && strictClosest.tagName !== 'IFRAME') {
      const sr = strictClosest.getBoundingClientRect();
      if (sr.width > 0 && sr.height > 0 && !(sr.width > vw * 0.85 && sr.height > vh * 0.7)) {
        return strictClosest;
      }
    }
    if (rawEl.querySelector) {
      const innerBtn = rawEl.querySelector('button, [role="button"], input[type="button"], input[type="submit"], a');
      if (innerBtn && !isOwnHudNode(innerBtn)) {
        const irIn = innerBtn.getBoundingClientRect();
        if (irIn.width > 8 && irIn.height > 8) return innerBtn;
      }
    }
    const inter = rawEl.closest && rawEl.closest('[onclick], [tabindex], [class*="btn"], [class*="button"]');
    if (inter && !isOwnHudNode(inter) && inter !== ownerDoc.documentElement && inter !== ownerDoc.body && inter.tagName !== 'IFRAME') {
      const ir = inter.getBoundingClientRect();
      if (ir.width > 0 && ir.height > 0 && !(ir.width > vw * 0.85 && ir.height > vh * 0.7)) {
        return inter;
      }
    }
    return rawEl;
  }

  function extractTargetTextFromEl(el) {
    if (!el || el.tagName === 'CANVAS') return '';
    return String(el.innerText || el.textContent || el.value || (el.getAttribute && el.getAttribute('aria-label')) || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 60);
  }

  function applyPickedElementResult(pickedEl, clientX, clientY, isFromChildFrame) {
    if (!pickedEl) return;
    const ownerDoc = pickedEl.ownerDocument || document;
    const sel = getCssPath(pickedEl, ownerDoc);
    const txt = extractTargetTextFromEl(pickedEl);
    const rect = pickedEl.getBoundingClientRect();
    let finalX = typeof clientX === 'number' ? clientX : (rect.left + rect.width * 0.5);
    let finalY = typeof clientY === 'number' ? clientY : (rect.top + rect.height * 0.5);
    if (ownerDoc !== document) {
      try {
        const frames = document.querySelectorAll('iframe');
        for (let i = 0; i < frames.length; i++) {
          if (frames[i].contentDocument === ownerDoc) {
            const fr = frames[i].getBoundingClientRect();
            finalX = fr.left + rect.left + rect.width * 0.5;
            finalY = fr.top + rect.top + rect.height * 0.5;
            break;
          }
        }
      } catch {}
    } else if (!isFromChildFrame && rect.width > 2 && rect.height > 2) {
      finalX = rect.left + rect.width * 0.5;
      finalY = rect.top + rect.height * 0.5;
    }

    targetX = Math.round(finalX);
    targetY = Math.round(finalY);
    clampTarget();

    const vw = Math.max(1, window.innerWidth || 360);
    const vh = Math.max(1, window.innerHeight || 640);
    const visH = Math.max(1, Math.min(vh, getSafeVisibleHeight()));

    const slotContainer = ownerDoc === document ? findButtonSlotContainer(pickedEl) : null;
    anchor.el = ownerDoc === document ? pickedEl : null;
    anchor.manual = true;
    anchor.selector = sel;
    anchor.structPath = getStructPath(pickedEl, ownerDoc);
    anchor.slotEl = slotContainer;
    anchor.slotSelector = slotContainer ? getCssPath(slotContainer, ownerDoc) : '';
    anchor.slotStructPath = slotContainer ? getStructPath(slotContainer, ownerDoc) : '';
    const safeTxt = sanitizeSavedTargetTxt(txt);
    anchor.text = safeTxt;
    anchor.lockedExplicit = true;
    anchor.relX = 0.5;
    anchor.relY = 0.5;
    anchor.absX = targetX;
    anchor.absY = targetY;
    anchor.baseVw = vw;
    anchor.baseVh = vh;
    anchor.pctX = targetX / vw;
    anchor.pctY = targetY / visH;

    if (safeTxt) CFG.targetText = safeTxt;
    CFG.targetSelector = sel;
    locked = true;
    persistHudControlState();
    saveAnchor();

    crosshair.style.display = 'flex';
    crosshair.style.visibility = '';
    crosshair.style.left = (targetX - half) + 'px';
    crosshair.style.top = (targetY - half) + 'px';
    if (elStatus) {
      const lbl = txt ? ('"' + txt.slice(0, 22) + '"') : (sel.slice(0, 24) || pickedEl.tagName.toLowerCase());
      elStatus.textContent = T.pickDone.replace('{label}', lbl);
    }
    syncUI();
    syncTurboCfg(true, true);
    if (typeof preWarmFbHit === 'function') preWarmFbHit();

    if (CFG.relayEnabled) {
      const pickPayload = [{
        uid: 'pick_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        src: 'ELEMENT_PICK',
        kind: 'PICK',
        text: JSON.stringify({ targetText: txt, targetSelector: sel }),
        matched: false,
        time: fmtTimeMs(new Date()),
        monoMs: performance.now()
      }];
      if (isIframe) {
        sendToTop({ __TT_SNIFFER__: true, kind: 'BATCH', roomId: CFG.roomId, events: pickPayload });
      } else {
        dispatchRelayBatchTopLevel(pickPayload);
      }
    }
  }

  function getPickerBadgeParts(el, docObj) {
    const tag = el && el.tagName ? el.tagName.toLowerCase() : 'el';
    let idBadge = '';
    let isIdUnique = false;
    let classBadge = '';
    const d = docObj || document;
    try {
      if (el && el.id) {
        const cleanId = String(el.id).trim();
        if (cleanId) {
          idBadge = '#' + cleanId.slice(0, 32);
          try {
            const escId = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(cleanId) : cleanId.replace(/([^w-])/g, '\$1');
            const m = d.querySelectorAll('#' + escId);
            isIdUnique = (m.length === 1 && m[0] === el);
          } catch {}
        }
      }
      if (!isIdUnique && el && el.classList && el.classList.length > 0) {
        const cleanCls = [];
        for (let i = 0; i < el.classList.length; i++) {
          const c = el.classList[i];
          if (!c || c.length > 28) continue;
          if (/^(hover|focus|active|selected|is-|has-)/.test(c) || /[/:[]()]/.test(c)) continue;
          cleanCls.push(c);
          if (cleanCls.length >= 2) break;
        }
        if (cleanCls.length > 0) {
          classBadge = '.' + cleanCls.join('.');
        }
      }
    } catch {}
    return { tag, idBadge, isIdUnique, classBadge };
  }

  function stopElementPickerMode(alsoBroadcast) {
    if (!elementPickMode && !pickBannerEl && !pickBoxEl && !pickTipEl) return;
    elementPickMode = false;
    try { document.documentElement.style.cursor = prevDocCursor || ''; } catch {}
    for (let i = 0; i < pickCleanupFns.length; i++) {
      try { pickCleanupFns[i](); } catch {}
    }
    pickCleanupFns = [];
    if (pickBannerEl && pickBannerEl.parentNode) pickBannerEl.parentNode.removeChild(pickBannerEl);
    if (pickBoxEl && pickBoxEl.parentNode) pickBoxEl.parentNode.removeChild(pickBoxEl);
    if (pickTipEl && pickTipEl.parentNode) pickTipEl.parentNode.removeChild(pickTipEl);
    pickBannerEl = null;
    pickBoxEl = null;
    pickTipEl = null;
    panel.style.display = 'flex';
    if (hudHidden) {
      root.style.display = 'none';
      crosshair.style.display = 'none';
    }
    if (alsoBroadcast) {
      broadcastDownToIframes({ __TT_SNIFFER__: true, kind: 'STOP_PICKER' });
    }
    if (!hudHidden) syncUI();
  }

  function startElementPickerMode(fromRemoteOrTop) {
    if (elementPickMode) {
      stopElementPickerMode(true);
      return;
    }
    elementPickMode = true;
    prevDocCursor = document.documentElement ? document.documentElement.style.cursor : '';
    try { if (document.documentElement) document.documentElement.style.cursor = 'crosshair'; } catch {}

    mountRootEl();
    if (hudHidden) {
      root.style.display = 'block';
      panel.style.display = 'none';
      crosshair.style.display = 'none';
    }

    pickBoxEl = document.createElement('div');
    pickBoxEl.style.cssText = 'position:fixed;display:none;pointer-events:none;z-index:2147483645;border:2px solid #10b981;background:rgba(16,185,129,0.14);border-radius:6px;box-shadow:0 0 0 1px rgba(0,0,0,0.6);transition:left 45ms linear,top 45ms linear,width 45ms linear,height 45ms linear;';
    hudContainer.appendChild(pickBoxEl);

    pickTipEl = document.createElement('div');
    pickTipEl.style.cssText = 'position:fixed;display:none;pointer-events:none;z-index:2147483646;background:rgba(9,13,22,0.93);color:#ecfdf5;border:1px solid rgba(16,185,129,0.65);border-radius:6px;padding:3px 7px;font:600 10.5px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 6px 18px rgba(0,0,0,0.55);backdrop-filter:blur(4px);';
    hudContainer.appendChild(pickTipEl);

    if (!hudHidden) {
      pickBannerEl = document.createElement('button');
      pickBannerEl.type = 'button';
      pickBannerEl.textContent = T.pickPrompt;
      pickBannerEl.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:auto;background:#065f46;color:#ecfdf5;border:1.5px solid #34d399;border-radius:10px;padding:7px 12px;font:700 11px/1.3 system-ui,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,0.6);cursor:pointer;max-width:calc(100vw - 24px);text-align:center;';
      pickBannerEl.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        stopElementPickerMode(true);
      });
      hudContainer.appendChild(pickBannerEl);
    }

    const updateHighlight = (el, clientX, clientY, docObj) => {
      if (!pickBoxEl || !pickTipEl || !el) return;
      const r = el.getBoundingClientRect();
      let offX = 0;
      let offY = 0;
      if (docObj && docObj !== document) {
        try {
          const frames = document.querySelectorAll('iframe');
          for (let i = 0; i < frames.length; i++) {
            if (frames[i].contentDocument === docObj) {
              const fr = frames[i].getBoundingClientRect();
              offX = fr.left;
              offY = fr.top;
              break;
            }
          }
        } catch {}
      }
      pickBoxEl.style.display = 'block';
      pickBoxEl.style.left = Math.round(offX + r.left) + 'px';
      pickBoxEl.style.top = Math.round(offY + r.top) + 'px';
      pickBoxEl.style.width = Math.max(4, Math.round(r.width)) + 'px';
      pickBoxEl.style.height = Math.max(4, Math.round(r.height)) + 'px';

      const info = getPickerBadgeParts(el, docObj || document);
      const txt = extractTargetTextFromEl(el);
      pickTipEl.textContent = '';
      const sTag = document.createElement('span');
      sTag.style.color = '#a7f3d0';
      sTag.textContent = '<' + info.tag + '>';
      pickTipEl.appendChild(sTag);
      if (info.idBadge) {
        const sId = document.createElement('span');
        sId.style.color = info.isIdUnique ? '#fde68a' : '#fcd34d';
        sId.textContent = ' ' + info.idBadge;
        pickTipEl.appendChild(sId);
      }
      if (info.classBadge) {
        const sCls = document.createElement('span');
        sCls.style.color = '#7dd3fc';
        sCls.textContent = ' ' + info.classBadge;
        pickTipEl.appendChild(sCls);
      }
      if (!info.idBadge && !info.classBadge && txt) {
        const sTxt = document.createElement('span');
        sTxt.style.color = '#cbd5e1';
        sTxt.textContent = ' "' + txt.slice(0, 18) + '"';
        pickTipEl.appendChild(sTxt);
      }

      pickTipEl.style.display = 'block';
      const anchorX = (typeof clientX === 'number' && clientX > 0) ? clientX : Math.round(offX + r.left + r.width * 0.5);
      const anchorY = (typeof clientY === 'number' && clientY > 0) ? clientY : Math.round(offY + r.top + r.height * 0.5);
      const vw = Math.max(240, window.innerWidth || 360);
      const vh = Math.max(200, window.innerHeight || 640);
      const tipW = pickTipEl.offsetWidth || 160;
      const tipH = pickTipEl.offsetHeight || 22;
      let tx = anchorX + 14;
      if (tx + tipW > vw - 8) tx = Math.max(8, anchorX - tipW - 12);
      let ty = anchorY + 18;
      if (ty + tipH > vh - 8) ty = Math.max(8, anchorY - tipH - 12);
      pickTipEl.style.left = Math.round(tx) + 'px';
      pickTipEl.style.top = Math.round(ty) + 'px';
    };

    const attachDocListeners = (docObj, isTopDoc) => {
      if (!docObj) return;
      let touchMoved = false;
      let pointerDragActive = false;
      let pointerDragMoved = false;
      let justPickedAt = 0;
      let startX = 0;
      let startY = 0;
      const pickAt = (cx, cy, ev) => {
        if (!elementPickMode) return;
        const targetNode = ev && ev.target;
        if (isTopDoc && isOwnHudNode(targetNode)) return;
        let rawEl = deepElementFromPoint(docObj, cx, cy, false) || targetNode;
        if (rawEl && rawEl.tagName === 'IFRAME') {
          try {
            if (rawEl.contentDocument) {
              const fr = rawEl.getBoundingClientRect();
              const innerEl = deepElementFromPoint(rawEl.contentDocument, cx - fr.left, cy - fr.top, false);
              if (innerEl) rawEl = innerEl;
            }
          } catch {}
        }
        const resolved = resolveInteractiveTarget(rawEl, rawEl && rawEl.ownerDocument ? rawEl.ownerDocument : docObj);
        if (!resolved) return;
        justPickedAt = Date.now();
        if (isIframe && isTopDoc && hudHidden) {
          const sel = getCssPath(resolved, docObj);
          const txt = extractTargetTextFromEl(resolved);
          const r = resolved.getBoundingClientRect();
          const vw = Math.max(1, window.innerWidth || 360);
          const vh = Math.max(1, window.innerHeight || 640);
          anchor.el = resolved;
          anchor.manual = true;
          anchor.selector = sel;
          anchor.text = txt;
          CFG.targetText = txt;
          CFG.targetSelector = sel;
          targetX = Math.round(r.left + r.width * 0.5);
          targetY = Math.round(r.top + r.height * 0.5);
          saveAnchor();
          syncTurboCfg(true, true);
          sendToTop({
            __TT_SNIFFER__: true,
            kind: 'IFRAME_ELEMENT_PICK',
            targetText: txt,
            targetSelector: sel,
            pctX: targetX / vw,
            pctY: targetY / vh
          });
          stopElementPickerMode(false);
          return;
        }
        applyPickedElementResult(resolved, cx, cy, false);
        stopElementPickerMode(true);
      };

      const onMove = (ev) => {
        if (!elementPickMode) return;
        const cx = typeof ev.clientX === 'number' ? ev.clientX : 0;
        const cy = typeof ev.clientY === 'number' ? ev.clientY : 0;
        if (pointerDragActive && Math.hypot(cx - startX, cy - startY) > 6) pointerDragMoved = true;
        if (isTopDoc && isOwnHudNode(ev.target)) return;
        let rawEl = deepElementFromPoint(docObj, cx, cy, false) || ev.target;
        let usedDoc = docObj;
        if (rawEl && rawEl.tagName === 'IFRAME') {
          try {
            if (rawEl.contentDocument) {
              const fr = rawEl.getBoundingClientRect();
              const innerEl = deepElementFromPoint(rawEl.contentDocument, cx - fr.left, cy - fr.top, false);
              if (innerEl) {
                rawEl = innerEl;
                usedDoc = rawEl.contentDocument;
              }
            }
          } catch {}
        }
        const resolved = resolveInteractiveTarget(rawEl, usedDoc);
        if (resolved) updateHighlight(resolved, cx, cy, usedDoc);
      };

      const blockOnly = (ev) => {
        if (!elementPickMode) return;
        if (isTopDoc && isOwnHudNode(ev.target)) return;
        if (ev.type === 'touchstart' && ev.touches && ev.touches[0]) {
          touchMoved = false;
          startX = ev.touches[0].clientX;
          startY = ev.touches[0].clientY;
          onMove({ clientX: startX, clientY: startY, target: ev.target });
        } else if (ev.type === 'pointerdown' || ev.type === 'mousedown') {
          pointerDragActive = true;
          pointerDragMoved = false;
          startX = typeof ev.clientX === 'number' ? ev.clientX : 0;
          startY = typeof ev.clientY === 'number' ? ev.clientY : 0;
          onMove({ clientX: startX, clientY: startY, target: ev.target });
        }
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
      };

      const onPointerUp = (ev) => {
        if (!elementPickMode) return;
        if (isTopDoc && isOwnHudNode(ev.target)) {
          pointerDragActive = false;
          return;
        }
        if (pointerDragActive && pointerDragMoved) {
          pointerDragActive = false;
          pointerDragMoved = false;
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          pickAt(ev.clientX, ev.clientY, ev);
          return;
        }
        pointerDragActive = false;
      };

      const onTouchMove = (ev) => {
        if (!elementPickMode || !ev.touches || !ev.touches[0]) return;
        const t = ev.touches[0];
        if (Math.hypot(t.clientX - startX, t.clientY - startY) > 10) touchMoved = true;
        onMove({ clientX: t.clientX, clientY: t.clientY, target: ev.target });
      };

      const onTouchEnd = (ev) => {
        if (!elementPickMode) return;
        if (isTopDoc && isOwnHudNode(ev.target)) return;
        const t = (ev.changedTouches && ev.changedTouches[0]) || null;
        if (!t) return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        pickAt(t.clientX, t.clientY, ev);
      };

      const onClick = (ev) => {
        if (!elementPickMode) return;
        if (isTopDoc && isOwnHudNode(ev.target)) return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        if (Date.now() - justPickedAt < 250) return;
        pickAt(ev.clientX, ev.clientY, ev);
      };

      const onKeyDown = (ev) => {
        if (!elementPickMode) return;
        if (ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopPropagation();
          stopElementPickerMode(true);
        }
      };

      docObj.addEventListener('pointermove', onMove, true);
      docObj.addEventListener('mousemove', onMove, true);
      docObj.addEventListener('pointerdown', blockOnly, true);
      docObj.addEventListener('mousedown', blockOnly, true);
      docObj.addEventListener('mouseup', onPointerUp, true);
      docObj.addEventListener('touchstart', blockOnly, { capture: true, passive: false });
      docObj.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
      docObj.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
      docObj.addEventListener('click', onClick, true);
      docObj.addEventListener('keydown', onKeyDown, true);

      pickCleanupFns.push(() => {
        docObj.removeEventListener('pointermove', onMove, true);
        docObj.removeEventListener('mousemove', onMove, true);
        docObj.removeEventListener('pointerdown', blockOnly, true);
        docObj.removeEventListener('mousedown', blockOnly, true);
        docObj.removeEventListener('mouseup', onPointerUp, true);
        docObj.removeEventListener('touchstart', blockOnly, true);
        docObj.removeEventListener('touchmove', onTouchMove, true);
        docObj.removeEventListener('touchend', onTouchEnd, true);
        docObj.removeEventListener('click', onClick, true);
        docObj.removeEventListener('keydown', onKeyDown, true);
      });
    };

    attachDocListeners(document, true);
    try {
      const frames = document.querySelectorAll('iframe');
      for (let i = 0; i < frames.length; i++) {
        try {
          if (frames[i].contentDocument) attachDocListeners(frames[i].contentDocument, false);
        } catch {}
      }
    } catch {}

    if (!fromRemoteOrTop) {
      broadcastDownToIframes({ __TT_SNIFFER__: true, kind: 'START_PICKER' });
    }
    if (!hudHidden) syncUI();
  }

  bindTap(elLock, () => {
    locked = !locked;
    anchor.lockedExplicit = Boolean(locked);
    if (locked) {
      captureAnchorAtPoint(true);
    } else {
      saveAnchor();
    }
    persistHudControlState();
    markUserTouched();
    syncUI();
    syncTurboCfg(true, true);
    if (!hudHidden) syncIframeLocalTargets(true);
  });
  bindTap(elPickEl, () => {
    markUserTouched();
    startElementPickerMode(false);
  });
  bindTap(elCenter, () => {
    locked = false;
    anchor.lockedExplicit = false;
    persistHudControlState();
    markUserTouched();
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    const visH = Math.min(vh, getSafeVisibleHeight());
    const pRect = panel.getBoundingClientRect ? panel.getBoundingClientRect() : { bottom: 54, height: 40 };
    const safeTop = Math.max(90, Math.round((pRect.height > 0 && pRect.bottom < visH - 90 ? pRect.bottom : 54) + 56));
    targetX = Math.round(vw * 0.5);
    targetY = Math.round(Math.max(safeTop, Math.min(visH - half, visH * 0.56)));
    clampTarget();
    anchor.el = null;
    anchor.slotEl = null;
    anchor.slotSelector = '';
    anchor.slotStructPath = '';
    anchor.structPath = '';
    anchor.manual = true;
    anchor.selector = '';
    anchor.text = '';
    anchor.absX = targetX;
    anchor.absY = targetY;
    anchor.baseVw = vw;
    anchor.baseVh = vh;
    anchor.scrollX = window.scrollX || 0;
    anchor.scrollY = window.scrollY || 0;
    anchor.pctX = targetX / Math.max(1, vw);
    anchor.pctY = targetY / Math.max(1, visH);
    crosshair.style.display = 'flex';
    crosshair.style.visibility = '';
    crosshair.style.left = (targetX - half) + 'px';
    crosshair.style.top = (targetY - half) + 'px';
    saveAnchor();
    syncUI();
    syncTurboCfg(true, true);
  });
  elSearch.addEventListener('input', () => { feedQuery = elSearch.value.trim().toLowerCase(); markUserTouched(); renderLogs(true); });
  elSearch.addEventListener('focus', () => { markUserTouched(); });
  elSrcFilter.addEventListener('change', () => { feedSrcFilter = elSrcFilter.value; markUserTouched(); renderLogs(true); });
  bindTap(elSearchClear, () => {
    elSearch.value = '';
    feedQuery = '';
    feedSrcFilter = 'all';
    elSrcFilter.value = 'all';
    markUserTouched();
    renderLogs(true);
  });
  bindTap(elRaceToggle, () => {
    showRaceTimeline = !showRaceTimeline;
    markUserTouched();
    updateRaceBoxUI();
  });
  const toggleSecLog = () => {
    showSecurityLog = !showSecurityLog;
    markUserTouched();
    updateSecurityLogUI();
  };
  bindTap(elSecHdr, toggleSecLog);
  bindTap(elSecClear, (ev) => {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    securityLogs.length = 0;
    secLatencyDeltas.length = 0;
    markUserTouched();
    updateSecurityLogUI();
  });
  bindTap(elFreeze, () => { feedFrozen = !feedFrozen; markUserTouched(); syncUI(); if (!feedFrozen) renderLogs(true); });
  const isApiSrc = (s) => (s === 'API-REQ' || s === 'API-RES' || s === 'TAP-RES' || s === 'TAP-NET');
  const pushPreservedLogs = (item) => {
    if (!item) return;
    if (item.inspectorMatched || item.matched) {
      triggeredLogs.unshift(item);
      if (triggeredLogs.length > 150) triggeredLogs.length = 150;
    }
    if (item.matched) {
      hitLogs.unshift(item);
      if (hitLogs.length > 150) hitLogs.length = 150;
    }
  };
  bindTap(elClear, () => {
    markUserTouched();
    if (activeTab === 'tags') {
      liveTagMap.clear();
      liveTagList.length = 0;
      preCrashTags.length = 0;
      tagRoundCount = 0;
      lastTagRoundEndMono = 0;
      currentRoundStartMono = 0;
      currentRoundMsgSeq = 0;
      tagFlightSeenInRound = false;
      currentRoundTagEntries.clear();
      aiCurRoundFrames.length = 0;
      aiCurRoundRawCount = 0;
      aiLastRoundFrames = [];
      aiLastRoundRawCount = 0;
      aiHudAnalysis = null;
      aiHudError = '';
    } else if (activeTab === 'api') {
      apiLogs.length = 0;
      totalApiCount = 0;
      for (let i = triggeredLogs.length - 1; i >= 0; i--) { if (isApiSrc(triggeredLogs[i].src)) triggeredLogs.splice(i, 1); }
      for (let i = hitLogs.length - 1; i >= 0; i--) { if (isApiSrc(hitLogs[i].src)) hitLogs.splice(i, 1); }
    } else {
      wsLogs.length = 0;
      totalWsCount = 0;
      raceTimeline.length = 0;
      lastClickRace = null;
      latencySamples.length = 0;
      securityLogs.length = 0;
      secLatencyDeltas.length = 0;
      lastReactionMsStr = '0.00';
      for (let i = triggeredLogs.length - 1; i >= 0; i--) { if (!isApiSrc(triggeredLogs[i].src)) triggeredLogs.splice(i, 1); }
      for (let i = hitLogs.length - 1; i >= 0; i--) { if (!isApiSrc(hitLogs[i].src)) hitLogs.splice(i, 1); }
      updateRaceBoxUI();
      updateLatencyGaugeUI();
      updateSecurityLogUI();
    }
    if (elPeek) { elPeek.textContent = ''; elPeek.style.display = 'none'; }
    renderLogs(true);
  });
  bindTap(elExp, () => { expandedView = !expandedView; markUserTouched(); syncUI(); });
  bindTap(elTabWs, () => { activeTab = 'ws'; markUserTouched(); syncUI(); renderLogs(true); });
  bindTap(elTabApi, () => { activeTab = 'api'; markUserTouched(); syncUI(); renderLogs(true); });
  bindTap(elTabTags, () => { activeTab = 'tags'; markUserTouched(); syncUI(); renderLogs(true); });
  bindTap(elMin, () => {
    minimized = !minimized;
    markUserTouched();
    elBody.style.display = minimized ? 'none' : 'flex';
    elMin.textContent = minimized ? '+' : '—';
    if (!minimized && showLogs) renderLogs(true);
  });
  bindTap(elClose, () => {
    userClosed = true;
    try { (WIN.__TRIGGERTAP_DESTROY__ || window.__TRIGGERTAP_DESTROY__)(); } catch {}
  });
  bindTap(elToggleFeed, () => {
    showLogs = !showLogs;
    markUserTouched();
    syncUI();
    if (showLogs) renderLogs(true);
  });
  bindTap(elExportLog, () => {
    markUserTouched();
    const rawPool = feedSrcFilter === 'triggered'
      ? triggeredLogs.filter((e) => (activeTab === 'api' ? isApiSrc(e.src) : !isApiSrc(e.src)))
      : feedSrcFilter === 'hit'
      ? hitLogs.filter((e) => (activeTab === 'api' ? isApiSrc(e.src) : !isApiSrc(e.src)))
      : (activeTab === 'api' ? apiLogs : wsLogs);
    const list = rawPool.slice().reverse();
    const todayPrefix = new Date().toISOString().slice(0, 10) + ' ';
    const outLines = [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e) continue;
      if (feedSrcFilter === 'triggered' && !e.inspectorMatched && !e.matched) continue;
      const dir = e.direction || srcToDirection(e.src);
      const rs = (e.reasons && e.reasons.length) ? e.reasons : (e.matched ? ['tag:' + (e.matchedTag || 'hit')] : []);
      const statusTxt = rs.length ? ('TRIGGERED [' + rs.join(', ') + ']') : 'PASSED';
      const singleLine = String(e.text || '').replace(/\r\n/g, '\n').replace(/\n/g, ' \\n ');
      outLines.push(todayPrefix + (e.time || '') + ' | ' + dir + ' | ' + statusTxt + ' | ' + singleLine);
    }
    const content = outLines.join('\n') + (outLines.length ? '\n' : '');
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'intercepted_messages_' + String(CFG.roomId || 'ws').toLowerCase() + '.log';
      (document.body || document.documentElement).appendChild(a);
      a.click();
      if (a.parentNode) a.parentNode.removeChild(a);
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 1000);
      elExportLog.textContent = '✓';
      setTimeout(() => { elExportLog.textContent = '.log'; }, 900);
    } catch {}
  });

  function applyTagToInput(tagText, appendMode, btnEl) {
    CFG.manualTagPin = true;
    if (!tagText) return;
    if (appendMode) {
      const existing = parseTagList(elTags.value || CFG.tags || '');
      if (existing.indexOf(tagText) === -1) existing.push(tagText);
      const joined = existing.join(', ');
      elTags.value = joined;
      CFG.tags = joined;
    } else {
      elTags.value = tagText;
      CFG.tags = tagText;
    }
    if (lastHitTag === 'TEST') lastHitTag = '';
    lastMatchPreview = '';
    roundClickLocked = false;
    roundSawFlightAfterLock = false;
    roundSawCrashAfterLock = false;
    roundClickLockedRoundId = '';
    roundUnlockSeq += 1;
    lastUserCfgEditAt = Date.now();
    markUserTouched();
    if (CFG.autoConfigOnTag !== false) {
      applyAutoTagConfig('TAG_SET');
    }
    persistHudControlState();
    syncUI();
    syncTurboCfg(true, true);
    if (activeTab === 'tags') renderLogs(true);
    if (btnEl) {
      const prevTxt = btnEl.textContent;
      btnEl.textContent = '✓';
      setTimeout(() => { btnEl.textContent = prevTxt; }, 900);
    }
  }

  function renderTagFinder() {
    const activeConfiguredTags = new Set(parseTagList((elTags && elTags.value) || CFG.tags || ''));
    const hasConfirmedLateTag = preCrashTags.some((p) => (p && p.roundsCount >= 2));
    const roundStrip = document.createElement('div');
    const progReady = tagRoundCount >= 3 && hasConfirmedLateTag;
    const progAlmost = tagRoundCount === 2 || (tagRoundCount >= 3 && preCrashTags.length > 0 && !hasConfirmedLateTag);
    roundStrip.style.cssText = 'padding:5px 7px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap;' + (
      progReady
        ? 'background:rgba(239,68,68,0.16);color:#fecaca;border-left:3px solid #ef4444;'
        : progAlmost
        ? 'background:rgba(245,158,11,0.14);color:#fde68a;border-left:3px solid #f59e0b;'
        : 'background:rgba(56,189,248,0.1);color:#bae6fd;border-left:3px solid #38bdf8;'
    );
    const roundStripTxt = document.createElement('span');
    roundStripTxt.style.cssText = 'flex:1;min-width:140px;line-height:1.35;';
    roundStripTxt.textContent = progReady
      ? T.roundProgReady.replace('{n}', String(tagRoundCount))
      : progAlmost
      ? T.roundProgAlmost
      : T.roundProgWait.replace('{n}', String(tagRoundCount));
    const rtfEndBtn = document.createElement('button');
    rtfEndBtn.type = 'button';
    rtfEndBtn.textContent = T.rtfEndRoundBtn || 'End Round [F8]';
    rtfEndBtn.style.cssText = 'background:#0284c7;color:#ffffff;border:none;border-radius:4px;padding:3px 7px;font-size:9.5px;font-weight:700;cursor:pointer;touch-action:manipulation;white-space:nowrap;flex-shrink:0;';
    rtfEndBtn.onclick = (e) => {
      e.stopPropagation();
      markManualRoundEnd('HUD_BTN');
    };
    roundStrip.appendChild(roundStripTxt);
    roundStrip.appendChild(rtfEndBtn);
    elLogs.appendChild(roundStrip);

    // AI Round SMS Checker Bar inside 🏷 ট্যাগ
    const useCurrentAiBuf = aiCurRoundFrames.length >= 4 || aiLastRoundFrames.length === 0;
    const aiAvailRaw = useCurrentAiBuf ? Math.max(aiCurRoundRawCount, aiCurRoundFrames.length) : Math.max(aiLastRoundRawCount, aiLastRoundFrames.length);
    const aiAvailMsgs = useCurrentAiBuf
      ? sliceFramesForSmartSegmenter(aiCurRoundFrames, aiAvailRaw)
      : sliceFramesForSmartSegmenter(aiLastRoundFrames, aiAvailRaw);
    const hudSegWin = getSmartSegmentWindow(aiAvailRaw);
    const aiCard = document.createElement('div');
    aiCard.style.cssText = 'padding:6px 7px;border-bottom:1px solid rgba(139,92,246,0.3);background:rgba(139,92,246,0.08);display:flex;flex-direction:column;gap:5px;';

    const aiTop = document.createElement('div');
    aiTop.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap;';

    const aiTitle = document.createElement('span');
    aiTitle.style.cssText = 'font-size:10px;font-weight:700;color:#ddd6fe;';
    aiTitle.textContent = CFG.lang === 'bn'
      ? ('✨ AI SMS চেকার (' + aiAvailMsgs.length + (hudSegWin.active ? ('/' + aiAvailRaw) : '') + 'টি SMS)')
      : ('✨ AI SMS Checker (' + aiAvailMsgs.length + (hudSegWin.active ? ('/' + aiAvailRaw) : '') + ' SMS)');

    const aiCtrls = document.createElement('div');
    aiCtrls.style.cssText = 'display:flex;align-items:center;gap:6px;';

    const aiAutoLbl = document.createElement('label');
    aiAutoLbl.style.cssText = 'display:inline-flex;align-items:center;gap:3px;font-size:9.5px;color:#cbd5e1;cursor:pointer;user-select:none;';
    const aiAutoChk = document.createElement('input');
    aiAutoChk.type = 'checkbox';
    aiAutoChk.checked = Boolean(aiHudAuto);
    aiAutoChk.onchange = (e) => {
      e.stopPropagation();
      aiHudAuto = Boolean(aiAutoChk.checked);
    };
    const aiAutoTxt = document.createElement('span');
    aiAutoTxt.textContent = CFG.lang === 'bn' ? 'অটো AI' : 'Auto AI';
    aiAutoLbl.appendChild(aiAutoChk);
    aiAutoLbl.appendChild(aiAutoTxt);

    const aiBtn = document.createElement('button');
    aiBtn.type = 'button';
    aiBtn.disabled = Boolean(aiHudLoading);
    aiBtn.textContent = aiHudLoading
      ? (CFG.lang === 'bn' ? '⏳ চেক হচ্ছে...' : '⏳ Checking...')
      : (CFG.lang === 'bn' ? '✨ AI দিয়ে চেক' : '✨ AI Check');
    aiBtn.style.cssText = 'background:#7c3aed;color:#ffffff;border:none;border-radius:4px;padding:3px 7px;font-size:9.5px;font-weight:700;cursor:pointer;touch-action:manipulation;opacity:' + (aiHudLoading ? '0.65' : '1') + ';';
    aiBtn.onclick = (e) => {
      e.stopPropagation();
      if (typeof runHudAiRoundCheck === 'function') runHudAiRoundCheck();
    };

    aiCtrls.appendChild(aiAutoLbl);
    aiCtrls.appendChild(aiBtn);
    aiTop.appendChild(aiTitle);
    aiTop.appendChild(aiCtrls);
    aiCard.appendChild(aiTop);

    // Smart SMS Segmenter Config Strip
    const segBar = document.createElement('div');
    segBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap;padding:3px 5px;border-radius:4px;background:rgba(15,23,42,0.75);border:1px solid rgba(56,189,248,0.25);font-size:9.5px;color:#bae6fd;';
    const segLeft = document.createElement('label');
    segLeft.style.cssText = 'display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-weight:700;user-select:none;';
    const segChk = document.createElement('input');
    segChk.type = 'checkbox';
    segChk.checked = Boolean(CFG.smartSmsSegmenter);
    const segLblTxt = document.createElement('span');
    segLblTxt.textContent = CFG.lang === 'bn' ? 'স্মার্ট সেগমেন্টার (শেষ ৫০%)' : 'Smart Segmenter (Last 50%)';
    segLeft.appendChild(segChk);
    segLeft.appendChild(segLblTxt);

    const segRight = document.createElement('div');
    segRight.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const mkSegInp = (val, minV, maxV, onUpd) => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = String(minV);
      inp.max = String(maxV);
      inp.value = String(val);
      inp.style.cssText = 'width:40px;background:#0b1120;color:#7dd3fc;border:1px solid rgba(56,189,248,0.35);border-radius:3px;padding:1px 3px;font-family:monospace;font-size:9.5px;text-align:center;';
      ['pointerdown', 'touchstart', 'mousedown'].forEach((evN) => inp.addEventListener(evN, (ev) => ev.stopPropagation(), true));
      inp.onchange = (e) => {
        e.stopPropagation();
        onUpd(Number(inp.value));
      };
      return inp;
    };
    const thrSep = document.createElement('span');
    thrSep.textContent = '/';
    thrSep.style.color = '#64748b';
    const segStat = document.createElement('span');
    let thrInp = null;
    let totInp = null;
    const refreshSegBarInPlace = () => {
      const curSegWin = getSmartSegmentWindow(aiAvailRaw);
      const curAvailMsgs = useCurrentAiBuf
        ? sliceFramesForSmartSegmenter(aiCurRoundFrames, aiAvailRaw)
        : sliceFramesForSmartSegmenter(aiLastRoundFrames, aiAvailRaw);
      aiTitle.textContent = CFG.lang === 'bn'
        ? ('✨ AI SMS চেকার (' + curAvailMsgs.length + (curSegWin.active ? ('/' + aiAvailRaw) : '') + 'টি SMS)')
        : ('✨ AI SMS Checker (' + curAvailMsgs.length + (curSegWin.active ? ('/' + aiAvailRaw) : '') + ' SMS)');
      if (thrInp && document.activeElement !== thrInp) thrInp.value = String(CFG.smsSegmentThreshold || 30);
      if (totInp && document.activeElement !== totInp) totInp.value = String(CFG.smsExpectedTotal || 60);
      segStat.style.cssText = 'font-family:monospace;font-size:9px;padding:1px 4px;border-radius:3px;' + (
        curSegWin.active
          ? 'background:rgba(16,185,129,0.22);color:#6ee7b7;'
          : 'background:rgba(148,163,184,0.16);color:#cbd5e1;'
      );
      segStat.textContent = curSegWin.enabled
        ? (curSegWin.active
            ? ('Seg ' + curSegWin.rawCount + '/' + curSegWin.expectedTotal + ' · 50% (' + curSegWin.keepCount + ')')
            : ('Seg ' + curSegWin.rawCount + '/' + curSegWin.threshold))
        : 'OFF';
    };
    thrInp = mkSegInp(CFG.smsSegmentThreshold || 30, 2, 500, (n) => {
      CFG.smsSegmentThreshold = Math.max(2, Math.min(500, Math.round(n || 30)));
      if ((CFG.smsExpectedTotal || 60) < CFG.smsSegmentThreshold) CFG.smsExpectedTotal = CFG.smsSegmentThreshold * 2;
      lastUserCfgEditAt = Date.now();
      persistHudControlState();
      markUserTouched();
      syncTurboCfg(true, true);
      refreshSegBarInPlace();
    });
    totInp = mkSegInp(CFG.smsExpectedTotal || 60, 4, 1000, (n) => {
      CFG.smsExpectedTotal = Math.max(CFG.smsSegmentThreshold || 30, Math.min(1000, Math.round(n || 60)));
      lastUserCfgEditAt = Date.now();
      persistHudControlState();
      markUserTouched();
      syncTurboCfg(true, true);
      refreshSegBarInPlace();
    });
    segChk.onchange = (e) => {
      e.stopPropagation();
      CFG.smartSmsSegmenter = Boolean(segChk.checked);
      lastUserCfgEditAt = Date.now();
      persistHudControlState();
      markUserTouched();
      syncTurboCfg(true, true);
      refreshSegBarInPlace();
    };
    refreshSegBarInPlace();
    segRight.appendChild(thrInp);
    segRight.appendChild(thrSep);
    segRight.appendChild(totInp);
    segRight.appendChild(segStat);
    segBar.appendChild(segLeft);
    segBar.appendChild(segRight);
    aiCard.appendChild(segBar);

    if (aiHudError) {
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'padding:4px 6px;border-radius:4px;background:rgba(244,63,94,0.16);border:1px solid rgba(244,63,94,0.4);color:#fecdd3;font-size:9.5px;';
      errDiv.textContent = aiHudError;
      aiCard.appendChild(errDiv);
    }

    if (aiHudAnalysis) {
      const metaDiv = document.createElement('div');
      metaDiv.style.cssText = 'font-size:9.5px;color:#e2e8f0;line-height:1.4;';
      metaDiv.textContent = aiHudAnalysis.summaryBn || '';
      aiCard.appendChild(metaDiv);

      const recs = Array.isArray(aiHudAnalysis.recommendedTags) ? aiHudAnalysis.recommendedTags : [];
      for (let ri = 0; ri < recs.length; ri++) {
        const rec = recs[ri];
        const rBox = document.createElement('div');
        rBox.style.cssText = 'padding:5px 6px;border-radius:5px;background:rgba(15,23,42,0.85);border:1px solid rgba(16,185,129,0.35);display:flex;flex-direction:column;gap:3px;';
        const rTop = document.createElement('div');
        rTop.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap;';
        const rBadge = document.createElement('span');
        rBadge.style.cssText = 'font-size:9px;font-weight:700;color:#6ee7b7;';
        rBadge.textContent = rec.category + ' · ' + (CFG.lang === 'bn' ? ('শেষ থেকে #' + rec.positionFromEnd) : ('#' + rec.positionFromEnd + ' from end')) + ' · ' + rec.countInRound + '×/R';
        const rBtns = document.createElement('div');
        rBtns.style.cssText = 'display:flex;gap:3px;';
        const rUse = document.createElement('button');
        rUse.type = 'button';
        rUse.textContent = T.useTag;
        rUse.style.cssText = 'background:#10b981;color:#052e16;border:none;border-radius:4px;padding:1.5px 5px;font-size:9px;font-weight:800;cursor:pointer;';
        rUse.onclick = (e) => {
          e.stopPropagation();
          CFG.roundOnce = true;
          if (elMode && CFG.matchMode !== 'contains' && CFG.matchMode !== 'json') {
            CFG.matchMode = 'contains';
            elMode.value = 'contains';
          }
          persistHudControlState();
          applyTagToInput(rec.tag, false, rUse);
        };
        const rAdd = document.createElement('button');
        rAdd.type = 'button';
        rAdd.textContent = T.addTag;
        rAdd.style.cssText = 'background:rgba(99,102,241,0.3);color:#e0e7ff;border:none;border-radius:4px;padding:1.5px 5px;font-size:9px;font-weight:700;cursor:pointer;';
        rAdd.onclick = (e) => { e.stopPropagation(); applyTagToInput(rec.tag, true, rAdd); };
        rBtns.appendChild(rUse);
        rBtns.appendChild(rAdd);
        rTop.appendChild(rBadge);
        rTop.appendChild(rBtns);

        const rCode = document.createElement('div');
        rCode.style.cssText = 'font-family:monospace;font-size:10.5px;font-weight:700;color:#fef08a;word-break:break-all;';
        rCode.textContent = rec.tag;
        const rWhy = document.createElement('div');
        rWhy.style.cssText = 'font-size:9.5px;color:#cbd5e1;';
        rWhy.textContent = rec.reasonBn || '';
        rBox.appendChild(rTop);
        rBox.appendChild(rCode);
        if (rec.reasonBn) rBox.appendChild(rWhy);
        aiCard.appendChild(rBox);
      }
    }
    elLogs.appendChild(aiCard);

    if (!liveTagList.length && !preCrashTags.length && !aiHudAnalysis) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:14px 8px;text-align:center;color:#94a3b8;font-size:11px;line-height:1.45;';
      empty.textContent = T.emptyTags;
      elLogs.appendChild(empty);
      return;
    }

    const isRtfFilterMatch = (srcStr) => {
      if (feedSrcFilter === 'sms') return (srcStr === 'SMS/DOM' || srcStr === 'DOM-TAG');
      if (feedSrcFilter === 'css') return srcStr === 'CSS-STATE';
      if (feedSrcFilter === 'js') return srcStr === 'JS-HOOK';
      if (feedSrcFilter === 'api') return (srcStr === 'API-RES' || srcStr === 'TAP-RES' || srcStr === 'API-REQ' || srcStr === 'API-SIG');
      if (feedSrcFilter === 'rtf') return (srcStr === 'CSS-STATE' || srcStr === 'JS-HOOK' || srcStr === 'DOM-TAG' || srcStr === 'SMS/DOM' || srcStr === 'API-RES' || srcStr === 'TAP-RES' || srcStr === 'API-SIG');
      if (feedSrcFilter === 'ws') return (srcStr === 'WS-IN' || srcStr === 'WS-OUT' || srcStr === 'SSE' || srcStr === 'WORKER' || srcStr === 'TAP-RTC' || srcStr === 'TAP-WT' || srcStr === 'TAP-PM');
      return true;
    };

    const filterMatch = (tagStr, srcStr, catStr, sampleStr) => {
      if (!isRtfFilterMatch(srcStr)) return false;
      if (feedQuery) {
        const hay = (tagStr + ' ' + srcStr + ' ' + catStr + ' ' + (sampleStr || '')).toLowerCase();
        if (hay.indexOf(feedQuery) === -1) return false;
      }
      return true;
    };

    const fmtPreCrashTime = (msVal) => {
      const m = Math.max(0, Math.round(Number(msVal) || 0));
      if (m >= 1000) return (m / 1000).toFixed(2) + 's (' + m + 'ms)';
      return m + 'ms';
    };

    const buildTagRow = (opts) => {
      const isInUse = activeConfiguredTags.has(opts.tag);
      const isEarlyRepeat = Boolean(opts.isEarlyOrContinuous) || (opts.maxRoundTicks > 1) || (opts.avgRoundTicks > 1);
      const isNonCash = Boolean(opts.isNonCashoutPhase);
      const isRecUse = !opts.isCrash && !isNonCash && !isEarlyRepeat && (opts.isRecommended || (opts.roundsCount >= 2));
      const hasRedMark = isInUse || isRecUse;
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 7px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;gap:4px;' +
        (hasRedMark ? 'border-left:3.5px solid #ef4444;background:rgba(239,68,68,0.10);' : (opts.highlightBg ? ('background:' + opts.highlightBg + ';') : ''));

      const top = document.createElement('div');
      top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap;';

      const leftMeta = document.createElement('div');
      leftMeta.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:9.5px;font-weight:700;';

      if (hasRedMark) {
        const redMark = document.createElement('span');
        redMark.style.cssText = 'padding:1px 6px;border-radius:999px;background:#ef4444;color:#ffffff;font-weight:800;letter-spacing:0.2px;box-shadow:0 0 8px rgba(239,68,68,0.55);';
        redMark.textContent = isInUse ? T.tagActiveRed : T.tagRecRed;
        leftMeta.appendChild(redMark);
      }

      const catColor = opts.cat === 'FULL-WS' ? '#60a5fa' : opts.cat === 'JSON-SMS' ? '#34d399' : opts.cat === 'EVENT' ? '#38bdf8' : opts.cat === 'FLAG' ? '#c084fc' : opts.cat === 'HASH' ? '#2dd4bf' : (opts.cat === 'API' || opts.cat === 'API-SIG') ? '#fbbf24' : (opts.cat === 'DOM' || opts.cat === 'DOM-TAG') ? '#38bdf8' : opts.cat === 'CSS-STATE' ? '#f472b6' : opts.cat === 'JS-HOOK' ? '#a78bfa' : opts.cat === 'KEY' ? '#f97316' : '#4ade80';
      const catPill = document.createElement('span');
      catPill.style.cssText = 'padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.08);color:' + catColor + ';';
      catPill.textContent = opts.cat + ' · ' + opts.src;
      leftMeta.appendChild(catPill);

      const statusBadge = document.createElement('span');
      const phaseLbl = (opts.phase === 'mid-round' && T.tagMidRound) ? T.tagMidRound : T.tagPreCrash;
      if (opts.isCrash) {
        statusBadge.style.cssText = 'padding:1px 5px;border-radius:4px;background:rgba(148,163,184,0.16);color:#cbd5e1;';
        statusBadge.textContent = T.tagPostCrash;
      } else if (isNonCash) {
        statusBadge.style.cssText = 'padding:1px 5px;border-radius:4px;background:rgba(148,163,184,0.14);color:#94a3b8;';
        statusBadge.textContent = T.tagPhaseWait + (opts.count ? (' ×' + opts.count) : '');
      } else if (isEarlyRepeat) {
        statusBadge.style.cssText = 'padding:1px 5px;border-radius:4px;background:rgba(245,158,11,0.16);color:#fbbf24;';
        const maxTk = opts.maxRoundTicks > 1 ? opts.maxRoundTicks : Math.max(2, Math.round(opts.avgRoundTicks || 2));
        statusBadge.textContent = T.tagEarlyWarn + ' (' + maxTk + '×/R)';
      } else if (opts.roundsCount >= 1) {
        statusBadge.style.cssText = 'padding:1px 5px;border-radius:4px;background:rgba(16,185,129,0.2);color:#6ee7b7;';
        statusBadge.textContent = opts.roundsCount + 'R · ' + phaseLbl;
      } else if (opts.deltaMs != null) {
        statusBadge.style.cssText = 'padding:1px 5px;border-radius:4px;background:rgba(16,185,129,0.2);color:#6ee7b7;';
        statusBadge.textContent = phaseLbl;
      } else {
        statusBadge.style.cssText = 'padding:1px 5px;border-radius:4px;background:rgba(56,189,248,0.14);color:#bae6fd;';
        statusBadge.textContent = T.tagLive + (opts.count ? (' ×' + opts.count) : '');
      }
      leftMeta.appendChild(statusBadge);

      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';

      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.textContent = T.useTag;
      useBtn.style.cssText = (isInUse
        ? 'background:#ef4444;color:#ffffff;'
        : 'background:rgba(34,197,94,0.22);color:#86efac;') + 'border:none;border-radius:4px;padding:2px 6px;font-size:9.5px;font-weight:700;cursor:pointer;touch-action:manipulation;';
      useBtn.onclick = (e) => {
        e.stopPropagation();
        CFG.roundOnce = true;
        if (elMode && CFG.matchMode !== 'contains' && CFG.matchMode !== 'json') {
          CFG.matchMode = 'contains';
          elMode.value = 'contains';
        }
        persistHudControlState();
        applyTagToInput(opts.tag, false, useBtn);
      };

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = T.addTag;
      addBtn.style.cssText = 'background:rgba(99,102,241,0.22);color:#c7d2fe;border:none;border-radius:4px;padding:2px 6px;font-size:9.5px;font-weight:700;cursor:pointer;touch-action:manipulation;';
      addBtn.onclick = (e) => { e.stopPropagation(); applyTagToInput(opts.tag, true, addBtn); };

      const cpBtn = document.createElement('button');
      cpBtn.type = 'button';
      cpBtn.textContent = 'Copy';
      cpBtn.style.cssText = 'background:rgba(255,255,255,0.08);color:#cbd5e1;border:none;border-radius:4px;padding:2px 5px;font-size:9.5px;cursor:pointer;touch-action:manipulation;';
      cpBtn.onclick = (e) => {
        e.stopPropagation();
        copyTextSafe(opts.tag);
        cpBtn.textContent = '✓';
        setTimeout(() => { cpBtn.textContent = 'Copy'; }, 800);
      };

      btns.appendChild(useBtn);
      btns.appendChild(addBtn);
      btns.appendChild(cpBtn);
      top.appendChild(leftMeta);
      top.appendChild(btns);

      const codeWrap = document.createElement('div');
      codeWrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;';
      const code = document.createElement('div');
      code.style.cssText = 'font-family:monospace;font-size:10.5px;font-weight:700;word-break:break-all;max-height:64px;overflow-y:auto;padding:3px 5px;border-radius:4px;background:rgba(15,23,42,0.7);flex:1;color:' + (hasRedMark ? '#fecaca' : isEarlyRepeat ? '#94a3b8' : '#fef08a') + ';';
      code.textContent = opts.tag;
      code.title = CFG.lang === 'bn' ? 'পূর্ণ Full WS JSON SMS দেখতে/কপি করতে ট্যাপ করুন' : 'Tap to toggle full SMS view';
      code.onclick = (e) => {
        e.stopPropagation();
        code.style.maxHeight = code.style.maxHeight === 'none' ? '64px' : 'none';
      };
      codeWrap.appendChild(code);
      if (hasRedMark) {
        const sideDot = document.createElement('span');
        sideDot.style.cssText = 'width:10px;height:10px;border-radius:999px;background:#ef4444;flex-shrink:0;box-shadow:0 0 8px #ef4444;border:1.5px solid #fecaca;';
        codeWrap.appendChild(sideDot);
      }

      row.appendChild(top);
      row.appendChild(codeWrap);

      if (!opts.isCrash && !isNonCash && !isEarlyRepeat && opts.deltaMs != null) {
        const infoStrip = document.createElement('div');
        infoStrip.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap;font-size:9.5px;line-height:1.35;padding:3px 6px;border-radius:4px;background:rgba(15,23,42,0.58);border:1px solid rgba(16,185,129,0.22);';
        let dtText = fmtPreCrashTime(opts.deltaMs);
        if (opts.minDeltaMs != null && opts.maxDeltaMs != null && Math.abs(opts.maxDeltaMs - opts.minDeltaMs) >= 35) {
          dtText = fmtPreCrashTime(opts.minDeltaMs) + '–' + fmtPreCrashTime(opts.maxDeltaMs);
        }
        const timeSpan = document.createElement('span');
        timeSpan.style.cssText = 'color:#fde047;font-weight:700;';
        let timeFull = T.tagTimeBefore.replace('{dt}', dtText);
        if (opts.lastPosFromCrash != null && opts.lastPosFromCrash > 0) {
          const posLabel = opts.phase === 'mid-round' && opts.lastRoundTotalMsgs > 0
            ? T.tagPosMid.replace('{pos}', String(Math.max(1, opts.lastRoundTotalMsgs - opts.lastPosFromCrash + 1))).replace('{tot}', String(opts.lastRoundTotalMsgs))
            : T.tagPosLast.replace('{pos}', String(opts.lastPosFromCrash));
          timeFull += ' · ' + posLabel;
        }
        timeSpan.textContent = timeFull;
        infoStrip.appendChild(timeSpan);

        const guarSpan = document.createElement('span');
        const hasShortLong = Boolean((opts.shortRoundHits || 0) > 0 && (opts.longRoundHits || 0) > 0);
        const minAcceptMs = opts.reqAcceptMs || 120;
        const minDt = opts.minDeltaMs != null ? opts.minDeltaMs : opts.deltaMs;
        const srvTight = minDt != null && minDt < minAcceptMs;
        guarSpan.style.cssText = srvTight
          ? 'color:#fbbf24;font-weight:800;'
          : (opts.roundsCount >= 2 ? 'color:#6ee7b7;font-weight:800;' : 'color:#fde68a;font-weight:700;');
        const rndCovLbl = hasShortLong
          ? (CFG.lang === 'bn' ? ' · ছোট+বড়✓' : ' · S+L✓')
          : ((opts.shortRoundHits || 0) > 0 ? (CFG.lang === 'bn' ? ' · ছোটR' : ' · ShortR') : ((opts.longRoundHits || 0) > 0 ? (CFG.lang === 'bn' ? ' · বড়R' : ' · LongR') : ''));
        const srvOkLbl = srvTight
          ? (CFG.lang === 'bn' ? (' · ⚠দ্রুত<' + minAcceptMs + 'ms') : (' · ⚠<' + minAcceptMs + 'ms'))
          : (CFG.lang === 'bn' ? ' · সারভার✓' : ' · Srv✓');
        guarSpan.textContent = (opts.roundsCount >= 2 ? T.tagGuaranteeOnce : T.tagFirstRoundOnce) + rndCovLbl + srvOkLbl;
        infoStrip.appendChild(guarSpan);
        row.appendChild(infoStrip);
      }

      if (opts.sample) {
        const sub = document.createElement('div');
        sub.style.cssText = 'font-family:monospace;font-size:9.5px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        sub.textContent = opts.sample;
        row.appendChild(sub);
      }
      return row;
    };

    let renderedCount = 0;
    const filteredPre = preCrashTags.filter((p) => filterMatch(p.tag, p.src, p.category, p.sample || ''));
    if (filteredPre.length) {
      const hdrPre = document.createElement('div');
      hdrPre.style.cssText = 'padding:5px 7px;background:rgba(16,185,129,0.14);color:#6ee7b7;font-size:10px;font-weight:700;border-bottom:1px solid rgba(16,185,129,0.25);display:flex;align-items:center;justify-content:space-between;gap:6px;';
      const hdrPreTxt = document.createElement('span');
      hdrPreTxt.textContent = T.preCrashHdr + ' (' + filteredPre.length + ')';
      hdrPre.appendChild(hdrPreTxt);
      const manualHint = document.createElement('span');
      manualHint.style.cssText = 'font-size:9px;font-weight:700;color:#cbd5e1;opacity:0.9;';
      manualHint.textContent = CFG.lang === 'bn' ? 'ম্যানুয়াল: Use / Copy চাপুন' : 'Manual: click Use / Copy';
      hdrPre.appendChild(manualHint);
      elLogs.appendChild(hdrPre);
      for (let i = 0; i < filteredPre.length; i++) {
        const p = filteredPre[i];
        const isTopPick = (p.roundsCount >= 2 && (p.maxRoundTicks || 1) <= 1 && (p.avgRoundTicks || 1) <= 1);
        elLogs.appendChild(buildTagRow({
          tag: p.tag,
          cat: p.category,
          src: p.src,
          deltaMs: p.avgDeltaMs != null ? p.avgDeltaMs : p.deltaMs,
          minDeltaMs: p.minDeltaMs,
          maxDeltaMs: p.maxDeltaMs,
          lastPosFromCrash: p.lastPosFromCrash,
          lastRoundTotalMsgs: p.lastRoundTotalMsgs,
          roundsCount: p.roundsCount || 1,
          shortRoundHits: p.shortRoundHits || 0,
          longRoundHits: p.longRoundHits || 0,
          reqAcceptMs: p.reqAcceptMs || 120,
          maxRoundTicks: p.maxRoundTicks || 1,
          avgRoundTicks: p.avgRoundTicks || 1,
          phase: p.phase || 'pre-crash',
          isEarlyOrContinuous: false,
          isRecommended: isTopPick,
          isCrash: false,
          sample: p.time ? ('Seen: ' + p.time + (p.sample ? (' · ' + p.sample) : '')) : (p.sample || ''),
          highlightBg: 'rgba(16,185,129,0.05)'
        }));
        renderedCount++;
      }
    } else if (tagRoundCount >= 2 && !feedQuery) {
      const hintBox = document.createElement('div');
      hintBox.style.cssText = 'padding:6px 8px;background:rgba(245,158,11,0.08);border-bottom:1px solid rgba(245,158,11,0.2);color:#cbd5e1;font-size:10px;line-height:1.4;';
      hintBox.textContent = T.noLateTagHint;
      elLogs.appendChild(hintBox);
    }

    const preTagSet = new Set(filteredPre.map((x) => x.tag));
    const sortedLive = liveTagList
      .filter((it) => !preTagSet.has(it.tag) && !isPureMultiplierTagText(it.tag) && filterMatch(it.tag, it.src, it.category, it.sample))
      .slice()
      .sort((a, b) => {
        const aUse = activeConfiguredTags.has(a.tag) ? 1 : 0;
        const bUse = activeConfiguredTags.has(b.tag) ? 1 : 0;
        if (bUse !== aUse) return bUse - aUse;
        const aR = (!a.isEarlyOrContinuous && a.preCrashRounds) ? a.preCrashRounds.size : 0;
        const bR = (!b.isEarlyOrContinuous && b.preCrashRounds) ? b.preCrashRounds.size : 0;
        if (bR !== aR) return bR - aR;
        const aEarly = (a.isEarlyOrContinuous || (a.maxRoundTicks && a.maxRoundTicks > 1) || a.avgRoundTicks > 1) ? 1 : 0;
        const bEarly = (b.isEarlyOrContinuous || (b.maxRoundTicks && b.maxRoundTicks > 1) || b.avgRoundTicks > 1) ? 1 : 0;
        if (aEarly !== bEarly) return aEarly - bEarly;
        const aWs = (a.src === 'WS-IN' || a.src === 'SSE' || a.src === 'WORKER') ? 1 : 0;
        const bWs = (b.src === 'WS-IN' || b.src === 'SSE' || b.src === 'WORKER') ? 1 : 0;
        if (bWs !== aWs) return bWs - aWs;
        return (a.isCrashTag ? 1 : 0) - (b.isCrashTag ? 1 : 0);
      })
      .slice(0, 40);
    if (sortedLive.length) {
      const hdrLive = document.createElement('div');
      hdrLive.style.cssText = 'padding:5px 7px;background:rgba(245,158,11,0.12);color:#fde68a;font-size:10px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.08);';
      hdrLive.textContent = T.liveTagsHdr + ' (' + sortedLive.length + ')';
      elLogs.appendChild(hdrLive);
      for (let i = 0; i < sortedLive.length; i++) {
        const it = sortedLive[i];
        elLogs.appendChild(buildTagRow({
          tag: it.tag,
          cat: it.category,
          src: it.src,
          count: it.count,
          deltaMs: it.preCrashDeltaMs,
          minDeltaMs: it.minDeltaMs,
          maxDeltaMs: it.maxDeltaMs,
          lastPosFromCrash: it.lastPosFromCrash,
          lastRoundTotalMsgs: it.lastRoundTotalMsgs,
          roundsCount: it.preCrashRounds ? it.preCrashRounds.size : 0,
          shortRoundHits: it.shortRoundHits || 0,
          longRoundHits: it.longRoundHits || 0,
          maxRoundTicks: it.maxRoundTicks || 0,
          avgRoundTicks: it.avgRoundTicks || 0,
          phase: it.lastPhase || 'pre-crash',
          isEarlyOrContinuous: Boolean(it.isEarlyOrContinuous),
          isNonCashoutPhase: Boolean(it.isNonCashoutPhase),
          isRecommended: false,
          isCrash: it.isCrashTag,
          sample: it.sample,
          highlightBg: ''
        }));
        renderedCount++;
      }
    }

    if (!renderedCount) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:14px 8px;text-align:center;color:#64748b;font-size:11px;';
      empty.textContent = T.searchEmpty;
      elLogs.appendChild(empty);
    }
  }

  function renderLogs(force) {
    if (renderLogsTimer) { clearTimeout(renderLogsTimer); renderLogsTimer = null; }
    elTabWs.textContent = T.tabWs + ' (' + totalWsCount + ')';
    elTabApi.textContent = T.tabApi + ' (' + totalApiCount + ')';
    const hasRedReady = preCrashTags.some((p) => (p && p.roundsCount >= 2));
    if (elTabTags) elTabTags.textContent = (hasRedReady ? '🔴 ' : '') + T.tabTags + ' (' + liveTagMap.size + (tagRoundCount > 0 ? ('·' + tagRoundCount + 'R') : '') + ')';
    if (hudHidden || minimized || !showLogs || (feedFrozen && !force)) return;
    if (!force && activeTab === 'tags' && document.activeElement && elLogs.contains(document.activeElement)) return;
    elLogs.textContent = '';
    if (activeTab === 'tags') {
      renderTagFinder();
      return;
    }
    const list = feedSrcFilter === 'triggered'
      ? triggeredLogs.filter((e) => (activeTab === 'api' ? isApiSrc(e.src) : !isApiSrc(e.src)))
      : feedSrcFilter === 'hit'
      ? hitLogs.filter((e) => (activeTab === 'api' ? isApiSrc(e.src) : !isApiSrc(e.src)))
      : (activeTab === 'api' ? apiLogs : wsLogs);
    if (!list.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:14px 8px;text-align:center;color:#64748b;font-size:11px;';
      empty.textContent = (feedSrcFilter === 'triggered' || feedSrcFilter === 'hit') ? T.searchEmpty : (activeTab === 'api' ? T.emptyApi : T.emptyWs);
      elLogs.appendChild(empty);
      return;
    }
    const filtered = [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (feedSrcFilter === 'sms' && e.src !== 'SMS/DOM' && e.src !== 'DOM-TAG') continue;
      if (feedSrcFilter === 'css' && e.src !== 'CSS-STATE') continue;
      if (feedSrcFilter === 'js' && e.src !== 'JS-HOOK') continue;
      if (feedSrcFilter === 'api' && e.src !== 'API-REQ' && e.src !== 'API-RES' && e.src !== 'TAP-RES' && e.src !== 'TAP-NET' && e.src !== 'API-SIG') continue;
      if (feedSrcFilter === 'rtf' && e.src !== 'CSS-STATE' && e.src !== 'JS-HOOK' && e.src !== 'DOM-TAG' && e.src !== 'SMS/DOM' && e.src !== 'API-RES' && e.src !== 'TAP-RES' && e.src !== 'API-SIG') continue;
      if (feedSrcFilter === 'ws' && e.src !== 'WS-IN' && e.src !== 'WS-OUT' && e.src !== 'SSE' && e.src !== 'WORKER' && e.src !== 'TAP-RTC' && e.src !== 'TAP-WT' && e.src !== 'TAP-PM') continue;
      if (feedSrcFilter === 'hit' && !e.matched) continue;
      if (feedSrcFilter === 'triggered' && !e.inspectorMatched && !e.matched) continue;
      if (feedQuery) {
        const hay = (e.time + ' ' + e.src + ' ' + e.kind + ' ' + (e.reasons ? e.reasons.join(' ') : '') + ' ' + e.text).toLowerCase();
        if (hay.indexOf(feedQuery) === -1) continue;
      }
      filtered.push(e);
      if (filtered.length >= 25) break;
    }
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:14px 8px;text-align:center;color:#64748b;font-size:11px;';
      empty.textContent = T.searchEmpty;
      elLogs.appendChild(empty);
      return;
    }
    const lazyList = filtered.slice(0, 18);
    lazyList.forEach(entry => {
      if (entry.pretty == null && entry.text && entry.text.length <= 2400) {
        entry.pretty = prettyJsonIfPossible(entry.text);
      }
      const row = document.createElement('div');
      const isReq = entry.src === 'API-REQ';
      const isRes = entry.src === 'API-RES';
      row.style.cssText = 'padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.08);word-break:break-word;';

      const topBar = document.createElement('div');
      topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;';

      const meta = document.createElement('span');
      const isClickEv = entry.src === 'CLICK';
      const metaColor = isClickEv ? '#facc15' : entry.matched ? '#4ade80' : entry.inspectorMatched ? '#fb923c' : entry.src === 'CSS-STATE' ? '#f472b6' : entry.src === 'JS-HOOK' ? '#a78bfa' : entry.src === 'DOM-TAG' ? '#38bdf8' : isReq ? '#fbbf24' : isRes ? '#38bdf8' : '#94a3b8';
      meta.style.cssText = 'font-size:10px;font-weight:600;color:' + metaColor + ';';
      const inspLbl = (entry.reasons && entry.reasons.length) ? (' · TRIGGERED [' + entry.reasons.join(', ') + ']') : '';
      const heldLbl = entry.heldMs ? (' · Held ' + Math.round(entry.heldMs) + 'ms') : '';
      meta.textContent = entry.time + ' · ' + (entry.direction || srcToDirection(entry.src)) + ' · ' + entry.src + ' · ' + entry.kind + (entry.matched ? (' · MATCH [' + (entry.matchedTag || '') + ']') : '') + inspLbl + heldLbl;

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';

      const copyBtn = document.createElement('button');
      copyBtn.textContent = T.copyJson;
      copyBtn.style.cssText = 'background:rgba(255,255,255,0.08);color:#e2e8f0;border:none;border-radius:4px;padding:2px 6px;font-size:9.5px;cursor:pointer;';
      copyBtn.onclick = (e) => {
        e.stopPropagation();
        const pretty = entry.pretty || entry.text;
        copyTextSafe(pretty);
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = T.copyJson; }, 900);
      };

      const tagBtn = document.createElement('button');
      tagBtn.textContent = T.useTag;
      tagBtn.style.cssText = 'background:rgba(34,197,94,0.18);color:#86efac;border:none;border-radius:4px;padding:2px 6px;font-size:9.5px;cursor:pointer;';
      tagBtn.onclick = (e) => {
        e.stopPropagation();
        const picked = extractTagCandidate(entry.text);
        applyTagToInput(picked, false, tagBtn);
      };

      actions.appendChild(copyBtn);
      actions.appendChild(tagBtn);
      topBar.appendChild(meta);
      topBar.appendChild(actions);

      const body = document.createElement('pre');
      body.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-word;font-family:monospace;font-size:11px;color:' + (entry.matched ? '#bbf7d0' : '#f1f5f9') + ';';
      const displayStr = entry.pretty || entry.text;
      body.textContent = displayStr.length > 1000 ? (displayStr.slice(0, 1000) + '\n…') : displayStr;

      row.appendChild(topBar);
      row.appendChild(body);
      elLogs.appendChild(row);
    });
  }
  function scheduleRenderLogs() {
    if (renderLogsTimer) return;
    renderLogsTimer = setTimeout(() => {
      renderLogsTimer = null;
      if (hudHidden || minimized || !showLogs || feedFrozen) {
        elTabWs.textContent = T.tabWs + ' (' + totalWsCount + ')';
        elTabApi.textContent = T.tabApi + ' (' + totalApiCount + ')';
        const hasRedReady = preCrashTags.some((p) => (p && p.roundsCount >= 2));
        if (elTabTags) elTabTags.textContent = (hasRedReady ? '🔴 ' : '') + T.tabTags + ' (' + liveTagMap.size + (tagRoundCount > 0 ? ('·' + tagRoundCount + 'R') : '') + ')';
        return;
      }
      renderLogs(false);
    }, 60);
  }
  renderLogs(false);

  // --- Element & Text Anchor Engine (Resize-Proof) ---
  function getCssPath(el, docObj) {
    const doc = docObj || (el && el.ownerDocument) || document;
    if (!el || el.nodeType !== 1) return '';
    const esc = (s) => (window.CSS && typeof CSS.escape === 'function')
      ? CSS.escape(s)
      : String(s).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
    const isUnique = (sel) => {
      try { return doc.querySelectorAll(sel).length === 1; } catch { return false; }
    };
    if (el.id) {
      const idSel = '#' + esc(el.id);
      if (isUnique(idSel)) return idSel;
    }
    const tag = el.tagName.toLowerCase();
    const attrs = ['data-testid', 'data-test', 'data-cy', 'data-qa', 'name', 'aria-label'];
    for (let i = 0; i < attrs.length; i++) {
      const v = el.getAttribute && el.getAttribute(attrs[i]);
      if (v && v.length <= 60) {
        const attrSel = tag + '[' + attrs[i] + '=' + JSON.stringify(v) + ']';
        if (isUnique(attrSel)) return attrSel;
      }
    }
    if (el.classList && el.classList.length) {
      const clsList = Array.from(el.classList)
        .filter((c) => c && c.length <= 36 && !/[:\[\]\/]/.test(c) && !/^(hover|active|focus|disabled|selected)$/i.test(c))
        .slice(0, 3);
      if (clsList.length) {
        const clsSel = tag + '.' + clsList.map(esc).join('.');
        if (isUnique(clsSel)) return clsSel;
      }
    }
    const parts = [];
    let cur = el;
    for (let depth = 0; cur && cur.nodeType === 1 && depth < 12 && cur !== doc.body && cur !== doc.documentElement; depth++) {
      if (depth > 0 && cur.id) {
        const ancId = '#' + esc(cur.id);
        if (isUnique(ancId)) {
          parts.unshift(ancId);
          break;
        }
      }
      let seg = cur.tagName.toLowerCase();
      let hasAncAttr = false;
      for (let ai = 0; ai < attrs.length; ai++) {
        const av = cur.getAttribute && cur.getAttribute(attrs[ai]);
        if (av && av.length <= 48) {
          seg += '[' + attrs[ai] + '=' + JSON.stringify(av) + ']';
          hasAncAttr = true;
          break;
        }
      }
      if (!hasAncAttr && cur.classList && cur.classList.length) {
        const cCls = Array.from(cur.classList)
          .filter((c) => c && c.length >= 2 && c.length <= 32 && !/[:\[\]\/]/.test(c) && !/^(hover|active|focus|disabled|selected|ng-|v-)/i.test(c))
          .slice(0, 2);
        if (cCls.length) {
          seg += '.' + cCls.map(esc).join('.');
        }
      }
      if (cur.parentElement) {
        const candidateParts = [seg].concat(parts).join(' > ');
        if (!isUnique(candidateParts)) {
          const siblings = Array.from(cur.parentElement.children).filter(c => c.tagName === cur.tagName);
          if (siblings.length > 1) {
            seg += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')';
          }
        }
      }
      parts.unshift(seg);
      const joined = parts.join(' > ');
      if (isUnique(joined)) return joined;
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function getStructPath(el, docObj) {
    const doc = docObj || (el && el.ownerDocument) || document;
    if (!el || el.nodeType !== 1) return '';
    const esc = (s) => (window.CSS && typeof CSS.escape === 'function')
      ? CSS.escape(s)
      : String(s).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
    const isUnique = (sel) => {
      try { return doc.querySelectorAll(sel).length === 1; } catch { return false; }
    };
    const parts = [];
    let cur = el;
    for (let depth = 0; cur && cur.nodeType === 1 && depth < 14 && cur !== doc.body && cur !== doc.documentElement; depth++) {
      if (cur.id) {
        const ancId = '#' + esc(cur.id);
        if (isUnique(ancId)) {
          parts.unshift(ancId);
          return parts.join(' > ');
        }
      }
      let seg = cur.tagName.toLowerCase();
      if (cur.parentElement) {
        const siblings = Array.from(cur.parentElement.children).filter(c => c.tagName === cur.tagName);
        if (siblings.length > 1) {
          seg += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')';
        }
      }
      parts.unshift(seg);
      const joined = parts.join(' > ');
      if (isUnique(joined)) return joined;
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function isNumericPayoutStr(bt) {
    const s = String(bt || '').trim();
    if (!s || s.length > 26) return false;
    return /^(?:[৳$€£₹₽₿]\s*)?\d[\d,]*(?:[.,]\d+)?\s*(?:[৳$€£₹₽₿x×%]|[A-Z]{2,4})?$/.test(s);
  }

  function isAutoCashStr(txt, el) {
    const bt = String(txt || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (bt && (
      bt.includes('auto cash') || bt.includes('autocash') || bt.includes('auto-cash') || bt.includes('auto_cash') ||
      bt.includes('auto bet') || bt.includes('autobet') || bt.includes('auto-bet') || bt.includes('auto_bet') ||
      bt.includes('অটো ক্যাশ') || bt.includes('অটো বাজি') || bt.includes('cashout at') || bt.includes('cash out at')
    )) return true;
    if (el && el.nodeType === 1) {
      const tag = el.tagName;
      if (tag === 'INPUT') {
        const tp = String(el.type || '').toLowerCase();
        if (tp === 'checkbox' || tp === 'radio' || tp === 'number' || tp === 'range') return true;
      }
      const role = el.getAttribute && el.getAttribute('role');
      if (role === 'switch' || role === 'checkbox') return true;
      const cls = String(el.className || '').toLowerCase();
      if (cls.includes('auto-cash') || cls.includes('autocash') || cls.includes('auto_cash') || cls.includes('switch')) return true;
    }
    return false;
  }

  function isBetOrCancelStr(bt) {
    const s = String(bt || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s) return false;
    return (
      s === 'বাজি' ||
      s === 'bet' ||
      /^bet\b/.test(s) ||
      s.startsWith('place bet') ||
      s.includes('cancel') ||
      s.includes('বাতিল') ||
      s.includes('অপেক্ষা') ||
      s === 'wait' ||
      s.includes('waiting') ||
      s.includes('next round')
    );
  }

  function isLiveCashoutBtnText(bt, el) {
    if (!bt || isAutoCashStr(bt, el) || isBetOrCancelStr(bt)) return false;
    return bt.includes('cash') || bt.includes('take') || bt.includes('collect') || bt.includes('claim') || bt.includes('withdraw') || bt.includes('sell') || bt.includes('payout') || bt.includes('redeem') || bt.includes('settle') || bt.includes('উত্তোলন') || bt.includes('ক্যাশ') || bt.includes('নিন') || bt.includes('তুলে') || bt.includes('সেল') || isNumericPayoutStr(bt);
  }

  let fbHasShadowHosts = false;
  function queryDeepAll(rootNode, sel) {
    const out = [];
    if (!rootNode) return out;
    try {
      const ls = rootNode.querySelectorAll(sel);
      for (let i = 0; i < ls.length && out.length < 400; i++) out.push(ls[i]);
    } catch {}
    if (fbHasShadowHosts && out.length < 400) {
      try {
        const walkSh = (nd) => {
          if (!nd || out.length >= 400) return;
          const all = nd.querySelectorAll ? nd.querySelectorAll('*') : [];
          for (let j = 0; j < all.length && out.length < 400; j++) {
            const sr = all[j].shadowRoot;
            if (sr) {
              try {
                const sub = sr.querySelectorAll(sel);
                for (let k = 0; k < sub.length && out.length < 400; k++) out.push(sub[k]);
              } catch {}
              walkSh(sr);
            }
          }
        };
        walkSh(rootNode);
      } catch {}
    }
    return out;
  }

  function findButtonSlotContainer(el) {
    if (!el || !el.parentElement) return null;
    try {
      const er = el.getBoundingClientRect();
      let cur = el.parentElement;
      let best = null;
      for (let d = 0; d < 4 && cur && cur !== document.body && cur !== document.documentElement; d++) {
        const r = cur.getBoundingClientRect();
        if (r.width >= Math.max(10, er.width - 2) && r.height >= Math.max(10, er.height - 2) && r.width <= 440 && r.height <= 220) {
          best = cur;
          const cls = String(cur.className || '').toLowerCase();
          if (cls.includes('button') || cls.includes('bet') || cls.includes('control') || cls.includes('action')) {
            return cur;
          }
        }
        if (r.width > 460 || r.height > 260) break;
        cur = cur.parentElement;
      }
      return best;
    } catch {}
    return null;
  }

  function findSlotReplacementBtn(slotEl, slotSelector, refX, refY, slotStructPath) {
    try {
      let slot = (slotEl && slotEl.isConnected) ? slotEl : null;
      if (!slot && slotSelector) {
        try { slot = queryDeepAll(document, slotSelector)[0] || null; } catch {}
      }
      if (!slot && slotStructPath) {
        try { slot = queryDeepAll(document, slotStructPath)[0] || null; } catch {}
      }
      if (!slot || !slot.isConnected || isOwnHudNode(slot)) return null;
      const btns = queryDeepAll(slot, 'button, a, [role="button"], input[type="button"], input[type="submit"], [class*="btn"], [class*="button"]');
      let best = null;
      let bestScore = Infinity;
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        if (!b || !b.isConnected || isOwnHudNode(b)) continue;
        const txt = String(b.textContent || b.value || (b.getAttribute && b.getAttribute('aria-label')) || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (isAutoCashStr(txt, b)) continue;
        const br = b.getBoundingClientRect();
        if (br.width < 12 || br.height < 12) continue;
        const dist = (typeof refX === 'number' && typeof refY === 'number')
          ? Math.hypot((br.left + br.width * 0.5) - refX, (br.top + br.height * 0.5) - refY)
          : 0;
        const cashBonus = isLiveCashoutBtnText(txt, b) ? -1000 : 0;
        const isPrim = /^(BUTTON|INPUT)$/.test(b.tagName) ? -120 : 0;
        const sc = dist + cashBonus + isPrim;
        if (sc < bestScore) {
          bestScore = sc;
          best = b;
        }
      }
      if (best) anchor.slotEl = slot;
      return best;
    } catch {}
    return null;
  }

  function findElementByText(needle, refX, refY) {
    if (!needle || !document.body) return null;
    const q = needle.trim().toLowerCase();
    const qNoSpace = q.replace(/\s+/g, '');
    if (!q) return null;
    const vw = Math.max(1, window.innerWidth || 360);
    const vh = Math.max(1, window.innerHeight || 640);
    const maxArea = vw * vh * 0.45;
    const candidates = document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], span, div');
    let bestEl = null;
    let bestScore = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (isOwnHudNode(el)) continue;
      const txt = (el.textContent || el.value || (el.getAttribute && el.getAttribute('aria-label')) || '').trim().toLowerCase();
      if (!txt || isAutoCashStr(txt, el)) continue;
      const txtNoSpace = txt.replace(/\s+/g, '');
      if (txt === q || txt.includes(q) || txtNoSpace === qNoSpace || txtNoSpace.includes(qNoSpace)) {
        const r = el.getBoundingClientRect();
        if (r.width >= 10 && r.height >= 10 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw) {
          const area = r.width * r.height;
          if (area > maxArea) continue;
          const cx = r.left + r.width * 0.5;
          const cy = r.top + r.height * 0.5;
          const dist = (typeof refX === 'number' && typeof refY === 'number')
            ? Math.hypot(cx - refX, cy - refY)
            : 0;
          const exactBonus = (txt === q || txtNoSpace === qNoSpace) ? 0.65 : 1;
          const score = (dist * 8 + Math.sqrt(area)) * exactBonus;
          if (score < bestScore) {
            bestScore = score;
            bestEl = el;
          }
        }
      }
    }
    return bestEl;
  }

  function saveAnchor() {
    try {
      const anchorData = {
        manual: Boolean(anchor.manual),
        lockedExplicit: Boolean(anchor.lockedExplicit || locked),
        selector: anchor.selector,
        structPath: anchor.structPath || '',
        slotSelector: anchor.slotSelector || '',
        slotStructPath: anchor.slotStructPath || '',
        slotRelX: anchor.slotRelX,
        slotRelY: anchor.slotRelY,
        text: anchor.text,
        relX: anchor.relX,
        relY: anchor.relY,
        absX: anchor.absX,
        absY: anchor.absY,
        baseVw: anchor.baseVw,
        baseVh: anchor.baseVh,
        scrollX: typeof anchor.scrollX === 'number' ? anchor.scrollX : (window.scrollX || 0),
        scrollY: typeof anchor.scrollY === 'number' ? anchor.scrollY : (window.scrollY || 0),
        pctX: anchor.pctX,
        pctY: anchor.pctY
      };
      const posData = { x: Math.round(targetX), y: Math.round(targetY) };
      localStorage.setItem('__tt_anchor', JSON.stringify(anchorData));
      localStorage.setItem('__tt_pos', JSON.stringify(posData));
      if (typeof GM_setValue === 'function') {
        GM_setValue('__tt_anchor_' + CFG.roomId, JSON.stringify(anchorData));
        GM_setValue('__tt_pos_' + CFG.roomId, JSON.stringify(posData));
      }
    } catch {}
  }

  let fbCachedHitEl = null;
  let fbCachedHitX = -1;
  let fbCachedHitY = -1;
  let fbCachedHitDoc = null;
  let fbCachedWarmBtn = null;
  let fbCachedWarmX = -1;
  let fbCachedWarmY = -1;
  let fbCachedWarmDoc = null;
  let fbCachedWarmAt = 0;

  function deepElementFromPoint(doc, x, y, allowCache) {
    if (allowCache && fbCachedHitEl && fbCachedHitDoc === doc && fbCachedHitX === x && fbCachedHitY === y && fbCachedHitEl.isConnected && !isOwnHudNode(fbCachedHitEl)) {
      return fbCachedHitEl;
    }
    let hit = null;
    if (typeof doc.elementsFromPoint === 'function') {
      const els = doc.elementsFromPoint(x, y);
      let firstNonHud = null;
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!el || isOwnHudNode(el)) continue;
        if (!firstNonHud) firstNonHud = el;
        if (i <= 5 && (
          el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'CANVAS' ||
          el.tagName === 'INPUT' || (el.getAttribute && el.getAttribute('role') === 'button') ||
          (el.closest && el.closest('button, a, [role="button"], input[type="button"], input[type="submit"]'))
        )) {
          hit = el;
          break;
        }
      }
      if (!hit) hit = firstNonHud;
    }
    if (!hit) {
      hit = doc.elementFromPoint(x, y);
    }
    let guard = 0;
    while (hit && hit.shadowRoot && typeof hit.shadowRoot.elementFromPoint === 'function' && guard < 8) {
      fbHasShadowHosts = true;
      guard++;
      const inner = hit.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === hit) break;
      hit = inner;
    }
    if (hit && hit.tagName !== 'IFRAME' && !isOwnHudNode(hit)) {
      fbCachedHitEl = hit;
      fbCachedHitX = x;
      fbCachedHitY = y;
      fbCachedHitDoc = doc;
    }
    return hit;
  }

  function preWarmFbHit(force) {
    try {
      if (isDraggingTarget) return;
      const useLocal = Boolean(hudHidden && isIframe && iframeLocalTarget.active && iframeLocalTarget.x >= 0 && iframeLocalTarget.y >= 0);
      if (hudHidden && !useLocal && !isIframe) return;
      const fx = useLocal ? Math.round(iframeLocalTarget.x) : (hudHidden ? Math.round((window.innerWidth || 360) * 0.5) : Math.round(targetX));
      const fy = useLocal ? Math.round(iframeLocalTarget.y) : (hudHidden ? Math.round((window.innerHeight || 640) * 0.5) : Math.round(targetY));
      if (!force && fbCachedHitEl && fbCachedHitEl.isConnected && fbCachedHitX === fx && fbCachedHitY === fy) {
        if (fbCachedWarmBtn && fbCachedWarmBtn.isConnected && (performance.now() - fbCachedWarmAt) < 1200) return;
      }
      fbCachedHitEl = null;
      const hit = (!hudHidden || useLocal) ? deepElementFromPoint(document, fx, fy, false) : null;
      if (hit && hit.tagName !== 'IFRAME') {
        const pBtn = hit.closest ? hit.closest('button,a,[role="button"],input[type="button"],input[type="submit"]') : null;
        const cBtn = pBtn || (hit.closest ? (hit.closest('button,a,[role="button"],input[type="button"],input[type="submit"],[onclick],[class*="btn"],[class*="button"]') || hit) : hit);
        const cTxt = cBtn ? String(cBtn.textContent || cBtn.value || '').trim() : '';
        const cDis = Boolean(cBtn && (cBtn.disabled || (cBtn.getAttribute && cBtn.getAttribute('aria-disabled') === 'true')));
        if (cBtn && !isButtonAlreadyEnded(cTxt, cDis, cBtn)) {
          const cr = cBtn.getBoundingClientRect();
          if (cr.width > 2 && cr.height > 2) {
            fbCachedWarmBtn = cBtn;
            fbCachedWarmX = Math.max(Math.round(cr.left + 2), Math.min(Math.round(cr.right - 2), fx));
            fbCachedWarmY = Math.max(Math.round(cr.top + 2), Math.min(Math.round(cr.bottom - 2), fy));
            fbCachedWarmDoc = document;
            fbCachedWarmAt = performance.now();
            return;
          }
        }
      }
      const fbAny = findFallbackBtnOuter(document, fx, fy);
      if (fbAny) {
        const fbr = fbAny.getBoundingClientRect();
        const fTxt = String(fbAny.textContent || fbAny.value || '').trim();
        const fDis = Boolean(fbAny.disabled || (fbAny.getAttribute && fbAny.getAttribute('aria-disabled') === 'true'));
        if (fbr.width > 2 && fbr.height > 2 && !isButtonAlreadyEnded(fTxt, fDis, fbAny)) {
          fbCachedWarmBtn = fbAny;
          fbCachedWarmX = Math.round(fbr.left + fbr.width * 0.5);
          fbCachedWarmY = Math.round(fbr.top + fbr.height * 0.5);
          fbCachedWarmDoc = document;
          fbCachedWarmAt = performance.now();
          return;
        }
      }
      fbCachedWarmBtn = null;
    } catch {}
  }
  const fbWarmTimer = setInterval(() => {
    if (CFG.armed && !isDraggingTarget && !document.hidden && (!hudHidden || (isIframe && (iframeLocalTarget.active || detectGameDom())))) preWarmFbHit(false);
  }, 240);
  setTimeout(() => { if (document.body && (!hudHidden || (isIframe && iframeLocalTarget.active))) preWarmFbHit(true); }, 350);

  function captureAnchorAtPoint(fromLockBtn, customDoc, customX, customY) {
    const docRef = customDoc || document;
    const ptX = typeof customX === 'number' ? customX : targetX;
    const ptY = typeof customY === 'number' ? customY : targetY;
    let prevRootVis = '';
    let prevCrossPE = '';
    let prevPanelPE = '';
    if (docRef === document && root) {
      prevRootVis = root.style.visibility;
      prevCrossPE = crosshair.style.pointerEvents;
      prevPanelPE = panel.style.pointerEvents;
      root.style.visibility = 'hidden';
      crosshair.style.pointerEvents = 'none';
      panel.style.pointerEvents = 'none';
    }
    let rawHit = deepElementFromPoint(docRef, ptX, ptY, false);
    if (docRef === document && root) {
      root.style.visibility = prevRootVis;
      crosshair.style.pointerEvents = prevCrossPE;
      panel.style.pointerEvents = prevPanelPE;
    }

    const vw = Math.max(1, window.innerWidth || 360);
    const vh = Math.max(1, window.innerHeight || 640);
    const visH = Math.max(1, Math.min(vh, getSafeVisibleHeight()));
    if (docRef === document && (!hudHidden || !isIframe)) {
      anchor.manual = true;
      anchor.absX = Math.round(ptX);
      anchor.absY = Math.round(ptY);
      anchor.baseVw = vw;
      anchor.baseVh = vh;
      anchor.scrollX = window.scrollX || 0;
      anchor.scrollY = window.scrollY || 0;
      anchor.pctX = ptX / vw;
      anchor.pctY = ptY / visH;
    }

    const resolveBtnEl = (cand) => {
      if (!cand || isOwnHudNode(cand) || cand === docRef.documentElement || cand === docRef.body || cand.tagName === 'HTML' || cand.tagName === 'BODY' || cand.tagName === 'IFRAME') return null;
      const sBtn = cand.closest && cand.closest('button, a, [role="button"], input[type="button"], input[type="submit"], canvas');
      const elC = sBtn || (cand.closest && cand.closest('[onclick], [tabindex], [class*="btn"], [class*="button"]')) || cand;
      if (!elC) return null;
      const eTxt = String(elC.textContent || elC.value || '').trim().toLowerCase();
      if (isAutoCashStr(eTxt, elC)) return null;
      return { el: elC, strictBtn: sBtn };
    };

    let resolved = resolveBtnEl(rawHit);
    if ((!resolved || !resolved.strictBtn) && rawHit && rawHit.tagName !== 'IFRAME') {
      const offs = [[0, -20], [0, 20], [-20, 0], [20, 0], [0, -36], [0, 36]];
      for (let oi = 0; oi < offs.length; oi++) {
        const probeHit = deepElementFromPoint(docRef, ptX + offs[oi][0], ptY + offs[oi][1], false);
        const probeRes = resolveBtnEl(probeHit);
        if (probeRes && probeRes.strictBtn) {
          resolved = probeRes;
          break;
        }
      }
    }

    if (resolved && resolved.el) {
      const el = resolved.el;
      const strictBtn = resolved.strictBtn;
      const r = el.getBoundingClientRect();
      const isOversizedWrapper = el.tagName === 'IFRAME' || (r.width > vw * 0.85 && r.height > vh * 0.7);
      if (r.width > 0 && r.height > 0 && !isOversizedWrapper) {
        anchor.el = el;
        anchor.relX = Math.max(0.05, Math.min(0.95, (ptX - r.left) / r.width));
        anchor.relY = Math.max(0.08, Math.min(0.92, (ptY - r.top) / r.height));
        anchor.selector = getCssPath(el, docRef);
        anchor.structPath = getStructPath(el, docRef);
        const slotContainer = findButtonSlotContainer(el);
        anchor.slotEl = slotContainer;
        anchor.slotSelector = slotContainer ? getCssPath(slotContainer, docRef) : '';
        anchor.slotStructPath = slotContainer ? getStructPath(slotContainer, docRef) : '';
        if (slotContainer) {
          const sr = slotContainer.getBoundingClientRect();
          if (sr.width > 0 && sr.height > 0) {
            anchor.slotRelX = Math.max(0.02, Math.min(0.98, (ptX - sr.left) / sr.width));
            anchor.slotRelY = Math.max(0.02, Math.min(0.98, (ptY - sr.top) / sr.height));
          }
        }
        if (el.tagName === 'CANVAS') {
          anchor.text = '';
        } else {
          const rawTxt = (el.textContent || el.value || (el.getAttribute && el.getAttribute('aria-label')) || '').trim().replace(/\s+/g, ' ');
          const stableBtnTxt = rawTxt.replace(/\s+[৳$€£₹]?\s*\d+(?:[.,]\d+)?\s*[x×%]?$/i, '').trim();
          const autoTxt = (stableBtnTxt.length >= 3 && /[a-zA-Z\u0980-\u09FF]{3,}/.test(stableBtnTxt)) ? stableBtnTxt : rawTxt;
          const autoLow = autoTxt.toLowerCase();
          if (isBetOrCancelStr(autoLow) || isAutoCashStr(autoLow, el)) {
            anchor.text = '';
          } else {
            anchor.text = (CFG.targetText && rawTxt.toLowerCase().includes(CFG.targetText.toLowerCase()))
              ? sanitizeSavedTargetTxt(CFG.targetText)
              : sanitizeSavedTargetTxt(autoTxt.slice(0, 60));
          }
        }
        if (!fromLockBtn && strictBtn && strictBtn.tagName !== 'CANVAS') {
          if (!CFG.targetSelector) CFG.targetSelector = anchor.selector || CFG.targetSelector;
          if (anchor.text && !CFG.targetText) CFG.targetText = anchor.text;
        }
      } else {
        anchor.el = null;
        anchor.slotEl = null;
        anchor.slotSelector = '';
        anchor.slotStructPath = '';
        anchor.structPath = '';
        anchor.selector = '';
      }
    } else {
      anchor.el = null;
      anchor.slotEl = null;
      anchor.slotSelector = '';
      anchor.slotStructPath = '';
      anchor.structPath = '';
      anchor.selector = '';
    }
    if (!customDoc) {
      saveAnchor();
      syncUI();
    }
  }

  function isUsableEl(el) {
    if (!el || !el.isConnected || isOwnHudNode(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return false;
    return true;
  }

  function syncPositionFromAnchor() {
    if (isDraggingTarget) return anchor.el;
    const isHiddenIframeTrack = Boolean(root.style.display === 'none' && isIframe && (iframeLocalTarget.active || iframeLocalTarget.locked || locked || CFG.targetSelector || CFG.targetText || anchor.selector || anchor.structPath || anchor.slotStructPath || anchor.text));
    if (root.style.display === 'none' && !isHiddenIframeTrack) return anchor.el;
    const vw = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
    const vh = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
    if (vw < 120 || vh < 120) return anchor.el;
    const visH = Math.min(vh, getSafeVisibleHeight());

    // Live Locked Element & Slot Tracking (follows inner container scrolls & BET -> CANCEL -> CASH OUT DOM swaps)
    if (locked || (isHiddenIframeTrack && iframeLocalTarget.locked)) {
      const refXLock = (isHiddenIframeTrack && iframeLocalTarget.active && iframeLocalTarget.x >= 0) ? iframeLocalTarget.x : targetX;
      const refYLock = (isHiddenIframeTrack && iframeLocalTarget.active && iframeLocalTarget.y >= 0) ? iframeLocalTarget.y : targetY;
      let elLocked = isUsableEl(anchor.el) ? anchor.el : null;
      if (!elLocked && (anchor.slotEl || anchor.slotSelector || anchor.slotStructPath)) {
        elLocked = findSlotReplacementBtn(anchor.slotEl, anchor.slotSelector, refXLock, refYLock, anchor.slotStructPath);
        if (elLocked) anchor.el = elLocked;
      }
      if (!elLocked && (anchor.structPath || anchor.selector)) {
        const trySels = [anchor.selector, anchor.structPath].filter(Boolean);
        for (let si = 0; si < trySels.length && !elLocked; si++) {
          try {
            const qL = queryDeepAll(document, trySels[si])[0];
            if (isUsableEl(qL)) {
              const qrL = qL.getBoundingClientRect();
              if (Math.hypot((qrL.left + qrL.width * anchor.relX) - refXLock, (qrL.top + qrL.height * anchor.relY) - refYLock) <= Math.max(vw, visH) * 0.48) {
                elLocked = qL;
                anchor.el = qL;
              }
            }
          } catch {}
        }
      }
      if (!elLocked && refXLock >= 0 && refYLock >= 0) {
        try {
          const pHit = deepElementFromPoint(document, refXLock, refYLock, false);
          const pBtn = pHit && pHit.closest ? (pHit.closest('button, a, [role="button"], input[type="button"], input[type="submit"], canvas') || pHit) : pHit;
          if (isUsableEl(pBtn) && !isAutoCashStr(pBtn.textContent || pBtn.value || '', pBtn)) {
            const prb = pBtn.getBoundingClientRect();
            if (prb.width <= vw * 0.85 && prb.height <= vh * 0.7) {
              elLocked = pBtn;
              anchor.el = pBtn;
              anchor.slotEl = anchor.slotEl || findButtonSlotContainer(pBtn);
            }
          }
        } catch {}
      }
      if (elLocked) {
        const lr = elLocked.getBoundingClientRect();
        if (lr.width > 2 && lr.height > 2) {
          const nx = Math.round(lr.left + lr.width * anchor.relX);
          const ny = Math.round(lr.top + lr.height * anchor.relY);
          if (isHiddenIframeTrack) {
            const changedLoc = !iframeLocalTarget.active || iframeLocalTarget.x !== nx || iframeLocalTarget.y !== ny;
            if (changedLoc) {
              iframeLocalTarget.active = true;
              iframeLocalTarget.x = nx;
              iframeLocalTarget.y = ny;
              syncTurboCfg(false, false);
            }
            const upSig = nx + ':' + ny;
            const upNow = Date.now();
            if (upSig !== lastIframeSyncUpSig && upNow - lastIframeSyncUpAt >= 16) {
              lastIframeSyncUpSig = upSig;
              lastIframeSyncUpAt = upNow;
              sendToTop({ __TT_SNIFFER__: true, kind: 'IFRAME_LOCK_SYNC', localX: nx, localY: ny });
            }
            return elLocked;
          }
          const prevX = targetX;
          const prevY = targetY;
          targetX = nx;
          targetY = ny;
          clampTarget();
          anchor.absX = targetX;
          anchor.absY = targetY;
          anchor.scrollX = window.scrollX || 0;
          anchor.scrollY = window.scrollY || 0;
          anchor.pctX = targetX / Math.max(1, vw);
          anchor.pctY = targetY / Math.max(1, visH);
          if (targetX !== prevX || targetY !== prevY || !crosshair.style.left) {
            crosshair.style.left = (targetX - half) + 'px';
            crosshair.style.top = (targetY - half) + 'px';
            fbCachedHitEl = null;
            fbCachedWarmBtn = null;
            syncTurboCfg(false, false);
          } else if (!hudHidden) {
            syncIframeLocalTargets(false);
          }
          return elLocked;
        }
      }
      if (isHiddenIframeTrack) return anchor.el;
      const sameWidthBand = typeof anchor.absX === 'number' && typeof anchor.absY === 'number' && Math.abs(vw - (anchor.baseVw || vw)) <= 80;
      const curScrX = window.scrollX || 0;
      const curScrY = window.scrollY || 0;
      const baseScrX = typeof anchor.scrollX === 'number' ? anchor.scrollX : curScrX;
      const baseScrY = typeof anchor.scrollY === 'number' ? anchor.scrollY : curScrY;
      const lockX = sameWidthBand ? Math.round(anchor.absX + (baseScrX - curScrX)) : Math.round(vw * anchor.pctX);
      const lockY = sameWidthBand ? Math.round(anchor.absY + (baseScrY - curScrY)) : Math.round(visH * anchor.pctY);
      const prevX = targetX;
      const prevY = targetY;
      targetX = lockX;
      targetY = lockY;
      clampTarget();
      if (targetX !== prevX || targetY !== prevY || !crosshair.style.left) {
        crosshair.style.left = (targetX - half) + 'px';
        crosshair.style.top = (targetY - half) + 'px';
        syncTurboCfg(false, false);
      } else if (!hudHidden) {
        syncIframeLocalTargets(false);
      }
      return anchor.el;
    }

    const useIframeLoc = Boolean(isHiddenIframeTrack && iframeLocalTarget.active && iframeLocalTarget.x >= 0 && iframeLocalTarget.y >= 0);
    const useAbs = !useIframeLoc && anchor.manual && typeof anchor.absX === 'number' && typeof anchor.absY === 'number' && Math.abs(vw - (anchor.baseVw || vw)) <= 80;
    const curScrX = window.scrollX || 0;
    const curScrY = window.scrollY || 0;
    const baseScrX = typeof anchor.scrollX === 'number' ? anchor.scrollX : curScrX;
    const baseScrY = typeof anchor.scrollY === 'number' ? anchor.scrollY : curScrY;
    const refX = useIframeLoc ? iframeLocalTarget.x : (useAbs ? (anchor.absX + (baseScrX - curScrX)) : (vw * anchor.pctX));
    const refY = useIframeLoc ? iframeLocalTarget.y : (useAbs ? (anchor.absY + (baseScrY - curScrY)) : (visH * anchor.pctY));

    if (!isHiddenIframeTrack && anchor.manual) {
      const prevX = targetX;
      const prevY = targetY;
      targetX = Math.round(refX);
      targetY = Math.round(refY);
      clampTarget();
      if (targetX !== prevX || targetY !== prevY || !crosshair.style.left) {
        crosshair.style.left = (targetX - half) + 'px';
        crosshair.style.top = (targetY - half) + 'px';
        syncTurboCfg(false, false);
      } else if (!hudHidden) {
        syncIframeLocalTargets(false);
      }
      return anchor.el;
    }

    const maxElDrift = Math.max(vw, visH) * 0.48;

    let el = isUsableEl(anchor.el) ? anchor.el : null;
    if (!el && isHiddenIframeTrack && (anchor.slotEl || anchor.slotSelector)) {
      el = findSlotReplacementBtn(anchor.slotEl, anchor.slotSelector, refX, refY);
      if (el) anchor.el = el;
    }
    const wantPinTxt = sanitizeSavedTargetTxt(String(CFG.targetText || anchor.text || '')).trim().toLowerCase().replace(/\s+/g, ' ');
    const elTxtMatchesWant = (cand) => {
      if (!cand) return false;
      const ct = (cand.textContent || cand.value || (cand.getAttribute && cand.getAttribute('aria-label')) || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (isAutoCashStr(ct, cand)) return false;
      if (!wantPinTxt) return true;
      if (!ct) return true;
      const wantNs = wantPinTxt.replace(/\s+/g, '');
      const ctNs = ct.replace(/\s+/g, '');
      return ct.includes(wantPinTxt) || (wantNs && ctNs.includes(wantNs));
    };

    if (el && wantPinTxt && !elTxtMatchesWant(el) && !(isHiddenIframeTrack && iframeLocalTarget.locked)) {
      const betterTxtEl = findElementByText(wantPinTxt, refX, refY);
      if (isUsableEl(betterTxtEl) && elTxtMatchesWant(betterTxtEl)) {
        el = betterTxtEl;
        anchor.el = betterTxtEl;
      }
    }

    if (!el && (CFG.targetSelector || anchor.selector)) {
      const selTry = CFG.targetSelector || anchor.selector;
      try {
        const qCfg = document.querySelector(selTry);
        if (isUsableEl(qCfg) && (elTxtMatchesWant(qCfg) || (isHiddenIframeTrack && iframeLocalTarget.locked))) {
          const qr = qCfg.getBoundingClientRect();
          const dist = Math.hypot((qr.left + qr.width * anchor.relX) - refX, (qr.top + qr.height * anchor.relY) - refY);
          if (dist <= maxElDrift) {
            el = qCfg;
            anchor.el = qCfg;
            anchor.selector = selTry;
          }
        }
      } catch {}
    }

    if (!el && wantPinTxt) {
      const txtCand = findElementByText(wantPinTxt, refX, refY);
      if (isUsableEl(txtCand)) {
        const tr = txtCand.getBoundingClientRect();
        const tdist = Math.hypot((tr.left + tr.width * anchor.relX) - refX, (tr.top + tr.height * anchor.relY) - refY);
        if (tdist <= maxElDrift) {
          el = txtCand;
          anchor.el = txtCand;
        }
      }
    }

    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) {
        const nx = Math.round(r.left + r.width * anchor.relX);
        const ny = Math.round(r.top + r.height * anchor.relY);
        if (isHiddenIframeTrack) {
          const changedLoc = !iframeLocalTarget.active || iframeLocalTarget.x !== nx || iframeLocalTarget.y !== ny;
          if (changedLoc) {
            iframeLocalTarget.active = true;
            iframeLocalTarget.x = nx;
            iframeLocalTarget.y = ny;
            syncTurboCfg(false, false);
          }
          if (iframeLocalTarget.locked) {
            const upSig = nx + ':' + ny;
            const upNow = Date.now();
            if (upSig !== lastIframeSyncUpSig && upNow - lastIframeSyncUpAt >= 16) {
              lastIframeSyncUpSig = upSig;
              lastIframeSyncUpAt = upNow;
              sendToTop({ __TT_SNIFFER__: true, kind: 'IFRAME_LOCK_SYNC', localX: nx, localY: ny });
            }
          }
          return el;
        }
        const prevX = targetX;
        const prevY = targetY;
        targetX = nx;
        targetY = ny;
        clampTarget();
        if (targetX !== prevX || targetY !== prevY || !crosshair.style.left) {
          crosshair.style.left = (targetX - half) + 'px';
          crosshair.style.top = (targetY - half) + 'px';
          syncTurboCfg(false, false);
        }
        return el;
      }
    }

    if (isHiddenIframeTrack) return null;

    const prevX = targetX;
    const prevY = targetY;
    targetX = Math.round(refX);
    targetY = Math.round(refY);
    clampTarget();
    if (targetX !== prevX || targetY !== prevY || !crosshair.style.left) {
      crosshair.style.left = (targetX - half) + 'px';
      crosshair.style.top = (targetY - half) + 'px';
      syncTurboCfg(false, false);
    }
    return null;
  }

  // Initial anchor lookup if targetText or savedAnchor exists
  setTimeout(() => { syncPositionFromAnchor(); syncUI(); }, 50);

  // --- Sub-millisecond Click Engine ---
  let nextTapId = 10;
  function findFallbackBtnOuter(doc, x, y) {
    try {
      const sel = String(CFG.targetSelector || (anchor && anchor.selector) || '').trim();
      const rawTxt = sanitizeSavedTargetTxt(String(CFG.targetText || (anchor && anchor.text) || '')).trim().toLowerCase();
      const txt = rawTxt.replace(/\s+/g, ' ');
      const txtNs = txt.replace(/\s+/g, '');
      const isOk = (el) => {
        if (!el || !el.isConnected || isOwnHudNode(el) || el.tagName === 'BODY' || el.tagName === 'HTML' || el.tagName === 'IFRAME' || el.hidden) return false;
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2;
      };
      const elNormTxt = (el) => (el.textContent || el.value || (el.getAttribute && el.getAttribute('aria-label')) || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const matchesWant = (bt, el) => {
        if (isAutoCashStr(bt, el)) return false;
        if (isLiveCashoutBtnText(bt, el)) return true;
        if (!txt) return false;
        if (!bt) return false;
        const btNs = bt.replace(/\s+/g, '');
        return bt.indexOf(txt) !== -1 || (Boolean(txtNs) && btNs.indexOf(txtNs) !== -1);
      };
      let bestSel = null;
      let bestSelScore = 1e9;
      let bestSelIdeal = false;
      if (sel) {
        try {
          const qs = queryDeepAll(doc, sel);
          for (let i = 0; i < qs.length; i++) {
            const q = qs[i];
            if (!isOk(q)) continue;
            const qr = q.getBoundingClientRect();
            const qd = Math.hypot((qr.left + qr.width / 2) - x, (qr.top + qr.height / 2) - y);
            const qDis = Boolean(q.disabled || (q.getAttribute && q.getAttribute('aria-disabled') === 'true'));
            const qTxt = elNormTxt(q);
            if (isAutoCashStr(qTxt, q)) continue;
            const qWrong = isButtonAlreadyEnded(qTxt, qDis, q);
            const qWantOk = !txt ? !qWrong : matchesWant(qTxt, q);
            const isIdeal = !qDis && !qWrong && qWantOk;
            const score = qd + (qDis ? 5000 : 0) + (qWrong ? 4000 : 0) + (qWantOk ? 0 : 2500);
            if (score < bestSelScore) {
              bestSelScore = score;
              bestSel = q;
              bestSelIdeal = isIdeal;
            }
          }
        } catch {}
      }
      if (bestSel && bestSelIdeal) return bestSel;
      let bestTxt = null;
      let bestTxtScore = 1e9;
      let bestTxtIdeal = false;
      const bs = queryDeepAll(doc, 'button,a,[role="button"],input[type="button"],input[type="submit"],[class*="cashout"],[class*="cash-out"],[onclick],[tabindex],[class*="btn"],[class*="button"]');
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        if (!isOk(b)) continue;
        const bt = elNormTxt(b);
        if (!bt || isAutoCashStr(bt, b) || !matchesWant(bt, b)) continue;
        const br = b.getBoundingClientRect();
        const area = br.width * br.height;
        if (area > 220000) continue;
        const d = Math.hypot((br.left + br.width / 2) - x, (br.top + br.height / 2) - y);
        const bDis = Boolean(b.disabled || (b.getAttribute && b.getAttribute('aria-disabled') === 'true'));
        const bWrong = isButtonAlreadyEnded(bt, bDis, b);
        const isPrim = /^(BUTTON|A|INPUT)$/.test(b.tagName) || (b.getAttribute && b.getAttribute('role') === 'button');
        const isIdeal = !bDis && !bWrong;
        const score = d + (bDis ? 5000 : 0) + (bWrong ? 4000 : 0) + (isPrim ? 0 : 80) + Math.sqrt(area) * 0.25;
        if (score < bestTxtScore) {
          bestTxtScore = score;
          bestTxt = b;
          bestTxtIdeal = isIdeal;
        }
      }
      if (!bestTxtIdeal) {
        const ds = queryDeepAll(doc, 'div,span');
        for (let i = 0; i < ds.length; i++) {
          const de = ds[i];
          if (!isOk(de)) continue;
          const dt = elNormTxt(de);
          if (!dt || dt.length > 42 || isAutoCashStr(dt, de) || !matchesWant(dt, de)) continue;
          const dr = de.getBoundingClientRect();
          if (dr.width > 360 || dr.height > 140) continue;
          const d = Math.hypot((dr.left + dr.width / 2) - x, (dr.top + dr.height / 2) - y);
          const dDis = Boolean(de.disabled || (de.getAttribute && de.getAttribute('aria-disabled') === 'true'));
          const dWrong = isButtonAlreadyEnded(dt, dDis, de);
          const isIdealD = !dDis && !dWrong;
          const score = d + (dDis ? 5000 : 0) + (dWrong ? 4000 : 0) + 120;
          if (score < bestTxtScore) {
            bestTxtScore = score;
            bestTxt = de;
            bestTxtIdeal = isIdealD;
          }
        }
      }
      if (bestTxt && bestTxtIdeal) return bestTxt;
      if (bestSel) return bestSel;
      if (bestTxt) return bestTxt;
    } catch {}
    return null;
  }

  function pickJitterPointOuter(doc, el, fallbackX, fallbackY) {
    let fx = Math.round(fallbackX);
    let fy = Math.round(fallbackY);
    if (!CFG.humanJitter || !el || !el.getBoundingClientRect) {
      return { x: fx, y: fy, jittered: false };
    }
    try {
      const r = el.getBoundingClientRect();
      if (!r || r.width <= 4 || r.height <= 4) {
        return { x: fx, y: fy, jittered: false };
      }
      const winRef = doc && doc.defaultView ? doc.defaultView : window;
      const vw = Math.max(10, (winRef && winRef.innerWidth) || window.innerWidth || 360);
      const vh = Math.max(10, (winRef && winRef.innerHeight) || window.innerHeight || 640);
      const isLargeCanvas = el.tagName === 'CANVAS' && (r.width > 160 || r.height > 100);
      let jx = fx;
      let jy = fy;
      if (isLargeCanvas) {
        const radX = Math.min(6, Math.max(2, Math.floor(r.width * 0.03)));
        const radY = Math.min(5, Math.max(2, Math.floor(r.height * 0.03)));
        const uX = (Math.random() + Math.random()) - 1;
        const uY = (Math.random() + Math.random()) - 1;
        jx = Math.round(fx + uX * radX);
        jy = Math.round(fy + uY * radY);
      } else {
        const insetX = r.width > 14 ? Math.min(10, Math.max(2, r.width * 0.16)) : Math.max(1, r.width * 0.12);
        const insetY = r.height > 14 ? Math.min(8, Math.max(2, r.height * 0.18)) : Math.max(1, r.height * 0.12);
        const minX = Math.max(1, r.left + insetX);
        const maxX = Math.min(vw - 2, r.right - insetX);
        const minY = Math.max(1, r.top + insetY);
        const maxY = Math.min(vh - 2, r.bottom - insetY);
        if (maxX > minX && maxY > minY) {
          const uX = (Math.random() + Math.random()) * 0.5;
          const uY = (Math.random() + Math.random()) * 0.5;
          jx = Math.round(minX + uX * (maxX - minX));
          jy = Math.round(minY + uY * (maxY - minY));
        }
      }
      jx = Math.max(1, Math.min(vw - 2, jx));
      jy = Math.max(1, Math.min(vh - 2, jy));
      if (!isLargeCanvas) {
        const checkHit = deepElementFromPoint(doc, jx, jy, false);
        if (checkHit && (checkHit === el || el.contains(checkHit) || (checkHit.contains && checkHit.contains(el)))) {
          return { x: jx, y: jy, jittered: true };
        }
        return { x: fx, y: fy, jittered: false };
      }
      return { x: jx, y: jy, jittered: true };
    } catch {}
    return { x: fx, y: fy, jittered: false };
  }

  function makeFpProfileOuter() {
    let a = 0;
    let b = 0;
    try {
      if (typeof crypto === 'object' && crypto && typeof crypto.getRandomValues === 'function' && typeof Uint32Array === 'function') {
        const arr = new Uint32Array(2);
        crypto.getRandomValues(arr);
        a = arr[0] >>> 0;
        b = arr[1] >>> 0;
      }
    } catch {}
    if (!a && !b) {
      const p = Math.floor((typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) * 1000) >>> 0;
      a = ((Math.random() * 0xffffffff) >>> 0) ^ p;
      b = ((Math.random() * 0xffffffff) >>> 0) ^ ((Date.now() & 0xffffffff) >>> 0);
    }
    const salt = ((a ^ b) >>> 0).toString(16).padStart(8, '0');
    const w = 18 + (b & 0x0f);
    const h = 18 + ((b >>> 4) & 0x0f);
    return {
      salt: salt,
      pid: 100 + (a % 85000),
      width: w,
      height: h,
      radiusX: Math.round((w * 0.5) * 10) / 10,
      radiusY: Math.round((h * 0.5) * 10) / 10,
      pressure: Number((0.68 + (((b >>> 8) & 0xff) / 255) * 0.28).toFixed(3)),
      tiltX: (((b >>> 16) & 0x0f) % 11) - 5,
      tiltY: (((b >>> 20) & 0x0f) % 11) - 5,
      movX: (((b >>> 24) & 0x07) % 5) - 2,
      movY: (((b >>> 27) & 0x07) % 5) - 2,
      rot: (a >>> 16) & 0x1f,
      dx: Number((((((a >>> 8) & 0xff) / 255) - 0.5) * 0.68).toFixed(2)),
      dy: Number((((((a >>> 20) & 0xff) / 255) - 0.5) * 0.68).toFixed(2))
    };
  }

  function dispatchFallbackClickAt(doc, win, x, y, holdMs, fallbackEl, onDone, fastMode) {
    let hit = null;
    if (fastMode && fbCachedWarmBtn && fbCachedWarmDoc === doc && fbCachedWarmBtn.isConnected && !isOwnHudNode(fbCachedWarmBtn)) {
      const wTxt = String(fbCachedWarmBtn.textContent || fbCachedWarmBtn.value || '').trim();
      const wDis = Boolean(fbCachedWarmBtn.disabled || (fbCachedWarmBtn.getAttribute && fbCachedWarmBtn.getAttribute('aria-disabled') === 'true'));
      if (!isButtonAlreadyEnded(wTxt, wDis, fbCachedWarmBtn)) {
        hit = fbCachedWarmBtn;
        const wr = fbCachedWarmBtn.getBoundingClientRect();
        if (wr.width > 2 && wr.height > 2) {
          x = Math.round(wr.left + wr.width / 2);
          y = Math.round(wr.top + wr.height / 2);
        } else {
          x = fbCachedWarmX;
          y = fbCachedWarmY;
        }
      }
    }
    if (!hit) {
      hit = deepElementFromPoint(doc, x, y, Boolean(fastMode)) || fallbackEl;
    }
    if (!hit) {
      if (doc === document && typeof doc.elementsFromPoint !== 'function') {
        const pVis = root.style.visibility;
        root.style.visibility = 'hidden';
        hit = deepElementFromPoint(doc, x, y, false) || fallbackEl;
        root.style.visibility = pVis;
      } else {
        hit = deepElementFromPoint(doc, x, y, false) || fallbackEl;
      }
    }
    if (!hit || isOwnHudNode(hit)) {
      const fbMissed = findFallbackBtnOuter(doc, x, y);
      if (fbMissed) {
        hit = fbMissed;
        const mr = fbMissed.getBoundingClientRect();
        x = Math.round(mr.left + mr.width / 2);
        y = Math.round(mr.top + mr.height / 2);
      }
    }
    if (!hit || isOwnHudNode(hit)) {
      if (typeof onDone === 'function') { try { onDone(false, performance.now()); } catch {} }
      return false;
    }

    if (hit.tagName === 'IFRAME') {
      const r = hit.getBoundingClientRect();
      const ix = Math.round(x - r.left);
      const iy = Math.round(y - r.top);
      try {
        if (hit.contentDocument && hit.contentWindow) {
          const cw = hit.contentWindow;
          try {
            if (!cw.__ttPageHooked && !cw.__ttClickHooked && cw.EventTarget && cw.EventTarget.prototype && !cw.EventTarget.prototype.__ttAEP) {
              try { Object.defineProperty(cw, '__ttClickHooked', { value: true, writable: true, configurable: true, enumerable: false }); } catch { cw.__ttClickHooked = true; }
              try { Object.defineProperty(cw, '__ttTrustDepth', { value: cw.__ttTrustDepth || 0, writable: true, configurable: true, enumerable: false }); } catch { cw.__ttTrustDepth = cw.__ttTrustDepth || 0; }
              const CwWM = cw.WeakMap || WeakMap;
              const CwProxy = cw.Proxy || Proxy;
              const cCache = typeof CwWM === 'function' ? new CwWM() : null;
              const cFakeCap = { firesTouchEvents: true };
              const cMakeTrusted = (ev) => {
                if (!ev || typeof ev !== 'object' || ev.isTrusted) return ev;
                if (cCache && cCache.has(ev)) return cCache.get(ev);
                try {
                  const sh = Object.create(ev);
                  const p = new CwProxy(sh, {
                    has: (t, k) => k === 'isTrusted' || k === 'sourceCapabilities' || (k in ev),
                    get: (t, k) => {
                      if (k === 'isTrusted') return true;
                      if (k === 'sourceCapabilities') return ev.sourceCapabilities || cFakeCap;
                      const v = ev[k];
                      return typeof v === 'function' ? v.bind(ev) : v;
                    },
                    set: (t, k, v) => { ev[k] = v; return true; }
                  });
                  if (cCache) cCache.set(ev, p);
                  return p;
                } catch { return ev; }
              };
              const cETP = cw.EventTarget.prototype;
              const cOAdd = cETP.addEventListener;
              const cORem = cETP.removeEventListener;
              const cLMap = typeof CwWM === 'function' ? new CwWM() : null;
              const cClickEvs = Object.assign(Object.create(null), {
                click: 1, dblclick: 1, contextmenu: 1,
                pointerdown: 1, pointerup: 1, pointerover: 1, pointerenter: 1, pointermove: 1, pointerout: 1, pointerleave: 1, pointercancel: 1, gotpointercapture: 1, lostpointercapture: 1,
                touchstart: 1, touchend: 1, touchmove: 1, touchcancel: 1,
                mousedown: 1, mouseup: 1, mouseover: 1, mouseenter: 1, mousemove: 1, mouseout: 1, mouseleave: 1
              });
              cETP.__ttAEP = true;
              cETP.addEventListener = function (type, fn, opts) {
                if (!fn || (typeof fn !== 'function' && typeof fn.handleEvent !== 'function') || fn.__ttBypassGate) return cOAdd.call(this, type, fn, opts);
                if (!cClickEvs[type] && type !== 'message') return cOAdd.call(this, type, fn, opts);
                let w = cLMap ? cLMap.get(fn) : null;
                if (!w) {
                  w = function (ev) {
                    const arg = ((cw.__ttTrustDepth > 0 || (targetWin && targetWin.__ttTrustDepth > 0)) && ev && typeof ev === 'object' && !ev.isTrusted) ? cMakeTrusted(ev) : ev;
                    return typeof fn === 'function' ? fn.call(this, arg) : fn.handleEvent(arg);
                  };
                  if (cLMap) cLMap.set(fn, w);
                }
                return cOAdd.call(this, type, w, opts);
              };
              cETP.removeEventListener = function (type, fn, opts) {
                if (!cClickEvs[type] && type !== 'message') return cORem.call(this, type, fn, opts);
                const w = (cLMap && fn && (typeof fn === 'function' || typeof fn === 'object')) ? (cLMap.get(fn) || fn) : fn;
                return cORem.call(this, type, w, opts);
              };
            }
          } catch {}
          return dispatchFallbackClickAt(hit.contentDocument, cw, ix, iy, holdMs, null, onDone, fastMode);
        }
      } catch {}
      try {
        const cid = FRAME_ID + ':' + Date.now() + ':' + (++nextFrameClickSeq);
        if (hit.contentWindow) {
          hit.contentWindow.postMessage({ __TT_FRAME_CLICK__: true, clickId: cid, x: ix, y: iy, holdMs: holdMs, humanJitter: Boolean(CFG.humanJitter), fingerprintShuffle: Boolean(CFG.fingerprintShuffle) }, '*');
        }
        if (typeof GM_setValue === 'function') {
          GM_setValue('__tt_frame_click_' + CFG.roomId, JSON.stringify({
            clickId: cid,
            x: ix,
            y: iy,
            holdMs: holdMs || 0,
            humanJitter: Boolean(CFG.humanJitter),
            fingerprintShuffle: Boolean(CFG.fingerprintShuffle),
            src: hit.getAttribute ? (hit.getAttribute('src') || '') : '',
            ts: Date.now()
          }));
        }
        if (typeof onDone === 'function') {
          if (holdMs > 0) setTimeout(() => { try { onDone(true, performance.now()); } catch {} }, holdMs + 2);
          else { try { onDone(true, performance.now()); } catch {} }
        }
        return true;
      } catch {}
    }

    const primaryBtnSel = 'button,a,[role="button"],input[type="button"],input[type="submit"]';
    const btnSel = 'button,a,[role="button"],input[type="button"],input[type="submit"],label,[onclick],[tabindex],[class*="btn"],[class*="button"]';
    let primHit = hit.closest ? hit.closest(primaryBtnSel) : null;
    let btn = primHit || (hit.closest ? (hit.closest(btnSel) || hit) : hit);
    if (!primHit && hit.querySelector) {
      const innerBtn = hit.querySelector(primaryBtnSel);
      if (innerBtn && !isOwnHudNode(innerBtn)) {
        const ibr = innerBtn.getBoundingClientRect();
        const ibTxt = (innerBtn.textContent || innerBtn.value || '').trim();
        if (ibr.width > 8 && ibr.height > 8 && !isAutoCashStr(ibTxt, innerBtn)) {
          hit = innerBtn;
          primHit = innerBtn;
          btn = innerBtn;
          x = Math.round(ibr.left + ibr.width / 2);
          y = Math.round(ibr.top + ibr.height / 2);
        }
      }
    }
    let preBtnTxt = btn ? (btn.textContent || btn.value || '').trim() : '';
    let preBtnDisabled = Boolean(btn && (btn.disabled || (btn.getAttribute && btn.getAttribute('aria-disabled') === 'true')));
    const wantTxt = sanitizeSavedTargetTxt(String(CFG.targetText || (anchor && anchor.text) || '')).trim().toLowerCase().replace(/\s+/g, ' ');
    const wantTxtNs = wantTxt.replace(/\s+/g, '');
    const curBtnNorm = preBtnTxt.toLowerCase().replace(/\s+/g, ' ');
    const curBtnNormNs = curBtnNorm.replace(/\s+/g, '');
    const curIsLiveCash = isLiveCashoutBtnText(curBtnNorm, btn);
    const curBtnMissesTxt = Boolean(!locked && wantTxt && !curIsLiveCash && curBtnNorm && curBtnNorm.indexOf(wantTxt) === -1 && (!wantTxtNs || curBtnNormNs.indexOf(wantTxtNs) === -1));
    const curBtnWrong = isButtonAlreadyEnded(preBtnTxt, preBtnDisabled, btn);
    if ((!primHit && hit.tagName !== 'CANVAS') || preBtnDisabled || curBtnMissesTxt || curBtnWrong) {
      const betterEl = findFallbackBtnOuter(doc, x, y);
      if (betterEl) {
        const br = betterEl.getBoundingClientRect();
        const bDist = (br.width > 2 && br.height > 2) ? Math.hypot((br.left + br.width / 2) - x, (br.top + br.height / 2) - y) : 999;
        const allowJump = !locked || !primHit || bDist <= 42;
        const betterBtn = (betterEl.closest ? (betterEl.closest(primaryBtnSel) || betterEl.closest(btnSel) || betterEl) : betterEl);
        const betterTxt = (betterBtn.textContent || betterBtn.value || '').trim();
        const betterDis = Boolean(betterBtn && (betterBtn.disabled || (betterBtn.getAttribute && betterBtn.getAttribute('aria-disabled') === 'true')));
        const betterWrong = isButtonAlreadyEnded(betterTxt, betterDis, betterBtn);
        const betterNorm = betterTxt.toLowerCase().replace(/\s+/g, ' ');
        const betterMatchesWant = !wantTxt || isLiveCashoutBtnText(betterNorm, betterBtn) || betterNorm.indexOf(wantTxt) !== -1 || (Boolean(wantTxtNs) && betterNorm.replace(/\s+/g, '').indexOf(wantTxtNs) !== -1);
        if (allowJump && ((!betterDis && !betterWrong && betterMatchesWant) || !primHit || (curBtnWrong && !betterWrong) || (curBtnMissesTxt && betterMatchesWant))) {
          hit = betterEl;
          if (br.width > 2 && br.height > 2) {
            x = Math.round(br.left + br.width / 2);
            y = Math.round(br.top + br.height / 2);
          }
          primHit = hit.closest ? hit.closest(primaryBtnSel) : null;
          btn = primHit || (hit.closest ? (hit.closest(btnSel) || hit) : hit);
          preBtnTxt = btn ? (btn.textContent || btn.value || '').trim() : '';
          preBtnDisabled = Boolean(btn && (btn.disabled || (btn.getAttribute && btn.getAttribute('aria-disabled') === 'true')));
        }
      }
    }
    const jitterTarget = primHit || btn || hit;
    const jPt = (!CFG.opClickMode && CFG.humanJitter) ? pickJitterPointOuter(doc, jitterTarget, x, y) : { x: Math.round(x), y: Math.round(y), jittered: false };
    x = Math.round(jPt.x);
    y = Math.round(jPt.y);
    const fpProf = (!CFG.opClickMode && CFG.fingerprintShuffle) ? makeFpProfileOuter() : null;
    const evX = fpProf ? Math.max(1, Number((x + fpProf.dx).toFixed(2))) : x;
    const evY = fpProf ? Math.max(1, Number((y + fpProf.dy).toFixed(2))) : y;
    const parentEl = hit.parentElement;
    const preBtnCls = btn ? String(btn.className || '') : '';
    lastDomClickMeta = {
      preText: preBtnTxt.replace(/\s+/g, ' ').slice(0, 40),
      disabled: preBtnDisabled,
      tag: btn ? btn.tagName : '',
      clickX: evX,
      clickY: evY,
      jittered: Boolean(jPt.jittered),
      fpSalt: fpProf ? fpProf.salt : '',
      fpPressure: fpProf ? fpProf.pressure : undefined,
      fpRadius: fpProf ? fpProf.radiusX : undefined
    };
    const pid = fpProf ? fpProf.pid : (nextTapId = (nextTapId % 9000) + 1);
    const sx = fpProf ? Number((evX + (win.screenX || 0)).toFixed(2)) : Math.round(x + (win.screenX || 0));
    const sy = fpProf ? Number((evY + (win.screenY || 0)).toFixed(2)) : Math.round(y + (win.screenY || 0));
    const px = fpProf ? Number((evX + (win.scrollX || 0)).toFixed(2)) : Math.round(x + (win.scrollX || 0));
    const py = fpProf ? Number((evY + (win.scrollY || 0)).toFixed(2)) : Math.round(y + (win.scrollY || 0));
    const moveOpts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: evX,
      clientY: evY,
      screenX: sx,
      screenY: sy,
      movementX: fpProf ? fpProf.movX : 0,
      movementY: fpProf ? fpProf.movY : 0,
      button: 0,
      detail: 0,
      which: 0,
      view: win
    };
    const baseOpts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: evX,
      clientY: evY,
      screenX: sx,
      screenY: sy,
      movementX: 0,
      movementY: 0,
      button: 0,
      detail: 1,
      which: 1,
      view: win
    };
    const ptrBase = {
      pointerId: pid,
      pointerType: 'touch',
      isPrimary: true,
      width: fpProf ? fpProf.width : 24,
      height: fpProf ? fpProf.height : 24,
      tiltX: fpProf ? fpProf.tiltX : 0,
      tiltY: fpProf ? fpProf.tiltY : 0
    };
    const useLocalCtors = (win !== window && typeof cloneInto !== 'function');
    const PE = useLocalCtors ? (typeof PointerEvent === 'function' ? PointerEvent : win.PointerEvent) : (win.PointerEvent || (typeof PointerEvent === 'function' ? PointerEvent : null));
    const ME = useLocalCtors ? (typeof MouseEvent === 'function' ? MouseEvent : win.MouseEvent) : (win.MouseEvent || (typeof MouseEvent === 'function' ? MouseEvent : null));
    const TCH = useLocalCtors ? (typeof Touch === 'function' ? Touch : win.Touch) : (win.Touch || (typeof Touch === 'function' ? Touch : null));
    const TE = useLocalCtors ? (typeof TouchEvent === 'function' ? TouchEvent : win.TouchEvent) : (win.TouchEvent || (typeof TouchEvent === 'function' ? TouchEvent : null));
    const evOpts = (o) => {
      if (typeof cloneInto === 'function' && (win !== window || (targetWin && win === targetWin))) {
        try { return cloneInto(o, win, { cloneFunctions: false, wrapReflectors: true }); } catch {}
        try { return cloneInto(o, win); } catch {}
      }
      return o;
    };
    const bumpTrust = (delta) => {
      try {
        if (typeof win.__ttTrustDepth === 'number') {
          win.__ttTrustDepth = Math.max(0, win.__ttTrustDepth + delta);
        }
        if (targetWin && targetWin !== win && typeof targetWin.__ttTrustDepth === 'number') {
          targetWin.__ttTrustDepth = Math.max(0, targetWin.__ttTrustDepth + delta);
        }
      } catch {}
    };
    let touchEndPrevented = false;

    const doDown = () => {
      bumpTrust(1);
      try {
        if (PE) {
          try { hit.dispatchEvent(new PE('pointerover', evOpts(Object.assign({}, moveOpts, ptrBase, { buttons: 0, pressure: 0 })))); } catch {}
          try { hit.dispatchEvent(new PE('pointerenter', evOpts(Object.assign({}, moveOpts, ptrBase, { bubbles: false, buttons: 0, pressure: 0 })))); } catch {}
          if (btn && btn !== hit) {
            try { btn.dispatchEvent(new PE('pointerenter', evOpts(Object.assign({}, moveOpts, ptrBase, { bubbles: false, buttons: 0, pressure: 0 })))); } catch {}
          }
          try { hit.dispatchEvent(new PE('pointermove', evOpts(Object.assign({}, moveOpts, ptrBase, { buttons: 0, pressure: 0 })))); } catch {}
        }
        if (ME) {
          try { hit.dispatchEvent(new ME('mouseover', evOpts(Object.assign({}, moveOpts, { buttons: 0 })))); } catch {}
          try { hit.dispatchEvent(new ME('mousemove', evOpts(Object.assign({}, moveOpts, { buttons: 0 })))); } catch {}
        }
        if (PE) {
          try { hit.dispatchEvent(new PE('pointerdown', evOpts(Object.assign({}, baseOpts, ptrBase, { buttons: 1, pressure: fpProf ? fpProf.pressure : 1 })))); } catch {}
        }
        if (TCH && TE) {
          try {
            const touch = new TCH(evOpts({
              identifier: pid,
              target: hit,
              clientX: evX,
              clientY: evY,
              pageX: px,
              pageY: py,
              screenX: sx,
              screenY: sy,
              radiusX: fpProf ? fpProf.radiusX : 12,
              radiusY: fpProf ? fpProf.radiusY : 12,
              rotationAngle: fpProf ? fpProf.rot : 0,
              force: fpProf ? fpProf.pressure : 1
            }));
            hit.dispatchEvent(new TE('touchstart', evOpts({
              bubbles: true,
              cancelable: true,
              composed: true,
              view: win,
              touches: [touch],
              targetTouches: [touch],
              changedTouches: [touch]
            })));
          } catch {}
        }
        if (btn && typeof btn.focus === 'function') {
          try { btn.focus({ preventScroll: true }); } catch {}
        }
      } finally {
        bumpTrust(-1);
      }
    };

    const doUp = () => {
      bumpTrust(1);
      try {
        let live = hit.isConnected ? hit : ((btn && btn.isConnected) ? btn : (parentEl && parentEl.isConnected ? parentEl : null));
        if (!live) {
          const pPe = root.style.pointerEvents;
          const pVis = root.style.visibility;
          const pPpe = panel.style.pointerEvents;
          const pCpe = crosshair.style.pointerEvents;
          root.style.pointerEvents = 'none';
          root.style.visibility = 'hidden';
          panel.style.pointerEvents = 'none';
          crosshair.style.pointerEvents = 'none';
          live = deepElementFromPoint(doc, x, y) || findFallbackBtnOuter(doc, x, y) || btn || hit;
          root.style.visibility = pVis;
          root.style.pointerEvents = pPe || 'none';
          panel.style.pointerEvents = pPpe;
          crosshair.style.pointerEvents = pCpe;
        }
        if (PE) {
          try { live.dispatchEvent(new PE('pointerup', evOpts(Object.assign({}, baseOpts, ptrBase, { buttons: 0, pressure: 0 })))); } catch {}
        }
        if (TCH && TE) {
          try {
            const touchEndObj = new TCH(evOpts({
              identifier: pid,
              target: live,
              clientX: evX,
              clientY: evY,
              pageX: px,
              pageY: py,
              screenX: sx,
              screenY: sy,
              radiusX: fpProf ? fpProf.radiusX : 12,
              radiusY: fpProf ? fpProf.radiusY : 12,
              rotationAngle: fpProf ? fpProf.rot : 0,
              force: 0
            }));
            const okEnd = live.dispatchEvent(new TE('touchend', evOpts({
              bubbles: true,
              cancelable: true,
              composed: true,
              view: win,
              touches: [],
              targetTouches: [],
              changedTouches: [touchEndObj]
            })));
            if (!okEnd) touchEndPrevented = true;
          } catch {}
        }

        const sameLive = live === hit;
        const insideBtn = sameLive ? Boolean(primHit) : Boolean(live.closest && live.closest(primaryBtnSel));
        const liveBtn = sameLive ? btn : ((insideBtn && live.closest(primaryBtnSel)) || (live.closest && live.closest(btnSel)) || btn);
        let btnTransitioned = false;
        if (liveBtn) {
          const nowDis = Boolean(liveBtn.disabled || (liveBtn.getAttribute && liveBtn.getAttribute('aria-disabled') === 'true'));
          const nowTxt = String(liveBtn.textContent || liveBtn.value || '').trim();
          const nowBecameWrong = !curBtnWrong && isButtonAlreadyEnded(nowTxt, nowDis, liveBtn);
          btnTransitioned = nowBecameWrong || Boolean(touchEndPrevented && ((nowDis && !preBtnDisabled) || (preBtnTxt && nowTxt && nowTxt !== preBtnTxt)));
        }

        if (!btnTransitioned) {
          if (ME) {
            try { live.dispatchEvent(new ME('mousedown', evOpts(Object.assign({}, baseOpts, { buttons: 1 })))); } catch {}
            try { live.dispatchEvent(new ME('mouseup', evOpts(Object.assign({}, baseOpts, { buttons: 0 })))); } catch {}
          }
          let clickOk = true;
          try {
            const clkEvt = (CFG.opClickMode && ME)
              ? new ME('click', evOpts(Object.assign({}, baseOpts, { buttons: 0 })))
              : (PE
                ? new PE('click', evOpts(Object.assign({}, baseOpts, ptrBase, { width: 1, height: 1, buttons: 0, pressure: 0 })))
                : (ME ? new ME('click', evOpts(Object.assign({}, baseOpts, { buttons: 0 }))) : null));
            if (clkEvt) clickOk = live.dispatchEvent(clkEvt);
          } catch {
            if (ME) {
              try { clickOk = live.dispatchEvent(new ME('click', evOpts(Object.assign({}, baseOpts, { buttons: 0 })))); } catch {}
            } else if (typeof MouseEvent === 'function') {
              try { clickOk = live.dispatchEvent(new MouseEvent('click', Object.assign({}, baseOpts, { buttons: 0 }))); } catch {}
            }
          }
          const needsNativeFallback = liveBtn && liveBtn.tagName !== 'CANVAS' && (
            !clickOk ||
            !insideBtn ||
            live !== liveBtn ||
            (liveBtn.tagName !== 'BUTTON' && liveBtn.tagName !== 'INPUT')
          );
          if (needsNativeFallback) {
            const prevOcSb = lastOutCashSentAt;
            if (typeof liveBtn.click === 'function') {
              try { liveBtn.click(); } catch {}
            }
            if (lastOutCashSentAt <= prevOcSb) {
              try {
                const pKeys = Object.keys(liveBtn);
                for (let pki = 0; pki < pKeys.length; pki++) {
                  if (pKeys[pki].indexOf('__reactProps$') === 0 || pKeys[pki].indexOf('__reactEventHandlers$') === 0) {
                    const rp = liveBtn[pKeys[pki]];
                    if (rp && typeof rp.onClick === 'function' && !liveBtn.disabled) {
                      rp.onClick({ type: 'click', target: liveBtn, currentTarget: liveBtn, bubbles: true, cancelable: true, isTrusted: true, nativeEvent: {}, preventDefault: () => {}, stopPropagation: () => {}, persist: () => {} });
                      break;
                    }
                  }
                }
              } catch {}
            }
          }
        }

        if (PE) {
          try { live.dispatchEvent(new PE('pointerout', evOpts(Object.assign({}, moveOpts, ptrBase, { buttons: 0, pressure: 0 })))); } catch {}
          try { live.dispatchEvent(new PE('pointerleave', evOpts(Object.assign({}, moveOpts, ptrBase, { bubbles: false, buttons: 0, pressure: 0 })))); } catch {}
          if (liveBtn && liveBtn !== live) {
            try { liveBtn.dispatchEvent(new PE('pointerleave', evOpts(Object.assign({}, moveOpts, ptrBase, { bubbles: false, buttons: 0, pressure: 0 })))); } catch {}
          }
        }
        if (ME) {
          try { live.dispatchEvent(new ME('mouseout', evOpts(Object.assign({}, moveOpts, { buttons: 0 })))); } catch {}
          try { live.dispatchEvent(new ME('mouseleave', evOpts(Object.assign({}, moveOpts, { bubbles: false, buttons: 0 })))); } catch {}
        }
      } finally {
        bumpTrust(-1);
      }
    };

    const scheduleMicroHold = (ms, cb) => {
      if (ms <= 0) { cb(); return; }
      const deadline = performance.now() + ms;
      let fired = false;
      const finish = () => {
        if (fired) return;
        fired = true;
        cb();
      };
      const safetyTimer = setTimeout(finish, Math.max(1, Math.ceil(ms + 4)));
      if (ms < 4 && typeof MessageChannel === 'function') {
        try {
          const mc = new MessageChannel();
          mc.port1.onmessage = () => {
            if (fired) return;
            if (performance.now() >= deadline) {
              clearTimeout(safetyTimer);
              finish();
            } else {
              mc.port2.postMessage(null);
            }
          };
          mc.port2.postMessage(null);
          return;
        } catch {}
      }
      if (ms >= 4) {
        clearTimeout(safetyTimer);
        setTimeout(finish, ms);
      }
    };

    const fbFloor = CFG.preClickGate ? 2 : 0;
    const fbNow0 = performance.now();
    const fbUntil0 = fbNow0 + (Number(holdMs) || 0) + Math.max(CFG.preClickGate ? (Number(CFG.gateHoldMs) || 0) : 0, CFG.preClickGate ? (Number(CFG.wsLeadMs) || 0) : 0, fbFloor);
    fbGlobalClickUntil = Math.max(fbGlobalClickUntil, fbUntil0);
    fbLastClickDoneAt = fbNow0;
    if (typeof tightenFbCrashHolds === 'function') tightenFbCrashHolds(fbGlobalClickUntil);
    fbActiveClickCount += 1;
    if (holdMs > 0) {
      try { doDown(); } catch {}
      scheduleMicroHold(holdMs, () => {
        let fbNow1 = performance.now();
        try { doUp(); } finally {
          fbActiveClickCount = Math.max(0, fbActiveClickCount - 1);
          fbNow1 = performance.now();
          fbGlobalClickUntil = Math.max(fbGlobalClickUntil, fbNow1 + Math.max(CFG.preClickGate ? (Number(CFG.gateHoldMs) || 0) : 0, CFG.preClickGate ? (Number(CFG.wsLeadMs) || 0) : 0, fbFloor));
          fbLastClickDoneAt = fbNow1;
          if (typeof tightenFbCrashHolds === 'function') tightenFbCrashHolds(fbGlobalClickUntil);
          if (typeof onDone === 'function') { try { onDone(true, fbNow1); } catch {} }
        }
      });
    } else {
      try { doDown(); doUp(); } finally {
        fbActiveClickCount = Math.max(0, fbActiveClickCount - 1);
        const fbNowSync = performance.now();
        fbLastClickDoneAt = fbNowSync;
        fbGlobalClickUntil = Math.max(fbGlobalClickUntil, fbNowSync + Math.max(CFG.preClickGate ? (Number(CFG.gateHoldMs) || 0) : 0, CFG.preClickGate ? (Number(CFG.wsLeadMs) || 0) : 0, fbFloor));
        if (typeof tightenFbCrashHolds === 'function') tightenFbCrashHolds(fbGlobalClickUntil);
        if (typeof onDone === 'function') { try { onDone(true, fbNowSync); } catch {} }
      }
    }
    return true;
  }

  function fmtTimeMs(d) {
    const dt = d || new Date();
    return dt.toTimeString().slice(0, 8) + '.' + String(dt.getMilliseconds()).padStart(3, '0');
  }

  let _lastRaceKey = '';
  let _lastRaceVal = '';
  function classifyRaceKind(src, rawText) {
    const cacheKey = rawText ? (String(src || '') + '|' + String(rawText)) : '';
    if (cacheKey && cacheKey === _lastRaceKey) return _lastRaceVal;
    const full = String(rawText || '').toLowerCase();
    if (!full) return '';
    let hdr = '';
    let body = full;
    if (src === 'API-REQ' || src === 'API-RES') {
      const nl = full.indexOf('\n');
      hdr = nl >= 0 ? full.slice(0, nl) : full;
      body = nl >= 0 ? full.slice(nl + 1) : '';
    }
    if (src === 'WS-OUT' || src === 'API-REQ') {
      const outCheck = hdr + ' ' + body;
      const isOutCash = (outCheck.includes('cashout') || outCheck.includes('cash_out') || outCheck.includes('collect') || outCheck.includes('takewin') || outCheck.includes('claim') || /"c"\s*:\s*"cashout"/.test(outCheck));
      if (isOutCash) lastOutCashSentAt = Date.now();
      const outRes = isOutCash
        ? 'OUT_CASH'
        : (outCheck.includes('bet') || outCheck.includes('place') || outCheck.includes('roll') || outCheck.includes('spin') || outCheck.includes('limbo'))
        ? 'OUT_BET'
        : 'OUT';
      if (cacheKey) { _lastRaceKey = cacheKey; _lastRaceVal = outRes; }
      return outRes;
    }

    const pktInfo = analyzeGamePacket(src, body);
    const s = pktInfo.hasJson
      ? (pktInfo.sanitizedText || '')
      : body.replace(/"identifier"\s*:\s*"(?:\\.|[^"\\])*"/g, '').replace(/"channel"\s*:\s*"[^"]*"/g, '');
    const isErr =
      s.includes('অপর্যাপ্ত ফান্ড') ||
      s.includes('insufficient') ||
      s.includes('not enough') ||
      s.includes('no active bet') ||
      s.includes('bet not found') ||
      s.includes('already cashed') ||
      s.includes('market closed') ||
      s.includes('different game state') ||
      s.includes('state required') ||
      s.includes('invalid state') ||
      s.includes('wrong state') ||
      s.includes('game not active') ||
      s.includes('round not active') ||
      s.includes('betting closed') ||
      s.includes('already ended') ||
      s.includes('round closed') ||
      s.includes('round finished') ||
      s.includes('round has finished') ||
      s.includes('has finished') ||
      s.includes('round is finished') ||
      s.includes('game has ended') ||
      s.includes('cashouterror') ||
      s.includes('not received in time') ||
      s.includes('decision not processed') ||
      s.includes('too late') ||
      s.includes('158710') ||
      /"errors"\s*:\s*\[\s*\{/.test(s) ||
      /"(error|err|errorcode|code)"\s*:\s*"?[a-z1-9]/.test(s);
    if (isErr && !s.includes('cashed_out') && !s.includes('cashout_success')) {
      if (cacheKey) { _lastRaceKey = cacheKey; _lastRaceVal = 'ERR'; }
      return 'ERR';
    }

    const zeroWin = /"(win|won|cashout|cashedout)"\s*:\s*false/.test(s) || /"(winamount|payout|profit)"\s*:\s*0+(?:\.0+)?\b/.test(s);
    const isCash =
      !zeroWin && (
        pktInfo.isCash ||
        s.includes('cashed_out') ||
        s.includes('cashedout') ||
        s.includes('cash_out_success') ||
        s.includes('cashout_success') ||
        s.includes('উত্তোলন সফল') ||
        s.includes('ব্যালেন্স জমা') ||
        /"(cashout|cashedout|won|iswin)"\s*:\s*true/.test(s) ||
        /"payoutmultiplier"\s*:\s*[1-9]/.test(s) ||
        /"(status|event|eventtype|type|signal|state)"\s*:\s*"?(cashed_out|cashedout|cashout_success|cash_out|cashout|won|win|take_win)"?/.test(s) ||
        (src === 'API-RES' && /^2\d\d\b/.test(hdr) && (hdr.includes('cashout') || hdr.includes('cash_out') || hdr.includes('collect') || hdr.includes('claim')) && !s.includes('false'))
      );

    const isCrash = !isCash && (pktInfo.hasJson
      ? pktInfo.isCrash
      : (
          s.includes('crashed') ||
          s.includes('flew') ||
          s.includes('fly_away') ||
          s.includes('bust') ||
          s.includes('exploded') ||
          s.includes('round_end') ||
          s.includes('game_end') ||
          s.includes('game_over') ||
          s.includes('stopcoefficient') ||
          s.includes('oncrash') ||
          s.includes('onroundend') ||
          s.includes('ongameend') ||
          s.includes('onfinish') ||
          s.includes('better luck next time') ||
          s.includes('mine_hit') ||
          s.includes('hit_mine') ||
          s.includes('crashx') ||
          s.includes('উড়ে গেছে') ||
          /"(won|iswin)"\s*:\s*false/.test(s) ||
          /"(state|status|stage|phase)"\s*:\s*"?(crash|crashed|end|ended|finished|bust|busted|lost|loss)"?/.test(s) ||
          /"(newstateid|state|status)"\s*:\s*3\b/.test(s) ||
          /"(c|event|eventtype|type|target)"\s*:\s*"?(crash|oncrash|crashed|end|ended|onroundend|ongameend|onfinish|bust|fly_away|stopcoefficient|bomb)"?/.test(s)
        ));

    const isStart = !isCash && !isCrash && (pktInfo.hasJson
      ? pktInfo.isStart
      : (
          s.includes('startgame') ||
          s.includes('start_game') ||
          s.includes('waitgame') ||
          s.includes('wait_game') ||
          s.includes('newgame') ||
          s.includes('new_game') ||
          s.includes('round_start') ||
          s.includes('game_start') ||
          s.includes('onbetting') ||
          s.includes('onstart') ||
          /"(event|eventtype|type|target)"\s*:\s*"?(start|startgame|waitgame|newgame|round_start|game_start|onbetting|onstart)"?/.test(s) ||
          /"(state|status)"\s*:\s*1\b/.test(s)
        ));

    const rkOut = isCash ? 'CASH' : isCrash ? 'CRASH' : isStart ? 'START' : '';
    if (cacheKey) { _lastRaceKey = cacheKey; _lastRaceVal = rkOut; }
    return rkOut;
  }

  function isButtonAlreadyEnded(preText, disabled, el) {
    if (disabled) return true;
    const bt = String(preText || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (isAutoCashStr(bt, el)) return true;
    if (!bt) return false;
    const intended = sanitizeSavedTargetTxt(String(CFG.targetText || (anchor && anchor.text) || '')).trim().toLowerCase().replace(/\s+/g, ' ');
    if (intended === 'বাজি' || intended === 'bet' || intended.startsWith('place bet')) {
      return false;
    }
    const btNs = bt.replace(/\s+/g, '');
    const indNs = intended.replace(/\s+/g, '');
    const hasIntended = Boolean(intended && (bt.includes(intended) || (indNs && btNs.includes(indNs))));
    const hasCashWords = hasIntended || isLiveCashoutBtnText(bt, el);
    if (isBetOrCancelStr(bt) && !hasCashWords) {
      return true;
    }
    return false;
  }

  function summarizeRacePayload(src, rawText) {
    const s = String(rawText || '').trim();
    if (!s) return '';
    let prefix = '';
    let bodyStr = s;
    if (src === 'API-REQ' || src === 'API-RES') {
      const nl = s.indexOf('\n');
      const firstLine = nl >= 0 ? s.slice(0, nl).trim() : s;
      bodyStr = nl >= 0 ? s.slice(nl + 1).trim() : '';
      try {
        const m = firstLine.match(/^(?:(\d+)\s+)?(GET|POST|PUT|DELETE|PATCH|BEACON)\s+(https?:\/\/[^\s]+|\S+)/i);
        if (m) {
          const u = m[3].startsWith('http') ? new URL(m[3]) : null;
          const shortPath = u ? (u.pathname.split('/').filter(Boolean).slice(-2).join('/') || '/') : m[3].slice(0, 32);
          prefix = (m[1] ? m[1] + ' ' : '') + m[2].toUpperCase() + ' /' + shortPath.replace(/^\/+/, '');
        } else {
          prefix = firstLine.slice(0, 36);
        }
      } catch {
        prefix = firstLine.slice(0, 36);
      }
      if (!bodyStr) return prefix;
    }

    const info = extractJsonPayload(bodyStr, true);
    if (info && info.parsed && typeof info.parsed === 'object') {
      const wantKeys = ['eventType', 'type', 'event', 'cmd', 'c', 'action', 'state', 'status', 'stage', 'phase', 'multiplier', 'finalValue', 'coeff', 'coefficient', 'x', 'cashout', 'win', 'profit', 'payout', 'amount', 'error', 'msg', 'message'];
      const picked = [];
      const seenK = new Set();
      const walk = (obj, depth) => {
        if (!obj || typeof obj !== 'object' || depth > 5 || picked.length >= 4) return;
        if (Array.isArray(obj)) {
          for (let i = 0; i < Math.min(obj.length, 3); i++) walk(obj[i], depth + 1);
          return;
        }
        for (let i = 0; i < wantKeys.length && picked.length < 4; i++) {
          const k = wantKeys[i];
          if (Object.prototype.hasOwnProperty.call(obj, k) && !seenK.has(k)) {
            const v = obj[k];
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
              seenK.add(k);
              const valStr = typeof v === 'string' ? v.slice(0, 22) : String(v);
              picked.push(k === 'eventType' || k === 'event' || k === 'type' ? valStr : (k + ':' + valStr));
            }
          }
        }
        const subKeys = ['push', 'pub', 'data', 'payload', 'd', 'p', 'body', 'result'];
        for (let i = 0; i < subKeys.length && picked.length < 4; i++) {
          const sk = subKeys[i];
          if (obj[sk] && typeof obj[sk] === 'object') walk(obj[sk], depth + 1);
        }
      };
      walk(info.parsed, 0);
      if (picked.length) {
        const jSum = picked.join(' · ');
        return prefix ? (prefix + ' ' + jSum) : jSum;
      }
    }
    const clean = bodyStr.replace(/\s+/g, ' ').slice(0, 48);
    return prefix ? (prefix + (clean ? (' ' + clean) : '')) : clean;
  }

  let raceUiTimer = null;
  function scheduleRaceUiUpdate() {
    if (raceUiTimer) return;
    raceUiTimer = setTimeout(() => {
      raceUiTimer = null;
      updateRaceBoxUI();
    }, 16);
  }

  function refreshRaceVerdict(r) {
    if (!r) return;
    const isBn = CFG.lang === 'bn';
    const btnLbl = r.preText ? ('"' + r.preText + '"' + (r.disabled ? '[OFF]' : '')) : (r.disabled ? '[OFF]' : 'Target');
    const cashTxt = r.cashRel === 'CASH_BEFORE'
      ? (isBn ? ('আগে (-' + r.cashDelta.toFixed(1) + 'ms)') : ('First (-' + r.cashDelta.toFixed(1) + 'ms)'))
      : r.cashRel === 'CASH_AFTER'
      ? (isBn ? ('ক্লিকের পর (+' + r.cashDelta.toFixed(1) + 'ms ✓)') : ('After Click (+' + r.cashDelta.toFixed(1) + 'ms ✓)'))
      : (isBn ? (r.crashRel !== 'NONE' ? 'আসেনি' : 'অপেক্ষায়') : (r.crashRel !== 'NONE' ? 'None' : 'Watching'));
    const crashTxt = r.crashRel === 'CRASH_BEFORE'
      ? (isBn ? ('আগে (-' + r.crashDelta.toFixed(1) + 'ms)') : ('First (-' + r.crashDelta.toFixed(1) + 'ms)'))
      : r.crashRel === 'CRASH_AFTER'
      ? (isBn ? ('পরে (+' + r.crashDelta.toFixed(1) + 'ms)') : ('Later (+' + r.crashDelta.toFixed(1) + 'ms)'))
      : (isBn ? 'অপেক্ষায়' : 'Watching');

    const isLateStateErr = Boolean(r.errText && /state|ended|finished|closed|not active|too late|cashouterror|not received|decision not processed|158710|"101"/i.test(r.errText));
    const f2cTag = (typeof r.frameToOutCashMs === 'number')
      ? (' | F2C: ' + r.frameToOutCashMs.toFixed(2) + 'ms' + (typeof r.frameToAckMs === 'number' ? (' (Ack ' + r.frameToAckMs.toFixed(1) + 'ms)') : ''))
      : (typeof r.frameToClickMs === 'number' ? (' | F2Tap: ' + r.frameToClickMs.toFixed(2) + 'ms') : '');
    r.subText = 'Cash: ' + cashTxt + ' | Crash: ' + crashTxt + ' | Btn: ' + btnLbl + f2cTag + (r.errText ? (' | ' + r.errText + (isLateStateErr && isBn ? ' (সার্ভারে রাউন্ড আগেই শেষ — এই ট্যাগের আগের লাইভ ট্যাগ দিন)' : '')) : '');

    if (r.cashRel === 'CASH_AFTER') {
      r.color = '#4ade80';
      r.borderColor = 'rgba(74,222,128,0.55)';
      r.verdictText = isBn
        ? ('✅ ক্লিক আগে → Cash সফল (+' + r.cashDelta.toFixed(1) + 'ms পরে) · Btn: ' + btnLbl)
        : ('✅ CLICK FIRST → CASHED (+' + r.cashDelta.toFixed(1) + 'ms later) · Btn: ' + btnLbl);
    } else if (r.cashRel === 'CASH_BEFORE') {
      r.color = '#fbbf24';
      r.borderColor = 'rgba(251,191,36,0.55)';
      r.verdictText = isBn
        ? ('🟡 CASH আগেই হয়েছিল (-' + r.cashDelta.toFixed(1) + 'ms) → পরে ক্লিক · Btn: ' + btnLbl)
        : ('🟡 CASH WAS FIRST (-' + r.cashDelta.toFixed(1) + 'ms before click) · Btn: ' + btnLbl);
    } else if (r.errText) {
      r.color = '#f87171';
      r.borderColor = 'rgba(248,113,113,0.55)';
      const screenCrashNoteBn = r.crashRel === 'CRASH_AFTER' ? ('স্ক্রিন Crash +' + r.crashDelta.toFixed(1) + 'ms পরে হলেও সার্ভারে Cashout সময় আগেই শেষ') : 'সার্ভারে Cashout সময় আগেই শেষ';
      const screenCrashNoteEn = r.crashRel === 'CRASH_AFTER' ? ('Screen Crash was +' + r.crashDelta.toFixed(1) + 'ms later, but server cutoff already passed') : 'Server cutoff already passed';
      r.verdictText = isBn
        ? ('🔴 সার্ভার Cashout বাতিল করেছে! (' + screenCrashNoteBn + ')')
        : ('🔴 SERVER REJECTED CASHOUT! (' + screenCrashNoteEn + ')');
    } else if (r.crashRel === 'CRASH_BEFORE') {
      r.color = '#f87171';
      r.borderColor = 'rgba(248,113,113,0.55)';
      r.verdictText = isBn
        ? ('🔴 CRASH আগে (-' + r.crashDelta.toFixed(1) + 'ms) → পরে ক্লিক (Cash আগে হয়নি)')
        : ('🔴 CRASH FIRST (-' + r.crashDelta.toFixed(1) + 'ms before click)');
    } else if (r.crashRel === 'CRASH_AFTER') {
      if (r.endedByBtn) {
        r.color = '#fb923c';
        r.borderColor = 'rgba(251,146,60,0.55)';
        r.verdictText = isBn
          ? ('🟠 ক্লিক আগে (Crash +' + r.crashDelta.toFixed(1) + 'ms পরে), তবে Btn ' + btnLbl + ' ছিল — Cash আসেনি')
          : ('🟠 Click before Crash (+' + r.crashDelta.toFixed(1) + 'ms), Btn was ' + btnLbl + ' — No Cash');
      } else {
        r.color = '#38bdf8';
        r.borderColor = 'rgba(56,189,248,0.55)';
        r.verdictText = isBn
          ? ('🟢 ক্লিক আগে পড়েছে! (Crash +' + r.crashDelta.toFixed(1) + 'ms পরে) · Cash মেসেজ আসেনি')
          : ('🟢 CLICK WAS FIRST! (Crash +' + r.crashDelta.toFixed(1) + 'ms later) · No Cash msg');
      }
    } else if (r.endedByBtn) {
      r.color = '#fbbf24';
      r.borderColor = 'rgba(251,191,36,0.45)';
      r.verdictText = isBn
        ? ('🟡 ক্লিকের সময় বাটন ' + btnLbl + ' ছিল · Cash/Crash উত্তর দেখা হচ্ছে...')
        : ('🟡 Button was ' + btnLbl + ' at click · watching Cash/Crash...');
    } else if (r.outRel === 'OUT_CASH' || r.outRel === 'OUT_BET') {
      r.color = '#4ade80';
      r.borderColor = 'rgba(34,197,94,0.45)';
      r.verdictText = isBn
        ? ('🟢 ক্লিক আগে → Net পাঠানো (+' + r.outDelta.toFixed(1) + 'ms) · উত্তর দেখা হচ্ছে...')
        : ('🟢 CLICK FIRST → Sent (+' + r.outDelta.toFixed(1) + 'ms) · waiting reply...');
    } else if (r.isTest) {
      r.color = '#38bdf8';
      r.borderColor = 'rgba(56,189,248,0.45)';
      r.verdictText = isBn
        ? ('🧪 টেস্ট ক্লিক (' + r.time + ') · Btn: ' + btnLbl)
        : ('🧪 TEST CLICK (' + r.time + ') · Btn: ' + btnLbl);
    } else {
      r.color = '#4ade80';
      r.borderColor = 'rgba(34,197,94,0.45)';
      r.verdictText = isBn
        ? ('🟢 ক্লিক আগে (' + r.time + ') · Btn: ' + btnLbl + ' · Cash/Crash দেখা হচ্ছে...')
        : ('🟢 CLICK FIRED (' + r.time + ') · Btn: ' + btnLbl + ' · watching Cash/Crash...');
    }
  }

  function isPostCrashTagPattern(rawTags) {
    const s = String(rawTags || '').toLowerCase();
    if (!s) return false;
    return /(crashx|newstateid\s*[:=]\s*3|stopcoefficient|stop_coefficient|stopcoeff|finishgame|finish_game|endgame|game_end|game_over|round_end|round_over|round_finish|roundfinish|game_finish|gamefinish|stopgame|stop_game|oncrash|onroundend|ongameend|onfinish|finalvalue|crashed|fly_away|flew_off|flew off|busted|resulttime|gameresult|roundresult|cashouterror|cashoutclosed|decisionclosed|bettingclosed|"gr"\s*:|\bgr\b\s*[:=])/.test(s);
  }

  function updateRaceBoxUI() {
    if (!elRaceVerdict || !elRaceList || !elRaceToggle) return;
    elRaceToggle.textContent = showRaceTimeline ? T.raceHide : T.raceShow;
    elRaceList.style.display = showRaceTimeline ? 'flex' : 'none';

    if (!lastClickRace) {
      if (isPostCrashTagPattern(CFG.tags)) {
        const isBn = CFG.lang === 'bn';
        elRaceVerdict.textContent = isBn
          ? '⚠️ সতর্কতা: এটি Crash/End-পরের ট্যাগ! সার্ভার রাউন্ড বন্ধ করে এটা পাঠায়'
          : '⚠️ Warning: Post-Crash Tag! Server closes round before sending this';
        elRaceVerdict.style.color = '#fbbf24';
        if (elRaceSub) {
          elRaceSub.textContent = isBn
            ? 'আগে ক্লিকের জন্য 🏷 ট্যাগ / ✨ AI থেকে পাওয়া ১×/R প্রি-ক্র্যাশ ট্যাগ (যেমন "hash": বা ইন-ফ্লাইট ইভেন্ট) দিন।'
            : 'For in-time clicks, use a 1×/R pre-crash tag from 🏷 Tags / ✨ AI (e.g. "hash": or live flight event).';
          elRaceSub.style.display = 'block';
        }
        elRaceBox.style.borderColor = 'rgba(251,191,36,0.45)';
      } else {
        elRaceVerdict.textContent = T.raceWait;
        elRaceVerdict.style.color = '#94a3b8';
        if (elRaceSub) elRaceSub.style.display = 'none';
        elRaceBox.style.borderColor = 'rgba(255,255,255,0.1)';
      }
    } else {
      elRaceVerdict.textContent = lastClickRace.verdictText;
      elRaceVerdict.style.color = lastClickRace.color;
      elRaceBox.style.borderColor = lastClickRace.borderColor;
      if (elRaceSub) {
        elRaceSub.textContent = lastClickRace.subText || '';
        elRaceSub.style.display = lastClickRace.subText ? 'block' : 'none';
      }
    }

    if (!showRaceTimeline) return;
    elRaceList.textContent = '';
    if (!raceTimeline.length) {
      const emptyR = mkEl('div', 'color:#64748b;', '—');
      elRaceList.appendChild(emptyR);
      return;
    }
    const baseMono = lastClickRace ? lastClickRace.monoMs : raceTimeline[raceTimeline.length - 1].monoMs;
    const recent = raceTimeline.slice(-7);
    for (let i = 0; i < recent.length; i++) {
      const ev = recent[i];
      const delta = ev.monoMs - baseMono;
      const dStr = ev.isClick ? ' 0.0ms' : ((delta >= 0 ? '+' : '') + delta.toFixed(1) + 'ms');
      const holdBadge = (!ev.isClick && ev.holdAppliedMs >= 1)
        ? (' G+' + Math.round(ev.holdAppliedMs) + (ev.pendingFlush ? '..' : ''))
        : '';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:' +
        (ev.isClick ? '#facc15' : ev.raceKind === 'CRASH' ? '#fca5a5' : ev.raceKind === 'ERR' ? '#fb923c' : ev.raceKind === 'CASH' ? '#86efac' : ev.raceKind === 'OUT_CASH' ? '#7dd3fc' : '#cbd5e1') + ';';
      const snp = String(ev.summary || '').replace(/\s+/g, ' ').slice(0, 52);
      row.textContent = ev.time + ' [' + dStr + holdBadge + '] ' + ev.src + (ev.raceKind ? '(' + ev.raceKind + ')' : '') + ' ' + snp;
      elRaceList.appendChild(row);
    }
  }
  updateRaceBoxUI();

  function pushRaceTimelineItem(entry) {
    raceTimeline.push(entry);
    if (entry.gateId != null) {
      gateEntryById.set(entry.gateId, entry);
      if (gateEntryById.size > 120) {
        const firstK = gateEntryById.keys().next().value;
        if (firstK !== undefined) gateEntryById.delete(firstK);
      }
    }
    if (raceTimeline.length > 2) {
      raceTimeline.sort((a, b) => a.monoMs - b.monoMs);
    }
    if (raceTimeline.length > 24) raceTimeline.splice(0, raceTimeline.length - 24);
  }

  function recomputeLastClickRace() {
    if (!lastClickRace) return;
    const cp = lastClickRace.monoMs;
    lastClickRace.cashRel = 'NONE';
    lastClickRace.cashDelta = null;
    lastClickRace.crashRel = 'NONE';
    lastClickRace.crashDelta = null;
    lastClickRace.outRel = 'NONE';
    lastClickRace.outDelta = null;
    lastClickRace.errText = '';
    for (let i = raceTimeline.length - 1; i >= 0; i--) {
      const ev = raceTimeline[i];
      if (ev.isClick || ev.monoMs >= cp) continue;
      const bdt = cp - ev.monoMs;
      if (bdt > 2500 || ev.raceKind === 'START') break;
      if (ev.raceKind === 'CASH' && (lastClickRace.cashRel !== 'CASH_BEFORE' || bdt < (lastClickRace.cashDelta || 1e9))) {
        lastClickRace.cashRel = 'CASH_BEFORE';
        lastClickRace.cashDelta = bdt;
      } else if (ev.raceKind === 'CRASH' && (lastClickRace.crashRel !== 'CRASH_BEFORE' || bdt < (lastClickRace.crashDelta || 1e9))) {
        lastClickRace.crashRel = 'CRASH_BEFORE';
        lastClickRace.crashDelta = bdt;
      }
    }
    for (let i = 0; i < raceTimeline.length; i++) {
      const ev = raceTimeline[i];
      if (ev.isClick || ev.monoMs < cp) continue;
      const dt = ev.monoMs - cp;
      if (dt > 3500) break;
      if (ev.raceKind === 'CASH' && lastClickRace.cashRel === 'NONE') {
        lastClickRace.cashRel = 'CASH_AFTER';
        lastClickRace.cashDelta = dt;
      } else if (ev.raceKind === 'CRASH' && lastClickRace.crashRel === 'NONE') {
        lastClickRace.crashRel = 'CRASH_AFTER';
        lastClickRace.crashDelta = dt;
      } else if (ev.raceKind === 'ERR' && !lastClickRace.errText) {
        lastClickRace.errText = String(ev.summary || '').slice(0, 48);
      } else if ((ev.raceKind === 'OUT_CASH' || ev.raceKind === 'OUT_BET') && lastClickRace.outRel === 'NONE') {
        lastClickRace.outRel = ev.raceKind;
        lastClickRace.outDelta = dt;
      }
    }
    refreshRaceVerdict(lastClickRace);
    scheduleRaceUiUpdate();
  }

  function applyGateFlush(gateId, flushedAt) {
    if (gateId == null || typeof flushedAt !== 'number') return;
    const item = gateEntryById.get(gateId);
    if (!item) {
      pendingGateFlushMap.set(gateId, flushedAt);
      if (pendingGateFlushMap.size > 120) {
        const firstK = pendingGateFlushMap.keys().next().value;
        if (firstK !== undefined) pendingGateFlushMap.delete(firstK);
      }
      return;
    }
    const toolAt = typeof item.toolMonoMs === 'number' ? item.toolMonoMs : item.monoMs;
    const realMono = Math.max(toolAt, flushedAt);
    item.monoMs = realMono;
    item.gameMonoMs = realMono;
    item.holdAppliedMs = Math.max(0, realMono - toolAt);
    item.pendingFlush = false;
    if (item.holdAppliedMs >= 1) {
      const nowGateSec = Date.now();
      if (nowGateSec - lastGateSecLogAt >= 250) {
        lastGateSecLogAt = nowGateSec;
        pushSecurityLog('Pre-Click Gate Held', '+' + Math.round(item.holdAppliedMs) + 'ms ' + (item.raceKind || item.src || 'WS'), 'gate', item.time);
      }
    }
    if (raceTimeline.length > 2) {
      raceTimeline.sort((a, b) => a.monoMs - b.monoMs);
    }
    recomputeLastClickRace();
    scheduleRaceUiUpdate();
  }

  function recordClickRace(clickPerf, clickTime, elapsedMs, sourceLabel, meta) {
    const preText = meta && meta.preText ? String(meta.preText).trim() : '';
    const preDisabled = Boolean(meta && meta.disabled);
    const btnTag = preText ? ('"' + preText + '"' + (preDisabled ? ' [OFF]' : '')) : (preDisabled ? '[OFF]' : 'Target');
    const srcStr = String(sourceLabel || 'TAP');
    const tagBracketIdx = srcStr.indexOf('[');
    const parsedTrigTag = (tagBracketIdx >= 0 && srcStr.endsWith(']'))
      ? srcStr.slice(tagBracketIdx + 1, -1)
      : srcStr;
    const rawNumElap = parseFloat(String(elapsedMs || '').replace(/[^0-9.]/g, '')) || 0;
    const frameStartMono = (meta && typeof meta.frameStartMonoMs === 'number' && meta.frameStartMonoMs > 0)
      ? meta.frameStartMonoMs
      : Math.max(0, clickPerf - rawNumElap);
    const frameToClickMs = Math.max(0, Number((clickPerf - frameStartMono).toFixed(2)));
    const f2cSampleId = FRAME_ID + '_' + Math.round(frameStartMono) + '_' + (++evSeq);
    if (parsedTrigTag && parsedTrigTag !== 'TEST' && parsedTrigTag !== 'TAP') {
      lastFiredTagForRace = parsedTrigTag;
      lastFiredTagAt = Date.now();
    }

    let priorCrash = null;
    let priorCash = null;
    for (let i = raceTimeline.length - 1; i >= 0; i--) {
      const ev = raceTimeline[i];
      if (clickPerf - ev.monoMs > 2500) break;
      if (ev.monoMs > clickPerf) continue;
      if (ev.raceKind === 'START') break;
      if (!priorCrash && ev.raceKind === 'CRASH') priorCrash = ev;
      if (!priorCash && ev.raceKind === 'CASH') priorCash = ev;
    }

    lastClickRace = {
      monoMs: clickPerf,
      time: clickTime,
      isTest: sourceLabel === 'TEST',
      preText: preText,
      disabled: preDisabled,
      endedByBtn: isButtonAlreadyEnded(preText, preDisabled),
      cashRel: priorCash ? 'CASH_BEFORE' : 'NONE',
      cashDelta: priorCash ? Math.max(0, clickPerf - priorCash.monoMs) : null,
      crashRel: priorCrash ? 'CRASH_BEFORE' : 'NONE',
      crashDelta: priorCrash ? Math.max(0, clickPerf - priorCrash.monoMs) : null,
      outRel: 'NONE',
      outDelta: null,
      errText: '',
      color: '#4ade80',
      borderColor: 'rgba(34,197,94,0.45)',
      sampleId: f2cSampleId,
      triggerMonoMs: frameStartMono,
      frameToClickMs: frameToClickMs,
      triggerTag: parsedTrigTag || preText || 'TAP',
      triggerSrc: tagBracketIdx > 0 ? srcStr.slice(0, tagBracketIdx) : 'WS-IN',
      triggerTime: clickTime,
      outMonoMs: null,
      frameToOutCashMs: null,
      frameToAckMs: null,
      verdictText: '',
      subText: ''
    };
    refreshRaceVerdict(lastClickRace);

    pushRaceTimelineItem({
      time: clickTime,
      monoMs: clickPerf,
      toolMonoMs: clickPerf,
      gameMonoMs: clickPerf,
      holdAppliedMs: 0,
      pendingFlush: false,
      src: 'CLICK',
      raceKind: 'TAP',
      isClick: true,
      summary: 'Btn:' + btnTag + ' (' + elapsedMs + 'ms)'
    });

    const clickItem = {
      uid: FRAME_ID + ':' + (++evSeq),
      src: 'CLICK',
      kind: 'TAP',
      text: JSON.stringify({
        event: 'TRIGGER_CLICK',
        clickTime: clickTime,
        reactionMs: elapsedMs,
        frameMonoMs: Number(frameStartMono.toFixed(2)),
        frameToClickMs: frameToClickMs,
        source: srcStr,
        triggerTag: parsedTrigTag,
        buttonText: preText || null,
        buttonDisabled: preDisabled,
        endedByBtn: Boolean(lastClickRace.endedByBtn),
        clickX: meta && typeof meta.clickX === 'number' ? Number(meta.clickX.toFixed ? meta.clickX.toFixed(2) : meta.clickX) : undefined,
        clickY: meta && typeof meta.clickY === 'number' ? Number(meta.clickY.toFixed ? meta.clickY.toFixed(2) : meta.clickY) : undefined,
        jittered: Boolean(meta && meta.jittered),
        fpSalt: (meta && meta.fpSalt) ? String(meta.fpSalt) : undefined,
        verdict: lastClickRace.verdictText,
        subText: lastClickRace.subText
      }),
      pretty: null,
      matched: true,
      matchedTag: parsedTrigTag || preText || 'TAP',
      time: clickTime,
      monoMs: Number(clickPerf.toFixed(2))
    };
    totalWsCount += 1;
    wsLogs.unshift(clickItem);
    if (wsLogs.length > 120) wsLogs.length = 120;
    queueRelay(clickItem);
    const isTestClk = (sourceLabel === 'TEST');
    const effHoldSec = (meta && typeof meta.holdMs === 'number')
      ? meta.holdMs
      : (CFG.zeroDelay ? (Number(CFG.zeroDelayMicroMs) || 0) : (CFG.humanTap ? 35 : 0));
    pushSecurityLog(
      'Trusted-Event Masked',
      (isTestClk ? 'Test Tap · ' : (preText ? ('"' + preText.slice(0, 16) + '" · ') : '')) + 'isTrusted + Touch/Pointer',
      'trust',
      clickTime
    );
    if (effHoldSec > 0) {
      pushSecurityLog(
        'Micro-Hold Applied',
        effHoldSec + 'ms ' + (CFG.zeroDelay ? 'Sub-Frame Hold' : 'Human Hold'),
        'hold',
        clickTime
      );
    }
    if (meta && meta.jittered) {
      const jCoords = (typeof meta.clickX === 'number' && typeof meta.clickY === 'number')
        ? ('(' + Math.round(meta.clickX) + ',' + Math.round(meta.clickY) + ')')
        : 'Randomized';
      pushSecurityLog('Jitter-Offset Applied', jCoords, 'jitter', clickTime);
    }
    if (meta && meta.fpSalt) {
      const fpDet = 'Salt #' + String(meta.fpSalt)
        + (typeof meta.fpPressure === 'number' && meta.fpPressure > 0 ? (' · P:' + Number(meta.fpPressure).toFixed(2)) : '')
        + (typeof meta.fpRadius === 'number' && meta.fpRadius > 0 ? (' · R:' + meta.fpRadius + 'px') : '');
      pushSecurityLog('Fingerprint Shuffled', fpDet, 'fp', clickTime);
    }
    if (meta && meta.isRetry) {
      pushSecurityLog('Mutation-Observer Retry', 'Btn Unlocked · ' + elapsedMs + 'ms', 'retry', clickTime);
    }
    if (!isTestClk && ((meta && meta.syncFrame) || CFG.zeroDelay)) {
      const srcBaseSec = tagBracketIdx > 0 ? srcStr.slice(0, tagBracketIdx) : (srcStr || 'WS');
      pushSecurityLog('Sync-Frame Intercepted', srcBaseSec + ' · ' + elapsedMs + 'ms', 'sync', clickTime);
    }
    scheduleRaceUiUpdate();
    scheduleRenderLogs();
  }

  function observeRacePacket(src, kind, rawText, monoMs, timeStr, gateInfo) {
    const raceKind = classifyRaceKind(src, rawText);
    const summary = summarizeRacePayload(src, rawText);
    const toolMonoMs = (gateInfo && typeof gateInfo.t0 === 'number') ? gateInfo.t0 : monoMs;
    const gateIdVal = (gateInfo && gateInfo.id != null) ? gateInfo.id : null;
    const earlyFlushedAt = gateIdVal != null ? pendingGateFlushMap.get(gateIdVal) : undefined;
    if (earlyFlushedAt !== undefined) pendingGateFlushMap.delete(gateIdVal);
    const gated = Boolean(gateInfo && gateInfo.gated);
    const gateEst = gated ? Math.max(0, Number(gateInfo.gateEstMs) || 0) : 0;
    const estGameMono = earlyFlushedAt !== undefined
      ? Math.max(toolMonoMs, earlyFlushedAt)
      : (gated ? (toolMonoMs + gateEst) : toolMonoMs);
    const effMonoMs = Math.max(toolMonoMs, estGameMono);
    pushRaceTimelineItem({
      time: timeStr,
      monoMs: effMonoMs,
      toolMonoMs: toolMonoMs,
      gameMonoMs: effMonoMs,
      holdAppliedMs: earlyFlushedAt !== undefined ? Math.max(0, effMonoMs - toolMonoMs) : gateEst,
      pendingFlush: earlyFlushedAt !== undefined ? false : gated,
      gateId: gateIdVal,
      src: src,
      raceKind: raceKind || kind,
      isClick: false,
      summary: summary
    });

    if (lastClickRace) {
      const signedDt = effMonoMs - lastClickRace.monoMs;
      if (signedDt >= 0 && signedDt <= 3500) {
        const dt = Math.max(0, signedDt);
        const f2cBase = typeof lastClickRace.triggerMonoMs === 'number' ? lastClickRace.triggerMonoMs : lastClickRace.monoMs;
        if (raceKind === 'CASH' && lastClickRace.cashRel === 'NONE') {
          lastClickRace.cashRel = 'CASH_AFTER';
          lastClickRace.cashDelta = dt;
          const ackMs = Math.max(0, Number((effMonoMs - f2cBase).toFixed(2)));
          const rttMs = typeof lastClickRace.outMonoMs === 'number'
            ? Math.max(0, Number((effMonoMs - lastClickRace.outMonoMs).toFixed(2)))
            : Math.max(0, Number(dt.toFixed(2)));
          rollingServerRttMs = rollingServerRttMs > 0 ? (rollingServerRttMs * 0.65 + rttMs * 0.35) : rttMs;
          lastServerAcceptMs = rttMs;
          lastServerAcceptDeltaMs = ackMs;
          lastClickRace.frameToAckMs = ackMs;
          pushSecurityLog('Cashout Bypass Confirmed', '+' + dt.toFixed(1) + 'ms Post-Click · RTT ' + rttMs.toFixed(0) + 'ms', 'sync', timeStr);
          if (CFG.netLagAutoShift !== false && typeof applyAutoTagConfig === 'function') {
            applyAutoTagConfig('SERVER_RTT');
            syncTurboCfg(false, false);
          }
          refreshRaceVerdict(lastClickRace);
          if (!lastClickRace.isTest) {
            queueRelay({
              uid: FRAME_ID + ':' + (++evSeq),
              src: 'LATENCY',
              kind: 'F2C',
              matched: true,
              matchedTag: lastClickRace.triggerTag || '',
              time: timeStr,
              monoMs: Number(effMonoMs.toFixed(2)),
              text: JSON.stringify({
                event: 'FRAME_TO_CASHOUT',
                sampleId: lastClickRace.sampleId,
                phase: 'ACK',
                status: 'ACCEPTED',
                tag: lastClickRace.triggerTag || '',
                triggerSrc: lastClickRace.triggerSrc || 'WS-IN',
                triggerTime: lastClickRace.triggerTime || timeStr,
                frameMonoMs: Number(f2cBase.toFixed(2)),
                clickMonoMs: Number(lastClickRace.monoMs.toFixed(2)),
                outCashMonoMs: typeof lastClickRace.outMonoMs === 'number' ? Number(lastClickRace.outMonoMs.toFixed(2)) : undefined,
                serverAckMonoMs: Number(effMonoMs.toFixed(2)),
                frameToClickMs: lastClickRace.frameToClickMs,
                clickToOutCashMs: typeof lastClickRace.outDelta === 'number' ? Number(lastClickRace.outDelta.toFixed(2)) : undefined,
                frameToOutCashMs: lastClickRace.frameToOutCashMs != null ? lastClickRace.frameToOutCashMs : undefined,
                serverRttMs: rttMs,
                frameToServerAckMs: ackMs,
                serverVerdict: 'Server Accepted Cashout'
              })
            });
          }
        } else if (raceKind === 'CRASH' && lastClickRace.crashRel === 'NONE') {
          lastClickRace.crashRel = 'CRASH_AFTER';
          lastClickRace.crashDelta = dt;
          const ackMs = Math.max(0, Number((effMonoMs - f2cBase).toFixed(2)));
          lastClickRace.frameToAckMs = ackMs;
          refreshRaceVerdict(lastClickRace);
          if (!lastClickRace.isTest && lastClickRace.cashRel === 'NONE' && !lastClickRace.errText) {
            queueRelay({
              uid: FRAME_ID + ':' + (++evSeq),
              src: 'LATENCY',
              kind: 'F2C',
              matched: true,
              matchedTag: lastClickRace.triggerTag || '',
              time: timeStr,
              monoMs: Number(effMonoMs.toFixed(2)),
              text: JSON.stringify({
                event: 'FRAME_TO_CASHOUT',
                sampleId: lastClickRace.sampleId,
                phase: 'ACK',
                status: 'CRASHED_FIRST',
                tag: lastClickRace.triggerTag || '',
                triggerSrc: lastClickRace.triggerSrc || 'WS-IN',
                triggerTime: lastClickRace.triggerTime || timeStr,
                frameMonoMs: Number(f2cBase.toFixed(2)),
                clickMonoMs: Number(lastClickRace.monoMs.toFixed(2)),
                outCashMonoMs: typeof lastClickRace.outMonoMs === 'number' ? Number(lastClickRace.outMonoMs.toFixed(2)) : undefined,
                serverAckMonoMs: Number(effMonoMs.toFixed(2)),
                frameToClickMs: lastClickRace.frameToClickMs,
                frameToOutCashMs: lastClickRace.frameToOutCashMs != null ? lastClickRace.frameToOutCashMs : undefined,
                frameToServerAckMs: ackMs,
                serverVerdict: 'Crash arrived +' + dt.toFixed(1) + 'ms after click'
              })
            });
          }
        } else if (raceKind === 'ERR' && !lastClickRace.errText) {
          lastClickRace.errText = summary.slice(0, 48);
          const ackMs = Math.max(0, Number((effMonoMs - f2cBase).toFixed(2)));
          const rttMs = typeof lastClickRace.outMonoMs === 'number'
            ? Math.max(0, Number((effMonoMs - lastClickRace.outMonoMs).toFixed(2)))
            : Math.max(0, Number(dt.toFixed(2)));
          rollingServerRttMs = rollingServerRttMs > 0 ? (rollingServerRttMs * 0.65 + rttMs * 0.35) : rttMs;
          lastServerAcceptMs = rttMs;
          lastClickRace.frameToAckMs = ackMs;
          if (CFG.netLagAutoShift !== false && typeof applyAutoTagConfig === 'function') {
            applyAutoTagConfig('SERVER_RTT');
            syncTurboCfg(false, false);
          }
          refreshRaceVerdict(lastClickRace);
          if (!lastClickRace.isTest) {
            queueRelay({
              uid: FRAME_ID + ':' + (++evSeq),
              src: 'LATENCY',
              kind: 'F2C',
              matched: true,
              matchedTag: lastClickRace.triggerTag || '',
              time: timeStr,
              monoMs: Number(effMonoMs.toFixed(2)),
              text: JSON.stringify({
                event: 'FRAME_TO_CASHOUT',
                sampleId: lastClickRace.sampleId,
                phase: 'ACK',
                status: 'REJECTED',
                tag: lastClickRace.triggerTag || '',
                triggerSrc: lastClickRace.triggerSrc || 'WS-IN',
                triggerTime: lastClickRace.triggerTime || timeStr,
                frameMonoMs: Number(f2cBase.toFixed(2)),
                clickMonoMs: Number(lastClickRace.monoMs.toFixed(2)),
                outCashMonoMs: typeof lastClickRace.outMonoMs === 'number' ? Number(lastClickRace.outMonoMs.toFixed(2)) : undefined,
                serverAckMonoMs: Number(effMonoMs.toFixed(2)),
                frameToClickMs: lastClickRace.frameToClickMs,
                clickToOutCashMs: typeof lastClickRace.outDelta === 'number' ? Number(lastClickRace.outDelta.toFixed(2)) : undefined,
                frameToOutCashMs: lastClickRace.frameToOutCashMs != null ? lastClickRace.frameToOutCashMs : undefined,
                serverRttMs: rttMs,
                frameToServerAckMs: ackMs,
                serverVerdict: lastClickRace.errText
              })
            });
          }
          if (lastFiredTagForRace && Date.now() - lastFiredTagAt <= 5000) {
            const badTag = lastFiredTagForRace;
            serverRejectedTagMap.set(badTag, (serverRejectedTagMap.get(badTag) || 0) + 1);
            const badEnt = liveTagMap.get(badTag);
            if (badEnt) badEnt.serverRejectedCount = (badEnt.serverRejectedCount || 0) + 1;
            queueRelay({
              uid: FRAME_ID + ':' + (++evSeq),
              src: 'RACE-ERR',
              kind: 'ERR',
              text: summary,
              matched: true,
              matchedTag: badTag,
              time: timeStr,
              monoMs: effMonoMs
            });
            if (CFG.autoApplyVerifiedTag && !CFG.manualTagPin && CFG.tags === badTag) {
              CFG.tags = '';
              if (typeof elTags !== 'undefined' && elTags) elTags.value = '';
            }
            refreshPreCrashCandidates();
          }
        } else if ((raceKind === 'OUT_CASH' || raceKind === 'OUT_BET') && lastClickRace.outRel === 'NONE') {
          lastClickRace.outRel = raceKind;
          lastClickRace.outDelta = dt;
          if (raceKind === 'OUT_CASH') {
            const f2OutMs = Math.max(0, Number((effMonoMs - f2cBase).toFixed(2)));
            lastClickRace.outMonoMs = effMonoMs;
            lastClickRace.frameToOutCashMs = f2OutMs;
            if (!lastClickRace.isTest) {
              queueRelay({
                uid: FRAME_ID + ':' + (++evSeq),
                src: 'LATENCY',
                kind: 'F2C',
                matched: true,
                matchedTag: lastClickRace.triggerTag || '',
                time: timeStr,
                monoMs: Number(effMonoMs.toFixed(2)),
                text: JSON.stringify({
                  event: 'FRAME_TO_CASHOUT',
                  sampleId: lastClickRace.sampleId,
                  phase: 'OUT_CASH',
                  status: 'SENT_WAIT_ACK',
                  tag: lastClickRace.triggerTag || '',
                  triggerSrc: lastClickRace.triggerSrc || 'WS-IN',
                  triggerTime: lastClickRace.triggerTime || timeStr,
                  frameMonoMs: Number(f2cBase.toFixed(2)),
                  clickMonoMs: Number(lastClickRace.monoMs.toFixed(2)),
                  outCashMonoMs: Number(effMonoMs.toFixed(2)),
                  frameToClickMs: lastClickRace.frameToClickMs,
                  clickToOutCashMs: Number(dt.toFixed(2)),
                  frameToOutCashMs: f2OutMs
                })
              });
            }
          }
          refreshRaceVerdict(lastClickRace);
        }
      } else if (signedDt < 0 && -signedDt <= 2500) {
        const beforeDt = -signedDt;
        if (raceKind === 'CASH' && (lastClickRace.cashRel !== 'CASH_BEFORE' || beforeDt < (lastClickRace.cashDelta || 1e9))) {
          lastClickRace.cashRel = 'CASH_BEFORE';
          lastClickRace.cashDelta = beforeDt;
          refreshRaceVerdict(lastClickRace);
        } else if (raceKind === 'CRASH' && (lastClickRace.crashRel !== 'CRASH_BEFORE' || beforeDt < (lastClickRace.crashDelta || 1e9))) {
          lastClickRace.crashRel = 'CRASH_BEFORE';
          lastClickRace.crashDelta = beforeDt;
          refreshRaceVerdict(lastClickRace);
        }
      }
    }
    scheduleRaceUiUpdate();
  }

  let crossRestoreSeq = 0;
  function triggerReactAndDomClick(btn) {
    if (!btn || !btn.isConnected) return false;
    const txt = (btn.innerText || btn.textContent || btn.value || '').trim();
    const dis = Boolean(btn.disabled || (btn.getAttribute && btn.getAttribute('aria-disabled') === 'true'));
    const wantLow = sanitizeSavedTargetTxt(String(CFG.targetText || (anchor && anchor.text) || '')).trim().toLowerCase().replace(/s+/g, ' ');
    const txtLow = txt.toLowerCase().replace(/s+/g, ' ');
    const okText = isLiveCashoutBtnText(txtLow, btn) || (wantLow && txtLow.includes(wantLow)) || (btn.tagName === 'BUTTON' && !isBetOrCancelStr(txtLow) && !isAutoCashStr(txtLow, btn));
    if (dis || isAutoCashStr(txtLow, btn) || isBetOrCancelStr(txtLow) || !okText) return false;
    const prevOc = lastOutCashSentAt;
    try { if (typeof btn.focus === 'function') btn.focus({ preventScroll: true }); } catch {}
    try { if (typeof btn.click === 'function') btn.click(); } catch {}
    if (lastOutCashSentAt > prevOc) return true;
    try {
      const pKeys = Object.keys(btn);
      for (let i = 0; i < pKeys.length; i++) {
        if (pKeys[i].indexOf('__reactProps$') === 0 || pKeys[i].indexOf('__reactEventHandlers$') === 0) {
          const rp = btn[pKeys[i]];
          if (rp && typeof rp.onClick === 'function' && !btn.disabled) {
            rp.onClick({ type: 'click', target: btn, currentTarget: btn, bubbles: true, cancelable: true, isTrusted: true, nativeEvent: {}, preventDefault: () => {}, stopPropagation: () => {}, persist: () => {} });
            return true;
          }
        }
      }
    } catch {}
    return true;
  }

  function dispatchDirectProtocolCashout() {
    if (CFG.directWsCashout === false) return;
    try {
      const payload = JSON.stringify({
        roundId: latestRoundMeta.roundId || '',
        betId: latestRoundMeta.betId || '',
        ts: Date.now()
      });
      dispatchPageStrEvent('__TT_DIRECT_CASHOUT__', payload, false);
      if (!isIframe) {
        broadcastDownToIframes({ __TT_SNIFFER__: true, kind: 'DIRECT_CASHOUT', payload });
      }
    } catch {}
  }

  function armCashoutWatchdog(outCashBefore, fx, fy, fallbackBtn, sourceLabel) {
    if (sourceLabel === 'TEST') return;
    const canRetryForThisClick = Boolean(
      !lastDomClickMeta ||
      (!isBetOrCancelStr(String(lastDomClickMeta.preText || '').toLowerCase()) && !lastDomClickMeta.disabled)
    );
    if (!canRetryForThisClick) return;
    setTimeout(() => {
      try {
        if (lastOutCashSentAt > outCashBefore) return;
        const b1 = (fallbackBtn && fallbackBtn.isConnected) ? fallbackBtn : findFallbackBtnOuter(document, fx, fy);
        triggerReactAndDomClick(b1);
      } catch {}
    }, 10);
    setTimeout(() => {
      try {
        if (lastOutCashSentAt > outCashBefore) return;
        const b2 = (fallbackBtn && fallbackBtn.isConnected) ? fallbackBtn : findFallbackBtnOuter(document, fx, fy);
        const domRetried = triggerReactAndDomClick(b2);
        if (CFG.directWsCashout !== false && (domRetried || (lastDomClickMeta && isLiveCashoutBtnText(String(lastDomClickMeta.preText || '').toLowerCase())))) {
          dispatchDirectProtocolCashout();
        }
      } catch {}
    }, 26);
  }

  function extractLiveMultFromText(rawText, pktAn) {
    if (!rawText || (pktAn && (pktAn.isCrash || pktAn.isStart))) return null;
    const s = String(rawText);
    const lc = s.toLowerCase();
    if (lc.includes('stopcoefficient') || lc.includes('crashpoint') || lc.includes('expected_betting_phase') || lc.includes('history')) return null;
    const m = /"(?:coef|coeff|coefficient|multiplier|mult|curcoef|x)"\s*:\s*(\d+(?:\.\d+)?)/i.exec(s);
    if (!m) return null;
    const val = parseFloat(m[1]);
    return (Number.isFinite(val) && val >= 1.01 && val < 10000) ? val : null;
  }

  function updateRoundMetaFromText(rawText, pktAn) {
    if (pktAn && pktAn.roundId) {
      latestRoundMeta.roundId = String(pktAn.roundId);
      latestRoundMeta.updatedAt = Date.now();
    }
    if (!rawText) return;
    const bm = /"(?:betid|bet_id)"\s*:\s*"?([a-zA-Z0-9_-]{3,48})"?/i.exec(String(rawText));
    if (bm && bm[1]) {
      latestRoundMeta.betId = bm[1];
      latestRoundMeta.updatedAt = Date.now();
    }
  }

  function syncGameAutoCashoutBox(forceSync) {
    const ceiling = Number(CFG.autoCashoutCeilingX) || 0;
    if (ceiling < 1.01) return;
    const now = Date.now();
    if (!forceSync && now - lastGameBoxSyncAt < 1400) return;
    lastGameBoxSyncAt = now;
    try {
      const targetStr = ceiling.toFixed(2);
      const nodes = queryDeepAll(document, 'div,label,span');
      let autoContainer = null;
      for (let i = 0; i < nodes.length; i++) {
        const nd = nodes[i];
        if (!nd || isOwnHudNode(nd)) continue;
        const txt = String(nd.innerText || nd.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!txt || txt.length > 48) continue;
        if (txt.includes('auto cash out') || txt.includes('auto cashout') || txt === 'autocashout' || txt.includes('অটো ক্যাশ')) {
          autoContainer = nd.closest('div[class],section,form') || nd.parentElement;
          if (autoContainer && autoContainer.querySelector('input')) break;
          if (autoContainer && autoContainer.parentElement) autoContainer = autoContainer.parentElement;
        }
      }
      if (!autoContainer || isOwnHudNode(autoContainer)) return;
      const toggleEl = autoContainer.querySelector('input[type="checkbox"], [role="switch"]');
      if (toggleEl) {
        const isOn = Boolean(toggleEl.checked || (toggleEl.getAttribute && toggleEl.getAttribute('aria-checked') === 'true'));
        if (!isOn && typeof toggleEl.click === 'function') {
          try { toggleEl.click(); } catch {}
        }
      }
      const inputs = autoContainer.querySelectorAll('input[type="text"], input[type="number"], input:not([type="checkbox"]):not([type="radio"])');
      const nativeValSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      for (let j = 0; j < inputs.length; j++) {
        const inp = inputs[j];
        if (!inp || isOwnHudNode(inp) || inp.disabled || inp.readOnly || document.activeElement === inp) continue;
        const curV = String(inp.value || '').trim();
        if (curV === targetStr || parseFloat(curV) === ceiling) continue;
        if (nativeValSetter) nativeValSetter.call(inp, targetStr);
        else inp.value = targetStr;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    } catch {}
  }
  setTimeout(() => { if ((Number(CFG.autoCashoutCeilingX) || 0) >= 1.01) syncGameAutoCashoutBox(true); }, 1000);
  setInterval(() => { if (!document.hidden && (Number(CFG.autoCashoutCeilingX) || 0) >= 1.01) syncGameAutoCashoutBox(false); }, 1500);

  function fireClickAtCoords(x, y, holdMs, tStart, fallbackEl, sourceLabel, onDone) {
    const outCashBeforeTop = lastOutCashSentAt;
    const seq = ++crossRestoreSeq;
    const prevRootPE = root.style.pointerEvents;
    const prevRootVis = root.style.visibility;
    const prevPanelPE = panel.style.pointerEvents;
    const prevCrossPE = crosshair.style.pointerEvents;
    const phSym = typeof Symbol === 'function' ? Symbol.for('__tt.ph') : null;
    const cdSym = typeof Symbol === 'function' ? Symbol.for('__tt.cd') : null;
    const cmSym = typeof Symbol === 'function' ? Symbol.for('__tt.cm') : null;
    const hasHookHandler = Boolean(
      pageWorldActive ||
      targetWin.__ttPageHooked ||
      (rawPageWin && rawPageWin.__ttPageHooked) ||
      targetWin.__ttClickHooked ||
      window.__ttPageHooked ||
      window.__ttClickHooked ||
      (document.documentElement && document.documentElement.getAttribute && document.documentElement.getAttribute('data-tt-page-hooked') === '1') ||
      (phSym && (targetWin[phSym] || window[phSym]))
    );
    const needHideHud = !hasHookHandler && typeof document.elementsFromPoint !== 'function' && !(fallbackEl && fallbackEl.isConnected);
    root.style.pointerEvents = 'none';
    crosshair.style.pointerEvents = 'none';
    panel.style.pointerEvents = 'none';
    if (needHideHud) root.style.visibility = 'hidden';

    let clicked = false;
    let fallbackHandledDone = false;
    let clickMeta = null;
    lastDomClickMeta = null;
    try {
      if (cdSym) { targetWin[cdSym] = false; window[cdSym] = false; }
      if (cmSym) { targetWin[cmSym] = null; window[cmSym] = null; }
    } catch {}
    if (hasHookHandler) {
      try {
        const fbClkNow = performance.now();
        fbGlobalClickUntil = Math.max(fbGlobalClickUntil, fbClkNow + (Number(holdMs) || 0) + Math.max(CFG.preClickGate ? (Number(CFG.gateHoldMs) || 0) : 0, CFG.preClickGate ? (Number(CFG.wsLeadMs) || 0) : 0, CFG.preClickGate ? 2 : 0));
        fbLastClickDoneAt = fbClkNow;
        try {
          Object.defineProperty(targetWin, '__ttPageClickDone', { value: false, writable: true, configurable: true, enumerable: false });
          if (targetWin !== window) Object.defineProperty(window, '__ttPageClickDone', { value: false, writable: true, configurable: true, enumerable: false });
        } catch {
          targetWin.__ttPageClickDone = false;
          window.__ttPageClickDone = false;
        }
        const payload = JSON.stringify({ x: x, y: y, holdMs: holdMs, fast: true });
        let ackGot = false;
        let ackOk = false;
        let ackMeta = null;
        const onAck = (ev) => {
          try {
            let d = ev && ev.detail;
            if (typeof d === 'string') d = JSON.parse(d);
            if (d && typeof d === 'object') {
              ackGot = true;
              ackOk = Boolean(d.ok);
              if (d.meta) ackMeta = d.meta;
            }
          } catch {}
        };
        document.addEventListener('__TT_PAGE_CLICK_ACK__', onAck);
        try {
          dispatchPageStrEvent('__TT_PAGE_CLICK__', payload, false);
          if (!ackGot && targetWin && targetWin !== document && targetWin.dispatchEvent) {
            try {
              if (typeof cloneInto === 'function' && targetWin.CustomEvent) {
                targetWin.dispatchEvent(new targetWin.CustomEvent('__TT_PAGE_CLICK__', cloneInto({ detail: payload }, targetWin)));
              } else {
                targetWin.dispatchEvent(new CustomEvent('__TT_PAGE_CLICK__', { detail: payload }));
              }
            } catch {}
          }
        } finally {
          document.removeEventListener('__TT_PAGE_CLICK_ACK__', onAck);
        }
        clicked = ackGot
          ? ackOk
          : Boolean(
              targetWin.__ttPageClickDone ||
              window.__ttPageClickDone ||
              (cdSym && (targetWin[cdSym] || window[cdSym]))
            );
        if (ackMeta) {
          clickMeta = ackMeta;
        } else {
          try {
            const rawMeta = cmSym ? (targetWin[cmSym] || window[cmSym]) : null;
            if (rawMeta) clickMeta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
          } catch {}
        }
        if (clickMeta) lastDomClickMeta = clickMeta;
        try {
          if (cdSym) { targetWin[cdSym] = false; window[cdSym] = false; }
          if (cmSym) { targetWin[cmSym] = null; window[cmSym] = null; }
        } catch {}
      } catch {}
    }

    if (!clicked) {
      fallbackHandledDone = true;
      clicked = dispatchFallbackClickAt(document, document.defaultView || window, x, y, holdMs, fallbackEl || null, onDone, true);
      if (lastDomClickMeta) clickMeta = lastDomClickMeta;
    }

    if (needHideHud) root.style.visibility = prevRootVis;
    const clickPerf = performance.now();
    const clickTime = fmtTimeMs(new Date());
    const elapsed = (clickPerf - tStart).toFixed(2);

    root.style.pointerEvents = prevRootPE || 'none';
    panel.style.pointerEvents = prevPanelPE;

    const restoreCrosshair = () => {
      if (seq !== crossRestoreSeq) return;
      crosshair.style.pointerEvents = locked ? 'none' : (prevCrossPE || 'auto');
    };
    if (holdMs > 0) {
      setTimeout(restoreCrosshair, holdMs + 4);
    } else {
      restoreCrosshair();
    }

    if (!fallbackHandledDone && typeof onDone === 'function') {
      if (clicked && holdMs > 0) {
        setTimeout(() => { try { onDone(true, performance.now()); } catch {} }, holdMs + 2);
      } else {
        try { onDone(clicked, clickPerf); } catch {}
      }
    }

    triggerCount += 1;
    lastReactionMsStr = elapsed;
    elPerf.textContent = elapsed + 'ms';
    elPerf.style.color = '#4ade80';
    crosshair.style.transform = 'scale(0.86)';
    crosshair.style.borderColor = '#facc15';
    setTimeout(() => {
      crosshair.style.transform = 'scale(1)';
      crosshair.style.borderColor = locked ? '#f59e0b' : (CFG.armed ? '#22c55e' : '#94a3b8');
    }, 140);
    if (sourceLabel && sourceLabel !== 'TEST') {
      const rawDeltaMs = Math.max(0, clickPerf - tStart);
      recordLatencySample(
        rawDeltaMs,
        sourceLabel,
        clickTime,
        CFG.preClickGate ? Math.max(Number(CFG.wsLeadMs) || 0, Number(CFG.gateHoldMs) || 0) : 0
      );
      recordSecurityLatency(rawDeltaMs, sourceLabel, clickTime);
    }
    const clickMetaWithCtx = Object.assign({}, clickMeta || {}, {
      holdMs: Number(holdMs) || 0,
      syncFrame: Boolean(CFG.zeroDelay && sourceLabel && sourceLabel !== 'TEST'),
      frameStartMonoMs: (typeof tStart === 'number' && tStart > 0) ? tStart : undefined
    });
    recordClickRace(clickPerf, clickTime, elapsed, sourceLabel || lastHitTag || 'TAP', clickMetaWithCtx);
    armCashoutWatchdog(outCashBeforeTop, x, y, fallbackEl || null, sourceLabel);
    syncUI();
  }

  let pendingTargetRetryTimer = 0;
  let pendingTargetRetryObs = null;
  function clearPendingTargetRetry() {
    if (pendingTargetRetryTimer) {
      clearTimeout(pendingTargetRetryTimer);
      pendingTargetRetryTimer = 0;
    }
    if (pendingTargetRetryObs) {
      try { pendingTargetRetryObs.disconnect(); } catch {}
      pendingTargetRetryObs = null;
    }
  }
  function fireTargetClick(sourceLabel, tStart, onDone) {
    lastHitTag = String(sourceLabel || 'HIT').slice(0, 26);
    if (!locked && !isDraggingTarget && (!anchor.el || !anchor.el.isConnected)) {
      syncPositionFromAnchor();
    }
    let anchoredEl = null;
    if (!isDraggingTarget && anchor.el && anchor.el.isConnected) {
      if (locked) {
        anchoredEl = anchor.el;
      } else if (!anchor.manual) {
        const r = anchor.el.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) {
          const nx = Math.round(r.left + r.width * anchor.relX);
          const ny = Math.round(r.top + r.height * anchor.relY);
          if (Math.hypot(nx - targetX, ny - targetY) <= Math.max(window.innerWidth || 360, window.innerHeight || 640) * 0.30) {
            targetX = nx;
            targetY = ny;
            anchoredEl = anchor.el;
          }
        }
      }
    }
    clampTarget();
    const holdMs = CFG.zeroDelay
      ? Math.max(0, Math.min(5, Math.round((Number(CFG.zeroDelayMicroMs) || 0) * 2) / 2))
      : (CFG.humanTap ? 35 : 0);
    fireClickAtCoords(targetX, targetY, holdMs, tStart, anchoredEl, sourceLabel, onDone);
  }

  bindTap(elTest, () => {
    markUserTouched();
    fireTargetClick('TEST', performance.now());
  });

  let evSeq = 0;
  const lastDomMap = new Map();
  const lastRtfDedupMap = new Map();

  function handleDecoded(src, kind, rawText, turboInfo, gateInfo) {
    if (!rawText) return;
    const isRtfPassiveSrc = (src === 'CSS-STATE' || src === 'JS-HOOK' || src === 'DOM-TAG');
    if (src === 'SMS/DOM') {
      const nowMs = Date.now();
      const prevAt = lastDomMap.get(rawText) || 0;
      const bypassThrottle = Boolean(turboInfo && turboInfo.tClick) || (CFG.armed && matchPayload(rawText) !== null);
      if (!bypassThrottle && nowMs - prevAt < 400) return;
      lastDomMap.set(rawText, nowMs);
      if (lastDomMap.size > 60) {
        const firstK = lastDomMap.keys().next().value;
        if (firstK !== undefined) lastDomMap.delete(firstK);
      }
    }
    const isRealWs = (src === 'WS-IN' || src === 'WS-OUT' || src === 'SSE' || src === 'WORKER' || src === 'TAP-RTC' || src === 'TAP-WT' || src === 'TAP-PM');
    const isRealApi = (src === 'API-REQ' || src === 'API-RES' || src === 'TAP-RES' || src === 'TAP-NET');
    if (isRealWs) {
      localWsCount += 1;
    } else if (isRealApi) {
      localApiCount += 1;
    }

    const gInfo = gateInfo || (turboInfo && turboInfo.gate) || null;
    const tStart = (turboInfo && typeof turboInfo.t0 === 'number') ? turboInfo.t0 : ((gInfo && typeof gInfo.t0 === 'number') ? gInfo.t0 : performance.now());
    const d = new Date();
    const timeStr = (turboInfo && turboInfo.timeStr) ? turboInfo.timeStr : fmtTimeMs(d);
    const canTrigger = (
      src === 'WS-IN' || src === 'SSE' || src === 'WORKER' ||
      src === 'API-RES' || src === 'TAP-RES' || src === 'TAP-RTC' ||
      src === 'TAP-WT' || src === 'TAP-PM' ||
      src === 'CSS-STATE' || src === 'JS-HOOK' || src === 'DOM-TAG' || src === 'API-SIG' ||
      src === 'SMS/DOM'
    );
    let matched = (turboInfo && turboInfo.tag != null) ? turboInfo.tag : (canTrigger ? matchPayload(rawText) : null);
    if (isRtfPassiveSrc && matched === null && !(turboInfo && turboInfo.tClick)) {
      const nowRtfMs = Date.now();
      const prevRtfAt = lastRtfDedupMap.get(src + '|' + rawText) || 0;
      if (nowRtfMs - prevRtfAt < 40) return;
      lastRtfDedupMap.set(src + '|' + rawText, nowRtfMs);
      if (lastRtfDedupMap.size > 180) {
        const firstRk = lastRtfDedupMap.keys().next().value;
        if (firstRk !== undefined) lastRtfDedupMap.delete(firstRk);
      }
    }
    let roundLockChanged = false;
    let firedThisFrame = false;
    let cachedPktAn = null;
    const getPktAn = () => {
      if (!cachedPktAn) cachedPktAn = analyzeGamePacket(src, rawText);
      return cachedPktAn;
    };

    if (turboInfo && turboInfo.remoteOnly) {
      lastTriggerAt = Date.now();
      firedThisFrame = true;
      if (CFG.roundOnce) {
        roundClickLocked = true;
        roundClickLockedAt = lastTriggerAt;
        roundSawFlightAfterLock = false;
        roundSawCrashAfterLock = false;
        roundClickLockedRoundId = getPktAn().roundId || '';
        roundLockChanged = true;
      }
      if (turboInfo.oneShotFired) {
        CFG.armed = false;
        persistHudControlState();
      }
      sendToTop({
        __TT_SNIFFER__: true,
        kind: 'REMOTE_HIT',
        tag: String(matched || 'TURBO'),
        roundId: getPktAn().roundId || '',
        remoteToken: turboInfo.remoteToken || '',
        gateId: turboInfo.gateId || 0,
        t0: turboInfo.t0 || tStart
      });
      if (roundLockChanged && !hudHidden) syncUI();
    } else if (turboInfo && turboInfo.tClick) {
      const outCashBeforeTurbo = lastOutCashSentAt;
      const turboBadClick = Boolean(turboInfo.preDis || turboInfo.wrongBtn || isButtonAlreadyEnded(turboInfo.preText || '', Boolean(turboInfo.preDis)));
      if (!turboBadClick) {
        lastTriggerAt = Date.now();
        firedThisFrame = true;
        if (CFG.roundOnce) {
          roundClickLocked = true;
          roundClickLockedAt = lastTriggerAt;
          roundSawFlightAfterLock = false;
          roundSawCrashAfterLock = false;
          roundClickLockedRoundId = getPktAn().roundId || '';
        }
        triggerCount += 1;
      }
      if (turboInfo.oneShotFired && !turboBadClick) {
        CFG.armed = false;
        persistHudControlState();
      }
      const lbl = src + '[' + String(matched || 'TURBO') + ']';
      lastHitTag = lbl.slice(0, 26);
      lastReactionMsStr = String(turboInfo.elapsed || '0.00');
      elPerf.textContent = '⚡' + turboInfo.elapsed + 'ms';
      elPerf.style.color = '#4ade80';
      crosshair.style.transform = 'scale(0.86)';
      crosshair.style.borderColor = '#facc15';
      setTimeout(() => {
        crosshair.style.transform = 'scale(1)';
        crosshair.style.borderColor = locked ? '#f59e0b' : (CFG.armed ? '#22c55e' : '#94a3b8');
      }, 140);
      if (src !== 'SMS/DOM' || matched !== null || classifyRaceKind(src, rawText)) {
        observeRacePacket(src, kind, rawText, turboInfo.t0, timeStr, gInfo);
      }
      const turboDeltaMs = Math.max(0, Number(turboInfo.tClick) - Number(turboInfo.t0));
      recordLatencySample(
        turboDeltaMs,
        src,
        turboInfo.timeStr || timeStr,
        gInfo && typeof gInfo.gateEstMs === 'number' ? Math.round(gInfo.gateEstMs) : 0
      );
      recordSecurityLatency(turboDeltaMs, src, turboInfo.timeStr || timeStr);
      recordClickRace(turboInfo.tClick, turboInfo.timeStr || timeStr, '⚡' + turboInfo.elapsed, lbl, {
        preText: turboInfo.preText || '',
        disabled: Boolean(turboInfo.preDis),
        clickX: typeof turboInfo.clickX === 'number' ? turboInfo.clickX : undefined,
        clickY: typeof turboInfo.clickY === 'number' ? turboInfo.clickY : undefined,
        jittered: Boolean(turboInfo.jittered),
        fpSalt: turboInfo.fpSalt ? String(turboInfo.fpSalt) : '',
        fpPressure: typeof turboInfo.fpPressure === 'number' ? turboInfo.fpPressure : undefined,
        fpRadius: typeof turboInfo.fpRadius === 'number' ? turboInfo.fpRadius : undefined,
        syncFrame: Boolean(CFG.zeroDelay),
        holdMs: CFG.zeroDelay ? (Number(CFG.zeroDelayMicroMs) || 0) : (CFG.humanTap ? 35 : 0),
        frameStartMonoMs: (typeof turboInfo.t0 === 'number' && turboInfo.t0 > 0) ? turboInfo.t0 : undefined
      });
      lastDomClickMeta = {
        preText: String(turboInfo.preText || '').slice(0, 40),
        disabled: Boolean(turboInfo.preDis),
        clickX: typeof turboInfo.clickX === 'number' ? turboInfo.clickX : targetX,
        clickY: typeof turboInfo.clickY === 'number' ? turboInfo.clickY : targetY,
        jittered: Boolean(turboInfo.jittered),
        fpSalt: turboInfo.fpSalt ? String(turboInfo.fpSalt) : ''
      };
      if (!turboBadClick) {
        armCashoutWatchdog(
          outCashBeforeTurbo,
          typeof turboInfo.clickX === 'number' ? turboInfo.clickX : targetX,
          typeof turboInfo.clickY === 'number' ? turboInfo.clickY : targetY,
          null,
          lbl
        );
      }
      if (isIframe && turboInfo.fromLocalIframe && !turboBadClick) {
        sendToTop({
          __TT_SNIFFER__: true,
          kind: 'LOCAL_TURBO_HIT',
          tag: String(matched || 'TURBO'),
          roundId: getPktAn().roundId || '',
          src: src,
          elapsed: String(turboInfo.elapsed || '0.00'),
          timeStr: turboInfo.timeStr || timeStr,
          preText: turboInfo.preText || '',
          preDis: Boolean(turboInfo.preDis),
          clickX: typeof turboInfo.clickX === 'number' ? turboInfo.clickX : undefined,
          clickY: typeof turboInfo.clickY === 'number' ? turboInfo.clickY : undefined,
          jittered: Boolean(turboInfo.jittered),
          fpSalt: turboInfo.fpSalt ? String(turboInfo.fpSalt) : '',
          fpPressure: typeof turboInfo.fpPressure === 'number' ? turboInfo.fpPressure : undefined,
          fpRadius: typeof turboInfo.fpRadius === 'number' ? turboInfo.fpRadius : undefined,
          oneShotFired: Boolean(turboInfo.oneShotFired),
          gateEstMs: gInfo && typeof gInfo.gateEstMs === 'number' ? Math.round(gInfo.gateEstMs) : 0
        });
      }
      syncUI();
    } else {
      const decAnMeta = getPktAn();
      if (src !== 'SMS/DOM' && !isRtfPassiveSrc) updateRoundMetaFromText(rawText, decAnMeta);
      if (matched === null && CFG.armed && Number(CFG.fallbackMultX) >= 1.01 && canTrigger && src !== 'SMS/DOM' && !isRtfPassiveSrc && (!CFG.roundOnce || !roundClickLocked)) {
        const curMult = extractLiveMultFromText(rawText, decAnMeta);
        if (curMult !== null && curMult >= Number(CFG.fallbackMultX) && Date.now() - lastAutoMultFiredAt >= 600) {
          lastAutoMultFiredAt = Date.now();
          matched = 'AUTO-X:' + Number(CFG.fallbackMultX).toFixed(2) + 'x';
        }
      }
      if ((src !== 'SMS/DOM' && !isRtfPassiveSrc) || matched !== null || classifyRaceKind(src, rawText)) {
        observeRacePacket(src, kind, rawText, tStart, timeStr, gInfo);
      }
      if (matched !== null) {
        if (CFG.armed) {
          const now = Date.now();
          if (now - lastTriggerAt >= CFG.cooldownMs && (!CFG.roundOnce || !roundClickLocked)) {
            lastTriggerAt = now;
            firedThisFrame = true;
            if (CFG.roundOnce) {
              roundClickLocked = true;
              roundClickLockedAt = now;
              roundSawFlightAfterLock = false;
              roundSawCrashAfterLock = false;
              roundClickLockedRoundId = getPktAn().roundId || '';
              roundLockChanged = true;
            }
            if (CFG.oneShot) {
              CFG.armed = false;
              persistHudControlState();
            }
            fireTargetClick(src + '[' + matched + ']', tStart);
            const needWrongBtnRetry = Boolean(lastDomClickMeta && isButtonAlreadyEnded(lastDomClickMeta.preText, lastDomClickMeta.disabled));
            if (needWrongBtnRetry) {
              if (triggerCount > 0) triggerCount -= 1;
              roundClickLocked = false;
              roundSawCrashAfterLock = false;
              roundLastFlightAt = 0;
              roundClickLockedRoundId = '';
              roundLockChanged = true;
              lastTriggerAt = 0;
              if (CFG.oneShot) { CFG.armed = true; persistHudControlState(); }
              clearPendingTargetRetry();
              let rtLeft = 26;
              let rtRunning = false;
              const runRt = () => {
                if (rtRunning) return;
                if (pendingTargetRetryTimer) { clearTimeout(pendingTargetRetryTimer); pendingTargetRetryTimer = 0; }
                if (!CFG.armed || roundClickLocked || rtLeft <= 0) {
                  clearPendingTargetRetry();
                  return;
                }
                rtRunning = true;
                try {
                  rtLeft -= 1;
                  fbCachedHitEl = null;
                  if (anchor.el && !anchor.el.isConnected) anchor.el = null;
                  fireTargetClick(src + '[' + matched + ']', performance.now());
                  const stillBad = Boolean(lastDomClickMeta && isButtonAlreadyEnded(lastDomClickMeta.preText, lastDomClickMeta.disabled));
                  if (stillBad) {
                    if (triggerCount > 0) triggerCount -= 1;
                    if (rtLeft > 0) pendingTargetRetryTimer = setTimeout(runRt, rtLeft > 14 ? (CFG.zeroDelay ? 2 : 4) : 12);
                    else clearPendingTargetRetry();
                  } else {
                    clearPendingTargetRetry();
                    if (CFG.roundOnce) { roundClickLocked = true; roundClickLockedAt = Date.now(); roundSawFlightAfterLock = false; roundSawCrashAfterLock = false; roundLastFlightAt = 0; roundClickLockedRoundId = getPktAn().roundId || ''; syncTurboCfg(true, false); syncUI(); }
                    if (CFG.oneShot) { CFG.armed = false; persistHudControlState(); syncTurboCfg(true, false); syncUI(); }
                  }
                } finally {
                  rtRunning = false;
                }
              };
              if (typeof MutationObserver === 'function' && (document.body || document.documentElement)) {
                try {
                  pendingTargetRetryObs = new MutationObserver((muts) => {
                    if (pendingTargetRetryTimer || rtRunning) return;
                    let hasGameMut = false;
                    for (let mi = 0; mi < muts.length; mi++) {
                      if (!isOwnHudNode(muts[mi].target)) { hasGameMut = true; break; }
                    }
                    if (hasGameMut) pendingTargetRetryTimer = setTimeout(runRt, CFG.zeroDelay ? 2 : 4);
                  });
                  pendingTargetRetryObs.observe(document.body || document.documentElement, {
                    attributes: true,
                    attributeFilter: ['disabled', 'aria-disabled', 'class', 'style', 'hidden', 'data-state'],
                    childList: true,
                    characterData: true,
                    subtree: true
                  });
                } catch {}
              }
              pendingTargetRetryTimer = setTimeout(runRt, CFG.zeroDelay ? 2 : 4);
            }
          }
        } else {
          lastMatchPreview = src + '[' + String(matched).slice(0, 16) + ']';
          if (elStatus) elStatus.textContent = 'Hits: ' + triggerCount + (lastHitTag ? (' · ' + lastHitTag) : (' · Match✓ ' + lastMatchPreview));
        }
      }
    }

    if (canTrigger && (CFG.crashBuzzer || (CFG.armed && CFG.roundOnce && (roundClickLocked || pendingTargetRetryTimer)))) {
      const pktLockChk = getPktAn();
      if (src !== 'SMS/DOM') maybeTriggerCrashSignal(src, rawText, pktLockChk);
      if (CFG.armed && CFG.roundOnce && (roundClickLocked || pendingTargetRetryTimer)) {
        const rcKind = classifyRaceKind(src, rawText);
        const nowUnlockMs = Date.now();
        const lockAge = nowUnlockMs - roundClickLockedAt;
        const isPlainCrash = pktLockChk.isCrash || (!pktLockChk.hasJson && !pktLockChk.hasXml && rcKind === 'CRASH');
        if (isPlainCrash) {
          roundSawCrashAfterLock = true;
          clearPendingTargetRetry();
        }
        if (roundClickLocked) {
          const isRoundChangeFirst = Boolean(matched === null && lockAge >= 60 && pktLockChk.roundId && roundClickLockedRoundId && pktLockChk.roundId !== roundClickLockedRoundId);
          if (!isRoundChangeFirst && pktLockChk.inFlight && (!roundClickLockedRoundId || !pktLockChk.roundId || pktLockChk.roundId === roundClickLockedRoundId)) {
            roundSawFlightAfterLock = true;
            roundLastFlightAt = nowUnlockMs;
          } else if (!firedThisFrame && lockAge >= 60) {
            const isCrashUnlock = isPlainCrash;
            const isRoundChangeUnlock = isRoundChangeFirst;
            const isStartUnlock = (pktLockChk.isStart || (!pktLockChk.hasJson && !pktLockChk.hasXml && rcKind === 'START')) && matched === null && (roundSawFlightAfterLock || roundSawCrashAfterLock || lockAge >= 450);
            const isStaleUnlock = matched === null && ((lockAge >= 4500 && !roundSawFlightAfterLock) || (roundSawFlightAfterLock && roundLastFlightAt > 0 && nowUnlockMs - roundLastFlightAt >= 3500 && lockAge >= 4500) || lockAge >= 25000);
            if (isCrashUnlock || isRoundChangeUnlock || isStartUnlock || isStaleUnlock) {
              roundClickLocked = false;
              roundSawFlightAfterLock = false;
              roundSawCrashAfterLock = false;
              roundLastFlightAt = 0;
              roundClickLockedRoundId = '';
              roundUnlockSeq += 1;
              syncTurboCfg(true, false);
              if (hudHidden) {
                sendToTop({ __TT_SNIFFER__: true, kind: 'ROUND_UNLOCK' });
              } else {
                broadcastDownToIframes({ __TT_SNIFFER__: true, kind: 'ROUND_UNLOCK' });
                syncUI();
              }
            }
          }
        }
      }
    } else if (roundLockChanged && !hudHidden) {
      syncUI();
    }

    if ((isRealWs || isRealApi) && !userClosed) {
      if (localWsCount === 1 || localApiCount === 1 || (localWsCount + localApiCount) % 150 === 0) {
        setTimeout(() => publishHudClaim(false), 0);
      }
    }

    const isStaticAssetApi = isRealApi && /\/i18n\/|\/locales\/|\/translations\/|\/assets\/.*\.json/i.test(rawText.slice(0, 320));
    if (isStaticAssetApi) return;

    const direction = srcToDirection(src);
    const inspFromGate = (gInfo && gInfo.insp) ? gInfo.insp : null;
    const shouldInspectApi = isRealWs || (isRealApi && !/^(\d+\s+)?GET\s+/i.test(rawText.slice(0, 64)));
    const inspRes = (inspFromGate && inspFromGate.reasons)
      ? inspFromGate
      : (shouldInspectApi ? inspectTextPayload(rawText) : { matched: false, reasons: [] });
    const heldMs = (gInfo && typeof gInfo.inspHeldMs === 'number' && gInfo.inspHeldMs > 0)
      ? Math.round(gInfo.inspHeldMs)
      : (gInfo && typeof gInfo.gateEstMs === 'number' && gInfo.gateEstMs > 0 && inspRes.matched ? Math.round(gInfo.gateEstMs) : undefined);

    const storedText = rawText.length > 6000 ? rawText.slice(0, 6000) : rawText;
    const item = {
      uid: FRAME_ID + ':' + (++evSeq),
      src,
      kind,
      direction,
      reasons: inspRes.reasons || [],
      inspectorMatched: Boolean(inspRes.matched),
      heldMs,
      text: storedText,
      pretty: null,
      matched: matched !== null,
      matchedTag: matched || '',
      time: timeStr,
      monoMs: Number(tStart.toFixed(2))
    };
    pushPreservedLogs(item);
    if (elPeek && isRealWs && (item.heldMs > 0 || item.inspectorMatched || item.matched)) {
      const compactTxt = storedText.replace(/\s+/g, ' ').slice(0, 120);
      const holdLbl = item.heldMs ? ('⏳-' + item.heldMs + 'ms ') : (item.inspectorMatched ? '🔍INSP ' : '⚡HIT ');
      const clkLbl = item.matched ? '· ⚡CLICK ' : '';
      const rsnLbl = (item.reasons && item.reasons.length) ? ('[' + item.reasons[0] + '] ') : '';
      elPeek.textContent = holdLbl + clkLbl + item.src + ' ' + rsnLbl + compactTxt;
      elPeek.style.display = 'block';
      if (item.matched) {
        elPeek.style.background = 'rgba(16,185,129,0.18)';
        elPeek.style.borderColor = 'rgba(16,185,129,0.5)';
        elPeek.style.color = '#6ee7b7';
      } else {
        elPeek.style.background = 'rgba(245,158,11,0.14)';
        elPeek.style.borderColor = 'rgba(245,158,11,0.45)';
        elPeek.style.color = '#fde68a';
      }
    }
    if (isRealApi) {
      totalApiCount += 1;
      apiLogs.unshift(item);
      if (apiLogs.length > 200) apiLogs.length = 200;
    } else {
      totalWsCount += 1;
      wsLogs.unshift(item);
      if (wsLogs.length > 200) wsLogs.length = 200;
    }
    try { TTAsyncWorkerEngine.enqueue(src, rawText, tStart); } catch {}
    try { runAutoSiteProfileEngine(src, rawText); } catch {}
    try { discoverNonMultiplierTags(src, rawText, tStart, timeStr); } catch {}
    if (src !== 'SMS/DOM' || isRtfPassiveSrc || item.matched) {
      queueRelay(item);
    }
    scheduleRenderLogs();
  }

  // --- Draggable Crosshair & Panel (PointerEvent + Touch + Mouse) ---
  const dragCleanups = [];
  function makeDraggable(handle, onMove, canDrag, onEnd, onStart) {
    let dragging = false;
    let activePointerId = null;
    let startX = 0, startY = 0;

    const getPt = (e) => (e.touches && e.touches[0]) ? e.touches[0] : (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;

    const finish = (e) => {
      if (!dragging) return;
      dragging = false;
      if (activePointerId !== null && handle.releasePointerCapture) {
        try { handle.releasePointerCapture(activePointerId); } catch {}
      }
      activePointerId = null;
      if (e) e.stopPropagation();
      if (onEnd) onEnd();
    };

    const stopTouchDuringDrag = (e) => {
      if (canDrag && !canDrag(e)) return;
      e.stopPropagation();
    };

    if (window.PointerEvent) {
      handle.addEventListener('touchstart', stopTouchDuringDrag, { passive: true });
      handle.addEventListener('touchmove', stopTouchDuringDrag, { passive: true });
      const onPointerMove = (e) => {
        if (!dragging) return;
        if (activePointerId !== null && e.pointerId !== activePointerId) return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!dx && !dy) return;
        startX = e.clientX;
        startY = e.clientY;
        onMove(dx, dy);
      };
      const onVisFinish = () => { if (document.hidden) finish(); };
      handle.addEventListener('pointerdown', (e) => {
        if (canDrag && !canDrag(e)) return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        dragging = true;
        activePointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        if (handle.setPointerCapture) {
          try { handle.setPointerCapture(e.pointerId); } catch {}
        }
        if (onStart) onStart();
      });
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
      window.addEventListener('blur', finish);
      document.addEventListener('visibilitychange', onVisFinish);
      dragCleanups.push(() => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        window.removeEventListener('blur', finish);
        document.removeEventListener('visibilitychange', onVisFinish);
      });
    } else {
      const down = (e) => {
        if (canDrag && !canDrag(e)) return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        const pt = getPt(e);
        dragging = true;
        startX = pt.clientX;
        startY = pt.clientY;
        if (onStart) onStart();
      };
      const move = (e) => {
        if (!dragging) return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        const pt = getPt(e);
        const dx = pt.clientX - startX;
        const dy = pt.clientY - startY;
        startX = pt.clientX;
        startY = pt.clientY;
        onMove(dx, dy);
      };
      handle.addEventListener('mousedown', down);
      handle.addEventListener('touchstart', down, { passive: false });
      window.addEventListener('mousemove', move);
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('mouseup', finish);
      window.addEventListener('touchend', finish);
      window.addEventListener('touchcancel', finish);
      dragCleanups.push(() => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('mouseup', finish);
        window.removeEventListener('touchend', finish);
        window.removeEventListener('touchcancel', finish);
      });
    }
  }

  makeDraggable(crosshair, (dx, dy) => {
    targetX += dx;
    targetY += dy;
    clampTarget();
    crosshair.style.left = (targetX - half) + 'px';
    crosshair.style.top = (targetY - half) + 'px';
  }, () => !locked, () => {
    isDraggingTarget = false;
    crosshair.style.zIndex = '15';
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';
    captureAnchorAtPoint(false);
    syncTurboCfg(true, false);
  }, () => {
    markUserTouched();
    isDraggingTarget = true;
    crosshair.style.zIndex = '30';
    panel.style.opacity = '0.16';
    panel.style.pointerEvents = 'none';
  });

  let shiftRafId = 0;
  const onViewportShift = () => {
    syncPositionFromAnchor();
    if (!shiftRafId && typeof requestAnimationFrame === 'function') {
      shiftRafId = requestAnimationFrame(() => {
        shiftRafId = 0;
        syncPositionFromAnchor();
      });
    }
    try {
      if (panel && panel.style.left) {
        const rect = panel.getBoundingClientRect();
        const pVw = window.innerWidth || 360;
        const pVh = window.innerHeight || 640;
        if (pVw >= 160 && pVh >= 160 && rect.width > 0) {
          panel.style.left = Math.max(4, Math.min(pVw - Math.min(rect.width, pVw - 8) - 4, rect.left)) + 'px';
          panel.style.top = Math.max(4, Math.min(pVh - 44, rect.top)) + 'px';
        }
      }
    } catch {}
  };
  window.addEventListener('resize', onViewportShift, { passive: true });
  window.addEventListener('scroll', onViewportShift, { capture: true, passive: true });
  document.addEventListener('scroll', onViewportShift, { capture: true, passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportShift, { passive: true });
    window.visualViewport.addEventListener('scroll', onViewportShift, { passive: true });
  }
  const anchorSyncTimer = setInterval(() => {
    if (!hudHidden && !userClosed && document.body && root.parentNode !== document.body) {
      mountRootEl();
    }
    const trackHiddenIframe = Boolean(hudHidden && isIframe && iframeLocalTarget.active && CFG.armed);
    if ((!hudHidden || trackHiddenIframe) && !isDraggingTarget && !document.hidden && (locked || !minimized || CFG.armed)) {
      syncPositionFromAnchor();
    }
  }, 150);

  makeDraggable(elHdr, (dx, dy) => {
    const rect = panel.getBoundingClientRect();
    panel.style.right = 'auto';
    panel.style.left = Math.max(4, Math.min(window.innerWidth - rect.width - 4, rect.left + dx)) + 'px';
    panel.style.top = Math.max(4, Math.min(window.innerHeight - 40, rect.top + dy)) + 'px';
  }, (e) => !(e.target && e.target.closest && e.target.closest('button')), () => {
    try {
      if (panel.style.left && panel.style.top) {
        localStorage.setItem('__tt_panel_pos', JSON.stringify({
          left: Math.round(parseFloat(panel.style.left) || 8),
          top: Math.round(parseFloat(panel.style.top) || 6)
        }));
      }
    } catch {}
  }, () => {
    markUserTouched();
  });

  // --- Dual-Origin HTTP Bridge + Encrypted MQTT-over-WSS Live Relay + Iframe Aggregation ---
  function buildApiUrl(base, pathOrUrl) {
    let p = String(pathOrUrl || '/api/relay/push');
    if (p.startsWith('http://') || p.startsWith('https://')) {
      try {
        const u = new URL(p);
        p = u.pathname + u.search;
      } catch {}
    }
    const sep = p.includes('?') ? '&' : '?';
    const hasRoom = /[?&]roomId=/.test(p);
    return base.replace(/\/+$/, '') + p + (hasRoom ? '' : (sep + 'roomId=' + encodeURIComponent(CFG.roomId)));
  }

  function gmHttp(method, pathOrUrl, bodyObj, callback, _attemptIdx) {
    const attemptIdx = _attemptIdx || 0;
    if (!HTTP_BASES.length) {
      httpSyncState = 'ERR';
      updateSyncDot();
      if (callback) callback(new Error('No relay base URL'));
      return;
    }
    const gmReq = (typeof GM_xmlhttpRequest !== 'undefined')
      ? GM_xmlhttpRequest
      : (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function' ? GM.xmlHttpRequest : null);

    const targetIdx = (activeHttpIdx + attemptIdx) % HTTP_BASES.length;
    const targetBase = HTTP_BASES[targetIdx] || BOT_BASE_URL;
    const url = buildApiUrl(targetBase, pathOrUrl);

    let bodyStr;
    if (bodyObj) {
      bodyStr = typeof bodyObj === 'object' ? JSON.stringify(bodyObj) : String(bodyObj);
    }

    const tryNextOrFail = (state, err) => {
      if (attemptIdx + 1 < HTTP_BASES.length) {
        gmHttp(method, pathOrUrl, bodyObj, callback, attemptIdx + 1);
        return;
      }
      httpFailCount = Math.min(20, httpFailCount + 1);
      httpSyncState = state;
      lastHttpRetryAt = Date.now();
      updateSyncDot();
      if (callback) callback(err);
    };

    const processResponse = (status, rawText) => {
      if (status === 401 || status === 403) {
        tryNextOrFail('AUTH_BLOCKED', new Error('HTTP ' + status + ' Auth Blocked'));
        return;
      }
      if (status >= 200 && status < 300) {
        const txt = (rawText || '').trim();
        if (!txt || txt.startsWith('<')) {
          tryNextOrFail('AUTH_BLOCKED', new Error('IAP HTML Redirect'));
          return;
        }
        try {
          const parsed = JSON.parse(txt);
          if (parsed && (parsed.ok === true || parsed.success === true)) {
            activeHttpIdx = targetIdx;
            httpFailCount = 0;
            httpSyncState = 'OK';
            updateSyncDot();
            if (callback) callback(null, parsed);
            return;
          }
        } catch {}
      }
      tryNextOrFail('ERR', new Error('HTTP ' + status));
    };

    if (typeof gmReq === 'function') {
      try {
        const gmPromise = gmReq({
          method: method,
          url: url,
          headers: bodyStr ? { 'Content-Type': 'application/json', 'Accept': 'application/json' } : { 'Accept': 'application/json' },
          data: bodyStr,
          timeout: 4000,
          onload: function (res) { processResponse((res && res.status) || 0, (res && (res.responseText != null ? res.responseText : res.response)) || ''); },
          onerror: function (err) { tryNextOrFail('ERR', err); },
          ontimeout: function () { tryNextOrFail('ERR', new Error('Timeout')); }
        });
        if (gmPromise && typeof gmPromise.catch === 'function') gmPromise.catch(() => {});
        return;
      } catch {}
    }

    if (typeof NativeFetch === 'function') {
      NativeFetch.call(targetWin, url, {
        method: method,
        mode: 'cors',
        headers: bodyStr ? { 'Content-Type': 'text/plain' } : undefined,
        body: bodyStr
      }).then((r) => r.text().then((t) => processResponse(r.status, t)))
        .catch((err) => tryNextOrFail('ERR', err));
    } else if (nativeBeacon && bodyStr) {
      try { nativeBeacon(url, bodyStr); } catch {}
    }
  }

  function runHudAiRoundCheck(explicitFrames, explicitRawTotal) {
    if (aiHudLoading) return;
    let rawTotal = 0;
    let frames = [];
    if (Array.isArray(explicitFrames) && explicitFrames.length > 0) {
      rawTotal = Math.max(explicitFrames.length, Number(explicitRawTotal) || 0);
      frames = sliceFramesForSmartSegmenter(explicitFrames, rawTotal);
    } else if (aiCurRoundFrames.length >= 4) {
      rawTotal = Math.max(aiCurRoundRawCount, aiCurRoundFrames.length);
      frames = sliceFramesForSmartSegmenter(aiCurRoundFrames, rawTotal);
    } else if (aiLastRoundFrames.length > 0) {
      rawTotal = Math.max(aiLastRoundRawCount, aiLastRoundFrames.length);
      frames = sliceFramesForSmartSegmenter(aiLastRoundFrames, rawTotal);
    } else {
      rawTotal = Math.max(aiCurRoundRawCount, aiCurRoundFrames.length);
      frames = sliceFramesForSmartSegmenter(aiCurRoundFrames, rawTotal);
    }
    if (frames.length === 0) {
      const harvested = [];
      for (let i = 0; i < wsLogs.length && harvested.length < 120; i++) {
        const w = wsLogs[i];
        if (!w || !w.text || w.src === 'CLICK' || w.src === 'WS-OUT') continue;
        harvested.push({ src: w.src, text: String(w.text).slice(0, 1200), time: w.time || '', monoMs: w.monoMs || 0 });
      }
      for (let i = 0; i < apiLogs.length && harvested.length < 140; i++) {
        const a = apiLogs[i];
        if (!a || !a.text || a.src === 'API-REQ') continue;
        harvested.push({ src: a.src, text: String(a.text).slice(0, 1200), time: a.time || '', monoMs: a.monoMs || 0 });
      }
      const rev = harvested.reverse();
      rawTotal = rev.length;
      frames = sliceFramesForSmartSegmenter(rev, rawTotal);
    }
    if (!HTTP_BASES.length && !CFG.relayEnabled) {
      aiHudError = CFG.lang === 'bn' ? 'Relay URL বা WSS পাওয়া যায়নি' : 'Relay URL / WSS not configured';
      if (activeTab === 'tags') renderLogs(true);
      return;
    }
    aiHudLoading = true;
    aiHudError = '';
    if (activeTab === 'tags') renderLogs(true);

    const segMeta = getSmartSegmentWindow(rawTotal);
    const segmenterConfig = {
      enabled: segMeta.enabled,
      threshold: segMeta.threshold,
      expectedTotal: segMeta.expectedTotal
    };
    const roundHint = frames.length > 0
      ? (segMeta.active
          ? ('Seg ' + segMeta.rawCount + '/' + segMeta.expectedTotal + ' -> Tail 50% (' + frames.length + ' HUD frames)')
          : (frames.length + ' HUD frames'))
      : 'relay room buffer';
    const payloadStr = JSON.stringify({
      roomId: CFG.roomId,
      messages: frames,
      roundHint: roundHint,
      rawTotal: rawTotal,
      segmenterConfig: segmenterConfig
    });
    const gmReq = (typeof GM_xmlhttpRequest !== 'undefined')
      ? GM_xmlhttpRequest
      : (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function' ? GM.xmlHttpRequest : null);

    const finishSuccess = (analysis) => {
      aiHudLoading = false;
      aiHudAnalysis = analysis;
      aiHudError = '';
      if (activeTab === 'tags') renderLogs(true);
    };
    const finishFailure = (errMsg) => {
      aiHudLoading = false;
      aiHudError = String(errMsg || (CFG.lang === 'bn' ? 'AI বিশ্লেষণ ব্যর্থ' : 'AI analysis failed'));
      if (activeTab === 'tags') renderLogs(true);
    };

    const tryWssProxy = (lastHttpErr) => {
      if (!CFG.relayEnabled || typeof TTWssRelay.requestAiAnalysis !== 'function') {
        finishFailure(lastHttpErr || 'AI HTTP unreachable');
        return;
      }
      TTWssRelay.requestAiAnalysis({
        messages: frames,
        roundHint: roundHint,
        rawTotal: rawTotal,
        segmenterConfig: segmenterConfig
      }).then((res) => {
        if (res && res.ok && res.analysis) {
          finishSuccess(res.analysis);
        } else {
          const msg = (res && res.error) ? String(res.error) : (lastHttpErr || (CFG.lang === 'bn' ? 'WSS AI Proxy উত্তর দেয়নি — অ্যাপ ট্যাবটি খোলা রাখুন' : 'WSS AI Proxy no reply — keep TriggerTap tab open'));
          finishFailure(msg);
        }
      }).catch(() => {
        finishFailure(lastHttpErr || 'AI proxy error');
      });
    };

    const tryHttpBase = (attemptIdx, lastErr) => {
      if (attemptIdx >= HTTP_BASES.length) {
        tryWssProxy(lastErr);
        return;
      }
      const targetIdx = (activeHttpIdx + attemptIdx) % HTTP_BASES.length;
      const baseUrl = HTTP_BASES[targetIdx] || BOT_BASE_URL;
      const aiUrl = baseUrl.replace(/\/+$/, '') + '/api/ai/analyze-round?roomId=' + encodeURIComponent(CFG.roomId);

      const handleHttpReply = (status, rawText, netErr) => {
        if (netErr) {
          tryHttpBase(attemptIdx + 1, netErr.message || 'AI network error');
          return;
        }
        const trimmed = String(rawText || '').trim();
        if (status === 401 || status === 403 || !trimmed || trimmed.startsWith('<')) {
          tryHttpBase(attemptIdx + 1, status === 401 || status === 403 ? ('Auth gate HTTP ' + status) : ('HTML gateway HTTP ' + status));
          return;
        }
        try {
          const parsed = JSON.parse(trimmed);
          if (status >= 200 && status < 300 && parsed && parsed.ok && parsed.analysis) {
            activeHttpIdx = targetIdx;
            finishSuccess(parsed.analysis);
            return;
          }
          const srvErr = (parsed && parsed.error) ? String(parsed.error) : ('AI HTTP ' + status);
          if ((parsed && parsed.code === 'MISSING_API_KEY') || (status >= 400 && status < 500 && status !== 404 && parsed && parsed.error)) {
            finishFailure(srvErr);
            return;
          }
          tryHttpBase(attemptIdx + 1, srvErr);
        } catch {
          tryHttpBase(attemptIdx + 1, 'AI JSON parse error (HTTP ' + status + ')');
        }
      };

      if (typeof gmReq === 'function') {
        try {
          const aiPromise = gmReq({
            method: 'POST',
            url: aiUrl,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            data: payloadStr,
            timeout: 22000,
            onload: (res) => handleHttpReply((res && res.status) || 0, (res && (res.responseText != null ? res.responseText : res.response)) || '', null),
            onerror: () => handleHttpReply(0, '', new Error('AI network error')),
            ontimeout: () => handleHttpReply(0, '', new Error('AI timeout'))
          });
          if (aiPromise && typeof aiPromise.catch === 'function') aiPromise.catch(() => {});
          return;
        } catch {}
      }

      if (typeof NativeFetch === 'function') {
        NativeFetch.call(targetWin, aiUrl, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain' },
          body: payloadStr
        }).then((r) => r.text().then((t) => handleHttpReply(r.status, t, null)))
          .catch((err) => handleHttpReply(0, '', err));
      } else {
        tryHttpBase(attemptIdx + 1, 'No HTTP client');
      }
    };

    tryHttpBase(0, '');
  }

  function u8ToB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function concatU8(parts) {
    let total = 0;
    for (let i = 0; i < parts.length; i++) total += parts[i].length;
    const out = new Uint8Array(total);
    let off = 0;
    for (let i = 0; i < parts.length; i++) {
      out.set(parts[i], off);
      off += parts[i].length;
    }
    return out;
  }
  function mqttRemLen(len) {
    const bytes = [];
    let x = len;
    do {
      let b = x % 128;
      x = Math.floor(x / 128);
      if (x > 0) b |= 128;
      bytes.push(b);
    } while (x > 0);
    return new Uint8Array(bytes);
  }
  function mqttStr(s) {
    const u = utf8Enc ? utf8Enc.encode(s) : new Uint8Array(0);
    const out = new Uint8Array(2 + u.length);
    out[0] = (u.length >> 8) & 0xff;
    out[1] = u.length & 0xff;
    out.set(u, 2);
    return out;
  }

  const TTWssRelay = (function () {
    let ws = null;
    let brokerIdx = 0;
    try {
      const savedIdx = parseInt(localStorage.getItem('__tt_wss_idx') || '0', 10);
      if (!Number.isNaN(savedIdx) && savedIdx >= 0 && savedIdx < RELAY_BROKERS.length) brokerIdx = savedIdx;
    } catch {}
    let trialSockets = [];
    let pingTimer = null;
    let pingGraceTimer = null;
    let flushTimer = null;
    let reconnTimer = null;
    let connWatchdog = null;
    let lastPongAt = 0;
    let pktId = 1;
    let aesKeyPromise = null;
    let aesKeyRoom = '';
    let destroyed = false;
    let failStreak = 0;
    let connSeq = 0;
    let connectGen = 0;
    const pendingQueue = [];
    const pendingAiReqs = new Map();
    const clientId = 'tt_snf_' + Math.random().toString(36).substring(2, 10);

    function b64ToU8(b64) {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }

    async function getKey() {
      if (!window.crypto || !window.crypto.subtle || !utf8Enc) return null;
      if (aesKeyPromise && aesKeyRoom === CFG.roomId) return aesKeyPromise;
      aesKeyRoom = CFG.roomId;
      aesKeyPromise = (async () => {
        try {
          const hash = await window.crypto.subtle.digest('SHA-256', utf8Enc.encode('TRIGGERTAP_E2EE_V1:' + CFG.roomId));
          return await window.crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        } catch { return null; }
      })();
      return aesKeyPromise;
    }

    async function encryptObj(obj) {
      const jsonStr = JSON.stringify(obj);
      const key = await getKey();
      if (!key || !utf8Enc) return jsonStr;
      try {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const ctBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, utf8Enc.encode(jsonStr));
        return JSON.stringify({ v: 1, iv: u8ToB64(iv), ct: u8ToB64(new Uint8Array(ctBuf)) });
      } catch { return jsonStr; }
    }

    async function decryptDownStr(raw) {
      try {
        const env = JSON.parse(raw);
        if (env && env.v === 1 && env.iv && env.ct && utf8Dec) {
          const key = await getKey();
          if (!key) return null;
          const ivBytes = b64ToU8(env.iv);
          const ctBytes = b64ToU8(env.ct);
          const plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ctBytes);
          return JSON.parse(utf8Dec.decode(plainBuf));
        }
        return env;
      } catch { return null; }
    }

    function sendOnSock(sock, bytes) {
      if (!sock || sock.readyState !== 1) return false;
      try {
        if (rawProtoSendGlobal) rawProtoSendGlobal.call(sock, bytes);
        else sock.send(bytes);
        return true;
      } catch { return false; }
    }

    function sendRelayRaw(bytes) {
      return sendOnSock(ws, bytes);
    }

    function sendPublishRaw(topic, str) {
      if (!ws || ws.readyState !== 1 || !utf8Enc) return false;
      try {
        const body = concatU8([mqttStr(topic), utf8Enc.encode(str)]);
        const pkt = concatU8([new Uint8Array([0x30]), mqttRemLen(body.length), body]);
        return sendRelayRaw(pkt);
      } catch { return false; }
    }

    function enqueueRelayPending(obj) {
      if (!obj) return;
      if (pendingQueue.length >= 160) {
        let dropIdx = -1;
        for (let i = 0; i < pendingQueue.length; i++) {
          const q = pendingQueue[i];
          const hasMatched = q && Array.isArray(q.events) && q.events.some((e) => e && (e.matched || e.inspectorMatched || e.src === 'CLICK'));
          if (!hasMatched && (!q || q.type !== 'TT_AI_REQ')) {
            dropIdx = i;
            break;
          }
        }
        pendingQueue.splice(dropIdx >= 0 ? dropIdx : 0, 1);
      }
      pendingQueue.push(obj);
    }

    function closeTrials(keepSock) {
      for (let i = 0; i < trialSockets.length; i++) {
        const s = trialSockets[i];
        if (s && s !== keepSock) {
          try { s.close(); } catch {}
        }
      }
      trialSockets = keepSock ? [keepSock] : [];
    }

    function scheduleReconnect(delayMs) {
      if (destroyed || (isIframe && !iframeFallbackActive) || reconnTimer || !CFG.relayEnabled) return;
      const wait = Math.min(4000, (delayMs || 120) + failStreak * 350);
      reconnTimer = setTimeout(() => {
        reconnTimer = null;
        brokerIdx = (brokerIdx + 1) % RELAY_BROKERS.length;
        connect();
      }, wait);
    }

    function flushQueue() {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      if (destroyed || wssSyncState !== 'OK' || !ws || ws.readyState !== 1) return;
      if (pendingQueue.length === 0) return;
      const burst = Math.min(2, pendingQueue.length);
      for (let bi = 0; bi < burst; bi++) {
        const item = pendingQueue.shift();
        if (item) publishUp(item);
      }
      if (pendingQueue.length > 0 && !destroyed) {
        flushTimer = setTimeout(flushQueue, 20);
      }
    }

    function probeOrReconnect() {
      if (destroyed || (isIframe && !iframeFallbackActive) || !CFG.relayEnabled) return;
      if (!ws || ws.readyState !== 1) {
        connect();
        return;
      }
      if (!sendRelayRaw(new Uint8Array([0xc0, 0x00]))) {
        connect();
        return;
      }
      if (pingGraceTimer) { clearTimeout(pingGraceTimer); pingGraceTimer = null; }
      const genSnap = connectGen;
      const sockSnap = ws;
      pingGraceTimer = setTimeout(() => {
        pingGraceTimer = null;
        if (destroyed || genSnap !== connectGen || ws !== sockSnap) return;
        if (Date.now() - lastPongAt > 15000) connect();
      }, 3000);
    }

    function processRx(sock, state) {
      while (state.buf.length >= 2) {
        const pType = (state.buf[0] >> 4) & 0x0f;
        const flags = state.buf[0] & 0x0f;
        let mult = 1, remLen = 0, pos = 1, full = true;
        while (true) {
          if (pos >= state.buf.length) { full = false; break; }
          const b = state.buf[pos++];
          remLen += (b & 127) * mult;
          if ((b & 128) === 0) break;
          mult *= 128;
          if (mult > 2097152) { state.buf = new Uint8Array(0); return; }
        }
        if (!full || state.buf.length < pos + remLen) return;
        const body = state.buf.slice(pos, pos + remLen);
        state.buf = state.buf.slice(pos + remLen);

        if (pType === 2 && body.length >= 2 && body[1] === 0) {
          if (ws && ws !== sock && wssSyncState === 'OK') {
            try { sock.close(); } catch {}
            return;
          }
          if (connWatchdog) { clearTimeout(connWatchdog); connWatchdog = null; }
          if (pingGraceTimer) { clearTimeout(pingGraceTimer); pingGraceTimer = null; }
          ws = sock;
          failStreak = 0;
          brokerIdx = state.idx;
          try { localStorage.setItem('__tt_wss_idx', String(state.idx)); } catch {}
          closeTrials(sock);
          lastPongAt = Date.now();
          wssSyncState = 'OK';
          updateSyncDot();
          const downTopic = 'triggertap/v1/' + CFG.roomId + '/down';
          pktId = (pktId % 65000) + 1;
          const subPayload = concatU8([new Uint8Array([(pktId >> 8) & 0xff, pktId & 0xff]), mqttStr(downTopic), new Uint8Array([0x00])]);
          sendRelayRaw(concatU8([new Uint8Array([0x82]), mqttRemLen(subPayload.length), subPayload]));
          if (pingTimer) clearInterval(pingTimer);
          pingTimer = setInterval(() => {
            if (destroyed) return;
            if (!ws || ws.readyState !== 1) { connect(); return; }
            if (Date.now() - lastPongAt > 15000) { probeOrReconnect(); return; }
            if (!sendRelayRaw(new Uint8Array([0xc0, 0x00]))) connect();
          }, 8000);
          flushQueue();
        } else if (sock === ws && pType === 13) {
          lastPongAt = Date.now();
          if (pingGraceTimer) { clearTimeout(pingGraceTimer); pingGraceTimer = null; }
        } else if (sock === ws && pType === 3 && body.length >= 2 && utf8Dec) {
          const tLen = (body[0] << 8) | body[1];
          let idx = 2 + tLen;
          const qos = (flags >> 1) & 0x03;
          if (qos > 0) idx += 2;
          if (idx <= body.length) {
            const msgText = utf8Dec.decode(body.slice(idx));
            decryptDownStr(msgText).then((msg) => {
              if (destroyed || !msg) return;
              if (msg.type === 'TT_CMD' && msg.cmd === 'START_ELEMENT_PICKER') {
                if (typeof startElementPickerMode === 'function') startElementPickerMode(false);
              } else if (msg.type === 'TT_AI_RES' && typeof msg.reqId === 'string') {
                const resolver = pendingAiReqs.get(msg.reqId);
                if (resolver) {
                  pendingAiReqs.delete(msg.reqId);
                  resolver(msg);
                }
              }
            }).catch(() => {});
          }
        }
      }
    }

    function connect() {
      if (destroyed || (isIframe && !iframeFallbackActive) || !NativeWebSocket || !CFG.relayEnabled) return;
      connectGen += 1;
      const myGen = connectGen;
      if (reconnTimer) { clearTimeout(reconnTimer); reconnTimer = null; }
      if (connWatchdog) { clearTimeout(connWatchdog); connWatchdog = null; }
      if (pingGraceTimer) { clearTimeout(pingGraceTimer); pingGraceTimer = null; }
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      closeTrials(null);
      if (ws) { try { ws.close(); } catch {} ws = null; }

      wssSyncState = failStreak >= 3 ? 'ERR' : 'WAIT';
      updateSyncDot();
      let closedTrials = 0;
      const totalBrokers = RELAY_BROKERS.length;

      connWatchdog = setTimeout(() => {
        if (myGen !== connectGen) return;
        if (wssSyncState !== 'OK') {
          failStreak = Math.min(8, failStreak + 1);
          closeTrials(null);
          wssSyncState = failStreak >= 3 ? 'ERR' : 'WAIT';
          updateSyncDot();
          scheduleReconnect(150);
        }
      }, 6500);

      for (let offset = 0; offset < totalBrokers; offset++) {
        const idx = (brokerIdx + offset) % totalBrokers;
        const url = RELAY_BROKERS[idx];
        const state = { idx, buf: new Uint8Array(0), closed: false };
        try {
          const sock = new NativeWebSocket(url, ['mqtt']);
          sock.binaryType = 'arraybuffer';
          trialSockets.push(sock);

          sock.onopen = () => {
            if (destroyed || myGen !== connectGen || (ws && ws !== sock && wssSyncState === 'OK')) {
              try { sock.close(); } catch {}
              return;
            }
            const cid = clientId + '_' + idx + '_' + (++connSeq);
            const payload = concatU8([mqttStr('MQTT'), new Uint8Array([0x04, 0x02, 0x00, 0x19]), mqttStr(cid)]);
            sendOnSock(sock, concatU8([new Uint8Array([0x10]), mqttRemLen(payload.length), payload]));
          };
          sock.onmessage = (ev) => {
            if (destroyed || myGen !== connectGen || (ws && ws !== sock && wssSyncState === 'OK')) return;
            if (sock === ws) {
              lastPongAt = Date.now();
              if (pingGraceTimer) { clearTimeout(pingGraceTimer); pingGraceTimer = null; }
            }
            if (ev.data instanceof ArrayBuffer) {
              state.buf = concatU8([state.buf, new Uint8Array(ev.data)]);
              processRx(sock, state);
            } else if (typeof Blob !== 'undefined' && ev.data instanceof Blob) {
              ev.data.arrayBuffer().then((buf) => {
                if (destroyed || myGen !== connectGen || (ws && ws !== sock && wssSyncState === 'OK')) return;
                if (sock === ws) {
                  lastPongAt = Date.now();
                  if (pingGraceTimer) { clearTimeout(pingGraceTimer); pingGraceTimer = null; }
                }
                state.buf = concatU8([state.buf, new Uint8Array(buf)]);
                processRx(sock, state);
              }).catch(() => {});
            }
          };
          const handleTrialFail = () => {
            if (myGen !== connectGen) return;
            if (sock === ws) {
              if (connWatchdog) { clearTimeout(connWatchdog); connWatchdog = null; }
              if (pingGraceTimer) { clearTimeout(pingGraceTimer); pingGraceTimer = null; }
              if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
              if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
              ws = null;
              wssSyncState = failStreak >= 3 ? 'ERR' : 'WAIT';
              updateSyncDot();
              scheduleReconnect(180);
              return;
            }
            if (!state.closed) {
              state.closed = true;
              closedTrials += 1;
              if (closedTrials >= totalBrokers && wssSyncState !== 'OK') {
                if (connWatchdog) { clearTimeout(connWatchdog); connWatchdog = null; }
                failStreak = Math.min(10, failStreak + 1);
                wssSyncState = failStreak >= 3 ? 'ERR' : 'WAIT';
                updateSyncDot();
                scheduleReconnect(220);
              }
            }
          };
          sock.onerror = () => {};
          sock.onclose = handleTrialFail;
        } catch {
          closedTrials += 1;
        }
      }
      if (closedTrials >= totalBrokers && wssSyncState !== 'OK') {
        failStreak = Math.min(10, failStreak + 1);
        wssSyncState = failStreak >= 3 ? 'ERR' : 'WAIT';
        updateSyncDot();
        scheduleReconnect(300);
      }
    }

    let publishChain = Promise.resolve();
    function publishUp(obj) {
      if (destroyed || (isIframe && !iframeFallbackActive) || !CFG.relayEnabled) return Promise.resolve(false);
      if (wssSyncState !== 'OK' || !ws || ws.readyState !== 1) {
        enqueueRelayPending(obj);
        return Promise.resolve(false);
      }
      publishChain = publishChain.then(async () => {
        if (destroyed || wssSyncState !== 'OK' || !ws || ws.readyState !== 1) {
          enqueueRelayPending(obj);
          return false;
        }
        const enc = await encryptObj(obj);
        const sent = sendPublishRaw('triggertap/v1/' + CFG.roomId + '/up', enc);
        if (!sent) enqueueRelayPending(obj);
        return sent;
      }).catch(() => {
        enqueueRelayPending(obj);
        return false;
      });
      return publishChain;
    }

    function requestAiAnalysis(payload) {
      if (destroyed || !CFG.relayEnabled) return Promise.resolve({ ok: false, error: 'Relay disabled' });
      if (wssSyncState !== 'OK') connect();
      const reqId = 'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      return new Promise((resolve) => {
        const tId = setTimeout(() => {
          if (pendingAiReqs.has(reqId)) {
            pendingAiReqs.delete(reqId);
            resolve({
              ok: false,
              error: CFG.lang === 'bn' ? 'WSS AI Proxy সময়সীমা শেষ — অ্যাপ ট্যাবটি খোলা আছে কিনা দেখুন' : 'WSS AI Proxy timeout — ensure TriggerTap app tab is open'
            });
          }
        }, 26000);
        pendingAiReqs.set(reqId, (resMsg) => {
          clearTimeout(tId);
          resolve(resMsg || { ok: false, error: 'Empty AI proxy response' });
        });
        const rawMsgs = (payload && Array.isArray(payload.messages)) ? payload.messages : [];
        const rawTotal = Math.max(rawMsgs.length, Number(payload && payload.rawTotal) || 0);
        const segWin = getSmartSegmentWindow(rawTotal);
        const maxTake = segWin.active ? Math.min(120, segWin.keepCount) : 100;
        const slicedMsgs = rawMsgs.slice(-maxTake);
        const compactMsgs = slicedMsgs.map((m) => ({
          src: m && m.src ? String(m.src) : 'WS-IN',
          time: m && m.time ? String(m.time) : '',
          monoMs: m && typeof m.monoMs === 'number' ? m.monoMs : 0,
          text: String(m && m.text ? m.text : '').slice(0, 480)
        }));
        publishUp({
          type: 'TT_AI_REQ',
          reqId: reqId,
          roomId: CFG.roomId,
          roundHint: (payload && payload.roundHint) || 'HUD WSS proxy',
          rawTotal: rawTotal,
          segmenterConfig: (payload && payload.segmenterConfig) || {
            enabled: segWin.enabled,
            threshold: segWin.threshold,
            expectedTotal: segWin.expectedTotal
          },
          messages: compactMsgs
        });
      });
    }

    function pingNow() {
      if (destroyed || !ws || ws.readyState !== 1) return false;
      return sendRelayRaw(new Uint8Array([0xc0, 0x00]));
    }

    function destroy() {
      destroyed = true;
      if (reconnTimer) { clearTimeout(reconnTimer); reconnTimer = null; }
      if (connWatchdog) { clearTimeout(connWatchdog); connWatchdog = null; }
      if (pingGraceTimer) { clearTimeout(pingGraceTimer); pingGraceTimer = null; }
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      pendingAiReqs.clear();
      closeTrials(null);
      if (ws) { try { ws.close(); } catch {} ws = null; }
    }

    return { connect, publishUp, requestAiAnalysis, pingNow, probeOrReconnect, destroy };
  })();

  function pushGMBridge(compactBatch) {
    if (!CFG.relayEnabled || typeof GM_setValue !== 'function' || !Array.isArray(compactBatch) || !compactBatch.length) return;
    try {
      const hasUseful = CFG.armed || compactBatch.some((ev) => ev && (ev.matched || ev.inspectorMatched || ev.src === 'WS-IN' || ev.src === 'WS-OUT' || ev.src === 'SSE' || ev.src === 'WORKER' || ev.src === 'API-RES' || ev.src === 'TAP-RES' || ev.src === 'TAP-RTC' || ev.src === 'TAP-WT' || ev.src === 'TAP-PM' || ev.src === 'CLICK' || ev.src === 'ELEMENT_PICK'));
      if (!hasUseful) return;
      const trimmedBatch = compactBatch.slice(0, 16).map((ev) => ({
        uid: ev.uid,
        src: ev.src,
        kind: ev.kind,
        direction: ev.direction,
        matched: Boolean(ev.matched),
        inspectorMatched: Boolean(ev.inspectorMatched),
        reasons: ev.reasons,
        heldMs: ev.heldMs,
        text: String(ev.text || '').slice(0, 1400),
        time: ev.time || '',
        monoMs: ev.monoMs
      }));
      const bId = FRAME_ID + ':' + Date.now() + ':' + (++gmBridgeSeq);
      gmBridgeQueue.push({ id: bId, events: trimmedBatch });
      if (gmBridgeQueue.length > 12) gmBridgeQueue = gmBridgeQueue.slice(-12);
      GM_setValue('__tt_bridge_' + CFG.roomId, JSON.stringify({ batches: gmBridgeQueue }));
    } catch {}
  }

  function compactRelayBatch(batch) {
    return batch.map((ev) => {
      const isApi = ev.src === 'API-REQ' || ev.src === 'API-RES';
      const maxLen = isApi ? 6500 : 4000;
      return {
        uid: ev.uid,
        src: ev.src,
        kind: ev.kind,
        direction: ev.direction || srcToDirection(ev.src),
        reasons: Array.isArray(ev.reasons) ? ev.reasons.slice(0, 12) : undefined,
        inspectorMatched: Boolean(ev.inspectorMatched),
        heldMs: typeof ev.heldMs === 'number' ? ev.heldMs : undefined,
        text: String(ev.text || '').slice(0, maxLen),
        matched: Boolean(ev.matched),
        matchedTag: ev.matchedTag ? String(ev.matchedTag).slice(0, 2000) : undefined,
        time: ev.time || '',
        monoMs: typeof ev.monoMs === 'number' ? ev.monoMs : undefined
      };
    });
  }

  function publishCompactChunksWss(compactBatch) {
    let chunk = [];
    let chunkSize = 0;
    for (let i = 0; i < compactBatch.length; i++) {
      const ev = compactBatch[i];
      const est = String(ev && ev.text ? ev.text : '').length + 220;
      if (chunk.length >= 8 || (chunk.length > 0 && chunkSize + est > 7000)) {
        TTWssRelay.publishUp({ type: 'TT_BATCH', events: chunk });
        chunk = [];
        chunkSize = 0;
      }
      chunk.push(ev);
      chunkSize += est;
    }
    if (chunk.length > 0) {
      TTWssRelay.publishUp({ type: 'TT_BATCH', events: chunk });
    }
  }

  function canAttemptHttpRelay() {
    if (httpFailCount === 0 && httpSyncState !== 'AUTH_BLOCKED') return true;
    const cooldown = httpSyncState === 'AUTH_BLOCKED' ? 8000 : Math.min(15000, 1500 * httpFailCount);
    return (Date.now() - lastHttpRetryAt) > cooldown;
  }

  function enqueueHttpPending(events) {
    if (!Array.isArray(events) || !events.length) return;
    for (let i = 0; i < events.length; i++) httpPendingQueue.push(events[i]);
    if (httpPendingQueue.length > 100) httpPendingQueue.splice(0, httpPendingQueue.length - 100);
  }

  function pushHttpRelayBatch(compactBatch) {
    if (!Array.isArray(compactBatch) || !compactBatch.length) return;
    if (!canAttemptHttpRelay()) {
      enqueueHttpPending(compactBatch);
      return;
    }
    const merged = httpPendingQueue.length ? httpPendingQueue.splice(0, 40).concat(compactBatch) : compactBatch;
    gmHttp('POST', '/api/relay/push', { roomId: CFG.roomId, events: merged }, (err) => {
      if (err) {
        enqueueHttpPending(merged);
      } else if (httpPendingQueue.length > 0) {
        const rest = httpPendingQueue.splice(0, 48);
        gmHttp('POST', '/api/relay/push', { roomId: CFG.roomId, events: rest });
      }
    });
  }

  function dispatchRelayBatchTopLevel(batch) {
    if (!CFG.relayEnabled || !Array.isArray(batch) || !batch.length) return;
    const compactBatch = compactRelayBatch(batch);
    publishCompactChunksWss(compactBatch);
    pushHttpRelayBatch(compactBatch);
    pushGMBridge(compactBatch);
  }

  function sendToTop(msg) {
    try { if (window.top && window.top !== window) window.top.postMessage(msg, '*'); } catch {}
    try { if (window.parent && window.parent !== window && window.parent !== window.top) window.parent.postMessage(msg, '*'); } catch {}
    try { if (targetWin.top && targetWin.top !== targetWin) targetWin.top.postMessage(msg, '*'); } catch {}
  }

  function broadcastDownToIframes(msg) {
    try {
      const seen = new Set();
      const frames = document.querySelectorAll('iframe');
      for (let i = 0; i < frames.length; i++) {
        try {
          const cw = frames[i].contentWindow;
          if (cw && !seen.has(cw)) {
            seen.add(cw);
            cw.postMessage(msg, '*');
          }
        } catch {}
      }
      for (let i = 0; i < window.frames.length; i++) {
        try {
          const cw = window.frames[i];
          if (cw && !seen.has(cw)) {
            seen.add(cw);
            cw.postMessage(msg, '*');
          }
        } catch {}
      }
    } catch {}
  }

  function setHudHidden(hidden) {
    if (userClosed) hidden = true;
    if (!hidden) mountRootEl();
    if (hudHidden === hidden) return;
    hudHidden = hidden;
    if (hidden) {
      crosshair.style.display = 'none';
      root.style.display = 'none';
    } else {
      if (isIframe) iframeLocalTarget = { active: false, x: -1, y: -1, locked: false };
      root.style.display = 'block';
      crosshair.style.display = 'flex';
      elBody.style.display = minimized ? 'none' : 'flex';
      elMin.textContent = minimized ? '+' : '—';
      syncPositionFromAnchor();
      renderLogs();
    }
    syncTurboCfg(true);
  }

  function detectGameDom() {
    try {
      if (document.readyState === 'loading' && !document.body) return false;
      const fastCanvases = document.getElementsByTagName ? document.getElementsByTagName('canvas') : [];
      const cLim = Math.min(fastCanvases.length, 10);
      for (let i = 0; i < cLim; i++) {
        const cv = fastCanvases[i];
        const cw = cv.clientWidth || Number(cv.getAttribute && cv.getAttribute('width')) || 0;
        const ch = cv.clientHeight || Number(cv.getAttribute && cv.getAttribute('height')) || 0;
        if (cw >= 150 && ch >= 120) return true;
        if (cw === 0 && ch === 0) {
          const r = cv.getBoundingClientRect();
          if (r.width >= 150 && r.height >= 120) return true;
        }
      }
      const fastBtns = document.querySelectorAll ? document.querySelectorAll('button, [role="button"]') : [];
      const bLim = Math.min(fastBtns.length, 100);
      let hasCashout = false;
      let hasBet = false;
      for (let i = 0; i < bLim; i++) {
        const b = fastBtns[i];
        if (isOwnHudNode(b)) continue;
        const rawTxt = (b.textContent || (b.getAttribute && b.getAttribute('aria-label')) || '');
        if (!rawTxt || rawTxt.length > 80) continue;
        const txt = rawTxt.replace(/\s+/g, ' ').trim().toLowerCase();
        if (!txt) continue;
        const isC = txt.includes('cash out') || txt.includes('cashout') || txt.includes('auto cash') || txt.includes('take win') || txt.includes('collect') || txt.includes('claim') || txt.includes('withdraw') || txt.includes('sell') || txt.includes('payout') || txt.includes('redeem') || txt.includes('উত্তোলন') || txt.includes('ক্যাশ') || txt.includes('সেল');
        const isB = txt.includes('place bet') || txt === 'bet' || /^bet\b/.test(txt) || txt.includes('auto bet') || txt.includes('cancel') || txt === 'wait' || txt.includes('বাজি') || txt.includes('বাতিল');
        if (!isC && !isB) continue;
        const r = b.getBoundingClientRect();
        if (r.width < 30 || r.height < 20) continue;
        if (isC) hasCashout = true;
        if (isB) hasBet = true;
        if ((hasCashout && hasBet) || txt.includes('place bet') || txt.includes('cash out') || txt.includes('cashout') || (/^bet\b/.test(txt) && /\d/.test(txt))) {
          return true;
        }
      }
      if (isIframe && hasBet) return true;
    } catch {}
    return false;
  }

  function computeHudClaim() {
    const vw = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
    const vh = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
    if (vw < 120 || vh < 120) {
      return {
        frameId: FRAME_ID,
        score: -1,
        localWs: localWsCount,
        localApi: localApiCount,
        hasGameDom: false,
        isGameIframe: false,
        userTouched: userTouchedHud,
        locked: Boolean(locked),
        triggers: triggerCount,
        ts: Date.now()
      };
    }
    const hasGameDom = detectGameDom();
    const areaScore = Math.min(99, Math.round((vw * vh) / 10000));
    const isGameIframe = isIframe && vw >= 220 && vh >= 220 && (hasGameDom || localWsCount > 0);
    let score = areaScore;
    if (hasGameDom) score += 500000;
    if (isGameIframe) score += 100000;
    if (localWsCount > 0) score += 50000 + Math.min(5000, localWsCount * 50);
    if (locked) score += 25000;
    if (triggerCount > 0) score += 20000;
    if (userTouchedHud) score += 10000;
    if (localApiCount > 0) score += 500 + Math.min(2000, localApiCount * 50);
    if (isIframe && vw >= 200 && vh >= 200) score += 100;
    return {
      frameId: FRAME_ID,
      score,
      localWs: localWsCount,
      localApi: localApiCount,
      hasGameDom,
      isGameIframe,
      userTouched: userTouchedHud,
      locked: Boolean(locked),
      triggers: triggerCount,
      ts: Date.now()
    };
  }

  function evaluateHudWinner() {
    if (userClosed || isIframe) return;
    const now = Date.now();
    const myClaim = computeHudClaim();
    hudClaims.set(FRAME_ID, myClaim);

    for (const [fid, c] of hudClaims.entries()) {
      if (fid !== FRAME_ID && now - c.ts > 12000) {
        hudClaims.delete(fid);
      }
    }

    let best = myClaim;
    for (const c of hudClaims.values()) {
      if (c.score > best.score) best = c;
    }

    if (currentHudWinner && currentHudWinner.frameId !== best.frameId) {
      const cur = hudClaims.get(currentHudWinner.frameId);
      if (cur) {
        const bestHasGame = Boolean(best.hasGameDom);
        const curHasGame = Boolean(cur.hasGameDom);
        const bestIsGame = (best.localWs > 0 || bestHasGame);
        const curIsGame = (cur.localWs > 0 || curHasGame);
        const challengerBetter =
          (!cur.locked || (bestHasGame && !curHasGame && best.localWs > cur.localWs)) && (
            (bestHasGame && !curHasGame) ||
            (best.isGameIframe && !cur.isGameIframe) ||
            (bestIsGame && !curIsGame) ||
            (best.userTouched && !cur.userTouched && !curHasGame && !(curIsGame && !bestIsGame)) ||
            (best.localWs > 0 && cur.localWs === 0 && !curHasGame) ||
            (best.score > cur.score + 50 && (!cur.userTouched || bestIsGame))
          );
        if (!challengerBetter) best = cur;
      }
    }

    currentHudWinner = best;
    setHudHidden(best.frameId !== FRAME_ID);
    if (!hudHidden) syncIframeLocalTargets(false);
    broadcastDownToIframes({
      __TT_SNIFFER__: true,
      kind: 'HUD_WINNER',
      sessionId: activeSessionId,
      winner: best
    });
    if (typeof GM_setValue === 'function') {
      try {
        const wSig = best.frameId + '|' + activeSessionId + '|' + wssSyncState + '|' + httpSyncState + '|' + (best.hasGameDom ? '1' : '0');
        if (wSig !== lastGmWinnerSig || now - lastGmWinnerAt > 9000) {
          lastGmWinnerSig = wSig;
          lastGmWinnerAt = now;
          GM_setValue('__tt_hud_winner_' + CFG.roomId, JSON.stringify({
            winner: best,
            sessionId: activeSessionId,
            wss: wssSyncState,
            http: httpSyncState,
            httpOrigin: getHttpOriginLabel(),
            ts: now
          }));
        }
      } catch {}
    }
  }

  function publishHudClaim(forceShowLocal) {
    if (userClosed) return;
    if (forceShowLocal && !isIframe) setHudHidden(false);
    if (!isIframe) {
      evaluateHudWinner();
      return;
    }
    const claim = computeHudClaim();
    sendToTop({
      __TT_SNIFFER__: true,
      kind: 'HUD_CLAIM',
      claim
    });
    if (typeof GM_setValue === 'function') {
      try {
        const cSig = claim.frameId + '|' + (claim.hasGameDom ? '1' : '0') + '|' + (claim.localWs > 0 ? '1' : '0') + '|' + (claim.userTouched ? '1' : '0');
        const cNow = Date.now();
        if (cSig !== lastGmClaimSig || cNow - lastGmClaimAt > 9000) {
          lastGmClaimSig = cSig;
          lastGmClaimAt = cNow;
          GM_setValue('__tt_hud_claim_' + CFG.roomId, JSON.stringify(claim));
        }
      } catch {}
    }
  }

  function markUserTouched() {
    if (userClosed) return;
    if (!userTouchedHud) {
      userTouchedHud = true;
      publishHudClaim(!isIframe);
    } else if (hudHidden && !isIframe) {
      publishHudClaim(true);
    } else if (isIframe) {
      publishHudClaim(false);
    }
  }

  const relayBuffer = [];
  const iframeEarlyBuffer = [];
  let relayScheduled = false;
  let relayTimer = null;
  const scheduleMicro = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (fn) => Promise.resolve().then(fn);

  function flushRelay() {
    relayScheduled = false;
    relayTimer = null;
    if (!CFG.relayEnabled || !relayBuffer.length) return;
    const batch = relayBuffer.splice(0, 64);
    if (isIframe) {
      const compactBatch = compactRelayBatch(batch);
      pushGMBridge(compactBatch);
      sendToTop({
        __TT_SNIFFER__: true,
        kind: 'BATCH',
        roomId: CFG.roomId,
        events: compactBatch
      });
      if (!iframeFallbackActive) {
        const ackAge = lastTopMsgAt > 0 ? (Date.now() - lastTopMsgAt) : 0;
        if (!topAcked || ackAge > 4500) {
          iframeNoAckBatches += 1;
        } else {
          iframeNoAckBatches = 0;
        }
        if (topAcked && lastTopMsgAt > 0 && ackAge > 4500 && iframeNoAckBatches >= 3) {
          iframeFallbackActive = true;
          topAcked = false;
          updateSyncDot();
          TTWssRelay.connect();
          if (iframeEarlyBuffer.length) {
            const staleEarly = iframeEarlyBuffer.splice(0, iframeEarlyBuffer.length);
            publishCompactChunksWss(staleEarly);
            pushHttpRelayBatch(staleEarly);
          }
        }
      }
      if (iframeFallbackActive) {
        publishCompactChunksWss(compactBatch);
        pushHttpRelayBatch(compactBatch);
      } else {
        for (let i = 0; i < compactBatch.length; i++) {
          iframeEarlyBuffer.push(compactBatch[i]);
        }
        if (iframeEarlyBuffer.length > 120) {
          iframeEarlyBuffer.splice(0, iframeEarlyBuffer.length - 120);
        }
      }
    } else {
      dispatchRelayBatchTopLevel(batch);
    }
    if (relayBuffer.length) {
      relayTimer = setTimeout(flushRelay, 8);
    }
  }

  function queueRelay(item) {
    if (!CFG.relayEnabled) return;
    if (relayBuffer.length >= 1200) {
      let dropIdx = -1;
      for (let i = 0; i < relayBuffer.length; i++) {
        const r = relayBuffer[i];
        if (!r || (!r.matched && r.src !== 'CLICK')) {
          dropIdx = i;
          break;
        }
      }
      if (dropIdx >= 0) relayBuffer.splice(dropIdx, 1);
      else relayBuffer.shift();
    }
    relayBuffer.push(item);
    const isUrgent = Boolean(item && (item.src === 'CLICK' || item.matched));
    if (isUrgent || relayBuffer.length >= 16) {
      if (relayTimer) { clearTimeout(relayTimer); relayTimer = null; }
      flushRelay();
    } else if (!relayScheduled && !relayTimer) {
      relayScheduled = true;
      relayTimer = setTimeout(flushRelay, 8);
    }
  }

  const onVisibilityChangeRelay = () => {
    if (document.hidden && relayBuffer.length) flushRelay();
    if ((!isIframe || iframeFallbackActive) && document.visibilityState === 'visible' && CFG.relayEnabled) {
      if (wssSyncState !== 'OK') TTWssRelay.connect();
      else TTWssRelay.probeOrReconnect();
    }
  };
  const onOnlineRelay = () => {
    if ((!isIframe || iframeFallbackActive) && CFG.relayEnabled) {
      if (wssSyncState !== 'OK') TTWssRelay.connect();
      else TTWssRelay.probeOrReconnect();
    }
  };
  const onPageHideRelay = () => {
    if (relayBuffer.length) flushRelay();
  };
  document.addEventListener('visibilitychange', onVisibilityChangeRelay);
  window.addEventListener('online', onOnlineRelay);
  window.addEventListener('focus', onOnlineRelay);
  window.addEventListener('pageshow', onOnlineRelay);
  window.addEventListener('pagehide', onPageHideRelay);
  try {
    if (navigator && navigator.connection && typeof navigator.connection.addEventListener === 'function') {
      navigator.connection.addEventListener('change', onOnlineRelay);
    }
  } catch {}

  let onTopMessage = null;
  let onIframeAckMessage = null;
  let onIframeResizeClaim = null;

  const applyIncomingUserCfg = (c, meta) => {
    if (!c) return;
    if (meta && meta.ts && lastUserCfgEditAt && meta.ts < lastUserCfgEditAt) return;
    if (typeof c.armed === 'boolean') CFG.armed = c.armed;
    if (typeof c.locked === 'boolean' && hudHidden) locked = c.locked;
    if (typeof c.tags === 'string') {
      CFG.tags = c.tags;
      if (elTags && document.activeElement !== elTags) elTags.value = c.tags;
      if (lastHitTag === 'TEST') lastHitTag = '';
    }
    if (typeof c.matchMode === 'string') { CFG.matchMode = c.matchMode; if (elMode) elMode.value = c.matchMode; }
    if (typeof c.caseSensitive === 'boolean') CFG.caseSensitive = c.caseSensitive;
    if (typeof c.cooldownMs === 'number') { CFG.cooldownMs = c.cooldownMs; if (elCd) elCd.value = String(c.cooldownMs); }
    if (typeof c.oneShot === 'boolean') CFG.oneShot = c.oneShot;
    if (typeof c.roundOnce === 'boolean') { CFG.roundOnce = c.roundOnce; roundClickLocked = false; roundSawFlightAfterLock = false; roundSawCrashAfterLock = false; roundClickLockedRoundId = ''; roundUnlockSeq += 1; }
    if (typeof c.zeroDelay === 'boolean') CFG.zeroDelay = c.zeroDelay;
    if (typeof c.zeroDelayMicroMs === 'number') CFG.zeroDelayMicroMs = Math.max(0, Math.min(5, Math.round(c.zeroDelayMicroMs * 2) / 2));
    if (typeof c.crashBuzzer === 'boolean') CFG.crashBuzzer = c.crashBuzzer;
    if (typeof c.humanTap === 'boolean') CFG.humanTap = c.humanTap;
    if (typeof c.humanJitter === 'boolean') CFG.humanJitter = c.humanJitter;
    if (typeof c.fingerprintShuffle === 'boolean') CFG.fingerprintShuffle = c.fingerprintShuffle;
    if (typeof c.opClickMode === 'boolean') CFG.opClickMode = c.opClickMode;
    if (typeof c.directWsCashout === 'boolean') CFG.directWsCashout = c.directWsCashout;
    if (typeof c.netLagAutoShift === 'boolean') CFG.netLagAutoShift = c.netLagAutoShift;
    if (typeof c.fallbackMultX === 'number') CFG.fallbackMultX = Math.max(0, Math.min(100, Number(c.fallbackMultX) || 0));
    if (typeof c.autoCashoutCeilingX === 'number') { CFG.autoCashoutCeilingX = Math.max(0, Math.min(100, Number(c.autoCashoutCeilingX) || 0)); if (CFG.autoCashoutCeilingX >= 1.01) syncGameAutoCashoutBox(true); }
    if (typeof c.networkTap === 'boolean') CFG.networkTap = c.networkTap;
    if (typeof c.preClickGate === 'boolean') CFG.preClickGate = c.preClickGate;
    if (typeof c.wsLeadMs === 'number') CFG.wsLeadMs = c.wsLeadMs;
    if (typeof c.gateHoldMs === 'number') CFG.gateHoldMs = c.gateHoldMs;
    if (typeof c.holdEvents === 'string') CFG.holdEvents = c.holdEvents;
    if (typeof c.inspectorEnabled === 'boolean') CFG.inspectorEnabled = c.inspectorEnabled;
    if (typeof c.inspectorAutoClick === 'boolean') CFG.inspectorAutoClick = c.inspectorAutoClick;
    if (typeof c.inspectorHoldAllWs === 'boolean') CFG.inspectorHoldAllWs = c.inspectorHoldAllWs;
    if (typeof c.inspectorHoldMs === 'number') CFG.inspectorHoldMs = c.inspectorHoldMs;
    if (typeof c.inspectorKeywords === 'string') CFG.inspectorKeywords = c.inspectorKeywords;
    if (typeof c.inspectorRegexes === 'string') CFG.inspectorRegexes = c.inspectorRegexes;
    if (typeof c.inspectorJsonPaths === 'string') CFG.inspectorJsonPaths = c.inspectorJsonPaths;
    if (typeof c.smartSmsSegmenter === 'boolean') CFG.smartSmsSegmenter = c.smartSmsSegmenter;
    if (typeof c.smsSegmentThreshold === 'number') CFG.smsSegmentThreshold = Math.max(2, Math.min(500, Math.round(c.smsSegmentThreshold)));
    if (typeof c.smsExpectedTotal === 'number') CFG.smsExpectedTotal = Math.max(CFG.smsSegmentThreshold || 30, Math.min(1000, Math.round(c.smsExpectedTotal)));
    const prevTgtTxt = CFG.targetText;
    const prevTgtSel = CFG.targetSelector;
    if (hudHidden) {
      if (typeof c.targetText === 'string') { CFG.targetText = c.targetText; anchor.text = c.targetText; }
      if (typeof c.targetSelector === 'string') { CFG.targetSelector = c.targetSelector; anchor.selector = c.targetSelector; }
      if (CFG.targetText !== prevTgtTxt || CFG.targetSelector !== prevTgtSel) {
        anchor.el = null;
        if (typeof syncPositionFromAnchor === 'function') syncPositionFromAnchor();
      }
    }
    if (meta && meta.ts && meta.ts > lastUserCfgEditAt) lastUserCfgEditAt = meta.ts;
    persistHudControlState();
    lastBroadcastCfgStr = JSON.stringify(buildSyncCfgPayload());
    syncUI();
    syncTurboCfg(true, false);
  };

  if (!isIframe) {
    if (CFG.relayEnabled) TTWssRelay.connect();
    onTopMessage = function (ev) {
      const d = ev && ev.data;
      if (!d || !d.__TT_SNIFFER__) return;
      if (ev.source && typeof ev.source.postMessage === 'function') {
        childSourceWin = ev.source;
        try {
          ev.source.postMessage({
            __TT_SNIFFER__: true,
            kind: 'TOP_ACK',
            sessionId: activeSessionId,
            wss: wssSyncState,
            http: httpSyncState,
            httpOrigin: getHttpOriginLabel()
          }, '*');
        } catch {}
      }
      if (d.kind === 'HUD_CLAIM' && d.claim && d.claim.frameId) {
        const isNewClaimFrame = !hudClaims.has(d.claim.frameId);
        childIframeActive = true;
        hudClaims.set(d.claim.frameId, Object.assign({}, d.claim, { ts: Date.now() }));
        evaluateHudWinner();
        if (isNewClaimFrame && !hudHidden) syncIframeLocalTargets(true);
        if ((isNewClaimFrame || userTouchedHud) && ev.source && typeof ev.source.postMessage === 'function') {
          try {
            ev.source.postMessage({
              __TT_SNIFFER__: true,
              kind: 'SYNC_CFG',
              fromUser: true,
              srcFrame: FRAME_ID,
              sessionId: activeSessionId,
              ts: lastUserCfgEditAt || Date.now(),
              cfg: buildSyncCfgPayload()
            }, '*');
          } catch {}
        }
      } else if (d.kind === 'SYNC_CFG' && d.cfg && d.fromUser && d.srcFrame !== FRAME_ID) {
        applyIncomingUserCfg(d.cfg, d);
      } else if (d.kind === 'IFRAME_LOCK_SYNC' && typeof d.localX === 'number' && typeof d.localY === 'number') {
        if (!hudHidden && locked && !isDraggingTarget) {
          lastIframeLockReplyAt = Date.now();
          try {
            const frames = document.querySelectorAll('iframe');
            for (let fi = 0; fi < frames.length; fi++) {
              const f = frames[fi];
              if (ev.source && f.contentWindow === ev.source) {
                const fr = f.getBoundingClientRect();
                const gx = Math.round(fr.left + d.localX);
                const gy = Math.round(fr.top + d.localY);
                if (gx !== targetX || gy !== targetY) {
                  targetX = gx;
                  targetY = gy;
                  clampTarget();
                  anchor.absX = targetX;
                  anchor.absY = targetY;
                  crosshair.style.left = (targetX - half) + 'px';
                  crosshair.style.top = (targetY - half) + 'px';
                  syncTurboCfg(false, false);
                }
                break;
              }
            }
          } catch {}
        }
      } else if (d.kind === 'LOCAL_TURBO_HIT') {
        const now = Date.now();
        lastTriggerAt = now;
        if (CFG.roundOnce) {
          roundClickLocked = true;
          roundClickLockedAt = now;
          roundSawFlightAfterLock = false;
          roundSawCrashAfterLock = false;
          roundClickLockedRoundId = String(d.roundId || '');
        }
        if (d.oneShotFired) {
          CFG.armed = false;
          persistHudControlState();
        }
        const lbl = (d.src || 'IFR') + '[' + String(d.tag || 'TURBO') + ']';
        lastHitTag = lbl.slice(0, 26);
        triggerCount += 1;
        const elapStr = String(d.elapsed || '0.00');
        lastReactionMsStr = elapStr;
        elPerf.textContent = '⚡' + elapStr + 'ms';
        elPerf.style.color = '#4ade80';
        crosshair.style.transform = 'scale(0.86)';
        crosshair.style.borderColor = '#facc15';
        setTimeout(() => {
          crosshair.style.transform = 'scale(1)';
          crosshair.style.borderColor = locked ? '#f59e0b' : (CFG.armed ? '#22c55e' : '#94a3b8');
        }, 140);
        const tNow = performance.now();
        const tStr = d.timeStr || fmtTimeMs(new Date());
        const ifrDeltaMs = Math.max(0, Number(elapStr) || 0);
        recordLatencySample(ifrDeltaMs, d.src || 'IFR-WS', tStr, Number(d.gateEstMs) || 0);
        recordSecurityLatency(ifrDeltaMs, d.src || 'IFR-WS', tStr);
        recordClickRace(tNow, tStr, '⚡' + elapStr, lbl, {
          preText: d.preText || '',
          disabled: Boolean(d.preDis),
          clickX: typeof d.clickX === 'number' ? d.clickX : undefined,
          clickY: typeof d.clickY === 'number' ? d.clickY : undefined,
          jittered: Boolean(d.jittered),
          fpSalt: d.fpSalt ? String(d.fpSalt) : '',
          fpPressure: typeof d.fpPressure === 'number' ? d.fpPressure : undefined,
          fpRadius: typeof d.fpRadius === 'number' ? d.fpRadius : undefined,
          syncFrame: Boolean(CFG.zeroDelay),
          isRetry: d.src === 'RETRY',
          holdMs: CFG.zeroDelay ? (Number(CFG.zeroDelayMicroMs) || 0) : (CFG.humanTap ? 35 : 0),
          frameStartMonoMs: Math.max(0, tNow - ifrDeltaMs)
        });
        syncUI();
      } else if (d.kind === 'REMOTE_HIT') {
        const sendRemoteAck = (ok) => {
          if (!d.remoteToken) return;
          const ackMsg = {
            __TT_SNIFFER__: true,
            kind: 'REMOTE_HIT_ACK',
            remoteToken: d.remoteToken,
            gateId: d.gateId || 0,
            ok: Boolean(ok),
            clickedAt: performance.now()
          };
          if (ev.source && typeof ev.source.postMessage === 'function') {
            try { ev.source.postMessage(ackMsg, '*'); } catch {}
          }
          broadcastDownToIframes(ackMsg);
        };
        if (CFG.armed && !hudHidden) {
          const now = Date.now();
          if (now - lastTriggerAt >= CFG.cooldownMs && (!CFG.roundOnce || !roundClickLocked)) {
            lastTriggerAt = now;
            if (CFG.roundOnce) {
              roundClickLocked = true;
              roundClickLockedAt = now;
              roundSawFlightAfterLock = false;
              roundSawCrashAfterLock = false;
              roundClickLockedRoundId = String(d.roundId || '');
            }
            if (CFG.oneShot) {
              CFG.armed = false;
              persistHudControlState();
            }
            syncUI();
            fireTargetClick('IFR[' + String(d.tag || 'TURBO') + ']', performance.now(), (ok) => {
              const wrongRemote = Boolean(lastDomClickMeta && isButtonAlreadyEnded(lastDomClickMeta.preText, lastDomClickMeta.disabled));
              if (wrongRemote && CFG.roundOnce) {
                roundClickLocked = false;
                roundSawCrashAfterLock = false;
                roundClickLockedRoundId = '';
                lastTriggerAt = 0;
                if (CFG.oneShot) { CFG.armed = true; persistHudControlState(); }
                syncTurboCfg(true, false);
                syncUI();
              }
              sendRemoteAck(ok && !wrongRemote);
            });
          } else {
            sendRemoteAck(false);
          }
        } else {
          sendRemoteAck(false);
        }
      } else if (d.kind === 'ROUND_UNLOCK') {
        if (CFG.roundOnce && roundClickLocked && Date.now() - roundClickLockedAt >= 60) {
          roundClickLocked = false;
          roundSawFlightAfterLock = false;
          roundSawCrashAfterLock = false;
          roundLastFlightAt = 0;
          roundClickLockedRoundId = '';
          roundUnlockSeq += 1;
          syncTurboCfg(true, false);
          if (!hudHidden) syncUI();
        }
        broadcastDownToIframes({ __TT_SNIFFER__: true, kind: 'ROUND_UNLOCK' });
      } else if (d.kind === 'MANUAL_ROUND_END') {
        markManualRoundEnd(d.reason || 'IFRAME_F8');
      } else if (d.kind === 'IFRAME_ELEMENT_PICK') {
        const txt = String(d.targetText || '');
        const sel = String(d.targetSelector || '');
        CFG.targetText = txt;
        CFG.targetSelector = sel;
        anchor.el = null;
        anchor.manual = true;
        anchor.text = txt;
        anchor.selector = sel;
        if (typeof d.pctX === 'number' && typeof d.pctY === 'number') {
          const vw = Math.max(1, window.innerWidth || 360);
          const visH = Math.max(1, Math.min(window.innerHeight || 640, getSafeVisibleHeight()));
          targetX = Math.round(vw * d.pctX);
          targetY = Math.round(visH * d.pctY);
          clampTarget();
          crosshair.style.display = 'flex';
          crosshair.style.left = (targetX - half) + 'px';
          crosshair.style.top = (targetY - half) + 'px';
        }
        locked = true;
        persistHudControlState();
        saveAnchor();
        stopElementPickerMode(true);
        if (elStatus) {
          const lbl = txt ? ('"' + txt.slice(0, 22) + '"') : sel.slice(0, 24);
          elStatus.textContent = T.pickDone.replace('{label}', lbl);
        }
        syncUI();
        syncTurboCfg(true, true);
        if (CFG.relayEnabled) {
          dispatchRelayBatchTopLevel([{
            uid: 'pick_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            src: 'ELEMENT_PICK',
            kind: 'PICK',
            text: JSON.stringify({ targetText: txt, targetSelector: sel }),
            matched: false,
            time: fmtTimeMs(new Date()),
            monoMs: performance.now()
          }]);
        }
      } else if (d.kind === 'BATCH' && Array.isArray(d.events)) {
        const nowAckMs = Date.now();
        if (nowAckMs - lastTopAckSentAt > 1200 && ev.source && typeof ev.source.postMessage === 'function') {
          lastTopAckSentAt = nowAckMs;
          try {
            ev.source.postMessage({
              __TT_SNIFFER__: true,
              kind: 'TOP_ACK',
              sessionId: activeSessionId,
              wss: wssSyncState,
              http: httpSyncState,
              httpOrigin: getHttpOriginLabel()
            }, '*');
          } catch {}
        }
        dispatchRelayBatchTopLevel(d.events);
        let added = false;
        let topRoundUnlockChanged = false;
        for (let i = 0; i < d.events.length; i++) {
          const item = d.events[i];
          if (!item || (item.uid && topSeenUids.has(item.uid))) continue;
          if (item.uid) {
            topSeenUids.add(item.uid);
            if (topSeenUids.size > 600) {
              const first = topSeenUids.values().next().value;
              topSeenUids.delete(first);
            }
          }
          const itemRaw = item.raw || item.text || '';
          const isBatchLiveSrc = (
            item.src === 'WS-IN' || item.src === 'SSE' || item.src === 'WORKER' ||
            item.src === 'API-RES' || item.src === 'TAP-RES' || item.src === 'TAP-RTC' ||
            item.src === 'TAP-WT' || item.src === 'TAP-PM' ||
            item.src === 'CSS-STATE' || item.src === 'JS-HOOK' || item.src === 'DOM-TAG' || item.src === 'API-SIG' ||
            item.src === 'SMS/DOM'
          );
          let bAnPre = null;
          if (isBatchLiveSrc && itemRaw && !hudHidden) {
            try { bAnPre = analyzeGamePacket(item.src, itemRaw); } catch {}
            if (item.src !== 'CSS-STATE' && item.src !== 'JS-HOOK' && item.src !== 'DOM-TAG' && item.src !== 'SMS/DOM') {
              try { maybeTriggerCrashSignal(item.src, itemRaw, bAnPre); } catch {}
              try { observeRacePacket(item.src, item.kind || '', itemRaw, item.monoMs || performance.now(), item.time || ''); } catch {}
            }
            try { discoverNonMultiplierTags(item.src, itemRaw, item.monoMs || performance.now(), item.time || ''); } catch {}
          }
          const isBatchWsApi = (item.src === 'WS-IN' || item.src === 'SSE' || item.src === 'WORKER' || item.src === 'API-RES' || item.src === 'TAP-RES' || item.src === 'TAP-RTC' || item.src === 'TAP-WT' || item.src === 'TAP-PM');
          if (CFG.armed && CFG.roundOnce && roundClickLocked && itemRaw && isBatchWsApi) {
            const bAn = bAnPre || analyzeGamePacket(item.src, itemRaw);
            const bRc = classifyRaceKind(item.src, itemRaw);
            const bNowMs = Date.now();
            const bLockAge = bNowMs - roundClickLockedAt;
            const bPlainCrash = bAn.isCrash || (!bAn.hasJson && !bAn.hasXml && bRc === 'CRASH');
            if (bPlainCrash) roundSawCrashAfterLock = true;
            const bRoundDiffFirst = Boolean(!item.matched && bLockAge >= 60 && bAn.roundId && roundClickLockedRoundId && bAn.roundId !== roundClickLockedRoundId);
            if (!bRoundDiffFirst && bAn.inFlight && (!roundClickLockedRoundId || !bAn.roundId || bAn.roundId === roundClickLockedRoundId)) {
              roundSawFlightAfterLock = true;
              roundLastFlightAt = bNowMs;
            } else if (bLockAge >= 60) {
              const bStart = (bAn.isStart || (!bAn.hasJson && !bAn.hasXml && bRc === 'START')) && !item.matched && (roundSawFlightAfterLock || roundSawCrashAfterLock || bLockAge >= 450);
              const bStale = !item.matched && ((bLockAge >= 4500 && !roundSawFlightAfterLock) || (roundSawFlightAfterLock && roundLastFlightAt > 0 && bNowMs - roundLastFlightAt >= 3500 && bLockAge >= 4500) || bLockAge >= 25000);
              if (bPlainCrash || bRoundDiffFirst || bStart || bStale) {
                roundClickLocked = false;
                roundSawFlightAfterLock = false;
                roundSawCrashAfterLock = false;
                roundLastFlightAt = 0;
                roundClickLockedRoundId = '';
                roundUnlockSeq += 1;
                topRoundUnlockChanged = true;
              }
            }
          }
          pushPreservedLogs(item);
          if (item.src === 'API-REQ' || item.src === 'API-RES' || item.src === 'TAP-RES' || item.src === 'TAP-NET') {
            totalApiCount += 1;
            apiLogs.unshift(item);
            if (apiLogs.length > 200) apiLogs.length = 200;
          } else {
            totalWsCount += 1;
            wsLogs.unshift(item);
            if (wsLogs.length > 200) wsLogs.length = 200;
          }
          added = true;
        }
        if (topRoundUnlockChanged) {
          syncTurboCfg(true, false);
          broadcastDownToIframes({ __TT_SNIFFER__: true, kind: 'ROUND_UNLOCK' });
        }
        if (topRoundUnlockChanged && !hudHidden) syncUI();
        if (added && !hudHidden) scheduleRenderLogs();
      }
    };
    window.addEventListener('message', onTopMessage);
    if (targetWin !== window) {
      try { targetWin.addEventListener('message', onTopMessage); } catch {}
    }
    if (typeof GM_addValueChangeListener === 'function') {
      try {
        gmListenerIds.push(GM_addValueChangeListener('__tt_hud_claim_' + CFG.roomId, function (_n, _o, raw) {
          if (!raw) return;
          try {
            const claim = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (claim && claim.frameId && claim.frameId !== FRAME_ID && (!claim.ts || Date.now() - claim.ts < 8000)) {
              childIframeActive = true;
              hudClaims.set(claim.frameId, Object.assign({}, claim, { ts: Date.now() }));
              evaluateHudWinner();
            }
          } catch {}
        }));
      } catch {}
    }
    setTimeout(evaluateHudWinner, 350);
    hudCoordTimer = setInterval(() => { if (!document.hidden) evaluateHudWinner(); }, 3500);
  } else {
    onIframeAckMessage = function (ev) {
      const d = ev && ev.data;
      if (!d || !d.__TT_SNIFFER__) return;
      if (d.kind === 'TOP_ACK' || d.kind === 'RELAY_STATUS') {
        topAcked = true;
        lastTopMsgAt = Date.now();
        iframeNoAckBatches = 0;
        if (d.sessionId) activeSessionId = String(d.sessionId);
        if (d.wss) topReportedWss = d.wss;
        if (d.http) topReportedHttp = d.http;
        if (d.httpOrigin) topReportedOrigin = d.httpOrigin;
        updateSyncDot();
      } else if (d.kind === 'HUD_CLAIM' && d.claim && d.claim.frameId !== FRAME_ID) {
        sendToTop(d);
      } else if (d.kind === 'HUD_WINNER' && d.winner && d.winner.frameId) {
        topAcked = true;
        lastTopMsgAt = Date.now();
        iframeNoAckBatches = 0;
        if (d.sessionId) activeSessionId = String(d.sessionId);
        currentHudWinner = d.winner;
        broadcastDownToIframes(d);
        const isWinner = (d.winner.frameId === FRAME_ID);
        setHudHidden(!isWinner);
        if (!isWinner && ((detectGameDom() && !d.winner.hasGameDom) || (localWsCount > 0 && d.winner.localWs === 0))) {
          publishHudClaim(false);
        }
      } else if (d.kind === 'SYNC_CFG' && d.cfg && d.fromUser && d.srcFrame !== FRAME_ID) {
        lastTopMsgAt = Date.now();
        applyIncomingUserCfg(d.cfg, d);
        broadcastDownToIframes(d);
      } else if (d.kind === 'LOCAL_TARGET') {
        lastTopMsgAt = Date.now();
        const wasLockedLoc = Boolean(iframeLocalTarget.locked);
        const nowLockedLoc = Boolean(d.locked);
        iframeLocalTarget = {
          active: Boolean(d.active && typeof d.x === 'number' && d.x >= 0 && typeof d.y === 'number' && d.y >= 0),
          x: typeof d.x === 'number' ? Math.round(d.x) : -1,
          y: typeof d.y === 'number' ? Math.round(d.y) : -1,
          locked: nowLockedLoc
        };
        if (nowLockedLoc) locked = true;
        else if (typeof d.locked === 'boolean' && !d.locked && wasLockedLoc && hudHidden) locked = false;
        if (iframeLocalTarget.active && (d.forceCapture || (nowLockedLoc && !wasLockedLoc))) {
          try { captureAnchorAtPoint(true, document, iframeLocalTarget.x, iframeLocalTarget.y); } catch {}
        }
        syncTurboCfg(true, false);
        if (iframeLocalTarget.active && typeof preWarmFbHit === 'function') preWarmFbHit();
        try {
          const nested = document.querySelectorAll('iframe');
          for (let ni = 0; ni < nested.length; ni++) {
            const nf = nested[ni];
            let nmsg = { __TT_SNIFFER__: true, kind: 'LOCAL_TARGET', active: false, x: -1, y: -1, locked: nowLockedLoc, forceCapture: Boolean(d.forceCapture) };
            if (iframeLocalTarget.active) {
              const nr = nf.getBoundingClientRect();
              if (nr.width > 10 && nr.height > 10 && iframeLocalTarget.x >= nr.left && iframeLocalTarget.x <= nr.right && iframeLocalTarget.y >= nr.top && iframeLocalTarget.y <= nr.bottom) {
                nmsg = { __TT_SNIFFER__: true, kind: 'LOCAL_TARGET', active: true, x: Math.round(iframeLocalTarget.x - nr.left), y: Math.round(iframeLocalTarget.y - nr.top), locked: nowLockedLoc, forceCapture: Boolean(d.forceCapture) };
              }
            }
            if (nf.contentWindow) nf.contentWindow.postMessage(nmsg, '*');
          }
        } catch {}
      } else if (d.kind === 'START_PICKER') {
        if (!elementPickMode) startElementPickerMode(true);
        broadcastDownToIframes(d);
      } else if (d.kind === 'STOP_PICKER') {
        if (elementPickMode) stopElementPickerMode(false);
        broadcastDownToIframes(d);
      } else if (d.kind === 'IFRAME_ELEMENT_PICK') {
        sendToTop(d);
      } else if (d.kind === 'REMOTE_HIT_ACK' && d.remoteToken) {
        lastTopMsgAt = Date.now();
        broadcastDownToIframes(d);
        try {
          const ackPayload = JSON.stringify({ remoteToken: d.remoteToken, ok: Boolean(d.ok), clickedAt: d.clickedAt || performance.now() });
          dispatchPageStrEvent('__TT_REMOTE_CLICK_ACK__', ackPayload, true);
        } catch {}
      } else if (d.kind === 'ROUND_UNLOCK') {
        lastTopMsgAt = Date.now();
        if (CFG.roundOnce && roundClickLocked && Date.now() - roundClickLockedAt >= 60) {
          roundClickLocked = false;
          roundSawFlightAfterLock = false;
          roundSawCrashAfterLock = false;
          roundLastFlightAt = 0;
          roundClickLockedRoundId = '';
          roundUnlockSeq += 1;
          syncTurboCfg(true, false);
          if (!hudHidden) syncUI();
        }
        broadcastDownToIframes(d);
      } else if (d.kind === 'DIRECT_CASHOUT' && d.payload) {
        broadcastDownToIframes(d);
        try { dispatchPageStrEvent('__TT_DIRECT_CASHOUT__', d.payload, false); } catch {}
      } else if (d.kind === 'BATCH' && Array.isArray(d.events)) {
        sendToTop({
          __TT_SNIFFER__: true,
          kind: 'BATCH',
          roomId: CFG.roomId,
          events: d.events
        });
      }
    };
    window.addEventListener('message', onIframeAckMessage);
    if (targetWin !== window) {
      try { targetWin.addEventListener('message', onIframeAckMessage); } catch {}
    }
    if (typeof GM_addValueChangeListener === 'function') {
      try {
        gmListenerIds.push(GM_addValueChangeListener('__tt_hud_winner_' + CFG.roomId, function (_n, _o, raw) {
          if (!raw) return;
          try {
            const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!msg || !msg.winner || !msg.winner.frameId || (msg.ts && Date.now() - msg.ts > 5000)) return;
            if (msg.sessionId) activeSessionId = String(msg.sessionId);
            if (msg.wss) topReportedWss = msg.wss;
            if (msg.http) topReportedHttp = msg.http;
            if (msg.httpOrigin) topReportedOrigin = msg.httpOrigin;
            currentHudWinner = msg.winner;
            const isWinner = (msg.winner.frameId === FRAME_ID);
            setHudHidden(!isWinner);
            updateSyncDot();
          } catch {}
        }));
      } catch {}
    }
    onIframeResizeClaim = () => publishHudClaim(false);
    window.addEventListener('resize', onIframeResizeClaim, { passive: true });
    setTimeout(() => publishHudClaim(false), 250);
    setTimeout(() => publishHudClaim(false), 900);
    setTimeout(() => publishHudClaim(false), 2000);
    hudCoordTimer = setInterval(() => {
      if (document.hidden) return;
      if (document.readyState === 'loading' && localWsCount === 0) return;
      if (!hudHidden || localWsCount > 0 || localApiCount > 0 || detectGameDom() || userTouchedHud) {
        publishHudClaim(false);
      }
    }, 3000);
    setTimeout(() => {
      publishHudClaim(false);
      if (!topAcked && !userClosed) {
        if (detectGameDom() || localWsCount > 0) {
          setHudHidden(false);
        }
        if (CFG.relayEnabled) {
          iframeFallbackActive = true;
          updateSyncDot();
          TTWssRelay.connect();
          if (iframeEarlyBuffer.length) {
            const early = iframeEarlyBuffer.splice(0, iframeEarlyBuffer.length);
            publishCompactChunksWss(early);
            if (httpSyncState !== 'AUTH_BLOCKED' || (Date.now() - lastHttpRetryAt > 6000)) {
              gmHttp('POST', '/api/relay/push', { roomId: CFG.roomId, events: early });
            }
          }
        }
      }
    }, 180);
  }

  const consumeGmSyncCfg = (raw) => {
    if (!raw) return;
    try {
      const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!msg || !msg.fromUser || !msg.cfg || msg.srcFrame === FRAME_ID) return;
      if (msg.ts && Date.now() - msg.ts > 90000) return;
      if (activeSessionId && msg.sessionId && msg.sessionId !== activeSessionId) return;
      if (!activeSessionId && msg.sessionId && msg.ts && msg.ts < BOOT_TS - 2500) return;
      applyIncomingUserCfg(msg.cfg, msg);
    } catch {}
  };
  if (typeof GM_addValueChangeListener === 'function') {
    try {
      gmListenerIds.push(GM_addValueChangeListener('__tt_sync_cfg_' + CFG.roomId, function (_n, _o, raw) {
        consumeGmSyncCfg(raw);
      }));
    } catch {}
  }
  if (isIframe && typeof GM_getValue === 'function') {
    setTimeout(() => { try { consumeGmSyncCfg(GM_getValue('__tt_sync_cfg_' + CFG.roomId, null)); } catch {} }, 80);
    setTimeout(() => { try { consumeGmSyncCfg(GM_getValue('__tt_sync_cfg_' + CFG.roomId, null)); } catch {} }, 450);
  }

  // --- 1. Page-World Direct Hook via GM_addElement (zero sandbox cross-realm limits) ---
  function b64ToUint8(b64) {
    try {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch {
      return b64;
    }
  }

  const onPageWsEvent = (ev) => {
    let d = ev && ev.detail;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
    if (!d) return;
    const payload = d.isB64 ? b64ToUint8(d.data) : d.data;
    const gData = d.insp ? Object.assign({}, d.gate || {}, { insp: d.insp }) : (d.gate || null);
    if (d.kind === 'send') processRawData('WS-OUT', payload, '', null, gData);
    else if (d.kind === 'message') processRawData('WS-IN', payload, '', d.turbo || null, gData);
    else if (d.kind === 'worker') processRawData('WORKER', payload, '', d.turbo || null, gData);
    else if (d.kind === 'sse') processRawData('SSE', payload, '', d.turbo || null, gData);
    else if (d.kind === 'rtc') processRawData('TAP-RTC', payload, '', d.turbo || null, gData);
    else if (d.kind === 'wt') processRawData('TAP-WT', payload, '', d.turbo || null, gData);
    else if (d.kind === 'pm') processRawData('TAP-PM', payload, '', d.turbo || null, gData);
  };
  const onPageGateFlushEvent = (ev) => {
    let d = ev && ev.detail;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
    if (!d || d.id == null || typeof d.flushedAt !== 'number') return;
    applyGateFlush(d.id, d.flushedAt);
  };
  const onPageApiEvent = (ev) => {
    let d = ev && ev.detail;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
    if (!d) return;
    const payload = d.isB64 ? b64ToUint8(d.data) : d.data;
    if (payload !== undefined && payload !== null && payload !== '') {
      processRawData(d.src || 'API-RES', payload, d.meta || '', d.turbo || null);
    } else if (d.meta) {
      handleDecoded(d.src || 'API-REQ', d.src === 'TAP-NET' ? 'TAP' : 'REQ', String(d.meta).trim(), d.turbo || null);
    }
  };

  let pageWorldActive = false;
  let sandboxFallbacksInstalled = false;
  let sandboxFallbackTimer = 0;
  let pageInjectPending = false;
  let hadDomMountAtBoot = false;
  let installSandboxFallbacks = () => {};
  let uninstallSandboxFallbacks = () => {};
  const cancelSandboxFallbackTimer = () => {
    if (sandboxFallbackTimer) {
      clearTimeout(sandboxFallbackTimer);
      sandboxFallbackTimer = 0;
    }
  };
  const scheduleSandboxFallback = (delayMs) => {
    if (pageWorldActive || sandboxFallbacksInstalled) return;
    if (!delayMs || delayMs <= 0) {
      cancelSandboxFallbackTimer();
      installSandboxFallbacks();
      return;
    }
    if (sandboxFallbackTimer) return;
    sandboxFallbackTimer = setTimeout(() => {
      sandboxFallbackTimer = 0;
      if (!pageWorldActive && !targetWin.__ttPageHooked && !window.__ttPageHooked) {
        installSandboxFallbacks();
      }
    }, delayMs);
  };
  const onPageReadyEvent = () => {
    pageWorldActive = true;
    pageInjectPending = false;
    cancelSandboxFallbackTimer();
    if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
    syncTurboCfg(true, false);
  };
  const onPageUnlockEvent = () => {
    if (CFG.roundOnce && roundClickLocked) {
      roundClickLocked = false;
      roundSawFlightAfterLock = false;
      roundSawCrashAfterLock = false;
      roundClickLockedRoundId = '';
      if (hudHidden) {
        sendToTop({ __TT_SNIFFER__: true, kind: 'ROUND_UNLOCK' });
      } else {
        syncUI();
      }
    }
  };
  const onPageRetryHitEvent = (ev) => {
    try {
      let d = ev && ev.detail;
      if (typeof d === 'string') d = JSON.parse(d);
      if (!d) return;
      const now = Date.now();
      const retryBad = Boolean(d.preDis || d.wrongBtn || isButtonAlreadyEnded(d.preText || '', Boolean(d.preDis)));
      if (!retryBad) {
        lastTriggerAt = now;
        if (CFG.roundOnce) {
          roundClickLocked = true;
          roundClickLockedAt = now;
          roundSawFlightAfterLock = false;
          roundSawCrashAfterLock = false;
          roundClickLockedRoundId = String(d.roundId || '');
        }
        if (d.oneShotFired) {
          CFG.armed = false;
          persistHudControlState();
        }
        triggerCount += 1;
        lastReactionMsStr = String(d.elapsed || '0.00');
        lastHitTag = ('RETRY[' + String(d.tag || 'HIT') + ']').slice(0, 26);
        elPerf.textContent = '⚡' + lastReactionMsStr + 'ms';
        elPerf.style.color = '#4ade80';
        const retryDeltaMs = Math.max(0, Number(lastReactionMsStr) || 0);
        recordLatencySample(retryDeltaMs, 'RETRY', d.timeStr || fmtTimeMs(new Date()), 0);
        recordSecurityLatency(retryDeltaMs, 'RETRY', d.timeStr || fmtTimeMs(new Date()));
        recordClickRace(d.tClick || performance.now(), d.timeStr || fmtTimeMs(new Date()), '⚡' + lastReactionMsStr, lastHitTag, {
          preText: d.preText || '',
          disabled: Boolean(d.preDis),
          clickX: typeof d.clickX === 'number' ? d.clickX : undefined,
          clickY: typeof d.clickY === 'number' ? d.clickY : undefined,
          jittered: Boolean(d.jittered),
          fpSalt: d.fpSalt ? String(d.fpSalt) : '',
          fpPressure: typeof d.fpPressure === 'number' ? d.fpPressure : undefined,
          fpRadius: typeof d.fpRadius === 'number' ? d.fpRadius : undefined,
          syncFrame: Boolean(CFG.zeroDelay),
          isRetry: true,
          holdMs: CFG.zeroDelay ? (Number(CFG.zeroDelayMicroMs) || 0) : (CFG.humanTap ? 35 : 0),
          frameStartMonoMs: Math.max(0, (d.tClick || performance.now()) - retryDeltaMs)
        });
        if (isIframe && d.fromLocalIframe) {
          sendToTop({
            __TT_SNIFFER__: true,
            kind: 'LOCAL_TURBO_HIT',
            src: 'RETRY',
            tag: d.tag || 'HIT',
            roundId: d.roundId || '',
            elapsed: lastReactionMsStr,
            timeStr: d.timeStr || fmtTimeMs(new Date()),
            gateEstMs: 0,
            oneShotFired: Boolean(d.oneShotFired),
            preText: d.preText || '',
            preDis: Boolean(d.preDis),
            clickX: typeof d.clickX === 'number' ? d.clickX : undefined,
            clickY: typeof d.clickY === 'number' ? d.clickY : undefined,
            jittered: Boolean(d.jittered),
            fpSalt: d.fpSalt ? String(d.fpSalt) : '',
            fpPressure: typeof d.fpPressure === 'number' ? d.fpPressure : undefined,
            fpRadius: typeof d.fpRadius === 'number' ? d.fpRadius : undefined
          });
        }
        syncUI();
      }
    } catch {}
  };
  const onPageRtfEvent = (ev) => {
    let d = ev && ev.detail;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
    if (!d || !d.data) return;
    processRawData(d.src || 'JS-HOOK', String(d.data), '', d.turbo || null);
  };
  if (true) {
    try {
      document.addEventListener('__TT_PAGE_READY__', onPageReadyEvent);
      document.addEventListener('__TT_PAGE_UNLOCK__', onPageUnlockEvent);
      document.addEventListener('__TT_PAGE_RETRY_HIT__', onPageRetryHitEvent);
      document.addEventListener('__TT_GATE_FLUSH__', onPageGateFlushEvent);
      targetWin.addEventListener('__TT_GATE_FLUSH__', onPageGateFlushEvent);
      document.addEventListener('__TT_PAGE_RTF__', onPageRtfEvent);
      targetWin.addEventListener('__TT_PAGE_RTF__', onPageRtfEvent);
      if (CFG.listenWS || CFG.networkTap) {
        document.addEventListener('__TT_PAGE_WS__', onPageWsEvent);
        targetWin.addEventListener('__TT_PAGE_WS__', onPageWsEvent);
      }
      if (CFG.listenAPI || CFG.networkTap) {
        document.addEventListener('__TT_PAGE_API__', onPageApiEvent);
        targetWin.addEventListener('__TT_PAGE_API__', onPageApiEvent);
      }
      const pageHookCode = '(function(){' +
        'var PH_SYM=typeof Symbol==="function"?Symbol.for("__tt.ph"):null;' +
        'var CFG_SYM=typeof Symbol==="function"?Symbol.for("__tt.cfg"):null;' +
        'var CD_SYM=typeof Symbol==="function"?Symbol.for("__tt.cd"):null;' +
        'var CM_SYM=typeof Symbol==="function"?Symbol.for("__tt.cm"):null;' +
        'var HUD_ID=' + JSON.stringify(HUD_HOST_ID) + ';' +
        'if(window.__ttPageHooked||(PH_SYM&&window[PH_SYM]))return;' +
        'function defHide(o,k,v){try{Object.defineProperty(o,k,{value:v,writable:true,configurable:true,enumerable:false});}catch(e){try{o[k]=v;}catch(e2){}}}' +
        'defHide(window,"__ttPageHooked",true);' +
        'try{if(document.documentElement&&document.documentElement.setAttribute)document.documentElement.setAttribute("data-tt-page-hooked","1");}catch(ehd){}' +
        'if(!document.documentElement){try{document.addEventListener("DOMContentLoaded",function(){try{if(document.documentElement&&document.documentElement.setAttribute)document.documentElement.setAttribute("data-tt-page-hooked","1");}catch(e2){}},{once:true});}catch(ehd2){}}' +
        'if(PH_SYM)defHide(window,PH_SYM,true);' +
        'defHide(window,"__ttTrustDepth",window.__ttTrustDepth||0);' +
        'var nativeFnMap=typeof WeakMap==="function"?new WeakMap():null;' +
        'var oFnToStr=Function.prototype.toString;' +
        'function maskNative(fn,orig){if(!fn||!orig||!nativeFnMap)return fn;try{nativeFnMap.set(fn,typeof orig==="string"?orig:oFnToStr.call(orig));}catch(e){}return fn;}' +
        'if(nativeFnMap&&typeof oFnToStr==="function"){' +
          'var wToStr=function toString(){if(this&&(typeof this==="function"||typeof this==="object")&&nativeFnMap.has(this))return nativeFnMap.get(this);return oFnToStr.call(this);};' +
          'try{nativeFnMap.set(wToStr,oFnToStr.call(oFnToStr));Object.defineProperty(Function.prototype,"toString",{value:wToStr,writable:true,configurable:true,enumerable:false});}catch(e){}' +
        '}' +
        'var trustedCache=typeof WeakMap==="function"?new WeakMap():null;' +
        'var fakeTouchCap={firesTouchEvents:true};' +
        'function makeTrusted(ev){' +
          'if(!ev||typeof ev!=="object"||ev.isTrusted)return ev;' +
          'if(trustedCache&&trustedCache.has(ev))return trustedCache.get(ev);' +
          'try{' +
            'var sh=Object.create(ev);' +
            'var p=new Proxy(sh,{has:function(t,k){return k==="isTrusted"||k==="sourceCapabilities"||(k in ev);},get:function(t,k){if(k==="isTrusted")return true;if(k==="sourceCapabilities")return ev.sourceCapabilities||fakeTouchCap;var v=ev[k];return typeof v==="function"?v.bind(ev):v;},set:function(t,k,v){ev[k]=v;return true;}});' +
            'if(trustedCache)trustedCache.set(ev,p);' +
            'return p;' +
          '}catch(e){return ev;}' +
        '}' +
        'function isRelay(u){var s=String(u||"");return s.indexOf("broker.emqx.io")!==-1||s.indexOf("broker.hivemq.com")!==-1||s.indexOf("test.mosquitto.org")!==-1||s.indexOf("/api/relay/")!==-1;}' +
        'var OW=(typeof window.WebSocket==="function")?window.WebSocket:null;' +
        'var OWK=(typeof window.Worker==="function")?window.Worker:null;' +
        'var OSW=(typeof window.SharedWorker==="function")?window.SharedWorker:null;' +
        'var OBC=(typeof window.BroadcastChannel==="function")?window.BroadcastChannel:null;' +
        'var OES=(typeof window.EventSource==="function")?window.EventSource:null;' +
        'var ORTC=(typeof window.RTCDataChannel==="function")?window.RTCDataChannel:null;' +
        'var ORPC=(typeof window.RTCPeerConnection==="function")?window.RTCPeerConnection:null;' +
        'var OWT=(typeof window.WebTransport==="function")?window.WebTransport:null;' +
        'var seenRes=typeof WeakSet==="function"?new WeakSet():null;' +
        'var oRespText=(typeof Response!=="undefined"&&Response.prototype&&typeof Response.prototype.text==="function")?Response.prototype.text:null;' +
        'function isStreamObj(o){' +
          'if(!o||typeof o!=="object")return false;' +
          'if(o.__ttSubStream)return !isRelay(o.url||"");' +
          'if(OW&&o instanceof OW)return !isRelay(o.url||"");' +
          'if(OWK&&o instanceof OWK)return true;' +
          'if(OES&&o instanceof OES)return !isRelay(o.url||"");' +
          'if(OBC&&o instanceof OBC)return String(o.name||"").indexOf("__tt")===-1;' +
          'if(ORTC&&o instanceof ORTC)return true;' +
          'if(o.__ttSWPort)return true;' +
          'return false;' +
        '}' +
        'function streamKindOf(o){' +
          'if(o&&o.__ttSubKind)return o.__ttSubKind;' +
          'if((OWK&&o instanceof OWK)||(OBC&&o instanceof OBC)||o.__ttSWPort)return "worker";' +
          'if(OES&&o instanceof OES)return "sse";' +
          'if(ORTC&&o instanceof ORTC)return "rtc";' +
          'return "message";' +
        '}' +
        'var evCache=typeof WeakMap==="function"?new WeakMap():null;' +
        'var holdMap=typeof WeakMap==="function"?new WeakMap():null;' +
        'var gateHookFn=null;' +
        'var ttClickEv=Object.assign(Object.create(null),{click:1,dblclick:1,contextmenu:1,pointerdown:1,pointerup:1,pointerover:1,pointerenter:1,pointermove:1,pointerout:1,pointerleave:1,pointercancel:1,gotpointercapture:1,lostpointercapture:1,touchstart:1,touchend:1,touchmove:1,touchcancel:1,mousedown:1,mouseup:1,mouseover:1,mouseenter:1,mousemove:1,mouseout:1,mouseleave:1});' +
        'if(typeof EventTarget!=="undefined"&&EventTarget.prototype&&!EventTarget.prototype.__ttPageAEP){' +
          'var ETP=EventTarget.prototype,oAdd=ETP.addEventListener,oRem=ETP.removeEventListener;' +
          'var lMap=typeof WeakMap==="function"?new WeakMap():null;' +
          'defHide(ETP,"__ttPageAEP",true);' +
          'ETP.addEventListener=maskNative(function addEventListener(type,fn,opts){' +
            'if(!fn||(typeof fn!=="function"&&typeof fn.handleEvent!=="function")||fn.__ttBypassGate)return oAdd.call(this,type,fn,opts);' +
            'var isMsgS=(type==="message"&&isStreamObj(this))||(OES&&(this instanceof OES)&&!isRelay(this.url||""));' +
            'if(!ttClickEv[type]&&!isMsgS)return oAdd.call(this,type,fn,opts);' +
            'var w=lMap?lMap.get(fn):null;' +
            'if(!w){' +
              'w=function(ev){' +
                'var arg=(window.__ttTrustDepth>0&&ev&&typeof ev==="object"&&!ev.isTrusted)?makeTrusted(ev):ev;' +
                'if(gateHookFn&&ev&&(ev.type==="message"||(OES&&(this instanceof OES)&&"data" in ev))&&isStreamObj(this)){' +
                  'var gst=gateHookFn(this,ev);' +
                  'if(gst&&!gst.flushed&&(gst.gated||gst.lockCount>0||gst.pendingAsync||gst.relAt>0)){gst.queue.push([this,fn,arg]);return;}' +
                '}' +
                'return typeof fn==="function"?fn.call(this,arg):fn.handleEvent(arg);' +
              '};' +
              'if(lMap)lMap.set(fn,w);' +
            '}' +
            'return oAdd.call(this,type,w,opts);' +
          '},oAdd);' +
          'ETP.removeEventListener=maskNative(function removeEventListener(type,fn,opts){' +
            'if(!ttClickEv[type]&&type!=="message"&&!(OES&&(this instanceof OES)))return oRem.call(this,type,fn,opts);' +
            'var w=(lMap&&fn&&(typeof fn==="function"||typeof fn==="object"))?(lMap.get(fn)||fn):fn;' +
            'return oRem.call(this,type,w,opts);' +
          '},oRem);' +
        '}' +
        'var ohProtos=[];' +
        'if(typeof HTMLElement!=="undefined"&&HTMLElement.prototype)ohProtos.push(HTMLElement.prototype);' +
        'if(typeof Document!=="undefined"&&Document.prototype)ohProtos.push(Document.prototype);' +
        'if(typeof SVGElement!=="undefined"&&SVGElement.prototype)ohProtos.push(SVGElement.prototype);' +
        'var onProps=["onclick","onpointerdown","onpointerup","ontouchstart","ontouchend","onmousedown","onmouseup"];' +
        'for(var pi=0;pi<ohProtos.length;pi++){' +
          'var proto=ohProtos[pi];if(proto.__ttPageOHP)continue;defHide(proto,"__ttPageOHP",true);' +
          'for(var oi=0;oi<onProps.length;oi++){' +
            '(function(pr,prop){' +
              'try{' +
                'var desc=Object.getOwnPropertyDescriptor(pr,prop);' +
                'if(!desc||!desc.set||!desc.get||!desc.configurable)return;' +
                'var rawMap=typeof WeakMap==="function"?new WeakMap():null;' +
                'Object.defineProperty(pr,prop,{configurable:true,enumerable:desc.enumerable,' +
                  'get:function(){return rawMap&&rawMap.has(this)?rawMap.get(this):desc.get.call(this);},' +
                  'set:function(fn){' +
                    'if(typeof fn!=="function"){if(rawMap)rawMap.delete(this);return desc.set.call(this,fn);}' +
                    'if(rawMap)rawMap.set(this,fn);' +
                    'return desc.set.call(this,function(ev){var arg=(window.__ttTrustDepth>0&&ev&&typeof ev==="object"&&!ev.isTrusted)?makeTrusted(ev):ev;return fn.call(this,arg);});' +
                  '}' +
                '});' +
              '}catch(e){}' +
            '})(proto,onProps[oi]);' +
          '}' +
        '}' +
        'if(typeof Element!=="undefined"&&Element.prototype){' +
          'var oSPC=Element.prototype.setPointerCapture,oRPC=Element.prototype.releasePointerCapture;' +
          'if(oSPC&&!oSPC.__ttPageSPC){var wSPC=maskNative(function setPointerCapture(id){if(window.__ttTrustDepth>0){try{return oSPC.call(this,id);}catch(e){return;}}return oSPC.apply(this,arguments);},oSPC);defHide(wSPC,"__ttPageSPC",true);try{Element.prototype.setPointerCapture=wSPC;}catch(e){}}' +
          'if(oRPC&&!oRPC.__ttPageRPC){var wRPC=maskNative(function releasePointerCapture(id){if(window.__ttTrustDepth>0){try{return oRPC.call(this,id);}catch(e){return;}}return oRPC.apply(this,arguments);},oRPC);defHide(wRPC,"__ttPageRPC",true);try{Element.prototype.releasePointerCapture=wRPC;}catch(e){}}' +
        '}' +
        'var cachedRNode=null,cachedHitEl=null,cachedHitX=-1,cachedHitY=-1,cachedHitDoc=null;' +
        'var fastPE=typeof PointerEvent==="function"?PointerEvent:null,fastME=typeof MouseEvent==="function"?MouseEvent:null,fastTCH=typeof Touch==="function"?Touch:null,fastTE=typeof TouchEvent==="function"?TouchEvent:null;' +
        'function deepEl(doc,x,y,allowCache){' +
          'if(!cachedRNode||cachedRNode.ownerDocument!==doc||!cachedRNode.isConnected)cachedRNode=doc.getElementById(HUD_ID);' +
          'var rNode=cachedRNode,pNodePE="",didZeroPE=false;' +
          'if(rNode&&rNode.style&&rNode.style.pointerEvents!=="none"){pNodePE=rNode.style.pointerEvents;rNode.style.pointerEvents="none";didZeroPE=true;}' +
          'var hit=null;' +
          'try{' +
            'if(allowCache&&typeof doc.elementsFromPoint!=="function"&&cachedHitEl&&cachedHitDoc===doc&&cachedHitX===x&&cachedHitY===y&&cachedHitEl.isConnected){hit=cachedHitEl;}' +
            'if(!hit&&typeof doc.elementsFromPoint==="function"){' +
              'var els=doc.elementsFromPoint(x,y),firstEl=null;' +
              'for(var ei=0;ei<els.length;ei++){var el=els[ei];if(!el)continue;if(rNode&&(el===rNode||rNode.contains(el)))continue;if(!firstEl)firstEl=el;if(ei<=5&&(el.tagName==="BUTTON"||el.tagName==="A"||el.tagName==="CANVAS"||el.tagName==="INPUT"||(el.getAttribute&&el.getAttribute("role")==="button")||(el.closest&&el.closest("button,a,[role=button],input[type=button],input[type=submit]")))){hit=el;break;}}' +
              'if(!hit)hit=firstEl;' +
            '}' +
            'if(!hit){' +
              'hit=doc.elementFromPoint(x,y);' +
              'var prevVis="",hidHost=false;' +
              'if(hit&&rNode&&(hit===rNode||rNode.contains(hit))){' +
                'prevVis=rNode.style.visibility;rNode.style.visibility="hidden";hidHost=true;' +
                'hit=doc.elementFromPoint(x,y);' +
              '}' +
              'if(hidHost)rNode.style.visibility=prevVis;' +
            '}' +
            'var g=0;' +
            'while(hit&&hit.shadowRoot&&typeof hit.shadowRoot.elementFromPoint==="function"&&g<8){' +
              'g++;var inner=hit.shadowRoot.elementFromPoint(x,y);if(!inner||inner===hit)break;hit=inner;' +
            '}' +
            'if(hit&&hit.tagName!=="IFRAME"){cachedHitEl=hit;cachedHitX=x;cachedHitY=y;cachedHitDoc=doc;}' +
          '}finally{if(didZeroPE)rNode.style.pointerEvents=pNodePE;}' +
          'return hit;' +
        '}' +
        'var hookSubNet=null;' +
        'function hookWinTrust(w){' +
          'if(!w||w===window||w.__ttPageHooked)return;' +
          'try{' +
            'if(!w.document)return;' +
            'defHide(w,"__ttPageHooked",true);defHide(w,"__ttTrustDepth",w.__ttTrustDepth||0);' +
            'if(w.EventTarget&&w.EventTarget.prototype&&!w.EventTarget.prototype.__ttPageAEP){' +
              'var wETP=w.EventTarget.prototype,wOAdd=wETP.addEventListener,wORem=wETP.removeEventListener;' +
              'var wMap=typeof w.WeakMap==="function"?new w.WeakMap():null;' +
              'var wOES=(typeof w.EventSource==="function")?w.EventSource:null;' +
              'defHide(wETP,"__ttPageAEP",true);' +
              'wETP.addEventListener=maskNative(function addEventListener(t,fn,o){if(!fn||(typeof fn!=="function"&&typeof fn.handleEvent!=="function")||fn.__ttBypassGate)return wOAdd.call(this,t,fn,o);if(!ttClickEv[t]&&!(t==="message"&&isStreamObj(this))&&!(wOES&&(this instanceof wOES)&&!isRelay(this.url||"")))return wOAdd.call(this,t,fn,o);var wr=wMap?wMap.get(fn):null;if(!wr){wr=function(ev){var arg=((w.__ttTrustDepth>0||window.__ttTrustDepth>0)&&ev&&typeof ev==="object"&&!ev.isTrusted)?makeTrusted(ev):ev;if(gateHookFn&&ev&&(ev.type==="message"||(wOES&&(this instanceof wOES)&&"data" in ev))&&isStreamObj(this)){var gst=gateHookFn(this,ev);if(gst&&!gst.flushed&&(gst.gated||gst.lockCount>0||gst.pendingAsync||gst.relAt>0)){gst.queue.push([this,fn,arg]);return;}}return typeof fn==="function"?fn.call(this,arg):fn.handleEvent(arg);};if(wMap)wMap.set(fn,wr);}return wOAdd.call(this,t,wr,o);},wOAdd);' +
              'wETP.removeEventListener=maskNative(function removeEventListener(t,fn,o){if(!ttClickEv[t]&&t!=="message"&&!(wOES&&(this instanceof wOES)))return wORem.call(this,t,fn,o);var wr=(wMap&&fn&&(typeof fn==="function"||typeof fn==="object"))?(wMap.get(fn)||fn):fn;return wORem.call(this,t,wr,o);},wORem);' +
            '}' +
            'if(typeof hookSubNet==="function")hookSubNet(w);' +
          '}catch(e){}' +
        '}' +
        'var fastDec=null;' +
        'var tCfg=' + JSON.stringify({
          armed: Boolean(CFG.armed),
          tags: String(CFG.tags || ''),
          matchMode: String(CFG.matchMode || 'contains'),
          caseSensitive: Boolean(CFG.caseSensitive),
          cooldownMs: Number(CFG.cooldownMs) || 0,
          oneShot: Boolean(CFG.oneShot),
          roundOnce: Boolean(CFG.roundOnce),
          zeroDelay: Boolean(CFG.zeroDelay),
          zeroDelayMicroMs: Math.max(0, Math.min(5, Number(CFG.zeroDelayMicroMs) || 0)),
          holdMs: (CFG.humanTap && !CFG.zeroDelay) ? 35 : 0,
          humanJitter: Boolean(CFG.humanJitter),
          fingerprintShuffle: Boolean(CFG.fingerprintShuffle),
          opClickMode: Boolean(CFG.opClickMode !== false),
          directWsCashout: Boolean(CFG.directWsCashout !== false),
          netLagAutoShift: Boolean(CFG.netLagAutoShift !== false),
          fallbackMultX: Number(CFG.fallbackMultX) || 0,
          autoCashoutCeilingX: Number(CFG.autoCashoutCeilingX) || 0,
          networkTap: Boolean(CFG.networkTap),
          preClickGate: Boolean(CFG.preClickGate),
          leadMs: CFG.preClickGate ? (Number(CFG.wsLeadMs) || 0) : 0,
          gateMs: CFG.preClickGate ? (Number(CFG.gateHoldMs) || 0) : 0,
          holdEvents: String(CFG.holdEvents || ''),
          inspectorEnabled: Boolean(CFG.inspectorEnabled),
          inspectorAutoClick: Boolean(CFG.inspectorAutoClick),
          inspectorHoldAllWs: Boolean(CFG.inspectorHoldAllWs),
          inspectorHoldMs: Number(CFG.inspectorHoldMs) || 0,
          inspectorKeywords: String(CFG.inspectorKeywords || ''),
          inspectorRegexes: String(CFG.inspectorRegexes || ''),
          inspectorJsonPaths: String(CFG.inspectorJsonPaths || ''),
          x: Math.round(targetX),
          y: Math.round(targetY),
          localActive: Boolean(isIframe && iframeLocalTarget.active),
          localX: isIframe ? Math.round(iframeLocalTarget.x) : -1,
          localY: isIframe ? Math.round(iframeLocalTarget.y) : -1,
          targetText: String(CFG.targetText || ''),
          targetSelector: String(CFG.targetSelector || ''),
          locked: Boolean(locked),
          hudHidden: Boolean(hudHidden),
          roundUnlockSeq: roundUnlockSeq
        }) + ';' +
        'var globalClickUntil=0;' +
        'var lastClickDoneAt=0;' +
        'var activeClickCount=0;' +
        'var pendingRemoteCount=0;' +
        'var remoteLockSeq=0;' +
        'var pendingRemoteLocks=Object.create(null);' +
        'var streamQueues=typeof WeakMap==="function"?new WeakMap():null;' +
        'var activeGateTgts=[];' +
        'var CRASH_SHIELD_MS=45;' +
        'var tEntries=[],tHasJsonOrKv=false,tHasWsRule=false;' +
        'var tHoldList=[];' +
        'var lastTurboAt=0;' +
        'var roundClickLocked=false;' +
        'var roundClickLockedAt=0;' +
        'var roundSawFlight=false;' +
        'var roundSawCrash=false;' +
        'var roundLastFlightAt=0;' +
        'var roundLockedId="";' +
        'var T_DQ=String.fromCharCode(34),T_SQ=String.fromCharCode(39),T_BS=String.fromCharCode(92);' +
        'function compileHoldEvents(){' +
          'tHoldList=[];var raw=String(tCfg.holdEvents||"").split(String.fromCharCode(10)).join(",").split(String.fromCharCode(13)).join(",").split(",");' +
          'for(var i=0;i<raw.length;i++){var s=raw[i].trim().toLowerCase();if(s)tHoldList.push(s);}' +
        '}' +
        'function tSplitTags(raw){' +
          'var out=[],cur="",bd=0,qd=0,bk=0,esc=false;' +
          'for(var i=0;i<raw.length;i++){' +
            'var cc=raw.charCodeAt(i),c=raw.charAt(i);' +
            'if(esc){cur+=c;esc=false;continue;}' +
            'if(cc===92&&qd){cur+=c;esc=true;continue;}' +
            'if(qd){if(cc===10||cc===13){qd=0;bd=0;bk=0;var brk=cur.trim();if(brk)out.push(brk);cur="";continue;}cur+=c;if(cc===qd)qd=0;continue;}' +
            'if(cc===34||cc===39){qd=cc;cur+=c;continue;}' +
            'if(cc===123)bd++;else if(cc===125&&bd>0)bd--;else if(cc===91)bk++;else if(cc===93&&bk>0)bk--;' +
            'if((cc===44||cc===10||cc===13)&&bd===0&&bk===0){var tr=cur.trim();if(tr)out.push(tr);cur="";continue;}' +
            'cur+=c;' +
          '}' +
          'var tl=cur.trim();if(tl)out.push(tl);return out;' +
        '}' +
        'function tFmtMs(){var d=new Date();return d.toTimeString().slice(0,8)+"."+String(d.getMilliseconds()).padStart(3,"0");}' +
        'function tParseNum(v){' +
          'if(typeof v==="number")return isFinite(v)?v:NaN;' +
          'if(typeof v!=="string")return NaN;' +
          'var s=v.trim();' +
          'if((s.charAt(0)===T_DQ&&s.charAt(s.length-1)===T_DQ)||(s.charAt(0)===T_SQ&&s.charAt(s.length-1)===T_SQ))s=s.slice(1,-1).trim();' +
          'while(s.length&&(s.charAt(0)==="x"||s.charAt(0)==="X"||s.charCodeAt(0)===215))s=s.slice(1).trim();' +
          'while(s.length&&(s.charAt(s.length-1)==="x"||s.charAt(s.length-1)==="X"||s.charCodeAt(s.length-1)===215||s.charAt(s.length-1)==="%"))s=s.slice(0,-1).trim();' +
          'if(s.indexOf(",")!==-1){var ci=s.indexOf(",");if(s.indexOf(".")===-1&&s.indexOf(",",ci+1)===-1&&(s.length-ci-1)>=1&&(s.length-ci-1)<=2){s=s.slice(0,ci)+"."+s.slice(ci+1);}else{s=s.split(",").join("");}}' +
          'if(!s)return NaN;var n=Number(s);return (typeof n==="number"&&isFinite(n))?n:NaN;' +
        '}' +
        'function tResolveKey(o,k){if(!o||typeof o!=="object"||Array.isArray(o))return undefined;if(Object.prototype.hasOwnProperty.call(o,k))return k;if(tCfg.caseSensitive)return undefined;var lk=String(k).toLowerCase(),ks=Object.keys(o);for(var i=0;i<ks.length;i++){if(ks[i].toLowerCase()===lk)return ks[i];}return undefined;}' +
        'function tFindKey(o,k){if(!o||typeof o!=="object")return undefined;var rk=tResolveKey(o,k);if(rk!==undefined)return o[rk];if(Array.isArray(o)){for(var i=0;i<o.length;i++){var f=tFindKey(o[i],k);if(f!==undefined)return f;}return undefined;}var ks=Object.keys(o);for(var j=0;j<ks.length;j++){var f2=tFindKey(o[ks[j]],k);if(f2!==undefined)return f2;}return undefined;}' +
        'function tLookup(o,p){if(o==null||!p)return undefined;var pts=p.replace(/\\[(\\d+)\\]/g,".$1").split(".").filter(Boolean);var c=o;for(var i=0;i<pts.length;i++){if(c==null||typeof c!=="object"){c=undefined;break;}if(Array.isArray(c)){var ai=parseInt(pts[i],10);c=(!isNaN(ai)&&ai>=0&&ai<c.length)?c[ai]:undefined;}else{var rk=tResolveKey(c,pts[i]);c=rk!==undefined?c[rk]:undefined;}}if(c!==undefined)return c;if(pts.length===1){var df=tFindKey(o,pts[0]);if(df!==undefined)return df;if(Array.isArray(o)&&o.length>=2&&typeof o[0]==="string"&&o[0].toLowerCase()===pts[0].toLowerCase()&&(typeof o[1]==="number"||typeof o[1]==="string"))return o[1];if(typeof o==="object"&&!Array.isArray(o)&&typeof o.target==="string"&&o.target.toLowerCase()===pts[0].toLowerCase()&&Array.isArray(o.arguments)&&(typeof o.arguments[0]==="number"||typeof o.arguments[0]==="string"))return o.arguments[0];}return undefined;}' +
        'function tJsonMatch(h,n,d){if(d>8)return false;if(n===h)return true;if(n==null||h==null)return n===h;if(typeof n==="string"&&typeof h==="string"){if(tCfg.caseSensitive?h===n:h.toLowerCase()===n.toLowerCase())return true;var nhs=tParseNum(h),nns=tParseNum(n);return !isNaN(nhs)&&!isNaN(nns)&&nhs===nns;}if(typeof n!=="object"){if(String(h)===String(n))return true;var nh2=tParseNum(h),nn2=tParseNum(n);return !isNaN(nh2)&&!isNaN(nn2)&&nh2===nn2;}if(typeof h!=="object"){if(typeof h==="string"&&d<6&&h.length>=2&&h.length<=12000){var htr=h.trim();if((htr.charAt(0)==="{"&&htr.charAt(htr.length-1)==="}")||(htr.charAt(0)==="["&&htr.charAt(htr.length-1)==="]")){try{return tJsonMatch(JSON.parse(htr),n,d+1);}catch(ehp){}}}return false;}if(Array.isArray(n)){if(!Array.isArray(h))return false;for(var i=0;i<n.length;i++){var ok=false;for(var j=0;j<h.length;j++){if(tJsonMatch(h[j],n[i],d+1)){ok=true;break;}}if(!ok)return false;}return true;}if(Array.isArray(h)){for(var a=0;a<h.length;a++){if(tJsonMatch(h[a],n,d+1))return true;}return false;}var nks=Object.keys(n),dm=nks.length>0;for(var k=0;k<nks.length;k++){var ky=nks[k],rk=tResolveKey(h,ky);if(rk===undefined||!tJsonMatch(h[rk],n[ky],d+1)){dm=false;break;}}if(dm)return true;var hks=Object.keys(h);for(var m=0;m<hks.length;m++){var v=h[hks[m]];if(v&&typeof v==="object"&&tJsonMatch(v,n,d+1))return true;if(typeof v==="string"&&d<6&&v.length>=2&&v.length<=12000){var vt=v.trim();if((vt.charAt(0)==="{"&&vt.charAt(vt.length-1)==="}")||(vt.charAt(0)==="["&&vt.charAt(vt.length-1)==="]")){try{if(tJsonMatch(JSON.parse(vt),n,d+1))return true;}catch(e){}}}}return false;}' +
        'var nextPageGateId=1;' +
        'function tStripWs(s){return String(s||"").split(" ").join("").split(String.fromCharCode(9)).join("").split(String.fromCharCode(10)).join("").split(String.fromCharCode(13)).join("");}' +
        'function compileTurbo(){' +
          'tEntries=[];tHasJsonOrKv=false;tHasWsRule=false;var arr=tSplitTags(String(tCfg.tags||""));' +
          'for(var i=0;i<arr.length;i++){' +
            'var raw=arr[i],clean=raw.replace(/,+\\s*$/,"").trim();if(!clean)continue;' +
            'var aSm=clean.match(/^api:([^\\s]+)\\s*->\\s*(.+)$/i);' +
            'var apiS=aSm?{pN:tCfg.caseSensitive?aSm[1].trim():aSm[1].trim().toLowerCase(),cN:tCfg.caseSensitive?aSm[2].trim():aSm[2].trim().toLowerCase(),cKv:aSm[2].trim().match(/^([\\w.$\\[\\]]+)\\s*(>=|<=|>|<|==|=)\\s*(.+)$/) }:null;' +
            'var jSm=!apiS?clean.match(/^(js:CustomEvent\\("[^"]+"\\))\\s+(.+)$/):null;' +
            'var jsS=jSm?{eN:tCfg.caseSensitive?jSm[1].trim():jSm[1].trim().toLowerCase(),cN:tCfg.caseSensitive?jSm[2].trim():jSm[2].trim().toLowerCase(),cKv:jSm[2].trim().match(/^([\\w.$\\[\\]]+)\\s*(>=|<=|>|<|==|=)\\s*(.+)$/) }:null;' +
            'var tj=null;if(!apiS&&!jsS){try{var ibC=clean.indexOf("{"),iaC=clean.indexOf("["),stC=(ibC>=0&&iaC>=0)?Math.min(ibC,iaC):Math.max(ibC,iaC);if(stC===0||(stC>0&&/^\\d{1,4}(?:\\/[^,\\[]*)?[, -]*$/.test(clean.slice(0,stC).trim()))){tj=JSON.parse(clean.slice(stC));}else if(clean.indexOf(":")!==-1){try{tj=JSON.parse("{"+clean+"}");}catch(e1){try{tj=JSON.parse("{"+clean.replace(/^([a-zA-Z0-9_.-]+)\\s*:/,T_DQ+"$1"+T_DQ+":")+"}");}catch(e2){}}}}catch(e3){}}' +
            'var kv=(!apiS&&!jsS)?clean.match(/^([\\w.$\\[\\]]+)\\s*(>=|<=|>|<|==|=)\\s*(.+)$/):null;' +
            'var re=null;if(tCfg.matchMode==="regex"){try{var rmm=clean.match(/^\\/(.+)\\/([gimsuy]*)$/);if(rmm){var rfl=rmm[2]||"";if(!tCfg.caseSensitive&&rfl.indexOf("i")===-1)rfl+="i";re=new RegExp(rmm[1],rfl);}else{re=new RegExp(raw,tCfg.caseSensitive?"":"i");}}catch(e4){}}' +
            'var c0=clean.charAt(0),cL=clean.charAt(clean.length-1);' +
            'var unq=(clean.indexOf(":")===-1&&((c0===T_DQ&&cL===T_DQ)||(c0===T_SQ&&cL===T_SQ))&&clean.length>=4)?clean.slice(1,-1).trim():"";' +
            'var cns=tStripWs(clean);var tjS=tj?JSON.stringify(tj):"";' +
            'var nd=tCfg.caseSensitive?clean:clean.toLowerCase(),cnsL=tCfg.caseSensitive?cns:cns.toLowerCase();' +
            'if(kv||tj||apiS||jsS)tHasJsonOrKv=true;' +
            'if(cnsL&&cnsL!==nd)tHasWsRule=true;' +
            'tEntries.push({raw:raw,clean:clean,needle:nd,cns:cnsL,unq:tCfg.caseSensitive?unq:unq.toLowerCase(),tj:tj,tjC:tCfg.caseSensitive?tjS:tjS.toLowerCase(),kv:kv,apiS:apiS,jsS:jsS,re:re});' +
          '}' +
        '}' +
        'function tFastMp(u8){' +
          'var dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),o=0,end=u8.length;' +
          'function rS(n){if(n<0||o+n>end)throw 1;var sl=u8.subarray(o,o+n);o+=n;if(!fastDec&&typeof TextDecoder!=="undefined")fastDec=new TextDecoder("utf-8",{fatal:false});return fastDec?fastDec.decode(sl):"";}' +
          'function rU64(sg){if(o+8>end)throw 1;var hi=sg?dv.getInt32(o):dv.getUint32(o),lo=dv.getUint32(o+4);o+=8;var v=hi*4294967296+lo;return Number.isSafeInteger(v)?v:String(v);}' +
          'function sk(n){if(n<0||o+n>end)throw 1;o+=n;return "";}' +
          'function r(dp){' +
            'if(o>=end||dp>10)throw 1;var b=u8[o++];' +
            'if(b<=0x7f)return b;if(b>=0xe0)return b-256;' +
            'if(b>=0x80&&b<=0x8f){var l=b&0xf,m={};for(var i=0;i<l;i++){var k=r(dp+1);m[k]=r(dp+1);}return m;}' +
            'if(b>=0x90&&b<=0x9f){var al=b&0xf,a=[];for(var j=0;j<al;j++)a.push(r(dp+1));return a;}' +
            'if(b>=0xa0&&b<=0xbf)return rS(b&0x1f);' +
            'if(b===0xc0)return null;if(b===0xc2)return false;if(b===0xc3)return true;' +
            'if(b===0xc4&&o<end)return sk(u8[o++]);' +
            'if(b===0xc5&&o+2<=end){var b2=dv.getUint16(o);o+=2;return sk(b2);}' +
            'if(b===0xc6&&o+4<=end){var b4=dv.getUint32(o);o+=4;return sk(b4);}' +
            'if(b===0xc7&&o+2<=end){var e1=u8[o++];o+=1;return sk(e1);}' +
            'if(b===0xc8&&o+3<=end){var e2=dv.getUint16(o);o+=3;return sk(e2);}' +
            'if(b===0xc9&&o+5<=end){var e4=dv.getUint32(o);o+=5;return sk(e4);}' +
            'if(b===0xcc&&o<end)return u8[o++];' +
            'if(b===0xcd&&o+2<=end){var v1=dv.getUint16(o);o+=2;return v1;}' +
            'if(b===0xce&&o+4<=end){var v2=dv.getUint32(o);o+=4;return v2;}' +
            'if(b===0xcf)return rU64(false);' +
            'if(b===0xd0&&o<end)return dv.getInt8(o++);' +
            'if(b===0xd1&&o+2<=end){var v3=dv.getInt16(o);o+=2;return v3;}' +
            'if(b===0xd2&&o+4<=end){var v4=dv.getInt32(o);o+=4;return v4;}' +
            'if(b===0xd3)return rU64(true);' +
            'if(b===0xd4)return sk(2);if(b===0xd5)return sk(3);if(b===0xd6)return sk(5);if(b===0xd7)return sk(9);if(b===0xd8)return sk(17);' +
            'if(b===0xca&&o+4<=end){var f1=dv.getFloat32(o);o+=4;return f1;}' +
            'if(b===0xcb&&o+8<=end){var f2=dv.getFloat64(o);o+=8;return f2;}' +
            'if(b===0xd9&&o<end)return rS(u8[o++]);' +
            'if(b===0xda&&o+2<=end){var s2=dv.getUint16(o);o+=2;return rS(s2);}' +
            'if(b===0xdb&&o+4<=end){var s4=dv.getUint32(o);o+=4;return rS(s4);}' +
            'if(b===0xdc&&o+2<=end){var l2=dv.getUint16(o);o+=2;var a2=[];for(var c=0;c<l2;c++)a2.push(r(dp+1));return a2;}' +
            'if(b===0xdd&&o+4<=end){var l4=dv.getUint32(o);o+=4;if(l4>4096)throw 1;var a4=[];for(var c4=0;c4<l4;c4++)a4.push(r(dp+1));return a4;}' +
            'if(b===0xde&&o+2<=end){var m2=dv.getUint16(o);o+=2;var mp={};for(var p=0;p<m2;p++){var ky=r(dp+1);mp[ky]=r(dp+1);}return mp;}' +
            'if(b===0xdf&&o+4<=end){var m4=dv.getUint32(o);o+=4;if(m4>4096)throw 1;var mp4={};for(var p4=0;p4<m4;p4++){var ky4=r(dp+1);mp4[ky4]=r(dp+1);}return mp4;}' +
            'throw 1;' +
          '}' +
          'try{var val=r(0);return (o===end&&val&&typeof val==="object")?val:null;}catch(e){return null;}' +
        '}' +
        'var _infLB=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];' +
        'var _infLE=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];' +
        'var _infDB=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];' +
        'var _infDE=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];' +
        'var _infCL=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];' +
        'function tInflateSync(src){' +
          'try{' +
            'if(!src||src.length<2||src.length>24576)return null;' +
            'var pos=0,end=src.length;' +
            'if((src[0]&0x0f)===8&&((src[0]<<8)|src[1])%31===0){pos=(src[1]&0x20)?6:2;}' +
            'var bb=0,bc=0,out=new Uint8Array(Math.min(65536,Math.max(256,end*6))),oi=0;' +
            'function bits(n){while(bc<n){if(pos>=end)throw 1;bb|=src[pos++]<<bc;bc+=8;}var v=bb&((1<<n)-1);bb>>>=n;bc-=n;return v;}' +
            'function grow(need){if(oi+need<=out.length)return;if(oi+need>65536)throw 1;var nb=new Uint8Array(Math.min(65536,Math.max(out.length*2,oi+need)));nb.set(out.subarray(0,oi));out=nb;}' +
            'function mkT(lens,num){' +
              'var cnt=new Int32Array(16),offs=new Int32Array(16),syms=new Int32Array(num),mx=0;' +
              'for(var i=0;i<num;i++){var l=lens[i];if(l){cnt[l]++;if(l>mx)mx=l;}}' +
              'if(!mx)return null;' +
              'var left=1;for(var b=1;b<=mx;b++){left<<=1;left-=cnt[b];if(left<0)throw 1;}' +
              'for(var j=1;j<15;j++)offs[j+1]=offs[j]+cnt[j];' +
              'for(var s=0;s<num;s++){var sl=lens[s];if(sl)syms[offs[sl]++]=s;}' +
              'return {cnt:cnt,syms:syms,mx:mx};' +
            '}' +
            'function decS(tr){' +
              'var code=0,first=0,idx=0,cnt=tr.cnt;' +
              'for(var l=1;l<=tr.mx;l++){code|=bits(1);var c=cnt[l];if(code-c<first)return tr.syms[idx+(code-first)];idx+=c;first+=c;first<<=1;code<<=1;}' +
              'throw 1;' +
            '}' +
            'var fxLit=null,fxDist=null;' +
            'function getFx(){' +
              'if(fxLit)return;' +
              'var ll=new Uint8Array(288),dl=new Uint8Array(32);' +
              'for(var i=0;i<=143;i++)ll[i]=8;for(var i=144;i<=255;i++)ll[i]=9;for(var i=256;i<=279;i++)ll[i]=7;for(var i=280;i<=287;i++)ll[i]=8;' +
              'for(var i=0;i<32;i++)dl[i]=5;' +
              'fxLit=mkT(ll,288);fxDist=mkT(dl,32);' +
            '}' +
            'var bfin=0;' +
            'while(!bfin){' +
              'bfin=bits(1);var bt=bits(2);' +
              'if(bt===0){' +
                'bb=0;bc=0;if(pos+4>end)throw 1;' +
                'var ln0=src[pos]|(src[pos+1]<<8),nln0=src[pos+2]|(src[pos+3]<<8);pos+=4;' +
                'if((ln0^0xffff)!==nln0||pos+ln0>end)throw 1;' +
                'grow(ln0);out.set(src.subarray(pos,pos+ln0),oi);oi+=ln0;pos+=ln0;' +
              '}else if(bt===1||bt===2){' +
                'var lt,dt;' +
                'if(bt===1){getFx();lt=fxLit;dt=fxDist;}else{' +
                  'var hlit=bits(5)+257,hdist=bits(5)+1,hclen=bits(4)+4;' +
                  'var cll=new Uint8Array(19);for(var ci=0;ci<hclen;ci++)cll[_infCL[ci]]=bits(3);' +
                  'var ct=mkT(cll,19),lens=new Uint8Array(hlit+hdist),li=0;' +
                  'while(li<hlit+hdist){' +
                    'var sy=decS(ct);' +
                    'if(sy<16){lens[li++]=sy;}else{' +
                      'var rp=0,vl=0;' +
                      'if(sy===16){if(!li)throw 1;vl=lens[li-1];rp=3+bits(2);}else if(sy===17){rp=3+bits(3);}else{rp=11+bits(7);}' +
                      'while(rp--){if(li>=hlit+hdist)throw 1;lens[li++]=vl;}' +
                    '}' +
                  '}' +
                  'lt=mkT(lens.subarray(0,hlit),hlit);dt=mkT(lens.subarray(hlit),hdist);' +
                '}' +
                'for(;;){' +
                  'var sym=decS(lt);' +
                  'if(sym<256){grow(1);out[oi++]=sym;}' +
                  'else if(sym===256){break;}' +
                  'else{' +
                    'var li2=sym-257;if(li2>28)throw 1;' +
                    'var clen=_infLB[li2]+(_infLE[li2]?bits(_infLE[li2]):0);' +
                    'var dsym=decS(dt);if(dsym>29)throw 1;' +
                    'var dist=_infDB[dsym]+(_infDE[dsym]?bits(_infDE[dsym]):0);' +
                    'if(dist>oi)throw 1;grow(clen);' +
                    'for(var k=0;k<clen;k++){out[oi]=out[oi-dist];oi++;}' +
                  '}' +
                '}' +
              '}else{throw 1;}' +
            '}' +
            'return out.subarray(0,oi);' +
          '}catch(e){return null;}' +
        '}' +
        'function tFastSfs2x(u8){' +
          'try{' +
            'if(!u8||u8.length<3)return null;' +
            'var buf=u8;' +
            'if((u8[0]&0x80)!==0&&u8.length>=4){' +
              'var comp=(u8[0]&0x20)!==0;' +
              'var hl=(u8[0]&0x08)!==0?5:3;' +
              'if(u8.length<=hl)return null;' +
              'buf=u8.subarray(hl);' +
              'if(comp||(buf.length>2&&buf[0]===0x78)){var inf=tInflateSync(buf);if(!inf)return null;buf=inf;}' +
            '}else if(u8.length>2&&u8[0]===0x78&&(u8[1]===0x9c||u8[1]===0xda||u8[1]===0x01||u8[1]===0x5e)){' +
              'var inf2=tInflateSync(u8);if(inf2)buf=inf2;' +
            '}' +
            'if(buf.length<3||buf[0]!==0x12)return null;' +
            'var dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength),p={i:1},n=buf.length;' +
            'function rS(l){if(l<0||p.i+l>n)throw 1;var sl=buf.subarray(p.i,p.i+l);p.i+=l;if(!fastDec&&typeof TextDecoder!=="undefined")fastDec=new TextDecoder("utf-8",{fatal:false});return fastDec?fastDec.decode(sl):"";}' +
            'function rI64(o){if(o+8>n)throw 1;var hi=dv.getInt32(o,false),lo=dv.getUint32(o+4,false);var v=hi*4294967296+lo;return Number.isSafeInteger(v)?v:String(v);}' +
            'function pV(t,dp){' +
              'if(dp>14)throw 1;' +
              'switch(t){' +
                'case 0:return null;case 1:return buf[p.i++]!==0;case 2:return dv.getInt8(p.i++);' +
                'case 3:var v3=dv.getInt16(p.i,false);p.i+=2;return v3;case 4:var v4=dv.getInt32(p.i,false);p.i+=4;return v4;' +
                'case 5:var v5=rI64(p.i);p.i+=8;return v5;' +
                'case 6:var f4=dv.getFloat32(p.i,false);p.i+=4;return Math.round(f4*10000)/10000;' +
                'case 7:var f8=dv.getFloat64(p.i,false);p.i+=8;return Math.round(f8*10000)/10000;' +
                'case 8:var l8=dv.getUint16(p.i,false);p.i+=2;return rS(l8);' +
                'case 9:var n9=dv.getUint16(p.i,false);p.i+=2;var a9=[];for(var i9=0;i9<n9&&p.i<n;i9++)a9.push(buf[p.i++]!==0);return a9;' +
                'case 10:var l10=dv.getInt32(p.i,false);p.i+=4;if(l10<0||p.i+l10>n){p.i=n;return null;}var s10=buf.subarray(p.i,p.i+l10);p.i+=l10;if(l10>2&&s10[0]===0x12){var ns=tFastSfs2x(s10);if(ns)return ns;}return "<bytes:"+l10+">";' +
                'case 11:var n11=dv.getUint16(p.i,false);p.i+=2;var a11=[];for(var i11=0;i11<n11&&p.i+2<=n;i11++){a11.push(dv.getInt16(p.i,false));p.i+=2;}return a11;' +
                'case 12:var n12=dv.getUint16(p.i,false);p.i+=2;var a12=[];for(var i12=0;i12<n12&&p.i+4<=n;i12++){a12.push(dv.getInt32(p.i,false));p.i+=4;}return a12;' +
                'case 13:var n13=dv.getUint16(p.i,false);p.i+=2;var a13=[];for(var i13=0;i13<n13&&p.i+8<=n;i13++){a13.push(rI64(p.i));p.i+=8;}return a13;' +
                'case 14:var n14=dv.getUint16(p.i,false);p.i+=2;var a14=[];for(var i14=0;i14<n14&&p.i+4<=n;i14++){a14.push(Math.round(dv.getFloat32(p.i,false)*10000)/10000);p.i+=4;}return a14;' +
                'case 15:var n15=dv.getUint16(p.i,false);p.i+=2;var a15=[];for(var i15=0;i15<n15&&p.i+8<=n;i15++){a15.push(Math.round(dv.getFloat64(p.i,false)*10000)/10000);p.i+=8;}return a15;' +
                'case 16:var n16=dv.getUint16(p.i,false);p.i+=2;var a16=[];for(var i16=0;i16<n16&&p.i+2<=n;i16++){var sl6=dv.getUint16(p.i,false);p.i+=2;a16.push(rS(sl6));}return a16;' +
                'case 17:var n17=dv.getUint16(p.i,false);p.i+=2;var a17=[];for(var i17=0;i17<n17&&p.i<n;i17++){a17.push(pV(buf[p.i++],dp+1));}return a17;' +
                'case 18:var n18=dv.getUint16(p.i,false);p.i+=2;var o18={};for(var i18=0;i18<n18&&p.i+2<=n;i18++){var kl=dv.getUint16(p.i,false);p.i+=2;var ky=rS(kl);if(p.i>=n)break;o18[ky]=pV(buf[p.i++],dp+1);}return o18;' +
                'case 19:var l19=dv.getUint16(p.i,false);p.i+=2;return rS(l19);' +
                'case 20:var l20=dv.getInt32(p.i,false);p.i+=4;return l20>0?rS(l20):"";' +
                'default:throw 1;' +
              '}' +
            '}' +
            'return pV(18,0);' +
          '}catch(e){return null;}' +
        '}' +
        'function tFastPb(u8,dp){' +
          'try{' +
            'if(!u8||u8.length<2||(dp||0)>4)return null;' +
            'var dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),o=0,end=u8.length,out={},cnt=0,good=0;' +
            'function vi(){var lo=0,hi=0,sh=0;for(var c=0;c<10;c++){if(o>=end)return null;var b=u8[o++];if(sh<28)lo|=(b&0x7f)<<sh;else hi|=(b&0x7f)<<(sh-28);if((b&0x80)===0){if(hi===0)return lo>>>0;var bg=hi*268435456+(lo>>>0);return Number.isSafeInteger(bg)?bg:String(bg);}sh+=7;}return null;}' +
            'while(o<end&&cnt<64){' +
              'var tg=vi();if(typeof tg!=="number"||tg<=0)return null;' +
              'var wt=tg&7,fn=tg>>>3;if(fn<=0||fn>50000)return null;' +
              'var ky="f"+fn,vl;' +
              'if(wt===0){vl=vi();if(vl===null)return null;}' +
              'else if(wt===1){if(o+8>end)return null;var f64=dv.getFloat64(o,true);o+=8;if(Number.isFinite(f64)&&(f64===0||(Math.abs(f64)>=1e-5&&Math.abs(f64)<1e9))){vl=Math.round(f64*100000)/100000;good++;}else vl="<i64>";}' +
              'else if(wt===2){var ln=vi();if(typeof ln!=="number"||ln<0||o+ln>end)return null;var sb=u8.subarray(o,o+ln);o+=ln;var ns=ln>=3?tFastPb(sb,(dp||0)+1):null;if(ns){vl=ns;good++;}else{if(!fastDec&&typeof TextDecoder!=="undefined")fastDec=new TextDecoder("utf-8",{fatal:false});vl=fastDec?fastDec.decode(sb):"";if(vl)good++;}}' +
              'else if(wt===5){if(o+4>end)return null;var f32=dv.getFloat32(o,true);o+=4;vl=(Number.isFinite(f32)&&(f32===0||(Math.abs(f32)>=1e-5&&Math.abs(f32)<1e8)))?Math.round(f32*10000)/10000:dv.getInt32(o-4,true);}' +
              'else return null;' +
              'out[ky]=vl;cnt++;' +
            '}' +
            'return (o===end&&cnt>0&&((dp||0)>0||good>0||cnt>=2))?out:null;' +
          '}catch(e){return null;}' +
        '}' +
        'function tEvalKvVal(v,kv){' +
          'if(v===undefined)return false;' +
          'var op=kv[2],ne=tParseNum(kv[3]);' +
          'if(op===">="||op==="<="||op===">"||op==="<"){' +
            'var nv=tParseNum(v);if(isNaN(nv)||isNaN(ne))return false;' +
            'if(op===">=")return nv>=ne;if(op==="<=")return nv<=ne;if(op===">")return nv>ne;return nv<ne;' +
          '}' +
          'var rv=kv[3].trim();' +
          'if(rv.length>=2&&((rv.charAt(0)===T_DQ&&rv.charAt(rv.length-1)===T_DQ)||(rv.charAt(0)===T_SQ&&rv.charAt(rv.length-1)===T_SQ)))rv=rv.slice(1,-1);' +
          'if(tCfg.caseSensitive?String(v)===rv:String(v).toLowerCase()===rv.toLowerCase())return true;' +
          'var nv2=tParseNum(v);return !isNaN(nv2)&&!isNaN(ne)&&nv2===ne;' +
        '}' +
        'function tIsWCh(ch){return !!ch&&((ch>="a"&&ch<="z")||(ch>="A"&&ch<="Z")||(ch>="0"&&ch<="9")||ch==="_");}' +
        'function tEvalKvText(kv,str){' +
          'if(!kv||!str)return false;' +
          'var pkRaw=kv[1].split(".").pop(),pk=tCfg.caseSensitive?pkRaw:pkRaw.toLowerCase(),lc=tCfg.caseSensitive?str:str.toLowerCase(),idx=lc.indexOf(pk);' +
          'while(idx!==-1){' +
            'var after=idx+pk.length,bCh=idx>0?lc.charAt(idx-1):"",c=lc.charAt(after);' +
            'if(!tIsWCh(bCh)&&(c===T_DQ||c===T_SQ||c===":"||c==="="||c===" ")){' +
              'var rest=str.slice(after,after+40);' +
              'var sepI=-1;' +
              'for(var si=0;si<rest.length;si++){var ch=rest.charAt(si);if(ch===":"||ch==="="){sepI=si+1;break;}if(ch!==T_DQ&&ch!==T_SQ&&ch!==" "&&ch!=="\\t"){break;}}' +
              'if(sepI!==-1){' +
                'var valStr=rest.slice(sepI).trim();' +
                'var endI=valStr.length;' +
                'for(var vi=0;vi<valStr.length;vi++){var vc=valStr.charAt(vi);if(vc===","||vc==="}"||vc==="]"||vc===" "||vc===";"){if(vi>0){endI=vi;break;}}}' +
                'var tok=valStr.slice(0,endI).trim();' +
                'if(tok&&tEvalKvVal(tok,kv))return true;' +
              '}' +
            '}' +
            'idx=lc.indexOf(pk,idx+1);' +
          '}' +
          'return false;' +
        '}' +
        'function turboMatchObj(parsed){' +
          'if(!parsed||typeof parsed!=="object"||!tEntries.length)return null;' +
          'for(var i=0;i<tEntries.length;i++){' +
            'var e=tEntries[i];' +
            'if(e.kv){var v=tLookup(parsed,e.kv[1]);if(tEvalKvVal(v,e.kv))return e.raw;}' +
            'if(e.tj&&tJsonMatch(parsed,e.tj,0))return e.raw;' +
          '}' +
          'return null;' +
        '}' +
        'function tSliceBalancedJson(str,si){' +
          'if(!str||si<0||si>=str.length)return null;' +
          'var opn=str.charAt(si),cls=opn==="{"?"}":(opn==="["?"]":"");' +
          'if(!cls)return null;' +
          'var dp=0,inStr=false,esc=false,lim=Math.min(str.length,si+20000);' +
          'for(var i=si;i<lim;i++){' +
            'var c=str.charAt(i);' +
            'if(inStr){if(esc){esc=false;continue;}if(c===T_BS){esc=true;continue;}if(c===T_DQ)inStr=false;continue;}' +
            'if(c===T_DQ){inStr=true;continue;}' +
            'if(c===opn)dp++;else if(c===cls){dp--;if(dp===0)return str.slice(si,i+1);}' +
          '}' +
          'return null;' +
        '}' +
        'function turboMatchStr(str){' +
          'if(!str||!tEntries.length)return null;' +
          'var hs=null,unescHs=null,rawNs=null,parsed=null,compHs=null,didParse=false;' +
          'function getHs(){if(hs===null)hs=tCfg.caseSensitive?str:str.toLowerCase();return hs;}' +
          'function getUnescHs(){if(unescHs===null){var b=getHs();unescHs=b.indexOf(T_BS+T_DQ)!==-1?b.split(T_BS+T_DQ).join(T_DQ):"";}return unescHs;}' +
          'function getRawNs(){if(rawNs===null)rawNs=tStripWs(getHs());return rawNs;}' +
            'function getParsed(){' +
              'if(didParse)return parsed;didParse=true;' +
              'var cleanSrc=str.indexOf(String.fromCharCode(30))!==-1?str.split(String.fromCharCode(30)).join(" ").trim():str;' +
              'var ib=cleanSrc.indexOf("{"),ia=cleanSrc.indexOf("["),cands=[];' +
              'if(ib>=0)cands.push(ib);if(ia>=0&&ia!==ib)cands.push(ia);' +
              'if(cands.length===2&&cands[1]<cands[0]){var sw=cands[0];cands[0]=cands[1];cands[1]=sw;}' +
              'for(var ci=0;ci<cands.length;ci++){' +
                'var sub=cleanSrc.slice(cands[ci]);' +
                'try{parsed=JSON.parse(sub);return parsed;}catch(ep){' +
                  'var bal=tSliceBalancedJson(sub,0);' +
                  'if(bal){try{parsed=JSON.parse(bal);return parsed;}catch(epB){}}' +
                '}' +
              '}' +
              'if(cleanSrc.indexOf(String.fromCharCode(10))!==-1){' +
                'var lines=cleanSrc.split(String.fromCharCode(10));' +
                'for(var li=0;li<lines.length;li++){var lt=lines[li].trim();if(lt.charAt(0)==="{"||lt.charAt(0)==="["){try{var lp=JSON.parse(lt);if(lp&&typeof lp==="object"){parsed=lp;return parsed;}}catch(ep2){var balL=tSliceBalancedJson(lt,0);if(balL){try{var lp2=JSON.parse(balL);if(lp2&&typeof lp2==="object"){parsed=lp2;return parsed;}}catch(ep3){}}}}}' +
              '}' +
              'return null;' +
            '}' +
          'function getCompHs(){if(compHs===null){var p=getParsed();if(p){try{var cp=JSON.stringify(p);compHs=tCfg.caseSensitive?cp:cp.toLowerCase();}catch(ec){compHs="";}}else compHs="";}return compHs;}' +
          'if(tCfg.matchMode==="contains"){' +
            'var hsF=getHs(),uHsF=getUnescHs();' +
            'for(var f=0;f<tEntries.length;f++){' +
              'var ef=tEntries[f];' +
              'if(!ef.kv){' +
                'if(hsF.indexOf(ef.needle)!==-1||(uHsF&&uHsF.indexOf(ef.needle)!==-1))return ef.raw;' +
                'if(ef.unq&&(hsF.indexOf(ef.unq)!==-1||(uHsF&&uHsF.indexOf(ef.unq)!==-1)))return ef.raw;' +
              '}' +
            '}' +
            'if(!tHasJsonOrKv){' +
              'if(!tHasWsRule)return null;' +
              'var rnsF=getRawNs();' +
              'for(var fw=0;fw<tEntries.length;fw++){var ew=tEntries[fw];if(ew.cns&&rnsF.indexOf(ew.cns)!==-1)return ew.raw;}' +
              'return null;' +
            '}' +
            'for(var f2=0;f2<tEntries.length;f2++){' +
              'var ef2=tEntries[f2];' +
              'if(!ef2.kv&&!ef2.tj&&ef2.cns&&ef2.cns!==ef2.needle&&getRawNs().indexOf(ef2.cns)!==-1)return ef2.raw;' +
            '}' +
          '}' +
          'var pObjOnce=(tHasJsonOrKv&&tCfg.matchMode!=="regex"&&tCfg.matchMode!=="exact")?getParsed():null;' +
          'if(pObjOnce){var omOnce=turboMatchObj(pObjOnce);if(omOnce)return omOnce;}' +
          'for(var i=0;i<tEntries.length;i++){' +
            'var e=tEntries[i];' +
            'if(tCfg.matchMode==="regex"){' +
              'if(e.re&&(e.re.test(str)||(tHasJsonOrKv&&getCompHs()&&e.re.test(getCompHs()))))return e.raw;' +
            '}else if(tCfg.matchMode==="exact"){' +
              'var stTrim=str.trim(),stHs=getHs().trim();' +
              'if(stTrim===e.raw||stTrim===e.clean||stHs===e.needle)return e.raw;' +
              'if(e.tjC&&getCompHs()===e.tjC)return e.raw;' +
              'if(e.unq&&stHs===e.unq)return e.raw;' +
            '}else{' +
              'if(e.apiS){if(getHs().indexOf(e.apiS.pN)!==-1){if(e.apiS.cKv){if(pObjOnce&&tEvalKvVal(tLookup(pObjOnce,e.apiS.cKv[1]),e.apiS.cKv))return e.raw;if(tEvalKvText(e.apiS.cKv,str))return e.raw;}else if(getHs().indexOf(e.apiS.cN)!==-1)return e.raw;}continue;}' +
              'if(e.jsS){if(getHs().indexOf(e.jsS.eN)!==-1){if(e.jsS.cKv){if(pObjOnce&&tEvalKvVal(tLookup(pObjOnce,e.jsS.cKv[1]),e.jsS.cKv))return e.raw;if(tEvalKvText(e.jsS.cKv,str))return e.raw;}else if(getHs().indexOf(e.jsS.cN)!==-1)return e.raw;}continue;}' +
              'if(e.kv){if(tEvalKvText(e.kv,str))return e.raw;continue;}' +
              'if(pObjOnce&&e.tj)continue;' +
              'var uHsG=getUnescHs();' +
              'if(getHs().indexOf(e.needle)!==-1||(uHsG&&uHsG.indexOf(e.needle)!==-1))return e.raw;' +
              'if(e.cns&&e.cns!==e.needle&&getRawNs().indexOf(e.cns)!==-1)return e.raw;' +
              'if(tHasJsonOrKv){var ch=getCompHs();if(ch&&(ch.indexOf(e.needle)!==-1||(e.cns&&ch.indexOf(e.cns)!==-1)||(e.tjC&&ch.indexOf(e.tjC)!==-1)))return e.raw;}' +
              'if(e.unq&&(getHs().indexOf(e.unq)!==-1||(uHsG&&uHsG.indexOf(e.unq)!==-1)))return e.raw;' +
            '}' +
          '}' +
          'return null;' +
        '}' +
        'var tInsp={enabled:false,kws:[],rxs:[],jps:[]};' +
        'function tTokJp(expr){' +
          'var s=String(expr||"").trim();if(s.charAt(0)==="$")s=s.slice(1);' +
          'var toks=[],pos=0;' +
          'function isIc(c){return (c>=48&&c<=57)||(c>=65&&c<=90)||(c>=97&&c<=122)||c===95||c===42||c===45;}' +
          'while(pos<s.length){' +
            'if(s.charAt(pos)==="."&&s.charAt(pos+1)==="."){' +
              'pos+=2;var st=pos;while(pos<s.length&&isIc(s.charCodeAt(pos)))pos++;if(pos===st)return [];toks.push({k:"rec",v:s.slice(st,pos)});' +
            '}else if(s.charAt(pos)==="."){' +
              'pos+=1;var st2=pos;while(pos<s.length&&isIc(s.charCodeAt(pos)))pos++;if(pos===st2)return [];var ky=s.slice(st2,pos);toks.push(ky==="*"?{k:"wc"}:{k:"child",v:ky});' +
            '}else if(s.charAt(pos)==="["){' +
              'var eb=s.indexOf("]",pos+1);if(eb===-1)return [];var inn=s.slice(pos+1,eb).trim();' +
              'if(inn==="*"){toks.push({k:"wc"});}' +
              'else if((inn.charAt(0)===T_DQ&&inn.charAt(inn.length-1)===T_DQ)||(inn.charAt(0)===T_SQ&&inn.charAt(inn.length-1)===T_SQ)){toks.push({k:"child",v:inn.slice(1,-1)});}' +
              'else{var ix=parseInt(inn,10);if(isNaN(ix))return [];toks.push({k:"idx",v:ix});}' +
              'pos=eb+1;' +
            '}else{return [];}' +
          '}' +
          'return toks;' +
        '}' +
        'function tWalkRec(node,tKey,out){' +
          'if(Array.isArray(node)){for(var i=0;i<node.length;i++)tWalkRec(node[i],tKey,out);}' +
          'else if(node!==null&&typeof node==="object"){' +
            'var ks=Object.keys(node);' +
            'for(var j=0;j<ks.length;j++){var k=ks[j];if(tKey==="*"||k===tKey)out.push(node[k]);tWalkRec(node[k],tKey,out);}' +
          '}' +
        '}' +
        'function tEvalJp(data,expr){' +
          'var toks=tTokJp(expr);if(!toks.length&&String(expr||"").trim()!=="$")return [];' +
          'var cur=[data];' +
          'for(var t=0;t<toks.length;t++){' +
            'var tk=toks[t],nx=[];' +
            'if(tk.k==="child"){for(var i=0;i<cur.length;i++){var n=cur[i];if(n!==null&&typeof n==="object"&&!Array.isArray(n)&&Object.prototype.hasOwnProperty.call(n,tk.v))nx.push(n[tk.v]);}}' +
            'else if(tk.k==="idx"){for(var i2=0;i2<cur.length;i2++){var n2=cur[i2];if(Array.isArray(n2)){var ix=tk.v<0?n2.length+tk.v:tk.v;if(ix>=0&&ix<n2.length)nx.push(n2[ix]);}}}' +
            'else if(tk.k==="wc"){for(var i3=0;i3<cur.length;i3++){var n3=cur[i3];if(Array.isArray(n3)){for(var j=0;j<n3.length;j++)nx.push(n3[j]);}else if(n3!==null&&typeof n3==="object"){var ks=Object.keys(n3);for(var j2=0;j2<ks.length;j2++)nx.push(n3[ks[j2]]);}}}' +
            'else if(tk.k==="rec"){for(var i4=0;i4<cur.length;i4++)tWalkRec(cur[i4],tk.v,nx);}' +
            'cur=nx;if(!cur.length)break;' +
          '}' +
          'return cur;' +
        '}' +
        'function compileInsp(){' +
          'var kws=[],rxs=[],jps=[];' +
          'var rawK=String(tCfg.inspectorKeywords||"").split(String.fromCharCode(10)).join(",").split(String.fromCharCode(13)).join(",").split(",");' +
          'for(var i=0;i<rawK.length;i++){var ks=rawK[i].trim();if(ks)kws.push(ks);}' +
          'var rawR=String(tCfg.inspectorRegexes||"").split(String.fromCharCode(13)).join(String.fromCharCode(10)).split(String.fromCharCode(10));' +
          'for(var j=0;j<rawR.length;j++){var rs=rawR[j].trim();if(!rs)continue;try{rxs.push({raw:rs,re:new RegExp(rs,"i")});}catch(er){}}' +
          'var rawJ=String(tCfg.inspectorJsonPaths||"").split(String.fromCharCode(13)).join(String.fromCharCode(10)).split(String.fromCharCode(10));' +
          'for(var p=0;p<rawJ.length;p++){' +
            'var js=rawJ[p].trim();if(!js)continue;' +
            'if(js.charAt(0)==="{"){try{var ob=JSON.parse(js);if(ob&&typeof ob.path==="string"&&ob.path.trim()){var jr=null;if(typeof ob.regex==="string"&&ob.regex){try{jr=new RegExp(ob.regex,"i");}catch(er2){}}jps.push({path:ob.path.trim(),eq:ob.equals,hasEq:ob.equals!==undefined,rx:jr,rxRaw:ob.regex||""});}}catch(ej){}}' +
            'else{jps.push({path:js,hasEq:false,rx:null,rxRaw:""});}' +
          '}' +
          'tInsp={enabled:Boolean(tCfg.inspectorEnabled),kws:kws,rxs:rxs,jps:jps};' +
        '}' +
        'function tExtractRawStr(d,dec){' +
          'if(dec)return dec;' +
          'if(typeof d==="string")return d;' +
          'if(d&&(d instanceof ArrayBuffer||ArrayBuffer.isView(d))){' +
            'var u=d instanceof ArrayBuffer?new Uint8Array(d):new Uint8Array(d.buffer,d.byteOffset||0,d.byteLength!=null?d.byteLength:d.length);' +
            'var n=u.length;' +
            'if(n>0&&n<65536){' +
              'var sfs=tFastSfs2x(u);if(sfs){try{return JSON.stringify(sfs);}catch(esf){}}' +
              'if(u[0]===0x78&&(u[1]===0x9c||u[1]===0xda||u[1]===0x01||u[1]===0x5e)){var infZ=tInflateSync(u);if(infZ){var sfsZ=tFastSfs2x(infZ);if(sfsZ){try{return JSON.stringify(sfsZ);}catch(esz){}}if(!fastDec&&typeof TextDecoder!=="undefined")fastDec=new TextDecoder("utf-8",{fatal:false});if(fastDec)return fastDec.decode(infZ);}}' +
              'if(u[0]!==0x1f&&u[0]!==0x78){' +
                'if((u[0]>=0x80&&u[0]<=0x9f)||u[0]===0xdc||u[0]===0xdd||u[0]===0xde||u[0]===0xdf){var mp=tFastMp(u);if(mp){try{return JSON.stringify(mp);}catch(emp){}}}' +
                'var pb=tFastPb(u,0);if(pb){try{return JSON.stringify(pb);}catch(epb){}}' +
                'if(!fastDec&&typeof TextDecoder!=="undefined")fastDec=new TextDecoder("utf-8",{fatal:false});' +
                'if(fastDec)return fastDec.decode(u);' +
              '}' +
            '}' +
          '}else if(d&&typeof d==="object"&&!(typeof Blob!=="undefined"&&d instanceof Blob)){try{return JSON.stringify(d);}catch(eo){}}' +
          'return "";' +
        '}' +
        'function tInspectRaw(d,dec){' +
          'if(!tInsp.enabled||(!tInsp.kws.length&&!tInsp.rxs.length&&!tInsp.jps.length))return {matched:false,reasons:[]};' +
          'var s=tExtractRawStr(d,dec);if(!s)return {matched:false,reasons:[]};' +
          'var parsed=null,searchable=s;' +
          'var ib=s.indexOf("{"),ia=s.indexOf("["),si=(ib>=0&&ia>=0)?Math.min(ib,ia):Math.max(ib,ia);' +
          'if(si>=0){try{parsed=JSON.parse(s.slice(si));searchable=JSON.stringify(parsed);}catch(e){var balI=tSliceBalancedJson(s,si);if(balI){try{parsed=JSON.parse(balI);searchable=JSON.stringify(parsed);}catch(e2){}}}}' +
          'var reasons=[],lc=searchable.toLowerCase();' +
          'for(var i=0;i<tInsp.kws.length;i++){if(lc.indexOf(tInsp.kws[i].toLowerCase())!==-1)reasons.push("keyword:"+tInsp.kws[i]);}' +
          'for(var j=0;j<tInsp.rxs.length;j++){if(tInsp.rxs[j].re.test(searchable))reasons.push("regex:"+tInsp.rxs[j].raw);}' +
          'if(parsed!==null){' +
            'for(var p=0;p<tInsp.jps.length;p++){' +
              'var rl=tInsp.jps[p];' +
              'try{' +
                'var vals=tEvalJp(parsed,rl.path);' +
                'if(rl.hasEq){if(vals.some(function(v){return v===rl.eq;}))reasons.push("jsonpath:"+rl.path+"=="+String(rl.eq));}' +
                'else if(rl.rx){if(vals.some(function(v){return v!==null&&v!==undefined&&rl.rx.test(String(v));}))reasons.push("jsonpath:"+rl.path+"~="+rl.rxRaw);}' +
                'else if(vals.some(function(v){return v!==null&&v!==undefined;})){reasons.push("jsonpath:"+rl.path);}' +
              '}catch(ejp){}' +
            '}' +
          '}' +
          'return {matched:reasons.length>0,reasons:reasons};' +
        '}' +
        'var lastAttrCfg="",lastRoundUnlockSeq=Number(tCfg.roundUnlockSeq)||0;' +
        'function applyCfgObj(d){' +
          'if(!d||typeof d!=="object")return;' +
          'var prevTags=tCfg.tags+"|"+tCfg.matchMode+"|"+tCfg.caseSensitive;' +
          'var prevTagsOnly=String(tCfg.tags||"");' +
          'var prevHold=String(tCfg.holdEvents||"");' +
          'var prevInsp=(tCfg.inspectorEnabled?"1":"0")+"|"+String(tCfg.inspectorKeywords||"")+"|"+String(tCfg.inspectorRegexes||"")+"|"+String(tCfg.inspectorJsonPaths||"");' +
          'Object.assign(tCfg,d);' +
          'var unlockChanged=(typeof d.roundUnlockSeq==="number"&&d.roundUnlockSeq!==lastRoundUnlockSeq);' +
          'if(unlockChanged)lastRoundUnlockSeq=d.roundUnlockSeq;' +
          'if(!tCfg.armed||!tCfg.roundOnce||String(tCfg.tags||"")!==prevTagsOnly||unlockChanged){roundClickLocked=false;roundSawFlight=false;roundSawCrash=false;roundLastFlightAt=0;roundLockedId="";}' +
          'if((tCfg.tags+"|"+tCfg.matchMode+"|"+tCfg.caseSensitive)!==prevTags)compileTurbo();' +
          'if(String(tCfg.holdEvents||"")!==prevHold)compileHoldEvents();' +
          'var nextInsp=(tCfg.inspectorEnabled?"1":"0")+"|"+String(tCfg.inspectorKeywords||"")+"|"+String(tCfg.inspectorRegexes||"")+"|"+String(tCfg.inspectorJsonPaths||"");' +
          'if(nextInsp!==prevInsp)compileInsp();' +
        '}' +
        'function syncCfgAttr(){' +
          'try{var s=(CFG_SYM?window[CFG_SYM]:null)||window.__ttCfgStr||(document.documentElement&&document.documentElement.getAttribute?document.documentElement.getAttribute("data-tt-cfg"):null);if(typeof s==="string"&&s&&s!==lastAttrCfg){lastAttrCfg=s;applyCfgObj(JSON.parse(s));}}catch(e){}' +
        '}' +
        'function onPageCfg(ev){' +
          'try{var d=ev&&ev.detail;if(typeof d==="string"){lastAttrCfg=d;d=JSON.parse(d);}applyCfgObj(d);}catch(e){}' +
        '}' +
        'compileTurbo();' +
        'compileHoldEvents();' +
        'compileInsp();' +
        'syncCfgAttr();' +
        'function preWarmPageHit(force){' +
          'try{' +
            'var useLoc=Boolean(tCfg.hudHidden&&tCfg.localActive&&typeof tCfg.localX==="number"&&tCfg.localX>=0&&typeof tCfg.localY==="number"&&tCfg.localY>=0);' +
            'if(tCfg.hudHidden&&!useLoc)return;' +
            'var wx=useLoc?tCfg.localX:tCfg.x,wy=useLoc?tCfg.localY:tCfg.y;' +
            'if(typeof wx!=="number"||typeof wy!=="number"||wx<0||wy<0)return;' +
            'if(!force&&cachedHitEl&&cachedHitEl.isConnected&&cachedHitX===wx&&cachedHitY===wy)return;' +
            'cachedHitEl=null;' +
            'deepEl(document,wx,wy,false);' +
          '}catch(epw){}' +
        '}' +
        'setInterval(function(){if(tCfg.armed&&!document.hidden&&(!tCfg.hudHidden||tCfg.localActive))preWarmPageHit(false);},450);' +
        'setTimeout(function(){if(document.body&&tCfg.armed&&(!tCfg.hudHidden||tCfg.localActive))preWarmPageHit(false);},350);' +
        'document.addEventListener("__TT_PAGE_CFG__",function(ev){onPageCfg(ev);preWarmPageHit(false);});' +
        'window.addEventListener("__TT_PAGE_CFG__",function(ev){onPageCfg(ev);preWarmPageHit(false);});' +
        'function tQDeep(root,sel){' +
          'var out=[];' +
          'function walk(r){' +
            'if(!r||out.length>=400)return;' +
            'try{var ls=r.querySelectorAll(sel);for(var i=0;i<ls.length&&out.length<400;i++)out.push(ls[i]);}catch(e){}' +
            'try{var all=r.querySelectorAll("*");for(var j=0;j<all.length&&out.length<400;j++){if(all[j].shadowRoot)walk(all[j].shadowRoot);}}catch(e2){}' +
          '}' +
          'walk(root);return out;' +
        '}' +
        'function tIsNumPayout(s){' +
          'if(!s||s.length>24)return false;' +
          'var hasD=false,ok=true;' +
          'for(var i=0;i<s.length;i++){' +
            'var c=s.charCodeAt(i),ch=s.charAt(i);' +
            'if(c>=48&&c<=57){hasD=true;continue;}' +
            'if(ch==="."||ch===","||ch===" "||ch==="x"||ch==="X"||c===215||ch==="$"||ch==="€"||ch==="£"||c===8377||c===2547||c===8369||c===8362||c===8381||ch==="+"||ch==="%")continue;' +
            'ok=false;break;' +
          '}' +
          'return hasD&&ok;' +
        '}' +
        'function tIsAutoCashStr(txt,el){' +
          'var bt=String(txt||"").trim().toLowerCase().split(String.fromCharCode(10)).join(" ").split(String.fromCharCode(13)).join(" ");' +
          'while(bt.indexOf("  ")!==-1)bt=bt.split("  ").join(" ");' +
          'if(bt&&(bt.indexOf("auto cash")!==-1||bt.indexOf("autocash")!==-1||bt.indexOf("auto-cash")!==-1||bt.indexOf("auto_cash")!==-1||bt.indexOf("auto bet")!==-1||bt.indexOf("autobet")!==-1||bt.indexOf("অটো ক্যাশ")!==-1||bt.indexOf("অটো বাজি")!==-1||bt.indexOf("cashout at")!==-1||bt.indexOf("cash out at")!==-1))return true;' +
          'if(el&&el.nodeType===1){var tg=el.tagName;if(tg==="INPUT"){var tp=String(el.type||"").toLowerCase();if(tp==="checkbox"||tp==="radio"||tp==="number"||tp==="range")return true;}var rl=el.getAttribute&&el.getAttribute("role");if(rl==="switch"||rl==="checkbox")return true;var cs=String(el.className||"").toLowerCase();if(cs.indexOf("auto-cash")!==-1||cs.indexOf("autocash")!==-1||cs.indexOf("auto_cash")!==-1||cs.indexOf("switch")!==-1)return true;}' +
          'return false;' +
        '}' +
        'function tIsWrongBtnState(txt,dis,el){' +
          'if(dis)return true;' +
          'if(tIsAutoCashStr(txt,el))return true;' +
          'var bt=String(txt||"").trim().toLowerCase().split(String.fromCharCode(10)).join(" ").split(String.fromCharCode(13)).join(" ");' +
          'while(bt.indexOf("  ")!==-1)bt=bt.split("  ").join(" ");' +
          'if(!bt)return false;' +
          'var ind=String(tCfg.targetText||"").trim().toLowerCase();' +
          'if(ind==="বাজি"||ind==="bet"||ind.indexOf("place bet")===0)return false;' +
          'var btNs=bt.split(" ").join(""),indNs=ind.split(" ").join("");' +
          'var hasInd=Boolean(ind&&(bt.indexOf(ind)!==-1||(indNs&&btNs.indexOf(indNs)!==-1)));' +
          'var hasCash=hasInd||bt.indexOf("cash")!==-1||bt.indexOf("take")!==-1||bt.indexOf("collect")!==-1||bt.indexOf("claim")!==-1||bt.indexOf("withdraw")!==-1||bt.indexOf("sell")!==-1||bt.indexOf("payout")!==-1||bt.indexOf("redeem")!==-1||bt.indexOf("settle")!==-1||bt.indexOf("উত্তোলন")!==-1||bt.indexOf("ক্যাশ")!==-1||bt.indexOf("নিন")!==-1||bt.indexOf("তুলে")!==-1||bt.indexOf("সেল")!==-1||tIsNumPayout(bt);' +
          'var looksBet=bt==="বাজি"||bt==="bet"||bt.indexOf("bet ")===0||bt.indexOf("place bet")===0||bt.indexOf("cancel")!==-1||bt.indexOf("বাতিল")!==-1||bt.indexOf("অপেক্ষা")!==-1||bt==="wait"||bt.indexOf("waiting")!==-1||bt.indexOf("next round")!==-1;' +
          'return Boolean(looksBet&&!hasCash);' +
        '}' +
        'function tFindFallbackBtn(doc,x,y){' +
          'try{' +
            'var sel=String(tCfg.targetSelector||"").trim(),txt=String(tCfg.targetText||"").trim().toLowerCase();' +
            'var txtNs=txt.split(" ").join("");' +
            'var isOk=function(el){if(!el||!el.isConnected||el.id===HUD_ID||(el.closest&&el.closest("#"+HUD_ID))||el.tagName==="BODY"||el.tagName==="HTML"||el.tagName==="IFRAME"||tIsAutoCashStr("",el))return false;try{var cs=((doc&&doc.defaultView)?doc.defaultView:window).getComputedStyle(el);if(cs&&(cs.display==="none"||cs.visibility==="hidden"||cs.opacity==="0"))return false;}catch(ecs){}var r=el.getBoundingClientRect();return r.width>2&&r.height>2;};' +
            'var elNorm=function(el){return String(el.innerText||el.textContent||el.value||(el.getAttribute&&el.getAttribute("aria-label"))||"").trim().toLowerCase().split(String.fromCharCode(10)).join(" ");};' +
            'var matchesWant=function(bt){if(!txt)return true;if(!bt)return false;var btNs=bt.split(" ").join("");return bt.indexOf(txt)!==-1||(Boolean(txtNs)&&btNs.indexOf(txtNs)!==-1);};' +
            'var qBest=null,qDist=1e9,qIdeal=false;' +
            'if(sel){' +
              'var qList=tQDeep(doc,sel);' +
              'for(var qi=0;qi<qList.length;qi++){var qe=qList[qi];if(!isOk(qe))continue;var qr=qe.getBoundingClientRect();var qd=Math.hypot((qr.left+qr.width/2)-x,(qr.top+qr.height/2)-y);if(qd>360)continue;var qDis=Boolean(qe.disabled||(qe.getAttribute&&qe.getAttribute("aria-disabled")==="true"));var qTxt=elNorm(qe);var qWrong=tIsWrongBtnState(qTxt,qDis);var qWant=matchesWant(qTxt);var qOk=!qDis&&!qWrong&&qWant;var qScore=qd+(qDis?5000:0)+(qWrong?4000:0)+(qWant?0:2500);if(qScore<qDist){qDist=qScore;qBest=qe;qIdeal=qOk;}}' +
              'if(qBest&&qIdeal)return qBest;' +
            '}' +
            'var bestTxt=null,bd=1e9,bIdeal=false;' +
            'if(txt){' +
              'var bs=tQDeep(doc,"button,a,[role=button],input[type=button],input[type=submit],[onclick],[class*=btn],[class*=button]");' +
              'for(var i=0;i<bs.length;i++){var b=bs[i];if(!isOk(b))continue;var bt=elNorm(b);if(!bt||!matchesWant(bt))continue;var br=b.getBoundingClientRect();var d=Math.hypot((br.left+br.width/2)-x,(br.top+br.height/2)-y);if(d>520)continue;var bDis=Boolean(b.disabled||(b.getAttribute&&b.getAttribute("aria-disabled")==="true"));var bWrong=tIsWrongBtnState(bt,bDis);var okNow=!bDis&&!bWrong;var sc=d+(bDis?5000:0)+(bWrong?4000:0)+(bt===txt?0:40);if(sc<bd){bd=sc;bestTxt=b;bIdeal=okNow;}}' +
              'if(!bestTxt){' +
                'var ds=tQDeep(doc,"div,span");' +
                'for(var j=0;j<ds.length;j++){var de=ds[j];if(!isOk(de))continue;var dt=elNorm(de);if(!dt||dt.length>42||!matchesWant(dt))continue;var dr=de.getBoundingClientRect();if(dr.width>360||dr.height>140)continue;var d2=Math.hypot((dr.left+dr.width/2)-x,(dr.top+dr.height/2)-y);if(d2>420)continue;var dDis=Boolean(de.disabled||(de.getAttribute&&de.getAttribute("aria-disabled")==="true"));var dWrong=tIsWrongBtnState(dt,dDis);var okD=!dDis&&!dWrong;var sc2=d2+(dDis?5000:0)+(dWrong?4000:0)+(dt===txt?0:60);if(sc2<bd){bd=sc2;bestTxt=de;bIdeal=okD;}}' +
              '}' +
            '}' +
            'if(bestTxt&&bIdeal)return bestTxt;' +
            'if(qBest)return qBest;' +
            'if(bestTxt)return bestTxt;' +
          '}catch(e){}' +
          'return null;' +
        '}' +
        'var nextPid=10,tRetryTimer=0,tRetryObs=null;' +
        'function tMakeFpProfile(){' +
          'var a=0,b=0;' +
          'try{if(typeof crypto==="object"&&crypto&&typeof crypto.getRandomValues==="function"&&typeof Uint32Array==="function"){var u=new Uint32Array(2);crypto.getRandomValues(u);a=u[0]>>>0;b=u[1]>>>0;}}catch(ef){}' +
          'if(!a&&!b){var p=Math.floor((typeof performance!=="undefined"&&performance.now?performance.now():Date.now())*1000)>>>0;a=((Math.random()*0xffffffff)>>>0)^p;b=((Math.random()*0xffffffff)>>>0)^((Date.now()&0xffffffff)>>>0);}' +
          'var salt=((a^b)>>>0).toString(16);while(salt.length<8)salt="0"+salt;' +
          'var w=18+(b&0x0f),h=18+((b>>>4)&0x0f);' +
          'return {salt:salt,pid:100+(a%85000),w:w,h:h,rx:Math.round((w*0.5)*10)/10,ry:Math.round((h*0.5)*10)/10,pr:Number((0.68+(((b>>>8)&0xff)/255)*0.28).toFixed(3)),tx:(((b>>>16)&0x0f)%11)-5,ty:(((b>>>20)&0x0f)%11)-5,mx:(((b>>>24)&0x07)%5)-2,my:(((b>>>27)&0x07)%5)-2,rot:(a>>>16)&0x1f,dx:Number((((((a>>>8)&0xff)/255)-0.5)*0.68).toFixed(2)),dy:Number((((((a>>>20)&0xff)/255)-0.5)*0.68).toFixed(2))};' +
        '}' +
        'function tClearRetry(){if(tRetryTimer){clearTimeout(tRetryTimer);tRetryTimer=0;}if(tRetryObs){try{tRetryObs.disconnect();}catch(eo){}tRetryObs=null;}}' +
        'function tPickJitterPoint(doc,el,fx,fy){' +
          'var bx=Math.round(fx),by=Math.round(fy);' +
          'if(!tCfg.humanJitter||!el||!el.getBoundingClientRect)return {x:bx,y:by,jittered:false};' +
          'try{' +
            'var r=el.getBoundingClientRect();' +
            'if(!r||r.width<=4||r.height<=4)return {x:bx,y:by,jittered:false};' +
            'var vw=Math.max(10,(doc&&doc.defaultView&&doc.defaultView.innerWidth)||window.innerWidth||360);' +
            'var vh=Math.max(10,(doc&&doc.defaultView&&doc.defaultView.innerHeight)||window.innerHeight||640);' +
            'var isLgCan=el.tagName==="CANVAS"&&(r.width>160||r.height>100);' +
            'var jx=bx,jy=by;' +
            'if(isLgCan){' +
              'var rx=Math.min(6,Math.max(2,Math.floor(r.width*0.03))),ry=Math.min(5,Math.max(2,Math.floor(r.height*0.03)));' +
              'jx=Math.round(bx+((Math.random()+Math.random())-1)*rx);' +
              'jy=Math.round(by+((Math.random()+Math.random())-1)*ry);' +
            '}else{' +
              'var ix=r.width>14?Math.min(10,Math.max(2,r.width*0.16)):Math.max(1,r.width*0.12);' +
              'var iy=r.height>14?Math.min(8,Math.max(2,r.height*0.18)):Math.max(1,r.height*0.12);' +
              'var mnX=Math.max(1,r.left+ix),mxX=Math.min(vw-2,r.right-ix),mnY=Math.max(1,r.top+iy),mxY=Math.min(vh-2,r.bottom-iy);' +
              'if(mxX>mnX&&mxY>mnY){jx=Math.round(mnX+((Math.random()+Math.random())*0.5)*(mxX-mnX));jy=Math.round(mnY+((Math.random()+Math.random())*0.5)*(mxY-mnY));}' +
            '}' +
            'jx=Math.max(1,Math.min(vw-2,jx));jy=Math.max(1,Math.min(vh-2,jy));' +
            'if(!isLgCan){var ch=deepEl(doc,jx,jy,false);if(ch&&(ch===el||(el.contains&&el.contains(ch))||(ch.contains&&ch.contains(el))))return {x:jx,y:jy,jittered:true};return {x:bx,y:by,jittered:false};}' +
            'return {x:jx,y:jy,jittered:true};' +
          '}catch(ej){}' +
          'return {x:bx,y:by,jittered:false};' +
        '}' +
        'function tSchedMicroHold(ms,cb){' +
          'if(ms<=0){cb();return;}' +
          'var endT=performance.now()+ms;' +
          'if(ms<4&&typeof MessageChannel==="function"){' +
            'var done=false,ch=new MessageChannel();' +
            'var fin=function(){if(done)return;done=true;clearTimeout(guard);try{ch.port1.close();ch.port2.close();}catch(ec){}cb();};' +
            'var guard=setTimeout(fin,Math.ceil(ms)+3);' +
            'ch.port1.onmessage=function(){if(done)return;if(performance.now()>=endT)fin();else ch.port2.postMessage(null);};' +
            'ch.port2.postMessage(null);' +
          '}else{setTimeout(cb,ms);}' +
        '}' +
        'function fireAt(doc,win,x,y,holdMs,fastMode,outMeta,onDone){' +
          'var hit=deepEl(doc,x,y,fastMode);' +
          'var snapCheck=null;' +
          'if(!hit||hit.id===HUD_ID||(hit.closest&&hit.closest("#"+HUD_ID))||hit.tagName==="BODY"||hit.tagName==="HTML"){' +
            'snapCheck=tFindFallbackBtn(doc,x,y);' +
            'if(snapCheck){hit=snapCheck;var fbr=snapCheck.getBoundingClientRect();x=Math.round(fbr.left+fbr.width/2);y=Math.round(fbr.top+fbr.height/2);}' +
          '}' +
          'if(!hit||hit.id===HUD_ID||(hit.closest&&hit.closest("#"+HUD_ID))){if(typeof onDone==="function"){try{onDone(false,performance.now());}catch(e){}}return false;}' +
          'if(hit.tagName==="IFRAME"){' +
            'var ir=hit.getBoundingClientRect(),ix=Math.round(x-ir.left),iy=Math.round(y-ir.top);' +
            'try{if(hit.contentDocument&&hit.contentWindow){hookWinTrust(hit.contentWindow);hit.contentWindow.__ttTrustDepth=(hit.contentWindow.__ttTrustDepth||0)+1;try{return fireAt(hit.contentDocument,hit.contentWindow,ix,iy,holdMs,fastMode,outMeta,onDone);}finally{hit.contentWindow.__ttTrustDepth=Math.max(0,(hit.contentWindow.__ttTrustDepth||1)-1);}}}catch(e){}' +
            'try{var fcid="pc_"+Date.now()+"_"+(++nextPid);if(hit.contentWindow){hit.contentWindow.postMessage({__TT_FRAME_CLICK__:true,clickId:fcid,x:ix,y:iy,holdMs:holdMs||0,humanJitter:Boolean(tCfg.humanJitter),fingerprintShuffle:Boolean(tCfg.fingerprintShuffle)},"*");}var fsrc="";try{fsrc=hit.getAttribute("src")||"";}catch(e2){}document.dispatchEvent(new CustomEvent("__TT_GM_FRAME_CLICK__",{detail:JSON.stringify({clickId:fcid,x:ix,y:iy,holdMs:holdMs||0,humanJitter:Boolean(tCfg.humanJitter),fingerprintShuffle:Boolean(tCfg.fingerprintShuffle),src:fsrc})}));if(typeof onDone==="function"){if(holdMs>0){tSchedMicroHold(holdMs+2,function(){try{onDone(true,performance.now());}catch(eo){}});}else{try{onDone(true,performance.now());}catch(eo2){}}}return true;}catch(e){}' +
          '}' +
          'var primaryBtnSel="button,a,[role=button],input[type=button],input[type=submit]";' +
          'var btnSel="button,a,[role=button],input[type=button],input[type=submit],label,[onclick],[tabindex],[class*=btn],[class*=button]";' +
          'var primHit=hit.closest?hit.closest(primaryBtnSel):null;' +
          'var btn=primHit||(hit.closest?(hit.closest(btnSel)||hit):hit);' +
          'if(!primHit&&hit.querySelector){var inB=hit.querySelector(primaryBtnSel);if(inB&&inB.id!==HUD_ID&&!(inB.closest&&inB.closest("#"+HUD_ID))){var ibr=inB.getBoundingClientRect();var ibt=String(inB.textContent||inB.value||"").trim();if(ibr.width>8&&ibr.height>8&&!tIsAutoCashStr(ibt,inB)){hit=inB;primHit=inB;btn=inB;x=Math.round(ibr.left+ibr.width/2);y=Math.round(ibr.top+ibr.height/2);}}}' +
          'var preBtnTxt=btn?(fastMode?(btn.textContent||btn.value||""):(btn.textContent||btn.value||btn.innerText||"")).trim():"";' +
          'var preBtnDis=Boolean(btn&&(btn.disabled||(btn.getAttribute&&btn.getAttribute("aria-disabled")==="true")));' +
          'var wantT=String(tCfg.targetText||"").trim().toLowerCase(),wantTNs=wantT.split(" ").join("");' +
          'var curTN=preBtnTxt.toLowerCase().split(String.fromCharCode(10)).join(" ");' +
          'var curMissTxt=Boolean(!tCfg.locked&&wantT&&curTN&&curTN.indexOf(wantT)===-1&&(!wantTNs||curTN.split(" ").join("").indexOf(wantTNs)===-1));' +
          'var curWrong=tIsWrongBtnState(preBtnTxt,preBtnDis,btn);' +
          'if(!snapCheck&&(tCfg.targetSelector||tCfg.targetText)&&(curWrong||curMissTxt||!primHit)){' +
            'var snapAlt=tFindFallbackBtn(doc,x,y);' +
            'if(snapAlt&&snapAlt!==btn&&snapAlt!==hit){' +
              'var sar=snapAlt.getBoundingClientRect();' +
              'var sDist=Math.hypot((sar.left+sar.width/2)-x,(sar.top+sar.height/2)-y);' +
              'var allowAlt=!tCfg.locked||sDist<=42;' +
              'var sDis=Boolean(snapAlt.disabled||(snapAlt.getAttribute&&snapAlt.getAttribute("aria-disabled")==="true"));' +
              'var sTxt=(snapAlt.textContent||snapAlt.value||snapAlt.innerText||"").trim();' +
              'var sWrong=tIsWrongBtnState(sTxt,sDis,snapAlt);' +
              'var sNorm=sTxt.toLowerCase().split(String.fromCharCode(10)).join(" ");' +
              'var sWantOk=!wantT||sNorm.indexOf(wantT)!==-1||(Boolean(wantTNs)&&sNorm.split(" ").join("").indexOf(wantTNs)!==-1);' +
              'if(allowAlt&&((!sDis&&!sWrong&&sWantOk)||!primHit||(curWrong&&!sWrong)||(curMissTxt&&sWantOk))){' +
                'hit=snapAlt;x=Math.round(sar.left+sar.width/2);y=Math.round(sar.top+sar.height/2);' +
                'primHit=hit.closest?hit.closest(primaryBtnSel):null;btn=primHit||(hit.closest?(hit.closest(btnSel)||hit):hit);' +
                'preBtnTxt=btn?(fastMode?(btn.textContent||btn.value||""):(btn.textContent||btn.value||btn.innerText||"")).trim():"";' +
                'preBtnDis=Boolean(btn&&(btn.disabled||(btn.getAttribute&&btn.getAttribute("aria-disabled")==="true")));' +
              '}' +
            '}' +
          '}' +
          'var isOpClean=(tCfg.opClickMode!==false);' +
          'var tJit=(!isOpClean&&tCfg.humanJitter)?tPickJitterPoint(doc,primHit||btn||hit,x,y):{x:Math.round(x),y:Math.round(y),jittered:false};' +
          'x=Math.round(tJit.x);y=Math.round(tJit.y);' +
          'var fpProf=(!isOpClean&&tCfg.fingerprintShuffle)?tMakeFpProfile():null;' +
          'var evX=fpProf?Math.max(1,Number((x+fpProf.dx).toFixed(2))):x;' +
          'var evY=fpProf?Math.max(1,Number((y+fpProf.dy).toFixed(2))):y;' +
          'var parentEl=hit.parentElement;' +
          'var cleanPreTxt=preBtnTxt.replace(/\\s+/g," ").slice(0,40);' +
          'if(outMeta){outMeta.preText=cleanPreTxt;outMeta.disabled=preBtnDis;outMeta.tag=btn?btn.tagName:"";outMeta.clickX=evX;outMeta.clickY=evY;outMeta.jittered=Boolean(tJit.jittered);outMeta.fpSalt=fpProf?fpProf.salt:"";outMeta.fpPressure=fpProf?fpProf.pr:0;outMeta.fpRadius=fpProf?fpProf.rx:0;}' +
          'else if(CM_SYM){try{defHide(window,CM_SYM,{preText:cleanPreTxt,disabled:preBtnDis,tag:btn?btn.tagName:"",clickX:evX,clickY:evY,jittered:Boolean(tJit.jittered),fpSalt:fpProf?fpProf.salt:"",fpPressure:fpProf?fpProf.pr:0,fpRadius:fpProf?fpProf.rx:0});}catch(e){}}' +
          'var pid=fpProf?fpProf.pid:(nextPid=(nextPid%9000)+1);' +
          'var sx=fpProf?Number((evX+(win.screenX||0)).toFixed(2)):Math.round(x+(win.screenX||0)),sy=fpProf?Number((evY+(win.screenY||0)).toFixed(2)):Math.round(y+(win.screenY||0));' +
          'var px=fpProf?Number((evX+(win.scrollX||0)).toFixed(2)):Math.round(x+(win.scrollX||0)),py=fpProf?Number((evY+(win.scrollY||0)).toFixed(2)):Math.round(y+(win.scrollY||0));' +
          'var moveOpts={bubbles:true,cancelable:true,composed:true,view:win,clientX:evX,clientY:evY,screenX:sx,screenY:sy,movementX:fpProf?fpProf.mx:0,movementY:fpProf?fpProf.my:0,button:0,detail:0,which:0};' +
          'var baseOpts={bubbles:true,cancelable:true,composed:true,view:win,clientX:evX,clientY:evY,screenX:sx,screenY:sy,movementX:0,movementY:0,button:0,detail:1,which:1};' +
          'var ptrBase={pointerId:pid,pointerType:"touch",isPrimary:true,width:fpProf?fpProf.w:24,height:fpProf?fpProf.h:24,tiltX:fpProf?fpProf.tx:0,tiltY:fpProf?fpProf.ty:0};' +
          'var PE=win===window&&fastPE?fastPE:(win.PointerEvent||fastPE);' +
          'var ME=win===window&&fastME?fastME:(win.MouseEvent||fastME);' +
          'var TCH=win===window&&fastTCH?fastTCH:(win.Touch||fastTCH);' +
          'var TE=win===window&&fastTE?fastTE:(win.TouchEvent||fastTE);' +
          'var touchEndPrevented=false;' +
          'function doDown(){' +
            'window.__ttTrustDepth++;' +
            'if(win&&win!==window&&typeof win.__ttTrustDepth==="number")win.__ttTrustDepth++;' +
            'try{' +
              'if(PE){try{hit.dispatchEvent(new PE("pointerover",Object.assign({},moveOpts,ptrBase,{buttons:0,pressure:0})));}catch(e){}' +
              'try{hit.dispatchEvent(new PE("pointerenter",Object.assign({},moveOpts,ptrBase,{bubbles:false,buttons:0,pressure:0})));}catch(e){}' +
              'if(btn&&btn!==hit){try{btn.dispatchEvent(new PE("pointerenter",Object.assign({},moveOpts,ptrBase,{bubbles:false,buttons:0,pressure:0})));}catch(e){}}' +
              'try{hit.dispatchEvent(new PE("pointermove",Object.assign({},moveOpts,ptrBase,{buttons:0,pressure:0})));}catch(e){}}' +
              'if(ME){try{hit.dispatchEvent(new ME("mouseover",Object.assign({},moveOpts,{buttons:0})));}catch(e){}' +
              'try{hit.dispatchEvent(new ME("mousemove",Object.assign({},moveOpts,{buttons:0})));}catch(e){}}' +
              'if(PE){try{hit.dispatchEvent(new PE("pointerdown",Object.assign({},baseOpts,ptrBase,{buttons:1,pressure:fpProf?fpProf.pr:1})));}catch(e){}}' +
              'if(TCH&&TE){' +
                'try{' +
                  'var t=new TCH({identifier:pid,target:hit,clientX:evX,clientY:evY,pageX:px,pageY:py,screenX:sx,screenY:sy,radiusX:fpProf?fpProf.rx:12,radiusY:fpProf?fpProf.ry:12,rotationAngle:fpProf?fpProf.rot:0,force:fpProf?fpProf.pr:1});' +
                  'hit.dispatchEvent(new TE("touchstart",{bubbles:true,cancelable:true,composed:true,view:win,touches:[t],targetTouches:[t],changedTouches:[t]}));' +
                '}catch(e){}' +
              '}' +
              'if(btn&&typeof btn.focus==="function"){try{btn.focus({preventScroll:true});}catch(e){}}' +
            '}finally{window.__ttTrustDepth=Math.max(0,window.__ttTrustDepth-1);if(win&&win!==window&&typeof win.__ttTrustDepth==="number")win.__ttTrustDepth=Math.max(0,win.__ttTrustDepth-1);}' +
          '}' +
          'function doUp(){' +
            'window.__ttTrustDepth++;' +
            'if(win&&win!==window&&typeof win.__ttTrustDepth==="number")win.__ttTrustDepth++;' +
            'try{' +
              'var live=hit.isConnected?hit:((btn&&btn.isConnected)?btn:(parentEl&&parentEl.isConnected?parentEl:(tFindFallbackBtn(doc,x,y)||deepEl(doc,x,y,false)||btn||hit)));' +
              'if(PE){try{live.dispatchEvent(new PE("pointerup",Object.assign({},baseOpts,ptrBase,{buttons:0,pressure:0})));}catch(e){}}' +
              'if(TCH&&TE){' +
                'try{' +
                  'var te=new TCH({identifier:pid,target:live,clientX:evX,clientY:evY,pageX:px,pageY:py,screenX:sx,screenY:sy,radiusX:fpProf?fpProf.rx:12,radiusY:fpProf?fpProf.ry:12,rotationAngle:fpProf?fpProf.rot:0,force:0});' +
                  'var teOk=live.dispatchEvent(new TE("touchend",{bubbles:true,cancelable:true,composed:true,view:win,touches:[],targetTouches:[],changedTouches:[te]}));' +
                  'if(!teOk)touchEndPrevented=true;' +
                '}catch(e){}' +
              '}' +
              'var sameLive=(live===hit);' +
              'var insideBtn=sameLive?Boolean(primHit):Boolean(live.closest&&live.closest(primaryBtnSel));' +
              'var liveBtn=sameLive?btn:((insideBtn&&live.closest(primaryBtnSel))||(live.closest&&live.closest(btnSel))||btn);' +
              'var btnChanged=false;' +
              'if(touchEndPrevented&&liveBtn){' +
                'var nowDis=Boolean(liveBtn.disabled||(liveBtn.getAttribute&&liveBtn.getAttribute("aria-disabled")==="true"));' +
                'var nowTxt=String(liveBtn.textContent||liveBtn.value||liveBtn.innerText||"").trim().replace(/\\s+/g," ").slice(0,40);' +
                'btnChanged=Boolean((nowDis&&!preBtnDis)||(cleanPreTxt&&nowTxt&&nowTxt!==cleanPreTxt));' +
              '}' +
              'if(!(touchEndPrevented&&btnChanged)){' +
                'if(ME){try{live.dispatchEvent(new ME("mousedown",Object.assign({},baseOpts,{buttons:1})));}catch(e){}' +
                'try{live.dispatchEvent(new ME("mouseup",Object.assign({},baseOpts,{buttons:0})));}catch(e){}}' +
                'var clickOk=true;' +
                'try{' +
                  'var clk=(tCfg.opClickMode!==false&&ME)?new ME("click",Object.assign({},baseOpts,{buttons:0})):(PE?new PE("click",Object.assign({},baseOpts,ptrBase,{width:1,height:1,buttons:0,pressure:0})):(ME?new ME("click",Object.assign({},baseOpts,{buttons:0})):null));' +
                  'if(clk)clickOk=live.dispatchEvent(clk);' +
                '}catch(e){' +
                  'if(ME){try{clickOk=live.dispatchEvent(new ME("click",Object.assign({},baseOpts,{buttons:0})));}catch(e2){}}' +
                '}' +
                'var needsNative=liveBtn&&liveBtn.tagName!=="CANVAS"&&(!clickOk||!insideBtn||live!==liveBtn||(liveBtn.tagName!=="BUTTON"&&liveBtn.tagName!=="INPUT"));' +
                'if(needsNative){if(typeof liveBtn.click==="function"){try{liveBtn.click();}catch(e){}}else{try{var rks=Object.keys(liveBtn);for(var ri=0;ri<rks.length;ri++){if(rks[ri].indexOf("__reactProps$")===0||rks[ri].indexOf("__reactEventHandlers$")===0){var rp=liveBtn[rks[ri]];if(rp&&typeof rp.onClick==="function"&&!liveBtn.disabled){rp.onClick({type:"click",target:liveBtn,currentTarget:liveBtn,bubbles:true,cancelable:true,isTrusted:true,nativeEvent:{},preventDefault:function(){},stopPropagation:function(){},persist:function(){}});break;}}}}catch(re){}}}' +
              '}' +
              'if(PE){try{live.dispatchEvent(new PE("pointerout",Object.assign({},moveOpts,ptrBase,{buttons:0,pressure:0})));}catch(e){}' +
              'try{live.dispatchEvent(new PE("pointerleave",Object.assign({},moveOpts,ptrBase,{bubbles:false,buttons:0,pressure:0})));}catch(e){}' +
              'if(liveBtn&&liveBtn!==live){try{liveBtn.dispatchEvent(new PE("pointerleave",Object.assign({},moveOpts,ptrBase,{bubbles:false,buttons:0,pressure:0})));}catch(e){}}}' +
              'if(ME){try{live.dispatchEvent(new ME("mouseout",Object.assign({},moveOpts,{buttons:0})));}catch(e){}' +
              'try{live.dispatchEvent(new ME("mouseleave",Object.assign({},moveOpts,{bubbles:false,buttons:0})));}catch(e){}}' +
            '}finally{window.__ttTrustDepth=Math.max(0,window.__ttTrustDepth-1);if(win&&win!==window&&typeof win.__ttTrustDepth==="number")win.__ttTrustDepth=Math.max(0,win.__ttTrustDepth-1);}' +
          '}' +
          'activeClickCount++;' +
          'var gateFloor=tCfg.preClickGate?2:0;' +
          'if(holdMs>0){' +
            'try{doDown();}catch(ed){}' +
            'tSchedMicroHold(holdMs,function(){var nUp=performance.now();try{doUp();}finally{activeClickCount=Math.max(0,activeClickCount-1);nUp=performance.now();lastClickDoneAt=nUp;globalClickUntil=Math.max(globalClickUntil,nUp+Math.max(Number(tCfg.gateMs)||0,Number(tCfg.leadMs)||0,gateFloor));if(typeof tightenCrashHolds==="function")tightenCrashHolds(globalClickUntil);if(typeof onDone==="function"){try{onDone(true,nUp);}catch(eod){}}}});' +
          '}else{' +
            'try{doDown();doUp();}finally{activeClickCount=Math.max(0,activeClickCount-1);var nSync=performance.now();lastClickDoneAt=nSync;globalClickUntil=Math.max(globalClickUntil,nSync+Math.max(Number(tCfg.gateMs)||0,Number(tCfg.leadMs)||0,gateFloor));if(typeof tightenCrashHolds==="function")tightenCrashHolds(globalClickUntil);if(typeof onDone==="function"){try{onDone(true,nSync);}catch(eod2){}}}' +
          '}' +
          'return true;' +
        '}' +
        'function fireTurboClick(mTag,t0,gateCtx,isRetryCall){' +
          'var nowMs=Date.now();if(!isRetryCall&&nowMs-lastTurboAt<tCfg.cooldownMs)return null;' +
          'if(tCfg.roundOnce&&roundClickLocked)return null;' +
          'var zMicro=Math.max(0,Math.min(5,Number(tCfg.zeroDelayMicroMs)||0));' +
          'var cHold=tCfg.zeroDelay?zMicro:(Number(tCfg.holdMs)||0),cGate=Number(tCfg.gateMs)||0,cLead=Number(tCfg.leadMs)||0;' +
          'var postHold=(tCfg.preClickGate||cGate>0||cLead>0)?Math.max(cGate,cLead,2):0;' +
          'var gSt=gateCtx&&gateCtx.st?gateCtx.st:null,gTgt=gateCtx&&gateCtx.tgt?gateCtx.tgt:null;' +
          'var pktRoundId=gateCtx&&gateCtx.roundId?String(gateCtx.roundId):"";' +
          'var hasOvr=Boolean(gateCtx&&typeof gateCtx.overrideX==="number"&&gateCtx.overrideX>=0&&typeof gateCtx.overrideY==="number"&&gateCtx.overrideY>=0);' +
          'var hasLocal=hasOvr||Boolean(tCfg.localActive&&typeof tCfg.localX==="number"&&tCfg.localX>=0&&typeof tCfg.localY==="number"&&tCfg.localY>=0);' +
          'var fireX=hasOvr?gateCtx.overrideX:(tCfg.hudHidden?tCfg.localX:tCfg.x),fireY=hasOvr?gateCtx.overrideY:(tCfg.hudHidden?tCfg.localY:tCfg.y);' +
          'if(!hasOvr&&tCfg.hudHidden&&!hasLocal){' +
            'var inFrBtn=(tCfg.targetSelector||tCfg.targetText)?tFindFallbackBtn(document,Math.round((window.innerWidth||360)/2),Math.round((window.innerHeight||640)/2)):null;' +
            'if(!inFrBtn&&!tCfg.targetSelector){' +
              'var autoBs=tQDeep(document,"button,a,[role=button],input[type=button],input[type=submit]");' +
              'for(var abi=0;abi<autoBs.length;abi++){var ab=autoBs[abi];if(!ab||!ab.isConnected||(ab.closest&&ab.closest("#"+HUD_ID)))continue;var aDis=Boolean(ab.disabled||(ab.getAttribute&&ab.getAttribute("aria-disabled")==="true"));if(aDis)continue;var at=String(ab.innerText||ab.textContent||ab.value||"").trim().toLowerCase();if(!at||at.length>48||tIsAutoCashStr(at,ab))continue;if(at.indexOf("cash")!==-1||at.indexOf("collect")!==-1||at.indexOf("take")!==-1||at.indexOf("claim")!==-1||at.indexOf("withdraw")!==-1||at.indexOf("sell")!==-1||at.indexOf("payout")!==-1||at.indexOf("redeem")!==-1||at.indexOf("settle")!==-1||at.indexOf("উত্তোলন")!==-1||at.indexOf("ক্যাশ")!==-1||at.indexOf("নিন")!==-1||at.indexOf("তুলে")!==-1||at.indexOf("সেল")!==-1||tIsNumPayout(at)){var abr=ab.getBoundingClientRect();if(abr.width>10&&abr.height>10){inFrBtn=ab;break;}}}' +
            '}' +
            'if(inFrBtn){' +
              'var ifr=inFrBtn.getBoundingClientRect();' +
              'if(ifr.width>2&&ifr.height>2){' +
                'var iDis=Boolean(inFrBtn.disabled||(inFrBtn.getAttribute&&inFrBtn.getAttribute("aria-disabled")==="true"));' +
                'var iTxt=(inFrBtn.textContent||inFrBtn.value||inFrBtn.innerText||"").trim();' +
                'if(!tIsWrongBtnState(iTxt,iDis,inFrBtn)){fireX=Math.round(ifr.left+ifr.width/2);fireY=Math.round(ifr.top+ifr.height/2);hasLocal=true;}' +
              '}' +
            '}' +
          '}' +
          'if(tCfg.hudHidden&&!hasLocal){' +
            'var pNowR=performance.now();' +
            'globalClickUntil=Math.max(globalClickUntil,pNowR+cHold+Math.max(cGate,cLead,16));' +
            'lastClickDoneAt=pNowR;' +
            'if(typeof tightenCrashHolds==="function")tightenCrashHolds(globalClickUntil);' +
            'var rToken="rm_"+(++remoteLockSeq)+"_"+(gSt?gSt.id:0);' +
            'if(gSt&&typeof lockFrame==="function"){' +
              'var rmCap=Math.max(cHold+cGate+cLead+180,220);' +
              'lockFrame(gSt,rmCap);' +
              'pendingRemoteCount++;' +
              'var rmEnt={tgt:gTgt,st:gSt,postHold:postHold,done:false,timerId:0};' +
              'rmEnt.timerId=setTimeout(function(){if(rmEnt.done)return;rmEnt.done=true;delete pendingRemoteLocks[rToken];pendingRemoteCount=Math.max(0,pendingRemoteCount-1);if(typeof unlockFrame==="function")unlockFrame(rmEnt.tgt,rmEnt.st,2);},rmCap);' +
              'pendingRemoteLocks[rToken]=rmEnt;' +
            '}' +
            'lastTurboAt=nowMs;if(tCfg.roundOnce){roundClickLocked=true;roundClickLockedAt=nowMs;roundSawFlight=false;roundSawCrash=false;roundLastFlightAt=0;roundLockedId=pktRoundId;}var wasOS=Boolean(tCfg.oneShot);if(wasOS)tCfg.armed=false;' +
            'return {tag:mTag,t0:t0,roundId:pktRoundId,remoteOnly:true,remoteToken:rToken,gateId:gSt?gSt.id:0,timeStr:tFmtMs(),oneShotFired:wasOS};' +
          '}' +
          'var meta={},clickLockAdded=false;' +
          'if(cHold>0&&gSt&&typeof lockFrame==="function"){lockFrame(gSt,Math.max(cHold+cGate+cLead+120,160));clickLockAdded=true;}' +
          'var clickReleased=false,clickDoneAt=0;' +
          'var onClkDone=function(ok,doneAt){' +
            'if(clickReleased)return;clickReleased=true;clickDoneAt=doneAt||performance.now();' +
            'if(clickLockAdded&&typeof unlockFrame==="function"){unlockFrame(gTgt,gSt,ok?postHold:0);}' +
          '};' +
          'if(!fireAt(document,window,fireX,fireY,cHold,true,meta,onClkDone)){' +
            'if(!clickReleased){clickReleased=true;if(clickLockAdded&&typeof unlockFrame==="function")unlockFrame(gTgt,gSt,0);}' +
            'return null;' +
          '}' +
          'var isWrongBtn=tIsWrongBtnState(meta.preText,meta.disabled);' +
          'if(isWrongBtn&&!isRetryCall){' +
            'tClearRetry();var rTries=26,tRetryBusy=false;' +
            'var doRetry=function(){' +
              'if(tRetryBusy)return;' +
              'if(tRetryTimer){clearTimeout(tRetryTimer);tRetryTimer=0;}' +
              'if(!tCfg.armed||roundClickLocked||rTries<=0){tClearRetry();return;}' +
              'tRetryBusy=true;' +
              'try{' +
                'rTries--;cachedHitEl=null;' +
                'var rh=tFindFallbackBtn(document,fireX,fireY)||deepEl(document,fireX,fireY,false);' +
                'var rb=(rh&&rh.closest)?(rh.closest("button,a,[role=button],input[type=button],input[type=submit]")||rh):rh;' +
                'var rDis=Boolean(rb&&(rb.disabled||(rb.getAttribute&&rb.getAttribute("aria-disabled")==="true")));' +
                'var rTxt=rb?(rb.textContent||rb.value||"").trim():"";' +
                'if(rb&&!tIsWrongBtnState(rTxt,rDis,rb)){var rr=rb.getBoundingClientRect();var rCtx={roundId:pktRoundId};if(rr&&rr.width>2&&rr.height>2){rCtx.overrideX=Math.round(rr.left+rr.width/2);rCtx.overrideY=Math.round(rr.top+rr.height/2);}var retR=fireTurboClick(mTag,performance.now(),rCtx,true);if(retR&&!retR.wrongBtn){tClearRetry();return;}}' +
                'if(rTries>0)tRetryTimer=setTimeout(doRetry,rTries>14?(tCfg.zeroDelay?2:4):12);' +
                'else tClearRetry();' +
              '}finally{tRetryBusy=false;}' +
            '};' +
            'if(typeof MutationObserver==="function"&&(document.body||document.documentElement)){' +
              'try{tRetryObs=new MutationObserver(function(muts){if(tRetryTimer||tRetryBusy||window.__ttTrustDepth>0||activeClickCount>0)return;var hasG=false;for(var mi=0;mi<muts.length;mi++){var mt=muts[mi]&&muts[mi].target;if(mt&&(!cachedRNode||(mt!==cachedRNode&&!(cachedRNode.contains&&cachedRNode.contains(mt))))){hasG=true;break;}}if(hasG)tRetryTimer=setTimeout(doRetry,tCfg.zeroDelay?2:4);});tRetryObs.observe(document.body||document.documentElement,{attributes:true,attributeFilter:["disabled","aria-disabled","class","style","hidden","data-state"],childList:true,characterData:true,subtree:true});}catch(emo){}' +
            '}' +
            'tRetryTimer=setTimeout(doRetry,tCfg.zeroDelay?2:4);' +
            'var pNowD=clickDoneAt||performance.now();' +
            'return {tag:mTag,t0:t0,roundId:pktRoundId,tClick:pNowD,elapsed:(pNowD-t0).toFixed(2),timeStr:tFmtMs(),preText:meta.preText||"",preDis:true,wrongBtn:true,oneShotFired:false,fromLocalIframe:Boolean(tCfg.hudHidden&&hasLocal)};' +
          '}' +
          'if(isWrongBtn&&isRetryCall){' +
            'var pNowRetryBad=clickDoneAt||performance.now();' +
            'return {tag:mTag,t0:t0,roundId:pktRoundId,tClick:pNowRetryBad,elapsed:(pNowRetryBad-t0).toFixed(2),timeStr:tFmtMs(),preText:meta.preText||"",preDis:true,wrongBtn:true,oneShotFired:false,fromLocalIframe:Boolean(tCfg.hudHidden&&hasLocal)};' +
          '}' +
          'tClearRetry();' +
          'var pNow=clickDoneAt||performance.now();' +
          'globalClickUntil=Math.max(globalClickUntil,pNow+cHold+Math.max(cGate,cLead,tCfg.preClickGate?2:0));' +
          'lastClickDoneAt=pNow;' +
          'if(typeof tightenCrashHolds==="function")tightenCrashHolds(globalClickUntil);' +
          'lastTurboAt=nowMs;if(tCfg.roundOnce){roundClickLocked=true;roundClickLockedAt=nowMs;roundSawFlight=false;roundSawCrash=false;roundLastFlightAt=0;roundLockedId=pktRoundId;}var wasOneShot=Boolean(tCfg.oneShot);if(wasOneShot)tCfg.armed=false;' +
          'var tClick=clickDoneAt||performance.now();' +
          'var outRes={tag:mTag,t0:t0,roundId:pktRoundId,tClick:tClick,elapsed:(tClick-t0).toFixed(2),timeStr:tFmtMs(),preText:meta.preText||"",preDis:Boolean(meta.disabled),clickX:meta.clickX,clickY:meta.clickY,jittered:Boolean(meta.jittered),fpSalt:meta.fpSalt||"",fpPressure:meta.fpPressure||0,fpRadius:meta.fpRadius||0,wrongBtn:false,oneShotFired:wasOneShot,fromLocalIframe:Boolean(tCfg.hudHidden&&hasLocal)};' +
          'if(isRetryCall){try{document.dispatchEvent(new CustomEvent("__TT_PAGE_RETRY_HIT__",{detail:JSON.stringify(outRes)}));}catch(erh){}}' +
          'return outRes;' +
        '}' +
        'function runTurboRaw(rawData,t0,outInfo,gateCtx,metaPfx){' +
          'syncCfgAttr();' +
          'if(!tCfg.armed||rawData==null)return null;' +
          'var fs=null,mTag=null,decStr="";' +
          'if(typeof rawData==="string"){fs=rawData;decStr=rawData;}' +
          'else if(rawData instanceof ArrayBuffer||ArrayBuffer.isView(rawData)){' +
            'try{' +
              'var u8=rawData instanceof ArrayBuffer?new Uint8Array(rawData):new Uint8Array(rawData.buffer,rawData.byteOffset||0,rawData.byteLength!=null?rawData.byteLength:rawData.length);' +
              'var n=u8.length;' +
              'if(n){' +
                'var isGz=(n>=2&&u8[0]===0x1f&&u8[1]===0x8b);' +
                'var isZl=(n>=2&&u8[0]===0x78&&(u8[1]===0x9c||u8[1]===0xda||u8[1]===0x01||u8[1]===0x5e));' +
                'if(!isGz){' +
                  'var uWork=isZl?(tInflateSync(u8)||u8):u8;' +
                  'var sfs=tFastSfs2x(uWork);if(sfs){try{decStr=JSON.stringify(sfs);}catch(esf){}mTag=turboMatchObj(sfs);if(mTag===null)fs=decStr;}' +
                  'if(mTag===null&&fs===null&&((uWork[0]>=0x80&&uWork[0]<=0x9f)||uWork[0]===0xdc||uWork[0]===0xdd||uWork[0]===0xde||uWork[0]===0xdf)){var mp=tFastMp(uWork);if(mp){try{decStr=JSON.stringify(mp);}catch(emp){}mTag=turboMatchObj(mp);if(mTag===null)fs=decStr;}}' +
                  'if(mTag===null&&fs===null){var view=uWork,wn=uWork.length;if((uWork[0]&0x80)!==0&&(uWork[0]&0x20)===0&&wn>5){var hl=(uWork[0]&0x08)!==0?5:3;if(wn>hl&&uWork[hl]===0x12)view=uWork.subarray(hl);}else if(uWork[0]!==0x7b&&uWork[0]!==0x5b){for(var ji=1;ji<Math.min(wn,16);ji++){if(uWork[ji]===0x7b||uWork[ji]===0x5b){view=uWork.subarray(ji);break;}}}if(!fastDec&&typeof TextDecoder!=="undefined")fastDec=new TextDecoder("utf-8",{fatal:false});if(fastDec){fs=fastDec.decode(view);decStr=fs;}if(fs&&fs.indexOf("{")===-1&&fs.indexOf("[")===-1){var pb=tFastPb(uWork,0);if(pb){try{decStr=JSON.stringify(pb);}catch(epb){}mTag=turboMatchObj(pb);if(mTag===null)fs=decStr;}}}' +
                '}' +
              '}' +
            '}catch(e){}' +
          '}else if(typeof rawData==="object"&&!(typeof Blob!=="undefined"&&rawData instanceof Blob)){' +
            'try{decStr=JSON.stringify(rawData);}catch(eo){}' +
            'mTag=turboMatchObj(rawData);' +
            'if(mTag===null)fs=decStr;' +
          '}' +
          'if(outInfo&&decStr)outInfo.decoded=decStr;' +
          'if(tEntries.length&&mTag===null&&(fs||metaPfx)){' +
            'var matchSrc=(typeof metaPfx==="string"&&metaPfx)?(fs?(fs.indexOf(metaPfx)===0?fs:(metaPfx+fs)):metaPfx):fs;' +
            'var sep=String.fromCharCode(30);' +
            'if(matchSrc.indexOf(sep)!==-1){var sp=matchSrc.split(sep);for(var si=0;si<sp.length;si++){if(sp[si]){mTag=turboMatchStr(sp[si]);if(mTag!==null)break;}}}else{mTag=turboMatchStr(matchSrc);}' +
          '}' +
          'var tbRes=(mTag!==null)?fireTurboClick(mTag,t0,gateCtx):null;' +
          'if(tCfg.roundOnce&&(tbRes||roundClickLocked)){' +
            'var rAn=tAnalyzeCrashStart(rawData,decStr);' +
            'if(tbRes&&roundClickLocked&&!roundLockedId&&rAn.roundId){roundLockedId=rAn.roundId;tbRes.roundId=rAn.roundId;}' +
            'if(!gateCtx&&roundClickLocked&&!tbRes){tTrackRoundUnlock(rAn,mTag);}' +
          '}' +
          'return tbRes;' +
        '}' +
        'function onPageClickCmd(ev){' +
          'try{' +
            'var d=ev&&ev.detail;' +
            'if(typeof d==="string"){try{d=JSON.parse(d);}catch(e){d=null;}}' +
            'if(!d||typeof d.x!=="number"||typeof d.y!=="number")return;' +
            'var cmdNow=performance.now();' +
            'globalClickUntil=Math.max(globalClickUntil,cmdNow+(Number(d.holdMs)||0)+Math.max(Number(tCfg.gateMs)||0,Number(tCfg.leadMs)||0,tCfg.preClickGate?2:0));' +
            'lastClickDoneAt=cmdNow;' +
            'if(typeof tightenCrashHolds==="function")tightenCrashHolds(globalClickUntil);' +
            'var ackMeta={};' +
            'var ok=fireAt(document,window,d.x,d.y,d.holdMs||0,d.fast!==false,ackMeta);' +
            'defHide(window,"__ttPageClickDone",ok);' +
            'if(ok&&CD_SYM)defHide(window,CD_SYM,true);' +
            'try{document.dispatchEvent(new CustomEvent("__TT_PAGE_CLICK_ACK__",{detail:JSON.stringify({ok:Boolean(ok),meta:ackMeta})}));}catch(ea){}' +
          '}catch(e){}' +
        '}' +
        'function onPageRemoteAck(ev){' +
          'try{' +
            'var d=ev&&ev.detail;' +
            'if(typeof d==="string"){try{d=JSON.parse(d);}catch(e){d=null;}}' +
            'if(!d||!d.remoteToken)return;' +
            'var ent=pendingRemoteLocks[d.remoteToken];' +
            'if(!ent||ent.done)return;' +
            'ent.done=true;if(ent.timerId){clearTimeout(ent.timerId);ent.timerId=0;}' +
            'delete pendingRemoteLocks[d.remoteToken];' +
            'pendingRemoteCount=Math.max(0,pendingRemoteCount-1);' +
            'var nAck=performance.now();' +
            'if(d.ok){lastClickDoneAt=nAck;globalClickUntil=Math.max(globalClickUntil,nAck+Math.max(ent.postHold||0,Number(tCfg.gateMs)||0,Number(tCfg.leadMs)||0,4));if(typeof tightenCrashHolds==="function")tightenCrashHolds(globalClickUntil);}' +
            'if(typeof unlockFrame==="function")unlockFrame(ent.tgt,ent.st,d.ok?(ent.postHold||0):0);' +
          '}catch(e){}' +
        '}' +
        'function tCaptureOutCash(ws,raw){' +
          'try{' +
            'if(!ws||isRelay(ws.url||""))return;' +
            'if(ws.readyState===1)window.__ttLiveGameWs=ws;' +
            'if(typeof raw==="string"){' +
              'var lc=raw.toLowerCase();' +
              'if(lc.indexOf("cashout")!==-1||lc.indexOf("cash_out")!==-1||lc.indexOf("takewin")!==-1||lc.indexOf("collect")!==-1||lc.indexOf("claim")!==-1){' +
                'var tplObj={ws:ws,raw:raw,ts:Date.now()};' +
                'window.__ttLastOutCashTpl=tplObj;' +
                'if(raw.length<=1200){try{localStorage.setItem("__tt_outcash_tpl",JSON.stringify({raw:raw,ts:tplObj.ts}));}catch(els){}}' +
              '}' +
            '}' +
          '}catch(ec){}' +
        '}' +
        'function onPageDirectCashout(ev){' +
          'try{' +
            'if(tCfg.directWsCashout===false)return;' +
            'var nowD=Date.now();' +
            'if(nowD-(window.__ttLastDirectCashAt||0)<1200)return;' +
            'var tpl=window.__ttLastOutCashTpl;' +
            'if(!tpl||!tpl.raw){try{var lsTpl=localStorage.getItem("__tt_outcash_tpl");if(lsTpl){var prs=JSON.parse(lsTpl);if(prs&&prs.raw)tpl={ws:window.__ttLiveGameWs||null,raw:prs.raw,ts:prs.ts||0};}}catch(erls){}}' +
            'if(!tpl||!tpl.raw||typeof tpl.raw!=="string")return;' +
            'var ws=(tpl.ws&&tpl.ws.readyState===1)?tpl.ws:((window.__ttLiveGameWs&&window.__ttLiveGameWs.readyState===1)?window.__ttLiveGameWs:null);' +
            'if(!ws)return;' +
            'var det=ev&&ev.detail;if(typeof det==="string"){try{det=JSON.parse(det);}catch(ep){det={};}}' +
            'var outStr=tpl.raw;' +
            'var tplHasBetId=outStr.indexOf("betId")!==-1||outStr.indexOf("bet_id")!==-1;' +
            'if(tplHasBetId&&det&&det.betId){' +
              'outStr=outStr.replace(/("bet(?:Id|_id)"\\s*:\\s*")[^"]+(")/,"$1"+String(det.betId).replace(/"/g,"")+"$2");' +
            '}else if(tplHasBetId&&(nowD-(tpl.ts||0)>25000)){return;}' +
            'if(det&&det.roundId){' +
              'outStr=outStr.replace(/("round(?:Id|_id)"\\s*:\\s*")[^"]+(")/,"$1"+String(det.roundId).replace(/"/g,"")+"$2");' +
            '}' +
            'window.__ttLastDirectCashAt=nowD;' +
            'ws.send(outStr);' +
          '}catch(ed){}' +
        '}' +
        'document.addEventListener("__TT_DIRECT_CASHOUT__",onPageDirectCashout);' +
        'window.addEventListener("__TT_DIRECT_CASHOUT__",onPageDirectCashout);' +
        'document.addEventListener("__TT_REMOTE_CLICK_ACK__",onPageRemoteAck);' +
        'window.addEventListener("__TT_REMOTE_CLICK_ACK__",onPageRemoteAck);' +
        'document.addEventListener("__TT_PAGE_CLICK__",onPageClickCmd);' +
        'window.addEventListener("__TT_PAGE_CLICK__",onPageClickCmd);' +
        'try{document.dispatchEvent(new CustomEvent("__TT_PAGE_READY__"));}catch(epr){}' +
        'function isStaticMedia(ct){ct=String(ct||"").toLowerCase();return ct.indexOf("image/")===0||ct.indexOf("font/")===0||ct.indexOf("application/font")===0||ct.indexOf("application/x-font")===0||ct.indexOf("application/vnd.ms-fontobject")===0||ct.indexOf("audio/")===0||ct.indexOf("video/")===0||ct.indexOf("model/")===0||ct.indexOf("text/css")===0||ct.indexOf("text/html")===0||ct.indexOf("javascript")!==-1||ct.indexOf("ecmascript")!==-1||ct.indexOf("application/wasm")===0||ct.indexOf("application/pdf")===0||ct.indexOf("application/zip")===0;}' +
        'function isStaticUrl(u){var s=String(u||"").toLowerCase();if(!s)return false;if(s.indexOf("data:")===0||s.indexOf("blob:")===0||s.indexOf("chrome-extension:")===0||s.indexOf("moz-extension:")===0)return true;var p=s.split("?")[0].split("#")[0];return p.slice(-3)===".js"||p.slice(-4)===".mjs"||p.slice(-4)===".cjs"||p.slice(-4)===".css"||p.slice(-5)===".html"||p.slice(-4)===".htm"||p.slice(-5)===".wasm"||p.slice(-4)===".map"||p.slice(-4)===".png"||p.slice(-4)===".jpg"||p.slice(-5)===".jpeg"||p.slice(-4)===".gif"||p.slice(-5)===".webp"||p.slice(-5)===".avif"||p.slice(-4)===".svg"||p.slice(-4)===".ico"||p.slice(-4)===".cur"||p.slice(-4)===".bmp"||p.slice(-5)===".woff"||p.slice(-6)===".woff2"||p.slice(-4)===".ttf"||p.slice(-4)===".otf"||p.slice(-4)===".eot"||p.slice(-4)===".mp3"||p.slice(-4)===".mp4"||p.slice(-5)===".webm"||p.slice(-4)===".ogg"||p.slice(-4)===".wav"||p.slice(-4)===".m4a"||p.slice(-4)===".aac"||p.slice(-5)===".flac"||p.slice(-6)===".atlas"||p.slice(-5)===".skel"||p.slice(-4)===".bin"||p.slice(-6)===".plist"||p.slice(-4)===".fnt"||p.slice(-4)===".zip"||p.slice(-3)===".gz"||p.slice(-3)===".br"||p.slice(-9)===".unityweb"||p.slice(-5)===".data"||p.slice(-4)===".pvr"||p.slice(-4)===".ktx"||p.slice(-4)===".glb"||p.slice(-5)===".gltf"||p.indexOf("/locales/")!==-1||p.indexOf("/i18n/")!==-1||p.indexOf("/translations/")!==-1||s.indexOf("google-analytics.com")!==-1||s.indexOf("googletagmanager.com")!==-1||s.indexOf("doubleclick.net")!==-1||s.indexOf("facebook.net")!==-1;}' +
        'function isTextLike(ct){ct=String(ct||"").toLowerCase();return ct.indexOf("json")!==-1||ct.indexOf("text/plain")===0||ct.indexOf("xml")!==-1||ct.indexOf("x-www-form-urlencoded")!==-1;}' +
        'function toB64(buf){try{var u=buf instanceof Uint8Array?buf:new Uint8Array(buf);if(u.length>131072)u=u.subarray(0,65536);var s="",c=0x8000;for(var i=0;i<u.length;i+=c){s+=String.fromCharCode.apply(null,u.subarray(i,i+c));}return btoa(s);}catch(e){return "";}}' +
        'function emitSafe(evName,base,d){' +
          'try{' +
            'var sendObj=function(o){document.dispatchEvent(new CustomEvent(evName,{detail:JSON.stringify(o)}));};' +
            'if(typeof Blob!=="undefined"&&d instanceof Blob){var useT=Boolean(base&&base.allowTurbo);var cleanBase=Object.assign({},base);delete cleanBase.allowTurbo;d.arrayBuffer().then(function(b){var tb=useT?runTurboRaw(b,performance.now()):null;sendObj(Object.assign({},cleanBase,tb?{turbo:tb,isB64:true,data:toB64(b)}:{isB64:true,data:toB64(b)}));}).catch(function(){});return;}' +
            'var safeBase=(base&&base.allowTurbo)?Object.assign({},base):base;if(safeBase&&safeBase.allowTurbo)delete safeBase.allowTurbo;' +
            'if(d instanceof ArrayBuffer||(typeof SharedArrayBuffer!=="undefined"&&d instanceof SharedArrayBuffer)){sendObj(Object.assign({},safeBase,{isB64:true,data:toB64(d)}));return;}' +
            'if(ArrayBuffer.isView(d)){sendObj(Object.assign({},safeBase,{isB64:true,data:toB64(new Uint8Array(d.buffer,d.byteOffset,d.byteLength))}));return;}' +
            'sendObj(Object.assign({},safeBase,{isB64:false,data:d}));' +
          '}catch(e){}' +
        '}' +
        'function emitMsgStream(kind,d,tb,gMeta,inspMeta){' +
          'var baseObj=gMeta?{kind:kind,gate:gMeta}:{kind:kind};' +
          'if(tb)baseObj.turbo=tb;' +
          'if(inspMeta)baseObj.insp=inspMeta;' +
          'if(tb||gMeta||inspMeta){emitSafe("__TT_PAGE_WS__",baseObj,d);return;}' +
          'if(typeof d==="string"&&d.length>0&&d.length<65536){emitSafe("__TT_PAGE_WS__",{kind:kind},d);}' +
          'else if(d&&typeof d==="object"){' +
            'if(d instanceof ArrayBuffer||ArrayBuffer.isView(d)){if((d.byteLength||0)>0&&(d.byteLength||0)<65536)emitSafe("__TT_PAGE_WS__",{kind:kind},d);}' +
            'else{try{var js=JSON.stringify(d);if(js&&js.length<65536)emitSafe("__TT_PAGE_WS__",{kind:kind},js);}catch(eo){}}' +
          '}' +
        '}' +
        'var T_SKIP_CONT={bets:1,activebets:1,otherbets:1,userbets:1,playerbets:1,mybets:1,players:1,users:1,winners:1,losers:1,cashouts:1,history:1,previous:1,lastrounds:1,roundhistory:1,gamehistory:1,pastrounds:1,roundresults:1,results:1,stats:1,recent:1,notifications:1,events:1,leaderboard:1,top:1,statistics:1,chat:1,messages:1,identifier:1,channel:1,onlineplayers:1,clients:1,outcomes:1,activeplayers:1,betlist:1,entries:1,payouts:1,jackpots:1,playerslist:1,decisions:1};' +
        'var T_CRASH_V={crash:1,crashed:1,oncrash:1,crashx:1,finish:1,finished:1,finishgame:1,finish_game:1,onfinish:1,round_finish:1,roundfinish:1,game_finish:1,gamefinish:1,end:1,ended:1,endgame:1,game_end:1,game_over:1,round_end:1,round_over:1,onroundend:1,ongameend:1,stopgame:1,stop_game:1,bust:1,busted:1,flew:1,flew_off:1,flew_away:1,fly_away:1,exploded:1,lost:1,loss:1,over:1,stopped:1,destroyed:1,terminated:1,halted:1,boom:1,round_settled:1,settled:1,cashout_closed:1,decision_closed:1,betting_closed:1};' +
        'var T_FLIGHT_V={game:1,running:1,flying:1,active:1,in_progress:1,inprogress:1,in_game:1,ingame:1,started:1,play:1,playing:1,live:1,multiplier_update:1,tick:1};' +
        'var T_START_V={waiting:1,betting:1,bet:1,open:1,start:1,startgame:1,start_game:1,waitgame:1,wait_game:1,newgame:1,new_game:1,round_start:1,game_start:1,onbetting:1,onstart:1,ready:1,idle:1,next_round:1,next_game:1,bets_open:1,betsopen:1,place_bet:1,placebet:1};' +
        'var T_GFIELD={state:1,status:1,stage:1,phase:1,newstate:1,newstateid:1,gamestate:1,roundstate:1,roundstatus:1,action:1,event:1,eventtype:1,type:1,target:1,cmd:1,c:1,result:1,outcome:1};' +
        'var T_IDKEYS={gid:1,roundid:1,round_id:1,gameid:1,game_id:1,roundno:1,gameno:1,roundnumber:1,gamenumber:1};' +
        'function tTryParseJson(str){' +
          'if(!str)return null;' +
          'var ib=str.indexOf("{"),ia=str.indexOf("["),si=(ib>=0&&ia>=0)?Math.min(ib,ia):Math.max(ib,ia);' +
          'if(si<0)return null;' +
          'var sub=str.slice(si);' +
          'try{return JSON.parse(sub);}catch(e){var bal=tSliceBalancedJson(sub,0);if(bal){try{return JSON.parse(bal);}catch(eb){}}return null;}' +
        '}' +
        'function tParseXml(str){' +
          'var s=String(str||"").trim();' +
          'if(!s||s.charAt(0)!=="<")return null;' +
          'if(s.indexOf("<binary")===0||s.indexOf("<bytes")===0||s.indexOf("<!")===0)return null;' +
          'var gt=s.indexOf(">");if(gt<2||gt>512)return null;' +
          'var head=s.slice(1,gt),sp=head.search(/\\s/);' +
          'var tag=sp===-1?head:head.slice(0,sp),lt=tag.toLowerCase();' +
          'var attrStr=sp===-1?"":head.slice(sp+1),attrs={};' +
          'var re=/([a-zA-Z_][a-zA-Z0-9_:-]{0,36})\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)/g,am;' +
          'while((am=re.exec(attrStr))!==null){attrs[am[1].toLowerCase()]=am[2]!==undefined?am[2]:(am[3]||"");}' +
          'var rid=String(attrs.gid||attrs.roundid||attrs.round_id||attrs.gameid||attrs.game_id||attrs.roundno||attrs.gameno||"").trim();' +
          'var stv=String(attrs.state||attrs.status||attrs.phase||attrs.stage||attrs.event||attrs.type||"").trim().toLowerCase();' +
          'var isCash=lt.indexOf("cashout")!==-1||lt.indexOf("takewin")!==-1||attrs.won==="true"||attrs.win==="true"||stv==="cashout";' +
          'var isCrash=!isCash&&(lt==="hf_end"||lt==="hf_crash"||lt.indexOf("_end")!==-1||lt.indexOf("_crash")!==-1||lt.indexOf("_finish")!==-1||lt.indexOf("_bust")!==-1||stv==="end"||stv==="ended"||stv==="crash"||stv==="crashed"||stv==="finish"||stv==="finished"||stv==="bust"||stv==="over"||stv==="3"||attrs.crashed==="true"||attrs.ended==="true"||attrs.finished==="true"||attrs.won==="false"||attrs.stopcoef!=null||attrs.stopcoeff!=null);' +
          'var isStart=!isCash&&!isCrash&&(lt==="hf_start"||lt==="hf_bet"||lt==="hf_wait"||lt.indexOf("_start")!==-1||lt.indexOf("_bet")!==-1||lt.indexOf("_wait")!==-1||stv==="waiting"||stv==="betting"||stv==="bet"||stv==="start"||stv==="open"||stv==="1");' +
          'var inFlight=!isCash&&!isCrash&&!isStart&&(lt==="hf_mul"||lt.indexOf("_mul")!==-1||attrs.mul!=null||attrs.mult!=null||attrs.coef!=null||stv==="game"||stv==="running"||stv==="flying"||stv==="2");' +
          'return {hasXml:true,isCrash:isCrash,isStart:isStart,inFlight:inFlight,roundId:rid};' +
        '}' +
        'function tJsonRoundId(nd,dp){' +
          'if(dp>4||nd==null||typeof nd!=="object")return "";' +
          'if(Array.isArray(nd)){for(var ai=0;ai<Math.min(nd.length,4);ai++){var sr=tJsonRoundId(nd[ai],dp+1);if(sr)return sr;}return "";}' +
          'var ks=Object.keys(nd);' +
          'for(var i=0;i<ks.length;i++){var lk=ks[i].toLowerCase();if(T_SKIP_CONT[lk])continue;if(T_IDKEYS[lk]){var v=nd[ks[i]];if((typeof v==="string"&&v.trim()&&v.trim().length<=48)||(typeof v==="number"&&isFinite(v)&&v>0))return String(v).trim();}}' +
          'for(var j=0;j<ks.length;j++){var lk2=ks[j].toLowerCase();if(T_SKIP_CONT[lk2])continue;var v2=nd[ks[j]];if(v2&&typeof v2==="object"){var sr2=tJsonRoundId(v2,dp+1);if(sr2)return sr2;}}' +
          'return "";' +
        '}' +
        'function isCrashStr(s){' +
          'if(!s)return false;' +
          'var lc=s.toLowerCase();' +
          'for(var hi=0;hi<tHoldList.length;hi++){if(lc.indexOf(tHoldList[hi])!==-1)return true;}' +
          'if(lc.indexOf("<hf_end")!==-1||lc.indexOf("<hf_crash")!==-1)return true;' +
          'if(lc.indexOf("crashx")!==-1||lc.indexOf("stopcoefficient")!==-1||lc.indexOf("stop_coefficient")!==-1||lc.indexOf("stopcoeff")!==-1||lc.indexOf("finishgame")!==-1||lc.indexOf("finish_game")!==-1||lc.indexOf("resulttime")!==-1||lc.indexOf("gameresult")!==-1||lc.indexOf("roundresult")!==-1||lc.indexOf("cashoutclosed")!==-1||lc.indexOf("decisionclosed")!==-1||lc.indexOf("bettingclosed")!==-1||lc.indexOf("endgame")!==-1||lc.indexOf("game_end")!==-1||lc.indexOf("game_over")!==-1||lc.indexOf("round_end")!==-1||lc.indexOf("round_over")!==-1||lc.indexOf("round_finish")!==-1||lc.indexOf("roundfinish")!==-1||lc.indexOf("game_finish")!==-1||lc.indexOf("gamefinish")!==-1||lc.indexOf("stopgame")!==-1||lc.indexOf("stop_game")!==-1||lc.indexOf("oncrash")!==-1||lc.indexOf("onroundend")!==-1||lc.indexOf("ongameend")!==-1||lc.indexOf("onfinish")!==-1||lc.indexOf("crashed")!==-1||lc.indexOf("fly_away")!==-1||lc.indexOf("flew")!==-1||lc.indexOf("busted")!==-1||lc.indexOf("exploded")!==-1||lc.indexOf("mine_hit")!==-1||lc.indexOf("hit_mine")!==-1||lc.indexOf(T_DQ+"gr"+T_DQ+":")!==-1)return true;' +
          'var ns=(lc.indexOf(" ")!==-1&&(lc.indexOf("end")!==-1||lc.indexOf("crash")!==-1||lc.indexOf("finish")!==-1||lc.indexOf("bust")!==-1||lc.indexOf("loss")!==-1||lc.indexOf("false")!==-1||lc.indexOf("3")!==-1))?tStripWs(lc):lc;' +
          'return ns.indexOf(T_DQ+"won"+T_DQ+":false")!==-1||ns.indexOf(T_DQ+"win"+T_DQ+":false")!==-1||ns.indexOf(T_DQ+"iswin"+T_DQ+":false")!==-1||ns.indexOf(T_DQ+"newstateid"+T_DQ+":3")!==-1||ns.indexOf(T_DQ+"state"+T_DQ+":3")!==-1||ns.indexOf(T_DQ+"status"+T_DQ+":3")!==-1||ns.indexOf(T_DQ+"eventtype"+T_DQ+":"+T_DQ+"end")!==-1||ns.indexOf(T_DQ+"event"+T_DQ+":"+T_DQ+"end")!==-1||ns.indexOf(T_DQ+"target"+T_DQ+":"+T_DQ+"end")!==-1||ns.indexOf(T_DQ+"state"+T_DQ+":"+T_DQ+"end")!==-1||ns.indexOf(T_DQ+"status"+T_DQ+":"+T_DQ+"end")!==-1||ns.indexOf(T_DQ+"eventtype"+T_DQ+":"+T_DQ+"crash")!==-1||ns.indexOf(T_DQ+"event"+T_DQ+":"+T_DQ+"crash")!==-1||ns.indexOf(T_DQ+"target"+T_DQ+":"+T_DQ+"crash")!==-1||ns.indexOf(T_DQ+"type"+T_DQ+":"+T_DQ+"crash")!==-1||ns.indexOf(T_DQ+"state"+T_DQ+":"+T_DQ+"crash")!==-1||ns.indexOf(T_DQ+"status"+T_DQ+":"+T_DQ+"crash")!==-1||ns.indexOf(T_DQ+"stage"+T_DQ+":"+T_DQ+"crash")!==-1||ns.indexOf(T_DQ+"phase"+T_DQ+":"+T_DQ+"crash")!==-1||ns.indexOf(T_DQ+"event"+T_DQ+":"+T_DQ+"finish")!==-1||ns.indexOf(T_DQ+"target"+T_DQ+":"+T_DQ+"finish")!==-1||ns.indexOf(T_DQ+"state"+T_DQ+":"+T_DQ+"finish")!==-1||ns.indexOf(T_DQ+"status"+T_DQ+":"+T_DQ+"finish")!==-1||ns.indexOf(T_DQ+"result"+T_DQ+":"+T_DQ+"loss")!==-1||ns.indexOf(T_DQ+"outcome"+T_DQ+":"+T_DQ+"loss")!==-1;' +
        '}' +
        'function tAnalyzeCrashStart(d,dec){' +
          'var res={hasJson:false,hasXml:false,isCrash:false,isStart:false,inFlight:false,roundId:""};' +
          'try{' +
            'var s=dec||tExtractRawStr(d,"");if(!s)return res;' +
            'var lc=s.toLowerCase();' +
            'for(var hi=0;hi<tHoldList.length;hi++){if(lc.indexOf(tHoldList[hi])!==-1){res.isCrash=true;return res;}}' +
            'var parsed=tTryParseJson(s);' +
            'if(!parsed&&d&&typeof d==="object"&&!(d instanceof ArrayBuffer)&&!ArrayBuffer.isView(d)&&!(typeof Blob!=="undefined"&&d instanceof Blob))parsed=d;' +
            'if(parsed&&typeof parsed==="object"){' +
              'res.hasJson=true;' +
              'res.roundId=tJsonRoundId(parsed,0);' +
              'var hasC=false,hasF=false,hasS=false;' +
              'if(Array.isArray(parsed)&&typeof parsed[0]==="string"){' +
                'var e0=parsed[0].trim().toLowerCase();' +
                'if(T_CRASH_V[e0])hasC=true;else if(T_FLIGHT_V[e0])hasF=true;else if(T_START_V[e0])hasS=true;' +
              '}' +
              'var walkG=function(nd,dp){' +
                'if(dp>5||nd==null)return;' +
                'if(typeof nd==="string"){' +
                  'if(dp<4&&nd.length>=2&&nd.length<=4000&&((nd.charAt(0)==="{"&&nd.charAt(nd.length-1)==="}")||(nd.charAt(0)==="["&&nd.charAt(nd.length-1)==="]"))){' +
                    'try{walkG(JSON.parse(nd),dp+1);}catch(epn){}' +
                  '}' +
                  'return;' +
                '}' +
                'if(typeof nd!=="object")return;' +
                'if(Array.isArray(nd)){for(var ai=0;ai<Math.min(nd.length,6);ai++)walkG(nd[ai],dp+1);return;}' +
                'var ks=Object.keys(nd);' +
                'for(var ki=0;ki<ks.length;ki++){' +
                  'var k=ks[ki],lk=k.toLowerCase();' +
                  'if(T_SKIP_CONT[lk])continue;' +
                  'var v=nd[k];' +
                  'if(lk==="gr"&&v&&typeof v==="object"){hasC=true;walkG(v,dp+1);continue;}' +
                  'else if((lk==="resulttime"||lk==="gameresult"||lk==="roundresult"||lk==="crashtime"||lk==="settletime")&&v!=null&&v!==false&&v!==0&&v!==""){hasC=true;}' +
                  'else if(lk==="stopcoefficient"||lk==="stop_coefficient"||lk==="stopcoeff"||lk==="crashpoint"||lk==="crash_point"){var nv=typeof v==="number"?v:parseFloat(String(v));if(!isNaN(nv)&&nv>0)hasC=true;}' +
                  'else if((lk==="crashed"||lk==="ended"||lk==="finished"||lk==="busted"||lk==="cashoutclosed"||lk==="decisionclosed")&&v===true){hasC=true;}' +
                  'else if((lk==="won"||lk==="win"||lk==="iswin")&&v===false){hasC=true;}' +
                  'else if(lk==="newstateid"||lk==="state"||lk==="status"){if(v===3)hasC=true;else if(v===2)hasF=true;else if(v===1)hasS=true;}' +
                  'if(typeof v==="string"&&T_GFIELD[lk]){' +
                    'var sv=v.trim().toLowerCase();' +
                    'if(T_CRASH_V[sv])hasC=true;else if(T_FLIGHT_V[sv])hasF=true;else if(T_START_V[sv])hasS=true;' +
                  '}else if(lk==="coef"||lk==="coeff"||lk==="coefficient"||lk==="multiplier"||lk==="mult"||lk==="mul"||lk==="odds"||lk==="rate"){var mv=tParseNum(v);if(!isNaN(mv)&&mv>1.005&&mv<1000000)hasF=true;}' +
                  'else if(v&&typeof v==="object"){walkG(v,dp+1);}' +
                  'else if(typeof v==="string"&&dp<3&&(v.charAt(0)==="{"||v.charAt(0)==="[")){walkG(v,dp+1);}' +
                '}' +
              '};' +
              'walkG(parsed,0);' +
              'if(hasC)res.isCrash=true;else if(hasF)res.inFlight=true;else if(hasS)res.isStart=true;' +
              'return res;' +
            '}' +
            'var xp=tParseXml(s);' +
            'if(xp){return xp;}' +
            'if(isCrashStr(s))res.isCrash=true;' +
            'else if(lc.indexOf("startgame")!==-1||lc.indexOf("start_game")!==-1||lc.indexOf("waitgame")!==-1||lc.indexOf("newgame")!==-1||lc.indexOf("round_start")!==-1||lc.indexOf("onbetting")!==-1)res.isStart=true;' +
          '}catch(e){}' +
          'return res;' +
        '}' +
        'function tTrackRoundUnlock(an,matchedTag){' +
          'if(!tCfg.armed||!tCfg.roundOnce||!an)return;' +
          'if(an.isCrash){roundSawCrash=true;tClearRetry();}' +
          'if(!roundClickLocked)return;' +
          'var nowU=Date.now();' +
          'var lockAge=nowU-roundClickLockedAt;' +
          'var diffRndFirst=Boolean(matchedTag===null&&lockAge>=60&&an.roundId&&roundLockedId&&an.roundId!==roundLockedId);' +
          'if(!diffRndFirst&&an.inFlight&&(!roundLockedId||!an.roundId||an.roundId===roundLockedId)){roundSawFlight=true;roundLastFlightAt=nowU;return;}' +
          'if(lockAge<60)return;' +
          'var staleLock=Boolean(matchedTag===null&&((lockAge>=4500&&!roundSawFlight)||(roundSawFlight&&roundLastFlightAt>0&&nowU-roundLastFlightAt>=3500&&lockAge>=4500)||lockAge>=25000));' +
          'if(an.isCrash||diffRndFirst||staleLock||(an.isStart&&matchedTag===null&&(roundSawFlight||roundSawCrash||lockAge>=450))){roundClickLocked=false;roundSawFlight=false;roundSawCrash=false;roundLastFlightAt=0;roundLockedId="";try{document.dispatchEvent(new CustomEvent("__TT_PAGE_UNLOCK__"));}catch(eu){}}' +
        '}' +
        'function isCrashPacket(d,decodedStr){' +
          'return Boolean(tAnalyzeCrashStart(d,decodedStr).isCrash);' +
        '}' +
        'function getGzInfo(rawData){' +
          'try{' +
            'if(!rawData||(!(rawData instanceof ArrayBuffer)&&!ArrayBuffer.isView(rawData)))return null;' +
            'var u=rawData instanceof ArrayBuffer?new Uint8Array(rawData):new Uint8Array(rawData.buffer,rawData.byteOffset||0,rawData.byteLength!=null?rawData.byteLength:rawData.length);' +
            'var n=u.length;if(n<2)return null;' +
            'if(u[0]===0x1f&&u[1]===0x8b)return {algo:"gzip",bytes:u};' +
            'if(u[0]===0x78&&(u[1]===0x9c||u[1]===0xda||u[1]===0x01||u[1]===0x5e))return {algo:"deflate",bytes:u};' +
            'if((u[0]&0x80)!==0&&n>=4){' +
              'var hl=(u[0]&0x08)!==0?5:3;' +
              'if(n>hl){var b=u.subarray(hl);if((u[0]&0x20)!==0||(b.length>2&&b[0]===0x78))return {algo:"deflate",bytes:b};}' +
            '}' +
            'return null;' +
          '}catch(e){return null;}' +
        '}' +
        'function tDecomp(algo,bytes,cb){' +
          'if(typeof DecompressionStream==="undefined"||typeof Response==="undefined"||typeof Blob==="undefined"){cb(null);return;}' +
          'var runAlgo=function(a,retry){' +
            'try{' +
              'var ds=new DecompressionStream(a);' +
              'var st=new Blob([bytes]).stream().pipeThrough(ds);' +
              'new Response(st).arrayBuffer().then(function(buf){cb(buf);}).catch(function(){if(retry)runAlgo(a==="deflate"?"deflate-raw":"deflate",false);else cb(null);});' +
            '}catch(e){if(retry)runAlgo(a==="deflate"?"deflate-raw":"deflate",false);else cb(null);}' +
          '};' +
          'runAlgo(algo,algo==="deflate"||algo==="deflate-raw");' +
        '}' +
        'function emitGateFlush(st,flushedAt){' +
          'if(!st||!st.gated)return;' +
          'try{document.dispatchEvent(new CustomEvent("__TT_GATE_FLUSH__",{detail:JSON.stringify({id:st.id,t0:st.t0,flushedAt:flushedAt})}));}catch(e){}' +
        '}' +
        'function getStreamEntry(tgt){' +
          'if(!streamQueues)return null;' +
          'var q=streamQueues.get(tgt);' +
          'if(!q){q={items:[],scheduled:false,timerId:0,lastRel:0};streamQueues.set(tgt,q);}' +
          'return q;' +
        '}' +
        'function trackGateTgt(tgt,sq){' +
          'for(var i=0;i<activeGateTgts.length;i++){if(activeGateTgts[i].tgt===tgt)return;}' +
          'activeGateTgts.push({tgt:tgt,sq:sq});' +
          'if(activeGateTgts.length>24)activeGateTgts.shift();' +
        '}' +
        'function untrackGateTgt(tgt){' +
          'for(var i=activeGateTgts.length-1;i>=0;i--){if(activeGateTgts[i].tgt===tgt)activeGateTgts.splice(i,1);}' +
        '}' +
        'function schedSq(tgt,sq,delayMs){' +
          'if(sq.timerId){clearTimeout(sq.timerId);sq.timerId=0;}' +
          'sq.scheduled=true;' +
          'sq.timerId=setTimeout(function(){sq.timerId=0;pumpStreamQueue(tgt);},Math.max(1,Math.ceil(delayMs)));' +
        '}' +
        'function lockFrame(st,safetyMs){' +
          'if(!st||st.flushed)return;' +
          'st.lockCount=(st.lockCount||0)+1;' +
          'st.gateState="LOCKED";' +
          'st.gated=true;' +
          'var cap=performance.now()+Math.max(40,Number(safetyMs)||150);' +
          'if(cap>(st.lockUntil||0))st.lockUntil=cap;' +
        '}' +
        'function enqueueFrame(tgt,sq,st,relAt){' +
          'if(!st||st.flushed)return;' +
          'var r=Math.max(st.relAt||0,relAt||0);' +
          'st.relAt=r;st.gated=true;' +
          'if(holdMap&&r>0)holdMap.set(tgt,Math.max(holdMap.get(tgt)||0,r));' +
          'if(sq){' +
            'if(r>sq.lastRel)sq.lastRel=r;' +
            'if(!st._enq){st._enq=true;sq.items.push(st);trackGateTgt(tgt,sq);}' +
            'if(!sq.scheduled){var headWait=sq.items.length?Math.max(1,sq.items[0].relAt-performance.now()):1;schedSq(tgt,sq,headWait);}' +
          '}else if(!st._fbSched){' +
            'st._fbSched=true;' +
            'setTimeout(function tickSolo(){' +
              'var nw=performance.now();' +
              'if(activeClickCount>0||pendingRemoteCount>0||(st.pendingAsync&&nw<st.asyncCap)||(st.lockCount>0&&nw<(st.lockUntil||0))||Math.max(st.relAt,globalClickUntil)>nw){setTimeout(tickSolo,2);return;}' +
              'st.flushed=true;st.gateState="FLUSHED";var fAt=performance.now();' +
              'var q=st.queue.splice(0,st.queue.length);' +
              'for(var qi=0;qi<q.length;qi++){var ent=q[qi];try{if(typeof ent[1]==="function")ent[1].call(ent[0],ent[2]);else if(ent[1]&&typeof ent[1].handleEvent==="function")ent[1].handleEvent(ent[2]);}catch(ef){}}' +
              'emitGateFlush(st,fAt);' +
            '},Math.max(1,Math.ceil(r-performance.now())));' +
          '}' +
        '}' +
        'function unlockFrame(tgt,st,postHoldMs){' +
          'if(!st)return;' +
          'if(st.lockCount>0)st.lockCount--;' +
          'var nw=performance.now();' +
          'if(postHoldMs>0){' +
            'var pRel=nw+postHoldMs;' +
            'if(pRel>st.relAt)st.relAt=pRel;' +
          '}' +
          'var sq=tgt?getStreamEntry(tgt):null;' +
          'if(sq&&st.relAt>sq.lastRel)sq.lastRel=st.relAt;' +
          'if(holdMap&&tgt&&st.relAt>0)holdMap.set(tgt,Math.max(holdMap.get(tgt)||0,st.relAt));' +
          'if(st.lockCount===0&&!st.pendingAsync){' +
            'st.gateState=st.flushed?"FLUSHED":"READY";' +
            'if(st.gated&&tgt&&sq){' +
              'if(!st._enq)enqueueFrame(tgt,sq,st,Math.max(st.relAt,nw));' +
              'else if(sq.items.length){schedSq(tgt,sq,Math.max(1,sq.items[0].relAt-nw));}' +
            '}' +
          '}' +
        '}' +
        'function tightenCrashHolds(clickUntil){' +
          'if(!activeGateTgts.length)return;' +
          'var now=performance.now();' +
          'for(var ti=activeGateTgts.length-1;ti>=0;ti--){' +
            'var ent=activeGateTgts[ti],sq=ent.sq;' +
            'if(!sq||!sq.items.length){activeGateTgts.splice(ti,1);continue;}' +
            'var changed=false;' +
            'for(var j=0;j<sq.items.length;j++){' +
              'var it=sq.items[j];' +
              'if(it.isCrashOnly&&it.relAt>clickUntil){it.relAt=clickUntil;changed=true;}' +
              'else if(!it.isCrashOnly&&it.ownRelAt>0){var cap=Math.max(it.ownRelAt,clickUntil);if(it.relAt>cap){it.relAt=cap;changed=true;}}' +
              'if(j>0&&it.relAt<sq.items[j-1].relAt)it.relAt=sq.items[j-1].relAt;' +
            '}' +
            'if(changed){' +
              'sq.lastRel=sq.items[sq.items.length-1].relAt;' +
              'if(holdMap)holdMap.set(ent.tgt,sq.lastRel);' +
              'var nxt=Math.max(sq.items[0].relAt,clickUntil);' +
              'schedSq(ent.tgt,sq,nxt-now);' +
            '}' +
          '}' +
        '}' +
        'function flushStreamOnClose(tgt){' +
          'try{' +
            'var sq=streamQueues?streamQueues.get(tgt):null;' +
            'if(!sq||!sq.items.length)return;' +
            'if(sq.timerId){clearTimeout(sq.timerId);sq.timerId=0;}sq.scheduled=false;' +
            'while(sq.items.length){' +
              'var it=sq.items.shift();it.lockCount=0;it.pendingAsync=false;it.flushed=true;it.gateState="FLUSHED";' +
              'var calls=it.queue.splice(0,it.queue.length);' +
              'for(var qi=0;qi<calls.length;qi++){var ent=calls[qi];try{if(typeof ent[1]==="function")ent[1].call(ent[0],ent[2]);else if(ent[1]&&typeof ent[1].handleEvent==="function")ent[1].handleEvent(ent[2]);}catch(ef){}}' +
              'emitGateFlush(it,performance.now());' +
            '}' +
            'untrackGateTgt(tgt);' +
          '}catch(e){}' +
        '}' +
        'function pumpStreamQueue(tgt){' +
          'var sq=getStreamEntry(tgt);' +
          'if(!sq)return;' +
          'sq.scheduled=false;' +
          'if(sq.timerId){clearTimeout(sq.timerId);sq.timerId=0;}' +
          'var now=performance.now();' +
          'if(globalClickUntil>now+480)globalClickUntil=now+480;' +
          'while(sq.items.length){' +
            'var head=sq.items[0];' +
            'var forceStale=(sq.items.length>16||(now-head.t0)>=120);' +
            'if(!forceStale){' +
              'if(activeClickCount>0||pendingRemoteCount>0){' +
                'schedSq(tgt,sq,2);' +
                'return;' +
              '}' +
              'if(head.pendingAsync){' +
                'if(now<head.asyncCap){schedSq(tgt,sq,2);return;}' +
                'head.pendingAsync=false;' +
              '}' +
              'if(head.lockCount>0){' +
                'if(now<(head.lockUntil||0)){schedSq(tgt,sq,2);return;}' +
                'head.lockCount=0;' +
                'head.gateState="READY";' +
              '}' +
              'var waitUntil=Math.max(head.relAt,globalClickUntil);' +
              'if(waitUntil>now){' +
                'schedSq(tgt,sq,waitUntil-now);' +
                'return;' +
              '}' +
            '}else{' +
              'head.pendingAsync=false;head.lockCount=0;' +
            '}' +
            'sq.items.shift();' +
            'head.flushed=true;' +
            'head.gateState="FLUSHED";' +
            'var flushedAt=performance.now();' +
            'var calls=head.queue.splice(0,head.queue.length);' +
            'for(var qi=0;qi<calls.length;qi++){' +
              'var ent=calls[qi];' +
              'var evArg=ent[2];' +
              'try{if(typeof ent[1]==="function")ent[1].call(ent[0],evArg);else if(ent[1]&&typeof ent[1].handleEvent==="function")ent[1].handleEvent(evArg);}catch(ef){}' +
            '}' +
            'emitGateFlush(head,flushedAt);' +
            'now=performance.now();' +
          '}' +
          'if(!sq.items.length)untrackGateTgt(tgt);' +
        '}' +
        'function isHbRaw(d){' +
          'if(d instanceof ArrayBuffer||ArrayBuffer.isView(d)){return (d.byteLength||0)<=2;}' +
          'if(typeof d!=="string")return false;' +
          'var s=d.split(String.fromCharCode(30)).join("").trim();' +
          'if(!s||s==="0"||s==="1"||s==="2"||s==="3"||s==="2probe"||s==="3probe"||s==="40"||s==="h"||s==="o"||s==="ping"||s==="pong"||s==="hb"||s==="heartbeat"||s==="keepalive")return true;' +
          'if(s.charAt(0)==="{"&&s.length<=112){' +
            'if(s.indexOf(T_DQ+"ping"+T_DQ)!==-1||s.indexOf(T_DQ+"pong"+T_DQ)!==-1||s.indexOf(T_DQ+"heartbeat"+T_DQ)!==-1||s.indexOf(T_DQ+"keepalive"+T_DQ)!==-1||s.indexOf(T_DQ+"welcome"+T_DQ)!==-1||s.indexOf(T_DQ+"confirm_subscription"+T_DQ)!==-1||s.indexOf("6")!==-1){' +
              'try{var o=JSON.parse(s);if(o&&(o.type===6||(o.type==="ping"||o.type==="pong"||o.type==="heartbeat"||o.type==="keepalive"||o.type==="welcome"||o.type==="confirm_subscription")))return true;}catch(e){}' +
            '}' +
          '}' +
          'return false;' +
        '}' +
        'var deferMicro=typeof queueMicrotask==="function"?queueMicrotask:function(fn){Promise.resolve().then(fn);};' +
        'gateHookFn=function(tgt,ev){' +
          'if(!ev||typeof ev!=="object")return null;' +
          'if(evCache&&evCache.has(ev))return evCache.get(ev);' +
          'var t0=performance.now();' +
          'var st={id:nextPageGateId++,t0:t0,relAt:0,ownRelAt:0,flushed:false,gated:false,lockCount:0,lockUntil:0,gateState:"OPEN",_enq:false,queue:[],isCrash:false,isMatch:false,isCrashOnly:false,pendingAsync:false,asyncCap:0};' +
          'if(evCache)evCache.set(ev,st);' +
          'syncCfgAttr();' +
          'var zDelay=Boolean(tCfg.zeroDelay);' +
          'var effHold=zDelay?Math.max(0,Math.min(5,Number(tCfg.zeroDelayMicroMs)||0)):(Number(tCfg.holdMs)||0);' +
          'var gMs=Number(tCfg.gateMs)||0;' +
          'var lMs=Number(tCfg.leadMs)||0;' +
          'var iMs=Number(tCfg.inspectorHoldMs)||0;' +
          'var preGateOn=Boolean(tCfg.preClickGate);' +
          'var isHb=isHbRaw(ev.data);' +
          'var hasInsp=Boolean(tInsp.enabled&&(tInsp.kws.length||tInsp.rxs.length||tInsp.jps.length));' +
          'var holdAllMs=(!isHb&&tCfg.inspectorEnabled&&tCfg.inspectorHoldAllWs&&iMs>0)?iMs:0;' +
          'var autoHoldArmed=Boolean(!isHb&&tCfg.inspectorEnabled&&tCfg.inspectorAutoClick&&tCfg.armed);' +
          'var inspGateActive=Boolean(!isHb&&hasInsp&&iMs>0&&(tCfg.armed||holdAllMs>0||autoHoldArmed));' +
          'var sq=getStreamEntry(tgt);' +
          'var hasPendingQ=Boolean(!isHb&&sq&&sq.items.length>0);' +
          'var armOrRecent=Boolean(!isHb&&(tCfg.armed||globalClickUntil>t0||activeClickCount>0||pendingRemoteCount>0));' +
          'var gateArmActive=Boolean(armOrRecent&&(preGateOn||gMs>0||lMs>0));' +
          'var activeGate=Boolean(gateArmActive||hasPendingQ||inspGateActive||holdAllMs>0||autoHoldArmed);' +
          'var kind=streamKindOf(tgt);' +
          'var isBl=(!isHb&&typeof Blob!=="undefined"&&ev.data instanceof Blob);' +
          'var gz=(!isBl&&!isHb)?getGzInfo(ev.data):null;' +
          'var syncInf=(gz&&gz.algo==="deflate"&&gz.bytes)?tInflateSync(gz.bytes):null;' +
          'var rawEvData=syncInf||ev.data;' +
          'var needsDecomp=Boolean(gz&&!syncInf&&(activeGate||tCfg.armed));' +
          'var tOut={decoded:""};' +
          'var tb=null;' +
          'var syncInsp=null;' +
          'var syncInspHeldMs=holdAllMs;' +
          'var gCtx={tgt:tgt,st:st,sq:sq};' +
          'if(!isBl&&!needsDecomp&&(!activeGate||(zDelay&&effHold<=0&&!preGateOn&&!hasPendingQ&&!inspGateActive&&!holdAllMs&&!autoHoldArmed))){' +
            'st.gated=false;' +
            'var mtb=isHb?null:runTurboRaw(rawEvData,t0,tOut,null);' +
            'var mUrl=kind==="message"?(tgt.url||""):"";' +
            'var mGate={id:st.id,t0:t0,gated:false,gateEstMs:0,inspHeldMs:0};' +
            'if(mtb)mtb.gate=mGate;' +
            'deferMicro(function(){' +
              'if(kind==="worker"){emitMsgStream("worker",rawEvData,mtb,mGate,null);}' +
              'else if(kind==="rtc"){emitMsgStream("rtc",rawEvData,mtb,mGate,null);}' +
              'else if(kind==="sse"){var sseM={kind:"sse",gate:mGate};if(mtb)sseM.turbo=mtb;emitSafe("__TT_PAGE_WS__",sseM,rawEvData);}' +
              'else{var wsM={kind:"message",url:mUrl,gate:mGate};if(mtb)wsM.turbo=mtb;emitSafe("__TT_PAGE_WS__",wsM,rawEvData);}' +
            '});' +
            'return st;' +
          '}' +
          'if(!isBl&&!needsDecomp){' +
            'var evalLocked=false;' +
            'if(!isHb&&activeGate){lockFrame(st,Math.max(gMs+lMs+effHold+120,iMs+120,160));evalLocked=true;}' +
            'try{' +
              'tb=isHb?null:runTurboRaw(rawEvData,t0,tOut,gCtx);' +
              'var pktAn=(!isHb&&(gateArmActive||autoHoldArmed||(tCfg.armed&&tCfg.roundOnce&&roundClickLocked)))?tAnalyzeCrashStart(rawEvData,tOut.decoded):null;' +
              'if(pktAn)tTrackRoundUnlock(pktAn,tb?tb.tag:null);' +
              'syncInsp=(!isHb&&hasInsp&&inspGateActive)?tInspectRaw(rawEvData,tOut.decoded):null;' +
              'if(activeGate||tb!==null){' +
                'var now=performance.now();' +
                'var isCr=(!isHb&&(gateArmActive||autoHoldArmed)&&pktAn)?pktAn.isCrash:false;' +
                'var inspHitTag=(autoHoldArmed&&tb===null&&tEntries.length===0&&(!tCfg.roundOnce||!roundClickLocked))?((syncInsp&&syncInsp.matched&&syncInsp.reasons.length)?("HOLD:"+syncInsp.reasons[0]):(isCr?"HOLD:CRASH":null)):null;' +
                'if(inspGateActive&&syncInsp&&syncInsp.matched&&iMs>0)syncInspHeldMs=Math.max(syncInspHeldMs,iMs);' +
                'if(inspHitTag){syncInspHeldMs=Math.max(syncInspHeldMs,iMs>0?iMs:(isCr?CRASH_SHIELD_MS:25),20);}' +
                'st.isMatch=(tb!==null||inspHitTag!==null);' +
                'st.isCrash=isCr;' +
                'var recentClk=Boolean(globalClickUntil>now||activeClickCount>0||pendingRemoteCount>0||(lastClickDoneAt>0&&now-lastClickDoneAt<400));' +
                'st.isCrashOnly=Boolean(gateArmActive&&isCr&&!st.isMatch&&tCfg.armed&&!recentClk);' +
                'var prevRel=sq?sq.lastRel:(holdMap?(holdMap.get(tgt)||0):0);' +
                'var clickBusy=Boolean(activeClickCount>0||pendingRemoteCount>0);' +
                'var minMatchHold=(st.isMatch&&(st.isCrash||clickBusy||gMs>0||effHold>0))?Math.max(gMs,(st.isCrash||clickBusy)?lMs:0,2):0;' +
                'var clickDelay=!gateArmActive?minMatchHold:(st.isCrashOnly?Math.max(gMs,lMs,CRASH_SHIELD_MS):(st.isCrash?Math.max(gMs,lMs,minMatchHold):minMatchHold));' +
                'var baseDelay=Math.max(clickDelay,syncInspHeldMs);' +
                'st.ownRelAt=baseDelay>0?(now+baseDelay):0;' +
                'var relAt=Math.max(st.ownRelAt,(hasPendingQ?prevRel:0));' +
                'if(gateArmActive&&(st.isCrash||clickBusy))relAt=Math.max(relAt,globalClickUntil);' +
                'if(inspHitTag){var hitTb=fireTurboClick(inspHitTag,t0,gCtx);if(hitTb)tb=hitTb;}' +
                'var bypassQueueFast=Boolean(zDelay&&!st.isMatch&&!st.isCrash&&!syncInspHeldMs&&!hasPendingQ&&activeClickCount===0&&pendingRemoteCount===0);' +
                'var mustQueue=!bypassQueueFast&&Boolean(hasPendingQ||relAt>now||st.lockCount>1||activeClickCount>0||pendingRemoteCount>0||(st.isMatch&&(st.isCrash||effHold>0||gMs>0)));' +
                'if(mustQueue){' +
                  'enqueueFrame(tgt,sq,st,Math.max(relAt,now+(baseDelay>0?baseDelay:1)));' +
                '}else{' +
                  'st.gated=false;' +
                '}' +
              '}else{st.gated=false;}' +
            '}finally{' +
              'if(!st._enq&&!st.pendingAsync&&st.lockCount<=1)st.gated=false;' +
              'if(evalLocked){unlockFrame(tgt,st,0);}' +
            '}' +
          '}' +
          'var syncGateMeta=st.gated?{id:st.id,t0:t0,gated:true,gateEstMs:Math.max(0,(st.relAt||st.lockUntil||t0)-t0),inspHeldMs:syncInspHeldMs}:{id:st.id,t0:t0,gated:false,gateEstMs:0,inspHeldMs:syncInspHeldMs};' +
          'if(tb)tb.gate=syncGateMeta;' +
          'var syncInspMeta=(syncInsp&&syncInsp.matched)?syncInsp:null;' +
          'if(!isBl&&!needsDecomp){' +
            'if(kind==="worker"){emitMsgStream("worker",rawEvData,tb,syncGateMeta,syncInspMeta);}' +
            'else if(kind==="rtc"){emitMsgStream("rtc",rawEvData,tb,syncGateMeta,syncInspMeta);}' +
            'else if(kind==="sse"){var sseObj={kind:"sse",gate:syncGateMeta};if(tb)sseObj.turbo=tb;if(syncInspMeta)sseObj.insp=syncInspMeta;emitSafe("__TT_PAGE_WS__",sseObj,rawEvData);}' +
            'else{var wu=tgt.url||"";var wsObj={kind:"message",url:wu,gate:syncGateMeta};if(tb)wsObj.turbo=tb;if(syncInspMeta)wsObj.insp=syncInspMeta;emitSafe("__TT_PAGE_WS__",wsObj,rawEvData);}' +
          '}' +
          'if(isBl||needsDecomp){' +
            'var aUrl=kind==="message"?(tgt.url||""):"";' +
            'var aKind=kind==="worker"?"worker":(kind==="rtc"?"rtc":(kind==="sse"?"sse":"message"));' +
            'var hasClickBusyA=Boolean(activeClickCount>0||pendingRemoteCount>0||globalClickUntil>t0);' +
            'var holdAsync=Boolean(!isHb&&(hasPendingQ||hasClickBusyA||holdAllMs>0||inspGateActive||autoHoldArmed||(!zDelay&&(effHold>0||preGateOn||(tCfg.armed&&(gMs>0||lMs>0))))));' +
            'if(holdAsync){' +
              'var nowA=performance.now();' +
              'st.pendingAsync=true;' +
              'var aCapMs=zDelay?Math.max(gMs+lMs+100,iMs+100,140):Math.max(gMs+lMs+350,iMs+350,520);' +
              'st.asyncCap=t0+aCapMs;' +
              'lockFrame(st,aCapMs);' +
              'var prevRelA=sq?sq.lastRel:(holdMap?(holdMap.get(tgt)||0):0);' +
              'st.ownRelAt=nowA+Math.max(gateArmActive?lMs:0,2);' +
              'var relAtA=Math.max(st.ownRelAt,prevRelA,gateArmActive?globalClickUntil:0);' +
              'enqueueFrame(tgt,sq,st,relAtA);' +
            '}' +
            'var finishAsync=function(rawBuf,origFallback){' +
              'var sq2=holdAsync?getStreamEntry(tgt):null;' +
              'var aOut={decoded:""},atb=null,aCrash=false,aInsp=null,aInspHitTag=null,aInspHeld=holdAllMs;' +
              'try{' +
                'atb=rawBuf?runTurboRaw(rawBuf,t0,aOut,holdAsync?{tgt:tgt,st:st,sq:sq2}:null):null;' +
                'var aAn=(rawBuf&&(gateArmActive||autoHoldArmed||(tCfg.armed&&tCfg.roundOnce&&roundClickLocked)))?tAnalyzeCrashStart(rawBuf,aOut.decoded):null;' +
                'if(aAn)tTrackRoundUnlock(aAn,atb?atb.tag:null);' +
                'aCrash=Boolean(aAn&&aAn.isCrash&&(gateArmActive||autoHoldArmed));' +
                'aInsp=(rawBuf&&hasInsp)?tInspectRaw(rawBuf,aOut.decoded):null;' +
                'aInspHitTag=(autoHoldArmed&&atb===null&&tEntries.length===0&&(!tCfg.roundOnce||!roundClickLocked))?((aInsp&&aInsp.matched&&aInsp.reasons.length)?("HOLD:"+aInsp.reasons[0]):(aCrash?"HOLD:CRASH":null)):null;' +
                'aInspHeld=Math.max(holdAllMs,(aInsp&&aInsp.matched&&iMs>0)?iMs:0,aInspHitTag?(iMs>0?iMs:(aCrash?CRASH_SHIELD_MS:25)):0);' +
                'if(atb!==null||aInspHitTag!==null)st.isMatch=true;' +
                'if(aCrash)st.isCrash=true;' +
                'if(holdAsync){' +
                  'if(atb!==null||aCrash||aInspHeld>0||aInspHitTag!==null){' +
                    'var n2=performance.now();' +
                    'var recentClk2=Boolean(globalClickUntil>n2||activeClickCount>0||pendingRemoteCount>0||(lastClickDoneAt>0&&n2-lastClickDoneAt<400));' +
                    'st.isCrashOnly=Boolean(gateArmActive&&aCrash&&atb===null&&aInspHitTag===null&&tCfg.armed&&!recentClk2);' +
                    'var aMinM=(st.isMatch&&(preGateOn||gMs>0||lMs>0||effHold>0||tCfg.hudHidden))?Math.max(gMs,lMs,preGateOn?2:0):0;' +
                    'var aClickBase=(gateArmActive&&(atb!==null||aCrash))?(st.isCrashOnly?Math.max(gMs,lMs,CRASH_SHIELD_MS):Math.max(gMs,lMs,aMinM)):aMinM;' +
                    'var aBase=Math.max(aClickBase,aInspHeld);' +
                    'st.ownRelAt=n2+aBase;' +
                    'var ext=Math.max(st.ownRelAt,gateArmActive?globalClickUntil:0,sq2?sq2.lastRel:0);' +
                    'if(ext>st.relAt)st.relAt=ext;' +
                    'if(sq2&&ext>sq2.lastRel)sq2.lastRel=ext;' +
                    'st.gated=true;' +
                  '}else{' +
                    'st.ownRelAt=0;' +
                    'if(activeClickCount===0&&pendingRemoteCount===0&&!(globalClickUntil>performance.now())){' +
                      'st.relAt=0;' +
                      'if(sq2&&sq2.items.length<=1)sq2.lastRel=0;' +
                    '}else{st.relAt=Math.min(st.relAt,globalClickUntil);}' +
                  '}' +
                '}' +
                'if(aInspHitTag){var aHitTb=fireTurboClick(aInspHitTag,t0,holdAsync?{tgt:tgt,st:st,sq:sq2}:null);if(aHitTb)atb=aHitTb;}' +
              '}finally{' +
                'st.asyncCap=0;' +
                'st.pendingAsync=false;' +
                'if(holdAsync){unlockFrame(tgt,st,0);}' +
                'else{st.lockCount=0;st.gated=false;}' +
              '}' +
              'var gA={id:st.id,t0:t0,gated:Boolean(st.gated),gateEstMs:st.relAt>t0?Math.max(0,st.relAt-t0):0,inspHeldMs:aInspHeld};' +
              'if(atb)atb.gate=gA;' +
              'var emitPayload=rawBuf||origFallback;' +
              'if(emitPayload!=null){var aObj={kind:aKind,url:aUrl,gate:gA};if(atb)aObj.turbo=atb;if(aInsp&&aInsp.matched)aObj.insp=aInsp;emitSafe("__TT_PAGE_WS__",aObj,emitPayload);}' +
            '};' +
            'if(isBl){' +
              'ev.data.arrayBuffer().then(function(buf){' +
                'var bgz=getGzInfo(buf);' +
                'if(bgz){tDecomp(bgz.algo,bgz.bytes,function(ub){finishAsync(ub||buf,buf);});}' +
                'else{finishAsync(buf,buf);}' +
              '}).catch(function(){st.asyncCap=0;st.pendingAsync=false;if(holdAsync){st.lockCount=0;unlockFrame(tgt,st,0);}else{st.lockCount=0;st.gated=false;}});' +
            '}else{' +
              'tDecomp(gz.algo,gz.bytes,function(ub){finishAsync(ub,ev.data);});' +
            '}' +
          '}' +
          'return st;' +
        '};' +
        'defHide(window,"__ttPageGateHookFn",gateHookFn);' +
        'function hookOnMsgProto(pr){' +
          'if(!pr||pr.__ttPageOnm)return;' +
          'try{' +
            'var dsc=Object.getOwnPropertyDescriptor(pr,"onmessage");' +
            'if(!dsc||!dsc.set||!dsc.configurable)return;' +
            'defHide(pr,"__ttPageOnm",true);' +
            'var mMap=typeof WeakMap==="function"?new WeakMap():null;' +
            'Object.defineProperty(pr,"onmessage",{configurable:true,enumerable:dsc.enumerable,' +
              'get:function(){return (mMap&&mMap.has(this))?mMap.get(this):(dsc.get?dsc.get.call(this):null);},' +
              'set:function(fn){' +
                'if(typeof fn!=="function"){if(mMap)mMap.delete(this);return dsc.set.call(this,fn);}' +
                'if(mMap)mMap.set(this,fn);' +
                'return dsc.set.call(this,function(ev){' +
                  'var arg=(window.__ttTrustDepth>0&&ev&&typeof ev==="object"&&!ev.isTrusted)?makeTrusted(ev):ev;' +
                  'if(gateHookFn&&isStreamObj(this)){' +
                    'var gst=gateHookFn(this,ev);' +
                    'if(gst&&!gst.flushed&&(gst.gated||gst.lockCount>0||gst.pendingAsync||gst.relAt>0)){gst.queue.push([this,fn,arg]);return;}' +
                  '}' +
                  'return fn.call(this,arg);' +
                '});' +
              '}' +
            '});' +
          '}catch(e){}' +
        '}' +
        (CFG.listenWS ? (
          'if(OW&&OW.prototype){' +
            'var rawOAdd=(typeof ETP!=="undefined"&&oAdd)?oAdd:OW.prototype.addEventListener;' +
            'var attachPW=function(ws,u){' +
              'if(!ws||ws.__ttPagePM||isRelay(u))return;defHide(ws,"__ttPagePM",true);' +
              'try{var pcb=function(e){gateHookFn(ws,e);};pcb.__ttBypassGate=true;rawOAdd.call(ws,"message",pcb);}catch(e){}' +
              'try{var pcbEnd=function(){flushStreamOnClose(ws);};pcbEnd.__ttBypassGate=true;rawOAdd.call(ws,"close",pcbEnd);rawOAdd.call(ws,"error",pcbEnd);}catch(e2){}' +
            '};' +
            'defHide(window,"__ttAttachPW",attachPW);' +
            'var ops=OW.prototype.send;' +
            'if(ops&&!OW.prototype.__ttPagePW){defHide(OW.prototype,"__ttPagePW",true);OW.prototype.send=maskNative(function send(d){' +
              'try{var u=this.url||"";if(!isRelay(u)){attachPW(this,u);tCaptureOutCash(this,d);emitSafe("__TT_PAGE_WS__",{kind:"send",url:u},d);}}catch(e){}' +
              'return ops.apply(this,arguments);' +
            '},ops);}' +
            'hookOnMsgProto(OW.prototype);' +
            'try{window.WebSocket=maskNative(new Proxy(OW,{construct:function(t,a,nt){' +
              'var ws=Reflect.construct(t,a,nt||t),u=String(a&&a[0]||"");' +
              'if(!isRelay(u)){attachPW(ws,u);}' +
              'return ws;' +
            '}}),OW);try{globalThis.WebSocket=window.WebSocket;}catch(e2){}}catch(e){}' +
          '}' +
          'hookSubNet=function(w){' +
            'try{' +
              'if(w.WebSocket&&w.WebSocket.prototype){' +
                'var wOW=w.WebSocket,wAdd=(w.EventTarget&&w.EventTarget.prototype&&w.EventTarget.prototype.addEventListener)?w.EventTarget.prototype.addEventListener:wOW.prototype.addEventListener;' +
                'var attachSubPW=function(ws,u){' +
                  'if(!ws||ws.__ttPagePM||isRelay(u))return;defHide(ws,"__ttPagePM",true);defHide(ws,"__ttSubStream",true);defHide(ws,"__ttSubKind","message");' +
                  'try{var scb=function(e){gateHookFn(ws,e);};scb.__ttBypassGate=true;wAdd.call(ws,"message",scb);}catch(e){}' +
                '};' +
                'hookOnMsgProto(wOW.prototype);' +
                'if(wOW.prototype.send&&!wOW.prototype.__ttPagePW){defHide(wOW.prototype,"__ttPagePW",true);var wOps=wOW.prototype.send;wOW.prototype.send=maskNative(function send(d){try{var u=this.url||"";if(!isRelay(u)){attachSubPW(this,u);tCaptureOutCash(this,d);emitSafe("__TT_PAGE_WS__",{kind:"send",url:u},d);}}catch(e){}return wOps.apply(this,arguments);},wOps);}' +
                'try{w.WebSocket=maskNative(new Proxy(wOW,{construct:function(t,a,nt){var ws=Reflect.construct(t,a,nt||t),u=String(a&&a[0]||"");if(!isRelay(u)){attachSubPW(ws,u);}return ws;}}),wOW);}catch(ew){}' +
              '}' +
              'if(w.Worker&&w.Worker.prototype){hookOnMsgProto(w.Worker.prototype);try{var wWK=w.Worker;w.Worker=maskNative(new Proxy(wWK,{construct:function(t,a,nt){var wk=Reflect.construct(t,a,nt||t);try{defHide(wk,"__ttSubStream",true);defHide(wk,"__ttSubKind","worker");var wcb=function(e){gateHookFn(wk,e);};wcb.__ttBypassGate=true;wk.addEventListener("message",wcb);}catch(ewk){}return wk;}}),wWK);}catch(ewk2){}}' +
            '}catch(esn){}' +
          '};' +
          'var scanSubFrames=function(){' +
            'try{' +
              'var frms=document.querySelectorAll("iframe,frame");' +
              'for(var fi=0;fi<frms.length;fi++){' +
                'var fr=frms[fi];' +
                'try{if(fr.contentWindow&&!fr.contentWindow.__ttPageHooked)hookWinTrust(fr.contentWindow);}catch(efw){}' +
                'if(!fr.__ttSubLoadBound){defHide(fr,"__ttSubLoadBound",true);try{fr.addEventListener("load",function(){try{if(this.contentWindow)hookWinTrust(this.contentWindow);}catch(el){}});}catch(elb){}}' +
              '}' +
            '}catch(esf){}' +
          '};' +
          'var subFrTimer=0;' +
          'var schedSubFr=function(){if(subFrTimer)return;subFrTimer=setTimeout(function(){subFrTimer=0;scanSubFrames();},150);};' +
          'scanSubFrames();' +
          'if(typeof MutationObserver==="function"&&(document.documentElement||document)){' +
            'try{var subFrObs=new MutationObserver(function(muts){if(subFrTimer)return;for(var mi=0;mi<muts.length;mi++){var mt=muts[mi]&&muts[mi].target;if(mt&&(mt.id===HUD_ID||(mt.closest&&mt.closest("#"+HUD_ID))))continue;var an=muts[mi].addedNodes;if(an&&an.length){for(var ai=0;ai<an.length;ai++){var nd=an[ai];if(nd&&nd.id!==HUD_ID&&(nd.tagName==="IFRAME"||nd.tagName==="FRAME"||(nd.querySelector&&nd.querySelector("iframe,frame")))){schedSubFr();return;}}}}});subFrObs.observe(document.documentElement||document,{childList:true,subtree:true});}catch(emo){}' +
          '}' +
          'if(OES){' +
            'if(OES.prototype)hookOnMsgProto(OES.prototype);' +
            'try{window.EventSource=maskNative(new Proxy(OES,{construct:function(t,a,nt){' +
              'var es=Reflect.construct(t,a,nt||t);' +
              'try{if(!isRelay(es.url||"")){var escb=function(e){gateHookFn(es,e);};escb.__ttBypassGate=true;((typeof ETP!=="undefined"&&oAdd)?oAdd:es.addEventListener).call(es,"message",escb);}}catch(e3){}' +
              'return es;' +
            '}}),OES);try{globalThis.EventSource=window.EventSource;}catch(e2){}}catch(e){}' +
          '}' +
          'if(OWK){' +
            'if(OWK.prototype)hookOnMsgProto(OWK.prototype);' +
            'try{window.Worker=maskNative(new Proxy(OWK,{construct:function(t,a,nt){' +
              'var wk=Reflect.construct(t,a,nt||t);' +
              'try{var wkcb=function(e){gateHookFn(wk,e);};wkcb.__ttBypassGate=true;((typeof ETP!=="undefined"&&oAdd)?oAdd:wk.addEventListener).call(wk,"message",wkcb);}catch(e3){}' +
              'return wk;' +
            '}}),OWK);try{globalThis.Worker=window.Worker;}catch(e2){}}catch(e){}' +
          '}' +
          'if(OSW){' +
            'if(typeof MessagePort!=="undefined"&&MessagePort.prototype)hookOnMsgProto(MessagePort.prototype);' +
            'try{window.SharedWorker=maskNative(new Proxy(OSW,{construct:function(t,a,nt){' +
              'var sw=Reflect.construct(t,a,nt||t);' +
              'try{if(sw.port){defHide(sw.port,"__ttSWPort",true);var swcb=function(e){gateHookFn(sw.port,e);};swcb.__ttBypassGate=true;((typeof ETP!=="undefined"&&oAdd)?oAdd:sw.port.addEventListener).call(sw.port,"message",swcb);}}catch(e3){}' +
              'return sw;' +
            '}}),OSW);try{globalThis.SharedWorker=window.SharedWorker;}catch(e2){}}catch(e){}' +
          '}' +
          'if(OBC){' +
            'if(OBC.prototype)hookOnMsgProto(OBC.prototype);' +
            'try{window.BroadcastChannel=maskNative(new Proxy(OBC,{construct:function(t,a,nt){' +
              'var bc=Reflect.construct(t,a,nt||t),cn=String(a&&a[0]||"");' +
              'if(cn.indexOf("__tt")===-1){try{var bccb=function(e){gateHookFn(bc,e);};bccb.__ttBypassGate=true;((typeof ETP!=="undefined"&&oAdd)?oAdd:bc.addEventListener).call(bc,"message",bccb);}catch(e3){}}' +
              'return bc;' +
            '}}),OBC);try{globalThis.BroadcastChannel=window.BroadcastChannel;}catch(e2){}}catch(e){}' +
          '}'
        ) : '') +
        (CFG.listenAPI ? (
          'var of=window.fetch;' +
          'if(typeof of==="function"&&!of.__ttPagePF){var wf=maskNative(function fetch(inp,ini){' +
            'var fRecv=(this===window||this===globalThis||this==null)?window:window;' +
            'var u=typeof inp==="string"?inp:(inp&&(inp.url||inp.href)?(inp.url||inp.href):String(inp||""));' +
            'if(isRelay(u)||isStaticUrl(u))return of.apply(fRecv,arguments);' +
            'var m=String((ini&&ini.method)||(inp&&inp.method)||"GET").toUpperCase();' +
            'var mr=m+" "+u+"\\n";' +
            'try{if(ini&&ini.body!=null){emitSafe("__TT_PAGE_API__",{src:"API-REQ",meta:mr},ini.body);}' +
            'else if(typeof Request!=="undefined"&&inp instanceof Request&&inp.body&&!inp.bodyUsed&&m!=="GET"&&m!=="HEAD"){try{inp.clone().text().then(function(rt){emitSafe("__TT_PAGE_API__",{src:"API-REQ",meta:mr},(rt&&rt.length>65536)?rt.slice(0,65536):(rt||""));}).catch(function(){emitSafe("__TT_PAGE_API__",{src:"API-REQ",meta:mr},"");});}catch(er){emitSafe("__TT_PAGE_API__",{src:"API-REQ",meta:mr},"");}}' +
            'else{emitSafe("__TT_PAGE_API__",{src:"API-REQ",meta:mr},"");}}catch(e){}' +
            'return of.apply(fRecv,arguments).then(function(res){' +
              'try{' +
                'if(seenRes&&res)seenRes.add(res);' +
                'if(!res||!res.body||res.bodyUsed||res.type==="opaque"||res.type==="opaqueredirect"||res.status===204||res.status===205||res.status===304||m==="HEAD")return res;' +
                'var rUrl=res.url||u;var ct=res.headers&&res.headers.get?res.headers.get("content-type"):"";var clLen=res.headers&&res.headers.get?Number(res.headers.get("content-length")||0):0;' +
                'if(isStaticMedia(ct)||isStaticUrl(rUrl)||clLen>131072)return res;' +
                'var ms=res.status+" "+m+" "+rUrl+"\\n";var ctL=String(ct||"").toLowerCase();' +
                'if(ctL.indexOf("text/event-stream")!==-1){try{var sc=res.clone();if(seenRes&&sc)seenRes.add(sc);if(sc.body&&typeof sc.body.getReader==="function"){var rdr=sc.body.getReader(),sDec=typeof TextDecoder!=="undefined"?new TextDecoder("utf-8",{fatal:false}):null;var pump=function(){rdr.read().then(function(st){if(!st||st.done)return;var chunk=sDec?sDec.decode(st.value,{stream:true}):"";if(chunk){var t0=performance.now();var tb=runTurboRaw(chunk,t0,null,null,ms);emitSafe("__TT_PAGE_API__",tb?{src:"API-RES",meta:ms,turbo:tb}:{src:"API-RES",meta:ms},chunk);}pump();}).catch(function(){});};pump();}}catch(es){}return res;}' +
                'if(isTextLike(ct)){var clT=res.clone();if(seenRes&&clT)seenRes.add(clT);(oRespText?oRespText.call(clT):clT.text()).then(function(t){if(!t){emitSafe("__TT_PAGE_API__",{src:"API-RES",meta:ms},"");return;}if(t.length>98304){if(!tCfg.armed)return;t=t.slice(0,98304);}var t0=performance.now();var tb=runTurboRaw(t,t0,null,null,ms);emitSafe("__TT_PAGE_API__",tb?{src:"API-RES",meta:ms,turbo:tb}:{src:"API-RES",meta:ms},t);}).catch(function(){});}' +
                'else if(clLen>0&&clLen<=98304&&(ctL.indexOf("octet-stream")!==-1||ctL.indexOf("msgpack")!==-1||ctL.indexOf("protobuf")!==-1||ctL.indexOf("cbor")!==-1)){var clB=res.clone();if(seenRes&&clB)seenRes.add(clB);clB.arrayBuffer().then(function(b){if(b&&b.byteLength>0&&b.byteLength<=98304){var t0=performance.now();var tb=runTurboRaw(b,t0,null,null,ms);emitSafe("__TT_PAGE_API__",tb?{src:"API-RES",meta:ms,turbo:tb}:{src:"API-RES",meta:ms},b);}}).catch(function(){});}' +
              '}catch(e){}' +
              'return res;' +
            '});' +
          '},of);defHide(wf,"__ttPagePF",true);try{window.fetch=wf;globalThis.fetch=wf;}catch(e){}}' +
          'if(window.XMLHttpRequest&&window.XMLHttpRequest.prototype&&!window.XMLHttpRequest.prototype.__ttPagePXP){' +
            'var xp=window.XMLHttpRequest.prototype,xo=xp.open,xs=xp.send;defHide(xp,"__ttPagePXP",true);' +
            'xp.open=maskNative(function open(m,u){defHide(this,"__ttM",String(m||"GET").toUpperCase());defHide(this,"__ttU",String(u||""));return xo.apply(this,arguments);},xo);' +
            'xp.send=maskNative(function send(b){var x=this;if(isRelay(x.__ttU)||isStaticUrl(x.__ttU))return xs.apply(this,arguments);' +
              'var mr=(x.__ttM||"GET")+" "+(x.__ttU||"")+"\\n";' +
              'try{emitSafe("__TT_PAGE_API__",{src:"API-REQ",meta:mr},b!=null?b:"");}catch(e){}' +
              'if(!x.__ttPagePX){defHide(x,"__ttPagePX",true);x.addEventListener("load",function(){try{var ct=x.getResponseHeader?x.getResponseHeader("content-type"):"";var rUrl=x.responseURL||x.__ttU||"";if(isStaticMedia(ct)||isStaticUrl(rUrl))return;var ms=x.status+" "+(x.__ttM||"")+" "+rUrl+"\\n";var d=(x.responseType==="arraybuffer"||x.responseType==="blob"||x.responseType==="json")?x.response:x.responseText;if(d!=null&&d!==""){if(typeof d==="string"&&d.length>98304){if(!tCfg.armed)return;d=d.slice(0,98304);}else if((d instanceof ArrayBuffer||ArrayBuffer.isView(d))&&(d.byteLength||0)>98304)return;else if(typeof Blob!=="undefined"&&d instanceof Blob&&d.size>98304)return;var strOrBuf=typeof d==="object"&&!(d instanceof ArrayBuffer)&&!ArrayBuffer.isView(d)&&!(typeof Blob!=="undefined"&&d instanceof Blob)?JSON.stringify(d):d;if(typeof strOrBuf==="string"&&strOrBuf.length>98304){if(!tCfg.armed)return;strOrBuf=strOrBuf.slice(0,98304);}var t0=performance.now();var tb=runTurboRaw(strOrBuf,t0,null,null,ms);emitSafe("__TT_PAGE_API__",tb?{src:"API-RES",meta:ms,turbo:tb}:{src:"API-RES",meta:ms},strOrBuf);}}catch(e){}});}' +
              'return xs.apply(this,arguments);' +
            '},xs);' +
          '}'
        ) : '') +
        (CFG.networkTap ? (
          'var rawTapAdd=(typeof ETP!=="undefined"&&oAdd)?oAdd:(window.addEventListener?window.addEventListener:null);' +
          'if(typeof Response!=="undefined"&&Response.prototype&&!Response.prototype.__ttPageRespTap){' +
            'var RP=Response.prototype;defHide(RP,"__ttPageRespTap",true);var inTapRead=false;' +
            'var tapRespRead=function(origFn,name){' +
              'if(typeof origFn!=="function")return origFn;' +
              'return maskNative(function(){' +
                'try{var res=this;var rUrl=res?(res.url||""):"";if(!inTapRead&&tCfg.networkTap&&res&&rUrl&&res.body&&!res.bodyUsed&&res.type!=="opaque"&&res.type!=="opaqueredirect"&&res.status!==204&&res.status!==205&&res.status!==304&&(!seenRes||!seenRes.has(res))&&!isRelay(rUrl)&&!isStaticUrl(rUrl)){' +
                  'var ct=res.headers&&res.headers.get?res.headers.get("content-type"):"";' +
                  'var clLen=res.headers&&res.headers.get?Number(res.headers.get("content-length")||0):0;' +
                  'if(!isStaticMedia(ct)&&clLen<=131072){' +
                    'if(seenRes)seenRes.add(res);' +
                    'var ms=(res.status||200)+" TAP "+rUrl+"\\n";' +
                    'inTapRead=true;try{var clR=res.clone();if(seenRes&&clR)seenRes.add(clR);if(clR&&clR.body){(oRespText?oRespText.call(clR):clR.text()).then(function(txt){if(txt){if(txt.length>98304){if(!tCfg.armed)return;txt=txt.slice(0,98304);}var t0=performance.now();var tb=runTurboRaw(txt,t0,null,null,ms);emitSafe("__TT_PAGE_API__",tb?{src:"TAP-RES",meta:ms,turbo:tb}:{src:"TAP-RES",meta:ms},txt);}}).catch(function(){});}}catch(ec){}finally{inTapRead=false;}' +
                  '}' +
                '}}catch(e){inTapRead=false;}' +
                'return origFn.apply(this,arguments);' +
              '},origFn);' +
            '};' +
            'try{if(RP.json)RP.json=tapRespRead(RP.json,"json");}catch(e){}' +
            'try{if(RP.text)RP.text=tapRespRead(RP.text,"text");}catch(e){}' +
          '}' +
          'if(ORTC&&ORTC.prototype&&!ORTC.prototype.__ttPageRTap){' +
            'defHide(ORTC.prototype,"__ttPageRTap",true);' +
            'hookOnMsgProto(ORTC.prototype);' +
            'var oRtcSend=ORTC.prototype.send;' +
            'if(typeof oRtcSend==="function"){ORTC.prototype.send=maskNative(function send(d){try{if(tCfg.networkTap){if(!this.__ttRtcMsg&&typeof ETP!=="undefined"&&oAdd){defHide(this,"__ttRtcMsg",true);var ch=this;oAdd.call(ch,"message",function(e){gateHookFn(ch,e);});}emitSafe("__TT_PAGE_WS__",{kind:"send",url:"rtc://"+(this.label||"dc")},d);}}catch(e){}return oRtcSend.apply(this,arguments);},oRtcSend);}' +
          '}' +
          'if(ORPC&&ORPC.prototype&&!ORPC.prototype.__ttPageRpcTap){' +
            'defHide(ORPC.prototype,"__ttPageRpcTap",true);' +
            'var oCreateDc=ORPC.prototype.createDataChannel;' +
            'if(typeof oCreateDc==="function"){ORPC.prototype.createDataChannel=maskNative(function createDataChannel(){var ch=oCreateDc.apply(this,arguments);try{if(ch&&!ch.__ttRtcMsg&&typeof ETP!=="undefined"&&oAdd){defHide(ch,"__ttRtcMsg",true);oAdd.call(ch,"message",function(e){gateHookFn(ch,e);});}}catch(e){}return ch;},oCreateDc);}' +
            'try{var oOnDc=Object.getOwnPropertyDescriptor(ORPC.prototype,"ondatachannel");if(oOnDc&&oOnDc.set&&oOnDc.configurable){Object.defineProperty(ORPC.prototype,"ondatachannel",{configurable:true,enumerable:oOnDc.enumerable,get:oOnDc.get,set:function(fn){if(typeof fn!=="function")return oOnDc.set.call(this,fn);return oOnDc.set.call(this,function(ev){try{if(ev&&ev.channel&&!ev.channel.__ttRtcMsg&&typeof ETP!=="undefined"&&oAdd){defHide(ev.channel,"__ttRtcMsg",true);oAdd.call(ev.channel,"message",function(me){gateHookFn(ev.channel,me);});}}catch(e){}return fn.call(this,ev);});}});}}catch(e){}' +
          '}' +
          'if(OWT){' +
            'try{window.WebTransport=maskNative(new Proxy(OWT,{construct:function(t,a,nt){' +
              'var wt=Reflect.construct(t,a,nt||t),wu=String(a&&a[0]||"wt");' +
              'try{if(wt&&wt.datagrams&&wt.datagrams.readable&&typeof wt.datagrams.readable.getReader==="function"){' +
                'var dg=wt.datagrams.readable,oGr=dg.getReader.bind(dg);' +
                'dg.getReader=maskNative(function getReader(){var rdr=oGr.apply(this,arguments);if(rdr&&typeof rdr.read==="function"){var oRd=rdr.read.bind(rdr);rdr.read=function(){return oRd().then(function(res){try{if(res&&!res.done&&res.value!=null&&tCfg.networkTap){var t0=performance.now();var tb=runTurboRaw(res.value,t0);emitSafe("__TT_PAGE_WS__",tb?{kind:"wt",url:wu,turbo:tb}:{kind:"wt",url:wu},res.value);}}catch(e){}return res;});};}return rdr;},dg.getReader);' +
              '}}catch(e2){}' +
              'return wt;' +
            '}}),OWT);try{globalThis.WebTransport=window.WebTransport;}catch(e3){}}catch(e){}' +
          '}' +
          'if(typeof navigator!=="undefined"&&typeof navigator.sendBeacon==="function"&&!navigator.sendBeacon.__ttPageBcn){' +
            'var oBcn=navigator.sendBeacon.bind(navigator);' +
            'var wBcn=maskNative(function sendBeacon(u,d){try{if(tCfg.networkTap&&!isRelay(u))emitSafe("__TT_PAGE_API__",{src:"API-REQ",meta:"BEACON "+String(u||"")+"\\n"},d!=null?d:"");}catch(e){}return oBcn(u,d);},navigator.sendBeacon);' +
            'defHide(wBcn,"__ttPageBcn",true);try{navigator.sendBeacon=wBcn;}catch(e){}' +
          '}' +
          'var isGamePmData=function(d){' +
            'if(d==null)return false;' +
            'var s="";' +
            'if(typeof d==="string"){s=d;}' +
            'else if((tCfg.armed||!tCfg.hudHidden)&&typeof d==="object"&&!(typeof Blob!=="undefined"&&d instanceof Blob)&&!(d instanceof ArrayBuffer)&&!ArrayBuffer.isView(d)){' +
              'if(d.__TT_SNIFFER__||d.__TT_FRAME_CLICK__||d.__tt_gm_msg)return false;' +
              'try{if(Object.keys(d).length>24)return false;s=JSON.stringify(d);}catch(e){return false;}' +
            '}else{return false;}' +
            'if(!s||s.length>24000||s.indexOf("__TT")!==-1||s.indexOf("webpack")!==-1||s.indexOf("react-devtools")!==-1||s.indexOf("vite")!==-1)return false;' +
            'var st=s.trim(),c0=st.charAt(0);if(c0!=="{"&&c0!=="["&&c0!=="<")return false;' +
            'var lc=st.toLowerCase();' +
            'if(c0==="<"&&(lc.indexOf("<!")===0||lc.indexOf("<html")===0||lc.indexOf("<div")===0||lc.indexOf("<script")===0||lc.indexOf("<style")===0))return false;' +
            'return lc.indexOf("coef")!==-1||lc.indexOf("multiplier")!==-1||lc.indexOf("crash")!==-1||lc.indexOf("payout")!==-1||lc.indexOf("cashout")!==-1||lc.indexOf("round")!==-1||lc.indexOf("bet")!==-1||lc.indexOf("arguments")!==-1||lc.indexOf("<hf_")!==-1||lc.indexOf("mul=")!==-1||lc.indexOf("gid=")!==-1;' +
          '};' +
          'var onTapPm=function(ev){' +
            'try{if(!tCfg.networkTap||!ev||!isGamePmData(ev.data))return;var t0=performance.now();var tb=runTurboRaw(ev.data,t0);emitSafe("__TT_PAGE_WS__",tb?{kind:"pm",turbo:tb}:{kind:"pm"},typeof ev.data==="string"?ev.data:JSON.stringify(ev.data));}catch(e){}' +
          '};' +
          'try{if(rawTapAdd){rawTapAdd.call(window,"message",onTapPm);}else{window.addEventListener("message",onTapPm);}}catch(e){}' +
          'try{if(typeof navigator!=="undefined"&&navigator.serviceWorker){((typeof ETP!=="undefined"&&oAdd)?oAdd:navigator.serviceWorker.addEventListener).call(navigator.serviceWorker,"message",onTapPm);}}catch(e){}' +
          'if(typeof PerformanceObserver==="function"){' +
            'try{' +
              'var netSeen=Object.create(null),lastNetEmitAt=0;' +
              'var po=new PerformanceObserver(function(list){' +
                'if(!tCfg.networkTap)return;' +
                'if(!tCfg.armed&&document.readyState!=="complete")return;' +
                'var ents=list.getEntries();' +
                'var nowP=Date.now();' +
                'for(var i=0;i<ents.length;i++){' +
                  'var e=ents[i];if(!e||!e.name||isRelay(e.name)||isStaticUrl(e.name))continue;' +
                  'var it=String(e.initiatorType||"");if(it!=="beacon"&&it!=="other")continue;' +
                  'if(nowP-lastNetEmitAt<150)continue;' +
                  'var uL=e.name.toLowerCase().split("?")[0];' +
                  'if(uL.slice(-5)===".json"||uL.indexOf("/cdn-cgi/")!==-1)continue;' +
                  'var key=it+":"+uL;' +
                  'if(netSeen[key]&&nowP-netSeen[key]<3000)continue;' +
                  'netSeen[key]=nowP;lastNetEmitAt=nowP;' +
                  'emitSafe("__TT_PAGE_API__",{src:"TAP-NET",meta:"[TAP-NET] "+it.toUpperCase()+" "+e.name+" ("+Math.round(e.duration||0)+"ms)"},"");' +
                '}' +
              '});' +
              'po.observe({entryTypes:["resource"]});' +
            '}catch(ep){}' +
          '}'
        ) : '') +
        ((CFG.listenRTF !== false) ? (
          'var rtfLastJsAt=Object.create(null);' +
          'var rtfLastCssAt=Object.create(null);' +
          'var rtfNoiseEv=Object.assign(Object.create(null),{click:1,dblclick:1,contextmenu:1,mousedown:1,mouseup:1,mousemove:1,mouseover:1,mouseout:1,mouseenter:1,mouseleave:1,pointerdown:1,pointerup:1,pointermove:1,pointerover:1,pointerout:1,pointerenter:1,pointerleave:1,pointercancel:1,gotpointercapture:1,lostpointercapture:1,touchstart:1,touchend:1,touchmove:1,touchcancel:1,focus:1,blur:1,focusin:1,focusout:1,input:1,change:1,submit:1,keydown:1,keyup:1,keypress:1,scroll:1,resize:1,wheel:1,load:1,error:1,abort:1,progress:1,animationstart:1,animationend:1,animationiteration:1,transitionstart:1,transitionend:1,transitionrun:1,transitioncancel:1});' +
          'function tRtfSafeJson(val,dp,seen){' +
            'if(val==null||typeof val==="boolean"||typeof val==="number")return val;' +
            'if(typeof val==="string")return val.length>180?val.slice(0,180):val;' +
            'if(typeof val==="function")return "[fn]";' +
            'if(typeof Element!=="undefined"&&val instanceof Element)return "<"+val.tagName.toLowerCase()+(val.id?"#"+val.id:"")+">";' +
            'if(dp>=3)return "[obj]";' +
            'if(typeof val==="object"){' +
              'for(var si=0;si<seen.length;si++){if(seen[si]===val)return "[Circular]";}' +
              'seen.push(val);' +
              'if(Array.isArray(val)){var arr=[];for(var ai=0;ai<Math.min(val.length,8);ai++){arr.push(tRtfSafeJson(val[ai],dp+1,seen));}seen.pop();return arr;}' +
              'var out={},ks=Object.keys(val),lim=Math.min(ks.length,16);' +
              'for(var ki=0;ki<lim;ki++){var k=ks[ki];try{out[k]=tRtfSafeJson(val[k],dp+1,seen);}catch(e){}}' +
              'seen.pop();return out;' +
            '}' +
            'return String(val);' +
          '}' +
          'function tRtfDispatch(src,kind,sig){' +
            'try{' +
              'var t0=performance.now();' +
              'var tb=(tCfg.armed&&tEntries.length)?runTurboRaw(sig,t0):null;' +
              'if(!tb){var nowR=Date.now();var mp=src==="JS-HOOK"?rtfLastJsAt:rtfLastCssAt;var k=(sig.length>90?sig.slice(0,90):sig);if(mp[k]&&nowR-mp[k]<25)return;mp[k]=nowR;}' +
              'document.dispatchEvent(new CustomEvent("__TT_PAGE_RTF__",{detail:JSON.stringify(tb?{src:src,kind:kind,data:sig,turbo:tb}:{src:src,kind:kind,data:sig})}));' +
            '}catch(e){}' +
          '}' +
          'if(tCfg.listenJS!==false&&typeof EventTarget!=="undefined"&&EventTarget.prototype&&typeof EventTarget.prototype.dispatchEvent==="function"&&!EventTarget.prototype.__ttRtfDE){' +
            'var rtfETP=EventTarget.prototype,oRtfDE=rtfETP.dispatchEvent;' +
            'defHide(rtfETP,"__ttRtfDE",true);' +
            'rtfETP.dispatchEvent=maskNative(function dispatchEvent(ev){' +
              'try{' +
                'if(tCfg.listenRTF!==false&&tCfg.listenJS!==false&&ev&&typeof ev.type==="string"){' +
                  'var et=ev.type;' +
                  'if(et.indexOf("__TT_")!==0&&et.indexOf("__triggertap")!==0&&!rtfNoiseEv[et]&&((typeof CustomEvent!=="undefined"&&ev instanceof CustomEvent)||"detail" in ev)){' +
                    'var dTxt="";' +
                    'if(ev.detail!==undefined){try{dTxt=JSON.stringify(tRtfSafeJson(ev.detail,0,[]));}catch(ej){dTxt="";}if(dTxt&&dTxt.length>700)dTxt=dTxt.slice(0,700);}' +
                    'var sig="js:CustomEvent("+JSON.stringify(et)+")"+(dTxt?(" "+dTxt):"");' +
                    'tRtfDispatch("JS-HOOK","JS",sig);' +
                  '}' +
                '}' +
              '}catch(er){}' +
              'return oRtfDE.apply(this,arguments);' +
            '},oRtfDE);' +
          '}' +
          'if((tCfg.listenCSS!==false||tCfg.listenDOM!==false)&&typeof Element!=="undefined"&&Element.prototype&&typeof Element.prototype.attachShadow==="function"&&!Element.prototype.__ttRtfAS){' +
            'var oRtfAS=Element.prototype.attachShadow;' +
            'defHide(Element.prototype,"__ttRtfAS",true);' +
            'Element.prototype.attachShadow=maskNative(function attachShadow(init){' +
              'var sh=oRtfAS.apply(this,arguments);' +
              'try{' +
                'if(sh&&typeof MutationObserver==="function"&&!sh.__ttRtfSObs){' +
                  'defHide(sh,"__ttRtfSObs",true);' +
                  'var srObs=new MutationObserver(function(muts){' +
                    'if(tCfg.listenRTF===false)return;' +
                    'for(var mi=0;mi<muts.length;mi++){' +
                      'var m=muts[mi];if(!m||!m.target)continue;' +
                      'if(m.type==="attributes"&&tCfg.listenCSS!==false){' +
                        'var el=m.target;if(el.nodeType!==1)continue;' +
                        'var tg=el.tagName.toLowerCase();' +
                        'if(tg==="script"||tg==="style"||tg==="link")continue;' +
                        'var cls=typeof el.className==="string"?el.className.trim().split(/\\s+/).slice(0,3).join("."):"";' +
                        'var idp=el.id?("#"+el.id):"";' +
                        'var av=(m.attributeName&&m.attributeName!=="class"&&el.getAttribute)?(el.getAttribute(m.attributeName)||""):"";' +
                        'var atp=av?("["+m.attributeName+"="+String(av).slice(0,24)+"]"):"";' +
                        'if(cls||atp){var tx=(el.textContent||"").replace(/\\s+/g," ").trim().slice(0,80);tRtfDispatch("CSS-STATE","CSS","css:"+tg+idp+(cls?("."+cls):"")+atp+(tx?(" "+tx):""));}' +
                      '}else if(m.type==="childList"&&tCfg.listenDOM!==false&&m.addedNodes){' +
                        'for(var ni=0;ni<m.addedNodes.length;ni++){' +
                          'var nd=m.addedNodes[ni];if(!nd||nd.nodeType!==1)continue;' +
                          'var ntg=nd.tagName.toLowerCase();if(ntg==="script"||ntg==="style"||ntg==="link")continue;' +
                          'var ncls=typeof nd.className==="string"?nd.className.trim().split(/\\s+/).slice(0,2).join("."):"";' +
                          'var nid=nd.id?("#"+nd.id):"";' +
                          'var ntx=(nd.textContent||"").replace(/\\s+/g," ").trim().slice(0,90);' +
                          'if(ncls||nid||ntx)tRtfDispatch("DOM-TAG","DOM","dom:"+ntg+nid+(ncls?("."+ncls):"")+(ntx?(" "+ntx):""));' +
                        '}' +
                      '}' +
                    '}' +
                  '});' +
                  'srObs.observe(sh,{childList:true,subtree:true,attributes:tCfg.listenCSS!==false,attributeFilter:["class","data-state","data-phase","data-status","data-round"]});' +
                '}' +
              '}catch(esr){}' +
              'return sh;' +
            '},oRtfAS);' +
          '}'
        ) : '') +
      '})();';

      const getTtPolicy = () => {
        try {
          if (targetWin.__ttTtPolicy) return targetWin.__ttTtPolicy;
          const ttApi = (targetWin && targetWin.trustedTypes) || (typeof trustedTypes !== 'undefined' ? trustedTypes : null);
          if (!ttApi) return null;
          let pol = null;
          if (typeof ttApi.createPolicy === 'function') {
            try {
              pol = ttApi.createPolicy('triggertap-tt', {
                createHTML: (s) => s,
                createScript: (s) => s,
                createScriptURL: (u) => u
              });
            } catch {
              pol = ttApi.defaultPolicy || null;
            }
          } else {
            pol = ttApi.defaultPolicy || null;
          }
          if (pol) {
            try { targetWin.__ttTtPolicy = pol; } catch {}
          }
          return pol;
        } catch {
          return null;
        }
      };
      const toTrustedScript = (code) => {
        try {
          const pol = getTtPolicy();
          if (pol && typeof pol.createScript === 'function') return pol.createScript(code);
        } catch {}
        return code;
      };
      const toTrustedScriptUrl = (url) => {
        try {
          const pol = getTtPolicy();
          if (pol && typeof pol.createScriptURL === 'function') return pol.createScriptURL(url);
        } catch {}
        return url;
      };

      let gmAddFailed = false;
      let lastTriedNonce = '';
      const attemptPageInject = () => {
        const phSymCheck = typeof Symbol === 'function' ? Symbol.for('__tt.ph') : null;
        const isPageInjectedNow = () => Boolean(
          pageWorldActive ||
          targetWin.__ttPageHooked ||
          (rawPageWin && rawPageWin.__ttPageHooked) ||
          window.__ttPageHooked ||
          (document.documentElement && document.documentElement.getAttribute && document.documentElement.getAttribute('data-tt-page-hooked') === '1') ||
          (phSymCheck && (targetWin[phSymCheck] || window[phSymCheck]))
        );
        if (isPageInjectedNow()) {
          pageWorldActive = true;
          pageInjectPending = false;
          cancelSandboxFallbackTimer();
          if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
          syncTurboCfg(true);
          return true;
        }
        const readCurrentNonce = () => {
          try {
            const nonceEl = document.querySelector && document.querySelector('script[nonce]');
            return nonceEl ? (nonceEl.nonce || nonceEl.getAttribute('nonce') || '') : '';
          } catch {}
          return '';
        };
        const scriptAttrs = { textContent: pageHookCode };
        const initialNonce = readCurrentNonce();
        if (initialNonce) {
          scriptAttrs.nonce = initialNonce;
          lastTriedNonce = initialNonce;
        }

        const tryDirectInlineScript = () => {
          if (isPageInjectedNow()) return true;
          const domTarget = document.head || document.documentElement;
          if (!domTarget) return false;
          const freshNonce = scriptAttrs.nonce || readCurrentNonce();
          if (freshNonce) {
            scriptAttrs.nonce = freshNonce;
            lastTriedNonce = freshNonce;
          }
          try {
            const s = document.createElement('script');
            if (freshNonce) s.setAttribute('nonce', freshNonce);
            s.textContent = toTrustedScript(pageHookCode);
            domTarget.appendChild(s);
            s.remove();
          } catch {}
          return isPageInjectedNow();
        };

        const launchBlobFallback = () => {
          if (isPageInjectedNow()) {
            pageWorldActive = true;
            pageInjectPending = false;
            cancelSandboxFallbackTimer();
            if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
            syncTurboCfg(true);
            return false;
          }
          if (typeof Blob !== 'function' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || !(document.head || document.documentElement)) {
            return false;
          }
          try {
            if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
            pageInjectPending = true;
            const blobUrl = URL.createObjectURL(new Blob([pageHookCode], { type: 'text/javascript' }));
            const freshNonce = scriptAttrs.nonce || readCurrentNonce();
            const bAttrs = { src: blobUrl, async: false };
            if (freshNonce) bAttrs.nonce = freshNonce;
            let bScript = null;
            const gmAddB = (!gmAddFailed && typeof GM_addElement === 'function')
              ? GM_addElement
              : (!gmAddFailed && typeof GM !== 'undefined' && typeof GM.addElement === 'function' ? GM.addElement : null);
            if (typeof gmAddB === 'function') {
              try { bScript = gmAddB('script', bAttrs); } catch {}
              if (!bScript && (document.head || document.documentElement)) {
                try { bScript = gmAddB(document.head || document.documentElement, 'script', bAttrs); } catch {}
              }
            }
            if (!bScript && (document.head || document.documentElement)) {
              const bs = document.createElement('script');
              bs.src = toTrustedScriptUrl(blobUrl);
              bs.async = false;
              if (freshNonce) bs.setAttribute('nonce', freshNonce);
              (document.head || document.documentElement).appendChild(bs);
              bScript = bs;
            }
            let blobCleaned = false;
            const cleanupBlobScript = (elOpt) => {
              if (blobCleaned) return;
              blobCleaned = true;
              pageInjectPending = false;
              pageWorldActive = isPageInjectedNow();
              if (pageWorldActive) {
                cancelSandboxFallbackTimer();
                if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
                syncTurboCfg(true);
              } else {
                scheduleSandboxFallback(0);
              }
              try {
                if (elOpt && elOpt.remove) elOpt.remove();
                else if (bScript && bScript.remove) bScript.remove();
              } catch {}
              try { URL.revokeObjectURL(blobUrl); } catch {}
            };
            if (bScript && typeof bScript.then === 'function') {
              bScript.then((el) => setTimeout(() => cleanupBlobScript(el), 30)).catch(() => setTimeout(() => cleanupBlobScript(null), 20));
              setTimeout(() => cleanupBlobScript(null), 160);
            } else {
              if (bScript && typeof bScript.addEventListener === 'function') {
                bScript.addEventListener('load', () => cleanupBlobScript(bScript), { once: true });
                bScript.addEventListener('error', () => cleanupBlobScript(bScript), { once: true });
              }
              setTimeout(() => cleanupBlobScript(null), 140);
            }
            return true;
          } catch {
            pageInjectPending = false;
            return false;
          }
        };

        let injectedViaGm = false;
        let gmAddPending = false;
        let gmSettled = false;
        const gmAdd = (!gmAddFailed && typeof GM_addElement === 'function')
          ? GM_addElement
          : (!gmAddFailed && typeof GM !== 'undefined' && typeof GM.addElement === 'function' ? GM.addElement : null);
        const wasSandboxInstalledBeforeTry = sandboxFallbacksInstalled;
        if (wasSandboxInstalledBeforeTry && (document.head || document.documentElement || typeof gmAdd === 'function')) {
          uninstallSandboxFallbacks();
        }
        const hasDomRootForGm = Boolean(document.head || document.documentElement);
        try {
          if (typeof gmAdd === 'function') {
            let gmScript = null;
            if (hasDomRootForGm) {
              try {
                gmScript = gmAdd(document.head || document.documentElement, 'script', scriptAttrs);
              } catch {}
            }
            if (!gmScript) {
              try {
                gmScript = gmAdd('script', scriptAttrs);
              } catch {}
            }
            if (gmScript) {
              if (typeof gmScript.then === 'function') {
                gmAddPending = true;
                pageInjectPending = true;
                const onGmAsyncDone = (el) => {
                  if (gmSettled) return;
                  gmSettled = true;
                  try { if (el && typeof el.remove === 'function') el.remove(); } catch {}
                  if (isPageInjectedNow()) {
                    pageWorldActive = true;
                    pageInjectPending = false;
                    cancelSandboxFallbackTimer();
                    if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
                    syncTurboCfg(true);
                  } else {
                    if (document.head || document.documentElement) gmAddFailed = true;
                    if (tryDirectInlineScript()) {
                      pageWorldActive = true;
                      pageInjectPending = false;
                      cancelSandboxFallbackTimer();
                      if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
                      syncTurboCfg(true);
                    } else if (!launchBlobFallback()) {
                      pageInjectPending = false;
                      scheduleSandboxFallback(0);
                    }
                  }
                };
                gmScript.then(onGmAsyncDone).catch(() => onGmAsyncDone(null));
              } else {
                injectedViaGm = true;
                try { if (typeof gmScript.remove === 'function') gmScript.remove(); } catch {}
                if (!isPageInjectedNow() && (document.head || document.documentElement)) gmAddFailed = true;
              }
            } else if (hasDomRootForGm) {
              gmAddFailed = true;
            }
          }
        } catch {
          if (hasDomRootForGm) gmAddFailed = true;
        }
        if (!isPageInjectedNow() && !gmAddPending && (document.head || document.documentElement)) {
          tryDirectInlineScript();
        }
        pageWorldActive = isPageInjectedNow();
        if (pageWorldActive) {
          pageInjectPending = false;
          cancelSandboxFallbackTimer();
          if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
          syncTurboCfg(true);
        } else if (gmAddPending) {
          setTimeout(() => {
            if (!gmSettled && !isPageInjectedNow()) {
              gmSettled = true;
              if (document.head || document.documentElement) gmAddFailed = true;
              if (tryDirectInlineScript()) {
                pageWorldActive = true;
                pageInjectPending = false;
                cancelSandboxFallbackTimer();
                if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
                syncTurboCfg(true);
              } else if (!launchBlobFallback()) {
                pageInjectPending = false;
                scheduleSandboxFallback(0);
              }
            }
          }, 180);
        } else if (document.head || document.documentElement) {
          const blobStarted = launchBlobFallback();
          if (!blobStarted && wasSandboxInstalledBeforeTry) {
            scheduleSandboxFallback(0);
          }
        } else if (wasSandboxInstalledBeforeTry) {
          scheduleSandboxFallback(0);
        }
        return pageWorldActive;
      };

      hadDomMountAtBoot = Boolean(document.head || document.documentElement);
      attemptPageInject();
      if (!pageWorldActive) {
        let nonceInjectObs = null;
        let readyRetryBound = false;
        const stopNonceObs = () => {
          if (nonceInjectObs) {
            try { nonceInjectObs.disconnect(); } catch {}
            nonceInjectObs = null;
          }
          if (readyRetryBound) {
            readyRetryBound = false;
            try { document.removeEventListener('readystatechange', retryPageInject); } catch {}
          }
        };
        const retryPageInject = () => {
          if (isPageInjectedNow()) {
            pageWorldActive = true;
            pageInjectPending = false;
            cancelSandboxFallbackTimer();
            if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
            stopNonceObs();
            return;
          }
          if (attemptPageInject()) {
            stopNonceObs();
          }
        };
        if (typeof MutationObserver === 'function' && (document.documentElement || document)) {
          try {
            let nonceCheckTimer = 0;
            nonceInjectObs = new MutationObserver(() => {
              if (isPageInjectedNow()) {
                pageWorldActive = true;
                pageInjectPending = false;
                cancelSandboxFallbackTimer();
                if (sandboxFallbacksInstalled) uninstallSandboxFallbacks();
                stopNonceObs();
                return;
              }
              if (!hadDomMountAtBoot && (document.head || document.documentElement)) {
                hadDomMountAtBoot = true;
                retryPageInject();
                if (pageWorldActive) return;
              }
              try {
                const nEl = (document.head || document.documentElement) && document.querySelector && document.querySelector('script[nonce]');
                const nVal = nEl ? (nEl.nonce || nEl.getAttribute('nonce') || '') : '';
                if (nVal && nVal !== lastTriedNonce) {
                  if (nonceCheckTimer) { clearTimeout(nonceCheckTimer); nonceCheckTimer = 0; }
                  retryPageInject();
                  return;
                }
              } catch {}
              if (nonceCheckTimer) return;
              nonceCheckTimer = setTimeout(() => {
                nonceCheckTimer = 0;
                if ((document.head || document.documentElement) && (document.querySelector && document.querySelector('script[nonce]'))) {
                  retryPageInject();
                }
              }, 80);
            });
            nonceInjectObs.observe(document.documentElement || document, { childList: true, subtree: true });
            setTimeout(stopNonceObs, 5000);
          } catch {}
        }
        readyRetryBound = true;
        document.addEventListener('readystatechange', retryPageInject);
        document.addEventListener('DOMContentLoaded', () => { stopNonceObs(); retryPageInject(); }, { once: true });
        window.addEventListener('DOMContentLoaded', () => { stopNonceObs(); retryPageInject(); }, { once: true });
      }
    } catch {}
  }

  // --- 1b & 2 & 4. Atomic CSP-Proof Sandbox Fallback Coordinator (activated ONLY if page-world injection fails/blocked; cleanly restorable if page-world activates later) ---
  const sandboxRestorers = [];
  uninstallSandboxFallbacks = () => {
    while (sandboxRestorers.length) {
      const fnR = sandboxRestorers.pop();
      try { if (typeof fnR === 'function') fnR(); } catch {}
    }
    sandboxFallbacksInstalled = false;
  };
  installSandboxFallbacks = () => {
    if (sandboxFallbacksInstalled || pageWorldActive || targetWin.__ttPageHooked || window.__ttPageHooked) return;
    sandboxFallbacksInstalled = true;
    const tw = targetWin;
    if (!tw.__ttClickHooked) {
      try {
        const hadClickHooked = Object.prototype.hasOwnProperty.call(tw, '__ttClickHooked');
        const prevClickHookedDesc = hadClickHooked ? Object.getOwnPropertyDescriptor(tw, '__ttClickHooked') : null;
        const hideFbProp = (o, k, v) => {
          try { Object.defineProperty(o, k, { value: v, writable: true, configurable: true, enumerable: false }); } catch { try { o[k] = v; } catch {} }
        };
        hideFbProp(tw, '__ttClickHooked', true);
        sandboxRestorers.push(() => {
          if (hadClickHooked && prevClickHookedDesc) { try { Object.defineProperty(tw, '__ttClickHooked', prevClickHookedDesc); } catch {} }
          else { try { delete tw.__ttClickHooked; } catch { try { tw.__ttClickHooked = false; } catch {} } }
        });
        hideFbProp(tw, '__ttTrustDepth', tw.__ttTrustDepth || 0);
        const TwWM = tw.WeakMap || WeakMap;
        const TwProxy = tw.Proxy || Proxy;
        const directTrustedCache = typeof TwWM === 'function' ? new TwWM() : null;
        const fakeTouchCapDirect = { firesTouchEvents: true };
      const makeDirectTrusted = (ev) => {
        if (!ev || typeof ev !== 'object' || ev.isTrusted) return ev;
        if (directTrustedCache && directTrustedCache.has(ev)) return directTrustedCache.get(ev);
        try {
          const sh = Object.create(ev);
          const p = new TwProxy(sh, {
            has: (t, k) => k === 'isTrusted' || k === 'sourceCapabilities' || (k in ev),
            get: (t, k) => {
              if (k === 'isTrusted') return true;
              if (k === 'sourceCapabilities') return ev.sourceCapabilities || fakeTouchCapDirect;
              const v = ev[k];
              return typeof v === 'function' ? v.bind(ev) : v;
            },
            set: (t, k, v) => { ev[k] = v; return true; }
          });
          if (directTrustedCache) directTrustedCache.set(ev, p);
          return p;
        } catch {
          return ev;
        }
      };

      const isFbStreamObj = (o) => {
        if (!o || typeof o !== 'object') return false;
        if (NativeWebSocket && o instanceof NativeWebSocket) return !isRelayBrokerUrl(o.url || '');
        if (tw.Worker && o instanceof tw.Worker) return true;
        if (tw.EventSource && o instanceof tw.EventSource) return !isRelayBrokerUrl(o.url || '');
        if (tw.BroadcastChannel && o instanceof tw.BroadcastChannel) return String(o.name || '').indexOf('__tt') === -1;
        if (o.__ttSWPort) return true;
        return false;
      };
      const fbEvCache = typeof TwWM === 'function' ? new TwWM() : null;
      const fbStreamQueues = typeof TwWM === 'function' ? new TwWM() : null;
      const fbActiveGateTgts = [];
      const FB_CRASH_SHIELD_MS = 45;
      let fbPendingRemoteCount = 0;
      let fbRemoteLockSeq = 0;
      const fbPendingRemoteLocks = Object.create(null);
      const isFbEndStr = (s) => {
        if (!s) return false;
        const lc = String(s).toLowerCase();
        const customRaw = String(CFG.holdEvents || '').split(/[,\n\r]+/);
        for (let i = 0; i < customRaw.length; i++) {
          const kw = customRaw[i].trim().toLowerCase();
          if (kw && lc.indexOf(kw) !== -1) return true;
        }
        if (lc.includes('{') || lc.includes('[') || lc.includes('<')) {
          const pkt = analyzeGamePacket('WS-IN', s);
          if (pkt.hasJson || pkt.hasXml) return pkt.isCrash;
        }
        if (lc.indexOf('<hf_end') !== -1 || lc.indexOf('<hf_crash') !== -1 || lc.indexOf('crashx') !== -1 || lc.indexOf('stopcoefficient') !== -1 || lc.indexOf('stop_coefficient') !== -1 || lc.indexOf('stopcoeff') !== -1 || lc.indexOf('endgame') !== -1 || lc.indexOf('game_end') !== -1 || lc.indexOf('game_over') !== -1 || lc.indexOf('round_end') !== -1 || lc.indexOf('round_over') !== -1 || lc.indexOf('round_finish') !== -1 || lc.indexOf('roundfinish') !== -1 || lc.indexOf('game_finish') !== -1 || lc.indexOf('gamefinish') !== -1 || lc.indexOf('stopgame') !== -1 || lc.indexOf('stop_game') !== -1 || lc.indexOf('oncrash') !== -1 || lc.indexOf('onroundend') !== -1 || lc.indexOf('ongameend') !== -1 || lc.indexOf('onfinish') !== -1 || lc.indexOf('crashed') !== -1 || lc.indexOf('fly_away') !== -1 || lc.indexOf('flew') !== -1 || lc.indexOf('busted') !== -1 || lc.indexOf('exploded') !== -1 || lc.indexOf('mine_hit') !== -1 || lc.indexOf('hit_mine') !== -1) return true;
        return /"(?:newstateid|state|status|stage|phase|eventtype|event|type|target)"\s*:\s*(?:"?(?:crash|crashed|end|ended|finish|finished|bust|busted)"?|3\b)|"(?:won|win|iswin)"\s*:\s*false|"(?:result|outcome)"\s*:\s*"?(?:loss|lost)"?/.test(lc);
      };
      const fbTurboFromText = (rawText, t0, gateCtx, isRetryCall) => {
        if (!CFG.armed || !rawText) return null;
        let mTag = matchPayload(rawText);
        const pktFbPre = analyzeGamePacket('WS-IN', rawText);
        updateRoundMetaFromText(rawText, pktFbPre);
        if (mTag === null && CFG.armed && Number(CFG.fallbackMultX) >= 1.01 && (!CFG.roundOnce || !roundClickLocked)) {
          const curMultFb = extractLiveMultFromText(rawText, pktFbPre);
          if (curMultFb !== null && curMultFb >= Number(CFG.fallbackMultX) && Date.now() - lastAutoMultFiredAt >= 600) {
            lastAutoMultFiredAt = Date.now();
            mTag = 'AUTO-X:' + Number(CFG.fallbackMultX).toFixed(2) + 'x';
          }
        }
        if (mTag === null) return null;
        const nowMs = Date.now();
        if (!isRetryCall && nowMs - lastTriggerAt < CFG.cooldownMs) return null;
        if (CFG.roundOnce && roundClickLocked) return null;
        let useFbLocal = Boolean(hudHidden && isIframe && iframeLocalTarget.active && iframeLocalTarget.x >= 0 && iframeLocalTarget.y >= 0);
        if (!useFbLocal && !isDraggingTarget && (!anchor.el || !anchor.el.isConnected)) {
          syncPositionFromAnchor();
        }
        let fastX = Math.round(useFbLocal ? iframeLocalTarget.x : targetX);
        let fastY = Math.round(useFbLocal ? iframeLocalTarget.y : targetY);
        if (hudHidden && isIframe && !useFbLocal) {
          const inFrFb = findFallbackBtnOuter(tw.document || document, Math.round((window.innerWidth || 360) / 2), Math.round((window.innerHeight || 640) / 2));
          if (inFrFb) {
            const ifr = inFrFb.getBoundingClientRect();
            if (ifr.width > 2 && ifr.height > 2) {
              const iDis = Boolean(inFrFb.disabled || (inFrFb.getAttribute && inFrFb.getAttribute('aria-disabled') === 'true'));
              const iTxt = (inFrFb.innerText || inFrFb.textContent || inFrFb.value || '').trim();
              if (!isButtonAlreadyEnded(iTxt, iDis)) {
                fastX = Math.round(ifr.left + ifr.width / 2);
                fastY = Math.round(ifr.top + ifr.height / 2);
                useFbLocal = true;
                iframeLocalTarget = { active: true, x: fastX, y: fastY, locked: true };
              }
            }
          }
        }
        if (!useFbLocal && anchor.el && anchor.el.isConnected && !isOwnHudNode(anchor.el) && anchor.el.tagName !== 'IFRAME') {
          if (!anchor.manual) {
            const ar = anchor.el.getBoundingClientRect();
            if (ar.width > 2 && ar.height > 2) {
              const nx = Math.round(ar.left + ar.width * anchor.relX);
              const ny = Math.round(ar.top + ar.height * anchor.relY);
              if (Math.hypot(nx - targetX, ny - targetY) <= Math.max(window.innerWidth || 360, window.innerHeight || 640) * 0.30) {
                fastX = nx;
                fastY = ny;
                targetX = nx;
                targetY = ny;
              }
            }
          }
        }
        const hasWarmCache = Boolean(
          (!useFbLocal && anchor.el && anchor.el.isConnected && !isOwnHudNode(anchor.el) && anchor.el.tagName !== 'IFRAME') ||
          (fbCachedHitEl && fbCachedHitEl.isConnected && fbCachedHitX === fastX && fbCachedHitY === fastY && !isOwnHudNode(fbCachedHitEl))
        );
        const anchoredEl = (!useFbLocal && anchor.el && anchor.el.isConnected && !isOwnHudNode(anchor.el) && anchor.el.tagName !== 'IFRAME')
          ? anchor.el
          : (hasWarmCache ? fbCachedHitEl : null);
        const zMicro = Math.max(0, Math.min(5, Number(CFG.zeroDelayMicroMs) || 0));
        const holdMs = CFG.zeroDelay ? zMicro : (CFG.humanTap ? 35 : 0);
        const gMs = CFG.preClickGate ? (Number(CFG.gateHoldMs) || 0) : 0;
        const lMs = CFG.preClickGate ? (Number(CFG.wsLeadMs) || 0) : 0;
        const postHold = (CFG.preClickGate || gMs > 0 || lMs > 0) ? Math.max(gMs, lMs, 2) : 0;
        const gSt = gateCtx && gateCtx.st ? gateCtx.st : null;
        const gTgt = gateCtx && gateCtx.tgt ? gateCtx.tgt : null;
        const pktFbInfo = analyzeGamePacket('WS-IN', rawText);
        const pNow = performance.now();
        fbGlobalClickUntil = Math.max(fbGlobalClickUntil, pNow + holdMs + Math.max(gMs, lMs, CFG.preClickGate ? 2 : 0));
        fbLastClickDoneAt = pNow;
        if (typeof tightenFbCrashHolds === 'function') tightenFbCrashHolds(fbGlobalClickUntil);
        const wasOS = Boolean(CFG.oneShot);
        if (hudHidden && !useFbLocal) {
          lastTriggerAt = nowMs;
          if (CFG.roundOnce) {
            roundClickLocked = true;
            roundClickLockedAt = nowMs;
            roundSawFlightAfterLock = false;
            roundSawCrashAfterLock = false;
            roundLastFlightAt = 0;
            roundClickLockedRoundId = pktFbInfo.roundId || '';
          }
          if (wasOS) CFG.armed = false;
          const rToken = 'fbrm_' + (++fbRemoteLockSeq) + '_' + (gSt ? gSt.id : 0);
          if (gSt && typeof lockFbFrame === 'function') {
            const rmCap = Math.max(holdMs + gMs + lMs + 180, 220);
            lockFbFrame(gSt, rmCap);
            fbPendingRemoteCount++;
            const rmEnt = { tgt: gTgt, st: gSt, postHold, done: false, timerId: 0 };
            rmEnt.timerId = setTimeout(() => {
              if (rmEnt.done) return;
              rmEnt.done = true;
              delete fbPendingRemoteLocks[rToken];
              fbPendingRemoteCount = Math.max(0, fbPendingRemoteCount - 1);
              if (typeof unlockFbFrame === 'function') unlockFbFrame(rmEnt.tgt, rmEnt.st, 2);
            }, rmCap);
            fbPendingRemoteLocks[rToken] = rmEnt;
          }
          return { tag: mTag, t0, roundId: pktFbInfo.roundId || '', remoteOnly: true, remoteToken: rToken, gateId: gSt ? gSt.id : 0, timeStr: fmtTimeMs(new Date()), oneShotFired: wasOS };
        }
        lastDomClickMeta = null;
        let clickLockAdded = false;
        if (holdMs > 0 && gSt && typeof lockFbFrame === 'function') {
          lockFbFrame(gSt, Math.max(holdMs + gMs + lMs + 120, 160));
          clickLockAdded = true;
        }
        let clickReleased = false;
        let clickDoneAt = 0;
        const onFbDone = (ok, doneAt) => {
          if (clickReleased) return;
          clickReleased = true;
          clickDoneAt = doneAt || performance.now();
          if (clickLockAdded && typeof unlockFbFrame === 'function') unlockFbFrame(gTgt, gSt, ok ? postHold : 0);
        };
        const prevRootPE = root.style.pointerEvents;
        const prevRootVis = root.style.visibility;
        const prevPanelPE = panel.style.pointerEvents;
        const prevCrossPE = crosshair.style.pointerEvents;
        const needFbHide = !hasWarmCache && typeof document.elementsFromPoint !== 'function';
        root.style.pointerEvents = 'none';
        if (needFbHide) root.style.visibility = 'hidden';
        crosshair.style.pointerEvents = 'none';
        panel.style.pointerEvents = 'none';
        const outCashBeforeFb = lastOutCashSentAt;
        const okClick = dispatchFallbackClickAt(tw.document || document, tw, fastX, fastY, holdMs, anchoredEl, onFbDone, true);
        if (okClick) armCashoutWatchdog(outCashBeforeFb, fastX, fastY, anchoredEl, 'WS-FB');
        if (!okClick && !clickReleased) {
          clickReleased = true;
          if (clickLockAdded && typeof unlockFbFrame === 'function') unlockFbFrame(gTgt, gSt, 0);
        }
        if (needFbHide) root.style.visibility = prevRootVis;
        root.style.pointerEvents = prevRootPE || 'none';
        panel.style.pointerEvents = prevPanelPE;
        if (holdMs > 0) {
          setTimeout(() => { crosshair.style.pointerEvents = locked ? 'none' : (prevCrossPE || 'auto'); }, holdMs + 4);
        } else {
          crosshair.style.pointerEvents = locked ? 'none' : (prevCrossPE || 'auto');
        }
        const fbWrongBtn = Boolean(lastDomClickMeta && isButtonAlreadyEnded(lastDomClickMeta.preText, lastDomClickMeta.disabled));
        if (fbWrongBtn) {
          roundClickLocked = false;
          roundSawCrashAfterLock = false;
          roundLastFlightAt = 0;
          roundClickLockedRoundId = '';
          lastTriggerAt = 0;
          if (wasOS) CFG.armed = true;
          if (!isRetryCall) {
            clearPendingTargetRetry();
            let fbRt = 26;
            let fbRtBusy = false;
            const runFbRt = () => {
              if (fbRtBusy) return;
              if (pendingTargetRetryTimer) { clearTimeout(pendingTargetRetryTimer); pendingTargetRetryTimer = 0; }
              if (!CFG.armed || roundClickLocked || fbRt <= 0) {
                clearPendingTargetRetry();
                return;
              }
              fbRtBusy = true;
              try {
                fbRt -= 1;
                fbCachedHitEl = null;
                if (anchor.el && !anchor.el.isConnected) anchor.el = null;
                const res = fbTurboFromText(rawText, performance.now(), null, true);
                if ((!res || res.preDis || res.wrongBtn) && fbRt > 0) {
                  if (res && (res.preDis || res.wrongBtn)) roundClickLocked = false;
                  pendingTargetRetryTimer = setTimeout(runFbRt, fbRt > 14 ? (CFG.zeroDelay ? 2 : 4) : 12);
                } else {
                  clearPendingTargetRetry();
                }
              } finally {
                fbRtBusy = false;
              }
            };
            if (typeof MutationObserver === 'function' && (document.body || document.documentElement)) {
              try {
                pendingTargetRetryObs = new MutationObserver((muts) => {
                  if (pendingTargetRetryTimer || fbRtBusy) return;
                  let hasGameMut = false;
                  for (let mi = 0; mi < muts.length; mi++) {
                    if (!isOwnHudNode(muts[mi].target)) { hasGameMut = true; break; }
                  }
                  if (hasGameMut) pendingTargetRetryTimer = setTimeout(runFbRt, CFG.zeroDelay ? 2 : 4);
                });
                pendingTargetRetryObs.observe(document.body || document.documentElement, {
                  attributes: true,
                  attributeFilter: ['disabled', 'aria-disabled', 'class', 'style', 'hidden', 'data-state'],
                  childList: true,
                  characterData: true,
                  subtree: true
                });
              } catch {}
            }
            pendingTargetRetryTimer = setTimeout(runFbRt, CFG.zeroDelay ? 2 : 4);
          }
        } else {
          lastTriggerAt = nowMs;
          if (CFG.roundOnce) {
            roundClickLocked = true;
            roundClickLockedAt = nowMs;
            roundSawFlightAfterLock = false;
            roundSawCrashAfterLock = false;
            roundLastFlightAt = 0;
            roundClickLockedRoundId = pktFbInfo.roundId || '';
          }
          if (wasOS) CFG.armed = false;
        }
        const tClick = clickDoneAt || performance.now();
        return {
          tag: mTag,
          t0,
          roundId: roundClickLockedRoundId || pktFbInfo.roundId || '',
          tClick,
          elapsed: (tClick - t0).toFixed(2),
          timeStr: fmtTimeMs(new Date()),
          preText: lastDomClickMeta ? (lastDomClickMeta.preText || '') : '',
          preDis: fbWrongBtn,
          clickX: lastDomClickMeta && typeof lastDomClickMeta.clickX === 'number' ? lastDomClickMeta.clickX : undefined,
          clickY: lastDomClickMeta && typeof lastDomClickMeta.clickY === 'number' ? lastDomClickMeta.clickY : undefined,
          jittered: Boolean(lastDomClickMeta && lastDomClickMeta.jittered),
          wrongBtn: fbWrongBtn,
          oneShotFired: wasOS && !fbWrongBtn,
          fromLocalIframe: Boolean(useFbLocal)
        };
      };

      const getFbGzInfo = (rawData) => {
        try {
          if (!rawData || (!(rawData instanceof ArrayBuffer) && !ArrayBuffer.isView(rawData))) return null;
          const u = rawData instanceof ArrayBuffer ? new Uint8Array(rawData) : new Uint8Array(rawData.buffer, rawData.byteOffset || 0, rawData.byteLength != null ? rawData.byteLength : rawData.length);
          if (u.length < 2) return null;
          if (u[0] === 0x1f && u[1] === 0x8b) return { algo: 'gzip', bytes: u };
          if (u[0] === 0x78 && (u[1] === 0x9c || u[1] === 0xda || u[1] === 0x01 || u[1] === 0x5e)) return { algo: 'deflate', bytes: u };
          if ((u[0] & 0x80) !== 0 && u.length >= 4) {
            const hl = (u[0] & 0x08) !== 0 ? 5 : 3;
            if (u.length > hl) {
              const b = u.subarray(hl);
              if ((u[0] & 0x20) !== 0 || (b.length > 2 && b[0] === 0x78)) return { algo: 'deflate', bytes: b };
            }
          }
          return null;
        } catch { return null; }
      };

      const fbDecomp = (algo, bytes, cb) => {
        if (typeof DecompressionStream === 'undefined' || typeof Response === 'undefined' || typeof Blob === 'undefined') {
          cb(null);
          return;
        }
        const run = (a, retry) => {
          try {
            const ds = new DecompressionStream(a);
            const st = new Blob([bytes]).stream().pipeThrough(ds);
            new Response(st).arrayBuffer().then((buf) => cb(buf)).catch(() => {
              if (retry) run(a === 'deflate' ? 'deflate-raw' : 'deflate', false);
              else cb(null);
            });
          } catch {
            if (retry) run(a === 'deflate' ? 'deflate-raw' : 'deflate', false);
            else cb(null);
          }
        };
        run(algo, algo === 'deflate' || algo === 'deflate-raw');
      };

      const fbStreamKindOf = (tgt) => {
        if ((tw.Worker && tgt instanceof tw.Worker) || (tw.BroadcastChannel && tgt instanceof tw.BroadcastChannel) || (tgt && tgt.__ttSWPort)) return 'WORKER';
        if (tw.EventSource && tgt instanceof tw.EventSource) return 'SSE';
        return 'WS-IN';
      };

      const getFbSq = (tgt) => {
        if (!fbStreamQueues) return null;
        let q = fbStreamQueues.get(tgt);
        if (!q) { q = { items: [], scheduled: false, timerId: 0, lastRel: 0 }; fbStreamQueues.set(tgt, q); }
        return q;
      };
      const trackFbGateTgt = (tgt, sq) => {
        for (let i = 0; i < fbActiveGateTgts.length; i++) { if (fbActiveGateTgts[i].tgt === tgt) return; }
        fbActiveGateTgts.push({ tgt, sq });
        if (fbActiveGateTgts.length > 24) fbActiveGateTgts.shift();
      };
      const untrackFbGateTgt = (tgt) => {
        for (let i = fbActiveGateTgts.length - 1; i >= 0; i--) { if (fbActiveGateTgts[i].tgt === tgt) fbActiveGateTgts.splice(i, 1); }
      };
      const schedFbSq = (tgt, sq, delayMs) => {
        if (sq.timerId) { clearTimeout(sq.timerId); sq.timerId = 0; }
        sq.scheduled = true;
        sq.timerId = setTimeout(() => { sq.timerId = 0; pumpFbSq(tgt); }, Math.max(1, Math.ceil(delayMs)));
      };
      const lockFbFrame = (st, safetyMs) => {
        if (!st || st.flushed) return;
        st.lockCount = (st.lockCount || 0) + 1;
        st.gated = true;
        const cap = performance.now() + Math.max(40, Number(safetyMs) || 150);
        if (cap > (st.lockUntil || 0)) st.lockUntil = cap;
      };
      const enqueueFbFrame = (tgt, sq, st, relAt) => {
        if (!st || st.flushed) return;
        const r = Math.max(st.relAt || 0, relAt || 0);
        st.relAt = r;
        st.gated = true;
        if (sq) {
          if (r > sq.lastRel) sq.lastRel = r;
          if (!st._enq) {
            st._enq = true;
            sq.items.push(st);
            trackFbGateTgt(tgt, sq);
          }
          if (!sq.scheduled) {
            const hw = sq.items.length ? Math.max(1, sq.items[0].relAt - performance.now()) : 1;
            schedFbSq(tgt, sq, hw);
          }
        } else if (!st._fbSched) {
          st._fbSched = true;
          const tickSoloFb = () => {
            const nw = performance.now();
            if (fbActiveClickCount > 0 || fbPendingRemoteCount > 0 || (st.pendingAsync && nw < st.asyncCap) || (st.lockCount > 0 && nw < (st.lockUntil || 0)) || Math.max(st.relAt, fbGlobalClickUntil) > nw) {
              setTimeout(tickSoloFb, 2);
              return;
            }
            st.flushed = true;
            const fAt = performance.now();
            const q = st.queue.splice(0, st.queue.length);
            for (let qi = 0; qi < q.length; qi++) {
              const ent = q[qi];
              try { if (typeof ent[1] === 'function') ent[1].call(ent[0], ent[2]); else if (ent[1] && typeof ent[1].handleEvent === 'function') ent[1].handleEvent(ent[2]); } catch {}
            }
            if (st.gated) applyGateFlush(st.id, fAt);
          };
          setTimeout(tickSoloFb, Math.max(1, Math.ceil(r - performance.now())));
        }
      };
      const unlockFbFrame = (tgt, st, postHoldMs) => {
        if (!st) return;
        if (st.lockCount > 0) st.lockCount--;
        const nw = performance.now();
        if (postHoldMs > 0) {
          const pRel = nw + postHoldMs;
          if (pRel > st.relAt) st.relAt = pRel;
        }
        const sq = tgt ? getFbSq(tgt) : null;
        if (sq && st.relAt > sq.lastRel) sq.lastRel = st.relAt;
        if (st.lockCount === 0 && !st.pendingAsync && st.gated && tgt && sq) {
          if (!st._enq) enqueueFbFrame(tgt, sq, st, Math.max(st.relAt, nw));
          else if (sq.items.length) schedFbSq(tgt, sq, Math.max(1, sq.items[0].relAt - nw));
        }
      };
      const onFbRemoteAck = (ev) => {
        try {
          let d = ev && ev.detail;
          if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
          if (!d || !d.remoteToken) return;
          const ent = fbPendingRemoteLocks[d.remoteToken];
          if (!ent || ent.done) return;
          ent.done = true;
          if (ent.timerId) { clearTimeout(ent.timerId); ent.timerId = 0; }
          delete fbPendingRemoteLocks[d.remoteToken];
          fbPendingRemoteCount = Math.max(0, fbPendingRemoteCount - 1);
          const nAck = performance.now();
          if (d.ok) {
            fbLastClickDoneAt = nAck;
            fbGlobalClickUntil = Math.max(fbGlobalClickUntil, nAck + Math.max(ent.postHold || 0, CFG.preClickGate ? (Number(CFG.gateHoldMs) || 0) : 0, CFG.preClickGate ? (Number(CFG.wsLeadMs) || 0) : 0, 4));
            if (typeof tightenFbCrashHolds === 'function') tightenFbCrashHolds(fbGlobalClickUntil);
          }
          unlockFbFrame(ent.tgt, ent.st, d.ok ? (ent.postHold || 0) : 0);
        } catch {}
      };
      document.addEventListener('__TT_REMOTE_CLICK_ACK__', onFbRemoteAck);
      tw.addEventListener('__TT_REMOTE_CLICK_ACK__', onFbRemoteAck);
      tightenFbCrashHolds = (clickUntil) => {
        if (!fbActiveGateTgts.length) return;
        const now = performance.now();
        for (let ti = fbActiveGateTgts.length - 1; ti >= 0; ti--) {
          const ent = fbActiveGateTgts[ti];
          const sq = ent.sq;
          if (!sq || !sq.items.length) { fbActiveGateTgts.splice(ti, 1); continue; }
          let changed = false;
          for (let j = 0; j < sq.items.length; j++) {
            const it = sq.items[j];
            if (it.isCrashOnly && it.relAt > clickUntil) { it.relAt = clickUntil; changed = true; }
            else if (!it.isCrashOnly && it.ownRelAt > 0) {
              const cap = Math.max(it.ownRelAt, clickUntil);
              if (it.relAt > cap) { it.relAt = cap; changed = true; }
            }
            if (j > 0 && it.relAt < sq.items[j - 1].relAt) it.relAt = sq.items[j - 1].relAt;
          }
          if (changed) {
            sq.lastRel = sq.items[sq.items.length - 1].relAt;
            const nxt = Math.max(sq.items[0].relAt, clickUntil);
            schedFbSq(ent.tgt, sq, nxt - now);
          }
        }
      };
      const pumpFbSq = (tgt) => {
        const sq = getFbSq(tgt);
        if (!sq) return;
        sq.scheduled = false;
        if (sq.timerId) { clearTimeout(sq.timerId); sq.timerId = 0; }
        let now = performance.now();
        if (fbGlobalClickUntil > now + 480) fbGlobalClickUntil = now + 480;
        while (sq.items.length) {
          const head = sq.items[0];
          const forceStale = sq.items.length > 16 || (now - head.t0) >= 120;
          if (!forceStale) {
            if (fbActiveClickCount > 0 || fbPendingRemoteCount > 0) {
              schedFbSq(tgt, sq, 2);
              return;
            }
            if (head.pendingAsync) {
              if (now < head.asyncCap) { schedFbSq(tgt, sq, 2); return; }
              head.pendingAsync = false;
            }
            if (head.lockCount > 0) {
              if (now < (head.lockUntil || 0)) { schedFbSq(tgt, sq, 2); return; }
              head.lockCount = 0;
            }
            const waitUntil = Math.max(head.relAt, fbGlobalClickUntil);
            if (waitUntil > now) {
              schedFbSq(tgt, sq, waitUntil - now);
              return;
            }
          } else {
            head.pendingAsync = false;
            head.lockCount = 0;
          }
          sq.items.shift();
          head.flushed = true;
          const flushedAt = performance.now();
          const calls = head.queue.splice(0, head.queue.length);
          for (let qi = 0; qi < calls.length; qi++) {
            const ent = calls[qi];
            const evArg = ent[2];
            try { if (typeof ent[1] === 'function') ent[1].call(ent[0], evArg); else if (ent[1] && typeof ent[1].handleEvent === 'function') ent[1].handleEvent(evArg); } catch {}
          }
          if (head.gated) applyGateFlush(head.id, flushedAt);
          now = performance.now();
        }
        if (!sq.items.length) untrackFbGateTgt(tgt);
      };
      const gateFbStream = (tgt, ev) => {
        if (!ev || typeof ev !== 'object') return null;
        if (tw.__ttPageHooked || window.__ttPageHooked) {
          const pgFn = tw.__ttPageGateHookFn || window.__ttPageGateHookFn;
          return typeof pgFn === 'function' ? pgFn(tgt, ev) : null;
        }
        if (fbEvCache && fbEvCache.has(ev)) return fbEvCache.get(ev);
        const t0 = performance.now();
        const st = { id: nextFbGateId++, t0, relAt: 0, ownRelAt: 0, flushed: false, gated: false, lockCount: 0, lockUntil: 0, _enq: false, isCrashOnly: false, queue: [], pendingAsync: false, asyncCap: 0, turboInfo: null, asyncHandled: false };
        if (fbEvCache) fbEvCache.set(ev, st);
        const zDelay = Boolean(CFG.zeroDelay);
        const zMicro = Math.max(0, Math.min(5, Number(CFG.zeroDelayMicroMs) || 0));
        const gMs = CFG.preClickGate ? (Number(CFG.gateHoldMs) || 0) : 0;
        const lMs = CFG.preClickGate ? (Number(CFG.wsLeadMs) || 0) : 0;
        const iMs = CFG.inspectorEnabled ? (Number(CFG.inspectorHoldMs) || 0) : 0;
        const preGateOn = Boolean(CFG.preClickGate);
        const cHold = zDelay ? zMicro : (CFG.humanTap ? 35 : 0);
        const isFbHbRaw = (d) => {
          if (d instanceof ArrayBuffer || ArrayBuffer.isView(d)) return (d.byteLength || 0) <= 2;
          if (typeof d !== 'string') return false;
          const s = d.split(String.fromCharCode(30)).join('').trim();
          if (!s || s === '0' || s === '1' || s === '2' || s === '3' || s === '2probe' || s === '3probe' || s === '40' || s === 'h' || s === 'o' || s === 'ping' || s === 'pong' || s === 'hb' || s === 'heartbeat' || s === 'keepalive') return true;
          if (s.charAt(0) === '{' && s.length <= 112) {
            if (s.indexOf('"ping"') !== -1 || s.indexOf('"pong"') !== -1 || s.indexOf('"heartbeat"') !== -1 || s.indexOf('"keepalive"') !== -1 || s.indexOf('"welcome"') !== -1 || s.indexOf('"confirm_subscription"') !== -1 || s.indexOf('6') !== -1) {
              try { const o = JSON.parse(s); return Boolean(o && (o.type === 6 || o.type === 'ping' || o.type === 'pong' || o.type === 'heartbeat' || o.type === 'keepalive' || o.type === 'welcome' || o.type === 'confirm_subscription')); } catch {}
            }
          }
          return false;
        };
        const isHb = isFbHbRaw(ev.data);
        const compInsp = getCompiledInspector();
        const hasInsp = Boolean(compInsp.enabled && (compInsp.kws.length || compInsp.rxs.length || compInsp.jps.length));
        const fbHoldAllMs = (!isHb && CFG.inspectorEnabled && CFG.inspectorHoldAllWs && iMs > 0) ? iMs : 0;
        const fbAutoHoldArmed = Boolean(!isHb && CFG.inspectorEnabled && CFG.inspectorAutoClick && CFG.armed);
        const fbInspGateActive = Boolean(!isHb && hasInsp && iMs > 0 && (CFG.armed || fbHoldAllMs > 0 || fbAutoHoldArmed));
        const sq = getFbSq(tgt);
        const hasPendingQ = Boolean(!isHb && sq && sq.items.length > 0);
        const armOrRecent = Boolean(!isHb && (CFG.armed || fbGlobalClickUntil > t0 || fbActiveClickCount > 0 || fbPendingRemoteCount > 0));
        const gateArmActive = Boolean(armOrRecent && (preGateOn || gMs > 0 || lMs > 0));
        const activeGate = Boolean(gateArmActive || hasPendingQ || fbInspGateActive || fbHoldAllMs > 0 || fbAutoHoldArmed);
        const isBl = (!isHb && typeof Blob !== 'undefined' && ev.data instanceof Blob);
        const gz = (!isBl && !isHb) ? getFbGzInfo(ev.data) : null;
        const needsDecomp = Boolean(gz && (activeGate || CFG.armed));
        const fbSrc = fbSrcKindOfSafe(tgt);

        function fbSrcKindOfSafe(obj) {
          try { return fbStreamKindOf(obj); } catch { return 'WS-IN'; }
        }

        if (!isBl && !needsDecomp) {
          let quickStr = '';
          if (typeof ev.data === 'string') {
            quickStr = ev.data;
          } else if (ev.data instanceof ArrayBuffer || ArrayBuffer.isView(ev.data)) {
            try {
              const u = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : new Uint8Array(ev.data.buffer, ev.data.byteOffset || 0, ev.data.byteLength != null ? ev.data.byteLength : ev.data.length);
              const dec = decodeBytesSync(u);
              if (dec && !dec.compressed) quickStr = dec.text || '';
            } catch {}
          } else if (ev.data && typeof ev.data === 'object') {
            try { quickStr = JSON.stringify(ev.data); } catch {}
          }
          if (!activeGate || (zDelay && cHold <= 0 && !preGateOn && !hasPendingQ && !fbInspGateActive && !fbHoldAllMs && !fbAutoHoldArmed)) {
            st.gated = false;
            if (!isHb && quickStr) {
              st.turboInfo = fbTurboFromText(quickStr, t0, null);
            }
            st.deferLogOnly = true;
            st.deferSrc = fbSrc;
            return st;
          }
          const evalLocked = Boolean(!isHb && activeGate);
          if (evalLocked) lockFbFrame(st, Math.max(gMs + lMs + cHold + 120, iMs + 120, 160));
          let fbInsp = { matched: false, reasons: [] };
          let fbInspHeldMs = fbHoldAllMs;
          try {
            if (quickStr) {
              st.turboInfo = fbTurboFromText(quickStr, t0, { tgt, st, sq });
            }
            fbInsp = (quickStr && fbInspGateActive) ? inspectTextPayload(quickStr) : { matched: false, reasons: [] };
            fbInspHeldMs = Math.max(fbHoldAllMs, (fbInspGateActive && fbInsp.matched && iMs > 0) ? iMs : 0);
            let fbInspHitTag = null;
            if (activeGate || st.turboInfo) {
              const now = performance.now();
              const isMatched = Boolean(st.turboInfo) || Boolean(quickStr && CFG.armed && matchPayload(quickStr) !== null);
              const isCrash = Boolean(!isHb && (gateArmActive || fbAutoHoldArmed) && quickStr && isFbEndStr(quickStr));
              if (fbAutoHoldArmed && !isMatched && parseTagList(CFG.tags || '').length === 0 && (!CFG.roundOnce || !roundClickLocked) && ((fbInsp.matched && fbInsp.reasons.length) || isCrash)) {
                fbInspHitTag = (fbInsp.matched && fbInsp.reasons.length) ? ('HOLD:' + fbInsp.reasons[0]) : 'HOLD:CRASH';
                fbInspHeldMs = Math.max(fbInspHeldMs, iMs > 0 ? iMs : (isCrash ? FB_CRASH_SHIELD_MS : 25), 20);
              }
              const isCrashOrMatch = isMatched || isCrash || Boolean(fbInspHitTag);
              const recentClk = Boolean(fbGlobalClickUntil > now || fbActiveClickCount > 0 || fbPendingRemoteCount > 0 || (fbLastClickDoneAt > 0 && now - fbLastClickDoneAt < 400));
              st.isCrashOnly = Boolean(gateArmActive && isCrash && !isMatched && !fbInspHitTag && CFG.armed && !recentClk);
              const prevRel = sq ? sq.lastRel : 0;
              const fbBusy = Boolean(fbActiveClickCount > 0 || fbPendingRemoteCount > 0);
              const minMatchHold = (isMatched && (isCrash || fbBusy || gMs > 0 || cHold > 0)) ? Math.max(gMs, (isCrash || fbBusy) ? lMs : 0, 2) : 0;
              const clickDelay = !gateArmActive ? minMatchHold : (st.isCrashOnly ? Math.max(gMs, lMs, FB_CRASH_SHIELD_MS) : (isCrash ? Math.max(gMs, lMs, minMatchHold) : minMatchHold));
              const baseDelay = Math.max(clickDelay, fbInspHeldMs);
              st.ownRelAt = baseDelay > 0 ? (now + baseDelay) : 0;
              let relAt = Math.max(st.ownRelAt, hasPendingQ ? prevRel : 0);
              if (gateArmActive && (isCrash || fbBusy)) {
                relAt = Math.max(relAt, fbGlobalClickUntil);
              }
              if (fbInspHitTag && Date.now() - lastTriggerAt >= CFG.cooldownMs) {
                lastTriggerAt = Date.now();
                if (CFG.oneShot) CFG.armed = false;
                lockFbFrame(st, Math.max(cHold + gMs + lMs + 120, 160));
                const postH = (preGateOn || gMs > 0 || lMs > 0) ? Math.max(gMs, lMs, 2) : 0;
                fireTargetClick('WS-IN[' + fbInspHitTag + ']', t0, (ok) => unlockFbFrame(tgt, st, ok ? postH : 0));
              }
              const fbBypassQ = Boolean(zDelay && !isMatched && !isCrash && !fbInspHeldMs && !hasPendingQ && fbActiveClickCount === 0 && fbPendingRemoteCount === 0);
              const mustQueue = !fbBypassQ && Boolean(hasPendingQ || relAt > now || st.lockCount > 1 || fbActiveClickCount > 0 || fbPendingRemoteCount > 0 || (isMatched && (isCrash || cHold > 0 || gMs > 0)));
              if (mustQueue) {
                enqueueFbFrame(tgt, sq, st, Math.max(relAt, now + (baseDelay > 0 ? baseDelay : 1)));
              } else {
                st.gated = false;
              }
            } else {
              st.gated = false;
            }
          } finally {
            if (!st._enq && !st.pendingAsync && st.lockCount <= 1) st.gated = false;
            if (evalLocked) unlockFbFrame(tgt, st, 0);
          }
          st.insp = fbInsp.matched ? fbInsp : null;
          st.inspHeldMs = fbInspHeldMs;
        } else {
          st.asyncHandled = true;
          const fbClickBusyA = Boolean(fbActiveClickCount > 0 || fbPendingRemoteCount > 0 || fbGlobalClickUntil > t0);
          const holdAsync = Boolean(!isHb && (hasPendingQ || fbClickBusyA || fbHoldAllMs > 0 || fbInspGateActive || fbAutoHoldArmed || (!zDelay && (cHold > 0 || preGateOn || (CFG.armed && (gMs > 0 || lMs > 0))))));
          if (holdAsync) {
            const nowA = performance.now();
            st.pendingAsync = true;
            const fbCapMs = zDelay ? Math.max(gMs + lMs + 100, iMs + 100, 140) : Math.max(gMs + lMs + 350, iMs + 350, 520);
            st.asyncCap = t0 + fbCapMs;
            lockFbFrame(st, fbCapMs);
            const prevRelA = sq ? sq.lastRel : 0;
            st.ownRelAt = nowA + Math.max(gateArmActive ? lMs : 0, 2);
            const relAtA = Math.max(st.ownRelAt, prevRelA, gateArmActive ? fbGlobalClickUntil : 0);
            enqueueFbFrame(tgt, sq, st, relAtA);
          }
          const finishFbAsync = (rawBuf, fallbackBuf) => {
            let aText = '';
            let aTb = null;
            const sq2 = holdAsync ? getFbSq(tgt) : null;
            let aInsp = { matched: false, reasons: [] };
            let aInspHeld = fbHoldAllMs;
            try {
              if (rawBuf instanceof ArrayBuffer || ArrayBuffer.isView(rawBuf)) {
                const u = rawBuf instanceof ArrayBuffer ? new Uint8Array(rawBuf) : new Uint8Array(rawBuf.buffer, rawBuf.byteOffset || 0, rawBuf.byteLength != null ? rawBuf.byteLength : rawBuf.length);
                const dec = decodeBytesSync(u);
                aText = dec ? dec.text : '';
                if (aText) aTb = fbTurboFromText(aText, t0, holdAsync ? { tgt, st, sq: sq2 } : null);
              }
              const isCr = (aText && (gateArmActive || fbAutoHoldArmed)) ? isFbEndStr(aText) : false;
              aInsp = (aText && hasInsp) ? inspectTextPayload(aText) : { matched: false, reasons: [] };
              let aInspHitTag = null;
              if (fbAutoHoldArmed && aTb === null && ((aInsp.matched && aInsp.reasons.length) || isCr)) {
                aInspHitTag = (aInsp.matched && aInsp.reasons.length) ? ('HOLD:' + aInsp.reasons[0]) : 'HOLD:CRASH';
              }
              aInspHeld = Math.max(fbHoldAllMs, (aInsp.matched && iMs > 0) ? iMs : 0, aInspHitTag ? (iMs > 0 ? iMs : (isCr ? FB_CRASH_SHIELD_MS : 25)) : 0);
              const isMatchedA = (aTb !== null || aInspHitTag !== null);
              if (holdAsync) {
                if (isMatchedA || isCr || aInspHeld > 0) {
                  const n2 = performance.now();
                  const recentClk2 = Boolean(fbGlobalClickUntil > n2 || fbActiveClickCount > 0 || fbPendingRemoteCount > 0 || (fbLastClickDoneAt > 0 && n2 - fbLastClickDoneAt < 400));
                  st.isCrashOnly = Boolean(gateArmActive && isCr && !isMatchedA && CFG.armed && !recentClk2);
                  const aMinM = (isMatchedA && (preGateOn || gMs > 0 || lMs > 0 || cHold > 0 || hudHidden)) ? Math.max(gMs, lMs, preGateOn ? 2 : 0) : 0;
                  const aClickBase = (gateArmActive && (isMatchedA || isCr)) ? (st.isCrashOnly ? Math.max(gMs, lMs, FB_CRASH_SHIELD_MS) : Math.max(gMs, lMs, aMinM)) : aMinM;
                  const aBase = Math.max(aClickBase, aInspHeld);
                  st.ownRelAt = n2 + aBase;
                  const ext = Math.max(st.ownRelAt, gateArmActive ? fbGlobalClickUntil : 0, sq2 ? sq2.lastRel : 0);
                  if (ext > st.relAt) st.relAt = ext;
                  if (sq2 && ext > sq2.lastRel) sq2.lastRel = ext;
                  st.gated = true;
                } else {
                  st.ownRelAt = 0;
                  if (fbActiveClickCount === 0 && fbPendingRemoteCount === 0 && !(fbGlobalClickUntil > performance.now())) {
                    st.relAt = 0;
                    if (sq2 && sq2.items.length <= 1) sq2.lastRel = 0;
                  } else {
                    st.relAt = Math.min(st.relAt, fbGlobalClickUntil);
                  }
                }
              }
              if (aInspHitTag && Date.now() - lastTriggerAt >= CFG.cooldownMs) {
                lastTriggerAt = Date.now();
                if (CFG.oneShot) CFG.armed = false;
                if (holdAsync) lockFbFrame(st, Math.max(cHold + gMs + lMs + 120, 160));
                const postHA = (preGateOn || gMs > 0 || lMs > 0) ? Math.max(gMs, lMs, 2) : 0;
                fireTargetClick('WS-IN[' + aInspHitTag + ']', t0, holdAsync ? (ok) => unlockFbFrame(tgt, st, ok ? postHA : 0) : undefined);
              }
            } finally {
              st.asyncCap = 0;
              st.pendingAsync = false;
              if (holdAsync) unlockFbFrame(tgt, st, 0);
              else { st.lockCount = 0; st.gated = false; }
            }
            const gInfo = { id: st.id, t0, gated: Boolean(st.gated), gateEstMs: st.relAt > t0 ? Math.max(0, st.relAt - t0) : 0, insp: aInsp.matched ? aInsp : null, inspHeldMs: aInspHeld };
            if (aTb) aTb.gate = gInfo;
            const emitBuf = rawBuf || fallbackBuf;
            if (emitBuf != null) processRawData(fbSrc, emitBuf, '', aTb, gInfo);
          };
          if (isBl) {
            ev.data.arrayBuffer().then((buf) => {
              const bgz = getFbGzInfo(buf);
              if (bgz) fbDecomp(bgz.algo, bgz.bytes, (ub) => finishFbAsync(ub || buf, buf));
              else finishFbAsync(buf, buf);
            }).catch(() => {
              st.asyncCap = 0;
              st.pendingAsync = false;
              if (holdAsync) { st.lockCount = 0; unlockFbFrame(tgt, st, 0); }
              else { st.lockCount = 0; st.gated = false; }
            });
          } else if (gz) {
            fbDecomp(gz.algo, gz.bytes, (ub) => finishFbAsync(ub || ev.data, ev.data));
          }
          return st;
        }
        return st;
      };
      const expFn = (typeof exportFunction === 'function') ? exportFunction : null;
      const twGateExport = (expFn && rawPageWin && rawPageWin !== window) ? (() => { try { return expFn(gateFbStream, rawPageWin); } catch { return gateFbStream; } })() : gateFbStream;
      const twIsStreamExport = (expFn && rawPageWin && rawPageWin !== window) ? (() => { try { return expFn(isFbStreamObj, rawPageWin); } catch { return isFbStreamObj; } })() : isFbStreamObj;
      hideFbProp(tw, '__ttGateFbStream', twGateExport);
      hideFbProp(tw, '__ttIsFbStreamObj', twIsStreamExport);
      if (tw !== window) {
        hideFbProp(window, '__ttGateFbStream', gateFbStream);
        hideFbProp(window, '__ttIsFbStreamObj', isFbStreamObj);
      }

      const TwET = tw.EventTarget;
      const fbClickEv = Object.assign(Object.create(null), {
        click: 1, dblclick: 1, contextmenu: 1,
        pointerdown: 1, pointerup: 1, pointerover: 1, pointerenter: 1, pointermove: 1, pointerout: 1, pointerleave: 1, pointercancel: 1, gotpointercapture: 1, lostpointercapture: 1,
        touchstart: 1, touchend: 1, touchmove: 1, touchcancel: 1,
        mousedown: 1, mouseup: 1, mouseover: 1, mouseenter: 1, mousemove: 1, mouseout: 1, mouseleave: 1
      });
      if (TwET && TwET.prototype && !TwET.prototype.__ttAEP) {
        const ETP = TwET.prototype;
        const oAdd = ETP.addEventListener;
        const oRem = ETP.removeEventListener;
        const lMap = typeof TwWM === 'function' ? new TwWM() : null;
        ETP.__ttAEP = true;
        ETP.addEventListener = function (type, fn, opts) {
          if (!fn || (typeof fn !== 'function' && typeof fn.handleEvent !== 'function') || fn.__ttBypassGate) {
            return oAdd.call(this, type, fn, opts);
          }
          const isMsgStream = (type === 'message' && isFbStreamObj(this)) || (tw.EventSource && this instanceof tw.EventSource && !isRelayBrokerUrl(this.url || ''));
          if (!fbClickEv[type] && !isMsgStream) {
            return oAdd.call(this, type, fn, opts);
          }
          let w = lMap ? lMap.get(fn) : null;
          if (!w) {
            w = function (ev) {
              const arg = (tw.__ttTrustDepth > 0 && ev && typeof ev === 'object' && !ev.isTrusted) ? makeDirectTrusted(ev) : ev;
              if (!pageWorldActive && !tw.__ttPageHooked && !window.__ttPageHooked && ev && (ev.type === 'message' || (tw.EventSource && this instanceof tw.EventSource && 'data' in ev)) && isFbStreamObj(this)) {
                const fst = gateFbStream(this, ev);
                if (fst && !fst.flushed && (fst.gated || fst.lockCount > 0 || fst.pendingAsync || fst.relAt > 0)) { fst.queue.push([this, fn, arg]); return; }
              }
              return typeof fn === 'function' ? fn.call(this, arg) : fn.handleEvent(arg);
            };
            if (lMap) lMap.set(fn, w);
          }
          return oAdd.call(this, type, w, opts);
        };
        ETP.removeEventListener = function (type, fn, opts) {
          if (!fbClickEv[type] && type !== 'message' && !(tw.EventSource && this instanceof tw.EventSource)) {
            return oRem.call(this, type, fn, opts);
          }
          const w = (lMap && fn && (typeof fn === 'function' || typeof fn === 'object')) ? (lMap.get(fn) || fn) : fn;
          return oRem.call(this, type, w, opts);
        };
        sandboxRestorers.push(() => {
          try { ETP.addEventListener = oAdd; } catch {}
          try { ETP.removeEventListener = oRem; } catch {}
          try { delete ETP.__ttAEP; } catch { try { ETP.__ttAEP = false; } catch {} }
        });
      }

      const ohProtos = [];
      if (tw.HTMLElement && tw.HTMLElement.prototype) ohProtos.push(tw.HTMLElement.prototype);
      if (tw.Document && tw.Document.prototype) ohProtos.push(tw.Document.prototype);
      if (tw.SVGElement && tw.SVGElement.prototype) ohProtos.push(tw.SVGElement.prototype);
      const onProps = ['onclick', 'onpointerdown', 'onpointerup', 'ontouchstart', 'ontouchend', 'onmousedown', 'onmouseup'];
      for (let pi = 0; pi < ohProtos.length; pi++) {
        const pr = ohProtos[pi];
        if (pr.__ttOHP) continue;
        pr.__ttOHP = true;
        sandboxRestorers.push(() => { try { delete pr.__ttOHP; } catch { try { pr.__ttOHP = false; } catch {} } });
        for (let oi = 0; oi < onProps.length; oi++) {
          const prop = onProps[oi];
          try {
            const desc = Object.getOwnPropertyDescriptor(pr, prop);
            if (!desc || !desc.set || !desc.get || !desc.configurable) continue;
            const rawMap = typeof TwWM === 'function' ? new TwWM() : null;
            Object.defineProperty(pr, prop, {
              configurable: true,
              enumerable: desc.enumerable,
              get: function () { return rawMap && rawMap.has(this) ? rawMap.get(this) : desc.get.call(this); },
              set: function (fn) {
                if (typeof fn !== 'function') {
                  if (rawMap) rawMap.delete(this);
                  return desc.set.call(this, fn);
                }
                if (rawMap) rawMap.set(this, fn);
                return desc.set.call(this, function (ev) {
                  const arg = (tw.__ttTrustDepth > 0 && ev && typeof ev === 'object' && !ev.isTrusted) ? makeDirectTrusted(ev) : ev;
                  return fn.call(this, arg);
                });
              }
            });
            sandboxRestorers.push(() => { try { Object.defineProperty(pr, prop, desc); } catch {} });
          } catch {}
        }
      }

      if (tw.Element && tw.Element.prototype) {
        const EP = tw.Element.prototype;
        const oSPC = EP.setPointerCapture;
        const oRPC = EP.releasePointerCapture;
        if (oSPC && !oSPC.__ttSPC) {
          const wSPC = function (id) {
            if (tw.__ttTrustDepth > 0) { try { return oSPC.call(this, id); } catch { return; } }
            return oSPC.apply(this, arguments);
          };
          wSPC.__ttSPC = true;
          try {
            EP.setPointerCapture = wSPC;
            sandboxRestorers.push(() => { try { EP.setPointerCapture = oSPC; } catch {} });
          } catch {}
        }
        if (oRPC && !oRPC.__ttRPC) {
          const wRPC = function (id) {
            if (tw.__ttTrustDepth > 0) { try { return oRPC.call(this, id); } catch { return; } }
            return oRPC.apply(this, arguments);
          };
          wRPC.__ttRPC = true;
          try {
            EP.releasePointerCapture = wRPC;
            sandboxRestorers.push(() => { try { EP.releasePointerCapture = oRPC; } catch {} });
          } catch {}
        }
      }

      const onDirectClickCmd = function (ev) {
        try {
          const phS = typeof Symbol === 'function' ? Symbol.for('__tt.ph') : null;
          if (pageWorldActive || tw.__ttPageHooked || window.__ttPageHooked || (phS && (tw[phS] || window[phS]))) return;
          let d = ev && ev.detail;
          if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
          if (!d || typeof d.x !== 'number' || typeof d.y !== 'number') return;
          lastDomClickMeta = null;
          const ok = dispatchFallbackClickAt(tw.document || document, tw, d.x, d.y, d.holdMs || 0, null);
          try { Object.defineProperty(tw, '__ttPageClickDone', { value: ok, writable: true, configurable: true, enumerable: false }); } catch { tw.__ttPageClickDone = ok; }
          const cdS = typeof Symbol === 'function' ? Symbol.for('__tt.cd') : null;
          if (ok && cdS) { try { tw[cdS] = true; } catch {} }
          try {
            document.dispatchEvent(new CustomEvent('__TT_PAGE_CLICK_ACK__', { detail: JSON.stringify({ ok: Boolean(ok), meta: lastDomClickMeta || null }) }));
          } catch {}
        } catch {}
      };
      document.addEventListener('__TT_PAGE_CLICK__', onDirectClickCmd);
      tw.addEventListener('__TT_PAGE_CLICK__', onDirectClickCmd);
      sandboxRestorers.push(() => {
        try { document.removeEventListener('__TT_PAGE_CLICK__', onDirectClickCmd); } catch {}
        try { tw.removeEventListener('__TT_PAGE_CLICK__', onDirectClickCmd); } catch {}
      });
    } catch {}
    }

    // --- 2. Sandbox Fallback WebSocket Interceptor (used only if page-world injection blocked by strict CSP) ---
    const OrigWS = NativeWebSocket;
    if (CFG.listenWS && OrigWS) {
      const origProtoAdd = OrigWS.prototype.addEventListener;
      const origSend = OrigWS.prototype.send;

      const attachTT = function (ws, resolvedUrl) {
        if (!ws || ws.__tt_hooked_ws || pageWorldActive || targetWin.__ttPageHooked || window.__ttPageHooked) return;
        const u = resolvedUrl || ws.url || '';
        if (isRelayBrokerUrl(u)) return;
        ws.__tt_hooked_ws = true;
        const onTtWsMsg = function (ev) {
          if (ws.__ttPagePM) return;
          if (pageWorldActive || targetWin.__ttPageHooked || window.__ttPageHooked) {
            const pgFn = targetWin.__ttPageGateHookFn || window.__ttPageGateHookFn;
            if (typeof pgFn === 'function') pgFn(ws, ev);
            return;
          }
          let fst = null;
          if (typeof targetWin.__ttGateFbStream === 'function') {
            fst = targetWin.__ttGateFbStream(ws, ev);
          }
          if (fst && fst.asyncHandled) return;
          const evPayload = ev.data;
          if (fst && !fst.gated && !CFG.preClickGate && fst.deferLogOnly) {
            const dGate = { id: fst.id, t0: fst.t0, gated: false, gateEstMs: 0, insp: null, inspHeldMs: 0 };
            const dTb = fst.turboInfo || null;
            if (dTb) dTb.gate = dGate;
            const dSrc = fst.deferSrc || 'WS-IN';
            scheduleMicro(() => {
              processRawData(dSrc, evPayload, '', dTb, dGate);
            });
            return;
          }
          const gInfo = fst ? { id: fst.id, t0: fst.t0, gated: Boolean(fst.gated), gateEstMs: fst.relAt > fst.t0 ? Math.max(0, fst.relAt - fst.t0) : 0, insp: fst.insp || null, inspHeldMs: fst.inspHeldMs || 0 } : null;
          const tb = fst && fst.turboInfo ? fst.turboInfo : null;
          if (tb && gInfo) tb.gate = gInfo;
          processRawData('WS-IN', evPayload, '', tb, gInfo);
        };
        onTtWsMsg.__ttBypassGate = true;
        origProtoAdd.call(ws, 'message', onTtWsMsg);
      };

      OrigWS.prototype.addEventListener = function (type, listener, options) {
        if (type === 'message') attachTT(this, this.url);
        return origProtoAdd.call(this, type, listener, options);
      };
      sandboxRestorers.push(() => { try { OrigWS.prototype.addEventListener = origProtoAdd; } catch {} });

      let sbLiveWs = null;
      let sbLastOutCashTpl = null;
      let sbLastDirectCashAt = 0;
      const onSbDirectCashout = (ev) => {
        try {
          if (pageWorldActive || targetWin.__ttPageHooked || window.__ttPageHooked || CFG.directWsCashout === false) return;
          const nowD = Date.now();
          if (nowD - sbLastDirectCashAt < 1200) return;
          const tpl = sbLastOutCashTpl;
          if (!tpl || !tpl.raw || typeof tpl.raw !== 'string') return;
          const ws = (tpl.ws && tpl.ws.readyState === 1) ? tpl.ws : ((sbLiveWs && sbLiveWs.readyState === 1) ? sbLiveWs : null);
          if (!ws) return;
          let det = ev && ev.detail;
          if (typeof det === 'string') { try { det = JSON.parse(det); } catch { det = {}; } }
          let outStr = tpl.raw;
          const hasBid = outStr.indexOf('betId') !== -1 || outStr.indexOf('bet_id') !== -1;
          if (hasBid && det && det.betId) {
            outStr = outStr.replace(/("bet(?:Id|_id)"\s*:\s*")[^"]+(")/, '$1' + String(det.betId).replace(/"/g, '') + '$2');
          } else if (hasBid && (nowD - (tpl.ts || 0) > 25000)) {
            return;
          }
          if (det && det.roundId) {
            outStr = outStr.replace(/("round(?:Id|_id)"\s*:\s*")[^"]+(")/, '$1' + String(det.roundId).replace(/"/g, '') + '$2');
          }
          sbLastDirectCashAt = nowD;
          origSend.call(ws, outStr);
        } catch {}
      };
      document.addEventListener('__TT_DIRECT_CASHOUT__', onSbDirectCashout);
      sandboxRestorers.push(() => { try { document.removeEventListener('__TT_DIRECT_CASHOUT__', onSbDirectCashout); } catch {} });

      OrigWS.prototype.send = function (data) {
        const u = this.url || '';
        if (!isRelayBrokerUrl(u) && !pageWorldActive && !targetWin.__ttPageHooked && !window.__ttPageHooked) {
          attachTT(this, u);
          if (this.readyState === 1) sbLiveWs = this;
          if (typeof data === 'string') {
            const dLc = data.toLowerCase();
            if (dLc.indexOf('cashout') !== -1 || dLc.indexOf('cash_out') !== -1 || dLc.indexOf('takewin') !== -1 || dLc.indexOf('collect') !== -1 || dLc.indexOf('claim') !== -1) {
              sbLastOutCashTpl = { ws: this, raw: data, ts: Date.now() };
            }
          }
          try { processRawData('WS-OUT', data); } catch {}
        }
        return origSend.apply(this, arguments);
      };
      sandboxRestorers.push(() => { try { OrigWS.prototype.send = origSend; } catch {} });

      const hookFbOnMsg = (pr) => {
        if (!pr || pr.__ttOnm) return;
        try {
          const desc = Object.getOwnPropertyDescriptor(pr, 'onmessage');
          if (!desc || !desc.set || !desc.configurable) return;
          pr.__ttOnm = true;
          const mMap = typeof WeakMap === 'function' ? new WeakMap() : null;
          Object.defineProperty(pr, 'onmessage', {
            configurable: true,
            enumerable: desc.enumerable,
            get: function () { return (mMap && mMap.has(this)) ? mMap.get(this) : (desc.get ? desc.get.call(this) : null); },
            set: function (fn) {
              if (pr === OrigWS.prototype) attachTT(this, this.url);
              if (typeof fn !== 'function') {
                if (mMap) mMap.delete(this);
                return desc.set.call(this, fn);
              }
              if (mMap) mMap.set(this, fn);
              return desc.set.call(this, function (ev) {
                const fbGateFn = typeof window.__ttGateFbStream === 'function' ? window.__ttGateFbStream : targetWin.__ttGateFbStream;
                const fbIsStrFn = typeof window.__ttIsFbStreamObj === 'function' ? window.__ttIsFbStreamObj : targetWin.__ttIsFbStreamObj;
                if (!pageWorldActive && !targetWin.__ttPageHooked && !window.__ttPageHooked && typeof fbGateFn === 'function' && typeof fbIsStrFn === 'function' && fbIsStrFn(this)) {
                  const fst = fbGateFn(this, ev);
                  if (fst && !fst.flushed && (fst.gated || fst.lockCount > 0 || fst.pendingAsync || fst.relAt > 0)) { fst.queue.push([this, fn, ev]); return; }
                }
                return fn.call(this, ev);
              });
            }
          });
          sandboxRestorers.push(() => {
            try { Object.defineProperty(pr, 'onmessage', desc); } catch {}
            try { delete pr.__ttOnm; } catch { try { pr.__ttOnm = false; } catch {} }
          });
        } catch {}
      };
      hookFbOnMsg(OrigWS.prototype);
      if (WIN.Worker && WIN.Worker.prototype) hookFbOnMsg(WIN.Worker.prototype);
      if (WIN.EventSource && WIN.EventSource.prototype) hookFbOnMsg(WIN.EventSource.prototype);
      if (WIN.BroadcastChannel && WIN.BroadcastChannel.prototype) hookFbOnMsg(WIN.BroadcastChannel.prototype);
      if (typeof MessagePort !== 'undefined' && MessagePort.prototype) hookFbOnMsg(MessagePort.prototype);

      try {
        const prevTwWS = targetWin.WebSocket;
        const prevWinWS = window.WebSocket;
        const prevGtWS = globalThis.WebSocket;
        const ProxiedWS = new Proxy(OrigWS, {
          construct(target, args, newTarget) {
            const ws = Reflect.construct(target, args, newTarget || target);
            const u = String(args && args[0] || '');
            if (!isRelayBrokerUrl(u)) attachTT(ws, u);
            return ws;
          }
        });
        try { targetWin.WebSocket = ProxiedWS; } catch {}
        try { window.WebSocket = ProxiedWS; } catch {}
        try { globalThis.WebSocket = ProxiedWS; } catch {}
        sandboxRestorers.push(() => {
          try { targetWin.WebSocket = prevTwWS; } catch {}
          try { window.WebSocket = prevWinWS; } catch {}
          try { globalThis.WebSocket = prevGtWS; } catch {}
        });
      } catch {}
    }

    // --- 4. Sandbox Fallback API Request & Response Capture ---
    const isStaticMediaCT = (ct) => {
      const s = String(ct || '').toLowerCase();
      return s.startsWith('image/') || s.startsWith('font/') || s.startsWith('application/font') || s.startsWith('application/x-font') || s.startsWith('application/vnd.ms-fontobject') || s.startsWith('audio/') || s.startsWith('video/') || s.startsWith('model/') || s.startsWith('text/css') || s.startsWith('text/html') || s.includes('javascript') || s.includes('ecmascript') || s.startsWith('application/wasm') || s.startsWith('application/pdf') || s.startsWith('application/zip');
    };
    const isStaticAssetUrlOuter = (u) => {
      const s = String(u || '').toLowerCase();
      if (!s) return false;
      if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('chrome-extension:') || s.startsWith('moz-extension:')) return true;
      const p = s.split('?')[0].split('#')[0];
      return /\.(?:m?js|cjs|css|html?|wasm|map|png|jpe?g|gif|webp|avif|svg|ico|cur|bmp|woff2?|ttf|otf|eot|mp3|mp4|webm|ogg|wav|m4a|aac|flac|atlas|skel|bin|plist|fnt|zip|gz|br|unityweb|data|pvr|ktx|gltf?)$/i.test(p) || p.includes('/locales/') || p.includes('/i18n/') || p.includes('/translations/') || s.includes('google-analytics.com') || s.includes('googletagmanager.com') || s.includes('doubleclick.net') || s.includes('facebook.net');
    };
    const isFbTextLikeCT = (ct) => {
      const s = String(ct || '').toLowerCase();
      return s.includes('json') || s.startsWith('text/plain') || s.includes('xml') || s.includes('x-www-form-urlencoded');
    };
    if (CFG.listenAPI) {
      if (typeof NativeFetch === 'function') {
        const prevTwFetch = targetWin.fetch;
        const prevWinFetch = window.fetch;
        const wrappedFetch = function (input, init) {
          if (pageWorldActive || targetWin.__ttPageHooked || window.__ttPageHooked) {
            return NativeFetch.apply(nativeFetchOwner, arguments);
          }
          let reqUrl = '';
          let reqMethod = 'GET';
          try {
            if (typeof input === 'string') reqUrl = input;
            else if (input && (input.url || input.href)) reqUrl = String(input.url || input.href);
            else if (input != null) reqUrl = String(input);
            if (reqUrl && (isInternalRelayUrl(reqUrl) || isStaticAssetUrlOuter(reqUrl))) {
              return NativeFetch.apply(nativeFetchOwner, arguments);
            }
            reqMethod = (init && init.method) || (input && input.method) || 'GET';
            reqMethod = String(reqMethod).toUpperCase();

            const metaReq = reqMethod + ' ' + reqUrl + '\n';
            if (init && init.body !== undefined && init.body !== null) {
              processRawData('API-REQ', init.body, metaReq);
            } else if (typeof Request !== 'undefined' && input instanceof Request && input.body && !input.bodyUsed && reqMethod !== 'GET' && reqMethod !== 'HEAD') {
              try {
                input.clone().arrayBuffer().then(buf => {
                  if (buf && buf.byteLength > 0 && buf.byteLength <= 65536) processRawData('API-REQ', buf, metaReq);
                  else handleDecoded('API-REQ', 'REQ', metaReq.trim());
                }).catch(() => handleDecoded('API-REQ', 'REQ', metaReq.trim()));
              } catch {
                handleDecoded('API-REQ', 'REQ', metaReq.trim());
              }
            } else {
              handleDecoded('API-REQ', 'REQ', metaReq.trim());
            }
          } catch {}

          return NativeFetch.apply(nativeFetchOwner, arguments).then((res) => {
            try {
              if (!res || !res.body || res.bodyUsed || res.type === 'opaque' || res.type === 'opaqueredirect' || res.status === 204 || res.status === 205 || res.status === 304 || reqMethod === 'HEAD') {
                return res;
              }
              const rUrl = res.url || reqUrl;
              const ct = res.headers && res.headers.get ? res.headers.get('content-type') : '';
              const clLen = res.headers && res.headers.get ? Number(res.headers.get('content-length') || 0) : 0;
              if (isStaticMediaCT(ct) || isStaticAssetUrlOuter(rUrl) || clLen > 131072) return res;
              const ctL = String(ct || '').toLowerCase();
              const isBinApi = clLen > 0 && clLen <= 98304 && (ctL.includes('octet-stream') || ctL.includes('msgpack') || ctL.includes('protobuf') || ctL.includes('cbor'));
              if (!isFbTextLikeCT(ctL) && !isBinApi) return res;
              const metaRes = res.status + ' ' + reqMethod + ' ' + rUrl + '\n';
              res.clone().arrayBuffer().then(buf => {
                if (buf && buf.byteLength > 0) {
                  if (buf.byteLength > 98304) return;
                  processRawData('API-RES', buf, metaRes);
                } else {
                  handleDecoded('API-RES', 'RES', metaRes.trim());
                }
              }).catch(() => {});
            } catch {}
            return res;
          });
        };
        try { targetWin.fetch = wrappedFetch; } catch {}
        try { window.fetch = wrappedFetch; } catch {}
        sandboxRestorers.push(() => {
          try { targetWin.fetch = prevTwFetch; } catch {}
          try { window.fetch = prevWinFetch; } catch {}
        });
      }

      if (NativeXHR && NativeXHR.prototype) {
        const origOpen = NativeXHR.prototype.open;
        const origSend = NativeXHR.prototype.send;

        NativeXHR.prototype.open = function (method, url) {
          this.__tt_method = String(method || 'GET').toUpperCase();
          this.__tt_url = String(url || '');
          return origOpen.apply(this, arguments);
        };

        NativeXHR.prototype.send = function (body) {
          const xhr = this;
          if ((xhr.__tt_url && (isInternalRelayUrl(xhr.__tt_url) || isStaticAssetUrlOuter(xhr.__tt_url))) || pageWorldActive || targetWin.__ttPageHooked || window.__ttPageHooked) {
            return origSend.apply(this, arguments);
          }
          const metaReq = (xhr.__tt_method || 'GET') + ' ' + (xhr.__tt_url || '') + '\n';
          try {
            if (body !== undefined && body !== null) {
              processRawData('API-REQ', body, metaReq);
            } else {
              handleDecoded('API-REQ', 'XHR', metaReq.trim());
            }
          } catch {}

          if (!xhr.__tt_hooked_xhr) {
            xhr.__tt_hooked_xhr = true;
            xhr.addEventListener('load', function () {
              try {
                const ct = xhr.getResponseHeader ? xhr.getResponseHeader('content-type') : '';
                const rUrl = xhr.responseURL || xhr.__tt_url || '';
                if (isStaticMediaCT(ct) || isStaticAssetUrlOuter(rUrl)) return;
                const metaRes = xhr.status + ' ' + (xhr.__tt_method || '') + ' ' + rUrl + '\n';
                if (xhr.responseType === 'arraybuffer' || xhr.responseType === 'blob') {
                  const sz = xhr.response ? (xhr.response.byteLength || xhr.response.size || 0) : 0;
                  if (sz > 98304) return;
                  processRawData('API-RES', xhr.response, metaRes);
                } else if (xhr.responseType === 'json' && xhr.response != null) {
                  processRawData('API-RES', xhr.response, metaRes);
                } else if (typeof xhr.responseText === 'string' && xhr.responseText) {
                  if (xhr.responseText.length > 98304) return;
                  processRawData('API-RES', xhr.responseText, metaRes);
                }
              } catch {}
            });
          }
          return origSend.apply(this, arguments);
        };
        sandboxRestorers.push(() => {
          try { NativeXHR.prototype.open = origOpen; } catch {}
          try { NativeXHR.prototype.send = origSend; } catch {}
        });
      }

      if (nativeBeacon && WIN.navigator) {
        try {
          const prevBeacon = WIN.navigator.sendBeacon;
          WIN.navigator.sendBeacon = function (url, data) {
            if (!isInternalRelayUrl(url)) {
              try { processRawData('API-REQ', data, 'BEACON ' + url + '\n'); } catch {}
            }
            return nativeBeacon(url, data);
          };
          sandboxRestorers.push(() => { try { WIN.navigator.sendBeacon = prevBeacon; } catch {} });
        } catch {}
      }
    }

    if (CFG.listenWS && typeof WIN.EventSource === 'function') {
      const OrigES = WIN.EventSource;
      try {
        WIN.EventSource = new Proxy(OrigES, {
          construct(target, args, newTarget) {
            const es = Reflect.construct(target, args, newTarget || target);
            es.addEventListener('message', (ev) => processRawData('SSE', ev.data));
            return es;
          }
        });
        sandboxRestorers.push(() => { try { WIN.EventSource = OrigES; } catch {} });
      } catch {}
    }

    if (CFG.listenWS && typeof WIN.Worker === 'function') {
      const OrigWK = WIN.Worker;
      try {
        WIN.Worker = new Proxy(OrigWK, {
          construct(target, args, newTarget) {
            const wk = Reflect.construct(target, args, newTarget || target);
            wk.addEventListener('message', (ev) => {
              if (pageWorldActive || targetWin.__ttPageHooked || window.__ttPageHooked) return;
              const d = ev.data;
              if (typeof d === 'string' || d instanceof ArrayBuffer || ArrayBuffer.isView(d) || (d && typeof d === 'object')) {
                processRawData('WORKER', d);
              }
            });
            return wk;
          }
        });
        sandboxRestorers.push(() => { try { WIN.Worker = OrigWK; } catch {} });
      } catch {}
    }

    if (CFG.listenWS && typeof WIN.SharedWorker === 'function') {
      const OrigSW = WIN.SharedWorker;
      try {
        WIN.SharedWorker = new Proxy(OrigSW, {
          construct(target, args, newTarget) {
            const sw = Reflect.construct(target, args, newTarget || target);
            try {
              if (sw.port && sw.port.addEventListener) {
                sw.port.addEventListener('message', (ev) => {
                  if (pageWorldActive || targetWin.__ttPageHooked || window.__ttPageHooked) return;
                  if (ev.data != null) processRawData('WORKER', ev.data);
                });
              }
            } catch {}
            return sw;
          }
        });
        sandboxRestorers.push(() => { try { WIN.SharedWorker = OrigSW; } catch {} });
      } catch {}
    }

    if (CFG.listenRTF !== false && CFG.listenJS !== false && WIN.EventTarget && WIN.EventTarget.prototype && typeof WIN.EventTarget.prototype.dispatchEvent === 'function' && !WIN.EventTarget.prototype.__ttRtfDE) {
      const fbETP = WIN.EventTarget.prototype;
      const origFbDE = fbETP.dispatchEvent;
      const fbNoiseEv = new Set([
        'click', 'dblclick', 'contextmenu', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
        'mouseenter', 'mouseleave', 'pointerdown', 'pointerup', 'pointermove', 'pointerover', 'pointerout',
        'pointerenter', 'pointerleave', 'pointercancel', 'gotpointercapture', 'lostpointercapture',
        'touchstart', 'touchend', 'touchmove', 'touchcancel', 'focus', 'blur', 'focusin', 'focusout',
        'input', 'change', 'submit', 'keydown', 'keyup', 'keypress', 'scroll', 'resize', 'wheel',
        'load', 'error', 'abort', 'progress', 'animationstart', 'animationend', 'transitionend'
      ]);
      const safeFbJson = (val, dp, seen) => {
        if (val == null || typeof val === 'boolean' || typeof val === 'number') return val;
        if (typeof val === 'string') return val.length > 180 ? val.slice(0, 180) : val;
        if (typeof val === 'function') return '[fn]';
        if (typeof Element !== 'undefined' && val instanceof Element) return '<' + val.tagName.toLowerCase() + (val.id ? '#' + val.id : '') + '>';
        if (dp >= 3) return '[obj]';
        if (typeof val === 'object') {
          for (let i = 0; i < seen.length; i++) if (seen[i] === val) return '[Circular]';
          seen.push(val);
          if (Array.isArray(val)) {
            const arr = val.slice(0, 8).map((v) => safeFbJson(v, dp + 1, seen));
            seen.pop();
            return arr;
          }
          const out = {};
          const ks = Object.keys(val).slice(0, 16);
          for (let i = 0; i < ks.length; i++) {
            try { out[ks[i]] = safeFbJson(val[ks[i]], dp + 1, seen); } catch {}
          }
          seen.pop();
          return out;
        }
        return String(val);
      };
      try {
        fbETP.dispatchEvent = function (ev) {
          try {
            if (!pageWorldActive && !targetWin.__ttPageHooked && !window.__ttPageHooked && CFG.listenRTF !== false && CFG.listenJS !== false && ev && typeof ev.type === 'string') {
              const et = ev.type;
              if (!et.startsWith('__TT_') && !et.startsWith('__triggertap') && !fbNoiseEv.has(et) && ((typeof WIN.CustomEvent === 'function' && ev instanceof WIN.CustomEvent) || 'detail' in ev)) {
                let dTxt = '';
                if (ev.detail !== undefined) {
                  try { dTxt = JSON.stringify(safeFbJson(ev.detail, 0, [])); } catch { dTxt = ''; }
                  if (dTxt && dTxt.length > 700) dTxt = dTxt.slice(0, 700);
                }
                const sig = 'js:CustomEvent(' + JSON.stringify(et) + ')' + (dTxt ? (' ' + dTxt) : '');
                processRawData('JS-HOOK', sig);
              }
            }
          } catch {}
          return origFbDE.apply(this, arguments);
        };
        sandboxRestorers.push(() => { try { fbETP.dispatchEvent = origFbDE; } catch {} });
      } catch {}
    }

    if (CFG.listenRTF !== false && (CFG.listenCSS !== false || CFG.listenDOM !== false) && WIN.Element && WIN.Element.prototype && typeof WIN.Element.prototype.attachShadow === 'function' && !WIN.Element.prototype.__ttRtfAS) {
      const fbEP = WIN.Element.prototype;
      const origFbAS = fbEP.attachShadow;
      try {
        fbEP.attachShadow = function () {
          const sh = origFbAS.apply(this, arguments);
          try {
            if (sh && !sh.__ttRtfObsBound) {
              sh.__ttRtfObsBound = true;
              if (typeof observeRtfShadowNode === 'function') observeRtfShadowNode(sh);
            }
          } catch {}
          return sh;
        };
        sandboxRestorers.push(() => { try { fbEP.attachShadow = origFbAS; } catch {} });
      } catch {}
    }
  };

  if (!pageWorldActive) {
    scheduleSandboxFallback((!hadDomMountAtBoot || pageInjectPending) ? 180 : 0);
  }

  // --- 3. DOM / CSS / Shadow / SMS Observer ---
  let domObserver = null;
  const rtfObservedShadowRoots = [];
  const observeRtfShadowNode = (rootNode) => {
    if (!domObserver || !rootNode) return;
    try {
      domObserver.observe(rootNode, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: Boolean(CFG.listenCSS !== false),
        attributeFilter: ['class', 'data-state', 'data-phase', 'data-status', 'data-round', 'aria-live']
      });
      rtfObservedShadowRoots.push(rootNode);
    } catch {}
  };
  if ((CFG.listenDOM || CFG.listenCSS) && typeof MutationObserver !== 'undefined') {
    const pendingDomTexts = new Set();
    const pendingCssSigs = new Set();
    const pendingDomTags = new Set();
    const domLettersRe = /[a-zA-Z\u0980-\u09FF]{3,}/;
    const flushDomTexts = () => {
      domBatchTimer = null;
      if (pendingDomTexts.size) {
        let checkedCount = 0;
        for (const txt of Array.from(pendingDomTexts)) {
          pendingDomTexts.delete(txt);
          processRawData('SMS/DOM', txt);
          if (++checkedCount >= 64) break;
        }
      }
      if (pendingCssSigs.size) {
        let cssSent = 0;
        for (const sig of Array.from(pendingCssSigs)) {
          pendingCssSigs.delete(sig);
          processRawData('CSS-STATE', sig);
          if (++cssSent >= 48) break;
        }
      }
      if (pendingDomTags.size) {
        let domTagSent = 0;
        for (const sig of Array.from(pendingDomTags)) {
          pendingDomTags.delete(sig);
          processRawData('DOM-TAG', sig);
          if (++domTagSent >= 48) break;
        }
      }
      if ((pendingDomTexts.size || pendingCssSigs.size || pendingDomTags.size) && !domBatchTimer) {
        domBatchTimer = setTimeout(flushDomTexts, 8);
      }
    };
    const pushDomCandidate = (txt) => {
      if (!txt || txt.length > 240) return;
      const isArmedHere = Boolean(CFG.armed);
      if (!isArmedHere && !domLettersRe.test(txt)) return;
      if (isArmedHere && matchPayload(txt) !== null) {
        processRawData('SMS/DOM', txt);
        return;
      }
      if (domLettersRe.test(txt)) {
        pendingDomTexts.add(txt);
      }
    };
    const buildCssSig = (el, attrName) => {
      if (!el || el.nodeType !== 1) return '';
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (!tag || tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta') return '';
      const idp = el.id ? ('#' + el.id) : '';
      const cls = typeof el.className === 'string' && el.className.trim()
        ? ('.' + el.className.trim().split(/\s+/).slice(0, 3).join('.'))
        : '';
      const av = (attrName && attrName !== 'class' && el.getAttribute) ? (el.getAttribute(attrName) || '') : '';
      const atp = av ? ('[' + attrName + '=' + String(av).slice(0, 24) + ']') : '';
      if (!cls && !atp) return '';
      const rawT = el.childElementCount <= 4 && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
      return 'css:' + tag + idp + cls + atp + (rawT ? (' ' + rawT) : '');
    };
    const buildDomTagSig = (el) => {
      if (!el || el.nodeType !== 1) return '';
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (!tag || tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta') return '';
      const idp = el.id ? ('#' + el.id) : '';
      const cls = typeof el.className === 'string' && el.className.trim()
        ? ('.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'))
        : '';
      const rawT = el.childElementCount <= 5 && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : '';
      if (!idp && !cls && !rawT) return '';
      return 'dom:' + tag + idp + cls + (rawT ? (' ' + rawT) : '');
    };
    domObserver = new MutationObserver((mutations) => {
      if (isDraggingTarget) return;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (!m || isOwnHudNode(m.target)) continue;
        if (m.type === 'attributes' && CFG.listenCSS !== false && CFG.listenRTF !== false) {
          const cssSig = buildCssSig(m.target, m.attributeName);
          if (cssSig) {
            if (CFG.armed && matchPayload(cssSig) !== null) {
              processRawData('CSS-STATE', cssSig);
            } else {
              pendingCssSigs.add(cssSig);
            }
          }
          continue;
        }
        if (m.type === 'characterData' && m.target.nodeValue) {
          pushDomCandidate(m.target.nodeValue.trim());
          if (CFG.armed && m.target.parentElement) {
            const pe = m.target.parentElement;
            if (pe.childElementCount <= 3) {
              const pTxt = pe.textContent ? pe.textContent.trim() : '';
              if (pTxt && pTxt.length <= 240 && pTxt !== m.target.nodeValue.trim()) {
                pushDomCandidate(pTxt);
              }
            }
          }
        } else if (m.addedNodes && m.addedNodes.length) {
          for (let j = 0; j < m.addedNodes.length; j++) {
            const n = m.addedNodes[j];
            if (!n || isOwnHudNode(n)) continue;
            if (n.nodeType === 3) {
              if (n.nodeValue) pushDomCandidate(n.nodeValue.trim());
              continue;
            }
            if (n.nodeType === 1) {
              if (n.shadowRoot && !n.shadowRoot.__ttRtfObsBound) {
                n.shadowRoot.__ttRtfObsBound = true;
                observeRtfShadowNode(n.shadowRoot);
              }
              if (CFG.listenRTF !== false && CFG.listenDOM !== false) {
                const domTagSig = buildDomTagSig(n);
                if (domTagSig) {
                  if (CFG.armed && matchPayload(domTagSig) !== null) {
                    processRawData('DOM-TAG', domTagSig);
                  } else {
                    pendingDomTags.add(domTagSig);
                  }
                }
              }
              if (n.childElementCount > 4) continue;
              const t = n.textContent ? n.textContent.trim() : '';
              if (t && t.length <= 240) {
                pushDomCandidate(t);
              }
            }
          }
        }
      }
      if ((pendingDomTexts.size || pendingCssSigs.size || pendingDomTags.size) && !domBatchTimer) {
        domBatchTimer = setTimeout(flushDomTexts, 16);
      }
    });
    const startDomObserver = () => {
      const targetNode = document.body || document.documentElement;
      if (targetNode) {
        observeRtfShadowNode(targetNode);
        try {
          const allEls = targetNode.querySelectorAll('*');
          for (let si = 0; si < Math.min(allEls.length, 400); si++) {
            const sr = allEls[si].shadowRoot;
            if (sr && !sr.__ttRtfObsBound) {
              sr.__ttRtfObsBound = true;
              observeRtfShadowNode(sr);
            }
          }
        } catch {}
      }
    };
    if (document.readyState === 'complete') setTimeout(startDomObserver, 250);
    else window.addEventListener('DOMContentLoaded', () => setTimeout(startDomObserver, 350), { once: true });
  }

  const onHotkeyDown = function (e) {
    if (e.repeat) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
      return;
    }
    if (e.key === 'F8' || e.code === 'F8') {
      e.preventDefault();
      markManualRoundEnd('HOTKEY_F8');
      if (isIframe) {
        try { sendToTop({ __TT_SNIFFER__: true, kind: 'MANUAL_ROUND_END', reason: 'IFRAME_F8' }); } catch {}
      }
      return;
    }
    if (!CFG.enableHotkey || !CFG.hotkeyCode) return;
    if (e.code === CFG.hotkeyCode || e.key === CFG.hotkeyCode) {
      if (CFG.hotkeyCode === 'Space') e.preventDefault();
      if (elTags && elTags.value !== CFG.tags) CFG.tags = elTags.value;
      CFG.armed = !CFG.armed;
      if (lastHitTag === 'TEST') lastHitTag = '';
      roundClickLocked = false;
      roundSawFlightAfterLock = false;
      roundSawCrashAfterLock = false;
      roundClickLockedRoundId = '';
      roundUnlockSeq += 1;
      lastUserCfgEditAt = Date.now();
      persistHudControlState();
      markUserTouched();
      syncUI();
      syncTurboCfg(true, true);
    }
  };
  if (CFG.enableHotkey || CFG.listenRTF !== false) {
    window.addEventListener('keydown', onHotkeyDown, true);
  }

  const triggerFrameClickOnce = (d) => {
    if (!d || typeof d.x !== 'number' || typeof d.y !== 'number') return;
    if (d.clickId) {
      if (seenFrameClickIds.has(d.clickId)) return;
      seenFrameClickIds.add(d.clickId);
      if (seenFrameClickIds.size > 120) {
        const first = seenFrameClickIds.values().next().value;
        if (first !== undefined) seenFrameClickIds.delete(first);
      }
    }
    if (typeof d.humanJitter === 'boolean' && d.humanJitter !== CFG.humanJitter) {
      CFG.humanJitter = d.humanJitter;
      syncTurboCfg(false, false);
    }
    if (typeof d.fingerprintShuffle === 'boolean' && d.fingerprintShuffle !== CFG.fingerprintShuffle) {
      CFG.fingerprintShuffle = d.fingerprintShuffle;
      syncTurboCfg(false, false);
    }
    let fx = Number(d.x);
    let fy = Number(d.y);
    let snappedBtn = null;
    try {
      const liveBtnSnap = findFallbackBtnOuter(document, fx, fy);
      if (liveBtnSnap) {
        const sr = liveBtnSnap.getBoundingClientRect();
        const sTxt = (liveBtnSnap.innerText || liveBtnSnap.textContent || liveBtnSnap.value || '').trim();
        const sDis = Boolean(liveBtnSnap.disabled || (liveBtnSnap.getAttribute && liveBtnSnap.getAttribute('aria-disabled') === 'true'));
        if (sr.width > 4 && sr.height > 4 && !isButtonAlreadyEnded(sTxt, sDis, liveBtnSnap)) {
          fx = Math.round(sr.left + sr.width / 2);
          fy = Math.round(sr.top + sr.height / 2);
          snappedBtn = liveBtnSnap;
          iframeLocalTarget = { active: true, x: fx, y: fy, locked: true };
        }
      }
    } catch {}
    const outCashBefore = lastOutCashSentAt;
    const zMicro = Math.max(0, Math.min(5, Number(CFG.zeroDelayMicroMs) || 0));
    fireClickAtCoords(fx, fy, typeof d.holdMs === 'number' ? d.holdMs : (CFG.zeroDelay ? zMicro : (CFG.humanTap ? 35 : 0)), performance.now(), snappedBtn, 'IFRAME');
    armCashoutWatchdog(outCashBefore, fx, fy, snappedBtn, 'IFRAME');
  };
  const onFrameClickMessage = function (ev) {
    const d = ev && ev.data;
    if (!d || !d.__TT_FRAME_CLICK__) return;
    triggerFrameClickOnce(d);
  };
  window.addEventListener('message', onFrameClickMessage);
  if (targetWin !== window) {
    try { targetWin.addEventListener('message', onFrameClickMessage); } catch {}
  }
  const onGmFrameClickRelay = (ev) => {
    if (typeof GM_setValue !== 'function') return;
    try {
      let d = ev && ev.detail;
      if (typeof d === 'string') d = JSON.parse(d);
      if (!d || !d.clickId) return;
      GM_setValue('__tt_frame_click_' + CFG.roomId, JSON.stringify(Object.assign({}, d, { ts: Date.now() })));
    } catch {}
  };
  document.addEventListener('__TT_GM_FRAME_CLICK__', onGmFrameClickRelay);
  if (isIframe && typeof GM_addValueChangeListener === 'function') {
    try {
      gmListenerIds.push(GM_addValueChangeListener('__tt_frame_click_' + CFG.roomId, function (_n, _o, raw) {
        if (!raw) return;
        try {
          const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!d || !d.clickId || (d.ts && Date.now() - d.ts > 2500)) return;
          const vw = window.innerWidth || 0;
          const vh = window.innerHeight || 0;
          if (vw < 150 || vh < 150) return;
          const srcBase = d.src ? String(d.src).split('?')[0] : '';
          const hrefMatch = !srcBase || String(window.location && window.location.href || '').indexOf(srcBase) !== -1;
          if (detectGameDom() || hrefMatch) {
            triggerFrameClickOnce(d);
          }
        } catch {}
      }));
    } catch {}
  }

  // --- 5. Zero-Lag rAF UI Coalescing + Async Pattern-Matching Worker + Auto-Site Option Engine ---
  let syncUiRafId = 0;
  function scheduleSyncUI() {
    if (syncUiRafId) return;
    if (typeof requestAnimationFrame === 'function') {
      syncUiRafId = requestAnimationFrame(() => {
        syncUiRafId = 0;
        if (!hudHidden) syncUI();
      });
    } else {
      syncUiRafId = setTimeout(() => {
        syncUiRafId = 0;
        if (!hudHidden) syncUI();
      }, 16);
    }
  }

  const TTAsyncWorkerEngine = (function () {
    let worker = null;
    let workerUrl = null;
    let seq = 0;
    let queue = [];
    let flushTimer = 0;
    let ch = null;
    let mode = 'idle';

    const WORKER_CODE = [
      "'use strict';",
      "var rules=[],cs=false,mode='contains';",
      "function splitTags(r){var o=[],c='',bd=0,bk=0,q='',e=false,NL=String.fromCharCode(10),CR=String.fromCharCode(13),DQ=String.fromCharCode(34),SQ=String.fromCharCode(39),BS=String.fromCharCode(92);for(var i=0;i<r.length;i++){var h=r.charAt(i);if(e){c+=h;e=false;continue;}if(h===BS&&q){c+=h;e=true;continue;}if(q){if(h===NL||h===CR){q='';bd=0;bk=0;if(c.trim())o.push(c.trim());c='';continue;}c+=h;if(h===q)q='';continue;}if(h===DQ||h===SQ){q=h;c+=h;continue;}if(h==='{')bd++;else if(h==='}'&&bd>0)bd--;else if(h==='[')bk++;else if(h===']'&&bk>0)bk--;if((h===','||h===NL||h===CR)&&bd===0&&bk===0){if(c.trim())o.push(c.trim());c='';continue;}c+=h;}if(c.trim())o.push(c.trim());return o;}",
      "function parseTj(c){try{var ib=c.indexOf('{'),ia=c.indexOf('['),st=(ib>=0&&ia>=0)?Math.min(ib,ia):Math.max(ib,ia);if(st===0||(st>0&&/^\\d{1,4}(?:\\/[^,\\[]*)?[, -]*$/.test(c.slice(0,st).trim())))return JSON.parse(c.slice(st));}catch(e){}return null;}",
      "function jMatch(h,n,d){if(d>7)return false;if(n===h)return true;if(n==null||h==null)return n===h;if(typeof n==='string'&&typeof h==='string')return cs?h===n:h.toLowerCase()===n.toLowerCase();if(typeof n!=='object')return String(h)===String(n);if(typeof h!=='object')return false;if(Array.isArray(n)){if(!Array.isArray(h))return false;for(var i=0;i<n.length;i++){var ok=false;for(var j=0;j<h.length;j++){if(jMatch(h[j],n[i],d+1)){ok=true;break;}}if(!ok)return false;}return true;}if(Array.isArray(h)){for(var a=0;a<h.length;a++){if(jMatch(h[a],n,d+1))return true;}return false;}var nks=Object.keys(n),dm=nks.length>0;for(var k=0;k<nks.length;k++){var ky=nks[k],rk=Object.prototype.hasOwnProperty.call(h,ky)?ky:undefined;if(rk===undefined&&!cs){var lky=ky.toLowerCase(),hks=Object.keys(h);for(var hk=0;hk<hks.length;hk++){if(hks[hk].toLowerCase()===lky){rk=hks[hk];break;}}}if(rk===undefined||!jMatch(h[rk],n[ky],d+1)){dm=false;break;}}if(dm)return true;var aks=Object.keys(h);for(var m=0;m<aks.length;m++){var v=h[aks[m]];if(v&&typeof v==='object'&&jMatch(v,n,d+1))return true;}return false;}",
      "function compile(t,m,c){cs=Boolean(c);mode=m||'contains';rules=[];var arr=splitTags(String(t||''));for(var i=0;i<arr.length;i++){var raw=arr[i].replace(/,+\\s*$/,'').trim();if(!raw)continue;var re=null;if(mode==='regex'){try{re=new RegExp(raw,cs?'':'i');}catch(e){}}var tj=parseTj(raw);rules.push({raw:raw,n:cs?raw:raw.toLowerCase(),cns:(cs?raw:raw.toLowerCase()).replace(/\\s+/g,''),tj:tj,re:re});}}",
      "self.onmessage=function(ev){var d=ev.data||{};if(d.type==='CFG'){compile(d.tags,d.matchMode,d.caseSensitive);return;}if(d.type==='BATCH'){var fs=d.frames||[],hits=[];for(var i=0;i<fs.length;i++){var f=fs[i],txt=String(f.text||''),hay=cs?txt:txt.toLowerCase(),hayNs=hay.replace(/\\s+/g,''),mt=null,parsed=null,didP=false;for(var j=0;j<rules.length;j++){var r=rules[j];if(mode==='regex'){if(r.re&&r.re.test(txt)){mt=r.raw;break;}}else if(mode==='exact'){if(hay.trim()===r.n){mt=r.raw;break;}}else{if(r.tj){if(!didP){didP=true;parsed=parseTj(txt);}if(parsed&&jMatch(parsed,r.tj,0)){mt=r.raw;break;}}if(hay.indexOf(r.n)!==-1||(r.cns&&hayNs.indexOf(r.cns)!==-1)){mt=r.raw;break;}}}if(mt!==null)hits.push({seq:f.seq,src:f.src,text:txt,tag:mt,t0:f.t0});}if(hits.length)self.postMessage({type:'HITS',hits:hits});}};"
    ].join('');

    function init() {
      if (!CFG.asyncWorker) return;
      try {
        if (typeof Worker === 'function' && typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
          workerUrl = URL.createObjectURL(new Blob([WORKER_CODE], { type: 'application/javascript' }));
          worker = new Worker(workerUrl);
          mode = 'web-worker';
          worker.onmessage = function (ev) {
            const d = ev.data || {};
            if (d.type === 'HITS' && Array.isArray(d.hits)) {
              for (let i = 0; i < d.hits.length; i++) {
                const h = d.hits[i];
                if (CFG.armed && (!CFG.roundOnce || !roundClickLocked) && Date.now() - lastTriggerAt >= CFG.cooldownMs) {
                  lastMatchPreview = 'W[' + String(h.tag).slice(0, 18) + ']';
                  scheduleSyncUI();
                }
              }
            }
          };
          worker.onerror = function () {
            try { worker.terminate(); } catch {}
            worker = null;
            mode = 'async-channel';
          };
          syncConfig();
          return;
        }
      } catch {}
      mode = 'async-channel';
      if (typeof MessageChannel === 'function') {
        ch = new MessageChannel();
        ch.port1.onmessage = flush;
      }
    }

    function syncConfig() {
      if (worker) {
        try {
          worker.postMessage({ type: 'CFG', tags: CFG.tags, matchMode: CFG.matchMode, caseSensitive: CFG.caseSensitive });
        } catch {}
      }
    }

    function flush() {
      flushTimer = 0;
      if (!queue.length) return;
      const batch = queue.splice(0, 128);
      if (worker) {
        try { worker.postMessage({ type: 'BATCH', frames: batch }); } catch {}
      }
      if (queue.length) scheduleFlush();
    }

    function scheduleFlush() {
      if (flushTimer) return;
      flushTimer = 1;
      if (ch) ch.port2.postMessage(null);
      else Promise.resolve().then(flush);
    }

    function enqueue(src, rawText, t0) {
      if (!CFG.asyncWorker || !rawText) return;
      queue.push({ seq: ++seq, src, text: String(rawText).slice(0, 8000), t0: t0 || performance.now() });
      scheduleFlush();
    }

    function destroy() {
      if (worker) { try { worker.terminate(); } catch {} worker = null; }
      if (workerUrl) { try { URL.revokeObjectURL(workerUrl); } catch {} workerUrl = null; }
      if (ch) { try { ch.port1.close(); ch.port2.close(); } catch {} ch = null; }
    }

    return { init, syncConfig, enqueue, destroy, getMode: () => mode };
  })();
  TTAsyncWorkerEngine.init();

  let autoSiteAppliedOnce = false;
  function runAutoSiteProfileEngine(sampleSrc, sampleText) {
    if (!CFG.autoSiteProfile || autoSiteAppliedOnce) return;
    const lc = String(sampleText || '').toLowerCase();
    const h = String(host || '').toLowerCase();
    let changed = false;
    if (sampleSrc === 'WS-IN' && (lc.includes('expected_betting_phase') || lc.includes('"nsp":'))) {
      CFG.decodeBinary = true;
      CFG.preClickGate = true;
      CFG.roundOnce = true;
      CFG.zeroDelay = true;
      CFG.wsLeadMs = 12;
      CFG.gateHoldMs = 28;
      CFG.inspectorEnabled = true;
      CFG.inspectorAutoClick = false;
      CFG.inspectorKeywords = 'finishGame, stopCoefficient, crashPoint, newStateId';
      changed = true;
      autoSiteAppliedOnce = true;
    } else if (h && (h.includes('1xlite') || h.includes('1xbet') || h.includes('spribe') || h.includes('aviator') || h.includes('crash'))) {
      CFG.decodeBinary = true;
      CFG.preClickGate = true;
      CFG.roundOnce = true;
      CFG.zeroDelay = true;
      CFG.inspectorEnabled = true;
      CFG.inspectorAutoClick = false;
      changed = true;
      autoSiteAppliedOnce = true;
    }
    if (changed) {
      persistHudControlState();
      syncTurboCfg(true, false);
      scheduleSyncUI();
    }
  }
  setTimeout(() => runAutoSiteProfileEngine('', ''), 120);

  const destroyFn = function () {
    CFG.armed = false;
    cancelSandboxFallbackTimer();
    try { uninstallSandboxFallbacks(); } catch {}
    try { stopElementPickerMode(false); } catch {}
    try { syncTurboCfg(true); } catch {}
    if (domObserver) domObserver.disconnect();
    clearPendingTargetRetry();
    if (renderLogsTimer) { clearTimeout(renderLogsTimer); renderLogsTimer = null; }
    if (secUiTimer) { clearTimeout(secUiTimer); secUiTimer = null; }
    if (domBatchTimer) { clearTimeout(domBatchTimer); domBatchTimer = null; }
    clearInterval(anchorSyncTimer);
    clearInterval(fbWarmTimer);
    if (hudCoordTimer) clearInterval(hudCoordTimer);
    if (crashAlertBannerTimer) { clearTimeout(crashAlertBannerTimer); crashAlertBannerTimer = null; }
    if (crashAudioCtx && typeof crashAudioCtx.close === 'function') {
      try { crashAudioCtx.close(); } catch {}
      crashAudioCtx = null;
    }
    if (syncUiRafId && typeof cancelAnimationFrame === 'function') { try { cancelAnimationFrame(syncUiRafId); } catch {} }
    try { TTAsyncWorkerEngine.destroy(); } catch {}
    TTWssRelay.destroy();
    if (onTopMessage) {
      window.removeEventListener('message', onTopMessage);
      if (targetWin !== window) { try { targetWin.removeEventListener('message', onTopMessage); } catch {} }
    }
    if (onIframeAckMessage) {
      window.removeEventListener('message', onIframeAckMessage);
      if (targetWin !== window) { try { targetWin.removeEventListener('message', onIframeAckMessage); } catch {} }
    }
    if (onIframeResizeClaim) {
      window.removeEventListener('resize', onIframeResizeClaim);
    }
    for (let i = 0; i < dragCleanups.length; i++) {
      try { dragCleanups[i](); } catch {}
    }
    document.removeEventListener('__TT_PAGE_READY__', onPageReadyEvent);
    document.removeEventListener('__TT_PAGE_UNLOCK__', onPageUnlockEvent);
    document.removeEventListener('__TT_PAGE_RETRY_HIT__', onPageRetryHitEvent);
    document.removeEventListener('__TT_PAGE_WS__', onPageWsEvent);
    document.removeEventListener('__TT_GATE_FLUSH__', onPageGateFlushEvent);
    document.removeEventListener('__TT_PAGE_API__', onPageApiEvent);
    document.removeEventListener('__TT_PAGE_RTF__', onPageRtfEvent);
    targetWin.removeEventListener('__TT_PAGE_WS__', onPageWsEvent);
    targetWin.removeEventListener('__TT_GATE_FLUSH__', onPageGateFlushEvent);
    targetWin.removeEventListener('__TT_PAGE_API__', onPageApiEvent);
    targetWin.removeEventListener('__TT_PAGE_RTF__', onPageRtfEvent);
    document.removeEventListener('visibilitychange', onVisibilityChangeRelay);
    window.removeEventListener('online', onOnlineRelay);
    window.removeEventListener('focus', onOnlineRelay);
    window.removeEventListener('pageshow', onOnlineRelay);
    window.removeEventListener('pagehide', onPageHideRelay);
    try {
      if (navigator && navigator.connection && typeof navigator.connection.removeEventListener === 'function') {
        navigator.connection.removeEventListener('change', onOnlineRelay);
      }
    } catch {}
    window.removeEventListener('resize', onViewportShift);
    window.removeEventListener('scroll', onViewportShift, true);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onViewportShift);
      window.visualViewport.removeEventListener('scroll', onViewportShift);
    }
    document.removeEventListener('DOMContentLoaded', mountRootEl);
    window.removeEventListener('DOMContentLoaded', mountRootEl);
    window.removeEventListener('load', mountRootEl);
    window.removeEventListener('keydown', onHotkeyDown, true);
    window.removeEventListener('message', onFrameClickMessage);
    document.removeEventListener('__TT_GM_FRAME_CLICK__', onGmFrameClickRelay);
    if (typeof GM_removeValueChangeListener === 'function') {
      for (let i = 0; i < gmListenerIds.length; i++) {
        try { if (gmListenerIds[i] != null) GM_removeValueChangeListener(gmListenerIds[i]); } catch {}
      }
    }
    if (targetWin !== window) { try { targetWin.removeEventListener('message', onFrameClickMessage); } catch {} }
    if (root && root.parentNode) root.parentNode.removeChild(root);
    WIN.__TRIGGERTAP_ACTIVE__ = false;
    window.__TRIGGERTAP_ACTIVE__ = false;
  };
  WIN.__TRIGGERTAP_DESTROY__ = destroyFn;
  window.__TRIGGERTAP_DESTROY__ = destroyFn;
})();