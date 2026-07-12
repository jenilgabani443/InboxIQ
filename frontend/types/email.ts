export interface EmailUser {
  userId?: string;
  email: string;
  name: string;
}

export interface EmailLabel {
  _id: string;
  name: string;
  color: string;
}

export interface EmailAttachment {
  _id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export interface SearchHistoryItem {
  query: string;
  searchedAt: string;
}

export interface SavedSearch {
  _id: string;
  name: string;
  query: string;
  createdAt: string;
  updatedAt: string;
}

export interface Email {
  id: string;
  _id?: string;
  threadId: string;
  from: EmailUser;
  to: EmailUser[];
  cc?: EmailUser[];
  bcc?: EmailUser[];
  subject: string;
  snippet: string;
  bodyHtml?: string;
  bodyText?: string;
  isRead: boolean;
  isStarred: boolean;
  folder: string;
  labels?: EmailLabel[];
  attachments?: EmailAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginationMeta;
}

export interface AppNotification {
  _id: string;
  type: string;
  referenceId?: string;
  referenceModel?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}
