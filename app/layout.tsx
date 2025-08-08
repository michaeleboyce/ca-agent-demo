import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'USDR Chat over Docs – Demo',
  description: 'Scrape, index, and chat over official resources with tool-trace & citations.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-civic-blue-600 focus:text-white focus:rounded-lg focus:outline-none">
          Skip to main content
        </a>
        <div className="bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100 border-b border-yellow-200 dark:border-yellow-800" role="banner" aria-label="Demo Notice">
          <div className="mx-auto max-w-6xl px-4 py-3 text-center text-sm md:text-base font-semibold tracking-wide">
            DEMO — FOR DEMONSTRATION / TESTING PURPOSES ONLY
          </div>
        </div>
        <header className="border-b border-neutral-200 bg-white/80 backdrop-blur dark:bg-neutral-950/80 dark:border-neutral-800">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-civic-blue-600 text-white flex items-center justify-center font-bold" aria-hidden="true">CA</div>
              <div>
                <div className="text-sm text-neutral-500">USDR Demo</div>
                <h1 className="text-xl font-semibold tracking-tight">California Services Assistant</h1>
              </div>
            </div>
            <nav className="flex items-center gap-4" aria-label="Main navigation">
              <a className="text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-civic-blue-400 focus:ring-offset-2 rounded px-1" href="/">Chat</a>
              <a className="text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-civic-blue-400 focus:ring-offset-2 rounded px-1" href="/test">Test Suite</a>
              <a className="text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-civic-blue-400 focus:ring-offset-2 rounded px-1" href="https://github.com/michaeleboyce/ca-agent-demo" target="_blank" rel="noreferrer" aria-label="View source on GitHub (opens in new tab)">Source</a>
            </nav>
          </div>
        </header>

        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6" role="main">
          {children}
        </main>

        <footer className="mt-8 border-t border-neutral-200 dark:border-neutral-800" role="contentinfo">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-neutral-500 flex items-center justify-between">
            <div>
              Built by USDR. Content from official California and federal resources.
            </div>
            <nav className="flex gap-4" aria-label="External links">
              <a href="https://designsystem.digital.gov/" target="_blank" rel="noreferrer" className="hover:underline focus:outline-none focus:ring-2 focus:ring-civic-blue-400 focus:ring-offset-2 rounded px-1" aria-label="U.S. Web Design System (opens in new tab)">USWDS</a>
              <a href="https://ca.gov" target="_blank" rel="noreferrer" className="hover:underline focus:outline-none focus:ring-2 focus:ring-civic-blue-400 focus:ring-offset-2 rounded px-1" aria-label="California official website (opens in new tab)">CA.gov</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}