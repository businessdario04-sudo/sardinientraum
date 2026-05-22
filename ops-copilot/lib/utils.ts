import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isPast, isWithinInterval, addMinutes } from 'date-fns';
import type { Priority, TaskStatus } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return 'unknown';
  }
}

export function formatDateTime(dateString: string): string {
  try {
    return format(new Date(dateString), 'dd MMM yyyy, HH:mm');
  } catch {
    return 'unknown';
  }
}

export function isOverdue(deadline: string): boolean {
  try {
    return isPast(new Date(deadline));
  } catch {
    return false;
  }
}

export function isUrgentSoon(deadline: string, withinMinutes = 60): boolean {
  try {
    const now = new Date();
    return isWithinInterval(new Date(deadline), {
      start: now,
      end: addMinutes(now, withinMinutes),
    });
  } catch {
    return false;
  }
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  medium: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  low: { label: 'Low', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
};

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'text-slate-700', bg: 'bg-slate-100' },
  assigned: { label: 'Assigned', color: 'text-blue-700', bg: 'bg-blue-50' },
  in_progress: { label: 'In Progress', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  waiting: { label: 'Waiting', color: 'text-amber-700', bg: 'bg-amber-50' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-50' },
};

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function getPriorityDot(priority: Priority): string {
  const map: Record<Priority, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  };
  return map[priority];
}
