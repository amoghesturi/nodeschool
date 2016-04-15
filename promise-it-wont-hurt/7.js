'use strict';

first().then(function(val) {
  return second(val);
}).then(console.log);
