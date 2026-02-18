"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ActionButton({
  action,
  label,
  pendingLabel,
  className,
}: {
  action: () => Promise<void>;
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={isPending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          await action();
          router.refresh();
        });
      }}
    >
      {isPending ? (
        <span className="inline-flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
