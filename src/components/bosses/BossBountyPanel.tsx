import type { BossBountySummary } from '@/lib/server/boss-bounty';

export function BossBountyPanel({ bounty, compact = false }: { bounty: BossBountySummary; compact?: boolean }) {
    if (bounty.dailyXp <= 0) return null;
    if (compact) return (
        <div aria-label="Boss XP allowance" className="rounded border border-cyan-900/50 bg-cyan-950/20 px-3 py-2 text-xs text-slate-300">
            <p>{bounty.dailyXp.toLocaleString()} base boss XP / day · {bounty.availableDays.toFixed(2)} daily allowances available</p>
            <p className="mt-1 text-slate-400">Earn half during rematches and bank half for victory. <a href="/dashboard/bosses" className="text-cyan-400 underline">Allowance details</a></p>
        </div>
    );
    return (
        <section aria-label="Boss XP allowance" className="rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 font-mono">
                <h2 className="font-bold text-cyan-300">BOSS XP ALLOWANCE</h2>
                <span className="text-slate-300">{bounty.dailyXp.toLocaleString()} base XP / day</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-slate-200">
                <span>Available: <strong>{bounty.availableDays.toFixed(2)} daily allowances</strong></span>
                <span>On your next rematch victory: <strong>{bounty.pendingXp.toLocaleString()} base XP banked</strong></span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Complete quests during Phase 3–4 rematches to earn boss XP. Four basic quest equivalents earn one daily allowance;
                harder quests earn it faster. Half is awarded as you fight and half on victory. Unused earning opportunity carries
                for up to two days; the victory bank holds up to two daily allowances. XP bonuses apply when awarded.
                First victories keep their full rewards. Allowances refresh at 00:00 UTC.
            </p>
        </section>
    );
}
