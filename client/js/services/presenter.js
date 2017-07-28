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
                                        items[i.epc] = Item(i, self, project.getSymbolColor(i.epc));
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
                                    console.log("Error getting items",error);
                                    scope.$emit("Presenter", error && error.data ? error.data.msg : error.data || error);
                                });
                            },
                            presentationArea(){
                                const box = project.presentationArea;
                                return (box.mode === "Full") ?
                                {
                                    x: 0,
                                    y: 0,
                                    w: bkWidth,
                                    h: bkHeight
                                } :
                                {
                                    x: this.metersToStage(Math.min(box.x1, box.x2), "x"),
                                    y: this.metersToStage(Math.max(box.y1, box.y2), "y"),
                                    w: this.metersToCanvas(Math.abs(box.x1 - box.x2)),
                                    h: this.metersToCanvas(Math.abs(box.y1 - box.y2))
                                };
                            },
                            adjustCanvasParent(box, parent){
                                const marginW = Math.round((parent.w - (box.w * this.zoom)) / 2),
                                    marginH = Math.round((parent.h - (box.h * this.zoom)) / 2),
                                    boxX = Math.round(box.x * this.zoom),
                                    boxY = Math.round(box.y * this.zoom);
                                parent.el.scrollTop = boxY;
                                parent.el.scrollLeft = boxX;
                                parent.el.style.left = parent.el.style.right = Math.max(3,marginW) + "px";
                                parent.el.style.top = parent.el.style.bottom = Math.max(3,marginH) + "px";
                                if (parent.el.scrollLeft < boxX)
                                    canvas.style.left = Math.round(parent.el.scrollLeft - boxX) + "px";
                                if (parent.el.scrollTop < boxY)
                                    canvas.style.top = Math.round(parent.el.scrollTop - boxY) + "px";
                            },
                            resetCanvasParent(){
                                canvas.parentElement.style.left = canvas.parentElement.style.right = 0;
                                canvas.parentElement.style.top = canvas.parentElement.style.bottom = 0;
                                return {
                                    el: canvas.parentElement,
                                    w: canvas.parentElement.offsetWidth,
                                    h: canvas.parentElement.offsetHeight
                                };
                            },
                            resize: function () {
                                const parent = this.resetCanvasParent(),
                                    box = this.presentationArea();
                                this.zoomX = parent.w / box.w;
                                this.zoomY = parent.h / box.h;
                                this.zoom = Math.min(this.zoomX, this.zoomY);
                                canvas.width = canvas.style.width = bkWidth * this.zoom;
                                canvas.height = canvas.style.height = bkHeight * this.zoom;
                                this.adjustCanvasParent(box, parent);
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
                            },
                            scope: {
                                get: () => scope
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
                        project.preparePresentation(wrapper, bitmap);
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
        .factory("ProjectPresentationArea", ["_", function (_) {
            function PresentationAreaFactory(project, ref = {mode: "Full"}) {
                return Object.create({}, {
                    mode: {
                        enumerable: true,
                        get: () => ref.mode,
                        set: v => ref.mode = v
                    },
                    x1: {
                        enumerable: true,
                        get: () => ref.x1,
                        set: v => ref.x1 = v
                    },
                    x2: {
                        enumerable: true,
                        get: () => ref.x2,
                        set: v => ref.x2 = v
                    },
                    y1: {
                        enumerable: true,
                        get: () => ref.y1,
                        set: v => ref.y1 = v
                    },
                    y2: {
                        enumerable: true,
                        get: () => ref.y2,
                        set: v => ref.y2 = v
                    },
                    _x1: {
                        get: ()=> ref.x1,
                        set: v=> {
                            ref.x1 = v;
                            if (project.stage)
                                project.stage.presentationArea.draw(true);
                        }
                    },
                    _x2: {
                        get: ()=> ref.x2,
                        set: v=> {
                            ref.x2 = v;
                            if (project.stage)
                                project.stage.presentationArea.draw(true);
                        }
                    },
                    _y1: {
                        get: ()=> ref.y1,
                        set: v=> {
                            ref.y1 = v;
                            if (project.stage)
                                project.stage.presentationArea.draw(true);
                        }
                    },
                    _y2: {
                        get: ()=> ref.y2,
                        set: v=> {
                            ref.y2 = v;
                            if (project.stage)
                                project.stage.presentationArea.draw(true);
                        }
                    }
                });
            }

            function wrap(project) {
                return {
                    fullPresentationArea(){
                        project.presentationArea.mode = "Full";
                    }
                };
            }

            return function (project) {
                let presentationArea = PresentationAreaFactory(project);
                _.each(wrap(project), (fn, key)=>project[key] = fn);
                Object.defineProperties(project, {
                    presentationArea: {
                        enumerable: true,
                        get: () => presentationArea,
                        set: v => presentationArea = PresentationAreaFactory(project, v)
                    }
                });
            };
        }])
        .factory("StagePresentationArea", ["_", "CreateJS", function (_, createjs) {
            function presentationAreaFactory(stage) {
                let zoomHandler = null, mousedown = null, pressmove = null, pressup = null;
                const shape = new createjs.Shape(),
                    wrapper = Object.create({
                        setToFull(){
                            wrapper.x1 = 0;
                            wrapper.y1 = 0;
                            wrapper.x2 = stage.originBox.w;
                            wrapper.y2 = stage.originBox.h;
                        },
                        draw(update){
                            if (stage.project.presentationArea.mode === "Full")
                                wrapper.setToFull();
                            shape.graphics.clear().s("red").sd([10, 10], 0)
                                .mt(wrapper.x1, wrapper.y1)
                                .lt(wrapper.x2, wrapper.y1)
                                .lt(wrapper.x2, wrapper.y2)
                                .lt(wrapper.x1, wrapper.y2)
                                .lt(wrapper.x1, wrapper.y1);
                            if (update)
                                stage.update();
                        },
                        destroy(){
                            stage.removeChild(shape);
                            stage.off("Zoom", zoomHandler);
                            stage.off("mousedown", mousedown);
                            stage.off("pressmove", pressmove);
                            stage.off("pressup", pressup);
                            stage.update();
                        }
                    }, {
                        x1: {
                            get: () => stage.metersToStage(stage.project.presentationArea.x1, "x"),
                            set: v => stage.project.presentationArea.x1 = Math.round10(stage.stageToMeters(v, "x"), -2)
                        },
                        x2: {
                            get: () => stage.metersToStage(stage.project.presentationArea.x2, "x"),
                            set: v => stage.project.presentationArea.x2 = Math.round10(stage.stageToMeters(v, "x"), -2)
                        },
                        y1: {
                            get: () => stage.metersToStage(stage.project.presentationArea.y1, "y"),
                            set: v => stage.project.presentationArea.y1 = Math.round10(stage.stageToMeters(v, "y"), -2)
                        },
                        y2: {
                            get: () => stage.metersToStage(stage.project.presentationArea.y2, "y"),
                            set: v => stage.project.presentationArea.y2 = Math.round10(stage.stageToMeters(v, "y"), -2)
                        }
                    });
                zoomHandler = stage.on("zoom", ()=>wrapper.draw);
                mousedown = stage.on("mousedown", (ev)=> {
                    stage.project.presentationArea.mode = "Area";
                    wrapper.x1 = ev.stageX / stage.zoom;
                    wrapper.y1 = ev.stageY / stage.zoom;
                    wrapper.draw(true);
                    stage.scope.$apply();
                    ev.preventDefault();
                    ev.stopPropagation();
                });
                pressmove = stage.on("pressmove", (ev) => {
                    wrapper.x2 = ev.stageX / stage.zoom;
                    wrapper.y2 = ev.stageY / stage.zoom;
                    wrapper.draw(true);
                    stage.scope.$apply();
                    ev.preventDefault();
                    ev.stopPropagation();
                });
                pressup = stage.on("pressup", (ev) => {
                    if (Math.abs(wrapper.x1 - wrapper.x2) < 500 || Math.abs(wrapper.y1 - wrapper.y2) < 200) {
                        stage.scope.alert = {
                            type: "warning",
                            msg: "Presentation Area is too small. Setting Presentation to Full Mode"
                        };
                        stage.project.presentationArea.mode = "Full";
                        wrapper.draw(true);
                    }
                    else
                        stage.scope.$emit("shouldSave", "general");
                    stage.scope.$apply();
                    ev.preventDefault();
                    ev.stopPropagation();
                });
                shape.name = "Area";
                stage.addChild(shape);
                wrapper.draw(true);
                return wrapper;
            }

            function wrap(stage) {
                return {
                    startPresentationArea(){
                        stage.presentationArea = presentationAreaFactory(stage);
                    },
                    endPresentationArea(){
                        stage.presentationArea.destroy();
                    }
                };
            }

            return function (stage) {
                _.each(wrap(stage), (fn, k)=>stage[k] = fn);
            };
        }]);
})(angular.module(window.mainApp));