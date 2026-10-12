import Link from "next/link";
import { AboutContent } from "@/components/about/AboutContent";

export const metadata = {
    title: "About | Progression Protocol",
    description: "Project information, authorship, licensing, and fan-project boundaries for Progression Protocol.",
};

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-black px-4 text-cyan-100">
            <div className="mx-auto max-w-7xl">
                <div className="flex items-center justify-between border-b border-cyan-900/30 py-5">
                    <div>
                        <p className="font-mono text-sm font-bold tracking-[0.2em] text-cyan-400">PROGRESSION PROTOCOL</p>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-600">Project information</p>
                    </div>
                    <Link
                        href="/login"
                        className="rounded-full border border-cyan-700/60 px-4 py-2 font-mono text-xs font-bold tracking-wider text-cyan-300 transition-colors hover:border-cyan-400 hover:bg-cyan-950/30"
                    >
                        SYSTEM ACCESS
                    </Link>
                </div>
                <AboutContent />
            </div>
        </main>
    );
}
