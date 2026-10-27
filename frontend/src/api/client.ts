import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const isLoginAttempt = err.config?.url === "/auth/login";
    if (err.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    if (err.response?.status === 403 && err.response.data?.detail === "Password change required") {
      // e.g. an admin reset this user's password while they were signed in
      window.dispatchEvent(new Event("password-change-required"));
    }
    return Promise.reject(err);
  }
);

export default api;
