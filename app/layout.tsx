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
        <div className="bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100 border-b border-yellow-200 dark:border-yellow-800">
          <div className="mx-auto max-w-6xl px-4 py-3 text-center text-sm md:text-base font-semibold tracking-wide">
            DEMO — FOR DEMONSTRATION / TESTING PURPOSES ONLY
          </div>
        </div>
        <div className="border-b border-neutral-200 bg-white/80 backdrop-blur dark:bg-neutral-950/80 dark:border-neutral-800">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-civic-blue-600 text-white flex items-center justify-center font-bold">CA</div>
              <div>
                <div className="text-sm text-neutral-500">USDR Demo</div>
                <h1 className="text-xl font-semibold tracking-tight">California Services Assistant</h1>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <a className="text-sm font-medium hover:underline" href="/">Chat</a>
              <a className="text-sm font-medium hover:underline" href="/test">Test Suite</a>
              <a className="text-sm font-medium hover:underline" href="https://github.com/michaeleboyce" target="_blank" rel="noreferrer">Source</a>
            </nav>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </div>

        <footer className="mt-8 border-t border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-neutral-500 flex items-center justify-between">
            <div>
              Built by USDR. Content from official California and federal resources.
            </div>
            <div className="flex gap-4">
              <a href="https://designsystem.digital.gov/" target="_blank" rel="noreferrer" className="hover:underline">USWDS</a>
              <a href="https://ca.gov" target="_blank" rel="noreferrer" className="hover:underline">CA.gov</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}