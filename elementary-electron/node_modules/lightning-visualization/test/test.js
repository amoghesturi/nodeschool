/* global describe, it */
'use strict';

var expect = require('expect.js');
var Viz = require('..');

describe('line-viz', function(){

    before(function () {
        document.createElement('div');
    });

    it('renders with data', function(){
        var CustomViz = Viz.extend({

            formatData: function(data) {
                return data;
            },

            init: function() {
            }
        })

        var viz = new CustomViz('div');
        expect(viz).to.be.a(CustomViz);
    });

    it('inserts css', function(){
        var CSSViz = Viz.extend({
            css: '.my-css {}',
            formatData: function(data) {
                return data;
            },
            init: function() {
            }
        });

        var viz = new CSSViz('div');
        expect(viz).to.be.a(CSSViz);
        expect(document.head.innerHTML.indexOf('.my-css')).to.be.greaterThan(-1);
    });

    it('only inserts css once', function(){
        var CSSViz = Viz.extend({
            css: '.my-css {}',
            formatData: function(data) {
                return data;
            },
            init: function() {
            }
        });

        var viz = new CSSViz('div');
        viz = new CSSViz('div');
        expect(viz).to.be.a(CSSViz);
        var headHTML = document.head.innerHTML;
        var count = headHTML.split('.my-css').length - 1;
        expect(count).to.be(1);
    });

    it('inserts css for differnt viz typse', function(){
        var CSSViz = Viz.extend({
            css: '.my-css {}',
            formatData: function(data) {
                return data;
            },
            init: function() {
            }
        });

        var SecondCSSViz = CSSViz.extend({
            css: '.second-css {}'
        });

        var viz = new CSSViz('div');
        viz = new SecondCSSViz('div');
        expect(viz).to.be.a(SecondCSSViz);
        var headHTML = document.head.innerHTML;
        var count = headHTML.split('.my-css').length - 1;
        expect(count).to.be(1);
        count = headHTML.split('.second-css').length - 1;
        expect(count).to.be(1);
    });

});
