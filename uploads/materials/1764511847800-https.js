
const http = require('http');
const { add , sub} = require('./modules.js');
const app = http.createServer((req,res)=>
{
      res.writeHead(200,{'content-type':'text/plain'})
      res.write('This is my first node js program by using https modules');
     
      let a=4
      let b= 10
      let adda= add(a,b);
      res.write(`the addition of two numbers ${a} and ${b} is ${adda}`)
       res.end()
})
app.listen(3001,()=>
{
      console.log('server is running at http://localhost:3001');
})