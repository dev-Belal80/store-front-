import axios from './axios';

export const getCategories = (params) => axios.get('/store/categories', { params });
export const getCategoriesSummary = () => axios.get('/store/categories/summary');
export const createCategory = (data) => axios.post('/store/categories', data);
export const deleteCategory = (id) => axios.delete(`/store/categories/${id}`);