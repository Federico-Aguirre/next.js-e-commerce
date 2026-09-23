/**
 * @file useAppStore.ts
 * @description Global application UI state management using Zustand.
 * Handles global client-side interactive states like sidebar toggles and loading overlays.
 */

import { create } from 'zustand';

// Type definition for application state and actions
type AppState = {
  // State
  isSidebarOpen: boolean;
  isLoadingGlobal: boolean;

  // Actions
  toggleSidebar: () => void;
  setLoadingGlobal: (loading: boolean) => void;
  reset: () => void;
};

// Custom hook creation and export
export const useAppStore = create<AppState>((set) => ({
  // Initial default state
  isSidebarOpen: false,
  isLoadingGlobal: false,

  // Action handlers
  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },

  setLoadingGlobal: (loading) => {
    set({ isLoadingGlobal: loading });
  },

  reset: () => {
    set({ isSidebarOpen: false, isLoadingGlobal: false });
  },
}));
