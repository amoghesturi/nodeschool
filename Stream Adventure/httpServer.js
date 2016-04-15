var through = require('through2');
var http = require('http');

http.createServer(function (request, response) {
  if(request.method == 'POST') {
    request.pipe(through(write)).pipe(response);
  }
}).listen(process.argv[2]);


function write(buffer, _, next) {
  this.push(buffer.toString().toUpperCase());
  next();
}
