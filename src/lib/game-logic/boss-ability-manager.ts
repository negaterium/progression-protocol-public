export type { StatusEffect, StatusEffectType } from "@/lib/system/status-effects";
import { StatusEffect, StatusEffectType } from "@/lib/system/status-effects";

// Suppress unused import warning — StatusEffectType is re-exported for consumers
void (undefined as unknown as StatusEffectType);

export interface BossAbilityResult {
    abilityName: string;
    damageMult: number; // Multiplier for this specific attack (e.g., 1.5x)
    statusEffect?: StatusEffect;
    description?: string;
    isUltimate?: boolean;
}

export class BossAbilityManager {
    /**
     * Parses a boss ability name/description to determine its mechanical effects.
     */
    static parseAbility(abilityName: string, rank: string): BossAbilityResult {
        const lowerName = abilityName.toLowerCase();

        let damageMult = 1.0;
        let statusEffect: StatusEffect | undefined;
        let isUltimate = false;
        let description = `The boss uses ${abilityName}!`;

        // ============================================
        // COSMIC ABILITIES (COSMIC Rank Only — Post-999)
        // ============================================
        if (rank === 'COSMIC') {
            if (lowerName.includes('reality') || lowerName.includes('collapse') || lowerName.includes('fracture') || lowerName.includes('unravel')) {
                statusEffect = {
                    name: 'Reality Fracture',
                    type: 'REALITY_FRACTURE',
                    duration: 2,
                    description: 'The fabric of reality is torn. One random stat is nullified for 2 turns.'
                };
                damageMult = 2.0;
                isUltimate = true;
                description = `${abilityName} tears reality apart!`;
            } else if (lowerName.includes('entropy') || lowerName.includes('negative energy') || lowerName.includes('necrotic') || lowerName.includes('void pulse')) {
                statusEffect = {
                    name: 'Entropy',
                    type: 'ENTROPY',
                    duration: 3,
                    damagePercent: 0.10,
                    description: 'The void consumes you. Lose 10% of Max HP per action. Ignores all defenses.'
                };
                damageMult = 1.5;
                isUltimate = true;
                description = `${abilityName} fills you with entropic energy!`;
            } else if (lowerName.includes('dread') || lowerName.includes('madness') || lowerName.includes('chaos') || lowerName.includes('thousand') || lowerName.includes('whisper') || lowerName.includes('gibbering')) {
                statusEffect = {
                    name: 'Cosmic Dread',
                    type: 'COSMIC_DREAD',
                    duration: 3,
                    description: 'An incomprehensible terror grips your soul. All multipliers halved for 3 turns.'
                };
                damageMult = 1.8;
                isUltimate = true;
                description = `${abilityName} shatters your mind!`;
            } else if (lowerName.includes('prismatic') || lowerName.includes('chromatic') || lowerName.includes('breath')) {
                // Tiamat's multi-element breath
                damageMult = 3.5;
                isUltimate = true;
                description = `${abilityName} unleashes a torrent of elemental destruction!`;
            } else if (lowerName.includes('steal') || lowerName.includes('hand of') || lowerName.includes('lich')) {
                // Vecna's Hand ability
                statusEffect = {
                    name: 'Reality Fracture',
                    type: 'REALITY_FRACTURE',
                    duration: 5,
                    description: 'An item effect has been stolen by Vecna. One stat nullified.'
                };
                damageMult = 2.5;
                isUltimate = true;
                description = `${abilityName} steals the power from your equipment!`;
            } else {
                // Generic cosmic attack — always hits hard
                damageMult = 2.0;
                isUltimate = true;
                description = `${abilityName} strikes with cosmic force!`;
            }

            return { abilityName, damageMult, statusEffect, isUltimate, description };
        }

        // ============================================
        // STANDARD ABILITIES (All other ranks)
        // ============================================

        // 1. STATUS EFFECTS MAPPING
        if (lowerName.includes('venom') || lowerName.includes('poison') || lowerName.includes('toxic') || lowerName.includes('plague') || lowerName.includes('parasitic')) {
            statusEffect = {
                name: 'Poison',
                type: 'POISON',
                duration: 5,
                damagePercent: 0.05,
                description: 'Taking 5% HP damage per action.'
            };
            description = `${abilityName} inflicts Poison!`;
        } else if (lowerName.includes('burn') || lowerName.includes('fire') || lowerName.includes('flame') || lowerName.includes('lava') || lowerName.includes('heat') || lowerName.includes('flare') || lowerName.includes('destruction ray')) {
            statusEffect = {
                name: 'Burn',
                type: 'BURN',
                duration: 3,
                damagePercent: 0.08,
                description: 'Taking 8% HP damage per action (Ignores DEF).'
            };
            damageMult = lowerName.includes('ray') ? 2.5 : 1.5;
            isUltimate = lowerName.includes('ray');
            description = `${abilityName} sears your flesh!`;
        } else if (lowerName.includes('freeze') || lowerName.includes('ice') || lowerName.includes('frost') || lowerName.includes('cold') || lowerName.includes('chill') || lowerName.includes('absolute zero')) {
            statusEffect = {
                name: 'Freeze',
                type: 'FREEZE',
                duration: lowerName.includes('zero') ? 2 : 1,
                isStun: true,
                description: 'Frozen solid. Cannot act.'
            };
            description = `${abilityName} freezes you in place!`;
        } else if (lowerName.includes('stun') || lowerName.includes('shock') || lowerName.includes('paraly') || lowerName.includes('slam') || lowerName.includes('constrict') || lowerName.includes('bind') || lowerName.includes('decree') || lowerName.includes('stomp')) {
            statusEffect = {
                name: 'Stun',
                type: 'STUN',
                duration: lowerName.includes('decree') ? 2 : 1,
                isStun: true,
                description: 'Stunned. Cannot act.'
            };
            description = `${abilityName} binds you!`;
        } else if (lowerName.includes('bleed') || lowerName.includes('lacerat') || lowerName.includes('scratch') || lowerName.includes('bite') || lowerName.includes('cut') || lowerName.includes('fang') || lowerName.includes('claw') || lowerName.includes('tornado') || lowerName.includes('summon undead')) {
            statusEffect = {
                name: 'Bleed',
                type: 'BLEED',
                duration: 3,
                damagePercent: 0.04,
                description: 'Taking extra damage from open wounds.'
            };
            description = `${abilityName} causes bleeding!`;
        } else if (lowerName.includes('curse') || lowerName.includes('rot') || lowerName.includes('decay') || lowerName.includes('ancient grudge')) {
            statusEffect = {
                name: 'Curse',
                type: 'FEAR',
                duration: 4,
                modifiers: { stat_multiplier: 0.75 },
                description: 'Cursed flesh. Stats reduced by 25%.'
            };
            description = `${abilityName} curses your soul!`;
        }

        // 2. ADVANCED MECHANICS (High Rank Keywords)
        if (rank.includes('A') || rank.includes('S') || rank.includes('XX')) {
            if (lowerName.includes('fear') || lowerName.includes('terror') || lowerName.includes('presence') || lowerName.includes('dominat') || lowerName.includes('ruler') || lowerName.includes('command')) {
                statusEffect = {
                    name: 'Fear',
                    type: 'FEAR',
                    duration: 3,
                    modifiers: { stat_multiplier: 0.8 },
                    description: 'Stats reduced by 20% due to overwhelming fear.'
                };
                description = `${abilityName} strikes terror into your heart!`;
            }
            if (lowerName.includes('breath') || lowerName.includes('beam') || lowerName.includes('blast') || lowerName.includes('nova') || lowerName.includes('spacial tear') || lowerName.includes('laser') || lowerName.includes('erasure')) {
                damageMult = rank === 'XX' ? 4.0 : 2.5;
                isUltimate = true;
                description = `${abilityName} unleashes a devastating wave of energy!`;
            }
            if (lowerName.includes('shield') || lowerName.includes('protect') || lowerName.includes('barrier') || lowerName.includes('guard') || lowerName.includes('extraction') || lowerName.includes('fortress')) {
                statusEffect = {
                    name: 'Boss Shield',
                    type: 'SHIELD',
                    duration: 3,
                    modifiers: { stat_multiplier: 2.0 },
                    description: 'Boss is shielded from damage.'
                };
                description = `${abilityName} raises a defensive barrier!`;
            }
        }

        // 3. DAMAGE MODIFIERS & SPECIFIC ABILITIES
        if (lowerName.includes('system control') || lowerName.includes('admin') || lowerName.includes('override') || lowerName.includes('domain')) {
            damageMult = rank === 'XX' ? 3.0 : 2.5;
            isUltimate = true;
            statusEffect = {
                name: 'System Interference',
                type: 'SYSTEM_INTERFERENCE',
                duration: 3,
                description: 'The System is being overridden. Healing is suppressed.'
            };
            description = `${abilityName} rewrites the laws of combat!`;
        } else if (lowerName.includes('telekin') || lowerName.includes('psychic') || lowerName.includes('force') || lowerName.includes('gravity') || lowerName.includes('decree')) {
            statusEffect = {
                name: 'Stun',
                type: 'STUN',
                duration: 1,
                isStun: true,
                description: 'Held in place by overwhelming force.'
            };
            description = `${abilityName} crushes you with invisible force!`;
        } else if (lowerName.includes('warp') || lowerName.includes('mirror') || lowerName.includes('rift') || lowerName.includes('dimensional')) {
            statusEffect = {
                name: 'Confusion',
                type: 'FEAR',
                duration: 2,
                modifiers: { stat_multiplier: 0.6 },
                description: 'Reality is shifting. Attack efficiency reduced.'
            };
            description = `${abilityName} distorts your perception of reality!`;
        } else if (lowerName.includes('smash') || lowerName.includes('crush') || lowerName.includes('strike') || lowerName.includes('heavy') || lowerName.includes('impact') || lowerName.includes('swipe') || lowerName.includes('club')) {
            damageMult = 1.5;
        } else if (lowerName.includes('frenzy') || lowerName.includes('rage') || lowerName.includes('berserk') || lowerName.includes('wild') || lowerName.includes('charge')) {
            damageMult = 1.8;
            description = `${abilityName} sends the boss into a violent rage!`;
        } else if (lowerName.includes('void') || lowerName.includes('erasure') || lowerName.includes('collapse') || lowerName.includes('meteor') || lowerName.includes('death coil')) {
            damageMult = 3.0;
            isUltimate = true;
            description = `${abilityName} threatens to annihilate everything!`;
        } else if (lowerName.includes('drain') || lowerName.includes('siphon') || lowerName.includes('leech') || lowerName.includes('absorb') || lowerName.includes('gluttony')) {
            damageMult = 1.8;
            statusEffect = {
                name: 'Weakened',
                type: 'FEAR',
                duration: 3,
                modifiers: { stat_multiplier: 0.8 },
                description: 'Vitality drained. Stats reduced.'
            };
            description = `${abilityName} drains your life force!`;
        } else if (lowerName.includes('stealth') || lowerName.includes('shadow step') || lowerName.includes('flight') || lowerName.includes('wing') || lowerName.includes('speed')) {
            statusEffect = {
                name: 'Evasion',
                type: 'SHIELD',
                duration: 2,
                modifiers: { stat_multiplier: 1.5 },
                description: 'Boss is moving too fast to hit.'
            };
            description = `${abilityName} makes the boss hard to target!`;
        } else if (lowerName.includes('howl') || lowerName.includes('roar') || lowerName.includes('scream')) {
            statusEffect = {
                name: 'Fear',
                type: 'FEAR',
                duration: 2,
                modifiers: { stat_multiplier: 0.8 },
                description: 'Stunned by the deafening sound.'
            };
            description = `${abilityName} shakes your very core!`;
        } else if (lowerName.includes('earthquake') || lowerName.includes('tremor') || lowerName.includes('purge') || lowerName.includes('holy') || lowerName.includes('light')) {
            damageMult = 2.0;
            isUltimate = true;
            description = `${abilityName} engulfs the area!`;
        } else if (lowerName.includes('creation') || lowerName.includes('construct')) {
            statusEffect = {
                name: 'Boss Shield',
                type: 'SHIELD',
                duration: 2,
                modifiers: { stat_multiplier: 1.5 },
                description: 'Boss creates defenses.'
            };
            description = `${abilityName} builds a barrier!`;
        }

        return { abilityName, damageMult, statusEffect, isUltimate, description };
    }

    /**
     * Determines if a boss should use an ability based on Rank and RNG.
     */
    static shouldTriggerAbility(rank: string): boolean {
        const cleanRank = rank.split(' ')[0].replace('+', '').trim();
        let chance = 0.20; // Default E-C Rank

        if (cleanRank === 'B' || cleanRank === 'A') chance = 0.25;
        if (cleanRank === 'S' || cleanRank === 'XX') chance = 0.30;
        if (cleanRank === 'COSMIC') chance = 0.40; // Cosmic bosses use abilities more frequently

        return Math.random() < chance;
    }

    /**
     * Selects a random ability from the boss's arsenal.
     */
    static selectAbility(abilities: string[]): string {
        if (!abilities || abilities.length === 0) return "Basic Attack";
        const idx = Math.floor(Math.random() * abilities.length);
        return abilities[idx];
    }
}
