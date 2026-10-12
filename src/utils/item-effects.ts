
import { getDungeonDisplayName } from './dungeon-names';

export function formatItemEffects(inputEffect: any, scaleFactor: number = 1): string[] {
    if (!inputEffect) return [];

    let effect = inputEffect;
    if (typeof effect === 'string') {
        try {
            effect = JSON.parse(effect);
        } catch (e) {
            console.error("[Formatter] Failed to parse item effect JSON:", e);
            return [];
        }
    }

    const parts: string[] = [];
    const isScaled = scaleFactor > 1.01; // small epsilon to avoid floating point false positives
    // Show actual multiplier applied (already capped by rank ceiling)
    const scaleTag = isScaled ? ` [×${scaleFactor.toFixed(1)}]` : '';

    // Primary Stats (Top Priority)
    if (effect.damage_min || effect.damage_max) {
        parts.push(`⚔️ Damage: ${effect.damage_min || 0} - ${effect.damage_max || '?'}${scaleTag}`);
    }
    if (effect.defense) {
        parts.push(`🛡️ Defense: ${effect.defense}${scaleTag}`);
    }

    // Secondary Attributes
    if (effect.strength) parts.push(`+${effect.strength} Strength${scaleTag}`);
    if (effect.agility) parts.push(`+${effect.agility} Agility${scaleTag}`);
    if (effect.intelligence) parts.push(`+${effect.intelligence} Intelligence${scaleTag}`);
    if (effect.vitality) parts.push(`+${effect.vitality} Vitality${scaleTag}`);
    if (effect.perception) parts.push(`+${effect.perception} Perception${scaleTag}`);
    if (effect.charisma) parts.push(`+${effect.charisma} Charisma${scaleTag}`);
    if (effect.focus) parts.push(`+${effect.focus} Focus${scaleTag}`);
    if (effect.willpower) parts.push(`+${effect.willpower} Willpower${scaleTag}`);
    if (effect.luck) parts.push(`+${effect.luck} Luck${scaleTag}`);

    // Special Effects
    if (effect.element) parts.push(`Element: ${effect.element.toUpperCase()}`);
    if (effect.stealth) parts.push(`🕶️ Stealth Active`);
    if (effect.true_sight) parts.push(`👁️ True Sight`);
    if (effect.xp_multiplier) parts.push(`✨ XP Gain x${effect.xp_multiplier}`);
    if (effect.xp_boost_int) parts.push(`📘 Intellect XP +${effect.xp_boost_int * 100}%`);
    if (effect.gold_bonus) parts.push(`💰 Gold Drop +${effect.gold_bonus * 100}%`);
    if (effect.armor_penetration) parts.push(`🏹 Armor Pen: ${effect.armor_penetration}`);
    if (effect.crit_chance) parts.push(`🎯 Crit Chance +${effect.crit_chance * 100}%`);
    if (effect.attack_speed) parts.push(`⚔️ Atk Speed x${effect.attack_speed}`);
    if (effect.range) parts.push(`📏 Range: ${effect.range}m`);
    if (effect.magic_amp) parts.push(`🔮 Magic Amp x${effect.magic_amp}`);
    if (effect.necromancy) parts.push(`💀 Necromancy Enhanced`);
    if (effect.status_effect) parts.push(`⚠️ Applies: ${effect.status_effect}`);
    if (effect.mana_regen) parts.push(`💧 Mana Regen +${effect.mana_regen}`);
    if (effect.cold_resist) parts.push(`❄️ Cold Immunity`);
    if (effect.hover) parts.push(`🕊️ Levitation`);
    if (effect.void_strike) parts.push(`🌌 Void Strike`);

    // Recovery
    if (effect.heal_hp) parts.push(`Restores ${effect.heal_hp} HP`);
    if (effect.heal_hp_percent) parts.push(`Restores ${effect.heal_hp_percent}% HP`);
    if (effect.heal_mana) parts.push(`Restores ${effect.heal_mana} MP`);
    if (effect.heal_mana_percent) parts.push(`Restores ${effect.heal_mana_percent}% MP`);
    if (effect.cure_status) parts.push(`Cures Status Effects`);
    if (effect.cure_disease) parts.push(`Cures All Diseases`);
    if (effect.respec) parts.push(`🔄 Reset Class & Stats`);

    // Dungeon
    if (effect.unlocks_dungeon) parts.push(`Unlocks Dungeon: ${getDungeonDisplayName(effect.unlocks_dungeon)}`);

    return parts;
}
