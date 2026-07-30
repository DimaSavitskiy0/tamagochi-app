// Re-exported from PetProvider so every screen shares one pet entity instead of each
// usePet() call keeping its own independent copy of the state.
export { usePet } from '@/contexts/PetProvider';
