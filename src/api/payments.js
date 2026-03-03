import axios from './axios';

export const createCustomerPayment = (data) => axios.post('/store/payments/customer', data);
export const createSupplierPayment = (data) => axios.post('/store/payments/supplier', data);