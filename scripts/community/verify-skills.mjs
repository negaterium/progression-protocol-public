import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync('database/seeds/catalogs.json', 'utf8'));
const skills = catalog.skills || [];

assert.equal(skills.length, 38, 'The shared skill catalog must contain 38 modules.');
assert.equal(new Set(skills.map((skill) => skill.id)).size, skills.length, 'Skill IDs must be unique.');

const active = skills.filter((skill) => skill.is_active);
const passive = skills.filter((skill) => !skill.is_active && skill.category !== 'ULTIMATE');
const ultimate = skills.filter((skill) => skill.category === 'ULTIMATE');
const positioned = skills.filter((skill) => skill.x_pos !== null && skill.y_pos !== null);
const reserve = skills.filter((skill) => skill.x_pos === null || skill.y_pos === null);
const statImprintOnlyNames = [
    'Deep Work', 'Algorithm', 'Coding', 'System Design', 'Time Blocking',
    'Flow State', 'Sense', 'Endurance', 'Bear Form',
];

assert.equal(active.length, 7, 'The current engine exposes seven active modules.');
assert.equal(ultimate.length, 1, 'The catalog must contain one ultimate module.');
assert.equal(active.filter((skill) => !skill.effect_type || !skill.active_effect || !skill.cooldown_seconds).length, 0,
    'Every active module needs an effect type, effect summary and cooldown.');
assert.equal(skills.filter((skill) => !skill.is_active && skill.active_effect !== null).length, 0,
    'Inactive modules must not carry stale active-effect text.');
assert.equal(skills.filter((skill) => skill.stat_bonus && skill.category !== 'ULTIMATE' && !skill.description.includes('imprint')).length, 0,
    'Stat-backed modules must disclose their implemented passive imprint.');
assert.equal(ultimate.filter((skill) => !skill.description.includes('Ultimate passive imprint')).length, 0,
    'Ultimate modules must disclose their implemented passive imprint.');
assert.equal(skills.filter((skill) => /coming soon|refreshes every|movement speed increases drastically/i.test(skill.description)).length, 0,
    'Stale or placeholder skill descriptions must not ship.');
assert.equal(statImprintOnlyNames.filter((name) => {
    const skill = skills.find((candidate) => candidate.name === name);
    return !skill || !/Passive imprint/i.test(skill.description);
}).length, 0,
    'Stat-imprint-only modules must disclose that no separate runtime trigger is registered.');
const criticalStrike = skills.find((skill) => skill.name === 'Critical Strike');
assert(criticalStrike && /\+2% Critical Rate per Rank/i.test(criticalStrike.description),
    'Critical Strike must disclose its registered rank-scaled combat effect.');
const ironBody = skills.find((skill) => skill.name === 'Iron Body');
assert(ironBody && /\+3% Boss Damage Reduction per Rank/i.test(ironBody.description),
    'Iron Body must disclose its registered rank-scaled survival effect.');
const manaShield = skills.find((skill) => skill.name === 'Mana Shield');
assert(manaShield && /diverts 5% of incoming Boss Damage to MP per Rank/i.test(manaShield.description),
    'Mana Shield must disclose its registered bounded MP-diversion effect.');
const ironWill = skills.find((skill) => skill.name === 'Iron Will');
assert(ironWill && /Boss Status Resistance/i.test(ironWill.description),
    'Iron Will must disclose its registered status-resistance effect.');
const ironFist = skills.find((skill) => skill.name === 'Iron Fist');
assert(ironFist && /Unarmed Damage/i.test(ironFist.description),
    'Iron Fist must disclose its registered unarmed-damage effect.');
const shadowStep = skills.find((skill) => skill.name === 'Shadow Step');
assert(shadowStep && /Boss Evasion/i.test(shadowStep.description),
    'Shadow Step must disclose its registered evasion effect.');
const fireball = skills.find((skill) => skill.name === 'Fireball');
assert(fireball && /Magic Damage/i.test(fireball.description),
    'Fireball must disclose its registered magic-damage effect.');
const curseOfAgony = skills.find((skill) => skill.name === 'Curse of Agony');
assert(curseOfAgony && /curse pressure/i.test(curseOfAgony.description),
    'Curse of Agony must disclose its registered bounded pressure effect.');
const meditation = skills.find((skill) => skill.name === 'Meditation');
assert(meditation && /HP and MP Regeneration/i.test(meditation.description),
    'Meditation must disclose its registered regeneration effect.');
const focus = skills.find((skill) => skill.name === 'Focus');
assert(focus && /Quest Mana Cost/i.test(focus.description),
    'Focus must disclose its registered quest-mana effect.');
const lifeDrain = skills.find((skill) => skill.name === 'Life Drain');
assert(lifeDrain && /direct damage dealt as HP/i.test(lifeDrain.description),
    'Life Drain must disclose its registered bounded healing effect.');
const taunt = skills.find((skill) => skill.name === 'Taunt');
assert(taunt && /Defense against Boss attacks/i.test(taunt.description),
    'Taunt must disclose its registered defensive effect.');
const quicksilver = skills.find((skill) => skill.name === 'Quicksilver');
assert(quicksilver && /Attack Speed and second-strike chance/i.test(quicksilver.description),
    'Quicksilver must disclose its registered attack-speed effect.');
const bloodlust = skills.find((skill) => skill.name === 'Bloodlust');
assert(bloodlust && /Physical Damage/i.test(bloodlust.description),
    'Bloodlust must disclose its registered physical-damage effect.');
const ironSkin = skills.find((skill) => skill.name === 'Iron Skin');
assert(ironSkin && /Armor against Boss attacks/i.test(ironSkin.description),
    'Iron Skin must disclose its registered armor effect.');
const longevity = skills.find((skill) => skill.name === 'Longevity');
assert(longevity && /Max HP/i.test(longevity.description),
    'Longevity must disclose its registered Max HP effect.');
const holyLight = skills.find((skill) => skill.name === 'Holy Light');
assert(holyLight && /Healing Received/i.test(holyLight.description),
    'Holy Light must disclose its registered healing effect.');
const daggerMastery = skills.find((skill) => skill.name === 'Dagger Mastery');
assert(daggerMastery && /Dagger Damage/i.test(daggerMastery.description),
    'Dagger Mastery must disclose its registered weapon effect.');
const purification = skills.find((skill) => skill.name === 'Purification');
assert(purification && /ordinary negative statuses/i.test(purification.description) && /Reality Fracture/i.test(purification.description),
    'Purification must disclose its bounded cleanse and cosmic boundary.');
const entanglingRoots = skills.find((skill) => skill.name === 'Entangling Roots');
assert(entanglingRoots && /root a non-cosmic Boss for one round/i.test(entanglingRoots.description),
    'Entangling Roots must disclose its bounded boss-control effect.');
const domainOfTheMonarch = skills.find((skill) => skill.name === 'Domain of the Monarch');
assert(domainOfTheMonarch && /Shadow Army Damage/i.test(domainOfTheMonarch.description) && /assigned and passive attacks/i.test(domainOfTheMonarch.description),
    'Domain of the Monarch must disclose its bounded shadow-army effect.');

const names = (rows) => rows.map((skill) => skill.name).join(', ');
console.log(`Skill catalog verified: ${skills.length} total (${active.length} active, ${passive.length} passive, ${ultimate.length} ultimate).`);
console.log(`Displayed in matrix: ${positioned.length}; reserve archive: ${reserve.length}.`);
console.log(`Active modules: ${names(active)}.`);
console.log(`Reserve modules: ${names(reserve)}.`);
