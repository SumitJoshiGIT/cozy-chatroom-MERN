import axios from 'axios';

const origin = f`${window.location.origin}:3000`;

async function fetchCsrfToken() {
  try {
    const response = await axios.get(`${origin}/auth/token`);
    return response.data.token;
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    throw error; 
  }
}

export async function post(endpoint, body) {
  console.log(body,'p')
  const csrfToken = await fetchCsrfToken(); 
    
  const config = {
    method: 'post',
    url: `${origin}${endpoint}`,
    data: body,
    headers: {
      'X-CSRF-Token': csrfToken,
    },
    withCredentials: true
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error making POST request:", error);
    return { error: error.message || 'An error occurred' };
  }
}


export async function get(endpoint, params) {
  const config = {
    method: 'get',
    url: `${origin}${endpoint}`,
    
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    },
    params: params
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error making GET request:", error);
    return { error: error.message || 'An error occurred' };
  }
}
