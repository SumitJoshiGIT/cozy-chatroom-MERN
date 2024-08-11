
const express=require('express')
const {createServer} =require('http')
const cookieParser = require('cookie-parser')
const session=require('express-session')
const csrf=require('csurf');
const authRouter=require('./routes/auth/auth')
const path=require('path');
const cors=require('cors');
//const passportSocketIo = require('passport.socketio');
const {Server}=require('socket.io');
const {onConnection,onDisconnection}=require('./routes/api/socketEvents');
const mongoose=require('mongoose')

const app=express();
const server=createServer(app)
const io=new Server(server,{cors:{origin:"*"}});


app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.text());
app.use(cors());
app.use(express.static(path.join(__dirname,'client','dist')));
sessionMiddleware=session({
  secret:"somesecret",
  resave:false,
  saveUninitialized:true,
  cookie:{httpOnly:true,
           sameSite:true,
           secure:true,
           maxAge:3600000
         }}
)


app.use(sessionMiddleware)

app.use(cookieParser());
app.use(csrf({cookie:true}));
app.use(authRouter);

/*io.use(passportSocketIo.authorize({
  cookieParser: cookieParser,
  key: 'connect.sid', 
  secret: 'somesecret',
  store: sessionMiddleware,
  success: (data, accept) => {
    console.log("successful connection")
    accept();
  },
  fail: (data, message, error, accept) => {
    if (error) accept(new Error(message));
    console.log('failed connection to socket.io:', message);
    accept(null, false); 
  },
}));
*/

io.on('connection',(socket)=>onConnection(socket,io));
io.on('disconnected',onDisconnection);

app.get((req, res) => {
  res.sendFile(path.join(__dirname, 'client','dist','index.html'));
});

mongoose.connect("mongodb://localhost:27017/ChatApp").then(
  ()=>server.listen(3000,()=>{console.log('listening on port 3000')})
)
