import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/AuthProvider';

// The bare "/" path has no file-based route of its own, so without this the router
// falls back unpredictably (e.g. the tabs group defaulting to whichever screen is
// declared first) instead of reliably landing on the pet screen after sign-in.
export default function Index() {
  const { isAuthenticated } = useAuth();
  return <Redirect href={isAuthenticated ? '/pet' : '/sign-in'} />;
}
