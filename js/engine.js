/* ═══════════════════════════════════════════════
   ENGINE.JS — Core game loop, entities, skills
═══════════════════════════════════════════════ */

/* ──── Vec2 Helper ──── */
class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  clone()       { return new Vec2(this.x, this.y); }
  add(v)        { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v)        { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s)      { return new Vec2(this.x * s, this.y * s); }
  dot(v)        { return this.x * v.x + this.y * v.y; }
  len()         { return Math.sqrt(this.x * this.x + this.y * this.y); }
  lenSq()       { return this.x * this.x + this.y * this.y; }
  norm()        { const l = this.len(); return l > 0 ? this.scale(1 / l) : new Vec2(0, 0); }
  dist(v)       { return this.sub(v).len(); }
  distSq(v)     { return this.sub(v).lenSq(); }
  angle()       { return Math.atan2(this.y, this.x); }
  addMut(v)     { this.x += v.x; this.y += v.y; return this; }
  static fromAngle(a, len = 1) { return new Vec2(Math.cos(a) * len, Math.sin(a) * len); }
  static rand(len = 1) { return Vec2.fromAngle(Math.random() * Math.PI * 2, len); }
  static randOnRing(minR, maxR) { return Vec2.fromAngle(Math.random() * Math.PI * 2, minR + Math.random() * (maxR - minR)); }
}

/* ──── Utility ──── */
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function chance(p) { return Math.random() < p; }

/* ──── Item Generation ──── */
function generateItem(wave) {
  const rarityRoll = Math.random();
  let rarity;
  const bumpLegendary = wave >= 10 ? 0.05 : 0;
  if (rarityRoll < 0.02 + bumpLegendary) rarity = 'legendary';
  else if (rarityRoll < 0.12 + bumpLegendary) rarity = 'rare';
  else if (rarityRoll < 0.45) rarity = 'magic';
  else rarity = 'normal';

  const slots = Object.keys(ITEM_BASES);
  const slot = slots[randInt(0, slots.length - 1)];
  const bases = ITEM_BASES[slot];
  const baseName = bases[randInt(0, bases.length - 1)];

  const item = {
    id: Math.random().toString(36).slice(2),
    name: baseName,
    slot,
    rarity,
    affixes: [],
    ilvl: wave,
  };

  const eligibleAffixes = AFFIXES.filter(a => {
    if (a.type === 'legendary') return false;
    if (a.slots && !a.slots.includes(slot)) return false;
    return true;
  });

  let affixCount = 0;
  if (rarity === 'magic')     affixCount = randInt(1, 2);
  if (rarity === 'rare')      affixCount = randInt(3, 4);
  if (rarity === 'legendary') affixCount = randInt(4, 5);

  const used = new Set();
  for (let i = 0; i < affixCount; i++) {
    const pool = eligibleAffixes.filter(a => !used.has(a.id) && a.weight > 0);
    if (!pool.length) break;
    const totalW = pool.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * totalW;
    for (const a of pool) {
      r -= a.weight;
      if (r <= 0) {
        const scale = 1 + (wave - 1) * 0.08;
        const val = rand(a.min * scale, a.max * scale);
        item.affixes.push({ id: a.id, stat: a.stat, type: a.type, val, name: a.name });
        used.add(a.id);
        break;
      }
    }
  }

  // Add legendary power
  if (rarity === 'legendary') {
    const legPowers = AFFIXES.filter(a => a.type === 'legendary');
    const lp = legPowers[randInt(0, legPowers.length - 1)];
    item.affixes.push({ id: lp.id, stat: lp.stat, type: 'legendary', val: rand(lp.min, lp.max), name: lp.name });
  }

  // Compose display name
  if (rarity === 'magic' && item.affixes.length > 0) {
    item.name = item.affixes[0].name.replace(/[【】%+\s]/g,'').slice(0,4) + item.name;
  }
  if (rarity === 'rare') {
    const prefixes = ['暗影','血腥','冰冻','火焰','雷霆','毁灭','骸骨','深渊'];
    item.name = prefixes[randInt(0, prefixes.length - 1)] + item.name;
  }
  if (rarity === 'legendary') {
    const legNames = ['末日','永恒','混沌','天命','古代','神圣','虚空'];
    item.name = legNames[randInt(0, legNames.length - 1)] + item.name;
  }

  return item;
}

/* Compute total stats a player gets from equipment */
function computeEquipStats(equipped) {
  const bonus = {};
  Object.values(equipped).forEach(item => {
    if (!item) return;
    item.affixes.forEach(a => {
      bonus[a.stat] = (bonus[a.stat] || 0) + a.val;
    });
  });
  return bonus;
}

/* ──── Particle System ──── */
class Particle {
  constructor(x, y, vx, vy, r, color, life) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = r; this.color = color;
    this.life = this.maxLife = life;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 60 * dt; // gravity
    this.life -= dt;
    return this.life > 0;
  }
  draw(ctx) {
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ──── Damage Number ──── */
class DamageNum {
  constructor(x, y, val, crit, color) {
    this.x = x; this.y = y;
    this.val = Math.round(val);
    this.crit = crit;
    this.color = color || (crit ? '#ffcc00' : '#ffffff');
    this.life = crit ? 1.2 : 0.9;
    this.maxLife = this.life;
    this.vy = crit ? -90 : -60;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.vy += 40 * dt;
    this.life -= dt;
    return this.life > 0;
  }
  draw(ctx) {
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.font = this.crit ? `bold ${18 + this.val * 0.02}px sans-serif` : '14px sans-serif';
    ctx.fillStyle = this.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    const text = this.crit ? `★${this.val}` : `${this.val}`;
    ctx.strokeText(text, this.x, this.y);
    ctx.fillText(text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

/* ──── Projectile ──── */
class Projectile {
  constructor({ pos, dir, speed, damage, color, radius, pierce, ttl, onHit, explodeRadius, slowDur, freezeDur, isArrow, isMelee }) {
    this.pos = pos.clone();
    this.dir = dir;
    this.speed = speed;
    this.damage = damage;
    this.color = color;
    this.radius = radius || 6;
    this.pierce = pierce || 0;
    this.ttl = ttl || 2;
    this.onHit = onHit || null;
    this.explodeRadius = explodeRadius || 0;
    this.slowDur = slowDur || 0;
    this.freezeDur = freezeDur || 0;
    this.isArrow = isArrow || false;
    this.isMelee = isMelee || false;
    this.dead = false;
    this.hitEnemies = new Set();
  }
  update(dt) {
    this.pos.addMut(this.dir.scale(this.speed * dt));
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    // Trail
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    const trail = this.dir.scale(-this.radius * 2.5);
    ctx.arc(this.pos.x + trail.x, this.pos.y + trail.y, this.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/* ──── Enemy ──── */
class Enemy {
  constructor(type, pos, scale) {
    this.type = type;
    this.pos = pos.clone();
    this.scale = scale;
    this.maxHp = type.hp * scale;
    this.hp = this.maxHp;
    this.dmg = type.dmg * scale;
    this.speed = type.speed;
    this.radius = type.radius;
    this.color = type.color;
    this.tier = type.tier;
    this.attackCooldown = 0;
    this.attackRate = 1.2;
    this.dead = false;
    this.slowTimer = 0;
    this.freezeTimer = 0;
    this.poisonDmg = 0;
    this.poisonTimer = 0;
    this.flashTimer = 0;
    this.vel = new Vec2();
  }

  update(dt, player) {
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      return;
    }
    const speedMul = this.slowTimer > 0 ? 0.4 : 1;
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);

    // Poison tick
    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      this.hp -= this.poisonDmg * dt;
    }

    const toPlayer = player.pos.sub(this.pos);
    const dist = toPlayer.len();
    if (dist > 1) {
      const dir = toPlayer.norm();
      this.vel = dir.scale(this.speed * speedMul);
      if (dist > this.radius + player.radius + 2) {
        this.pos.addMut(this.vel.scale(dt));
      }
    }

    // Attack player
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (dist < this.radius + player.radius + 8 && this.attackCooldown <= 0) {
      const def = player.stats.defense;
      const reduced = Math.max(1, this.dmg - def * 0.5);
      player.takeDamage(reduced);
      this.attackCooldown = this.attackRate;
    }
  }

  takeDamage(dmg, isCrit) {
    this.hp -= dmg;
    this.flashTimer = 0.12;
    if (this.hp <= 0) this.dead = true;
    return { dmg, isCrit };
  }

  draw(ctx) {
    const isElite = this.tier === 'elite';
    const isBoss  = this.tier === 'boss';

    // Flash white on hit
    if (this.flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashTimer / 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Glow for elites/bosses
    ctx.save();
    if (isElite || isBoss) {
      ctx.shadowBlur = isBoss ? 30 : 15;
      ctx.shadowColor = this.color;
    }
    if (this.freezeTimer > 0) ctx.shadowColor = '#88ddff';

    ctx.fillStyle = this.freezeTimer > 0 ? '#88ddff' : this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Elite ring
    if (isElite) {
      ctx.strokeStyle = '#ffcc44';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Boss crown indicator
    if (isBoss) {
      ctx.fillStyle = '#ffcc44';
      ctx.font = `${this.radius}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('👑', this.pos.x, this.pos.y - this.radius - 4);
    }

    ctx.restore();

    // HP bar
    const bw = this.radius * 2.5;
    const bx = this.pos.x - bw / 2;
    const by = this.pos.y - this.radius - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, bw, 5);
    const pct = clamp(this.hp / this.maxHp, 0, 1);
    const hpColor = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = hpColor;
    ctx.fillRect(bx, by, bw * pct, 5);

    // Name for elites/bosses
    if (isElite || isBoss) {
      ctx.fillStyle = isBoss ? '#ffcc44' : '#ffaa44';
      ctx.font = `bold ${isBoss ? 13 : 11}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.type.name, this.pos.x, this.pos.y + this.radius + 14);
    }
  }
}

/* ──── Player ──── */
class Player {
  constructor(savedStats, equipped) {
    this.pos = new Vec2(0, 0);
    this.radius = 16;
    this.vel = new Vec2();
    this.facing = new Vec2(1, 0);

    // Stats (base + equipment)
    this.baseStats = { ...BASE_PLAYER_STATS };
    const equipBonus = computeEquipStats(equipped || {});
    this.stats = {};
    this.recomputeStats(equipBonus);

    this.hp = this.stats.maxHp;
    this.xp = 0;
    this.level = 1;
    this.xpToNext = xpForLevel(2);

    // Skill system
    this.skillLevels = {};   // skillId → level
    this.skillTimers = {};   // skillId → timer
    this.orbitAngle  = 0;

    // Passive stacks
    this.passiveStats = {
      damageMul: 0, speedMul: 0, cdMul: 0, areaMul: 0,
      maxHp: 0, regenPerSec: 0, critChance: 0, critMul: 0,
      lifeSteal: 0, xpMul: 0,
    };

    this.dead = false;
    this.invincibleTimer = 0;
    this.flashTimer = 0;
    this.regenAccum = 0;
  }

  recomputeStats(equipBonus = {}) {
    const s = { ...BASE_PLAYER_STATS };
    // Apply equipment flat bonuses
    for (const [k, v] of Object.entries(equipBonus)) {
      if (k === 'damageMul' || k === 'speedMul' || k === 'cdMul' || k === 'areaMul' || k === 'xpMul') {
        s[k] = (s[k] || 0) + v;
      } else {
        s[k] = (s[k] || 0) + v;
      }
    }
    this.stats = s;
  }

  addPassive(stat, val) {
    if (stat in this.passiveStats) {
      this.passiveStats[stat] += val;
      // Sync to stats
      if (stat === 'maxHp') {
        this.stats.maxHp += val;
        this.hp = Math.min(this.hp + val, this.stats.maxHp);
      } else {
        this.stats[stat] = (this.stats[stat] || 0) + val;
      }
    }
  }

  addSkill(skillId) {
    const prev = this.skillLevels[skillId] || 0;
    this.skillLevels[skillId] = prev + 1;
    if (!this.skillTimers[skillId]) this.skillTimers[skillId] = 0;
  }

  takeDamage(amount) {
    if (this.invincibleTimer > 0) return;
    const reduced = Math.max(1, amount - this.stats.defense * 0.3);
    this.hp -= reduced;
    this.flashTimer = 0.2;
    this.invincibleTimer = 0.4;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  gainXp(amount) {
    const mul = 1 + this.stats.xpMul + (this.passiveStats.xpMul || 0);
    this.xp += amount * mul;
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level + 1);
      this.hp = Math.min(this.hp + this.stats.maxHp * 0.2, this.stats.maxHp);
      return true; // leveled up
    }
    return false;
  }

  get effectiveDamage() {
    const totalMul = 1 + (this.stats.damageMul || 0);
    return this.stats.damage * totalMul;
  }
  get effectiveSpeed() {
    const totalMul = 1 + (this.stats.speedMul || 0);
    return this.stats.speedBase * totalMul;
  }
  get effectiveCdMul() { return 1 + (this.stats.cdMul || 0); }
  get effectiveAreaMul() { return 1 + (this.stats.areaMul || 0); }

  rollCrit() {
    const c = clamp(this.stats.critChance, 0, 0.95);
    const crit = Math.random() < c;
    const mul  = this.stats.critMul;
    return { crit, mul: crit ? mul : 1 };
  }

  computeDamage(baseMul = 1) {
    const { crit, mul } = this.rollCrit();
    const dmg = this.effectiveDamage * baseMul * mul;
    return { dmg, crit };
  }

  update(dt, keys, enemies) {
    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    this.flashTimer      = Math.max(0, this.flashTimer - dt);

    // Movement
    const speed = this.effectiveSpeed;
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup'])    dy -= 1;
    if (keys['s'] || keys['arrowdown'])  dy += 1;
    if (keys['a'] || keys['arrowleft'])  dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const d = new Vec2(dx, dy).norm();
      this.pos.addMut(d.scale(speed * dt));
      this.facing = d;
    }

    // HP regen
    const regen = this.stats.regenPerSec || 0;
    if (regen > 0 && this.hp < this.stats.maxHp) {
      this.regenAccum += regen * dt;
      if (this.regenAccum >= 1) {
        this.hp = Math.min(this.hp + Math.floor(this.regenAccum), this.stats.maxHp);
        this.regenAccum -= Math.floor(this.regenAccum);
      }
    }
  }

  draw(ctx) {
    const x = this.pos.x, y = this.pos.y, r = this.radius;

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.flashTimer > 0 ? '#ff6666' : '#4488ff';

    // Body glow
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, this.flashTimer > 0 ? '#ff9999' : '#88aaff');
    grad.addColorStop(1, this.flashTimer > 0 ? '#cc2222' : '#2244cc');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.strokeStyle = this.flashTimer > 0 ? '#ffaaaa' : '#aabbff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Direction indicator
    ctx.fillStyle = '#ffffff';
    const dir = this.facing;
    ctx.beginPath();
    ctx.arc(x + dir.x * (r - 5), y + dir.y * (r - 5), 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/* ──── Skill Implementations ──── */
function applySkills(game, dt) {
  const p = game.player;
  const cdMul = p.effectiveCdMul;
  const areaMul = p.effectiveAreaMul;

  for (const [skillId, level] of Object.entries(p.skillLevels)) {
    const def = CARD_DEFS.find(c => c.id === skillId);
    if (!def || def.type !== 'skill') continue;
    const lv = def.levels[level - 1];

    p.skillTimers[skillId] -= dt;
    if (p.skillTimers[skillId] > 0) continue;

    const cd = (lv.cooldown || 2.0) * clamp(cdMul, 0.3, 1.5);
    p.skillTimers[skillId] = cd;

    switch (skillId) {
      case 'fireball':   fireFireball(game, lv, areaMul);    break;
      case 'lightning':  fireLightning(game, lv);            break;
      case 'blizzard':   fireBlizzard(game, lv, areaMul);    break;
      case 'arrow_rain': fireArrowRain(game, lv, areaMul);   break;
      case 'void_slash': fireVoidSlash(game, lv, areaMul);   break;
      default: break;
    }
  }

  // Orbit (passive continuous)
  if (p.skillLevels['orbit']) {
    const lv = CARD_DEFS.find(c => c.id === 'orbit').levels[p.skillLevels['orbit'] - 1];
    p.orbitAngle += lv.speed * dt;
    updateOrbit(game, lv, areaMul);
  }

  // Poison cloud (passive continuous)
  if (p.skillLevels['poison_cloud']) {
    const lv = CARD_DEFS.find(c => c.id === 'poison_cloud').levels[p.skillLevels['poison_cloud'] - 1];
    applyPoisonCloud(game, lv, areaMul, dt);
  }

  // Holy ground (passive continuous)
  if (p.skillLevels['holy_ground']) {
    const lv = CARD_DEFS.find(c => c.id === 'holy_ground').levels[p.skillLevels['holy_ground'] - 1];
    applyHolyGround(game, lv, areaMul, dt);
  }
}

function fireFireball(game, lv, areaMul) {
  const p = game.player;
  const count = lv.count || 1;
  const targets = getClosestEnemies(game, count + 2);
  const used = [];
  for (let i = 0; i < count; i++) {
    const t = targets.find(e => !used.includes(e)) || targets[0];
    if (!t) return;
    used.push(t);
    const dir = t.pos.sub(p.pos).norm();
    const { dmg, crit } = p.computeDamage(lv.dmgMul || 1.2);
    game.projectiles.push(new Projectile({
      pos: p.pos,
      dir,
      speed: 260,
      damage: dmg,
      color: '#ff7722',
      radius: (lv.radius || 10) * areaMul,
      pierce: lv.pierce || 0,
      ttl: 2.0,
      explodeRadius: lv.explode ? 80 * areaMul : 0,
      onHit: lv.explode ? (e, g, dmg2, crit2) => spawnExplosion(g, e.pos, 80 * areaMul, dmg2 * 0.5) : null,
    }));
  }
}

function fireLightning(game, lv) {
  const p = game.player;
  const first = getClosestEnemies(game, 1)[0];
  if (!first) return;
  const { dmg, crit } = p.computeDamage(lv.dmgMul || 1.3);

  let target = first;
  let prev    = p.pos;
  const chainCount = lv.chains || 2;
  const hit = new Set([first.id || first]);

  // Visual lightning bolt to first target
  game.lightningBolts.push({ from: prev.clone(), to: target.pos.clone(), life: 0.15 });
  dealDamage(game, target, dmg, crit);

  for (let c = 1; c < chainCount; c++) {
    const next = game.enemies
      .filter(e => !e.dead && !hit.has(e) && e.pos.dist(target.pos) < 180)
      .sort((a, b) => a.pos.distSq(target.pos) - b.pos.distSq(target.pos))[0];
    if (!next) break;
    game.lightningBolts.push({ from: target.pos.clone(), to: next.pos.clone(), life: 0.15 });
    dealDamage(game, next, dmg * 0.75, crit);
    hit.add(next);
    target = next;
  }
}

function fireBlizzard(game, lv, areaMul) {
  const count = lv.count || 1;
  for (let i = 0; i < count; i++) {
    const targets = game.enemies.filter(e => !e.dead);
    if (!targets.length) return;
    const t = targets[randInt(0, targets.length - 1)];
    const radius = (lv.radius || 70) * areaMul;
    spawnExplosion(game, t.pos, radius, 0, '#88ddff', 0.8);
    game.enemies.filter(e => !e.dead && e.pos.dist(t.pos) < radius).forEach(e => {
      const { dmg, crit } = game.player.computeDamage(lv.dmgMul || 2.0);
      dealDamage(game, e, dmg, crit);
      if (lv.freezeDur) { e.freezeTimer = lv.freezeDur; }
      else { e.slowTimer = lv.slowDur || 2.0; }
    });
  }
}

function fireArrowRain(game, lv, areaMul) {
  const targets = game.enemies.filter(e => !e.dead);
  if (!targets.length) return;
  const center = targets[randInt(0, targets.length - 1)].pos;
  const arrowCount = lv.arrows || 8;
  const radius = (lv.radius || 90) * areaMul;
  for (let i = 0; i < arrowCount; i++) {
    const offset = Vec2.randOnRing(0, radius);
    const landPos = center.add(offset);
    game.arrowRainDrops.push({ pos: landPos, life: 0.5, maxLife: 0.5, dmgMul: lv.dmgMul || 1.0, fired: false });
  }
}

function fireVoidSlash(game, lv, areaMul) {
  const p = game.player;
  const fullCircle = (lv.width || 60) >= 360;
  const range = (lv.range || 180) * areaMul;
  const width = (lv.width || 60) * (Math.PI / 180);
  const hits = lv.hits || 1;

  let dir;
  if (fullCircle) {
    dir = new Vec2(1, 0);
  } else {
    const t = getClosestEnemies(game, 1)[0];
    if (!t) return;
    dir = t.pos.sub(p.pos).norm();
  }

  for (let h = 0; h < hits; h++) {
    const baseAngle = dir.angle() + h * (Math.PI / 4);
    const arcWidth  = fullCircle ? Math.PI * 2 : width;

    // Visual slash arc
    game.slashArcs.push({ pos: p.pos.clone(), angle: baseAngle, arcWidth, range, life: 0.25, color: '#aa44ff' });

    game.enemies.filter(e => !e.dead).forEach(e => {
      const toE = e.pos.sub(p.pos);
      const dist = toE.len();
      if (dist > range + e.radius) return;
      if (!fullCircle) {
        const angle = Math.atan2(toE.y, toE.x);
        let diff = angle - baseAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > arcWidth / 2) return;
      }
      const { dmg, crit } = p.computeDamage(lv.dmgMul || 2.0);
      dealDamage(game, e, dmg, crit);
    });
  }
}

function updateOrbit(game, lv, areaMul) {
  const p = game.player;
  const count = lv.count || 2;
  const radius = 70 * areaMul;
  const { dmg } = p.computeDamage(lv.dmgMul || 0.5);

  for (let i = 0; i < count; i++) {
    const angle = p.orbitAngle + (i / count) * Math.PI * 2;
    const bladePos = p.pos.add(Vec2.fromAngle(angle, radius));
    // Register as orbit blade in game for rendering
    if (!game.orbitBlades) game.orbitBlades = [];
    if (game.orbitBlades.length < count) {
      game.orbitBlades.push({ pos: bladePos });
    } else if (game.orbitBlades[i]) {
      game.orbitBlades[i].pos = bladePos;
    }
    // Damage
    game.enemies.filter(e => !e.dead && e.pos.dist(bladePos) < e.radius + 12).forEach(e => {
      const { dmg: d, crit } = p.computeDamage(lv.dmgMul || 0.5);
      dealDamage(game, e, d, crit);
    });
  }
}

function applyPoisonCloud(game, lv, areaMul, dt) {
  const p = game.player;
  const radius = (lv.radius || 80) * areaMul;
  const dmgPerSec = lv.dmgPerSec || 0.2;
  const slow = lv.slow || 0;
  game.enemies.filter(e => !e.dead && e.pos.dist(p.pos) < radius).forEach(e => {
    // Apply poison DoT
    e.poisonDmg = p.effectiveDamage * dmgPerSec;
    e.poisonTimer = 0.6; // refresh
    if (slow > 0) e.slowTimer = Math.max(e.slowTimer, 0.4);
    // Damage numbers occasionally
    if (Math.random() < dt * 2) {
      const d = e.poisonDmg * 0.5;
      game.dmgNums.push(new DamageNum(e.pos.x + rand(-10, 10), e.pos.y - e.radius, d, false, '#88ff44'));
      e.hp -= d * dt;
      if (e.hp <= 0) e.dead = true;
    }
  });
}

function applyHolyGround(game, lv, areaMul, dt) {
  const p = game.player;
  const radius = (lv.radius || 100) * areaMul;
  const dmgPerSec = lv.dmgPerSec || 0.3;
  const healPerSec = lv.healPerSec || 2;
  game.enemies.filter(e => !e.dead && e.pos.dist(p.pos) < radius).forEach(e => {
    const d = p.effectiveDamage * dmgPerSec * dt;
    e.hp -= d;
    if (e.hp <= 0) e.dead = true;
    if (Math.random() < dt * 3) {
      game.dmgNums.push(new DamageNum(e.pos.x, e.pos.y - e.radius, d / dt * 0.3, false, '#ffeeaa'));
    }
  });
  // Heal
  p.hp = Math.min(p.stats.maxHp, p.hp + healPerSec * dt);
}

function dealDamage(game, enemy, dmg, crit) {
  enemy.takeDamage(dmg, crit);
  game.dmgNums.push(new DamageNum(
    enemy.pos.x + rand(-15, 15),
    enemy.pos.y - enemy.radius,
    dmg, crit
  ));
  // Life steal
  const ls = game.player.stats.lifeSteal || 0;
  if (ls > 0) {
    game.player.hp = Math.min(game.player.stats.maxHp, game.player.hp + dmg * ls);
  }
}

function spawnExplosion(game, pos, radius, dmg, color, alpha) {
  game.explosions.push({ pos: pos.clone(), radius, maxRadius: radius, life: 0.4, maxLife: 0.4, color: color || '#ff8822', alpha: alpha || 0.6 });
  // Particle burst
  for (let i = 0; i < 12; i++) {
    const dir = Vec2.rand(rand(50, 150 + radius));
    game.particles.push(new Particle(pos.x, pos.y, dir.x, dir.y, rand(2, 5), color || '#ff8822', rand(0.3, 0.8)));
  }
}

function getClosestEnemies(game, n) {
  return game.enemies
    .filter(e => !e.dead)
    .sort((a, b) => a.pos.distSq(game.player.pos) - b.pos.distSq(game.player.pos))
    .slice(0, n);
}

/* ──── Main Game Class ──── */
class Game {
  constructor(canvas, player, onLevelUp, onDeath, onVictory) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.player  = player;
    this.onLevelUp = onLevelUp;
    this.onDeath   = onDeath;
    this.onVictory = onVictory;

    this.enemies     = [];
    this.projectiles = [];
    this.particles   = [];
    this.dmgNums     = [];
    this.lightningBolts = [];
    this.arrowRainDrops = [];
    this.slashArcs   = [];
    this.orbitBlades = [];
    this.explosions  = [];
    this.loot        = [];  // items dropped this run

    this.wave    = 1;
    this.kills   = 0;
    this.elapsed = 0;
    this.waveTimer  = 0;
    this.waveActive = false;
    this.waveEnemyQueue = [];
    this.spawnTimer = 0;

    this.paused  = false;
    this.running = false;
    this.lastTime = 0;
    this.raf = null;

    this.keys = {};
    this._boundKeyDown = e => { this.keys[e.key.toLowerCase()] = true; };
    this._boundKeyUp   = e => { this.keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup',   this._boundKeyUp);

    this.resize();
    this._boundResize = () => this.resize();
    window.addEventListener('resize', this._boundResize);

    this.startWave(1);
  }

  resize() {
    this.canvas.width  = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this.player.pos = new Vec2(this.W / 2, this.H / 2);
  }

  startWave(num) {
    this.wave = num;
    this.waveEnemyQueue = [];
    const schedule = getWaveSchedule(num);
    schedule.forEach(s => {
      const typeDef = ENEMY_TYPES.find(e => e.id === s.type);
      if (!typeDef) return;
      for (let i = 0; i < s.count; i++) {
        this.waveEnemyQueue.push({ typeDef, scale: s.scale });
      }
    });
    // Shuffle
    for (let i = this.waveEnemyQueue.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [this.waveEnemyQueue[i], this.waveEnemyQueue[j]] = [this.waveEnemyQueue[j], this.waveEnemyQueue[i]];
    }
    this.spawnTimer = 0;
    this.waveActive = true;
  }

  spawnEnemy(typeDef, scale) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = Math.max(this.W, this.H) * 0.6;
    const pos   = this.player.pos.add(Vec2.fromAngle(angle, dist));
    // Clamp to off-screen area
    const e = new Enemy(typeDef, pos, scale);
    e.id = Math.random().toString(36).slice(2);
    this.enemies.push(e);
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup',   this._boundKeyUp);
    window.removeEventListener('resize',  this._boundResize);
  }

  loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this.lastTime) / 1000, 0.1);
    this.lastTime = ts;
    if (!this.paused) {
      this.update(dt);
    }
    this.render();
    this.raf = requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    this.elapsed += dt;

    // Victory at 10 min
    if (this.elapsed >= 600) {
      this.onVictory(this.loot);
      this.stop();
      return;
    }

    this.player.update(dt, this.keys, this.enemies);

    if (this.player.dead) {
      this.onDeath(this.loot);
      this.stop();
      return;
    }

    // Spawn enemies
    if (this.waveActive) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.waveEnemyQueue.length > 0) {
        const e = this.waveEnemyQueue.shift();
        this.spawnEnemy(e.typeDef, e.scale);
        // Stagger: elite/boss spawn slower
        this.spawnTimer = e.typeDef.tier === 'boss' ? 2 : e.typeDef.tier === 'elite' ? 0.8 : 0.25;
      }
      if (this.waveEnemyQueue.length === 0 && this.enemies.filter(e => !e.dead).length === 0) {
        this.waveActive = false;
        this.waveTimer  = 4; // 4s gap between waves
      }
    } else {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.startWave(this.wave + 1);
      }
    }

    // Update enemies
    for (const e of this.enemies) {
      if (!e.dead) e.update(dt, this.player);
    }
    // Remove dead enemies (with loot)
    this.enemies = this.enemies.filter(e => {
      if (e.dead) {
        this.kills++;
        // XP
        const leveled = this.player.gainXp(e.type.xpDrop);
        if (leveled) {
          this.paused = true;
          this.onLevelUp(this.player.level);
        }
        // Loot
        let lootChance = e.type.lootChance;
        if (this.player.skillLevels['gold_rush']) lootChance = e.tier === 'elite' ? 1 : lootChance * 1.5;
        if (chance(lootChance)) {
          const item = generateItem(this.wave);
          if (e.tier === 'boss' && this.player.skillLevels['gold_rush'] >= 3) item.rarity = 'legendary';
          this.loot.push(item);
          spawnExplosion(this, e.pos, 30, 0, '#ffcc44', 0.5);
        }
        // Death particles
        for (let i = 0; i < (e.tier === 'boss' ? 30 : 8); i++) {
          const dir = Vec2.rand(rand(30, 100));
          this.particles.push(new Particle(e.pos.x, e.pos.y, dir.x, dir.y, rand(2, 5), e.color, rand(0.4, 1.0)));
        }
        return false;
      }
      return true;
    });

    // Skills
    applySkills(this, dt);

    // Arrow rain
    this.arrowRainDrops = this.arrowRainDrops.filter(drop => {
      drop.life -= dt;
      if (drop.life <= 0.1 && !drop.fired) {
        drop.fired = true;
        this.enemies.filter(e => !e.dead && e.pos.dist(drop.pos) < 30).forEach(e => {
          const { dmg, crit } = this.player.computeDamage(drop.dmgMul);
          dealDamage(this, e, dmg, crit);
        });
        spawnExplosion(this, drop.pos, 30, 0, '#bb8844', 0.5);
      }
      return drop.life > 0;
    });

    // Projectiles
    this.projectiles = this.projectiles.filter(proj => {
      if (proj.dead) return false;
      proj.update(dt);
      if (proj.dead) return false;
      // Collision
      for (const e of this.enemies) {
        if (e.dead || proj.hitEnemies.has(e.id)) continue;
        if (proj.pos.dist(e.pos) < e.radius + proj.radius) {
          dealDamage(this, e, proj.damage, proj.damage > this.player.effectiveDamage * 1.4);
          proj.hitEnemies.add(e.id);
          if (proj.onHit) proj.onHit(e, this, proj.damage, false);
          if (proj.explodeRadius > 0) {
            spawnExplosion(this, e.pos, proj.explodeRadius, 0);
            this.enemies.filter(x => !x.dead && x !== e && x.pos.dist(e.pos) < proj.explodeRadius).forEach(x => {
              dealDamage(this, x, proj.damage * 0.6, false);
            });
          }
          if (proj.pierce <= 0) { proj.dead = true; break; }
          proj.pierce--;
          if (proj.slowDur) e.slowTimer = proj.slowDur;
          if (proj.freezeDur) e.freezeTimer = proj.freezeDur;
        }
      }
      return !proj.dead;
    });

    // Orbit blades reset
    this.orbitBlades = [];

    // Lightning bolts decay
    this.lightningBolts = this.lightningBolts.filter(b => { b.life -= dt; return b.life > 0; });
    // Slash arcs decay
    this.slashArcs = this.slashArcs.filter(a => { a.life -= dt; return a.life > 0; });
    // Explosions decay
    this.explosions = this.explosions.filter(ex => { ex.life -= dt; return ex.life > 0; });
    // Particles
    this.particles = this.particles.filter(p => p.update(dt));
    // Damage numbers
    this.dmgNums = this.dmgNums.filter(d => d.update(dt));
  }

  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    const p = this.player;

    // Background
    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, W, H);

    // Grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    const gs = 60;
    for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Holy ground visual
    if (p.skillLevels['holy_ground']) {
      const lv = CARD_DEFS.find(c => c.id === 'holy_ground').levels[p.skillLevels['holy_ground'] - 1];
      const r = (lv.radius || 100) * p.effectiveAreaMul;
      const grad = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, r);
      grad.addColorStop(0, 'rgba(255,240,80,0.07)');
      grad.addColorStop(1, 'rgba(255,200,40,0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,80,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Poison cloud visual
    if (p.skillLevels['poison_cloud']) {
      const lv = CARD_DEFS.find(c => c.id === 'poison_cloud').levels[p.skillLevels['poison_cloud'] - 1];
      const r = (lv.radius || 80) * p.effectiveAreaMul;
      const t = this.elapsed;
      for (let i = 0; i < 3; i++) {
        const offset = Vec2.fromAngle(t * 0.7 + i * 2.1, r * 0.3);
        ctx.beginPath();
        const grad = ctx.createRadialGradient(p.pos.x + offset.x, p.pos.y + offset.y, 0, p.pos.x, p.pos.y, r);
        grad.addColorStop(0, 'rgba(100,200,50,0.08)');
        grad.addColorStop(1, 'rgba(60,160,30,0.0)');
        ctx.fillStyle = grad;
        ctx.arc(p.pos.x, p.pos.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Arrow rain markers
    this.arrowRainDrops.forEach(drop => {
      const t = 1 - drop.life / drop.maxLife;
      ctx.strokeStyle = `rgba(180,130,60,${0.6 - t * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(drop.pos.x, drop.pos.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      // Arrow falling
      ctx.fillStyle = `rgba(180,130,60,${t})`;
      ctx.beginPath();
      ctx.moveTo(drop.pos.x, drop.pos.y - 30 * (1 - t));
      ctx.lineTo(drop.pos.x - 4, drop.pos.y - 20 * (1 - t));
      ctx.lineTo(drop.pos.x + 4, drop.pos.y - 20 * (1 - t));
      ctx.closePath();
      ctx.fill();
    });

    // Slash arcs
    this.slashArcs.forEach(arc => {
      const alpha = arc.life / arc.maxLife || arc.life / 0.25;
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 8;
      ctx.shadowBlur = 20;
      ctx.shadowColor = arc.color;
      ctx.beginPath();
      ctx.arc(arc.pos.x, arc.pos.y, arc.range * 0.6, arc.angle - arc.arcWidth / 2, arc.angle + arc.arcWidth / 2);
      ctx.stroke();
      ctx.restore();
    });

    // Lightning bolts
    this.lightningBolts.forEach(bolt => {
      ctx.save();
      ctx.globalAlpha = bolt.life / 0.15;
      ctx.strokeStyle = '#aaccff';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#6688ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bolt.from.x, bolt.from.y);
      // Zigzag
      const dx = bolt.to.x - bolt.from.x, dy = bolt.to.y - bolt.from.y;
      const segs = 5;
      for (let i = 1; i < segs; i++) {
        const t2 = i / segs;
        ctx.lineTo(bolt.from.x + dx * t2 + rand(-15, 15), bolt.from.y + dy * t2 + rand(-15, 15));
      }
      ctx.lineTo(bolt.to.x, bolt.to.y);
      ctx.stroke();
      ctx.restore();
    });

    // Explosions
    this.explosions.forEach(ex => {
      const t = 1 - ex.life / ex.maxLife;
      const r = ex.maxRadius * (0.3 + t * 0.7);
      ctx.save();
      ctx.globalAlpha = ex.alpha * (1 - t);
      ctx.fillStyle = ex.color;
      ctx.shadowBlur = 20;
      ctx.shadowColor = ex.color;
      ctx.beginPath();
      ctx.arc(ex.pos.x, ex.pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Particles
    this.particles.forEach(pt => pt.draw(ctx));

    // Orbit blades
    this.orbitBlades.forEach(blade => {
      ctx.save();
      ctx.fillStyle = '#88ccff';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#4488ff';
      ctx.beginPath();
      ctx.arc(blade.pos.x, blade.pos.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Enemies
    this.enemies.forEach(e => { if (!e.dead) e.draw(ctx); });

    // Projectiles
    this.projectiles.forEach(proj => proj.draw(ctx));

    // Player
    p.draw(ctx);

    // Damage numbers
    this.dmgNums.forEach(d => d.draw(ctx));

    // Wave clear banner
    if (!this.waveActive && this.waveTimer > 0) {
      const alpha = Math.min(1, this.waveTimer) * Math.min(1, (4 - this.waveTimer) * 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#e8b84b';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#e8b84b';
      ctx.fillText(`Wave ${this.wave} 完成! ►  Wave ${this.wave + 1}`, W / 2, H / 2 - 40);
      ctx.restore();
    }
  }
}
