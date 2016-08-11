var fancify = require(process.argv[2]);
var test = require('tape');

test('Test Fancify', function(t) {
  t.equal(fancify('Hello'), '~*~Hello~*~', 'Passes condition 1');
  t.equal(fancify('Hello', true), '~*~HELLO~*~', 'Passes condition 2');
  t.equal(fancify('Hello', false, '!'), '~!~Hello~!~', 'Passes condition 3');
  t.end();
})
