import axios from './axios';

export const getInventory = (filters = {}) =>
	axios.get('/store/inventory', {
		params: {
			...filters,
		},
	});

export const getInventoryDeficits = (filters = {}) =>
	axios.get('/store/inventory/deficits', {
		params: {
			...filters,
		},
	});
