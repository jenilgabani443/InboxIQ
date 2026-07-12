import { create } from "zustand";
import { Email, PaginationMeta, EmailLabel, SearchHistoryItem, SavedSearch, AppNotification } from "@/types/email";
import { emailService } from "@/services/emailService";
import { AxiosError } from "axios";

// To store the AbortController instance outside of Zustand state to avoid freezing issues
let searchAbortController: AbortController | null = null;

interface EmailState {
  emails: Email[];
  loading: boolean;
  error: string | null;
  selectedEmailId: string | null;
  meta: PaginationMeta | null;
  selectedEmail: Email | null;
  loadingEmail: boolean;
  emailError: string | null;
  isComposeOpen: boolean;
  draftEmailToEdit: Email | null;
  currentFolder: "inbox" | "sent" | "archive" | "trash" | "drafts" | "label";
  currentLabelId: string | null;
  labels: EmailLabel[];
  searchQuery: string;
  isSearching: boolean;
  fetchInbox: () => Promise<void>;
  fetchSent: () => Promise<void>;
  fetchArchived: () => Promise<void>;
  fetchTrash: () => Promise<void>;
  fetchDrafts: () => Promise<void>;
  fetchLabels: () => Promise<void>;
  fetchEmailsByLabel: (labelId: string) => Promise<void>;
  setCurrentFolder: (folder: "inbox" | "sent" | "archive" | "trash" | "drafts" | "label") => void;
  setCurrentLabel: (labelId: string) => void;
  fetchEmailById: (id: string) => Promise<void>;
  markEmailAsRead: (id: string, isRead?: boolean) => Promise<void>;
  toggleStar: (id: string, isStarred: boolean) => Promise<void>;
  archiveEmail: (id: string) => Promise<void>;
  unarchiveEmail: (id: string) => Promise<void>;
  trashEmail: (id: string) => Promise<void>;
  restoreFromTrash: (id: string) => Promise<void>;
  assignLabelToEmail: (emailId: string, labelId: string) => Promise<void>;
  removeLabelFromEmail: (emailId: string, labelId: string) => Promise<void>;
  setSelectedEmail: (id: string | null) => void;
  setComposeOpen: (isOpen: boolean) => void;
  setDraftEmailToEdit: (email: Email | null) => void;
  setSearchQuery: (query: string) => void;
  searchEmails: (query: string) => Promise<void>;
  clearSearch: () => void;
  clearSelectedEmail: () => void;
  clearError: () => void;

  searchHistory: SearchHistoryItem[];
  savedSearches: SavedSearch[];
  loadingHistory: boolean;
  loadingSavedSearches: boolean;
  
  fetchSearchHistory: () => Promise<void>;
  clearSearchHistory: () => Promise<void>;
  fetchSavedSearches: () => Promise<void>;
  saveSearch: (name: string, query: string) => Promise<boolean>;
  renameSavedSearch: (id: string, name: string) => Promise<boolean>;
  deleteSavedSearch: (id: string) => Promise<boolean>;

  notifications: AppNotification[];
  loadingNotifications: boolean;
  unreadCount: number;
  
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
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
  isComposeOpen: false,
  draftEmailToEdit: null,
  currentFolder: "inbox",
  currentLabelId: null,
  labels: [],
  searchQuery: "",
  isSearching: false,
  
  searchHistory: [],
  savedSearches: [],
  loadingHistory: false,
  loadingSavedSearches: false,

  notifications: [],
  loadingNotifications: false,
  unreadCount: 0,

  fetchInbox: async () => {
    set({ loading: true, error: null });
    try {
      const response = await emailService.getInbox();

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

  fetchSent: async () => {
    set({ loading: true, error: null });
    try {
      const response = await emailService.getSent();

      set({
        emails: response.data,
        meta: response.meta,
        loading: false
      });
    } catch (error: unknown) {
      const err = error as AxiosError<{ message: string }>;
      set({
        error: err.response?.data?.message || "Unable to load sent emails.",
        loading: false
      });
    }
  },

  fetchArchived: async () => {
    set({ loading: true, error: null });
    try {
      const response = await emailService.getArchived();

      set({
        emails: response.data,
        meta: response.meta,
        loading: false
      });
    } catch (error: unknown) {
      const err = error as AxiosError<{ message: string }>;
      set({
        error: err.response?.data?.message || "Unable to load archived emails.",
        loading: false
      });
    }
  },

  fetchTrash: async () => {
    set({ loading: true, error: null });
    try {
      const response = await emailService.getTrash();

      set({
        emails: response.data,
        meta: response.meta,
        loading: false
      });
    } catch (error: unknown) {
      const err = error as AxiosError<{ message: string }>;
      set({
        error: err.response?.data?.message || "Unable to load trash emails.",
        loading: false
      });
    }
  },

  fetchDrafts: async () => {
    set({ loading: true, error: null });
    try {
      const response = await emailService.getDrafts();

      set({
        emails: response.data,
        meta: response.meta,
        loading: false
      });
    } catch (error: unknown) {
      const err = error as AxiosError<{ message: string }>;
      set({
        error: err.response?.data?.message || "Unable to load drafts.",
        loading: false
      });
    }
  },

  fetchLabels: async () => {
    try {
      const response = await emailService.getLabels();
      set({ labels: response.data });
    } catch (error) {
      console.error("Failed to load labels", error);
    }
  },

  fetchEmailsByLabel: async (labelId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await emailService.getEmailsByLabel(labelId);
      set({
        emails: response.data,
        meta: response.meta,
        loading: false
      });
    } catch (error: unknown) {
      const err = error as AxiosError<{ message: string }>;
      set({
        error: err.response?.data?.message || "Unable to load label emails.",
        loading: false
      });
    }
  },

  searchEmails: async (query: string) => {
    if (!query.trim()) {
      get().clearSearch();
      return;
    }
    
    // Cancel previous search if active
    if (searchAbortController) {
      searchAbortController.abort();
    }
    searchAbortController = new AbortController();
    
    set({ loading: true, error: null, isSearching: true, searchQuery: query, currentFolder: "inbox" });
    try {
      const response = await emailService.searchEmails(query, searchAbortController.signal);
      set({
        emails: response.data,
        meta: response.meta,
        loading: false
      });
    } catch (error: unknown) {
      const err = error as AxiosError<{ message: string }>;
      // If error is due to cancellation, do not update state to error
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      set({
        error: err.response?.data?.message || "Unable to perform search.",
        loading: false
      });
    }
  },

  clearSearch: () => {
    if (searchAbortController) {
      searchAbortController.abort();
      searchAbortController = null;
    }
    set({ searchQuery: "", isSearching: false });
    // Restore current folder results
    const currentFolder = get().currentFolder;
    if (currentFolder === "inbox") get().fetchInbox();
    else if (currentFolder === "sent") get().fetchSent();
    else if (currentFolder === "archive") get().fetchArchived();
    else if (currentFolder === "trash") get().fetchTrash();
    else if (currentFolder === "drafts") get().fetchDrafts();
    else if (currentFolder === "label") {
      const labelId = get().currentLabelId;
      if (labelId) get().fetchEmailsByLabel(labelId);
    }
  },

  setCurrentFolder: (folder) => {
    const { clearSelectedEmail, clearError } = get();
    clearSelectedEmail();
    clearError();
    set({ currentFolder: folder, currentLabelId: null, searchQuery: "", isSearching: false });
  },

  setCurrentLabel: (labelId) => {
    const { clearSelectedEmail, clearError } = get();
    clearSelectedEmail();
    clearError();
    set({ currentFolder: "label", currentLabelId: labelId, searchQuery: "", isSearching: false });
  },

  fetchEmailById: async (id: string) => {
    const currentSelected = get().selectedEmail;
    if (currentSelected && (currentSelected.id === id || currentSelected._id === id)) {
      return; // Avoid unnecessary API calls if already fetched
    }
    
    set({ loadingEmail: true, emailError: null });
    try {
      const response = await emailService.getEmailById(id);
      
      // If we optimistically marked it as read in the list, ensure the fetched detail reflects this
      const emailInList = get().emails.find(e => (e.id || e._id) === id);
      if (emailInList && emailInList.isRead) {
        response.data.isRead = true;
      }
      
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

  unarchiveEmail: async (id: string) => {
    const { emails, selectedEmailId, clearSelectedEmail } = get();
    set({ emails: emails.filter(e => (e.id || e._id) !== id) });
    if (selectedEmailId === id) clearSelectedEmail();

    try {
      await emailService.unarchiveEmail(id);
    } catch (error) {
      console.warn("Failed to unarchive email", error);
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

  restoreFromTrash: async (id: string) => {
    try {
      await emailService.restoreFromTrash(id);
      const currentFolder = get().currentFolder;
      if (currentFolder === "trash") get().fetchTrash();
      else if (currentFolder === "inbox") get().fetchInbox();
      
      if (get().selectedEmailId === id) get().fetchEmailById(id);
    } catch (error) {
      console.error("Failed to restore email", error);
    }
  },

  assignLabelToEmail: async (emailId: string, labelId: string) => {
    try {
      await emailService.applyLabels([emailId], [labelId]);
      
      // Update local state for selected email
      const { selectedEmail, labels } = get();
      if (selectedEmail && (selectedEmail.id === emailId || selectedEmail._id === emailId)) {
        const labelObj = labels.find(l => l._id === labelId);
        if (labelObj) {
          const newLabels = [...(selectedEmail.labels || [])];
          if (!newLabels.some(l => l._id === labelId)) {
            newLabels.push(labelObj);
            set({ selectedEmail: { ...selectedEmail, labels: newLabels } });
          }
        }
      }
      
      // Refresh current list if we're not inside it so we keep counts or state consistent?
      // For simplicity, just updating the selectedEmail is enough for the Detail view.
    } catch (error) {
      console.error("Failed to assign label", error);
    }
  },

  removeLabelFromEmail: async (emailId: string, labelId: string) => {
    try {
      await emailService.removeLabels([emailId], [labelId]);
      
      // Update local state for selected email
      const { selectedEmail } = get();
      if (selectedEmail && (selectedEmail.id === emailId || selectedEmail._id === emailId)) {
        const newLabels = (selectedEmail.labels || []).filter(l => l._id !== labelId);
        set({ selectedEmail: { ...selectedEmail, labels: newLabels } });
      }
      
      // If we are viewing this specific label's folder, we might want to refetch,
      // but it's optional depending on the desired UX. We can just let it be until a refetch.
      if (get().currentFolder === "label" && get().currentLabelId === labelId) {
        get().fetchEmailsByLabel(labelId);
        // Clear selected if it was removed from the list we are viewing
        if (get().selectedEmailId === emailId) {
          set({ selectedEmail: null, selectedEmailId: null });
        }
      }
    } catch (error) {
      console.error("Failed to remove label", error);
    }
  },

  setComposeOpen: (isOpen) => set({ isComposeOpen: isOpen }),
  setDraftEmailToEdit: (email) => set({ draftEmailToEdit: email }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedEmail: (id) => {
    set({ selectedEmailId: id });
    if (id) {
      const email = get().emails.find(e => (e.id || e._id) === id);
      if (email && !email.isRead) {
        get().markEmailAsRead(id, true);
      }
    }
  },
  clearSelectedEmail: () => set({ selectedEmailId: null, selectedEmail: null, emailError: null }),
  clearError: () => set({ error: null, emailError: null }),

  fetchSearchHistory: async () => {
    set({ loadingHistory: true });
    try {
      const response = await emailService.getSearchHistory();
      set({ searchHistory: response.data });
    } catch (error) {
      console.error("Failed to load search history", error);
    } finally {
      set({ loadingHistory: false });
    }
  },

  clearSearchHistory: async () => {
    try {
      await emailService.clearSearchHistory();
      set({ searchHistory: [] });
    } catch (error) {
      console.error("Failed to clear search history", error);
      throw error;
    }
  },

  fetchSavedSearches: async () => {
    set({ loadingSavedSearches: true });
    try {
      const response = await emailService.getSavedSearches();
      set({ savedSearches: response.data });
    } catch (error) {
      console.error("Failed to load saved searches", error);
    } finally {
      set({ loadingSavedSearches: false });
    }
  },

  saveSearch: async (name: string, query: string) => {
    try {
      await emailService.saveSearch({ name, query });
      get().fetchSavedSearches();
      return true;
    } catch (error) {
      console.error("Failed to save search", error);
      throw error;
    }
  },

  renameSavedSearch: async (id: string, name: string) => {
    try {
      await emailService.renameSavedSearch(id, name);
      get().fetchSavedSearches();
      return true;
    } catch (error) {
      console.error("Failed to rename saved search", error);
      throw error;
    }
  },

  deleteSavedSearch: async (id: string) => {
    try {
      await emailService.deleteSavedSearch(id);
      get().fetchSavedSearches();
      return true;
    } catch (error) {
      console.error("Failed to delete saved search", error);
      throw error;
    }
  },

  fetchNotifications: async () => {
    set({ loadingNotifications: true });
    try {
      const response = await emailService.getNotifications();
      const notifications = response.data;
      const unreadCount = notifications.filter(n => !n.isRead).length;
      set({ notifications, unreadCount, loadingNotifications: false });
    } catch (error) {
      console.error("Failed to fetch notifications", error);
      set({ loadingNotifications: false });
    }
  },

  markNotificationRead: async (id: string) => {
    const { notifications, unreadCount } = get();
    const notification = notifications.find(n => n._id === id);
    
    if (notification && !notification.isRead) {
      // Optimistic update
      const newNotifications = notifications.map(n => 
        n._id === id ? { ...n, isRead: true } : n
      );
      set({ notifications: newNotifications, unreadCount: Math.max(0, unreadCount - 1) });
      
      try {
        await emailService.markNotificationRead(id);
      } catch (error) {
        console.error("Failed to mark notification read", error);
        // Revert on failure
        set({ notifications, unreadCount });
      }
    }
  },

  markAllNotificationsRead: async () => {
    const { notifications, unreadCount } = get();
    
    if (unreadCount > 0) {
      // Optimistic update
      const newNotifications = notifications.map(n => ({ ...n, isRead: true }));
      set({ notifications: newNotifications, unreadCount: 0 });
      
      try {
        await emailService.markAllNotificationsRead();
      } catch (error) {
        console.error("Failed to mark all notifications read", error);
        // Revert on failure
        set({ notifications, unreadCount });
        throw error;
      }
    }
  },

  deleteNotification: async (id: string) => {
    const { notifications, unreadCount } = get();
    const notification = notifications.find(n => n._id === id);
    
    if (notification) {
      // Optimistic update
      const newNotifications = notifications.filter(n => n._id !== id);
      const newUnreadCount = !notification.isRead ? Math.max(0, unreadCount - 1) : unreadCount;
      set({ notifications: newNotifications, unreadCount: newUnreadCount });
      
      try {
        await emailService.deleteNotification(id);
      } catch (error) {
        console.error("Failed to delete notification", error);
        // Revert on failure
        set({ notifications, unreadCount });
        throw error;
      }
    }
  }
}));
