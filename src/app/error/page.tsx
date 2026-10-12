import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { message: messageParam } = await searchParams;
  const message = messageParam || "Unknown System Failure";

  return (
    <div className="min-h-screen bg-black text-red-500 flex flex-col items-center justify-center font-mono p-4">
      <div className="border border-red-900 bg-red-950/20 p-8 rounded-lg max-w-md text-center shadow-[0_0_20px_rgba(255,0,0,0.2)]">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-600" />
        <h1 className="text-2xl font-bold mb-2 tracking-widest">SYSTEM ERROR</h1>
        <p className="text-red-300 mb-6 border-t border-b border-red-900/50 py-4">
          {Array.isArray(message) ? message[0] : message}
        </p>
        <Link href="/login">
          <Button variant="outline" className="border-red-800 text-red-400 hover:bg-red-950">
            RETURN TO GATE
          </Button>
        </Link>
      </div>
    </div>
  );
}