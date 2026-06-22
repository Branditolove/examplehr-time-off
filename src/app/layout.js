import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavLink } from "./NavLink";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "ExampleHR — Time-Off",
  description: "Time-off requests for ExampleHR, backed by a mock HCM.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900">
        <Providers>
          <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
            <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
              <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                  HR
                </span>
                ExampleHR
              </Link>
              <div className="flex gap-1 text-sm font-medium text-gray-500">
                <NavLink href="/employee">Employee</NavLink>
                <NavLink href="/manager">Manager</NavLink>
              </div>
            </nav>
          </header>
          <div className="flex flex-1 flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
