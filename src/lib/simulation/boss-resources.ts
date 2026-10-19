import type { BossCombatResult } from '../game-logic/boss-combat';
import type { StatusEffect } from '../system/status-effects';
import { calculateScaledManaCost } from '../system/formula';
import { applyHealingReceivedBonus, calculateQuestManaEfficiency, cleansePurifiableStatusEffects } from '../system/skill-effects';
import { StatsManager } from '../stats-manager';
import type { QuestEvent } from './boss-balance';

export interface ResourceConfig {
    maxHp: number;
    maxMana: number;
    combatHpLimit: number;
    statusHpBase: number;
    hunterClass: string;
    level: number;
    modifiers: Record<string, number>;
    manaModifiers: Record<string, number>;
    potions: boolean;
    measuredFrom: number;
}

/** Replay the current action HP floor/clamp and turn effects, without database writes. */
export class BossResourceReplay {
    hp: number;
    mana: number;
    effects: StatusEffect[] = [];
    stunned = false;
    private lastAt = 0;
    private measured = false;
    readonly metrics = { hpPotions: 0, manaPotions: 0, potionGold: 0, blockedMana: 0, blockedStatus: 0,
        attackFloorHits: 0, statusDamage: 0, incomingDamage: 0, manaAbsorbed: 0, healing: 0, clampLoss: 0, unknownManaCosts: 0 };

    constructor(readonly config: ResourceConfig) {
        this.hp = config.maxHp;
        this.mana = config.maxMana;
    }

    beforeEvent(event: QuestEvent) {
        const c = this.config;
        this.measured = event.at >= c.measuredFrom;
        const hours = (event.at - this.lastAt) / 3_600_000;
        const rates = StatsManager.getRegenRates(c.maxHp, c.maxMana, c.hunterClass, c.modifiers);
        this.hp = Math.min(c.maxHp, this.hp + Math.floor(hours * rates.hpPerHour));
        this.mana = Math.min(c.maxMana, this.mana + Math.floor(hours * rates.manaPerHour));
        this.lastAt = event.at;
        // Production delegates skip the quest mana cost, while still entering combat.
        if (event.manaCost == null && this.measured) this.metrics.unknownManaCosts++;
        const cost = event.delegated ? 0 : Math.floor(Math.min(Math.floor(c.maxMana * 0.75),
            calculateScaledManaCost(event.manaCost ?? 0, c.level)) * calculateQuestManaEfficiency(c.manaModifiers));
        const cleaned = cleansePurifiableStatusEffects(this.effects, c.manaModifiers).remainingEffects;
        const statusDamage = cleaned.reduce((sum, effect) => sum + Math.floor(c.statusHpBase * (effect.damagePercent || 0)), 0);
        if (c.potions) {
            // Replacement prices/effects of standard catalog potions, no assumed free stock.
            while (this.hp < Math.max(c.combatHpLimit * 0.25, statusDamage + 1) && this.hp < c.maxHp) {
                this.hp = Math.min(c.maxHp, this.hp + applyHealingReceivedBonus(250 + Math.floor(c.maxHp * 0.15), c.modifiers));
                if (this.measured) { this.metrics.hpPotions++; this.metrics.potionGold += 1000; }
            }
            while (this.mana < cost && this.mana < c.maxMana) {
                this.mana = Math.min(c.maxMana, this.mana + 500 + Math.floor(c.maxMana * 0.15));
                if (this.measured) { this.metrics.manaPotions++; this.metrics.potionGold += 3500; }
            }
        }
        if (this.hp - statusDamage <= 0) {
            if (this.measured) this.metrics.blockedStatus++;
            return false; // The live action rolls back when the DoT would kill.
        }
        if (this.mana < cost) {
            if (this.measured) this.metrics.blockedMana++;
            return false;
        }
        this.hp -= statusDamage;
        this.stunned = cleaned.some(effect => effect.isStun);
        this.effects = cleaned.map(effect => ({ ...effect, duration: (effect.duration || 0) - 1 })).filter(effect => effect.duration > 0);
        this.mana = Math.max(0, this.mana - cost + (event.manaReward || 0));
        if (this.measured) this.metrics.statusDamage += statusDamage;
        return true;
    }

    applyRound(result: BossCombatResult) {
        const incoming = result.evaded ? 0 : result.playerDamage || 0;
        const absorbed = result.evaded ? 0 : result.playerManaDamage || 0;
        const healing = result.playerHealing || 0;
        if (incoming > 0 || absorbed > 0 || healing > 0) {
            const beforeClamp = Math.max(1, this.hp - incoming + healing);
            if (this.measured) {
                if (this.hp - incoming + healing <= 0) this.metrics.attackFloorHits++;
                this.metrics.clampLoss += Math.max(0, beforeClamp - this.config.combatHpLimit);
            }
            this.hp = Math.min(this.config.combatHpLimit, beforeClamp);
            this.mana = Math.max(0, this.mana - absorbed);
        }
        if (result.updatedStatusEffects) this.effects = result.updatedStatusEffects;
        if (this.measured) {
            this.metrics.incomingDamage += incoming;
            this.metrics.manaAbsorbed += absorbed;
            this.metrics.healing += healing;
        }
    }
}
