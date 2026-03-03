import axios from './axios';

export const getSuppliers = (page = 1, filters = {}) =>
	axios.get('/store/suppliers', {
		params: {
			page,
			per_page: 10,
			...filters,
		},
	});
export const createSupplier = (data) => axios.post('/store/suppliers', data);
export const updateSupplier = (id, data) => axios.put(`/store/suppliers/${id}`, data);
export const deleteSupplier = (id) => axios.delete(`/store/suppliers/${id}`);
export const getStatement = (id, params) => axios.get(`/store/suppliers/${id}/statement`, { params });