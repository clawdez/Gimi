"use client";

import {
  CrossmintAuthProvider,
  CrossmintProvider,
  CrossmintWalletProvider,
} from "@crossmint/client-sdk-react-ui";

export function CrossmintProviderWrapper({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_CROSSMINT_API_KEY;

  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <CrossmintProvider apiKey={apiKey}>
      <CrossmintAuthProvider
        authModalTitle="Connect to Tably"
        loginMethods={["email", "google"]}
        prefetchOAuthUrls
      >
        <CrossmintWalletProvider
          createOnLogin={{
            chain: "solana",
            recovery: { type: "email" },
          }}
        >
          {children}
        </CrossmintWalletProvider>
      </CrossmintAuthProvider>
    </CrossmintProvider>
  );
}
