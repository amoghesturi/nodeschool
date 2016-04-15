'use strict';

var promise = Promise.resolve('FULFILLED!!');
var rejectedPromise = Promise.reject(new Error('REJECTED!!'))

promise.then(console.log);

rejectedPromise.catch(function(err) {
  console.log(err.message);
})
