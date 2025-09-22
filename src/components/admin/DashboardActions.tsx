"use client";
// SPDX-License-Identifier: Apache-2.0
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { performModerationAction } from "@/app/(admin)/admin/moderation/actions";

export function ApproveButton({ commentId }: { commentId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      await performModerationAction({ action: "approve", ids: [commentId] });
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
    >
      Approve
    </button>
  );
}

export function SpamButton({ commentId }: { commentId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      await performModerationAction({ action: "spam", ids: [commentId] });
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
    >
      Spam
    </button>
  );
}
