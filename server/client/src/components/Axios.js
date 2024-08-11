const origin="http://localhost"
const axios=require('axios');
 
async function post(endpoint,body){
    const config={method: 'post',
    url:origin+endpoint,
    data: body,
    headers: {
      'Content-Type': 'application/json'
    }
   }
    try {return (await axios(config)).data;}
    catch (err){return {error:err}} 
}

async function get(endpoint,params){
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

options=null;
module.exports={post,get}