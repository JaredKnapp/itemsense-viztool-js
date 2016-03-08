/**
 * Created by ralemy on 11/15/15.
 * Handles the cartesian origin of plan
 */

"use strict";

module.exports = (function (app) {
    app.factory("Origin", ["CreateJS", function (createjs) {
        var shape = new createjs.Shape(), stage = null, zoomHandler = null;
        shape.name = "Origin";
        return Object.create({
            draw: function () {
                var o = this.stage.originBox,
                    r = this.stage.screenToCanvas(4);
                shape.graphics.clear().s("blue").sd([20, 10], 0)
                    .mt(o.x, o.y).lt(o.w, o.y).mt(o.x, o.y).lt(0, o.y)
                    .mt(o.x, o.y).lt(o.x, o.h).mt(o.x, o.y).lt(o.x, 0)
                    .mt(o.x, o.y).ss(3, null, null, null, true).dc(o.x, o.y, r);
                this.stage.update();
            }
        }, {
            stage: {
                enumerable: false,
                get: function () {
                    return stage;
                },
                set: function (v) {
                    var self = this;
                    if (stage && zoomHandler)
                        stage.off("Zoom", zoomHandler);
                    stage = v;
                    zoomHandler = stage.on("Zoom", function () {
                        self.draw();
                    });
                }
            },
            shape: {
                enumerable: false,
                get: function () {
                    return shape;
                }
            }
        });
    }]);
})(angular.module(window.mainApp));