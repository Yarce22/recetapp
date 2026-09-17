import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { AddPantryItemForm } from '@/features/pantry/ui/add-pantry-item-form';
import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { ThemedView } from '@/shared/ui/themed-view';

export default function AddPantryItemScreen() {
  const { addItem } = usePantry();

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <AddPantryItemForm
          onSubmit={async (input) => {
            await addItem(input);
            router.back();
          }}
        />
      </ScrollView>
    </ThemedView>
  );
}
