import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProviderWrapper } from "@/components/WalletProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RentChain — Rent Anything, Trust Everyone",
  description: "AI-agent-guided peer-to-peer rental marketplace. Tokenized on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${inter.className} min-h-full flex flex-col bg-gray-950 text-white`}>
        <WalletProviderWrapper>{children}</WalletProviderWrapper>
      </body>
    </html>
  );
}
