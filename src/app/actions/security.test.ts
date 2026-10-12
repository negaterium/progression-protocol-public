// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn(), context: vi.fn() }));
vi.mock('@/lib/db', () => ({ default: { query: mocks.query, queryOne: mocks.queryOne } }));
vi.mock('@/lib/auth-utils', () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock('@/lib/server/game-db', () => ({ gameDb: { query: mocks.query, queryOne: mocks.queryOne }, withGameTransaction: mocks.transaction }));
vi.mock('@/lib/server/stats-loader', () => ({ getServerPlayerContext: mocks.context }));
vi.mock('@/lib/achievement-manager', () => ({ AchievementManager: class { async checkAchievements() {} } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { fetchLeaderboardAction } from './leaderboard';
import { equipTitleAction, updatePlayerClassAction } from './profile';
import { purchaseItemAction } from './store';

const id = '00000000-0000-4000-8000-000000000001';
const title = '00000000-0000-4000-8000-000000000002';
beforeEach(() => {
    vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.auth.mockResolvedValue({ id, username: 'hunter' });
    mocks.query.mockResolvedValue({ rows: [] }); mocks.queryOne.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async (_id, work) => work());
});
afterEach(() => vi.restoreAllMocks());

describe('Public action authorization', () => {
    it('authenticates leaderboard requests before reading any player rows', async () => {
        mocks.auth.mockRejectedValueOnce(new Error('Authentication required'));
        await expect(fetchLeaderboardAction()).rejects.toThrow('Authentication required');
        expect(mocks.query).not.toHaveBeenCalled();
    });
    it('rejects titles that are not owned without changing equipment or profile', async () => {
        const result = await equipTitleAction(title);
        expect(result.success).toBe(false);
        expect(mocks.queryOne).toHaveBeenCalledWith(expect.stringContaining('ut.user_id = $1'), [id, title]);
        expect(mocks.query.mock.calls.every(([sql]) => !sql.startsWith('UPDATE'))).toBe(true);
    });
    it('allows an earned title with all updates scoped to the authenticated user', async () => {
        mocks.queryOne.mockResolvedValue({ name: 'Earned Title' });
        expect((await equipTitleAction(title)).success).toBe(true);
        expect(mocks.query.mock.calls.every(([, params]) => params.includes(id))).toBe(true);
    });
    it('rejects unknown classes, low-level selection and repeated selection', async () => {
        expect((await updatePlayerClassAction('administrator')).success).toBe(false);
        mocks.queryOne.mockResolvedValue({ level: 1, hunter_class: null });
        expect((await updatePlayerClassAction('Mage')).success).toBe(false);
        mocks.queryOne.mockResolvedValue({ level: 40, hunter_class: 'Fighter' });
        expect((await updatePlayerClassAction('Mage')).success).toBe(false);
        expect(mocks.query.mock.calls.every(([sql]) => !sql.startsWith('UPDATE'))).toBe(true);
    });
    it('requires the class trial victory and allows a qualified standard selection', async () => {
        mocks.queryOne.mockResolvedValueOnce({ level: 40, hunter_class: null }).mockResolvedValueOnce(null);
        expect((await updatePlayerClassAction('Mage')).success).toBe(false);
        mocks.queryOne.mockResolvedValueOnce({ level: 40, hunter_class: null }).mockResolvedValueOnce({ id: 'victory' });
        expect((await updatePlayerClassAction('Mage')).success).toBe(true);
        expect(mocks.query).toHaveBeenCalledWith('UPDATE profiles SET hunter_class = $1 WHERE id = $2', ['Mage', id]);
    });
    it('rejects invalid purchase quantities before authenticating or reading the catalog', async () => {
        for (const quantity of [0, -1, 0.5, NaN, Infinity, 1001]) {
            await expect(purchaseItemAction('item', quantity)).rejects.toThrow();
        }
        expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.queryOne).not.toHaveBeenCalled();
    });
});
