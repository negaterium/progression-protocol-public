import { QUEST_RANK_MULT } from '../system/rank-constants';

export const BOUNTY_UNITS = 1_000_000;
export const BOUNTY_RATE = 0.7;
export interface BossBountyLedger {
    day: string;
    opportunityUnits: number;
    bankedMicros: number;
    remainderMicros: number;
}

export function getBossDay(at: Date = new Date()) { return at.toISOString().slice(0, 10); }

export function projectBossBounty(ledger: BossBountyLedger, day: string): BossBountyLedger {
    const days = Math.max(0, Math.floor((Date.parse(day) - Date.parse(ledger.day)) / 86_400_000));
    return { ...ledger, day: day > ledger.day ? day : ledger.day,
        opportunityUnits: Math.min(2 * BOUNTY_UNITS, ledger.opportunityUnits + days * BOUNTY_UNITS) };
}

export function earnBossBounty(ledger: BossBountyLedger, day: string, dailyXp: number, difficulty: string) {
    if (!Number.isFinite(dailyXp) || dailyXp < 0) throw new Error('Invalid boss XP allowance');
    const next = projectBossBounty(ledger, day);
    const weight = QUEST_RANK_MULT[difficulty];
    const units = weight === undefined || dailyXp === 0 ? 0 : Math.min(next.opportunityUnits, Math.round(weight / 0.5 / 4 * BOUNTY_UNITS));
    const earnedMicros = Math.floor(Math.round(dailyXp * BOUNTY_UNITS) * (units / BOUNTY_UNITS));
    const bankPart = Math.floor(earnedMicros / 2);
    const payout = earnedMicros - bankPart + next.remainderMicros;
    next.opportunityUnits -= units;
    next.bankedMicros = Math.min(Math.max(next.bankedMicros, Math.round(dailyXp * 2 * BOUNTY_UNITS)), next.bankedMicros + bankPart);
    next.remainderMicros = payout % BOUNTY_UNITS;
    return { ledger: next, xp: Math.floor(payout / BOUNTY_UNITS), earnedMicros };
}

export function releaseBossBounty(ledger: BossBountyLedger) {
    const payout = ledger.bankedMicros + ledger.remainderMicros;
    return { ledger: { ...ledger, bankedMicros: 0, remainderMicros: payout % BOUNTY_UNITS }, xp: Math.floor(payout / BOUNTY_UNITS) };
}
