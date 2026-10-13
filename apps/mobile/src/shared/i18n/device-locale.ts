import { I18nManager } from 'react-native';

/**
 * The locale the device is set to, as the OS spells it (`es_AR`, `en-US`).
 *
 * Read from React Native itself, with `Intl` as a second source, so no native
 * module is needed. Undefined when neither knows.
 */
export function getDeviceLocale(): string | undefined {
  try {
    const identifier = I18nManager.getConstants?.().localeIdentifier;
    if (identifier) return identifier;
  } catch {
    // Fall through to Intl.
  }

  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}
