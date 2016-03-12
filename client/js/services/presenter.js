/**
 * Created by ralemy on 11/27/15.
 * service to present a project on REC
 */

"use strict";

module.exports = (function (app) {
    app.factory("Presenter", ["CreateJS", "$interval", "Item", "_", "$timeout", "PresenterZones",
            function (createjs, $interval, Item, _, $timeout, prepareZones) {
                return function (scope, el) {
                    var project = scope.project,
                        canvas = document.createElement("canvas"),
                        stage = new createjs.Stage(canvas),
                        main = new createjs.Container(),
                        bkWidth, bkHeight, zoomX, zoomY, zoom,
                        minX, minY, maxX, maxY,
                        interval, items = {}, activeTweens = 0, itemData, item,
                        zones = null,
                        wrapper = Object.create({
                            update: function () {
                                if (this.activeTweens <= 0)
                                    stage.update();
                            },
                            addChild: function (child) {
                                main.addChild(child);
                            },
                            removeChild: function (child) {
                                main.removeChild(child);
                            },
                            removeAllChildren: function () {
                                main.removeAllChildren();
                            },
                            on: function () {
                                return stage.on.apply(stage, arguments);
                            },
                            off: function () {
                                return stage.off.apply(stage, arguments);
                            },
                            dispatchEvent: function () {
                                return stage.dispatchEvent.apply(stage, arguments);
                            },
                            screenToCanvas: function (x, axis) {
                                if (!axis)
                                    return x / zoom;
                                return axis === "x" ? x / zoomX : x / zoomY;
                            },
                            stageToMeters: function (v, axis) {
                                return (axis === "y" ? -1 : 1) * (v - this.origin[axis]) / this.scale;
                            },
                            metersToStage: function (v, axis) {
                                if (axis === "y") v = -v;
                                return this.metersToCanvas(v) + this.origin[axis];
                            },
                            metersToCanvas: function (v) {
                                return v * this.scale;
                            },
                            filter: function (tags) {
                                if (!Object.keys(project.selection).length)
                                    return _.map(tags, function (t) {
                                        t.selected = false;
                                        return t;
                                    });
                                return _.filter(tags, function (t) {
                                    t.selected = _.reduce(project.selection, function (r, v, k) {
                                        return r && project.itemHash[t.epc] && project.itemHash[t.epc][k] === v.Property;
                                    }, true);
                                    return t.selected;
                                });
                            },
                            correctXY: function (tags) {
                                return _.map(tags, function (t) {
                                    _.each(zones, function (z) {
                                        z.entreat(t);
                                    });
                                    t.x = Math.max(minX, Math.min(t.xLocation, maxX));
                                    t.y = Math.max(minY, Math.min(t.yLocation, maxY));
                                    return t;
                                });
                            },
                            showItems: function (itemData) {
                                var self = this;
                                _.each(this.correctXY(this.filter(itemData.data)), function (i) {
                                    if (items[i.epc])
                                        items[i.epc].tween(i);
                                    else
                                        items[i.epc] = Item(i, self, project.getSymbol(i.epc));
                                    if (item && item.model.epc === i.epc)
                                        wrapper.item = items[i.epc];
                                });
                                self.update();
                            },
                            tick: function () {
                                return project.getItems({silentAll: true}).then(function (items) {
                                    wrapper.showItems(items);
                                    itemData = items;
                                    scope.$emit("Presenter", "running");
                                    return items;
                                }, function (error) {
                                    $interval.cancel(interval);
                                    scope.$emit("Presenter", error.data.msg);
                                });
                            },
                            resize: function () {
                                var parentWidth = canvas.parentElement.offsetWidth,
                                    parentHeight = canvas.parentElement.offsetHeight;
                                this.zoomX = parentWidth / bkWidth;
                                this.zoomY = parentHeight / bkHeight;
                                this.zoom = Math.min(this.zoomX, this.zoomY);
                                canvas.width = canvas.style.width = bkWidth * this.zoom;
                                canvas.height = canvas.style.height = bkHeight * this.zoom;
                                minX = this.stageToMeters(this.screenToCanvas(5), "x");
                                maxX = this.stageToMeters(bkWidth - this.screenToCanvas(5), "x");
                                maxY = this.stageToMeters(this.screenToCanvas(5), "y");
                                minY = this.stageToMeters(bkHeight - this.screenToCanvas(5), "y");
                            }
                        }, {
                            project: {
                                get: function () {
                                    return project;
                                },
                                set: function (v) {
                                    project = v;
                                }
                            },
                            zoomX: {
                                get: function () {
                                    return zoomX;
                                },
                                set: function (v) {
                                    zoomX = v;
                                }
                            },
                            zoomY: {
                                get: function () {
                                    return zoomY;
                                },
                                set: function (v) {
                                    zoomY = v;
                                }
                            },
                            zoom: {
                                get: function () {
                                    return zoom;
                                },
                                set: function (v) {
                                    zoom = v;
                                }
                            },
                            activeTweens: {
                                get: function () {
                                    return activeTweens;
                                },
                                set: function (v) {
                                    activeTweens = v;
                                }
                            },
                            origin: {
                                enumerable: true,
                                get: function () {
                                    return project.origin;
                                }
                            },
                            scale: {
                                enumerable: false,
                                get: function () {
                                    return project.scale;
                                }
                            },
                            item: {
                                get: function () {
                                    return item;
                                },
                                set: function (v) {
                                    if (item && item !== v)
                                        item.deactivate();
                                    item = v;
                                    if (v && !v.model.activated)
                                        v.activate(true);
                                    project.item = v ? v.model : null;
                                }
                            },
                            items: {
                                get: function () {
                                    return items;
                                },
                                set: function (v) {
                                    items = v;
                                }
                            },
                            itemData: {
                                get: function () {
                                    return itemData;
                                },
                                set: function (v) {
                                    itemData = v;
                                }
                            }
                        });
                    el.append(canvas);
                    stage.addChild(main);
                    angular.promiseBitmap(project.floorPlanUrl).then(function (bitmap) {
                        bkWidth = bitmap.image.width;
                        bkHeight = bitmap.image.height;
                        wrapper.resize();
                        main.addChild(bitmap);
                        main.setTransform(0, 0, wrapper.zoom, wrapper.zoom);
                        stage.update();
                        project.preparePresentation(wrapper,bitmap);
                        zones = prepareZones(project.zones, wrapper);
                        return project.connect();
                    }).then(function () {
                        interval = $interval(wrapper.tick, 5000);
                    });
                    stage.on("newItem", function (ev) {
                        $timeout(function () {
                            wrapper.item = wrapper.item === ev.item ? null : ev.item;
                        });
                    });
                    scope.$on("resize", function () {
                        wrapper.resize();
                        main.setTransform(0, 0, wrapper.zoom, wrapper.zoom);
                        stage.update();
                    });
                    createjs.Ticker.setFPS(30);
                    createjs.Ticker.addEventListener("tick", function () {
                        if (wrapper.activeTweens > 0)
                            stage.update();
                    });
                    return wrapper;
                };
            }])
        .factory("PresenterLines", [function () {
            // this uses the solution outlined in http://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect to find intersections
            function subtractPoint(p2, p1) {
                return {
                    x: p2.x - p1.x,
                    y: p2.y - p1.y
                };
            }

            function crossProduct(p1, p2) {
                return (p1.x * p2.y) - (p1.y * p2.x);
            }

            function getU(uNum, dnom, a, s) {
                if (dnom === 0)
                    return null;
                var u = uNum / dnom,
                    t = crossProduct(a, s) / dnom;
                return (u < 0 || t < 0 || t > 1.0) ? null : u;
            }

            return function (p1, p2, center) {
                var r = subtractPoint(p2, p1),
                    a = subtractPoint(center, p1),
                    uNum = crossProduct(a, r);
                return Object.create({
                    doesIntersect: function (p) {
                        var s = subtractPoint(p, center),
                            dnom = crossProduct(r, s),
                            u = getU(uNum, dnom, a, s);
                        return u ? {
                            x: s.x * u,
                            y: s.y * u
                        } : null;
                    }
                }, {});
            };
        }])
        .factory("PresenterZones", ["_", "CreateJS", "PresenterLines", function (_, createjs, lineObject) {
            function drawShape(shape, pts) {
                var g = shape.graphics.clear().s("brown").f("red");
                _.reduce(pts, function (r, p, i) {
                    return i ? r.lt(p.x, p.y) : r.mt(p.x, p.y);
                }, g).lt(pts[0].x, pts[0].y);
                return shape;
            }

            function getCenterPoint(z) {
                var center = _.reduce(z.points, function (r, p) {
                    r.x += p.x;
                    r.y += p.y;
                    return r;
                }, {x: 0, y: 0});
                center.x /= z.points.length;
                center.y /= z.points.length;
                return center;
            }

            function getLineObjects(z, center) {
                return _.reduce(z.points.concat(z.points[0]), function (r, p, i) {
                    if (i === 0)
                        return r;
                    r.push(lineObject(z.points[i - 1], p, center));
                    return r;
                }, []);
            }

            function getShadowPoints(z, center) {
                return _.map(z.points, function (p) {
                    return {
                        x: center.x + ((p.x - center.x) * z.tolerance),
                        y: center.y + ((p.y - center.y) * z.tolerance)
                    };
                });
            }

            function prepareZone(z, stage) {
                var center = getCenterPoint(z),
                    lines = getLineObjects(z, center),
                    shadow = drawShape(new createjs.Shape(), getShadowPoints(z, center)),
                    shape = drawShape(new createjs.Shape(), z.points);

                return Object.create({

                    moveToIntersection: function (intersection, p) {
                        if (!intersection) return false;
                        var offset = z.type === "blocker" ? 1 + (Math.random() * (z.tolerance - 1)) : Math.random();
                        p.x = stage.stageToMeters(center.x + (intersection.x * offset), "x");
                        p.y = stage.stageToMeters(center.y + (intersection.y * offset), "y");
                        return true;
                    },

                    moveToNewPosition: function (q, p) {
                        for (var i = 0; i < lines.length; i++)
                            if (this.moveToIntersection(lines[i].doesIntersect(q), p))
                                return;
                    },
                    appliesToFixture: function (p) {
                        var pObject = stage.project.itemHash[p.epc];
                        var pSymbols = _.map(pObject, function (v) {
                            return v;
                        });
                        return _.find(z.include, function (include) {
                            return _.find(pSymbols, function (symbol) {
                                return symbol === include;
                            });
                        });
                    },
                    hits: function (p) {
                        if (shape.hitTest(p.x, p.y))
                            return z.type === "blocker";
                        if (z.type === "blocker")
                            return false;
                        if (shadow.hitTest(p.x, p.y))
                            return this.appliesToFixture(p);
                    },

                    entreat: function (p) {
                        var q = {
                            x: stage.metersToStage(p.x, "x"),
                            y: stage.metersToStage(p.y, "y"),
                            epc: p.epc
                        };
                        if (this.hits(q))
                            this.moveToNewPosition(q, p);
                    }
                }, {
                    shape: {
                        get: function () {
                            return shape;
                        }
                    },
                    zone: {
                        get: function () {
                            return z;
                        }
                    },
                    center: {
                        get: function () {
                            return center;
                        }
                    }
                });
            }

            return function (zones, stage) {
                return _.map(zones, function (z) {
                    return prepareZone(z, stage);
                }).sort(function(a,b){
                    if(a.type === b.type)
                        return 0;
                    if(a.type === "blocker")
                        return -1;
                    return 1;
                });
            };
        }]);
})(angular.module(window.mainApp));