"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InsightsRunner() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/insights/run", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; reason?: string; error?: string; themes?: number; analyzed?: number };
      if (!json.ok) {
        setMsg(json.reason ?? json.error ?? "failed");
        return;
      }
      setMsg(`analyzed ${json.analyzed} posts → ${json.themes} themes`);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={loading}
        className="rounded-md border border-sky-700/60 bg-sky-900/30 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
      >
        {loading ? "analyzing…" : "regenerate insights"}
      </button>
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
    </div>
  );
}
