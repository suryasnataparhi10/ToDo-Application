import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = 'Bearer ' + t;
  return c;
});
api.interceptors.response.use(
  (r) => r.data.data,
  (e) => Promise.reject(e.response?.data?.message || 'Network error, is the server running?'),
);
export default api;
