import { create } from 'zustand';

const getStoredUser = () => {
  try {
    const rawUser = localStorage.getItem('auth_user');
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('auth_token'),
  user: getStoredUser(),

  login: (token, user) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    set({ token: null, user: null });
    window.location.href = '/login';
  },
}));