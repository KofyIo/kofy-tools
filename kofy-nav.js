// kofy-nav.js — Kofy floating navigator v1
// Drop <script src="kofy-nav.js"></script> in any tool to get the nav button.
(function () {
  const TOOLS = [
    { label: '📦 Órdenes',        href: 'orders.html',             group: 'ops' },
    { label: '🌱 Inventario',     href: 'inventory.html',          group: 'ops' },
    { label: '🔥 Torrefactora',   href: 'warehouse.html',          group: 'ops' },
    { label: '🎮 The Game',       href: 'game.html',               group: 'ops' },
    { label: '👥 Miembros',       href: 'miembros.html',           group: 'ops' },
    { label: '🖨️ Imprimir',      href: 'print.html',              group: 'ops' },
    { label: '📅 Calendario',     href: 'calendar-v8.html',        group: 'contenido' },
    { label: '🎞️ Footage',       href: 'footage.html',            group: 'contenido' },
    { label: '🤖 Kofy AI',        href: 'kofy-ai-test.html',       group: 'cliente' },
    { label: '🏪 Portal Cliente', href: 'warehouse-cliente.html',  group: 'cliente' },
    { label: '🇪🇹 Origen Etiopía', href: 'origen-etiopia.html',     group: 'cliente' },
  ];

  const GROUPS = [
    { key: 'ops',       label: 'Operaciones' },
    { key: 'contenido', label: 'Contenido' },
    { key: 'cliente',   label: 'Cliente' },
  ];

  const current = window.location.pathname.split('/').pop();

  // ── Styles ──
  const style = document.createElement('style');
  style.textContent = `
    #kn-btn {
      position: fixed; bottom: 24px; left: 24px; z-index: 9100;
      width: 44px; height: 44px; border-radius: 50%;
      background: #1f1830; border: 1px solid #2a2138;
      color: #9e8db8; font-size: 16px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      transition: border-color 0.15s, color 0.15s, transform 0.12s;
      font-family: -apple-system, system-ui, sans-serif;
    }
    #kn-btn:hover { border-color: #7a52b8; color: #f3e8d4; transform: scale(1.06); }
    #kn-btn.open  { border-color: #f5c842; color: #f5c842; background: #2a2138; }

    #kn-drawer {
      position: fixed; bottom: 78px; left: 24px; z-index: 9099;
      background: #15101f; border: 1px solid #2a2138; border-radius: 12px;
      padding: 8px; min-width: 196px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.65);
      opacity: 0; pointer-events: none;
      transform: translateY(8px);
      transition: opacity 0.15s, transform 0.15s;
    }
    #kn-drawer.open { opacity: 1; pointer-events: all; transform: translateY(0); }

    .kn-hub {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border-radius: 7px;
      color: #f5c842; text-decoration: none;
      font-size: 13px; font-weight: 600;
      font-family: -apple-system, system-ui, sans-serif;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #2a2138; margin-bottom: 4px;
      transition: background 0.1s;
    }
    .kn-hub:hover { background: rgba(245,200,66,0.07); }

    .kn-group-label {
      font-size: 9px; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: #9e8db8;
      padding: 6px 10px 2px;
      font-family: -apple-system, system-ui, sans-serif;
    }
    .kn-link {
      display: block; padding: 6px 10px; border-radius: 6px;
      color: #f3e8d4; text-decoration: none;
      font-size: 12px; white-space: nowrap;
      font-family: -apple-system, system-ui, sans-serif;
      transition: background 0.1s;
    }
    .kn-link:hover { background: #2a2138; }
    .kn-link.active { color: #f5c842; background: rgba(245,200,66,0.07); }

    #kn-overlay {
      position: fixed; inset: 0; z-index: 9098; display: none;
    }
    #kn-overlay.open { display: block; }
  `;
  document.head.appendChild(style);

  // ── Button ──
  const btn = document.createElement('button');
  btn.id = 'kn-btn';
  btn.title = 'Kofy Navigator';
  btn.innerHTML = '&#9783;'; // ⬗ grid-ish icon

  // ── Overlay (click-away) ──
  const overlay = document.createElement('div');
  overlay.id = 'kn-overlay';

  // ── Drawer ──
  const drawer = document.createElement('div');
  drawer.id = 'kn-drawer';

  // Hub link — points to the SYSTEMS 2.0 hub (the old kofy-hub.html is retired)
  const hubA = document.createElement('a');
  hubA.href = 'https://kofy-website.vercel.app/hub';
  hubA.className = 'kn-hub';
  hubA.innerHTML = '☕&nbsp; Kofy Hub';
  drawer.appendChild(hubA);

  // Tool groups
  GROUPS.forEach(g => {
    const tools = TOOLS.filter(t => t.group === g.key);
    if (!tools.length) return;

    const lbl = document.createElement('div');
    lbl.className = 'kn-group-label';
    lbl.textContent = g.label;
    drawer.appendChild(lbl);

    tools.forEach(tool => {
      const a = document.createElement('a');
      a.href = tool.href;
      a.className = 'kn-link' + (current === tool.href ? ' active' : '');
      a.textContent = tool.label;
      drawer.appendChild(a);
    });
  });

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
  document.body.appendChild(btn);

  // ── Toggle logic ──
  function open()  { drawer.classList.add('open'); overlay.classList.add('open'); btn.classList.add('open'); btn.innerHTML = '✕'; }
  function close() { drawer.classList.remove('open'); overlay.classList.remove('open'); btn.classList.remove('open'); btn.innerHTML = '&#9783;'; }

  btn.addEventListener('click', () => drawer.classList.contains('open') ? close() : open());
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
