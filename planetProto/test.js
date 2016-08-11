var child = {
  type: 'Child'
};
var parent = {
  type: 'Parent'
}
child.__proto__ = parent;
console.log(child.type);
