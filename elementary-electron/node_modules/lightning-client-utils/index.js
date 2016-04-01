
var _ = require('lodash');
var request = require('superagent');
var d3Color = require('d3-color');
var d3Scale = require('d3-scale');

var colorbrewer = require('colorbrewer')
var Color = require('color');
var r;

var utils = {

    preloadImages: function(urls) {
        _.each(urls, function(url) {
            utils.preloadImage(url);
        });
    },

    preloadImage: function(url) {
        var img=new Image();
        img.src=url;
    },

    randomColor: function() {
        return '#'+Math.floor(Math.random()*16777215).toString(16);
    },

    linspace: function(a, b, n) {
      var every = (b-a)/(n-1)
      var ranged = _.range(a, b, every);
      return ranged.length == n ? ranged : ranged.concat(b);
    },

    getThumbnail: function(image) {
        return image + '_small';
    },

    cleanImageURL: function(url) {
        if(url.indexOf('http') > -1) {
            return url;
        }

        return (window.lightning && window.lightning.host) ? window.lightning.host + url : url;
    },

    mapRange: function(value, istart, istop, ostart, ostop) {
        return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
    },

    getColors: function(n) {
        var colors = ['#A38EF3', '#7ABFEA', '#5BC69F', '#E96B88', '#F0E86B', '#C2B08C', '#F9B070', '#F19A9A', '#AADA90', '#DBB1F2'];

        var retColors = [];
        for(var i = 0; i<n; i++) {
            retColors.push(colors[ i % colors.length]);
        }

        return retColors;
    },

    getColorFromData: function(data) {

        // retrieve an array of colors from 'label' or 'color' fields of object data
        // returns an list of lists in the form [[r,g,b],[r,g,b]...]

        if(data.hasOwnProperty('label')) {

            // get bounds and number of labels
            label = data.label
            var mn = Math.min.apply(null, label);
            var mx = Math.max.apply(null, label);
            var n = mx - mn + 1
            var colors = this.getColors(n)

            // get an array of d3 colors
            retColor = label.map(function(d) {return d3Color.rgb(colors[d - mn])});

        } else if (data.hasOwnProperty('color')) {

            // get an array of d3 colors directly from r,g,b values
            color = data.color
            retColor = color.map(function(d) {return d3Color.rgb(d[0], d[1], d[2])})

        } else if (data.hasOwnProperty('value')) {

            value = data.value

            // get d3 colors from a linear scale
            var colormap = data.colormap ? data.colormap : "Purples"

            var ncolor = 9
            if (colormap == "Lightning") {
                var color = ['#A38EF3', '#DBB1F2', '#7ABFEA', '#5BC69F', '#AADA90', '#F0E86B', '#F9B070', '#F19A9A', '#E96B88']
            } else {
                var color = colorbrewer[colormap][ncolor]
            }
            
            // get min and max of value data
            var vmin = Math.min.apply(null, value);
            var vmax = Math.max.apply(null, value);

            // set up scales
            var domain = this.linspace(vmin, vmax, ncolor)
            var scale = d3Scale.linear().domain(domain).range(color);

            retColor = value.map(function(d) {return d3Color.rgb(scale(d))})

        } else {

            // otherwise return empty
            retColor = []
        }

        return retColor
    },

    buildRGBA: function(base, opacity) {
        var color = Color(base);
        color.alpha(opacity);
        return color.rgbString();
    }, 

    trackTransforms: function(ctx){

        var svg = document.createElementNS("http://www.w3.org/2000/svg",'svg');
        var xform = svg.createSVGMatrix();

        ctx.getTransform = function(){ return xform; };
        
        var savedTransforms = [];
        var save = ctx.save;
        ctx.save = function(){
            savedTransforms.push(xform.translate(0,0));
            return save.call(ctx);
        };
        var restore = ctx.restore;
        ctx.restore = function(){
            xform = savedTransforms.pop();
            return restore.call(ctx);
        };

        var scale = ctx.scale;
        ctx.scale = function(sx,sy){            
            var oldXForm = xform;
            xform = xform.scaleNonUniform(sx,sy);
            if(xform.d < 1) {
                xform = oldXForm;
                return;
            }

            return scale.call(ctx,sx,sy);
        };
        
        var rotate = ctx.rotate;
        ctx.rotate = function(radians){
            xform = xform.rotate(radians*180/Math.PI);
            return rotate.call(ctx,radians);
        };
        
        var translate = ctx.translate;
        ctx.translate = function(dx,dy){
            xform = xform.translate(dx,dy);
            return translate.call(ctx,dx,dy);
        };
        
        var transform = ctx.transform;
        ctx.transform = function(a,b,c,d,e,f){
            var m2 = svg.createSVGMatrix();
            m2.a=a; m2.b=b; m2.c=c; m2.d=d; m2.e=e; m2.f=f;
            xform = xform.multiply(m2);
            return transform.call(ctx,a,b,c,d,e,f);
        };

        var setTransform = ctx.setTransform;
        ctx.setTransform = function(a,b,c,d,e,f){
            xform.a = a;
            xform.b = b;
            xform.c = c;
            xform.d = d;
            xform.e = e;
            xform.f = f;
            return setTransform.call(ctx,a,b,c,d,e,f);
        };
        var pt  = svg.createSVGPoint();
        ctx.transformedPoint = function(x,y) {
            pt.x=x; pt.y=y;
            return pt.matrixTransform(xform.inverse());
        };
    },

    addCanvasZoomPanListeners: function(canvas, context, redraw) {
            
        var lastX= canvas.width / 2;
        var lastY = canvas.height / 2;
        var dragStart, dragged;

        canvas.addEventListener('mousedown',function(evt){
            lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
            lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
            dragStart = context.transformedPoint(lastX,lastY);
            dragged = false;
        }, false);

        canvas.addEventListener('mousemove',function(evt){
            lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
            lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
            dragged = true;
            if (dragStart){
                var pt = context.transformedPoint(lastX,lastY);
                context.translate(pt.x-dragStart.x,pt.y-dragStart.y);
                redraw();
            }
        },false);
        canvas.addEventListener('mouseup',function(evt){
            dragStart = null;
            if (!dragged) zoom(evt.shiftKey ? -1 : 1 );
        },false);

        var scaleFactor = 1.025;
        var zoom = function(clicks){
            var pt = context.transformedPoint(lastX,lastY);
            context.translate(pt.x, pt.y);
            var factor = Math.pow(scaleFactor,clicks);
            context.scale(factor,factor);
            context.translate(-pt.x, -pt.y);
            redraw();
        };

        var handleScroll = function(evt){
            var delta = evt.wheelDelta ? evt.wheelDelta/40 : evt.detail ? -evt.detail : 0;
            if (delta) zoom(delta);
            return evt.preventDefault() && false;
        };
        canvas.addEventListener('DOMMouseScroll',handleScroll,false);
        canvas.addEventListener('mousewheel',handleScroll,false);

    },


    isEditorOrPreview: function() {
        var url = document.URL;
        return /https?:\/\/[^\/]+\/visualization-types\/*/.test(url);
    },

    getId: function(viz) {
        var $el = viz.$el;
        if(!viz.$el) {
            $el = $(viz.selection);
        }
        return $el.closest('[data-model=visualization]').data('model-id');
    },

    getUrl: function(viz) {

        var vid = this.getId(viz);
        var host = '/';

        if(window.lightning && window.lightning.host) {
            host = window.lightning.host;
        }

        return host + 'visualizations/' + vid;
    },


    fetchData: function(viz, keys, cb) {

        if(!viz.$el) {
            console.warn('Must set .$el property on your visualization');
        }

        if(this.isEditorOrPreview()) {

            setTimeout(function() {
                var data = $('#data-editor').next('.CodeMirror').find('.CodeMirror-code span')[0].innerHTML;
                var fetchedData = JSON.parse(data);

                _.each(keys, function(key) {
                    fetchedData = fetchedData[key];
                });

                cb(null, fetchedData);

            }, 0);


        } else {

            var url = this.getUrl(viz);

            if(r) {
                r.abort();
            }

            r = request.get(url + '/data/' + keys.join('/') + '/', function(err, res) {

                if(err) {
                    return cb(err)
                }

                cb(null, (res.body || {}).data);
            });
        }
    },

    getSettings: function(viz, cb) {

        if(this.isEditorOrPreview()) {
            setTimeout(function() {
                cb(null, {});
            }, 0);

            return;
        }

        var url = this.getUrl(viz);

        r = request.get(url + '/settings/', function(err, res) {

            if(err) {
                return cb(err)
            }

            cb(null, (res.body || {}).settings);
        });
    },

    getUniqueId: function() {
        var s4 = function() {
            return Math.floor((1 + Math.random()) * 0x10000)
                       .toString(16)
                       .substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
    },

    updateSettings: function(viz, settings, cb) {

        if(this.isEditorOrPreview()) {
            setTimeout(function() {
                cb(null, settings);
            }, 0);

            return;
        }

        var url = this.getUrl(viz);

        r = request.post(url + '/settings/', settings, function(err, res) {

            if(err) {
                return cb(err)
            }

            cb(null, (res.body || {}).settings);
        });
    },

    getCommForViz: function(viz) {
        var m = (window.lightning || {}).comm_map;
        if(m) {
            return m[this.getId(viz)];
        }
    },

    sendCommMessage: function(viz, type, data) {
        var comm = this.getCommForViz(viz);
        if(comm) {
            comm.send(JSON.stringify({
                type: type,
                data: data
            }));
        }
    },

    nearestPoint: function(points, target, xscale, yscale) {
        // find point in points nearest to target
        // using scales x and y
        // point must have attrs x, y, and s
        var i = 0, count = 0;
        var found, dist, n, p;
        while (count == 0 & i < points.length) {
            p = points[i]
            dist = Math.sqrt(Math.pow(xscale(p.x) - target[0], 2) + Math.pow(yscale(p.y) - target[1], 2))
            if (dist <= p.s) {
                found = p
                count = 1
            }
            i++;
        }
        return found
    }

};


module.exports = utils;