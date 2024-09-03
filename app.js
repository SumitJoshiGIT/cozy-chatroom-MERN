
const express=require('express')
const {createServer} =require('http')
const cookieParser = require('cookie-parser')
const session=require('express-session')
const csrf=require('csurf');
const multer=require('multer');
const mongoStore=require('connect-mongo')
const authRouter=require('./routes/auth/auth')
const path=require('path');
const cors=require('cors');
require('dotenv').config()
//const passportSocketIo = require('passport.socketio');
const {Server}=require('socket.io');
const {onConnection,onDisconnection}=require('./routes/api/socketEvents');
const mongoose=require('mongoose')
const {passport}=require('./routes/auth/passportSetup');
const sharedsession = require('express-socket.io-session');
const app=express();
const server=createServer(app)
const io=new Server(server,{cors:{origin:"*"}});

const sessionMiddleware=session({
  secret:"somesecret",
  resave:false,
  saveUninitialized:true,
  store:mongoStore.create({mongoUrl:'mongodb://localhost:27017/ChatApp'}),
  cookie:{httpOnly:true,
           sameSite:true,
           secure:false,
           maxAge:3600000
         }}
)
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.text());

app.use(cors({ cors: { origin: "*" } }));
app.use(express.static(path.join(__dirname,'client','dist')));
app.use(express.static(path.join(__dirname,'public')))
app.use(cookieParser());


app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

io.use(sharedsession(sessionMiddleware,{autoSave:true}))

app.use(authRouter);

app.get('/ping',(req,res)=>res.send("pong"))
//app.use((req,res,next)=>{console.log(req);next()})

// app.use(csrf({
//   cookie:{
//   httpOnly:true,
//   sameSite:'Strict'},
//   value: (req) => req.headers['X-CSRF-Token'] || req.body._csrf || req.query._csrf
//   ,maxAge:3600000
// }));


io.on('connection',(socket)=>onConnection(socket,io));
io.on('disconnected',onDisconnection);

app.get('/',(req, res) => {
 console.log('user',req.user,req.isAuthenticated())
  return res.sendFile(path.join(__dirname, 'client','dist','index.html'));
});

console.log(process.env.DATABASE)

mongoose.connect(process.env.DATABASE).then(
  ()=>server.listen(3000,()=>{console.log('listening on port 3000')})
)
