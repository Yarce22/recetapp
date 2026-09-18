import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // The lint rule is right in general - setState in an effect body causes an
    // extra render - but that extra render is the entire point here. The
    // server renders without knowing the color scheme, and this is how the
    // client says "I am here now, ask again". There is no external system to
    // subscribe to: the fact being tracked IS hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
