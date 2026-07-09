import { api } from './api';

export const authService = {
  login: async (data: Record<string, unknown>) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
  register: async (data: Record<string, unknown>) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  forgotPassword: async (data: Record<string, unknown>) => {
    const response = await api.post('/auth/forgot-password', data);
    return response.data;
  },
  resetPassword: async (data: Record<string, unknown>) => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },
  verifyMfa: async (data: Record<string, unknown>) => {
    const response = await api.post('/auth/mfa/verify', data);
    return response.data;
  }
};
