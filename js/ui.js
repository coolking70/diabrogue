/* ═══════════════════════════════════════════════
   UI.JS — Screens, HUD, overlays, inventory
═══════════════════════════════════════════════ */

const UI = (() => {

  /* ──── Screen management ──── */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  /* ──── Tooltip ──── */
  const tooltipEl = document.getElementById('tooltip');
  let tooltipTarget = null;

  function showTooltip(el, html) {
    tooltipTarget = el;
    tooltipEl.innerHTML = html;
    tooltipEl.classList.remove('hidden');
    positionTooltip(el);
  }

  function hideTooltip() {
    tooltipEl.classList.add('hidden');
    tooltipTarget = null;
  }

  function positionTooltip(el) {
    const rect = el.getBoundingClientRect();
    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;
    let x = rect.right + 8;
    let y = rect.top;
    if (x + tw > window.innerWidth)  x = rect.left - tw - 8;
    if (y + th > window.innerHeight) y = window.innerHeight - th - 8;
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top  = y + 'px';
  }

  document.addEventListener('mousemove', e => {
    if (tooltipTarget) positionTooltip(tooltipTarget);
  });

  /* ──── Item Tooltip HTML ──── */
  function itemTooltipHtml(item) {
    const rarityColors = {
      normal: '#aaa', magic: '#4a9eff', rare: '#f0e060', legendary: '#ff8c00', set: '#00c853'
    };
    const rarityNames = {
      normal: '普通', magic: '魔法', rare: '稀有', legendary: '传说', set: '套装'
    };
    const slotNames = {
      head:'头盔',chest:'胸甲',legs:'腿甲',boots:'靴子',gloves:'手套',
      belt:'腰带',weapon:'武器',offhand:'副手',ring1:'戒指',ring2:'戒指',amulet:'项链'
    };

    const color = rarityColors[item.rarity] || '#aaa';
    let html = `<div class="tt-name" style="color:${color}">${item.name}</div>`;
    html += `<div class="tt-type">${rarityNames[item.rarity] || ''} · ${slotNames[item.slot] || item.slot} (lv.${item.ilvl || 1})</div>`;
    html += '<hr class="tt-divider">';

    item.affixes.forEach(a => {
      const isLeg = a.type === 'legendary';
      const valStr = formatAffixVal(a);
      html += `<div class="tt-affix${isLeg ? ' legendary' : ''}">${isLeg ? a.name : `+${valStr} ${a.name}`}</div>`;
    });

    if (item.affixes.length === 0) html += `<div style="color:#666">无额外属性</div>`;

    return html;
  }

  function formatAffixVal(a) {
    const v = a.val;
    if (a.stat === 'damageMul' || a.stat === 'speedMul' || a.stat === 'areaMul' || a.stat === 'xpMul')
      return `${Math.round(v * 100)}%`;
    if (a.stat === 'critChance' || a.stat === 'critMul' || a.stat === 'lifeSteal' || a.stat === 'cdMul')
      return `${Math.round(Math.abs(v) * 100)}%`;
    return Math.round(v);
  }

  /* ──── Lobby: Equipment Slots ──── */
  function renderEquipSlots(equipped, onSlotClick) {
    document.querySelectorAll('.equip-slot[data-slot]').forEach(el => {
      const slot = el.dataset.slot;
      const item = equipped[slot];
      el.classList.remove('has-item','rarity-normal','rarity-magic','rarity-rare','rarity-legendary','rarity-set');
      el.querySelector('.slot-icon').style.display = '';
      const old = el.querySelector('.item-label');
      if (old) old.remove();

      if (item) {
        el.classList.add('has-item', `rarity-${item.rarity}`);
        el.querySelector('.slot-icon').style.display = 'none';
        const label = document.createElement('div');
        label.className = 'item-label';
        label.textContent = item.name.slice(0, 4);
        el.appendChild(label);
        el.onmouseenter = () => showTooltip(el, itemTooltipHtml(item) + `<div class="tt-hint">右键/长按移除</div>`);
        el.onmouseleave = hideTooltip;
        el.oncontextmenu = e => { e.preventDefault(); onSlotClick(slot, 'unequip'); };
        // Touch: tap to unequip
        if (navigator.maxTouchPoints > 0) {
          el.onclick = () => { hideTooltip(); onSlotClick(slot, 'unequip'); };
        } else {
          el.onclick = null;
        }
      } else {
        el.onmouseenter = null;
        el.onmouseleave = null;
        el.oncontextmenu = null;
        el.onclick = null;
      }
    });
  }

  /* ──── Lobby: Inventory Grid ──── */
  function renderInventory(inventory, equipped, onItemClick) {
    const grid = document.getElementById('inv-grid');
    const count = document.getElementById('inv-count');
    grid.innerHTML = '';
    count.textContent = `${inventory.length}/20`;

    inventory.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = `inv-item rarity-${item.rarity}`;
      el.textContent = item.name.slice(0, 4);
      el.title = item.name;
      el.onmouseenter = () => showTooltip(el, itemTooltipHtml(item) + `<div class="tt-hint">点击装备 / 右键丢弃</div>`);
      el.onmouseleave = hideTooltip;
      el.onclick = () => { hideTooltip(); onItemClick(idx, 'equip'); };
      el.oncontextmenu = e => { e.preventDefault(); hideTooltip(); onItemClick(idx, 'drop'); };
      grid.appendChild(el);
    });
  }

  /* ──── Lobby: Character Stats ──── */
  function renderStats(player) {
    const list = document.getElementById('stats-list');
    const s = player.stats;
    const p = player;
    const rows = [
      ['生命值',     `${Math.round(s.maxHp)}`],
      ['基础伤害',   `${Math.round(s.damage)}`],
      ['伤害加成',   `${Math.round((s.damageMul||0)*100)}%`],
      ['暴击率',     `${Math.round((s.critChance||0.05)*100)}%`],
      ['暴击伤害',   `×${(s.critMul||1.5).toFixed(1)}`],
      ['移动速度',   `${Math.round(s.speedBase * (1+(s.speedMul||0)))}`],
      ['护甲',       `${Math.round(s.defense||0)}`],
      ['生命回复',   `${(s.regenPerSec||0).toFixed(1)}/s`],
      ['吸血',       `${Math.round((s.lifeSteal||0)*100)}%`],
      ['技能加速',   `${Math.round(Math.abs(s.cdMul||0)*100)}%`],
      ['技能范围',   `${Math.round((s.areaMul||0)*100)}%`],
      ['经验加成',   `${Math.round((s.xpMul||0)*100)}%`],
    ];
    list.innerHTML = rows.map(([n, v]) =>
      `<div class="stat-row"><span class="stat-name">${n}</span><span class="stat-val">${v}</span></div>`
    ).join('');
  }

  /* ──── HUD Update ──── */
  function updateHUD(game) {
    const p = game.player;

    // HP bar
    const hpPct = clamp(p.hp / p.stats.maxHp, 0, 1);
    document.getElementById('hp-fill').style.width = `${hpPct * 100}%`;
    document.getElementById('hp-text').textContent = `❤ ${Math.ceil(p.hp)} / ${p.stats.maxHp}`;

    // XP bar
    const xpPct = p.xp / p.xpToNext;
    document.getElementById('xp-fill').style.width = `${xpPct * 100}%`;
    document.getElementById('xp-text').textContent = `Lv.${p.level} · ${Math.floor(p.xp)}/${p.xpToNext} XP`;

    // Timer
    const sec = Math.floor(game.elapsed);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    document.getElementById('hud-timer').textContent = `${mm}:${ss}`;

    // Wave
    document.getElementById('hud-wave').textContent = `Wave ${game.wave}`;
    document.getElementById('hud-kills').textContent = `☠ ${game.kills}`;

    // Skill bar
    updateSkillBar(p, game);
  }

  function updateSkillBar(player, game) {
    const bar = document.getElementById('skill-bar');
    bar.innerHTML = '';
    Object.entries(player.skillLevels).forEach(([id, lv]) => {
      const def = CARD_DEFS.find(c => c.id === id);
      if (!def || def.type !== 'skill') return;
      const lvData = def.levels[lv - 1];
      const cd = (lvData.cooldown || 2.0) * player.effectiveCdMul;
      const timer = player.skillTimers[id] || 0;
      const pct = clamp(1 - timer / cd, 0, 1);

      const el = document.createElement('div');
      el.className = 'skill-icon';
      el.title = `${def.name} Lv.${lv}`;
      el.innerHTML = `
        <span>${def.icon}</span>
        <div class="skill-cd" style="width:${pct*100}%"></div>
      `;
      bar.appendChild(el);
    });
  }

  /* ──── Card Selection ──── */
  function showCardSelect(player, level, onPick) {
    const overlay = document.getElementById('overlay-cards');
    const choices = document.getElementById('card-choices');
    document.getElementById('card-lv-badge').textContent = `Lv. ${level}`;
    choices.innerHTML = '';
    overlay.classList.remove('hidden');

    const cards = generateCardChoices(player);

    cards.forEach(card => {
      const el = document.createElement('div');
      el.className = `skill-card rarity-${card.cardRarity}`;
      el.innerHTML = `
        <div class="card-icon">${card.icon}</div>
        <div class="card-rarity">${card.rarityLabel}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-level">${card.levelLabel}</div>
        <div class="card-desc">${card.desc}</div>
      `;
      el.onclick = () => {
        overlay.classList.add('hidden');
        onPick(card);
      };
      choices.appendChild(el);
    });

    // Esc / skip button = random pick
    const randomPick = () => {
      window.removeEventListener('keydown', escHandler);
      overlay.classList.add('hidden');
      onPick(cards[Math.floor(Math.random() * cards.length)]);
    };
    const escHandler = e => { if (e.key === 'Escape') randomPick(); };
    window.addEventListener('keydown', escHandler);
    const skipBtn = document.getElementById('btn-skip-card');
    if (skipBtn) skipBtn.onclick = randomPick;
  }

  function generateCardChoices(player) {
    // Pool: unlearned skills + upgradeable skills + passives
    const pool = [];

    CARD_DEFS.forEach(def => {
      const currentLv = player.skillLevels[def.id] || 0;
      if (currentLv >= def.maxLevel) return;
      const nextLv = currentLv + 1;
      const lvData = def.levels[nextLv - 1];
      pool.push({
        id: def.id,
        name: def.name,
        icon: def.icon,
        type: def.type,
        cardRarity: mapRarity(def.rarity),
        rarityLabel: rarityLabel(def.rarity),
        levelLabel: currentLv === 0 ? '新技能' : `Lv.${currentLv} → Lv.${nextLv}`,
        desc: lvData.desc,
        stat: lvData.stat,
        val: lvData.val,
        weight: rarityWeight(def.rarity, currentLv),
      });
    });

    if (!pool.length) return [];

    // Weighted random pick 3 unique
    const picked = [];
    const usedIds = new Set();
    const maxTries = 50;
    let tries = 0;
    while (picked.length < 3 && tries < maxTries) {
      tries++;
      const total = pool.filter(c => !usedIds.has(c.id)).reduce((s, c) => s + c.weight, 0);
      if (total === 0) break;
      let r = Math.random() * total;
      for (const c of pool) {
        if (usedIds.has(c.id)) continue;
        r -= c.weight;
        if (r <= 0) {
          picked.push(c);
          usedIds.add(c.id);
          break;
        }
      }
    }
    return picked;
  }

  function mapRarity(r) {
    if (r === 'legendary') return 'legendary';
    if (r === 'rare')      return 'rare';
    if (r === 'uncommon')  return 'uncommon';
    return 'common';
  }
  function rarityLabel(r) {
    return { common:'普通', uncommon:'优秀', rare:'稀有', legendary:'传说' }[r] || '普通';
  }
  function rarityWeight(r, currentLv) {
    const base = { common:10, uncommon:6, rare:3, legendary:1 }[r] || 10;
    return base / (1 + currentLv * 0.5);
  }

  /* ──── End Screen ──── */
  function showEndScreen(victory, stats, loot, onBack) {
    const overlay = document.getElementById('overlay-end');
    const title   = document.getElementById('end-title');
    const statsEl = document.getElementById('end-stats');
    const itemsEl = document.getElementById('end-items');

    title.textContent = victory ? '🏆 挑战成功！' : '💀 角色阵亡';
    title.className   = victory ? 'victory' : 'defeat';

    const rows = [
      ['生存时间',   stats.time],
      ['到达波次',   `Wave ${stats.wave}`],
      ['击杀数量',   `${stats.kills} 只`],
      ['最高等级',   `Lv. ${stats.level}`],
      ['获得战利品', `${loot.length} 件`],
    ];
    statsEl.innerHTML = rows.map(([l,v]) =>
      `<div class="end-stat"><span class="label">${l}</span><span class="value">${v}</span></div>`
    ).join('');

    itemsEl.innerHTML = '';
    if (loot.length === 0) {
      itemsEl.innerHTML = '<span style="color:#666">无装备掉落</span>';
    } else {
      loot.forEach(item => {
        const el = document.createElement('div');
        el.className = `loot-item rarity-${item.rarity}`;
        el.textContent = item.name;
        el.onmouseenter = () => showTooltip(el, itemTooltipHtml(item));
        el.onmouseleave = hideTooltip;
        itemsEl.appendChild(el);
      });
    }

    document.getElementById('btn-back').onclick = () => {
      overlay.classList.add('hidden');
      onBack(loot);
    };

    overlay.classList.remove('hidden');
  }

  return {
    showScreen,
    showTooltip,
    hideTooltip,
    itemTooltipHtml,
    renderEquipSlots,
    renderInventory,
    renderStats,
    updateHUD,
    showCardSelect,
    showEndScreen,
  };
})();
