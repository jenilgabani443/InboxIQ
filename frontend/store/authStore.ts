import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  displayName: string;
  mfaEnabled?: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  
  // Actions
  login: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      
      login: (accessToken, refreshToken, user) => 
        set({ isAuthenticated: true, accessToken, refreshToken, user }),
      
      logout: () => 
        set({ isAuthenticated: false, user: null, accessToken: null, refreshToken: null }),
        
      setTokens: (accessToken, refreshToken) => 
        set({ accessToken, refreshToken }),
        
      updateUser: (updatedUser) => 
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedUser } : null
        })),
    }),
    {
      name: 'inboxiq-auth', // unique name
    }
  )
);
