'use client';

import { useActionState } from 'react';
import { login } from './actions';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Sword, Loader2 } from "lucide-react";
import Link from "next/link";

// Initial state for the form
const initialState = { error: '' };

export function LoginClient() {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: typeof initialState, formData: FormData) => {
      const result = await login(formData);
      return result || { error: '' };
    },
    initialState
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      {/* Background Grid Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <Card className="w-full max-w-md border-cyan-800 bg-black/80 backdrop-blur-md shadow-[0_0_30px_rgba(0,255,255,0.1)] relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-cyan-950/30 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,255,255,0.3)]">
              <Sword className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-widest text-cyan-400 font-mono">
            SYSTEM ACCESS
          </CardTitle>
          <CardDescription className="text-slate-400 font-mono text-xs uppercase tracking-widest">
            Identity Verification Required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            {/* Error Display */}
            {state.error && (
              <div className="bg-red-950/50 border border-red-800 rounded-md p-3">
                <p className="text-red-400 text-sm font-mono text-center">
                  ⚠ {state.error}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-cyan-600 font-mono text-xs">
                HUNTER NAME
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                placeholder="Enter your hunter name"
                disabled={isPending}
                className="bg-black/50 border-cyan-900 text-cyan-100 placeholder:text-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 font-mono disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-cyan-600 font-mono text-xs">
                ACCESS CODE
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                disabled={isPending}
                className="bg-black/50 border-cyan-900 text-cyan-100 focus:border-cyan-500 focus:ring-cyan-500/20 font-mono disabled:opacity-50"
              />
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-black font-bold font-mono tracking-wider shadow-[0_0_15px_rgba(0,255,255,0.4)] disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    VERIFYING...
                  </>
                ) : (
                  'ENTER THE SYSTEM'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center pb-6">
          <div className="flex items-center gap-2 text-[10px] text-slate-600 font-mono">
            <ShieldAlert className="w-3 h-3" />
            SECURE CONNECTION ESTABLISHED
          </div>
        </CardFooter>
      </Card>
      <div className="relative z-10 mt-5 max-w-md text-center text-xs leading-relaxed text-slate-600">
        <p>Progression Protocol is an unofficial, non-commercial fan project maintained by Negaterium.</p>
        <Link href="/about" className="mt-2 inline-block text-cyan-700 transition-colors hover:text-cyan-300">
          ABOUT & DISCLAIMER
        </Link>
      </div>
    </div>
  );
}
