import React from 'react';
import { cn } from '../lib/utils';

// Singolo blocco skeleton animato
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      "animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700",
      className
    )} />
  );
}

// Skeleton per una riga di lista (icona + testo + badge)
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-16 h-6 rounded-full" />
    </div>
  );
}

// Skeleton per una riga utente
export function SkeletonUserRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="w-20 h-6 rounded-full" />
      <Skeleton className="w-8 h-8 rounded-lg" />
      <Skeleton className="w-8 h-8 rounded-lg" />
    </div>
  );
}

// Empty state generico con icona e messaggio
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-4">{description}</p>
      )}
      {action && action}
    </div>
  );
}
