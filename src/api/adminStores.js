import axios from './axios';

export const getAdminStores = () => axios.get('/admin/stores');
export const activateAdminStore = (id) => axios.post(`/admin/stores/${id}/activate`);
export const deactivateAdminStore = (id) => axios.post(`/admin/stores/${id}/deactivate`);
export const createAdminStore = (data) => axios.post('/admin/stores', data);
