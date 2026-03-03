import axios from './axios';

export const getCustomers = (page = 1, filters = {}) =>
	axios.get('/store/customers', {
		params: {
			page,
			per_page: 10,
			...filters,
		},
	});
export const createCustomer = (data) => axios.post('/store/customers', data);
export const updateCustomer = (id, data) => axios.put(`/store/customers/${id}`, data);
export const deleteCustomer = (id) => axios.delete(`/store/customers/${id}`);
export const getStatement = (id, params) => axios.get(`/store/customers/${id}/statement`, { params });
export const searchCustomers = (search = '') =>
	axios.get('/store/customers', {
		params: {
			search,
			per_page: 20,
		},
	});