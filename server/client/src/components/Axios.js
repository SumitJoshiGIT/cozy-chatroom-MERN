const origin="http://localhost"
import axios from 'axios';
 
export async function post(endpoint,body){
    const config={method: 'post',
    url:'https://localhost:3000'+endpoint,
    data: body,
   }
    try {return (await axios(config)).data;}
    catch (err){return {error:err}} 
}

export async function get(endpoint,params){
    const config={method: 'get',
    url:origin+endpoint,
    headers: {
      'Content-Type': 'application/json'
    },
    params:params
   }
    try {return (await axios(config)).data;}
    catch (err){return {error:err}} 
}
