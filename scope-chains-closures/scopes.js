function foo() {
  var bar = 100;
  function zip() {
    console.log(bar++)
  }
  return zip;
}

var zip = foo();
zip();
zip();
zip();
