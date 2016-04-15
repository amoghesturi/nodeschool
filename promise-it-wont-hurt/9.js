'use strict';

function parsePromised(json) {
  return new Promise( function(fulfill, reject) {
    try {
      fulfill(JSON.parse(json));
    }
    catch(exception) {
      reject(exception)
    }
  });
};

parsePromised(process.argv[2]).then(null, console.log);
