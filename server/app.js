
const express=require('express')
const {createServer} =require('http')
const cookieParser = require('cookie-parser')
const session=require('express-session')
const csrf=require('csurf');
const multer=require('multer');
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

const storage=multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const fileFilter=(req,file,cb)=>{
  const allowedTypes=/jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if(mimetype && extname)cb(null, true)
  else cb(new Error('Invalid file type. Only.jpeg,.jpg,.png,.gif,.webp are allowed'),false)
}

const uploader=multer({
  storage,fileFilter,
  limits:{fileSize:5*1024*1024}
})

app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.text());

app.use(cors({ cors: { origin: "*" } }));
app.use(express.static(path.join(__dirname,'client','dist')));
app.use(express.static(path.join(__dirname,'public')))
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

io.on('connection',(socket)=>onConnection(socket,io));
io.on('disconnected',onDisconnection);

app.get('/ping',(req, res) =>{res.send({'ping':true})})
app.post('/updateProfilePic',uploader.single('file'),(req, res) =>{
    console.log(req)    
     if(!req.file)return res.status(404).send({error:'Please upload a file'})
     else res.send.status(200).send({success: true})
})

app.get('/',(req, res) => {
  res.sendFile(path.join(__dirname, 'client','dist','index.html'));
});
app.use(authRouter);


mongoose.connect("mongodb://localhost:27017/ChatApp").then(
  ()=>server.listen(3000,()=>{console.log('listening on port 3000')})
)
