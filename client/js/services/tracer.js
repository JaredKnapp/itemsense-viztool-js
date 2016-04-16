/**
 * Created by ralemy on 11/16/15.
 * Traces a new zone on the floor plan
 */

"use strict";

module.exports = (function (app) {
    app.factory("TracerPoint", [function () {
        return function (ref, stage, tracer) {
            Object.defineProperties(ref, {
                X: {
                    get: () => Math.round10(stage.stageToMeters(ref.x, "x"), -3),
                    set: (v) => {
                        v = isNaN(v) ? 0 : parseFloat(v);
                        ref.x = stage.metersToStage(v, "x");
                        tracer.draw(true);
                    }
                },
                Y: {
                    get: () => Math.round10(stage.stageToMeters(ref.y, "y"), -3),
                    set: (v) => {
                        v = isNaN(v) ? 0 : parseFloat(v);
                        ref.y = stage.metersToStage(v, "y");
                        tracer.draw(true);
                    }
                }
            });
            return ref;
        }
    }]).factory("Tracer", ["$q", "_", "CreateJS", "TracerPoint", function ($q, _, createjs, TracerPoint) {
            var stage, points = [], defer,
                shape = new createjs.Shape(),
                wrapper = Object.create({
                    mousedown: function (ev) {
                        var zoom = stage.zoom,
                            lastPoint = this.lastPoint,
                            point = TracerPoint({x: ev.stageX / zoom, y: ev.stageY / zoom}, stage, wrapper);
                        if (ev.nativeEvent.button === 2)
                            points.pop();
                        if (!lastPoint || this.lineSegment(lastPoint, point) > 10)
                            points.push(point);
                        this.draw();
                    },
                    pressmove: function (ev) {
                        if (!points.length) return;
                        if (points.length === 1)
                            points.push(TracerPoint({x: this.firstPoint.x, y: this.firstPoint.y}, stage,wrapper));
                        var zoom = stage.zoom;
                        this.lastPoint.x = ev.stageX / zoom;
                        this.lastPoint.y = ev.stageY / zoom;
                        this.draw();
                    },
                    dblclick: function () {
                        points.pop();
                        stage.removeChild(shape);
                        stage.tracePoints = [];
                        stage.update();
                        if (points.length < 3)
                            defer.reject(points);
                        else
                            defer.resolve(points);
                        defer = null;
                    },
                    lineSegment: function (p1, p2) {
                        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
                    },
                    trace: function (stg) {
                        defer = $q.defer();
                        points = [];
                        stage = stg;
                        stage.tracePoints = points;
                        shape.name = "Tracer";
                        stage.addChild(shape);
                        return defer.promise;
                    },
                    cancel: function () {
                        stage.removeChild(shape);
                        stage.update();
                        if (defer)
                            defer.reject(points);
                    },
                    draw: function () {
                        _.reduce(points, function (r, p, i) {
                            return i ? r.lineTo(p.x, p.y) : r.moveTo(p.x, p.y);
                        }, shape.graphics.clear().s("brown").ss(4, null, null, null, true));
                        stage.update();
                    }
                }, {
                    stage: {
                        enumerable: false,
                        get: function () {
                            return stage;
                        },
                        set: function (v) {
                            stage = v;
                        }
                    },
                    points: {
                        enumerable: true,
                        get: function () {
                            return points;
                        },
                        set: function (v) {
                            points = v;
                        }
                    },
                    lastPoint: {
                        enumerable: false,
                        get: function () {
                            return points[points.length - 1];
                        }
                    },
                    firstPoint: {
                        enumerable: false,
                        get: function () {
                            return points[0];
                        }
                    }
                });
            return wrapper;
        }])
        .factory("TransformBuffer", ["_", function (_) {
            return function (pts, scale) {
                function setCenter() {
                    var c = _.reduce(pts, function (r, p) {
                        return {x: r.x + p.x, y: r.y + p.y};
                    });
                    c.x /= pts.length;
                    c.y /= pts.length;
                    return c;
                }

                function updatePoints(center, scale) {
                    return _.map(pts, function (p) {
                        return {
                            x: ((p.x - center.x) * scale) + center.x,
                            y: ((p.y - center.y) * scale) + center.y
                        };
                    });
                }

                function setScale(v) {
                    return Math.max(Math.abs(parseFloat(v) || 1.0), 1.0);
                }

                scale = setScale(scale);
                var center = setCenter(),
                    points = updatePoints(center, scale);

                return Object.create({}, {
                    scale: {
                        get: function () {
                            return scale;
                        },
                        set: function (v) {
                            scale = setScale(v);
                            points = updatePoints(center, scale);
                        }
                    },
                    points: {
                        get: function () {
                            return points;
                        },
                        set: function (v) {
                            pts = v;
                            center = setCenter();
                            points = updatePoints(center, scale);
                        }
                    }
                });
            };
        }])
        .factory("Zones", ["_", "CreateJS", "TransformBuffer", function (_, createjs, transform) {
            var util = {
                toStagePoints: function (points, stage) {
                    return _.map(points, function (p) {
                        return {x: stage.metersToStage(p.x, "x"), y: stage.metersToStage(p.y, "y")};
                    });
                },
                movePointInZone: function (stage, point, idx, dx, dy) {
                    point.x += dx;
                    point.y += dy;
                    this.points[idx].x = Math.round10(stage.stageToMeters(point.x, "x"),-3);
                    this.points[idx].y = Math.round10(stage.stageToMeters(point.y, "y"),-3);
                },
                addPoint: function (stage, zone, idx, point) {
                    this.splice(idx, 0, {x: point.x, y: point.y});
                    zone.points.splice(idx, 0, {
                        x: Math.round10(stage.stageToMeters(point.x, "x"),-3),
                        y: Math.round10(stage.stageToMeters(point.y, "y"),-3),
                        z: 0
                    });
                },
                removePoint: function (zone, idx) {
                    this.splice(idx, 1);
                    zone.points.splice(idx, 1);
                },
                findZoneName: function (zones, name) {
                    return _.find(zones, function (z) {
                        return z.name === name;
                    });
                }
            };

            return {
                cloneZone: function (ref, stage) {
                    var zone = _.merge({}, ref),
                        d = 0.5,
                        name = zone.name.indexOf("_copy") === -1 ? zone.name : zone.name.split("_copy")[0];
                    name += "_copy";
                    _.each(zone.points, function (p) {
                        p.x += d;
                        p.y += d;
                    });
                    zone.name = name;
                    for (var i = 1; util.findZoneName(stage.zones, zone.name); i++)
                        zone.name = name + "_" + i;
                    return this.createZone(zone, stage);
                },
                createZone: function (zone, stage, scale) {
                    var points = util.toStagePoints(zone.points, stage),
                        moveZonePoint = util.movePointInZone.bind(zone, stage),
                        addZonePoint = util.addPoint.bind(points, stage, zone),
                        removeZonePoint = util.removePoint.bind(points, zone),
                        shadow = transform(points, scale),
                        colors = {
                            "fixture": "rgba(0,0,200,0.2)",
                            "blocker": "rgba(250,180,60,0.2",
                            selected: "rgba(180,250,60,0.2)"
                        },
                        shape = new createjs.Shape(),
                        editor = new createjs.Shape(),
                        shadowShape = new createjs.Shape(),
                        lastX, lastY, isActive = false, movingPoint = null, movingPointIdx = -1, zoomHandler = null,
                        wrapper = Object.create({
                            activate: function () {
                                isActive = true;
                                stage.addChild(shadowShape);
                                stage.addChild(shape);
                                stage.addChild(editor);
                                this.draw();
                                stage.dispatchEvent(new createjs.Event("newZone").set({zone: wrapper}));
                            },
                            destroy: function () {
                                stage.removeChild(shadowShape);
                                stage.removeChild(shape);
                                stage.removeChild(editor);
                                stage.off("Zoom", zoomHandler);
                                stage.update();
                            },
                            deactivate: function () {
                                isActive = false;
                                stage.removeChild(editor);
                                this.draw();
                            },
                            draw: function () {
//                                this.drawPoly(shadowShape.graphics.clear().s("brown").ss(1, null, null, null, true).f("rgba(200,200,0,0.2)"), shadow.points);
                                this.drawPoly(shape.graphics.clear().s("brown").ss(4, null, null, null, true)
                                    .f(isActive ? colors.selected : colors.fixture), points);
                                if (isActive)
                                    this.drawPoints();
                                stage.update();
                            },
                            setTolerance: function (scale) {
                                shadow.scale = scale;
                                this.draw();
                            },
                            drawPoly: function (g, pts) {
                                _.reduce(pts, function (r, p, i) {
                                    return i ? r.lt(p.x, p.y) : r.mt(p.x, p.y);
                                }, g).lt(pts[0].x, pts[0].y);
                            },
                            drawPoints: function () {
                                var radius = stage.screenToCanvas(4),
                                    lastP = null;
                                _.reduce(points, function (r, p) {
                                        var g = r.s("brown").ss(4, null, null, null, true).f("brown").dc(p.x, p.y, radius).es().ef();
                                        if (lastP)
                                            g = g.s("brown").ss(2, null, null, null, true).f("white").dc((p.x + lastP.x) / 2, (p.y + lastP.y) / 2, radius * 0.75).es().ef();
                                        lastP = p;
                                        return g;
                                    }, editor.graphics.clear())
                                    .s("brown").ss(2, null, null, null, true).f("white").dc((points[0].x + lastP.x) / 2, (points[0].y + lastP.y) / 2, radius * 0.75).es().ef();
                            }
                        }, {
                            model: {
                                enumerable: false,
                                get: function () {
                                    return zone;
                                }
                            }
                        });
                    shape.on("mousedown", function (ev) {
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        if (!isActive)
                            wrapper.activate();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    shape.on("pressmove", function (ev) {
                        if (!isActive)
                            return;
                        var zoom = stage.zoom,
                            dx = (ev.stageX - lastX) / zoom,
                            dy = (ev.stageY - lastY) / zoom;
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        if (isNaN(dx)) return;
                        _.each(points, function (p, i) {
                            moveZonePoint(p, i, dx, dy);
                        });
                        shadow.points = points;
                        wrapper.draw();
                        stage.scope.$apply();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    editor.on("mousedown", function (ev) {
                        var x = ev.localX,
                            y = ev.localY,
                            cutoff = stage.screenToCanvas(6);
                        movingPointIdx = _.findIndex(points, function (p) {
                            if (Math.abs(p.x - x) < cutoff)
                                if (Math.abs(p.y - y) < cutoff)
                                    return true;
                        });
                        if (movingPointIdx !== -1)
                            movingPoint = points[movingPointIdx];
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    editor.on("dblclick", function (ev) {
                        var x = ev.localX,
                            y = ev.localY,
                            cutoff = stage.screenToCanvas(6),
                            halfPoints = _.map(points, function (p, i) {
                                var j = points[i + 1] ? i + 1 : 0;
                                return {x: (p.x + points[j].x) / 2, y: (p.y + points[j].y) / 2, i: i};
                            }),
                            halfPoint = _.find(halfPoints, function (p) {
                                if (Math.abs(p.x - x) < cutoff)
                                    if (Math.abs(p.y - y) < cutoff)
                                        return true;
                            }),
                            curPointIdx = _.findIndex(points, function (p) {
                                if (Math.abs(p.x - x) < cutoff)
                                    if (Math.abs(p.y - y) < cutoff)
                                        return true;
                            });
                        if (halfPoint) {
                            addZonePoint(halfPoint.i + 1, halfPoint);
                            shadow.points = points;
                            wrapper.draw();
                            stage.scope.$apply();
                        }
                        else if (curPointIdx !== -1) {
                            if (points.length > 3)
                                removeZonePoint(curPointIdx);
                            movingPoint = null;
                            shadow.points = points;
                            wrapper.draw();
                            stage.scope.$apply();
                        }
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    editor.on("pressmove", function (ev) {
                        if (!movingPoint) return;
                        var zoom = stage.zoom,
                            dx = (ev.stageX - lastX) / zoom,
                            dy = (ev.stageY - lastY) / zoom;
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        moveZonePoint(movingPoint, movingPointIdx, dx, dy);
                        shadow.points = points;
                        wrapper.draw();
                        stage.scope.$apply();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    shape.name = "Zone";
                    shadowShape.name = "Zone";
                    editor.name = "Zone";
                    zoomHandler = stage.on("Zoom", function () {
                        wrapper.draw();
                    });
                    stage.addChild(shadowShape);
                    stage.addChild(shape);
                    wrapper.draw();
                    return wrapper;
                }
            };
        }]);
})(angular.module(window.mainApp));
