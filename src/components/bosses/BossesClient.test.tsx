import { act, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/actions/bosses', () => ({ startBossBattleAction: vi.fn() }));
vi.mock('@/app/actions/store', () => ({ purchaseItemAction: vi.fn() }));
import { BossesClient } from './BossesClient';
const props = {
    initialBosses: [{ id: 1, name: 'Test boss', rank: 'E', phase: 1, required_level: 1, max_hp: 100, intel: {}, status: 'DEFEATED' }] as any[],
    initialHistory: [{ boss_id: 1, created_at: '2026-10-18T20:00:00Z' }], initialUserLevel: 158, initialUserGold: 0,
    initialInventory: [{ id: 1, quantity: 1, item: { name: 'Instant Dungeon Key (E-Rank)' } }], initialKeys: [], storeDiscount: 0,
    bounty: { dailyXp: 100, pendingXp: 25, availableDays: 0.5, timezone: 'UTC' as const }, initialServerNow: '2026-10-18T23:59:59Z',
};
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(props.initialServerNow)); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe('Boss gate clock and reward presentation', () => {
    it('keeps initial HTML stable across browser/server clock drift', () => {
        const element = createElement(BossesClient, props);
        const html = renderToString(element);
        vi.advanceTimersByTime(30000);
        expect(renderToString(element)).toBe(html);
    });
    it('enables re-entry when the countdown expires and refreshes the UTC allowance', async () => {
        const element = createElement(BossesClient, props);
        const container = document.createElement('div'); container.innerHTML = renderToString(element); document.body.appendChild(container);
        let root: Root | undefined;
        try {
            await act(async () => { root = hydrateRoot(container, element); });
            const fightButton = () => [...container.querySelectorAll('button')].find(b => /COOLDOWN|RE-ENTER/.test(b.textContent || ''))!;
            expect(fightButton().disabled).toBe(true);
            act(() => { vi.advanceTimersByTime(1000); });
            expect(fightButton().disabled).toBe(false);
            expect(fightButton().textContent).toContain('RE-ENTER');
            expect(router.refresh).toHaveBeenCalledOnce();
            expect(container.textContent).toContain('25 base XP banked');
        } finally { act(() => root?.unmount()); container.remove(); }
    });
});
