import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gimi — The Rental Shell for AI Agents",
  description: "Equip your agent with peer-to-peer rental capabilities. Trust-scored by Maiat. Powered by Dojo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${inter.className} min-h-full flex flex-col bg-gray-950 text-white`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
