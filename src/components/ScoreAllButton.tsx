"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { scoreOneCandidateAction, retierProjectAction } from "@/app/(protected)/projects/actions";

export default function ScoreAllButton({
  projectId,
  candidateIds,
  className,
}: {
  projectId: string;
  candidateIds: string[];
  className?: string;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number; retiering?: boolean } | null>(null);

  const isRunning = progress !== null;

  async function handleClick() {
    if (isRunning || candidateIds.length === 0) return;
    const total = candidateIds.length;
    let done = 0;
    setProgress({ done: 0, total });

    const BATCH = 3;
    for (let i = 0; i < total; i += BATCH) {
      const batch = candidateIds.slice(i, i + BATCH);
      await Promise.all(batch.map((id) => scoreOneCandidateAction(projectId, id)));
      done = Math.min(i + BATCH, total);
      setProgress({ done, total });
      router.refresh();
    }

    setProgress({ done: total, total, retiering: true });
    await retierProjectAction(projectId);
    router.refresh();
    setProgress(null);
  }

  return (
    <button disabled={isRunning} className={className} onClick={handleClick}>
      {isRunning ? (
        <span className="inline-flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {progress.retiering
            ? "Tiering…"
            : `Scoring ${progress.done} / ${progress.total}…`}
        </span>
      ) : (
        "3. Score & tier all"
      )}
    </button>
  );
}
