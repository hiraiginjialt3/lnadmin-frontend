const isProduction = process.env.NODE_ENV === 'production';

const BACKEND_URL = isProduction 
  ? 'https://ln-backend-wegm.onrender.com'
  : 'http://localhost:5000';

export const API_BASE_URL = `${BACKEND_URL}/api`;

export default { API_BASE_URL };