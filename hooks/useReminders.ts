// Re-exported from RemindersProvider so every screen shares one reminders list instead
// of each useReminders() call keeping its own independent copy.
export { useReminders } from '@/contexts/RemindersProvider';
