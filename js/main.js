/* ═══════════════════════════════════════════════
   MAIN.JS — State, init, event handlers, save/load
═══════════════════════════════════════════════ */

/* ──── Global Save State ──── */
const STATE = {
  equipped:  {},   // slot → item
  inventory: [],   // item[]
  bestRun: null,   // { time, wave, kills, level }
};

const SAVE_KEY = 'diabrogue_save';

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    equipped:  STATE.equipped,
    inventory: STATE.inventory,
    bestRun:   STATE.bestRun,
  }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.equipped)  STATE.equipped  = data.equipped;
    if (data.inventory) STATE.inventory = data.inventory;
    if (data.bestRun)   STATE.bestRun   = data.bestRun;
  } catch(e) { console.warn('Save load failed', e); }
}

/* ──── Build lobby player (stats preview) ──── */
function buildLobbyPlayer() {
  const equipBonus = computeEquipStats(STATE.equipped);
  const s = { ...BASE_PLAYER_STATS };
  for (const [k, v] of Object.entries(equipBonus)) {
    s[k] = (s[k] || 0) + v;
  }
  return { stats: s, skillLevels: {} };
}

/* ──── Lobby Render ──── */
function renderLobby() {
  const lobbyPlayer = buildLobbyPlayer();
  UI.renderStats(lobbyPlayer);
  UI.renderEquipSlots(STATE.equipped, handleSlotAction);
  UI.renderInventory(STATE.inventory, STATE.equipped, handleInventoryItem);
  renderBestRun();
}

function renderBestRun() {
  const el = document.getElementById('best-run');
  if (!STATE.bestRun) { el.textContent = '尚无记录'; return; }
  const b = STATE.bestRun;
  el.textContent = `最佳: ${b.time} · Wave${b.wave} · ☠${b.kills} · Lv.${b.level}`;
}

/* ──── Equipment Slot Actions ──── */
function handleSlotAction(slot, action) {
  if (action === 'unequip') {
    const item = STATE.equipped[slot];
    if (!item) return;
    if (STATE.inventory.length >= 20) {
      alert('背包已满！请先整理背包。');
      return;
    }
    STATE.inventory.push(item);
    delete STATE.equipped[slot];
    saveState();
    renderLobby();
  }
}

/* ──── Inventory Actions ──── */
function handleInventoryItem(idx, action) {
  const item = STATE.inventory[idx];
  if (!item) return;

  if (action === 'drop') {
    STATE.inventory.splice(idx, 1);
    saveState();
    renderLobby();
    return;
  }

  if (action === 'equip') {
    // Swap with currently equipped item in that slot
    const currentEquipped = STATE.equipped[item.slot];
    STATE.inventory.splice(idx, 1);
    if (currentEquipped) {
      STATE.inventory.push(currentEquipped);
    }
    STATE.equipped[item.slot] = item;
    saveState();
    renderLobby();
  }
}

/* ──── Post-run: add loot to inventory ──── */
function addRunLoot(loot) {
  loot.forEach(item => {
    if (STATE.inventory.length < 20) {
      STATE.inventory.push(item);
    }
    // If full, auto-drop lowest rarity items
  });
  saveState();
}

/* ──── Start Run ──── */
let activeGame = null;

function startRun() {
  UI.showScreen('screen-game');

  // Wait one frame so the browser completes layout before reading canvas dimensions
  requestAnimationFrame(() => {
    const canvas = document.getElementById('game-canvas');
    canvas.width  = canvas.offsetWidth  || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;

    const player = new Player(null, STATE.equipped);

    activeGame = new Game(
      canvas,
      player,
      // onLevelUp
      (level) => {
        UI.showCardSelect(player, level, (card) => {
          applyCardPick(player, card);
          if (activeGame) activeGame.paused = false;
        });
      },
      // onDeath
      (loot) => {
        const stats = buildRunStats(activeGame, loot);
        updateBestRun(activeGame, false);
        UI.showEndScreen(false, stats, loot, (loot2) => {
          addRunLoot(loot2);
          endRun();
        });
      },
      // onVictory
      (loot) => {
        const stats = buildRunStats(activeGame, loot);
        updateBestRun(activeGame, true);
        UI.showEndScreen(true, stats, loot, (loot2) => {
          addRunLoot(loot2);
          endRun();
        });
      },
    );

    activeGame.start();
    startHudLoop();
  });
}

function buildRunStats(game, loot) {
  const sec = Math.floor(game.elapsed);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return {
    time:  `${mm}:${ss}`,
    wave:  game.wave,
    kills: game.kills,
    level: game.player.level,
    loot,
  };
}

function updateBestRun(game, victory) {
  const cur = {
    time:    buildRunStats(game, []).time,
    wave:    game.wave,
    kills:   game.kills,
    level:   game.player.level,
    victory,
  };
  if (!STATE.bestRun || game.kills > (STATE.bestRun.kills || 0)) {
    STATE.bestRun = cur;
    saveState();
  }
}

function endRun() {
  if (activeGame) { activeGame.stop(); activeGame = null; }
  stopHudLoop();
  UI.showScreen('screen-lobby');
  renderLobby();
}

/* ──── Card pick application ──── */
function applyCardPick(player, card) {
  if (card.type === 'skill') {
    player.addSkill(card.id);
  } else if (card.type === 'passive') {
    player.addPassive(card.stat, card.val);
    // Special: critMul from crit_chance card
    const def = CARD_DEFS.find(c => c.id === card.id);
    if (def) {
      const currentLv = player.skillLevels[card.id] || 0;
      const lvData = def.levels[currentLv]; // next level data (before addSkill)
      if (lvData && lvData.critMul) player.addPassive('critMul', lvData.critMul);
    }
    player.skillLevels[card.id] = (player.skillLevels[card.id] || 0) + 1;
  }
}

/* ──── HUD loop (separate from game loop for reliability) ──── */
let hudInterval = null;
function startHudLoop() {
  hudInterval = setInterval(() => {
    if (activeGame && !activeGame.paused) {
      UI.updateHUD(activeGame);
    }
  }, 50);
}
function stopHudLoop() {
  if (hudInterval) { clearInterval(hudInterval); hudInterval = null; }
}

/* ──── Reset ──── */
function resetSave() {
  if (!confirm('确认重置所有存档？装备和背包将清空。')) return;
  localStorage.removeItem(SAVE_KEY);
  STATE.equipped  = {};
  STATE.inventory = [];
  STATE.bestRun   = null;
  renderLobby();
}

/* ──── Init ──── */
function init() {
  loadState();
  renderLobby();
  UI.showScreen('screen-lobby');

  document.getElementById('btn-start').onclick = startRun;
  document.getElementById('btn-reset').onclick = resetSave;
  document.getElementById('btn-back').onclick  = null; // handled per-run in showEndScreen
}

// Bootstrap
window.addEventListener('DOMContentLoaded', init);
