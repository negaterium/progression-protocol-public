import { ItemEffect } from "@/lib/types/zod-schemas";

export interface CombatContext {
    bossDamageType?: string; // FIRE, COLD, POISON, PHYSICAL
    playerEquipment?: Array<{ effect?: ItemEffect | null }>;
}

export class CombatMechanics {
    static calculateElementalMitigation(
        rawDamage: number,
        damageType: string = 'PHYSICAL',
        equipment: Array<{ effect?: ItemEffect | null }>
    ): { finalDamage: number, mitigationPercent: number, isResisted: boolean } {
        if (damageType === 'PHYSICAL' || !equipment) {
            return { finalDamage: rawDamage, mitigationPercent: 0, isResisted: false };
        }

        let totalResistance = 0;
        const typeKey = `${damageType.toLowerCase()}_resist`;

        equipment.forEach(item => {
            if (item.effect) {
                // @ts-expect-error - dynamic access to effect keys
                const val = item.effect[typeKey];

                if (typeof val === 'number') {
                    // Cap per item at 25%
                    totalResistance += Math.min(25, val);
                } else if (val === true) {
                    // Legacy fallback for boolean (should have been migrated, but safe fallback)
                    totalResistance += 25;
                }
            }
        });

        // Hard Cap Total Resistance at 75%
        const effectiveResistance = Math.min(75, totalResistance);
        const multiplier = 1 - (effectiveResistance / 100);

        const finalDamage = Math.floor(rawDamage * multiplier);

        return {
            finalDamage,
            mitigationPercent: effectiveResistance,
            isResisted: effectiveResistance > 0
        };
    }
}
