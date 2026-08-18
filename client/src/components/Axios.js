import axios from 'axios';
import { apiOrigin } from '../apiOrigin';

export async function post(endpoint, body) {
  try {
    const response = await axios.post(`${apiOrigin}${endpoint}`, body, { withCredentials: true });
    return response.data;
  } catch (error) {
    console.error("Error making POST request:", error);
    return error.response ? error.response.data : { status: false, message: 'Network error' };
  }
}

export async function get(endpoint, params) {
  try {
    const response = await axios.get(`${apiOrigin}${endpoint}`, { withCredentials: true, params });
    return response.data;
  } catch (error) {
    console.error("Error making GET request:", error);
    return error.response ? error.response.data : { status: false, message: 'Network error' };
  }
}
