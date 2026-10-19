// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CombatXpBudget } from './combat-xp-budget';
import { DAY_MS } from './boss-balance';
describe('Experimental earned combat XP budget', () => {
    it('caps income despite additional quests and victories', () => {
        const budget = new CombatXpBudget(100, 0);
        for (let i = 0; i < 20; i++) budget.combat(i, 'E', true);
        expect(budget.grantedXp).toBe(100);
    });
    it('allows a slower fight to earn participation XP before victory', () => {
        const budget = new CombatXpBudget(100, 0);
        for (let i = 0; i < 4; i++) budget.combat(i, 'E', false);
        expect(budget.grantedXp).toBe(50);
        expect(budget.pendingXp).toBe(50);
        budget.combat(DAY_MS, 'S', true);
        expect(budget.grantedXp).toBe(200);
    });
    it('never earns XP on inactive days and bounds the unclaimed bank', () => {
        const budget = new CombatXpBudget(100, 0);
        for (let day = 0; day < 10; day++) for (let i = 0; i < 4; i++) budget.combat(day * DAY_MS + i, 'E', false);
        expect(budget.grantedXp).toBe(500);
        expect(budget.pendingXp).toBe(200);
        expect(budget.forfeitedXp).toBe(300);
    });
    it('lets clustered activity use one missed day without granting XP for inactivity alone', () => {
        const budget = new CombatXpBudget(100, 0);
        budget.combat(0, 'S', true);
        expect(budget.grantedXp).toBe(100);
        for (let i = 0; i < 8; i++) budget.combat(2 * DAY_MS + i, 'E', true);
        expect(budget.grantedXp).toBe(300);
        budget.combat(2 * DAY_MS + 9, 'S', true);
        expect(budget.grantedXp).toBe(300);
    });
});
