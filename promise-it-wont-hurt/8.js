'use strict';

function attachTitle(name) {
  return 'DR. ' + name;
}

var fulfilledPromise = Promise.resolve('MANHATTAN').then(attachTitle).then(console.log)
