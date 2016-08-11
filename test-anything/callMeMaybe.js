var repeatCallback = require(process.argv[2]);
var test = require('tape');

test('Test repeatCallback', function(t) {
  var n = 5;
  t.plan(n);
  repeatCallback(n, function() {
    t.pass('callback called');
  })
  t.end();
})
