import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearMobileAuthToken } from '@/services/authenticatedFetch';

interface User {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
}

interface AuthState {
  user: User | null;
  session: { user: User } | null;
  isAuthenticated: boolean;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  setSession: (session: { user: User } | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      status: 'loading',
      setSession: (session) => {
        const user = session?.user || null;
        const isAuthenticated = Boolean(user?.id || user?.email);
        set({
          session,
          user,
          isAuthenticated,
          status: isAuthenticated ? 'authenticated' : 'unauthenticated',
        });
      },
      logout: () => {
        void clearMobileAuthToken();
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          status: 'unauthenticated',
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          useAuthStore.setState({
            isAuthenticated: false,
            status: 'unauthenticated',
          });
          return;
        }

        const isAuthenticated = Boolean(state?.user?.id || state?.user?.email);
        useAuthStore.setState({
          isAuthenticated,
          status: isAuthenticated ? 'authenticated' : 'unauthenticated',
        });
      },
    },
  ),
);
