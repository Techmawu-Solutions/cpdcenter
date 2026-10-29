import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CPD Training Centres",
  description: "Find the proposed National CPD training centres for private school teachers in your district.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="bg-brand text-white">
          <div className="mx-auto flex max-w-3xl items-center px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              National CPD Training Centres
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
