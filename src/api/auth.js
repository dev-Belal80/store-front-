import axios from './axios';

export const loginApi = (data) => axios.post('/auth/login', data);

export const logoutApi = () => axios.post('/store/logout');