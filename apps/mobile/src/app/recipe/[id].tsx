import { useLocalSearchParams } from 'expo-router';

import { ScreenPlaceholder } from '@/shared/ui/screen-placeholder';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScreenPlaceholder
      title="Recipe"
      description={`Full ingredients and steps for recipe ${id}, including what you are missing.`}
      phase="Phase 3"
    />
  );
}
