import { router } from 'expo-router';

import { HouseholdScreen } from '@/features/household/ui/household-screen';

/** Sharing: create or join a household, then members, invites and sync. */
export default function HouseholdRoute() {
  return (
    <HouseholdScreen
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      }}
    />
  );
}
