/* ═══════════════════════════════════════════════
   DATA.JS — All game definitions
   Enemies · Cards · Affixes · Item bases
═══════════════════════════════════════════════ */

/* ──── Enemy Definitions ──── */
const ENEMY_TYPES = [
  // Normal
  { id: 'skeleton', name: '骷髅兵', tier: 'normal', color: '#c8c0a0', radius: 14,
    hp: 40, dmg: 8, speed: 70, xpDrop: 8, lootChance: 0.06 },
  { id: 'zombie',   name: '腐化僵尸', tier: 'normal', color: '#7aab6a', radius: 16,
    hp: 70, dmg: 12, speed: 50, xpDrop: 10, lootChance: 0.07 },
  { id: 'goblin',   name: '哥布林', tier: 'normal', color: '#7ac47a', radius: 11,
    hp: 25, dmg: 6, speed: 110, xpDrop: 7, lootChance: 0.05 },
  { id: 'bat',      name: '吸血蝙蝠', tier: 'normal', color: '#8866aa', radius: 10,
    hp: 20, dmg: 5, speed: 130, xpDrop: 6, lootChance: 0.04 },
  { id: 'wraith',   name: '怨灵', tier: 'normal', color: '#6688cc', radius: 13,
    hp: 35, dmg: 15, speed: 80, xpDrop: 12, lootChance: 0.08 },
  // Elites (appear after wave 3)
  { id: 'orc',      name: '兽人精英', tier: 'elite', color: '#cc6644', radius: 22,
    hp: 300, dmg: 25, speed: 55, xpDrop: 40, lootChance: 0.4 },
  { id: 'necromancer', name: '死灵法师', tier: 'elite', color: '#aa44cc', radius: 18,
    hp: 200, dmg: 30, speed: 60, xpDrop: 50, lootChance: 0.5 },
  { id: 'vampire',  name: '吸血鬼伯爵', tier: 'elite', color: '#cc2244', radius: 20,
    hp: 250, dmg: 20, speed: 80, xpDrop: 45, lootChance: 0.45 },
  // Bosses (every 5 waves)
  { id: 'demon_lord', name: '魔王', tier: 'boss', color: '#ff3322', radius: 36,
    hp: 2000, dmg: 40, speed: 60, xpDrop: 200, lootChance: 1.0 },
  { id: 'lich',     name: '巫妖王', tier: 'boss', color: '#8844ff', radius: 32,
    hp: 1800, dmg: 50, speed: 50, xpDrop: 200, lootChance: 1.0 },
];

/* Wave schedule: each entry = { time (sec), type, count, scale } */
function getWaveSchedule(waveNum) {
  const diff = 1 + (waveNum - 1) * 0.25;
  const isBossWave = waveNum % 5 === 0;
  const schedule = [];
  const normals = ['skeleton','zombie','goblin','bat','wraith'];
  const elites  = ['orc','necromancer','vampire'];

  if (isBossWave) {
    schedule.push({ type: waveNum % 10 === 0 ? 'lich' : 'demon_lord', count: 1, scale: 1 + waveNum * 0.1 });
    schedule.push({ type: normals[waveNum % normals.length], count: 6, scale: diff });
  } else {
    const primary = normals[waveNum % normals.length];
    const secondary = normals[(waveNum + 2) % normals.length];
    schedule.push({ type: primary,   count: 4 + waveNum * 2, scale: diff });
    schedule.push({ type: secondary, count: 2 + waveNum,     scale: diff });
    if (waveNum >= 3) {
      schedule.push({ type: elites[waveNum % elites.length], count: 1 + Math.floor(waveNum / 5), scale: diff });
    }
  }
  return schedule;
}

/* ──── Card Definitions ──── */
/* Each card: id, name, icon, type ('skill'|'passive'|'upgrade'),
   rarity ('common'|'uncommon'|'rare'|'legendary'),
   maxLevel, levels[i] = { desc, apply(player) } */

const CARD_DEFS = [
  /* ── SKILLS ── */
  {
    id: 'fireball', name: '火球术', icon: '🔥', type: 'skill',
    rarity: 'common', maxLevel: 5,
    levels: [
      { desc: '每2秒发射1枚火球，造成120%伤害',     cooldown: 2.0,  count: 1, dmgMul: 1.2, radius: 10 },
      { desc: '每1.7秒，伤害+20%',                  cooldown: 1.7,  count: 1, dmgMul: 1.4, radius: 11 },
      { desc: '每1.4秒，同时发射2枚火球',            cooldown: 1.4,  count: 2, dmgMul: 1.4, radius: 12 },
      { desc: '每1.2秒，伤害+30%，穿透1个敌人',      cooldown: 1.2,  count: 2, dmgMul: 1.7, radius: 13, pierce: 1 },
      { desc: '每1秒，命中爆炸AOE，伤害×2.5',        cooldown: 1.0,  count: 2, dmgMul: 2.5, radius: 14, pierce: 1, explode: true },
    ]
  },
  {
    id: 'lightning', name: '闪电链', icon: '⚡', type: 'skill',
    rarity: 'common', maxLevel: 5,
    levels: [
      { desc: '每2.5秒，闪电击中最近敌人，链2个',    cooldown: 2.5, chains: 2, dmgMul: 1.3 },
      { desc: '链接3个敌人',                          cooldown: 2.2, chains: 3, dmgMul: 1.3 },
      { desc: '每2秒，链接4个，伤害+25%',             cooldown: 2.0, chains: 4, dmgMul: 1.55 },
      { desc: '每1.7秒，链5个，伤害+30%',             cooldown: 1.7, chains: 5, dmgMul: 2.0 },
      { desc: '每1.4秒，链7个，可反弹，伤害×3',       cooldown: 1.4, chains: 7, dmgMul: 3.0 },
    ]
  },
  {
    id: 'orbit', name: '剑气护盾', icon: '🌀', type: 'skill',
    rarity: 'uncommon', maxLevel: 5,
    levels: [
      { desc: '2把剑气绕身旋转，持续伤害',   count: 2, dmgMul: 0.5, speed: 2 },
      { desc: '3把剑气，伤害+25%',           count: 3, dmgMul: 0.63, speed: 2.2 },
      { desc: '4把剑气，旋转加速',            count: 4, dmgMul: 0.75, speed: 2.6 },
      { desc: '5把，伤害+50%，范围扩大',      count: 5, dmgMul: 1.1, speed: 3.0 },
      { desc: '6把，每把可穿透，范围大幅提升',  count: 6, dmgMul: 1.5, speed: 3.5, pierce: true },
    ]
  },
  {
    id: 'blizzard', name: '冰爆', icon: '❄', type: 'skill',
    rarity: 'uncommon', maxLevel: 5,
    levels: [
      { desc: '每3秒在随机敌人处爆炸，减速',   cooldown: 3.0, dmgMul: 1.8, radius: 60, slowDur: 1.5 },
      { desc: '每2.5秒，范围+20%',            cooldown: 2.5, dmgMul: 2.0, radius: 70, slowDur: 1.8 },
      { desc: '每2秒，伤害+30%，冻结0.5秒',   cooldown: 2.0, dmgMul: 2.5, radius: 80, slowDur: 2.0, freezeDur: 0.5 },
      { desc: '每1.8秒，同时爆炸2处',          cooldown: 1.8, dmgMul: 2.5, radius: 85, count: 2, freezeDur: 0.7 },
      { desc: '每1.5秒，爆炸3处，冰冻敌人',    cooldown: 1.5, dmgMul: 3.0, radius: 100, count: 3, freezeDur: 1.0 },
    ]
  },
  {
    id: 'poison_cloud', name: '毒云', icon: '☠', type: 'skill',
    rarity: 'common', maxLevel: 5,
    levels: [
      { desc: '在角色周围持续散播毒素',          radius: 80,  dmgPerSec: 0.2, tickRate: 0.5 },
      { desc: '范围扩大，毒伤+30%',              radius: 100, dmgPerSec: 0.26, tickRate: 0.5 },
      { desc: '范围再扩大，毒伤+50%',            radius: 120, dmgPerSec: 0.39, tickRate: 0.5 },
      { desc: '范围扩至160，毒伤×2',             radius: 160, dmgPerSec: 0.78, tickRate: 0.4 },
      { desc: '范围200，毒伤×3，降低敌人移速25%', radius: 200, dmgPerSec: 1.2,  tickRate: 0.3, slow: 0.25 },
    ]
  },
  {
    id: 'arrow_rain', name: '箭雨', icon: '🏹', type: 'skill',
    rarity: 'uncommon', maxLevel: 5,
    levels: [
      { desc: '每3秒召唤箭雨，密度低',          cooldown: 3.0, arrows: 5,  dmgMul: 1.0, radius: 80 },
      { desc: '每2.5秒，箭矢+3',               cooldown: 2.5, arrows: 8,  dmgMul: 1.0, radius: 90 },
      { desc: '每2秒，箭矢12支，伤害+25%',      cooldown: 2.0, arrows: 12, dmgMul: 1.25, radius: 100 },
      { desc: '每1.8秒，范围扩大，伤害+50%',    cooldown: 1.8, arrows: 16, dmgMul: 1.5,  radius: 120 },
      { desc: '每1.5秒，20支箭，伤害×2.5',      cooldown: 1.5, arrows: 20, dmgMul: 2.5,  radius: 140 },
    ]
  },
  {
    id: 'holy_ground', name: '圣域', icon: '✨', type: 'skill',
    rarity: 'rare', maxLevel: 5,
    levels: [
      { desc: '角色周围出现圣光区域，持续灼烧敌人',   radius: 100, dmgPerSec: 0.3, healPerSec: 2 },
      { desc: '范围+20%，回血+1',                    radius: 120, dmgPerSec: 0.4, healPerSec: 3 },
      { desc: '范围+30%，灼烧+50%',                  radius: 150, dmgPerSec: 0.6, healPerSec: 4 },
      { desc: '范围175，灼烧×2，回血+2',              radius: 175, dmgPerSec: 1.0, healPerSec: 6 },
      { desc: '范围220，灼烧×3，每次回血触发连锁',    radius: 220, dmgPerSec: 1.5, healPerSec: 10 },
    ]
  },
  {
    id: 'void_slash', name: '虚空斩', icon: '🌑', type: 'skill',
    rarity: 'rare', maxLevel: 5,
    levels: [
      { desc: '每2秒向最多敌人方向挥出虚空斩击',      cooldown: 2.0, width: 60,  range: 180, dmgMul: 2.0 },
      { desc: '每1.8秒，范围+20%，伤害+25%',          cooldown: 1.8, width: 70,  range: 200, dmgMul: 2.5 },
      { desc: '每1.6秒，斩击2次',                     cooldown: 1.6, width: 80,  range: 220, dmgMul: 2.5, hits: 2 },
      { desc: '每1.4秒，宽度加大，伤害+50%',           cooldown: 1.4, width: 100, range: 250, dmgMul: 3.5, hits: 2 },
      { desc: '每1.2秒，360°全方位斩击，伤害×4',       cooldown: 1.2, width: 360, range: 280, dmgMul: 6.0, hits: 1 },
    ]
  },

  /* ── PASSIVES ── */
  {
    id: 'power_surge', name: '力量涌现', icon: '💪', type: 'passive',
    rarity: 'common', maxLevel: 5,
    levels: [
      { desc: '基础伤害 +15%', stat: 'damageMul', val: 0.15 },
      { desc: '基础伤害 +15%（共+30%）', stat: 'damageMul', val: 0.15 },
      { desc: '基础伤害 +20%（共+50%）', stat: 'damageMul', val: 0.20 },
      { desc: '基础伤害 +20%（共+70%）', stat: 'damageMul', val: 0.20 },
      { desc: '基础伤害 +30%（共+100%）', stat: 'damageMul', val: 0.30 },
    ]
  },
  {
    id: 'vitality', name: '生命力', icon: '❤', type: 'passive',
    rarity: 'common', maxLevel: 5,
    levels: [
      { desc: '最大生命值 +50', stat: 'maxHp', val: 50 },
      { desc: '最大生命值 +60', stat: 'maxHp', val: 60 },
      { desc: '最大生命值 +80', stat: 'maxHp', val: 80 },
      { desc: '最大生命值 +100', stat: 'maxHp', val: 100 },
      { desc: '最大生命值 +150', stat: 'maxHp', val: 150 },
    ]
  },
  {
    id: 'swift_feet', name: '疾风步', icon: '💨', type: 'passive',
    rarity: 'common', maxLevel: 5,
    levels: [
      { desc: '移动速度 +20%', stat: 'speedMul', val: 0.20 },
      { desc: '移动速度 +20%（共+40%）', stat: 'speedMul', val: 0.20 },
      { desc: '移动速度 +20%（共+60%）', stat: 'speedMul', val: 0.20 },
      { desc: '移动速度 +15%（共+75%）', stat: 'speedMul', val: 0.15 },
      { desc: '移动速度 +25%（共+100%）', stat: 'speedMul', val: 0.25 },
    ]
  },
  {
    id: 'regen', name: '生命回复', icon: '💗', type: 'passive',
    rarity: 'uncommon', maxLevel: 5,
    levels: [
      { desc: '每秒回复 3 点生命', stat: 'regenPerSec', val: 3 },
      { desc: '每秒回复 3 点（共 6）', stat: 'regenPerSec', val: 3 },
      { desc: '每秒回复 5 点（共 11）', stat: 'regenPerSec', val: 5 },
      { desc: '每秒回复 7 点（共 18）', stat: 'regenPerSec', val: 7 },
      { desc: '每秒回复 12 点（共 30）', stat: 'regenPerSec', val: 12 },
    ]
  },
  {
    id: 'attack_speed', name: '攻速提升', icon: '⚔', type: 'passive',
    rarity: 'uncommon', maxLevel: 5,
    levels: [
      { desc: '技能冷却 -10%', stat: 'cdMul', val: -0.10 },
      { desc: '技能冷却 -10%（共-20%）', stat: 'cdMul', val: -0.10 },
      { desc: '技能冷却 -10%（共-30%）', stat: 'cdMul', val: -0.10 },
      { desc: '技能冷却 -10%（共-40%）', stat: 'cdMul', val: -0.10 },
      { desc: '技能冷却 -15%（共-55%）', stat: 'cdMul', val: -0.15 },
    ]
  },
  {
    id: 'life_steal', name: '吸血', icon: '🩸', type: 'passive',
    rarity: 'rare', maxLevel: 5,
    levels: [
      { desc: '造成伤害的 3% 转化为生命', stat: 'lifeSteal', val: 0.03 },
      { desc: '吸血 5%', stat: 'lifeSteal', val: 0.02 },
      { desc: '吸血 7%', stat: 'lifeSteal', val: 0.02 },
      { desc: '吸血 10%', stat: 'lifeSteal', val: 0.03 },
      { desc: '吸血 15%（暴击时双倍）', stat: 'lifeSteal', val: 0.05 },
    ]
  },
  {
    id: 'crit_chance', name: '暴击', icon: '💥', type: 'passive',
    rarity: 'rare', maxLevel: 5,
    levels: [
      { desc: '暴击率 +10%，暴击伤害 ×1.5', stat: 'critChance', val: 0.10 },
      { desc: '暴击率 +10%（共20%）', stat: 'critChance', val: 0.10 },
      { desc: '暴击率 +10%（共30%），爆伤提升', stat: 'critChance', val: 0.10, critMul: 0.25 },
      { desc: '暴击率 +15%（共45%）', stat: 'critChance', val: 0.15 },
      { desc: '暴击率 +15%（共60%），爆伤×3', stat: 'critChance', val: 0.15, critMul: 0.50 },
    ]
  },
  {
    id: 'area_size', name: '范围扩大', icon: '🌐', type: 'passive',
    rarity: 'uncommon', maxLevel: 5,
    levels: [
      { desc: '所有技能范围 +15%', stat: 'areaMul', val: 0.15 },
      { desc: '范围 +15%（共+30%）', stat: 'areaMul', val: 0.15 },
      { desc: '范围 +15%（共+45%）', stat: 'areaMul', val: 0.15 },
      { desc: '范围 +20%（共+65%）', stat: 'areaMul', val: 0.20 },
      { desc: '范围 +25%（共+90%）', stat: 'areaMul', val: 0.25 },
    ]
  },
  {
    id: 'gold_rush', name: '财富之道', icon: '🪙', type: 'passive',
    rarity: 'legendary', maxLevel: 3,
    levels: [
      { desc: '获得经验+25%，击杀精英必掉落装备', stat: 'xpMul', val: 0.25 },
      { desc: '获得经验+25%（共+50%），精英必掉两件', stat: 'xpMul', val: 0.25 },
      { desc: '获得经验+30%（共+80%），Boss掉落传说', stat: 'xpMul', val: 0.30 },
    ]
  },
];

/* ──── Item Affix Definitions ──── */
const AFFIXES = [
  // Offensive
  { id: 'flat_dmg',    name: '基础伤害',   stat: 'damage',    type: 'flat', min: 8,   max: 40,  weight: 10, slots: ['weapon','offhand'] },
  { id: 'pct_dmg',     name: '%伤害',      stat: 'damageMul', type: 'pct',  min: 0.05, max: 0.30, weight: 8, slots: null },
  { id: 'crit_c',      name: '暴击率',     stat: 'critChance',type: 'flat', min: 0.03, max: 0.12, weight: 7, slots: null },
  { id: 'crit_d',      name: '暴击伤害',   stat: 'critMul',   type: 'flat', min: 0.10, max: 0.50, weight: 6, slots: null },
  { id: 'atk_spd',     name: '攻击速度',   stat: 'cdMul',     type: 'flat', min: -0.08, max: -0.03, weight: 7, slots: null },
  { id: 'area',        name: '技能范围',   stat: 'areaMul',   type: 'flat', min: 0.05, max: 0.20, weight: 6, slots: null },
  // Defensive
  { id: 'flat_hp',     name: '生命值',     stat: 'maxHp',     type: 'flat', min: 20,  max: 120, weight: 10, slots: ['chest','head','legs','belt'] },
  { id: 'regen_hp',    name: '生命回复',   stat: 'regenPerSec',type:'flat', min: 1,   max: 8,   weight: 8,  slots: ['chest','amulet','ring1','ring2'] },
  { id: 'defense',     name: '护甲',       stat: 'defense',   type: 'flat', min: 5,   max: 40,  weight: 9,  slots: ['chest','head','legs','boots','gloves'] },
  // Utility
  { id: 'move_spd',    name: '移动速度',   stat: 'speedMul',  type: 'pct',  min: 0.05, max: 0.20, weight: 6, slots: ['boots','legs'] },
  { id: 'xp_gain',     name: '经验加成',   stat: 'xpMul',     type: 'pct',  min: 0.05, max: 0.20, weight: 5, slots: null },
  { id: 'life_steal',  name: '吸血',       stat: 'lifeSteal', type: 'flat', min: 0.01, max: 0.06, weight: 4, slots: ['weapon','ring1','ring2','amulet'] },
  // Legendary-only
  { id: 'leg_explode', name: '【火球爆炸半径+50%】', stat: 'fireballRadius', type: 'legendary', min: 0.5, max: 0.5, weight: 0 },
  { id: 'leg_chain',   name: '【闪电额外链接3目标】', stat: 'lightningChains', type: 'legendary', min: 3, max: 3, weight: 0 },
  { id: 'leg_orbit',   name: '【剑气旋转速度+100%】', stat: 'orbitSpeed',    type: 'legendary', min: 1.0, max: 1.0, weight: 0 },
  { id: 'leg_aoe',     name: '【所有AOE范围+40%】',   stat: 'areaMul',       type: 'legendary', min: 0.40, max: 0.40, weight: 0 },
  { id: 'leg_cd',      name: '【所有冷却 -20%】',      stat: 'cdMul',         type: 'legendary', min: -0.20, max: -0.20, weight: 0 },
  { id: 'leg_dmg',     name: '【全局伤害 +50%】',      stat: 'damageMul',     type: 'legendary', min: 0.50, max: 0.50, weight: 0 },
];

/* ──── Item Base Types ──── */
const ITEM_BASES = {
  weapon:  ['短剑','长剑','双手斧','法杖','弓','骨刀','恶魔剑','血刃'],
  offhand: ['盾牌','魔法书','圣物','箭袋','匕首','咒文'],
  head:    ['皮帽','铁盔','战盔','法冠','黑铁头盔','暗黑面具'],
  chest:   ['皮甲','锁甲','板甲','法袍','骸骨甲','暗影长袍'],
  legs:    ['皮裤','铁腿甲','战腿甲','法袍下裳','暗影裤甲'],
  boots:   ['皮靴','铁靴','战靴','法师靴','疾风靴','暗影靴'],
  gloves:  ['皮手套','铁手套','战斗手套','法师指套','暗影手套'],
  belt:    ['皮腰带','铁腰带','链带','宝石腰带','圣徒腰带'],
  ring1:   ['铁戒指','金戒指','蓝宝石戒指','红宝石戒指','传说戒指'],
  ring2:   ['铁戒指','金戒指','蓝宝石戒指','红宝石戒指','传说戒指'],
  amulet:  ['铜项链','银项链','金项链','龙形吊坠','魔法护身符'],
};

/* Affix count by rarity */
const RARITY_AFFIX_COUNT = {
  normal: 0, magic: [1,2], rare: [3,4], legendary: [5,6]
};

/* XP needed per level */
function xpForLevel(lv) { return Math.floor(50 * Math.pow(1.18, lv - 1)); }

/* Base player stats */
const BASE_PLAYER_STATS = {
  maxHp:       100,
  damage:      20,
  defense:     0,
  speedBase:   130,   // px/s
  damageMul:   0,     // additive multiplier
  speedMul:    0,
  critChance:  0.05,
  critMul:     1.5,
  lifeSteal:   0,
  regenPerSec: 0,
  cdMul:       0,
  areaMul:     0,
  xpMul:       0,
};
