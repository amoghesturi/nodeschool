var pg = require('pg');
var conString = require('../../Configuration/Postgresconfig').conString;
var log = require('../../Configuration/BunyanConfig').log; // global variable - logging

// This module is called whenever a database query needs to be executed.
// Input --
// query - The String containing the query that needs to be executed.
// variables - An array of query parameters.
// finalCallback - The callback function that needs to be run after the query
// execution is complete.
module.exports = function(query, variables, finalCallback, index) {
  var bindVariables = {
    query : query,
    variables : variables,
    index : index,
    finalCallback : finalCallback
  }
  // log.info('QueryExecute - Establishing a connection to the database');
  log.info('....');
  // The pg module is said contain a connection pool which manages database
  // connections
  var result = pg.connect(conString,
    establisgPgConnectionCallback.bind(bindVariables));
}

// This function runs when the connection to database is either success or not
function establisgPgConnectionCallback(err, client, done) {
  var bindFunctions = {
    index : this.index,
    done : done,
    finalCallback : this.finalCallback
  }
  if (err) {
    log.error('QueryExecute - Error establishing connection with the database..'
     + err);
  }
  else {
    // If there is no error establishing connection,
    // log.info('QueryExecute - Connection successful. Sending the query.')
    client.query(this.query, this.variables,
      executeQueryCallback.bind(bindFunctions) );
  }
}

// This function is called fter running each query
function executeQueryCallback(err, result) {
  this.done();
  var result  = {
    error : err,
    result : result
  };
  if (err) {
    log.error('QueryExecute - Error while executing query.. ' + err);
  }
  // log.info('QueryExecute - Returning query result.');
  if(this.index || this.index == 0) {
    this.finalCallback(result, this.index);
  }
  else {
    // The result is null or undefined when the query returned errror
    this.finalCallback(result);
  }
}
