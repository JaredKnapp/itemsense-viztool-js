/**
 * Created by ralemy on 11/27/15.
 * service to present a project on REC
 */

"use strict";

module.exports = (function (app) {
    app.factory("Presenter", ["CreateJS", "$interval", "Item", "_", "$timeout",
            function (createjs, $interval, Item, _, $timeout) {
                return function (scope, el) {
                    var project = scope.project,
                        canvas = document.createElement("canvas"),
                        stage = new createjs.Stage(canvas),
                        main = new createjs.Container(),
                        bkWidth, bkHeight, zoomX, zoomY, zoom,
                        minX, minY, maxX, maxY,
                        interval, items = {}, activeTweens = 0, itemData, item,
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
                                return tags; //no correction performed on client. use node-red flows to correct at server.
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
            }]);
})(angular.module(window.mainApp));