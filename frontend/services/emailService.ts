import { api } from "./api";
import { Email, PaginatedResponse, EmailLabel, SearchHistoryItem, SavedSearch, AppNotification } from "@/types/email";

export interface SendEmailPayload {
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  status?: "sent" | "draft";
  attachments?: string[];
}

export const emailService = {
  getInbox: async (): Promise<PaginatedResponse<Email>> => {
    const response = await api.get<PaginatedResponse<Email>>("/emails", {
      params: { folder: "inbox" },
    });
    return response.data;
  },

  getSent: async (): Promise<PaginatedResponse<Email>> => {
    const response = await api.get<PaginatedResponse<Email>>("/emails", {
      params: { folder: "sent" }
    });
    return response.data;
  },

  getArchived: async (): Promise<PaginatedResponse<Email>> => {
    const response = await api.get<PaginatedResponse<Email>>("/emails", {
      params: { folder: "archive" }
    });
    return response.data;
  },

  getTrash: async (): Promise<PaginatedResponse<Email>> => {
    const response = await api.get<PaginatedResponse<Email>>("/emails", {
      params: { folder: "trash" }
    });
    return response.data;
  },

  getDrafts: async (): Promise<PaginatedResponse<Email>> => {
    const response = await api.get<PaginatedResponse<Email>>("/emails", {
      params: { folder: "drafts" }
    });
    return response.data;
  },
  
  searchEmails: async (q: string, signal?: AbortSignal): Promise<PaginatedResponse<Email>> => {
    const response = await api.get<PaginatedResponse<Email>>("/emails/search", {
      params: { q },
      signal
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

  unarchiveEmail: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>(`/emails/${id}/move`, {
      folder: "inbox"
    });
    return response.data;
  },

  trashEmail: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>(`/emails/bulk`, { 
      emailIds: [id], 
      operation: "trash" 
    });
    return response.data;
  },

  restoreFromTrash: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>(`/emails/bulk`, { 
      emailIds: [id], 
      operation: "restore" 
    });
    return response.data;
  },

  sendEmail: async (payload: SendEmailPayload): Promise<{ success: boolean; message: string; data: Email }> => {
    const response = await api.post<{ success: boolean; message: string; data: Email }>(`/emails`, payload);
    return response.data;
  },

  updateDraft: async (id: string, payload: Partial<{
    to: { email: string; name?: string }[];
    cc: { email: string; name?: string }[];
    bcc: { email: string; name?: string }[];
    subject: string;
    bodyText: string;
    bodyHtml: string;
    attachments: string[];
  }>): Promise<{ success: boolean; message: string; data: Email }> => {
    const response = await api.patch<{ success: boolean; message: string; data: Email }>(`/emails/${id}`, payload);
    return response.data;
  },

  getLabels: async (): Promise<{ success: boolean; message: string; data: EmailLabel[] }> => {
    const response = await api.get<{ success: boolean; message: string; data: EmailLabel[] }>("/labels");
    return response.data;
  },

  getEmailsByLabel: async (labelId: string): Promise<PaginatedResponse<Email>> => {
    const response = await api.get<PaginatedResponse<Email>>("/emails", {
      params: { label: labelId }
    });
    return response.data;
  },

  applyLabels: async (emailIds: string[], labels: string[]): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>("/emails/bulk", {
      emailIds,
      operation: "applyLabels",
      labels
    });
    return response.data;
  },

  removeLabels: async (emailIds: string[], labels: string[]): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>("/emails/bulk", {
      emailIds,
      operation: "removeLabels",
      labels
    });
    return response.data;
  },

  uploadAttachment: async (file: File): Promise<{ success: boolean; message: string; data: { _id: string; filename: string; sizeBytes: number } }> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<{ success: boolean; message: string; data: { _id: string; filename: string; sizeBytes: number } }>("/attachments/upload", formData);
    return response.data;
  },

  getSearchHistory: async (): Promise<{ success: boolean; message: string; data: SearchHistoryItem[] }> => {
    const response = await api.get("/search/history");
    return response.data;
  },

  clearSearchHistory: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete("/search/history");
    return response.data;
  },

  saveSearch: async (payload: { name: string; query: string }): Promise<{ success: boolean; message: string; data: SavedSearch }> => {
    const response = await api.post("/search/saved", payload);
    return response.data;
  },

  getSavedSearches: async (): Promise<{ success: boolean; message: string; data: SavedSearch[] }> => {
    const response = await api.get("/search/saved");
    return response.data;
  },

  renameSavedSearch: async (id: string, name: string): Promise<{ success: boolean; message: string; data: SavedSearch }> => {
    const response = await api.patch(`/search/saved/${id}`, { name });
    return response.data;
  },

  deleteSavedSearch: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/search/saved/${id}`);
    return response.data;
  },

  getNotifications: async (): Promise<PaginatedResponse<AppNotification>> => {
    const response = await api.get<PaginatedResponse<AppNotification>>("/notifications");
    return response.data;
  },

  markNotificationRead: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>(`/notifications/${id}/read`);
    return response.data;
  },

  markAllNotificationsRead: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.patch<{ success: boolean; message: string }>("/notifications/read-all");
    return response.data;
  },

  deleteNotification: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete<{ success: boolean; message: string }>(`/notifications/${id}`);
    return response.data;
  }
};
