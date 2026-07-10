import { create } from 'zustand';
import { userService, UserProfile, UserPreferences, VacationResponder } from '@/services/userService';
import { toast } from 'sonner';

interface SettingsState {
  isSettingsOpen: boolean;
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  
  setSettingsOpen: (isOpen: boolean) => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: { displayName?: string; avatarUrl?: string }) => Promise<void>;
  updatePreferences: (data: UserPreferences) => Promise<void>;
  updateSignature: (signature: string) => Promise<void>;
  updateVacation: (data: VacationResponder) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isSettingsOpen: false,
  profile: null,
  isLoading: false,
  isSaving: false,

  setSettingsOpen: (isOpen) => {
    set({ isSettingsOpen: isOpen });
    if (isOpen && !get().profile) {
      get().fetchProfile();
    }
  },

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const { data } = await userService.getProfile();
      set({ profile: data });
    } catch (error) {
      console.error("Failed to fetch profile", error);
      toast.error("Failed to load settings");
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (data) => {
    set({ isSaving: true });
    try {
      const { data: updatedProfile } = await userService.updateProfile(data);
      set({ profile: updatedProfile });
      toast.success("Profile updated successfully");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      set({ isSaving: false });
    }
  },

  updatePreferences: async (data) => {
    set({ isSaving: true });
    try {
      const { data: { preferences } } = await userService.updatePreferences(data);
      set((state) => ({
        profile: state.profile ? { ...state.profile, preferences } : null
      }));
      toast.success("Preferences updated successfully");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to update preferences");
    } finally {
      set({ isSaving: false });
    }
  },

  updateSignature: async (signature) => {
    set({ isSaving: true });
    try {
      const { data: { signature: newSignature } } = await userService.updateSignature({ signature });
      set((state) => ({
        profile: state.profile ? { ...state.profile, signature: newSignature } : null
      }));
      toast.success("Signature updated successfully");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to update signature");
    } finally {
      set({ isSaving: false });
    }
  },

  updateVacation: async (data) => {
    set({ isSaving: true });
    try {
      const { data: { vacationResponder } } = await userService.updateVacation(data);
      set((state) => ({
        profile: state.profile ? { ...state.profile, vacationResponder } : null
      }));
      toast.success("Vacation responder updated successfully");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to update vacation responder");
    } finally {
      set({ isSaving: false });
    }
  }
}));
