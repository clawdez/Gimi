"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
      <p className="text-gray-400 max-w-md">
        An unexpected error occurred. Your data is safe — try again or head back to the
        marketplace.
        {error.digest ? ` (ref: ${error.digest})` : ""}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => unstable_retry()}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          Try again
        </button>
        <a
          href="/"
          className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 font-medium"
        >
          Back home
        </a>
      </div>
    </div>
  );
}
