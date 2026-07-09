import { create } from "zustand";
import { Email, PaginationMeta } from "@/types/email";
import { emailService } from "@/services/emailService";
import { AxiosError } from "axios";

interface EmailState {
  emails: Email[];
  loading: boolean;
  error: string | null;
  selectedEmailId: string | null;
  meta: PaginationMeta | null;
  selectedEmail: Email | null;
  loadingEmail: boolean;
  emailError: string | null;
  fetchEmails: () => Promise<void>;
  fetchEmailById: (id: string) => Promise<void>;
  markEmailAsRead: (id: string, isRead?: boolean) => Promise<void>;
  toggleStar: (id: string, isStarred: boolean) => Promise<void>;
  archiveEmail: (id: string) => Promise<void>;
  trashEmail: (id: string) => Promise<void>;
  setSelectedEmail: (id: string | null) => void;
  clearSelectedEmail: () => void;
  clearError: () => void;
}

export const useEmailStore = create<EmailState>((set, get) => ({
  emails: [],
  loading: false,
  error: null,
  selectedEmailId: null,
  meta: null,
  selectedEmail: null,
  loadingEmail: false,
  emailError: null,

  fetchEmails: async () => {
    set({ loading: true, error: null });
    try {
      const response = await emailService.getInbox();


      //console.log("API Response:", response);

      //console.log("Emails:", response.data);
      set({
        emails: response.data,
        meta: response.meta,
        loading: false
      });
    } catch (error: unknown) {
      const err = error as AxiosError<{ message: string }>;
      set({
        error: err.response?.data?.message || "Unable to load emails.",
        loading: false
      });
    }
  },

  fetchEmailById: async (id: string) => {
    const currentSelected = get().selectedEmail;
    if (currentSelected && (currentSelected.id === id || currentSelected._id === id)) {
      return; // Avoid unnecessary API calls if already fetched
    }
    
    set({ loadingEmail: true, emailError: null });
    try {
      const response = await emailService.getEmailById(id);
      set({ selectedEmail: response.data, loadingEmail: false });
    } catch (error: unknown) {
      const err = error as AxiosError<{ message: string }>;
      set({
        emailError: err.response?.data?.message || "Unable to load email.",
        loadingEmail: false,
      });
    }
  },

  markEmailAsRead: async (id: string, isRead: boolean = true) => {
    const { emails, selectedEmail } = get();
    const emailToUpdate = emails.find(e => (e.id || e._id) === id);
    if (!emailToUpdate || emailToUpdate.isRead === isRead) return;

    // Optimistic update
    set({
      emails: emails.map(e => (e.id || e._id) === id ? { ...e, isRead } : e),
      selectedEmail: selectedEmail && (selectedEmail.id || selectedEmail._id) === id 
        ? { ...selectedEmail, isRead } 
        : selectedEmail
    });

    try {
      await emailService.markAsRead(id, isRead);
    } catch (error) {
      console.warn("Failed to mark email as read", error);
    }
  },

  toggleStar: async (id: string, isStarred: boolean) => {
    const { emails, selectedEmail } = get();
    set({
      emails: emails.map(e => (e.id || e._id) === id ? { ...e, isStarred } : e),
      selectedEmail: selectedEmail && (selectedEmail.id || selectedEmail._id) === id 
        ? { ...selectedEmail, isStarred } 
        : selectedEmail
    });
    try {
      await emailService.toggleStar(id, isStarred);
    } catch (error) {
      console.warn("Failed to toggle star", error);
    }
  },

  archiveEmail: async (id: string) => {
    const { emails, selectedEmailId, clearSelectedEmail } = get();
    set({ emails: emails.filter(e => (e.id || e._id) !== id) });
    if (selectedEmailId === id) clearSelectedEmail();

    try {
      await emailService.archiveEmail(id);
    } catch (error) {
      console.warn("Failed to archive email", error);
    }
  },

  trashEmail: async (id: string) => {
    const { emails, selectedEmailId, clearSelectedEmail } = get();
    set({ emails: emails.filter(e => (e.id || e._id) !== id) });
    if (selectedEmailId === id) clearSelectedEmail();

    try {
      await emailService.trashEmail(id);
    } catch (error) {
      console.warn("Failed to trash email", error);
    }
  },

  setSelectedEmail: (id) => set({ selectedEmailId: id }),
  clearSelectedEmail: () => set({ selectedEmailId: null, selectedEmail: null, emailError: null }),
  clearError: () => set({ error: null, emailError: null }),
}));
