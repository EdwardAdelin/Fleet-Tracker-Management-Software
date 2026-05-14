import axios from 'axios';

const axiosClient = axios.create({
  // baseURL: 'http://localhost:5000/api',
  // pentru telefon
  baseURL: 'http://192.168.1.129:5000/api', // varianta pentru telefon cu localhost
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;
