'use strict';

function alwaysThrows() {
  throw new Error("OH NOES");
}

function iterate(int) {
  console.log(int);
  return ++int;
}


Promise.resolve(iterate(1))
.then(iterate)
.then(iterate)
.then(iterate)
.then(iterate)
.then(alwaysThrows)
.then(iterate)
.then(iterate)
.then(iterate)
.then(iterate)
.catch(console.log)
