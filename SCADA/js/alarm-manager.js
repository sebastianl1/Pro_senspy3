/**
 * NexSCADA — alarm-manager.js
 * Reconocimiento de alarmas (ACK), historial, sonidos, badges
 * Se integra con alarmData de scada-core.js
 */

const AlarmManager = (function () {

  const STORAGE_KEY = 'scada_alarm_history';
  const ACK_KEY     = 'scada_alarm_acks';

  // ─── Audio context para sonidos ──────────────────────────────────
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    return audioCtx;
  }

  function playBeep(freq, duration, type) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  const sounds = {
    critical() { playBeep(880, 0.18, 'square'); setTimeout(() => playBeep(660, 0.18, 'square'), 220); },
    high()     { playBeep(660, 0.22, 'sine'); },
    ack()      { playBeep(440, 0.15, 'sine'); setTimeout(() => playBeep(550, 0.15, 'sine'), 160); },
    resolved() { playBeep(550, 0.12, 'sine'); setTimeout(() => playBeep(880, 0.2, 'sine'), 130); },
  };

  // ─── ACK store ───────────────────────────────────────────────────
  function loadAcks() {
    try { return JSON.parse(localStorage.getItem(ACK_KEY) || '{}'); } catch { return {}; }
  }

  function saveAcks(acks) {
    try { localStorage.setItem(ACK_KEY, JSON.stringify(acks)); } catch {}
  }

  // ─── History store ───────────────────────────────────────────────
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }

  function saveHistory(h) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(0, 200))); } catch {}
  }

  function addHistory(entry) {
    const h = loadHistory();
    h.unshift({ ...entry, ts: new Date().toLocaleTimeString() });
    saveHistory(h);
  }

  // ─── Badge update ─────────────────────────────────────────────────
  function updateBadges(activeCount) {
    ['notifIndicator', 'sidebarAlarmBadge', 'alarmCount2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = activeCount;
    });
  }

  // ─── Public API ──────────────────────────────────────────────────
  const api = {

    // Acknowledge a single alarm by tag
    ack(tag) {
      const acks = loadAcks();
      acks[tag] = { ts: new Date().toLocaleTimeString(), by: 'Admin' };
      saveAcks(acks);
      sounds.ack();
      addHistory({ action: 'ACK', tag, note: 'Reconocida por Admin' });
      api.refreshTable();
      api.refreshTopbar();
      if (typeof window.showNotif === 'function') {
        window.showNotif('Alarma ' + tag + ' reconocida (ACK)', 'info');
      }
    },

    // Acknowledge all active alarms
    ackAll() {
      const acks = loadAcks();
      const data = typeof window.alarmData !== 'undefined' ? window.alarmData : [];
      data.filter(a => a.status === 'ACTIVA' || a.status === 'ACTIVE').forEach(a => {
        if (!acks[a.tag]) {
          acks[a.tag] = { ts: new Date().toLocaleTimeString(), by: 'Admin' };
          addHistory({ action: 'ACK', tag: a.tag, note: 'ACK masivo' });
        }
      });
      saveAcks(acks);
      sounds.ack();
      api.refreshTable();
      api.refreshTopbar();
      if (typeof window.showNotif === 'function') {
        window.showNotif('Todas las alarmas reconocidas', 'info');
      }
    },

    isAcked(tag) {
      return !!loadAcks()[tag];
    },

    // Refresh the alarm table body with ACK column
    refreshTable() {
      const tbody = document.getElementById('alarmTableBody');
      if (!tbody) return;

      const data  = typeof window.alarmData !== 'undefined' ? window.alarmData : [];
      const acks  = loadAcks();

      const priorityColors = {
        critical: 'var(--accent-red)',
        high:     'var(--accent-amber)',
        medium:   '#f97316',
        low:      'var(--primary)',
        resolved: 'var(--accent-green)',
      };

      tbody.innerHTML = data.map(a => {
        const acked   = !!acks[a.tag];
        const color   = priorityColors[a.priority] || 'var(--text-secondary)';
        const statusLabel = a.status === 'RESUELTA' || a.status === 'RESOLVED'
          ? `<span style="color:var(--accent-green)">● RESUELTA</span>`
          : acked
            ? `<span style="color:var(--accent-amber)">✓ ACK</span>`
            : `<span style="color:var(--accent-red)">● ACTIVA</span>`;

        return `<tr>
          <td><span class="alarm-priority ${a.priority}" style="background:${color}22;color:${color};border:1px solid ${color}44;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:0.08em">${a.priority.toUpperCase()}</span></td>
          <td style="font-family:'JetBrains Mono',monospace;color:${color};font-weight:600">${a.tag}</td>
          <td style="color:var(--text-secondary);font-size:13px">${a.desc}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-primary)">${a.val}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted)">${a.limit}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted)">${a.time}</td>
          <td>${statusLabel}</td>
          <td>${(!acked && a.status !== 'RESUELTA' && a.status !== 'RESOLVED')
            ? `<button onclick="AlarmManager.ack('${a.tag}')"
                style="background:var(--primary);border:none;color:#fff;border-radius:5px;padding:3px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:'JetBrains Mono',monospace">ACK</button>`
            : `<span style="font-size:11px;color:var(--text-muted);font-family:'JetBrains Mono',monospace">${acked ? acks[a.tag].ts : '—'}</span>`
          }</td>
        </tr>`;
      }).join('');

      // Update active count
      const active = data.filter(a =>
        a.status !== 'RESUELTA' && a.status !== 'RESOLVED' && !acks[a.tag]
      ).length;
      updateBadges(active);
    },

    // Update topbar dropdown alarm list
    refreshTopbar() {
      const list = document.getElementById('topbarAlarmList');
      if (!list) return;
      const data = typeof window.alarmData !== 'undefined' ? window.alarmData : [];
      const acks = loadAcks();

      list.innerHTML = data.slice(0, 6).map(a => {
        const isAcked = !!acks[a.tag];
        const dotColor = a.priority === 'critical' ? 'var(--accent-red)'
          : a.priority === 'high' ? 'var(--accent-amber)' : 'var(--primary)';
        return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px;${isAcked?'opacity:0.5':''}">
          <div style="width:7px;height:7px;border-radius:50%;background:${dotColor};margin-top:4px;flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${a.tag} — ${a.desc}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted)">${a.val} · ${a.time}${isAcked?' · ACK':''}</div>
          </div>
        </div>`;
      }).join('');
    },

    // Render history tab in notifications
    renderHistory() {
      const h = loadHistory();
      const el = document.getElementById('alarmHistoryList');
      if (!el) return;

      if (h.length === 0) {
        el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">Sin historial aún</div>';
        return;
      }

      el.innerHTML = h.map(entry => `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:11px 16px;border-bottom:1px solid var(--border)">
          <div style="width:7px;height:7px;border-radius:50%;background:${entry.action==='ACK'?'var(--accent-amber)':'var(--accent-green)'};margin-top:5px;flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500;color:var(--text-primary)">${entry.tag} — ${entry.note}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted)">${entry.ts}</div>
          </div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;background:${entry.action==='ACK'?'var(--accent-amber)':'var(--accent-green)'}22;color:${entry.action==='ACK'?'var(--accent-amber)':'var(--accent-green)'};padding:2px 7px;border-radius:4px">${entry.action}</span>
        </div>`).join('');
    },

    // Add ACK button column header if not present
    addAckColumn() {
      const thead = document.querySelector('#alarmTable thead tr');
      if (!thead) return;
      const headers = Array.from(thead.querySelectorAll('th')).map(th => th.textContent.trim());
      if (!headers.includes('ACK')) {
        const th = document.createElement('th');
        th.textContent = 'ACK';
        th.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:10px;font-weight:600;letter-spacing:0.1em';
        thead.appendChild(th);
      }
    },

    // Play sound for incoming critical alarm
    alertNew(priority) {
      if (sounds[priority]) sounds[priority]();
    },

    init() {
      api.addAckColumn();
      api.refreshTable();
      api.refreshTopbar();
      window.AlarmManager = api;
    }
  };

  return api;
})();

document.addEventListener('DOMContentLoaded', () => {
  AlarmManager.init();
});
