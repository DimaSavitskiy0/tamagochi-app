// Re-exported from DiaryProvider so every screen shares one diary instead of each
// useDiary() call keeping its own independent copy of the entries.
export { useDiary } from '@/contexts/DiaryProvider';
