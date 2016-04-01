var _ = require('lodash');
var insertCSS = require('insert-css');
var inherits = require('inherits');
var qwery = require('qwery');

var LightningVisualization = function(selector, data, images, options) {

    this.options = _.defaults(options || {}, this.getDefaultOptions());
    this.styles = this.getDefaultStyles();
    this.qwery = qwery;
    this.el = qwery(selector)[0];
    this.width = (this.options.width || this.el.offsetWidth);
    this.height = (this.options.height || (this.getHeight ? this.getHeight() : this.width * 0.6));
    
    this.data = this.formatData(data || {});
    this.images = images || [];

    this.selector = selector;
    this.init();
};

inherits(LightningVisualization, require('events').EventEmitter);

LightningVisualization.prototype.getDefaultOptions = function() {
    return {};
}

LightningVisualization.prototype.getDefaultStyles = function() {
    return {};
}

LightningVisualization.prototype.init = function() {
    console.warn('init not implemented');
}

/*
 * Take the provided data and return it in whatever data format is needed
 */
LightningVisualization.prototype.formatData = function(data) {
    console.warn('formatData not implemented');
    return data;
}

/*
 * Optional function, use this if you want to users to send updated data to this plot
 */
LightningVisualization.prototype.updateData = function(data) {
    console.warn('updateData not implemented');
}

/*
 * Optional function, use this if you want to enable streaming updates to this plot
 */
LightningVisualization.prototype.appendData = function(data) {
    console.warn('appendData not implemented');
}


// Modified from backbone.js
LightningVisualization.extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // Wrap these functions so that the user can assume
    // the data has already been formatted by the time
    // it gets here.
    var wrapFuncs = ['appendData', 'updateData'];
    _.each(wrapFuncs, function(d) {
        if(protoProps[d]) {
            var fn = protoProps[d];
            protoProps[d] = function(data) {
                var d = this.formatData(data);
                return fn.call(this, d);
            };
        }
    });

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
        child = protoProps.constructor;
    } else {
        child = function(){
            if(this.css && !child._stylesInitialized) {
                insertCSS(this.css);
                child._stylesInitialized = true;
            }
            return parent.apply(this, arguments);
        };
        child._initializedStyles = false;
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent` constructor function.
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
};


module.exports = LightningVisualization;

