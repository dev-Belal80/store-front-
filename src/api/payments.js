import axios from './axios';

export const createCustomerPayment = (data) => axios.post('/store/payments/customer', data);
export const createSupplierPayment = (data) => axios.post('/store/payments/supplier', data);
export const updatePayment = (id, data) => axios.put(`/store/payments/${id}`, data);
export const deletePayment = (id) => axios.delete(`/store/payments/${id}`);
export const getCustomerPayments = (customerId, params = {}) =>
	axios.get(`/store/payments/customers/${customerId}`, { params });
export const getSupplierPayments = (supplierId, params = {}) =>
	axios.get(`/store/payments/suppliers/${supplierId}`, { params });
export const getAllCustomerPayments = (params = {}) => axios.get('/store/payments/customers', { params });
export const getAllSupplierPayments = (params = {}) => axios.get('/store/payments/suppliers', { params });