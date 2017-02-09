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
                        get: () => Math.round10(stage.stageToMeters(ref.x, "x"), -2),
                        set: (v) => {
                            v = isNaN(v) ? 0 : parseFloat(v);
                            ref.x = stage.metersToStage(v, "x");
                            tracer.draw(true);
                        }
                    },
                    Y: {
                        get: () => Math.round10(stage.stageToMeters(ref.y, "y"), -2),
                        set: (v) => {
                            v = isNaN(v) ? 0 : parseFloat(v);
                            ref.y = stage.metersToStage(v, "y");
                            tracer.draw(true);
                        }
                    }
                });
                return ref;
            };
        }])
        .factory("Tracer", ["$q", "_", "CreateJS", "TracerPoint", function ($q, _, createjs, TracerPoint) {
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
                            points.push(TracerPoint({x: this.firstPoint.x, y: this.firstPoint.y}, stage, wrapper));
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
                        shape.graphics.clear();
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
        .factory("ZonePoints", ["_", function (_) {
            function makePoint(wrapper, stage, p, type) {
                type = type || "full";
                return Object.create({}, {
                    ref: {
                        get: () => p
                    },
                    type: {
                        get: () => type
                    },
                    x: {
                        get: () => stage.metersToStage(p.x, "x"),
                        set: (v) => p.x = Math.round10(stage.stageToMeters(v, "x"), -2)
                    },
                    y: {
                        get: () => stage.metersToStage(p.y, "y"),
                        set: (v) => p.y = Math.round10(stage.stageToMeters(v, "y"), -2)
                    },
                    _x: {
                        get: () => p.x,
                        set: (v) => {
                            p.x = isNaN(v) ? p.x || 0 : parseFloat(v);
                            stage.scope.$emit("shouldSave","zones");
                            wrapper.draw(true);
                        }
                    },
                    _y: {
                        get: () => p.y,
                        set: (v) => {
                            p.y = isNaN(v) ? p.y || 0 : parseFloat(v);
                            stage.scope.$emit("shouldSave","zones");
                            wrapper.draw(true);
                        }
                    }
                });
            }

            function halfPoint(points, i) {
                const p1 = points[i],
                    p2 = points[i + 1] || points[0];
                return {x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, z: (p1.z + p2.z) / 2};
            }

            return (zone, stage, wrapper) => _.reduce(zone.points, (r, p, i) => {
                r.push(makePoint(wrapper, stage, p));
                r.push(makePoint(wrapper, stage, halfPoint(zone.points, i), "half"));
                return r;
            }, []);
        }])
        .factory("Zones", ["_", "CreateJS", "ZonePoints", function (_, createjs, ZonePoints) {
            function createModel(zone, points) {
                return Object.create({
                    clone(delta){
                        delta = delta || 0.2;
                        return _.reduce(points, (r, p)=> {
                            if (p.type === "full")
                                r.push({
                                    x: p.ref.x + delta,
                                    y: p.ref.y + delta,
                                    z: p.ref.z
                                });
                            return r;
                        }, []);
                    },
                    update(pts){
                        points = pts;
                    }
                }, {
                    ref:{
                        get: () => zone
                    },
                    name: {
                        get: () => zone.name,
                        set: v => zone.name = v
                    },
                    floor: {
                        get: () => zone.floor,
                        set: v => zone.floor = v
                    },
                    points: {
                        get: () => points
                    }
                });
            }

            return {
                createZone: function (zone, stage) {
                    const colors = {
                            "fixture": "rgba(0,0,200,0.2)",
                            selected: "rgba(180,250,60,0.2)"
                        },
                        shape = new createjs.Shape(),
                        editor = new createjs.Shape();
                    let points, lastX, lastY, model, textBoxes, isActive, hasdragged, movingPoint, zoomHandler, movingPointDragged, wrapper;
                    textBoxes = {};
                    isActive = false;
                    hasdragged = false;
                    movingPoint = null;
                    zoomHandler = null;
                    movingPointDragged = false;
                    wrapper = Object.create({
                        hitTest(x, y) {
                            return shape.hitTest(x, y);
                        },
                        activate() {
                            isActive = true;
                            stage.addChild(shape);
                            stage.addChild(editor);
                            this.draw();
                            stage.dispatchEvent(new createjs.Event("newZone").set({zone: wrapper}));
                        },
                        destroy() {
                            stage.removeChild(shape);
                            stage.removeChild(editor);
                            stage.off("Zoom", zoomHandler);
                            stage.update();
                        },
                        deactivate() {
                            isActive = false;
                            stage.removeChild(editor);
                            this.draw();
                        },
                        addBox(box){
                            box.shape = new createjs.Text(box.text, "10px Arial", "#000000");
                            box.shape.x = box._x = stage.metersToStage(box.x, "x");
                            box.shape.y = box._y = stage.metersToStage(box.y, "y");
                            box.textBaseline = "alphabetic";
                            textBoxes[box.readerZone] = box;
                        },
                        renderTextBox(box){
                            if (!box.text)
                                return stage.removeChild(box.shape);
                            box.shape.x = box._x - (box.shape.getBounds().width/2);
                            if (!stage.containsShape(box.shape))
                                stage.addChild(box.shape);
                        },
                        draw() {
                            this.drawPoly(shape.graphics.clear().s("brown").ss(4, null, null, null, true)
                                .f(isActive ? colors.selected : colors.fixture), points);
                            if (isActive)
                                this.drawPoints();
                            _.each(textBoxes, box => this.renderTextBox(box));
                            stage.update();
                        },
                        drawPoly(g, pts) {
                            _.reduce(pts, function (r, p, i) {
                                if (!i) return r.mt(p.x, p.y);
                                return p.type === "full" ? r.lt(p.x, p.y) : r;
                            }, g).lt(pts[0].x, pts[0].y);
                        },
                        updateHalfPoint(p, i){
                            const p1 = i ? points[i - 1] : points[points.length - 1],
                                p2 = points[i + 1] || points[0];
                            p.x = (p1.x + p2.x) / 2;
                            p.y = (p1.y + p2.y) / 2;
                        },
                        drawPoints() {
                            const radius = stage.screenToCanvas(4);
                            _.reduce(points, (r, p, i) => {
                                if (p.type === "full")
                                    return r.s("brown").ss(4, null, null, null, true).f("brown").dc(p.x, p.y, radius).es().ef();
                                this.updateHalfPoint(p, i);
                                return r.s("brown").ss(2, null, null, null, true).f("white").dc(p.x, p.y, radius * 0.75).es().ef();
                            }, editor.graphics.clear());
                        },
                        removePoint(point) {
                            if (zone.points.length < 4) return;
                            zone.points = _.reduce(this.points, function (r, p) {
                                if (p.type === "full" && p !== point)
                                    r.push(p.ref);
                                return r;
                            }, []);
                            points = ZonePoints(zone, stage, this);
                            model.update(points);
                            this.draw();

                        },
                        convertPoint(point) {
                            zone.points = _.reduce(this.points, (r, p) => {
                                if (p.type === "full" || p === point)
                                    r.push(p.ref);
                                return r;
                            }, []);
                            points = ZonePoints(zone, stage, this);
                            model.update(points);
                            this.draw();
                        }

                    }, {
                        model: {
                            get: () => model
                        },
                        points: {
                            get: () => points
                        },
                        zone: {
                            get: () => zone
                        },
                        name: {
                            get: () => model.name
                        },
                        textBoxes: {
                            get: () => textBoxes
                        }
                    });
                    points = ZonePoints(zone, stage, wrapper);
                    model = createModel(zone, points);
                    shape.on("mousedown", (ev) => {
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        if (!isActive)  wrapper.activate();
                        hasdragged = false;
                        stage.scope.$apply();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    shape.on("pressmove", (ev) => {
                        if (isActive) {
                            const zoom = stage.zoom,
                                dx = (ev.stageX - lastX) / zoom,
                                dy = (ev.stageY - lastY) / zoom;
                            lastX = ev.stageX;
                            lastY = ev.stageY;
                            if (isNaN(dx)) return;
                            _.each(points, (p) => {
                                p.x += dx;
                                p.y += dy;
                            });
                            wrapper.draw();
                            stage.scope.$apply();
                            hasdragged = true;
                            ev.preventDefault();
                            ev.stopPropagation();
                        }
                    });
                    shape.on("pressup",function(ev){
                        if(hasdragged){
                            stage.dispatchEvent(new createjs.Event("shouldSave").set({subject: "zones"}));
                            stage.scope.$apply();
                            ev.preventDefault();
                            ev.stopPropagation();
                        }
                    });

                    editor.on("mousedown", function (ev) {
                        const x = ev.localX, y = ev.localY, cutoff = stage.screenToCanvas(6);
                        movingPoint = _.find(points, p => {
                            if (Math.abs(p.x - x) < cutoff)
                                if (Math.abs(p.y - y) < cutoff)
                                    return true;
                        });
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        movingPointDragged = false;
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    editor.on("dblclick", function (ev) {
                        if (movingPoint) {
                            stage.dispatchEvent(new createjs.Event("shouldSave").set({subject: "zones"}));
                            if (movingPoint.type === "full")
                                wrapper.removePoint(movingPoint);
                            else
                                wrapper.convertPoint(movingPoint);
                            stage.scope.$apply();
                        }
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    editor.on("pressmove", function (ev) {
                        if (!movingPoint || movingPoint.type !== "full") return;
                        var zoom = stage.zoom,
                            dx = (ev.stageX - lastX) / zoom,
                            dy = (ev.stageY - lastY) / zoom;
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        movingPoint.x += dx;
                        movingPoint.y += dy;
                        wrapper.draw();
                        movingPointDragged = true;
                        stage.scope.$apply();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    editor.on("pressup", function(ev){
                        if (!movingPointDragged) return;
                        stage.dispatchEvent(new createjs.Event("shouldSave").set({subject: "zones"}));
                        stage.scope.$apply();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    shape.name = "Zone";
                    editor.name = "Zone";
                    zoomHandler = stage.on("Zoom", function () {
                        wrapper.draw();
                    });
                    stage.addChild(shape);
                    wrapper.draw();
                    return wrapper;
                }
            };
        }]);
})(angular.module(window.mainApp));
