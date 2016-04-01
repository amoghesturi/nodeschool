'use strict';

var LightningVisualization = require('lightning-visualization');
var utils = require('lightning-client-utils');
var _ = require('lodash');
var $ = require('jquery');
var L;

var fs = require('fs');
var css = fs.readFileSync(__dirname + '/style.css');
var template = _.template(fs.readFileSync(__dirname + '/templates/index.html'));

/*
 * Extend the base visualization object
 */
var Visualization = LightningVisualization.extend({

    css: css,

    init: function() {

        // wait until domready to require leaflet
        L = require('leaflet');

        this.identifier = utils.getUniqueId();
        var markup = template({identifier: this.identifier});
        this.$el = $(this.selector).first();
        this.$el.append(markup);
        this.render();
    },

    render: function() {
        this.img = new Image();
        this.img.onload = this.onImageLoad.bind(this);
        this.img.src = utils.cleanImageURL(this.images[0]);
    },

    onImageLoad: function() {

        var maxWidth = this.width;

        // get image dimensions
        var imw = this.img.width;
        var imh = this.img.height;

        // use image dimensions to set css
        var w = maxWidth,
            h = maxWidth * (imh / imw);

        this.$el.find('#image-map-' + this.identifier).width(w).height(h);

        //create the map
        if(this.map) {
            this.map.remove();    
        }
        this.map = L.map('image-map-' + this.identifier, {
            minZoom: 1,
            maxZoom: 8,
            center: [w/2, h/2],
            zoom: 1,
            attributionControl: false,
            zoomControl: false,
            crs: L.CRS.Simple,
        });
        
        var map = this.map;
             
        // calculate the edges of the image, in coordinate space
        var southWest = map.unproject([0, h], 1);
        var northEast = map.unproject([w, 0], 1);
        var bounds = new L.LatLngBounds(southWest, northEast);
         
        // add the image overlay to cover the map
        L.imageOverlay(this.img.src, bounds).addTo(map);
         
        // tell leaflet that the map is exactly as big as the image
        map.setMaxBounds(bounds);


    },

    formatData: function(data) {
        return data;
    },

    setImage: function(image) {
        this.img.src = image;
    },

    updateData: function(image) {
        this.setImage(image);
    }

});


module.exports = Visualization;
