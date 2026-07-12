import axios from 'axios';
import { getAccessToken, setAccessToken, clearTokens } from './auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// URLs that should never trigger token refresh
const NO_REFRESH_URLS = ['/auth/refresh', '/auth/siakad-login', '/auth/github-callback'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't attempt refresh if:
    // - Not a 401 error
    // - Already retried this request
    // - The request is an auth endpoint itself
    // - No access token exists (user never logged in)
    const isAuthEndpoint = NO_REFRESH_URLS.some((url) => originalRequest.url?.includes(url));
    const hasToken = !!getAccessToken();

    if (error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint || !hasToken) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || '/api'}/auth/refresh`,
        {},
        { withCredentials: true }
      );
      const newToken = data.data?.access_token;
      if (newToken) {
        setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
      throw new Error('No token in refresh response');
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearTokens();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
