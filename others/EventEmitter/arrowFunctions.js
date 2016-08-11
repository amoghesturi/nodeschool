function foo() {
  var f = (i) => arguments[0]+i; // foo's implicit arguments binding
  return f(2);
}

console.log(foo(1)); // 3



/**
* Two reasons : (1) consise format to define functions
* (2) lexical binding of 'this'. i.e this keyword inside the arrow function
* refers to the this object of the parent.
*/
