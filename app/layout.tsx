import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'USDR Chat over Docs – Demo',
  description: 'Scrape, index, and chat over official resources with tool-trace & citations.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="mx-auto max-w-5xl p-4">
          <header className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">USDR Chat over Docs</h1>
            <div className="flex gap-4 items-center">
              <a className="text-sm underline" href="/">Chat</a>
              <a className="text-sm underline" href="/test">Test Suite</a>
              <a className="text-sm underline" href="https://github.com/michaeleboyce" target="_blank">Source</a>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}