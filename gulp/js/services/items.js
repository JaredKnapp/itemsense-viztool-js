/**
 * Created by ralemy on 11/22/15.
 * Module to visualize an item on stage
 */

"use strict";

module.exports = (function (app) {
    app.factory("ItemModel", ["StageMetrics", function (stageMetrics) {
        return function (ref, stage) {
            ref.x=ref.x || ref.xLocation;
            ref.y= ref.y || ref.yLocation;
            return stageMetrics(ref, stage);
        };
    }]).factory("Item", ["CreateJS", "ItemModel", "$q", function (createjs, ItemModel, $q) {
        return function (ref, stage, hash) {
            var shape = new createjs.Shape(),
                ease = createjs.Ease.sineOut,
                zoomHandler = null,
                tweenPromise = null,
                color = hash ? hash.Color || "gray" : "gray",
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
                        if (model._x === shape.x)
                            if (model._y === shape.y)
                                    defer.resolve();
                        stage.activeTweens += 1;
                        createjs.Tween.get(shape).to({x: model._x, y: model._y}, 1500, ease).call(function () {
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
                ev.preventDefault();
                ev.stopPropagation();
            });
            wrapper.draw();
            return wrapper;
        };
    }]);
})(angular.module(window.mainApp));
