'use strict';

const EventEmitter = require('events');
const util = require('util');

/**
* Node style inheritance
function MyEmitter() {
  EventEmitter.call(this);
}
// util.inherits(c, sc) method inherits all the prototype methods of sc to c
*/

class MyEmitter extends EventEmitter{}; // JS ES6 style inheritance

const myEmitter = new MyEmitter();
// newListener event
myEmitter.once('newListener', (event, listener) => {

})
// called when an event occurs
myEmitter.on('event', (a,b) => {
  console.log(a);
  console.log(b);
});

// Emit the event
myEmitter.emit('event', 'a', 'b');
