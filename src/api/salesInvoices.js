import axios from './axios';

export const getSalesInvoices = (page = 1, filters = {}) =>
	axios.get('/store/sales-invoices', {
		params: {
			page,
			per_page: 10,
			...filters,
		},
	});
export const createSalesInvoice = (data) => axios.post('/store/sales-invoices', data);
export const getSalesInvoice = (id) => axios.get(`/store/sales-invoices/${id}`);
export const cancelSalesInvoice = (id, data) => axios.post(`/store/sales-invoices/${id}/cancel`, data);
