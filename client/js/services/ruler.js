/**
 * Created by ralemy on 11/15/15.
 * Factory to control the ruler
 */

"use strict";

module.exports = (function (app) {
    app.factory("RulerCoords", [function () {
            var startX, endX, startY, endY, fix=[true,false];

            return Object.create({
                getDisplacement:function(v,point){
                    return this.fix[point] ? 0 : this.fix[1-point] ? 2 * v : v;
                },
                growY: function (v) {
                    if (startY > endY) v = -v;
                    startY -= this.getDisplacement(v,0);
                    endY += this.getDisplacement(v,1);
                },
                growX: function (v) {
                    if (startX > endX) v = -v;
                    startX -= this.getDisplacement(v,0);
                    endX += this.getDisplacement(v,1);
                },
                grow: function (v) {
                    if (this.snap(startX, endX) === endX)
                        return this.growY(v);
                    if (this.snap(startY, endY) === endY)
                        return this.growX(v);
                    var m = this.slope,
                        sign = v / Math.abs(v),
                        x = Math.sqrt(Math.pow(v, 2) / (1 + Math.pow(m, 2))) * sign,
                        y = m * x;
                    this.growX(x);
                    this.growY(y);
                },
                snap: function (newValue, oldValue) {
                    return Math.abs(newValue - oldValue) < 0.001 ? oldValue : newValue;
                },
                snapSlopeX: function (newValue, oldValue) {
                    newValue = this.snap(newValue, oldValue);
                    var m = this.slope;
                    return (m !== null && m > 30) ? oldValue : newValue;
                },
                snapSlopeY: function (newValue, oldValue) {
                    newValue = this.snap(newValue, oldValue);
                    var m = this.slope;
                    return (m !== null && m < 0.05) ? oldValue : newValue;
                },
                init: function (box, offset) {
                    if (offset)
                        box = {startX: box.x - offset, startY: box.y, endY: box.y, endX: box.x + offset};
                    startX = box.startX;
                    startY = box.startY;
                    endX = box.endX;
                    endY = box.endY;
                }
            }, {
                startX: {
                    enumerable: true,
                    get: function () {
                        return startX;
                    },
                    set: function (x) {
                        startX = x;
                        if (endX !== undefined)
                            startX = this.snapSlopeX(x, endX);
                    }
                },
                startY: {
                    enumerable: true,
                    get: function () {
                        return startY;
                    },
                    set: function (y) {
                        startY = y;
                        if (endY !== undefined)
                            startY = this.snapSlopeY(y, endY);
                    }
                },
                endX: {
                    enumerable: true,
                    get: function () {
                        return endX;
                    },
                    set: function (x) {
                        endX = x;
                        if (startX !== undefined)
                            endX = this.snapSlopeX(x, startX);
                    }
                },
                endY: {
                    enumerable: true,
                    get: function () {
                        return endY;
                    },
                    set: function (y) {
                        endY = y;
                        if (startY !== undefined)
                            endY = this.snapSlopeY(y, startY);
                    }
                },
                slope: {
                    enumerable: false,
                    get: function () {
                        if (!isNaN(startX + startY + endX + endY))
                            if (startX !== endX)
                                return Math.abs((this.startY - this.endY) / (this.startX - this.endX));
                        return null;
                    }
                },
                fix:{
                    get: function(){
                        return fix;
                    }
                }
            });
        }])
        .factory("Ruler", ["CreateJS", "RulerCoords", function (createjs, coords) {
            var shape = new createjs.Container(),
                startHandle = new createjs.Shape(),
                rulerLine = new createjs.Shape(),
                endHandle = new createjs.Shape(),
                lastX, lastY, stage = null,
                press = function (ev) {
                    lastX = ev.stageX;
                    lastY = ev.stageY;
                    ev.stopPropagation();
                    ev.preventDefault();
                };
            shape.name = "Ruler";
            shape.addChild(rulerLine, startHandle, endHandle);

            function drawHandle(handle, x, y, color) {
                handle.graphics.clear().s(color || "green").f(color || "green").ss(2, null, null, null, true)
                    .dc(x, y, stage.screenToCanvas(4));
            }

            function drawLine(handle) {
                handle.graphics.clear().s("green").ss(4, null, null, null, true)
                    .mt(coords.startX, coords.startY).lt(coords.endX, coords.endY);

            }

            var ruler = Object.create({
                    draw: function (update) {
                        drawHandle(startHandle, coords.startX, coords.startY,"red");
                        drawHandle(endHandle, coords.endX, coords.endY,"blue");
                        drawLine(rulerLine);
                        if (update)
                            stage.update();
                    },
                    init: function (wrapper) {
                        stage = wrapper;
                        shape.on("Ruler", function (ev) {
                            stage.rulerLength = ev.length;
                            if (stage.scope)
                                stage.scope.$apply();
                        });
                        stage.on("Zoom", function () {
                            ruler.draw(true);
                        });
                    }
                },
                {
                    stage: {
                        enumerable: false,
                        get: function () {
                            return stage;
                        },
                        set: function (v) {
                            stage = v;
                        }
                    },
                    shape: {
                        enumerable: false,
                        get: function () {
                            return shape;
                        }
                    },
                    coords: {
                        enumerable: false,
                        get: function () {
                            return coords;
                        }
                    },
                    length: {
                        enumerable: true,
                        get: function () {
                            return Math.sqrt(Math.pow(coords.startX - coords.endX, 2) +
                                Math.pow(coords.startY - coords.endY, 2));
                        },
                        set: function (v) {
                            if (!v) return;
                            coords.grow((v - this.length) / 2);
                            this.draw();
                        }
                    }
                });

            function handleMoved(setCoords) {
                var zoom = stage.zoom;
                setCoords(zoom);
                ruler.draw(true);
                stage.rulerLength = ruler.length;
                if (stage.scope)
                    stage.scope.$apply();
            }

            startHandle.on("mousedown", press);
            endHandle.on("mousedown", press);
            rulerLine.on("mousedown", press);

            startHandle.on("pressmove", function (ev) {
                handleMoved(function (zoom) {
                    coords.startX = ev.stageX / zoom;
                    coords.startY = ev.stageY / zoom;
                });
            });
            endHandle.on("pressmove", function (ev) {
                handleMoved(function (zoom) {
                    coords.endX = ev.stageX / zoom;
                    coords.endY = ev.stageY / zoom;
                });
            });

            rulerLine.on("pressmove", function (ev) {
                var zoom = stage.zoom,
                    deltaX = (ev.stageX - lastX) / zoom,
                    deltaY = (ev.stageY - lastY) / zoom,
                    box = {
                        startX: coords.startX + deltaX,
                        startY: coords.startY + deltaY,
                        endX: coords.endX + deltaX,
                        endY: coords.endY + deltaY
                    };
                coords.init(box);
                lastX = ev.stageX;
                lastY = ev.stageY;
                ruler.draw(true);
            });
            return ruler;
        }]);
})(angular.module(window.mainApp));