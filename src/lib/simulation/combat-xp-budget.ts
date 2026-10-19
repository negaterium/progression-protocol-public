import { DAY_MS } from './boss-balance';
import { QUEST_RANK_MULT } from '../system/rank-constants';

/** Experimental earned XP fund. No time-based credit without completed combat actions. */
export class CombatXpBudget {
    private day = -1;
    private opportunity = 1;
    private bank = 0;
    grantedXp = 0;
    earnedXp = 0;
    forfeitedXp = 0;

    constructor(readonly dailyXp: number, readonly measuredFrom: number) {
        if (!Number.isFinite(dailyXp) || dailyXp <= 0) throw new Error('Invalid daily XP budget');
    }

    combat(at: number, difficulty: string, defeated: boolean) {
        const day = Math.floor(at / DAY_MS);
        if (this.day !== day) {
            if (this.day >= 0) this.opportunity = Math.min(2, this.opportunity + day - this.day);
            this.day = day;
        }
        // Four basic quest equivalents earn the daily boss XP budget.
        const fraction = Math.min(this.opportunity, (QUEST_RANK_MULT[difficulty] ?? 0.5) / 0.5 / 4);
        const earned = fraction * this.dailyXp;
        this.opportunity -= fraction;
        const direct = earned * 0.5;
        const before = this.bank;
        this.bank = Math.min(this.dailyXp * 2, this.bank + earned * 0.5);
        const forfeited = Math.max(0, before + earned * 0.5 - this.bank);
        let grant = direct;
        if (defeated) { grant += this.bank; this.bank = 0; }
        if (at >= this.measuredFrom) {
            this.grantedXp += grant;
            this.earnedXp += earned;
            this.forfeitedXp += forfeited;
        }
    }

    get pendingXp() { return this.bank; }
}
