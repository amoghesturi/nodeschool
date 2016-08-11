/*
 -- It cannot be set by assignment during execution
 -- It may be different each time the function is called.
 */

// GLOBAL EXECUTION CONTEXT - outside any function (strict or not)


// FUNCTION CONTEXT -
// Inside a function, the value of this depends upon how the functio is called
// (1) Simple Function


var o = {
  f: () => {
    return this.a + this.b;
  }
};
var p = Object.create(o);
p.a = 1;
p.b = 4;

console.log(p.f());


/**
*
*/
var o = function() {
  return this.a
}
