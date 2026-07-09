import { api } from "./api";
import { Email, PaginatedResponse } from "@/types/email";

export const emailService = {
  getInbox: async (): Promise<PaginatedResponse<Email>> => {
    const response = await api.get<PaginatedResponse<Email>>("/emails", {
      params: { folder: "inbox" },
    });
    return response.data;
  },
  
  getEmailById: async (id: string): Promise<{ success: boolean; message: string; data: Email }> => {
    const response = await api.get<{ success: boolean; message: string; data: Email }>(`/emails/${id}`);
    return response.data;
  },
  
  markAsRead: async (id: string, isRead: boolean = true): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>(`/emails/${id}/read`, { isRead });
    return response.data;
  },

  toggleStar: async (id: string, isStarred: boolean): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>(`/emails/${id}/star`, { isStarred });
    return response.data;
  },

  archiveEmail: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>(`/emails/${id}/archive`);
    return response.data;
  },

  trashEmail: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>(`/emails/bulk`, { 
      emailIds: [id], 
      operation: 'trash' 
    });
    return response.data;
  },
};
