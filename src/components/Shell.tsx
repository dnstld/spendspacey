import type { ReactNode } from 'react';
import { LanguageSelect } from './LanguageSelect';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[radial-gradient(ellipse_at_top,#e4eddf_0%,transparent_60%)] px-4 py-8 sm:px-8">
      <main className="w-full max-w-md rounded-3xl border border-border bg-white/95 p-6 shadow-[0_20px_80px_-40px_#184d3f55] sm:p-9">
        <div className="mb-12 flex justify-end">
          <LanguageSelect />
        </div>
        <div className="flex min-h-64 flex-col items-center justify-center gap-7 pb-5 text-center">
          {children}
        </div>
      </main>
    </div>
  );
}
