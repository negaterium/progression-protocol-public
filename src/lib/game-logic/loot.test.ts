import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest'
import { generateQuestLoot } from './loot'
import db from '@/lib/db'

// Mock Data
const MOCK_USER_ID = 'test-user-id';

const MOCK_ITEMS = [
    { id: 1, name: 'Normal Sword', rarity: 'E', type: 'WEAPON' },
    { id: 2, name: 'Kasaka\'s Venom Fang', rarity: 'E', type: 'WEAPON' }, // Boss Item (Should be filtered)
    { id: 3, name: 'Generic Potion', rarity: 'E', type: 'CONSUMABLE' }
];

// Mock DB
vi.mock('@/lib/db', () => ({
    default: {
        query: vi.fn(),
        queryOne: vi.fn()
    }
}));

describe('Loot System', () => {
    let randomSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        randomSpy = vi.spyOn(Math, 'random');

        // Default mock responses for common queries
        (db.queryOne as any).mockImplementation((sql: string) => {
            if (sql.includes('FROM hunter_stats')) return Promise.resolve({ perception: 10, luck: 0 });
            if (sql.includes('FROM profiles')) return Promise.resolve({ level: 1, hunter_rank: 'E' });
            if (sql.includes('FROM inventory')) return Promise.resolve(null);
            return Promise.resolve(null);
        });

        (db.query as any).mockImplementation((sql: string) => {
            if (sql.includes('FROM inventory inv')) return Promise.resolve({ rows: [] });
            if (sql.includes('FROM items')) return Promise.resolve({ rows: MOCK_ITEMS });
            if (sql.includes('INSERT INTO inventory')) return Promise.resolve({ rows: [{ id: 123 }] });
            return Promise.resolve({ rows: [] });
        });
    });

    afterEach(() => {
        randomSpy.mockRestore();
    });

    test('Fails to drop if roll is too high (E-Rank > 0.3)', async () => {
        randomSpy.mockReturnValue(0.99); // High Roll (Fail)
        const result = await generateQuestLoot('E', MOCK_USER_ID);
        expect(result.dropped).toBe(false);
    });

    test('Drops item if roll is low (E-Rank <= 0.3)', async () => {
        // First roll for dropsToGenerate (remainingChance)
        // Second roll for Rank Upgrade (0.05)
        // Third roll for weighted selection
        randomSpy
            .mockReturnValueOnce(0.1) // Drop 1 Success
            .mockReturnValueOnce(0.5) // No rank upgrade
            .mockReturnValueOnce(0.0); // Weighted selection -> Index 0

        const result = await generateQuestLoot('E', MOCK_USER_ID);

        expect(result.dropped).toBe(true);
        expect(result.items).toBeDefined();
        // Filtered Pool should have: Normal Sword, Generic Potion
        // Normal Sword has weight 1.0, Generic Potion has weight 4.0
        // Total weight 5.0. 0.0 * 5.0 = 0 -> Normal Sword
        expect(result.items![0].name).toBe('Normal Sword');
    });

    test('Filters out Boss Items (Kasaka\'s Fang)', async () => {
        randomSpy
            .mockReturnValueOnce(0.1) // Drop 1 Success
            .mockReturnValueOnce(0.5) // No rank upgrade
            .mockReturnValueOnce(0.1); // Weighted selection (0.1 * 5.0 = 0.5 -> Normal Sword)

        const result = await generateQuestLoot('E', MOCK_USER_ID);
        expect(result.items![0].name).not.toBe('Kasaka\'s Venom Fang');
    });

    test('Adds to Inventory (New Item)', async () => {
        randomSpy.mockReturnValue(0.1);
        await generateQuestLoot('E', MOCK_USER_ID);

        // Expect INSERT query (last call to query is usually the insert)
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO inventory'), expect.any(Array));
    });

    test('Updates Inventory (Existing Item)', async () => {
        (db.queryOne as any).mockImplementation((sql: string) => {
            if (sql.includes('FROM hunter_stats')) return Promise.resolve({ perception: 10, luck: 0 });
            if (sql.includes('FROM profiles')) return Promise.resolve({ level: 1, hunter_rank: 'E' });
            if (sql.includes('FROM inventory')) return Promise.resolve({ id: 999, quantity: 5 });
            return Promise.resolve(null);
        });

        randomSpy
            .mockReturnValueOnce(0.1)
            .mockReturnValueOnce(0.5)
            .mockReturnValueOnce(0.3);
        await generateQuestLoot('E', MOCK_USER_ID);

        // Expect UPDATE query
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE inventory'), expect.arrayContaining([6, 999]));
    });
});
