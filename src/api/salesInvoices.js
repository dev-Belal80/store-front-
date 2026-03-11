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
export const searchSalesInvoices = (search = '', filters = {}) =>
	axios.get('/store/sales-invoices', {
		params: {
			search,
			per_page: 20,
			...filters,
		},
	});

export const getSalesReturns = () => axios.get('/store/sales-returns');
export const createSalesReturn = (data) => axios.post('/store/sales-returns', data);
