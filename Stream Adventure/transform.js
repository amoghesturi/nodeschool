var through = require('through2');
process.stdin.pipe(through(write, end)).pipe(process.stdout);

function write(buffer, encoding, next) {
  this.push(buffer.toString().toUpperCase());
  next();
}

function end(done) {
  done();
}
