// Configuration file for frontend API requests
export const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:6032"
  : `http://${window.location.hostname}:6032`;
