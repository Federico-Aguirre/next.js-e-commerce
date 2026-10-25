import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'nova-mobile-access-token';

/** Keep bearer credentials out of AsyncStorage/Zustand persisted state. */
export async function storeMobileAuthToken(token: string | null | undefined) {
  if (Platform.OS === 'web') return;
  if (!token) {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    return;
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function clearMobileAuthToken() {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

/**
 * Add the native app's signed bearer token to authenticated API requests.
 * Expo Web keeps using the HttpOnly NextAuth cookie.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (Platform.OS !== 'web') {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (token) headers.set('Authorization', 'Bearer ' + token);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });
}
