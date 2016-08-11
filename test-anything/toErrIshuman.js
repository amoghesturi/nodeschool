var feedCat = require(process.argv[2]);
var test = require('tape');

test('Chocolate is bad', function (t) {
  t.plan(2);
  t.equal(feedCat('food'), 'yum', 'food is ok');
  t.throws(feedCat.bind(null, 'chocolate'));
})
