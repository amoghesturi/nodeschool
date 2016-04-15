'use strict';

var HTTP = require('q-io/http');

HTTP.read('http://localhost:1337').then(function(res) {
  res = JSON.parse(res.toString());
  console.log(res);
}).catch(function(err) {
  console.log('***ERROR***');
  console.log(err);
})
