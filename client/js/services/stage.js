/**
 * Created by ralemy on 11/2/15.
 * Decorating Stage object to create double binding with Project
 *
 */

"use strict";

module.exports = (function (app) {
    app.factory("Stage", ["_", "$q", "$state", "$interval", "CreateJS", "Origin", "Ruler", "Tracer", "Zones", "Reader", "Item",
        "TimeLapse", "StagePresentationArea", "HeatMap",
        function (_, $q, $state, $interval, createjs, Origin, Ruler, Tracer, Zones, Reader, Item,
                  TimeLapse, PresentationArea, HeatMap) {
            var main = new createjs.Container(),
                canvas = document.createElement("canvas"),
                stage = new createjs.Stage(canvas),
                timeLapse = TimeLapse(),
                floorPlan, project, bkWidth = 1300, bkHeight = 700, events = {}, zone = null, zoneCollection = [],
                readers = [], reader = null,
                items = {}, itemInterval = null, item = null, activeTweens = 0,
                itemHandlers=[],
                layers = ["Floorplan", "Origin", "Zone", "Count", "Field", "Reader", "Item", "Ruler", "Tracer", "TimeLapse", "Area"],
                wrapper = Object.create({
                        offAll: function () {
                            _.each(events, function (v, k) {
                                stage.off(k, v);
                            });
                        },
                        initLayers: function () {
                            main.removeAllChildren();
                            var children = _.map(layers, function (l) {
                                var layer = new createjs.Container();
                                layer.name = l;
                                return layer;
                            });
                            main.addChild.apply(main, children);
                        },
                        duplicateCanvas(canvas){
                            let newCanvas = document.createElement("canvas");
                            newCanvas.width = canvas.width;
                            newCanvas.height = canvas.height;
                            newCanvas.style.position = "absolute";
                            newCanvas.style.top = newCanvas.style.left = "0";
                            return newCanvas;
                        },
                        syncCoords(target){
                            target.width = canvas.width;
                            target.height = canvas.height;
                        },
                        selectLayer: function (c) {
                            var i = _.findIndex(layers, function (l) {
                                return l === c.name;
                            });
                            return (i === -1) ? i = layers.length - 1 : i;
                        },
                        addChild: function () {
                            var args = Array.prototype.slice.call(arguments),
                                self = this;
                            _.each(args, function (c) {
                                main.children[self.selectLayer(c)].addChild(c);
                            });
                        },
                        removeChild: function () {
                            var args = Array.prototype.slice.call(arguments),
                                self = this;
                            _.each(args, function (c) {
                                main.children[self.selectLayer(c)].removeChild(c);
                            });
                        },
                        link: function (scope, el) {
                            var self = this;
                            el[0].appendChild(canvas);
                            self.offAll();
                            events.mousedown = stage.on("mousedown", function (ev) {
                                switch ($state.current.name) {
                                    case "floorPlan.origin":
                                        self._origin = {x: ev.stageX / self.zoom, y: ev.stageY / self.zoom};
                                        break;
                                    case "floorPlan.trace":
                                        Tracer.mousedown(ev);
                                        break;
                                    case "floorPlan.ruler":
                                    case "floorPlan.area":
                                        return;
                                    default:
                                        return $state.go("floorPlan");
                                }
                                scope.$apply();
                            });

                            events.pressmove = stage.on("pressmove", function (ev) {
                                if ($state.current.name === "floorPlan.origin")
                                    self._origin = {x: ev.stageX / self.zoom, y: ev.stageY / self.zoom};
                                else if ($state.current.name === "floorPlan.trace")
                                    Tracer.pressmove(ev);
                                scope.$apply();
                            });

                            events.pressup = stage.on("pressup", () => {
                                if ($state.current.name === "floorPlan.origin") {
                                    if (project.showReaders)
                                        this.refreshReaders();
                                    if (project.zones)
                                        this.zones = project.zones;
                                }

                            });
                            events.dblclick = stage.on("dblclick", function (ev) {
                                if ($state.current.name === "floorPlan.trace")
                                    Tracer.dblclick(ev);
                                else
                                    return;
                                scope.$apply();
                            });
                            scope.$on("EndPlanState", function (ev, state) {
                                switch (state) {
                                    case "ruler":
                                        break;
                                    case "trace":
                                        return self.endTrace();
                                    case "zone":
                                        return self.endZone();
                                    case "reader":
                                        return self.endReader();
                                    case "item":
                                        return self.endItem();
                                    case "area":
                                        return self.endPresentationArea();
                                    default:
                                        break;
                                }
                            });
                            scope.$on("StartPlanState", function (ev, state) {
                                switch (state) {
                                    case "ruler":
                                        return self.addRuler();
                                    case "trace":
                                        return self.startTrace();
                                    case "zone":
                                        return self.startZone();
                                    case "reader":
                                        return self.startReader();
                                    case "item":
                                        return self.startItem();
                                    case "area":
                                        return self.startPresentationArea();
                                    default:
                                        break;
                                }
                            });
                            self.scope = scope;
                            if (self.project && undefined === self.origin.x)
                                self._origin = self.visibleCenter();
                            self.update();
                        },
                        canvasToMeters(v, axis){
                            return this.stageToMeters(this.screenToCanvas(v), axis);
                        },
                        screenToCanvas: function (v) {
                            return v / this.zoom;
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
                        startZone: function () {
                            this.zone = $state.params.zone;
                        },
                        endZone: function () {
                            this.zone = null;
                        },
                        startReader: function () {
                            this.reader = $state.params.reader;
                        },
                        endReader: function () {
                            this.reader = null;
                        },
                        startItem: function () {
                            this.item = $state.params.item;
                        },
                        endItem: function () {
                            this.item = null;
                        },
                        startTrace() {
                            const makeZonePoint = (p) => {
                                return {
                                    x: Math.round10(this.stageToMeters(p.x, "x"), -2),
                                    y: Math.round10(this.stageToMeters(p.y, "y"), -2),
                                    z: 0
                                };
                            };
                            return Tracer.trace(this).then((points) => {
                                return this.selectZone(project.addZone(_.map(points, p => makeZonePoint(p))));
                            });
                        },
                        selectZone: function (zone) {
                            _.find(zoneCollection, wrapper => wrapper.zone === zone).activate();
                        },
                        deleteZone: function () {
                            const idx = _.findIndex(this.zones, zone => zone === this.zone.model.ref),
                                shapeIdx = _.findIndex(zoneCollection, z => z === this.zone);
                            if (idx !== -1) {
                                this.zones.splice(idx, 1);
                                this.scope.$emit("shouldSave", "zones");
                                zoneCollection.splice(shapeIdx, 1);
                            }
                            this.zone.destroy();
                            $state.go("floorPlan");
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
                        endTrace: function () {
                            Tracer.cancel();
                        },
                        hideRuler: function () {
                            this.removeChild(Ruler.shape);
                            this.update();
                        },
                        setRulerLength: function (v) {
                            Ruler.length = v;
                            this.update();
                        },
                        showRuler(){
                            this.hideRuler();
                            Ruler.coords.startX = undefined;
                            this.addRuler();
                        },
                        addRuler: function () {
                            if (!this.isRulerVisible())
                                this.addChild(Ruler.shape);
                            if (!Ruler.coords.startX)
                                this.putRulerInCenter();
                            Ruler.draw(true);
                            this.rulerLength = Ruler.length;
                        },
                        isRulerVisible(){
                            return this.containsShape(Ruler.shape);
                        },
                        putRulerInCenter(){
                            Ruler.coords.init(this.visibleCenter(), 20);
                            Ruler.draw(true);
                            this.rulerLength = Ruler.length;
                        },
                        zoneUnderRuler(endpoint){
                            let shape = null;
                            if (this.isRulerVisible())
                                shape = _.find(zoneCollection, z => z.hitTest(Ruler.coords[endpoint + "X"], Ruler.coords[endpoint + "Y"]));
                            return shape ? shape.zone : null;
                        },
                        setFloorPlan: function (plan) {
                            var self = this;
                            return (plan) ?
                                angular.promiseBitmap(plan).then(function (bitmap) {
                                    bitmap.name = "Floorplan";
                                    self.floorPlan = bitmap;
                                    return bitmap;
                                }) :
                                $q.reject();
                        },
                        widthZoom: function () {
                            return bkWidth && canvas.parentNode ? canvas.parentNode.clientWidth / bkWidth : 1;
                        },
                        visibleCenter: function () {
                            if (!canvas.parentElement)
                                return {};
                            var visibleWidth = canvas.parentElement.clientWidth,
                                scrollLeft = canvas.parentElement.scrollLeft,
                                canvasWidth = canvas.width,
                                visibleHeight = canvas.parentElement.clientHeight,
                                scrollTop = canvas.parentElement.scrollTop,
                                canvasHeight = canvas.height,
                                screenX = (canvasWidth < visibleWidth) ? canvasWidth / 2 : scrollLeft + (visibleWidth / 2),
                                screenY = (canvasHeight < visibleHeight) ? canvasHeight / 2 : scrollTop + (visibleHeight / 2),
                                zoom = this.zoom || this.widthZoom();
                            return {
                                x: screenX / zoom,
                                y: screenY / zoom
                            };
                        },
                        putReaderInCenter: function (reader) {
                            let screenCenter = this.visibleCenter();
                            reader.placement.x = Math.round10(this.stageToMeters(screenCenter.x, "x"), -2);
                            reader.placement.y = Math.round10(this.stageToMeters(screenCenter.y, "y"), -2);
                            reader.placement.z = 1.5;
                            reader.placement.yaw = 0;
                            this.addReader(reader);
                        },
                        connect: function (p) {
                            var self = this;
                            if (p === project)
                                return;
                            if (project)
                                project.disconnect(this);
                            project = p;
                            if (!p || !p.floorPlan)
                                return;
                            this.setFloorPlan(p.floorPlanUrl);
                            this.zones = p.zones;
                            self.showReaders(p.showReaders);
                            self.dispatchEvent(new createjs.Event("connect").set({
                                project: p
                            }));
                            self.update();
                        },
                        disconnect: function () {
                            project = null;
                            this.initLayers();
                            this.update();
                        },
                        drawOrigin: function () {
                            Origin.draw(true);
                        },
                        setOrigin: function (x, y) {
                            this.origin.x = bkWidth * x;
                            this.origin.y = bkHeight * y;
                            if (project.showReaders)
                                this.refreshReaders();
                            if (project.zones)
                                this.zones = project.zones;
                            this.drawOrigin();
                        },
                        update: function () {
                            if (this.activeTweens <= 0)
                                if ($state.current.name.indexOf("floorPlan") === 0)
                                    stage.update();
                        },
                        updateReader: function (reader) {
                            var target = _.find(readers, (r) => r.ref === reader.placement);
                            if (target)
                                target.draw(true);

                        },
                        addReader: function (ref) {
                            if (ref && !ref.placement) return;
                            var reader = Reader.create(ref, this);
                            readers.push(reader);
                            return this.selectReader(reader);
                        },
                        selectReader: function (reader) {
                            this.reader = reader;
                            if (reader)
                                reader.activate(true);
                            return reader;
                        },
                        setReader: function (name) {
                            const reader = _.find(readers, r => r.model.name === name);
                            if (reader)
                                this.selectReader(reader);
                            return reader;
                        },
                        removeReader: function (reader) {
                            readers = _.filter(readers, function (r) {
                                return r !== reader;
                            });
                            reader.destroy();
                        },
                        refreshReaders(){
                            _.each(readers, r => r.destroy());
                            readers = _.map(_.filter(project.readers, r => r.placement), r => Reader.create(r, this, project.readerLLRP[r.name]));
                            this.update();
                        },
                        showReaders: function (v) {
                            var self = this;
                            if (v)
                                if (readers.length)
                                    _.each(readers, function (r) {
                                        r.draw();
                                    });
                                else
                                    readers = _.map(_.filter(project.readers, r => r.placement), function (reader) {
                                        return Reader.create(reader, self, project.readerLLRP[reader.name]);
                                    });
                            else
                                readers = _.reduce(readers, function (r, reader) {
                                    reader.destroy();
                                    return r;
                                }, []);
                            if ($state.current.name === "floorPlan.reader")
                                $state.go("floorPlan");
                            self.update();
                        },
                        showItems(v) {
                            if (v)
                                this.tweenItems(project.items);
                            else {
                                items = _.reduce(items, function (r, i) {
                                    i.destroy();
                                    return r;
                                }, {});
                                if ($state.current.name === "floorPlan.item")
                                    $state.go("floorPlan");
                            }
                            this.update();
                        },
                        pullItems: function (v) {
                            if (v) {
                                itemInterval = itemInterval || $interval(function () {
                                        if ($state.current.name.indexOf("floorPlan") === 0)
                                            project.getItems();
                                    }, project.pullInterval * 1000);
                                project.getItems();
                            }
                            else {
                                $interval.cancel(itemInterval);
                                itemInterval = null;
                            }
                            this.update();
                        },
                        tweenItems: function (itms) {
                            var self = this;
                            _.each(itms.data, function (i) {
                                if (_.find(itemHandlers, handler => !handler(i, items.data)))
                                    return;
                                if (items[i.epc])
                                    items[i.epc].tween(i);
                                else
                                    items[i.epc] = Item(i, self);
                                items[i.epc].keep = true;
                            });
                            _.each(items, function (i) {
                                if (i.keep)
                                    return delete i.keep;
                                delete items[i.model.epc];
                                i.destroy();
                            });
                            if (project.timeLapse)
                                timeLapse.draw(project.timeLapseData.getTimeLapse());
                            self.update();
                        },
                        containsShape: function (shape) {
                            var i = this.selectLayer(shape);
                            return main.children[i].contains(shape);
                        },
                        setEpcFilter: function () {
                            if (project.showItems)
                                if (!project.pullItems)
                                    this.showItems(true);
                        },
                        markEngagedReaders: function (engaged) {
                            engaged = engaged || {};
                            _.each(readers, (r) => r.setStatus(engaged[r.model.name] || "inactive"));
                            this.update();
                        }
                    },
                    {
                        floorPlan: {
                            get: function () {
                                return floorPlan;
                            },
                            set: function (v) {
                                if (floorPlan)
                                    this.removeChild(floorPlan);
                                floorPlan = v;
                                if (!v) return;
                                bkWidth = canvas.width = v.image.width;
                                bkHeight = canvas.height = v.image.height;
                                this.addChild(v);
                                if (!this.containsShape(Origin.shape))
                                    this.addChild(Origin.shape);
                                if (!this.containsShape(timeLapse.shape))
                                    this.addChild(timeLapse.shape);
                                project.zoom = this.zoom || this.widthZoom();
                                if (this.origin.x === undefined)
                                    this._origin = this.visibleCenter();
                                else
                                    Origin.draw(true);
                            }
                        },
                        _origin: {
                            get: () => project.origin,
                            set: function (v) {
                                this.origin = v;
                                if (this.scope)
                                    this.scope.$emit("shouldSave", "general");
                            }
                        },
                        origin: {
                            enumerable: true,
                            get: function () {
                                return project.origin;
                            },
                            set: function (v) {
                                project.origin.x = v.x;
                                project.origin.y = v.y;
                                Origin.draw(true);
                            }
                        },
                        zoom: {
                            enumerable: true,
                            get: function () {
                                return project.zoom;
                            },
                            set: function (v) {
                                if (!this.floorPlan) return;
                                canvas.width = bkWidth * v;
                                canvas.height = bkHeight * v;
                                main.setTransform(0, 0, v, v);
                                stage.dispatchEvent("Zoom");
                                this.update();
                            }
                        },
                        originBox: {
                            enumerable: false,
                            get: function () {
                                return {
                                    x: this.origin.x,
                                    y: this.origin.y,
                                    w: bkWidth,
                                    h: bkHeight
                                };
                            }
                        },
                        rulerCoords: {
                            get: function () {
                                return Ruler.coords;
                            }
                        },
                        rulerLength: {
                            enumerable: false,
                            get: function () {
                                return project.rulerLength;
                            },
                            set: function (v) {
                                project.rulerLength = v;
                            }
                        },
                        zones: {
                            enumerable: false,
                            get: function () {
                                return project.zones;
                            },
                            set(v){
                                _.each(zoneCollection || [], zone => zone.destroy());
                                zoneCollection = _.map(v || [], zone => zone.floor === project.floorName ? Zones.createZone(zone, this) : null);
                                zoneCollection = _.filter(zoneCollection, z => z);
                            }
                        },
                        zone: {
                            enumerable: false,
                            get: function () {
                                return zone;
                            },
                            set: function (v) {
                                if (zone && v !== zone)
                                    zone.deactivate();
                                zone = v;
                                project.zone = v ? v.model : null;
                            }
                        },
                        zoneCollection: {
                            get: () => zoneCollection
                        },
                        scale: {
                            enumerable: false,
                            get: function () {
                                return project.scale;
                            }
                        },
                        reader: {
                            enumerable: false,
                            get: function () {
                                return reader;
                            },
                            set: function (v) {
                                if (reader && v !== reader)
                                    reader.deactivate();
                                reader = v;
                                project.reader = v ? _.find(project.readers, function (r) {
                                        return r.placement === v.ref;
                                    }) : null;
                            }
                        },
                        item: {
                            get: function () {
                                return item;
                            },
                            set: function (v) {
                                if (item && v !== item)
                                    item.deactivate();
                                item = v;
                                project.item = v ? v.model : null;
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
                        showReaderFields: {
                            get: function () {
                                return project.showReaderFields;
                            }
                        },
                        epcFilter: {
                            get: function () {
                                return project.epcFilter;
                            }
                        },
                        timeLapse: {
                            set: function (v) {
                                if (v)
                                    timeLapse.draw(project.timeLapseData.getTimeLapse(), true);
                                else
                                    timeLapse.clear(true);
                            }
                        },
                        tracePoints: {
                            set: function (v) {
                                project.tracePoints = v;
                            }
                        },
                        project: {
                            get: () => project
                        },
                        canvas: {
                            get: () => canvas
                        },
                        itemHandlers: {
                            get: () => itemHandlers
                        }
                    });
            canvas.width = bkWidth;
            canvas.height = bkHeight;
            canvas.setAttribute("oncontextmenu", "return false;");
            let mouseDiv = null;
            canvas.onmousemove = function (ev) {
                const x = Math.round10(wrapper.canvasToMeters(ev.offsetX, "x"), -2),
                    y = Math.round10(wrapper.canvasToMeters(ev.offsetY, "y"), -2);
                mouseDiv = mouseDiv || document.querySelector("#mouseCoords");
                if (wrapper.zoom)
                    mouseDiv.innerHTML = `${x}, ${y}`;
            };
            canvas.onmouseout = function () {
                mouseDiv = mouseDiv || document.querySelector("#mouseCoords");
                if (mouseDiv)
                    mouseDiv.innerHTML = "";
                mouseDiv = null;
            };
            wrapper.initLayers();
            stage.addChild(main);
            wrapper.addChild(Origin.shape);
            wrapper.itemHandlers.push(item => item.epc.match(wrapper.epcFilter));
            Origin.stage = wrapper;
            Ruler.init(wrapper);
            timeLapse.init(wrapper);
            function switchFocus(ev, focus) {
                $state.params[focus] = ev[focus];
                if (wrapper[focus] && wrapper[focus] !== ev[focus]) wrapper[focus] = ev[focus];
                if (wrapper.scope && ev.force)
                    wrapper.scope.$apply();
                $state.go("floorPlan." + focus, $state.params);
            }

            stage.on("newZone", function (ev) {
                switchFocus(ev, "zone");
            });
            stage.on("newReader", function (ev) {
                switchFocus(ev, "reader");
            });
            stage.on("newItem", function (ev) {
                switchFocus(ev, "item");
            });
            stage.on("shouldSave", function (ev) {
                wrapper.scope.$emit("shouldSave", ev.subject);
            });
            createjs.Ticker.setFPS(30);
            createjs.Ticker.addEventListener("tick", function () {
                if (wrapper.activeTweens > 0)
                    stage.update();
            });
            PresentationArea(wrapper);
            HeatMap(wrapper);
            return wrapper;
        }]);
})(angular.module(window.mainApp));
