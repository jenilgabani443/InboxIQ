import { api } from "./api";

export interface UserPreferences {
  theme?: "light" | "dark";
  undoSendSeconds?: number;
  notificationsEnabled?: boolean;
}

export interface VacationResponder {
  enabled: boolean;
  subject?: string;
  body?: string;
  startDate?: string;
  endDate?: string;
}

export interface UserProfile {
  id: string;
  _id?: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
  mfaEnabled?: boolean;
  signature?: string;
  preferences?: UserPreferences;
  vacationResponder?: VacationResponder;
}

export const userService = {
  getProfile: async (): Promise<{ success: boolean; message: string; data: UserProfile }> => {
    const response = await api.get("/users/me");
    return response.data;
  },

  updateProfile: async (payload: { displayName?: string; avatarUrl?: string }): Promise<{ success: boolean; message: string; data: UserProfile }> => {
    const response = await api.patch("/users/me", payload);
    return response.data;
  },

  updateSignature: async (payload: { signature: string }): Promise<{ success: boolean; message: string; data: { signature: string } }> => {
    const response = await api.put("/users/me/signature", payload);
    return response.data;
  },

  updateVacation: async (payload: VacationResponder): Promise<{ success: boolean; message: string; data: { vacationResponder: VacationResponder } }> => {
    const response = await api.put("/users/me/vacation", payload);
    return response.data;
  },

  updatePreferences: async (payload: UserPreferences): Promise<{ success: boolean; message: string; data: { preferences: UserPreferences } }> => {
    const response = await api.put("/users/me/preferences", payload);
    return response.data;
  },

  changePassword: async (payload: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> => {
    const response = await api.put("/users/me/password", payload);
    return response.data;
  }
};
