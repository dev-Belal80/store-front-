import axios from './axios';

export const getCashBalance = () => axios.get('/store/cash/balance');
export const getCashDailyReport = (params) => axios.get('/store/cash/daily-report', { params });
export const setOpeningBalance = (data) => axios.post('/store/cash/opening-balance', data);