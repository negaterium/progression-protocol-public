import {
    ArrowUpRight,
    BookOpen,
    FileText,
    Github,
    Info,
    Scale,
    ShieldCheck,
    UserRound,
} from "lucide-react";

const PUBLIC_REPOSITORY_URL = "https://github.com/negaterium/progression-protocol-public";
const SECURITY_POLICY_URL = `${PUBLIC_REPOSITORY_URL}/blob/master/SECURITY.md`;
const LICENSE_URL = `${PUBLIC_REPOSITORY_URL}/blob/master/LICENSE`;

function ExternalResource({
    href,
    icon: Icon,
    label,
    description,
}: {
    href: string;
    icon: typeof Github;
    label: string;
    description: string;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start gap-3 rounded-lg border border-cyan-900/40 bg-black/30 p-4 transition-colors hover:border-cyan-500/60 hover:bg-cyan-950/20"
        >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <span className="min-w-0">
                <span className="flex items-center gap-1 text-sm font-bold tracking-wider text-cyan-300">
                    {label}
                    <ArrowUpRight className="h-3.5 w-3.5 text-cyan-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
            </span>
        </a>
    );
}

export function AboutContent() {
    return (
        <div className="mx-auto max-w-6xl space-y-6 py-8">
            <header className="relative overflow-hidden rounded-xl border border-cyan-800/60 bg-cyan-950/10 p-6 shadow-[0_0_30px_rgba(0,242,255,0.06)] md:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-30" />
                <div className="relative">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-cyan-500">
                        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-700/60 bg-black/50 px-3 py-1.5">
                            <Info className="h-3.5 w-3.5" />
                            PROJECT DOSSIER
                        </span>
                        <span className="rounded-full border border-amber-700/50 bg-amber-950/20 px-3 py-1.5 text-amber-400">
                            UNOFFICIAL FAN PROJECT
                        </span>
                    </div>
                    <h1 className="mt-5 font-mono text-3xl font-black tracking-[0.12em] text-white md:text-5xl">
                        ABOUT <span className="text-cyan-400">PROGRESSION PROTOCOL</span>
                    </h1>
                    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">
                        A self-hosted, open-source productivity RPG that turns real-world goals, habits, and daily work into quests, experience, and visible progression.
                    </p>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-cyan-900/50 bg-black/40 p-6">
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-cyan-400" />
                        <h2 className="font-mono text-lg font-bold tracking-wider text-cyan-300">THE PROJECT</h2>
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-400">
                        <p>
                            Progression Protocol is designed for people who want a focused, game-like way to organize personal goals. Quests, habits, skills, bosses, inventory, and the status HUD all share one persistent progression system.
                        </p>
                        <p>
                            It is built to run on your own infrastructure with PostgreSQL, so your progression data stays with the deployment you control.
                        </p>
                    </div>
                </section>

                <section className="rounded-xl border border-amber-800/50 bg-amber-950/10 p-6" role="note">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-amber-400" />
                        <h2 className="font-mono text-lg font-bold tracking-wider text-amber-300">FAN PROJECT NOTICE</h2>
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
                        <p>
                            This is an unofficial, non-commercial, fan-made project inspired by the <em>Solo Leveling</em> universe and other RPG and fantasy sources.
                        </p>
                        <p>
                            It is not affiliated with, endorsed by, sponsored by, or approved by any rights holder. Names, characters, lore, logos, and trademarks from other properties remain with their respective owners.
                        </p>
                    </div>
                </section>

                <section className="rounded-xl border border-cyan-900/50 bg-black/40 p-6">
                    <div className="flex items-center gap-3">
                        <UserRound className="h-5 w-5 text-cyan-400" />
                        <h2 className="font-mono text-lg font-bold tracking-wider text-cyan-300">AUTHOR & LICENSE</h2>
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-400">
                        <p>
                            Progression Protocol is created and maintained by <strong className="text-cyan-200">Negaterium</strong>.
                        </p>
                        <p>
                            The original code and project documentation are released under the MIT License. Generated visual assets are dedicated under CC0 only to the extent that the maintainer controls the applicable rights; third-party materials and dependency licenses remain separate.
                        </p>
                    </div>
                </section>

                <section className="rounded-xl border border-cyan-900/50 bg-black/40 p-6">
                    <div className="flex items-center gap-3">
                        <Scale className="h-5 w-5 text-cyan-400" />
                        <h2 className="font-mono text-lg font-bold tracking-wider text-cyan-300">COMMUNITY BOUNDARIES</h2>
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-400">
                        <p>
                            Keep credentials, personal data, and private deployment details out of issues and pull requests. Use the security reporting route for vulnerabilities.
                        </p>
                        <p>
                            Before redistributing a build, preserve the project notice and review the asset, catalog, and third-party licensing records included with the source.
                        </p>
                    </div>
                </section>
            </div>

            <section className="rounded-xl border border-cyan-900/50 bg-black/40 p-6">
                <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-cyan-400" />
                    <h2 className="font-mono text-lg font-bold tracking-wider text-cyan-300">PROJECT RESOURCES</h2>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <ExternalResource
                        href={PUBLIC_REPOSITORY_URL}
                        icon={Github}
                        label="Source repository"
                        description="Read the code, deployment guide, and contribution notes."
                    />
                    <ExternalResource
                        href={SECURITY_POLICY_URL}
                        icon={ShieldCheck}
                        label="Security policy"
                        description="Learn how to report a vulnerability privately."
                    />
                    <ExternalResource
                        href={LICENSE_URL}
                        icon={Scale}
                        label="MIT license"
                        description="Review the license scope for original project code."
                    />
                </div>
            </section>

            <p className="border-t border-cyan-900/30 pt-4 text-center text-xs leading-relaxed text-slate-600">
                Progression Protocol is maintained by Negaterium as an unofficial, non-commercial fan project. Redistribution does not grant permission to use third-party franchise material.
            </p>
        </div>
    );
}
