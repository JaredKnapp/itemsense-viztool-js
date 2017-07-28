/**
 * Created by ralemy on 11/22/15.
 * Module to visualize an item on stage
 */

"use strict";

module.exports = (function (app) {

    app.factory("ItemModel", ["StageMetrics", function (stageMetrics) {
        return function (ref, stage) {
            var xKey=ref.x === undefined ? "xLocation" : "x",
                yKey=ref.y === undefined ? "yLocation" : "y";
            return stageMetrics(ref, stage,xKey,yKey);
        };
    }]).factory("Item", ["CreateJS", "ItemModel", "$q", function (createjs, ItemModel, $q) {
        return function (ref, stage, hashColor) {
            var shape = new createjs.Shape(),
                ease = stage.project.moveAnimation === "ease" ? createjs.Ease.sineOut : null,
		tweenRate = stage.project.moveAnimation === "ease" ? 1500 : 250,
                zoomHandler = null,
                tweenPromise = null,
                color = hashColor || "gray",
                model = ItemModel(ref, stage),
                wrapper = Object.create({
                    destroy: function (update) {
                        if (zoomHandler)
                            stage.off("Zoom", zoomHandler);
                        stage.removeChild(shape);
                        if (update)
                            stage.update();
                        zoomHandler = null;
                    },
                    _tween: function (i) {
                        var defer = $q.defer();
                        if (i.selected !== model.selected)
                            this.draw();
                        model.selected = i.selected;
                        model.lastModifiedTime = i.lastModifiedTime;
                        model.x = i.x || i.xLocation;
                        model.y = i.y || i.yLocation;
                        model.presenceConfidence = i.presenceConfidence;
                        model.zone = i.zone;
                        if (model._x === shape.x)
                            if (model._y === shape.y)
                                    defer.resolve();
                        stage.activeTweens += 1;
                        createjs.Tween.get(shape).to({x: model._x, y: model._y}, tweenRate, ease).call(function () {
                            stage.activeTweens -= 1;
                            defer.resolve();
                        });
                        return defer.promise;
                    },
                    tween: function (i) {
                        if (tweenPromise)
                            tweenPromise = tweenPromise.then(function () {
                                return wrapper._tween(i);
                            });
                        else
                            tweenPromise = wrapper._tween(i);
                    },
                    draw: function (update) {
                        var c = model.activated ? "red" : color;
                        shape.graphics.clear().s("black").ss(1, null, null, null, true)
                            .f(c).dc(0, 0, stage.screenToCanvas(5));
                        shape.x = model._x;
                        shape.y = model._y;
                        if (update)
                            stage.update();
                    },
                    activate: function (noDispatch) {
                        model.activated = true;
                        this.draw(true);
                        if (!noDispatch)
                            stage.dispatchEvent(new createjs.Event("newItem").set({item: wrapper}));
                    },
                    deactivate: function () {
                        model.activated = false;
                        this.draw(true);
                    }
                }, {
                    model: {
                        get: function () {
                            return model;
                        }
                    }
                });
            shape.name = "Item";
            stage.addChild(shape);
            zoomHandler = stage.on("Zoom", function () {
                wrapper.draw();
            });
            shape.on("mousedown", function (ev) {
                wrapper.activate();
                stage.scope.$apply();
                ev.preventDefault();
                ev.stopPropagation();
            });
            wrapper.draw();
            return wrapper;
        };
    }])
        .factory("TimeLapseColor",[function(){
            var colors=[
                "rgba(0,0,64,1)",
                "rgba(0,0,128,1)",
                "rgba(0,0,192,1)",
                "rgba(0,0,255,1)",
                "rgba(0,64,255,1)",
                "rgba(0,128,255,1)",
                "rgba(0,192,255,1)",
                "rgba(0,255,255,1)",
                "rgba(0,255,192,1)",
                "rgba(0,255,128,1)",
                "rgba(0,255,64,1)",
                "rgba(0,255,0,1)",
                "rgba(64,255,0,1)",
                "rgba(128,255,0,1)",
                "rgba(192,255,0,1)",
                "rgba(255,255,0,1)",
                "rgba(255,192,0,1)",
                "rgba(255,128,0,1)",
                "rgba(255,64,0,1)",
                "rgba(255,0,0,1)"
            ];
            return function(value){
                return colors[Math.min(value,colors.length)-1];
            };
        }])
        .factory("TimeLapse",["TimeLapseColor","CreateJS","_",function(timeLapseColor,createjs,_){
            return function(){
                var shape=new createjs.Shape(),
                    zoomHandler = null,
                    stage= null,
                    wrapper=Object.create({
                        destroy: function (update) {
                            if (zoomHandler)
                                stage.off("Zoom", zoomHandler);
                            stage.removeChild(shape);
                            if (update)
                                stage.update();
                            zoomHandler = null;
                        },
                        clear:function(update){
                            shape.graphics.clear();
                            if (update)
                                stage.update();
                        },
                        draw: function (ref,update) {
                            var g = shape.graphics.clear(),
                                lastX=null,
                                lastY=null;
                            _.each((ref||[]).reverse(),function(point){
                                var x = stage.metersToStage(point.x,"x"),
                                    y =stage.metersToStage(point.y,"y");
                                if(lastX)
                                    g.s("black").ss(1,null,null,null,true).mt(lastX,lastY).lt(x,y);
                                g.f(timeLapseColor(point.value)).dc(x,y,stage.screenToCanvas(5+point.value));
                                lastX = x;
                                lastY = y;
                            });
                            if (update)
                                stage.update();
                        },
                        init:function(stg){
                            stage = stg;
                            shape.name="TimeLapse";
                            stage.addChild(shape);
                            zoomHandler = stage.on("Zoom", function () {
                                wrapper.draw();
                            });
                            wrapper.draw();
                        }
                    },{
                        shape:{
                            get:function(){
                                return shape;
                            }
                        }
                    });
                return wrapper;
            };
        }]);
})(angular.module(window.mainApp));
