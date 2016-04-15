'use strict';

var HTTP = require('q-io/http');

HTTP.read('http://localhost:7000')
.then(function(userId) {
  return HTTP.read('http://localhost:7001/'+userId);
})
.then(function(user) {
  console.log(JSON.parse(user.toString()));
})
.catch(console.error);
