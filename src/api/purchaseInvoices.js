import axios from './axios';

export const getPurchaseInvoices = (page = 1, filters = {}) =>
	axios.get('/store/purchase-invoices', {
		params: {
			page,
			per_page: 10,
			...filters,
		},
	});
export const createPurchaseInvoice = (data) => axios.post('/store/purchase-invoices', data);
export const getPurchaseInvoice = (id) => axios.get(`/store/purchase-invoices/${id}`);
export const cancelPurchaseInvoice = (id, data) => axios.post(`/store/purchase-invoices/${id}/cancel`, data);
export const uploadPurchaseInvoiceAttachment = (id, formData, config = {}) =>
	axios.post(`/store/purchase-invoices/${id}/attachment`, formData, {
		headers: {
			'Content-Type': 'multipart/form-data',
			...(config?.headers || {}),
		},
		...config,
	});
export const deletePurchaseInvoiceAttachment = (id) => axios.delete(`/store/purchase-invoices/${id}/attachment`);