var bunyan = require('bunyan');
var path = require('path');

module.exports.log = bunyan.createLogger({
  name: 'ws_iCloset',
  streams: [
    {
      stream: process.stdout,
      level: 'debug'
    },
    {
      type: 'file',
      path: path.join(__dirname, '../Logs/ws_icloset_errors.log'),
      level: 'error'
    },
    {
      type: 'file',
      path: path.join(__dirname, '../Logs/ws_icloset_verbose.log'),
      level: 'trace'
    }
  ],
  serializers: {
    req: bunyan.stdSerializers.req,
    res: bunyan.stdSerializers.res
  },
});
