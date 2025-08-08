"use client";

export function EmptyState() {
  return (
    <div className="text-center py-10">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-civic-blue-50 text-civic-blue-700 text-xs font-medium mb-3">
        California services
      </div>
      <h2 className="text-2xl font-semibold mb-2 tracking-tight">How can I help you today?</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
        Ask about emergency alerts, unemployment, hazardous tree removal waivers, air quality, or replacing citizenship documents.
      </p>
    </div>
  );
}


