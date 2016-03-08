/**
 * Created by ralemy on 11/21/15.
 * controls the display of readers
 */

"use strict";

module.exports = (function (app) {
    app.factory("StageMetrics", [function () {
            return function (ref, stage) {
                //Expects ref to have x and y, in meters from origin. (what is supplied by item sense)
                Object.defineProperties(ref, {
                    _x: { //x for the shape
                        configurable: true,
                        get: function () {
                            return stage.metersToStage(ref.x, "x");
                        },
                        set: function (v) {
                            ref.x = stage.stageToMeters(v, "x");
                        }
                    },
                    _y: { //y for the shape
                        configurable: true,
                        get: function () {
                            return stage.metersToStage(ref.y, "y");
                        },
                        set: function (v) {
                            ref.y = stage.stageToMeters(v, "y");
                        }
                    },
                    X: { // X in meters, to display on UI
                        configurable: true,
                        get: function () {
                            return Math.round10(ref.x, -3);
                        },
                        set: function (v) {
                            ref.x = v;
                        }
                    },
                    Y: { // Y in meters to display on UI
                        configurable: true,
                        get: function () {
                            return Math.round10(ref.y, -3);
                        },
                        set: function (v) {
                            ref.y = v;
                        }
                    }
                });
                return ref;
            };
        }])
        .factory("ReaderModel", ["StageMetrics", function (StageMetrics) {
            //ToDo: extend to have properties that readers need to be shown on stage.
            return function (ref, stage) {
                return StageMetrics(ref, stage);
            };
        }])
        .factory("Reader", ["CreateJS", "ReaderModel", function (createjs, ReaderModel) {
            return {
                create: function (ref, stage) {
                    var field = new createjs.Shape(),
                        device = new createjs.Shape(),
                        model = ReaderModel(ref, stage),
                        zoomHandler = null,
                        color = "blue", lastX, lastY,
                        wrapper = Object.create({
                            destroy: function (update) {
                                stage.removeChild(device);
                                stage.removeChild(field);
                                if (zoomHandler)
                                    stage.off("Zoom", zoomHandler);
                                if (update)
                                    stage.update();
                            },
                            drawFields: function () {
                                var g = field.graphics.clear().s("brown").ss(1);
                                if (stage.showReaderFields > 2)
                                    g = g.f("rgba(200,0,0,0.2)").dc(0, 0, stage.metersToCanvas(5));
                                if (stage.showReaderFields > 1)
                                    g = g.f("rgba(200,200,0,0.2)").dc(0, 0, stage.metersToCanvas(4));
                                if (stage.showReaderFields)
                                    g.f("rgba(0,200,0,0.2)").dc(0, 0, stage.metersToCanvas(3));
                            },
                            drawDevice: function () {
                                var l = stage.screenToCanvas(10),
                                    r = stage.screenToCanvas(3);
                                device.graphics.clear().s("brown").ss(1).f(color).r(-l, -l, l * 2, l * 2).dc(0, -l, r);
                            },
                            draw: function (update) {
                                this.drawFields();
                                this.drawDevice();
                                field.x = device.x = model._x;
                                field.y = device.y = model._y;
                                device.rotation = model.yaw;
                                if (update)
                                    stage.update();
                            },
                            activate: function (noForce) {
                                color = "red";
                                this.draw(true);
                                stage.dispatchEvent(new createjs.Event("newReader").set({reader: wrapper, force:!noForce}));
                            },
                            deactivate: function () {
                                color = "blue";
                                this.draw(true);
                            }
                        }, {
                            shape: {
                                get: function () {
                                    return device;
                                },
                                set: function (v) {
                                    device = v;
                                }
                            },
                            ref: {
                                get: function () {
                                    return ref;
                                }
                            }
                        });
                    device.name = "Reader";
                    field.name = "Field";
                    device.on("mousedown", function (ev) {
                        wrapper.activate();
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    device.on("pressmove", function (ev) {
                        var zoom = stage.zoom;
                        model._x += (ev.stageX - lastX) / zoom;
                        model._y += (ev.stageY - lastY) / zoom;
                        wrapper.draw(true);
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        if (stage.scope)
                            stage.scope.$apply();
                    });
                    stage.addChild(field);
                    stage.addChild(device);
                    zoomHandler = stage.on("Zoom", function () {
                        wrapper.draw();
                    });
                    wrapper.draw();
                    return wrapper;
                }
            };
        }]);
})(angular.module(window.mainApp));