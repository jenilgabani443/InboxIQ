import { create } from 'zustand';

interface ThemeState {
  isCompactMode: boolean;
  toggleCompactMode: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isCompactMode: false,
  toggleCompactMode: () => set((state) => ({ isCompactMode: !state.isCompactMode })),
}));
