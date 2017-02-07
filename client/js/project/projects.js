/**
 * Created by ralemy on 11/1/15.
 * Collection of services used in the angular app.
 */

"use strict";

module.exports = (function (app) {
    app.factory("PresentationCandidates", ["_", function (_) {
        return function (project, selection) {
            return function () {
                function canInclude(hash, cls) {
                    return _.reduce(selection, function (r, v, k) {
                        return k === cls ? r : r && v.Property === hash[k];
                    }, true);
                }

                function findHashes(cls) {
                    return _.reduce(project.itemHash, function (result, hash) {
                        if (!result[hash[cls]])
                            if (canInclude(hash, cls))
                                result[hash[cls]] = true;
                        return result;
                    }, {});
                }

                function toArray(hash) {
                    return _.map(hash, function (v, k) {
                        if (v)
                            return k;
                    });
                }

                return _.reduce(Object.keys(project.classes), function (r, v) {
                    r[v] = toArray(findHashes(v));
                    return r;
                }, {});
            };
        };

    }])
        .factory("ProjectOrigin", [function () {
            return function (ref) {
                ref = ref ? ref.origin || {} : {};
                var x = ref.x, y = ref.y, project;
                return Object.create({}, {
                    x: {
                        enumerable: true,
                        get: function () {
                            return x;
                        },
                        set: function (v) {
                            x = v;
                        }
                    },
                    y: {
                        enumerable: true,
                        get: function () {
                            return y;
                        },
                        set: function (v) {
                            y = v;
                        }
                    },
                    project: {
                        enumerable: false,
                        get: function () {
                            return project;
                        },
                        set: function (v) {
                            project = v;
                        }
                    },
                    _x: {
                        enumerable: false,
                        get: function () {
                            return Math.round10(this.x, -2);
                        },
                        set: function (v) {
                            this.x = v;
                            if (this.project.stage)
                                this.project.stage.drawOrigin();
                        }
                    },
                    _y: {
                        enumerable: false,
                        get: function () {
                            return Math.round10(this.y, -2);
                        },
                        set: function (v) {
                            this.y = v;
                            if (this.project.stage)
                                this.project.stage.drawOrigin();
                        }
                    },
                    X: {
                        get: function () {
                            if (this.project.scale)
                                return Math.round10(this.x / this.project.scale, -2);
                        },
                        set: function (v) {
                            this._x = v * (this.project.scale || 1.0);
                        }
                    },
                    Y: {
                        get: function () {
                            if (this.project.scale)
                                return Math.round10(this.y / this.project.scale, -2);
                        },
                        set: function (v) {
                            this._y = v * (this.project.scale || 1.0);
                        }
                    }
                });
            };
        }])
        .factory("ProjectObject", ["_", "ProjectOrigin", "$interval", "ProjectZones", "ProjectReaders",
            "ProjectPresentationArea",
            function (_, projectOrigin, $interval, ProjectZones, ProjectReaders, PresentationArea) {
                function TimeLapseData() {
                    var base = [], project = null, self = this;
                    this.add = function addItems(items, timeLapse) {
                        var item = _.find(items.data, function (i) {
                            return i.epc === timeLapse;
                        });
                        base.unshift(item);
                        if (base.length > 20)
                            base.pop();
                    };
                    this.replace = function (items, timeLapse) {
                        if (timeLapse)
                            self.add(items, timeLapse);
                        else
                            base = [];
                    };
                    this.getBase = function () {
                        return base;
                    };
                    this.getTimeLapse = function () {
                        var map = _.reduce(base, function (r, i) {
                            if (!i) return r;
                            var key = i.xLocation + "_" + i.yLocation;
                            if (!r[key])
                                r[key] = {x: i.xLocation, y: i.yLocation, value: 0};
                            r[key].value += 1;
                            return r;
                        }, {});
                        return _.map(map, function (i) {
                            return i;
                        });
                    };
                    this.setProject = function (p) {
                        project = p;
                    };
                }

                return function (ref) {
                    ref = JSON.parse(JSON.stringify(ref || {}));
                    var zoom = null,
                        floorPlan = null,
                        floorPlanVersion = 1,//just to force the reload of floorplan. doesn't actually keep version
                        origin = projectOrigin(ref),
                        shouldSave = {},
                        name = "",
                        itemSense = "",
                        rulerLength = 1,
                        scale = 1.0,
                        items = null,
                        item = null,
                        itemSource = "Direct Connection",
                        nodeRedEndPoint = null,
                        showItems = false,
                        pullItems = false,
                        pullInterval = 1,
                        moveAnimation = "jump",
                        stage = null,
                        recipes = null,
                        recipe = null,
                        duration = 20,
                        job = null,
                        jobInterval = null,
                        jobMonitor = false,
                        targets = {},
                        selection = {},
                        epcFilter = ".",
                        timeLapse = false,
                        timeLapseFlag = false,
                        timeLapseData = new TimeLapseData();

                    var project = Object.create({
                            disconnect: function () {
                                if (stage)
                                    stage.disconnect();
                                stage = null;
                            },
                            zoomWidth: function () {
                                if (stage)
                                    this.zoom = stage.widthZoom();
                            },
                            canShowItems: function () {
                                return items && items.data.length;
                            },
                            canPullItems: function () {
                                return this.isJobRunning();
                            },
                            canConnect: function () {
                                if (this.handle)
                                    if (this.itemSense)
                                        if (this.itemSense.trim())
                                            return true;
                                return false;
                            },
                            isJobRunning: function () {
                                if (!job)
                                    return false;
                                if (_.find(["COMPLETE", "STOPPED"], function (c) {
                                        return c === job.status;
                                    }))
                                    return false;
                                if (jobMonitor)
                                    return true;
                                if (this.jobShouldHaveFinished())
                                    this.jobMonitor = true;
                                return true;
                            },
                            jobShouldHaveFinished: function () {
                                if (!job)
                                    return false;
                                var start = new Date(job.creationTime.substr(0, 24)).getTime(),
                                    now = new Date().getTime(),
                                    elapsed = (now - start) / 1000,
                                    duration = job.job.durationSeconds;
                                return elapsed > duration;
                            },
                            baseChanged: function () {
                                this.showItems = false;
                                this.pullItems = false;
                                this.showReaders = false;
                                this.jobMonitor = false;
                                this.readers = null;
                                this.items = null;
                                this.recipes = null;
                                this.recipe = null;
                                this.job = null;
                            },
                            setOrigin: function (x, y) {
                                shouldSave.general = true;
                                if (stage) stage.setOrigin(x, y);
                            },
                            addTarget: function (k, data) {
                                if (k === "symbols")
                                    targets.symbols = data;
                                else {
                                    targets.hash = data.hash;
                                    targets.classes = data.classes;
                                }
                            },
                            symbolImage: function (fileName) {
                                return "/projects/" + this.handle + "/symbols/" + fileName;
                            },
                            getSymbol: function (epc) {
                                try {
                                    return this.symbols[this.itemHash[epc].Category.toLowerCase()];
                                } catch (e) {
                                    return null;
                                }
                            },
                            placeReader: function (reader) {
                                if (!stage) return;
                                reader.placement = {floor: this.floorName};
                                stage.putReaderInCenter(reader);
                                this.shouldSave.readers=true;
                            },
                            preparePresentation: function (stage, bitmap) {
                                this.jobMonitor = false;
                                this.pullItems = false;
                                this.showReaders = false;
                                this.showItems = false;
                                this.updateSelection = function () {
                                    stage.removeAllChildren();
                                    stage.addChild(bitmap);
                                    _.each(stage.items, function (i) {
                                        i.destroy();
                                    });
                                    stage.items = {};
                                    if (stage.itemData)
                                        stage.showItems(stage.itemData);
                                    stage.update();
                                };
                            },
                            stageToMeters: function (v, axis) {
                                return this.stage ? this.stage.stageToMeters(v, axis) : v;
                            },
                            setScale: function (v) {
                                if (v === null)
                                    this.scale = null;
                                else
                                    this.scale = this.rulerLength / v;
                                if (this.showReaders && this.stage)
                                    this.stage.refreshReaders();
                                if (this.zones && this.stage)
                                    this.stage.zones = this.zones;
                            },
                            defaultFloorPlan(project){
                                this.scale = project.scale;
                                this.origin = projectOrigin(project);
                                this.origin.project = this;
                                this.floorPlan = project.floorPlan;
                                this.zoom = project.zoom;
                            }
                        },
                        {
                            stage: {
                                get: function () {
                                    return stage;
                                },
                                set: function (v) {
                                    if (v === stage)
                                        return;
                                    if (stage)
                                        stage.disconnect();
                                    if (v)
                                        v.connect(this);
                                    stage = v;
                                }
                            },
                            shouldSave: {
                                get: function () {
                                    return shouldSave;
                                },
                                set: function (v) {
                                    shouldSave = v;
                                }
                            },
                            floorPlanUrl: {
                                get: function () {
                                    return "/projects/" + this.handle + "/" + (floorPlan || "default") + "?v=" + floorPlanVersion;
                                }
                            },
                            rulerCoords: {
                                get: function () {
                                    return stage ? stage.rulerCoords : null;
                                }
                            },
                            rulerLength: {
                                get: function () {
                                    return rulerLength;
                                },
                                set: function (v) {
                                    rulerLength = v;
                                }
                            },
                            _rulerLength: {
                                get: function () {
                                    if (!this.rulerLength)
                                        return this.rulerLength;
                                    return Math.round10(this.rulerLength, -2);
                                },
                                set: function (v) {
                                    this.rulerLength = v;
                                    if (stage)
                                        stage.setRulerLength(v);
                                }
                            },
                            _rulerMeters: {
                                get: function () {
                                    if (this.scale === null)
                                        return null;
                                    return Math.round10(this.rulerLength / this.scale, -2);
                                },
                                set: function (v) {
                                    if (v === null)
                                        return null;
                                    this._rulerLength = v * this.scale;
                                }
                            },
                            _scale: {
                                get: function () {
                                    if (this.scale === null)
                                        return null;
                                    return Math.round10(this.scale, -2);
                                },
                                set: function (v) {
                                    this.scale = v;
                                }
                            },
                            items: {
                                get: function () {
                                    return items;
                                },
                                set: function (v) {
                                    if (timeLapse)
                                        timeLapseData.add(v, timeLapse);
                                    else
                                        timeLapseData.replace(items, timeLapse);
                                    items = v;
                                }
                            },
                            timeLapseFlag: {
                                get: function () {
                                    return timeLapseFlag;
                                },
                                set: function (v) {
                                    timeLapseFlag = v;
                                }
                            },
                            timeLapse: {
                                get: function () {
                                    return timeLapse;
                                },
                                set: function (v) {
                                    timeLapse = v;
                                    timeLapseData.replace(items, timeLapse);
                                    if (stage)
                                        stage.timeLapse = v;
                                }
                            },
                            timeLapseData: {
                                get: function () {
                                    return timeLapseData;
                                },
                                set: function (v) {
                                    timeLapseData.replace(v);
                                }
                            },
                            item: {
                                get: function () {
                                    return item;
                                },
                                set: function (v) {
                                    this.timeLapseFlag = false;
                                    this.timeLapse = false;
                                    item = v;
                                }
                            },
                            recipes: {
                                get: function () {
                                    return recipes;
                                },
                                set: function (v) {
                                    recipes = v;
                                }
                            },
                            job: {
                                get: function () {
                                    return job;
                                },
                                set: function (v) {
                                    job = v;
                                }
                            },
                            jobInterval: {
                                get: function () {
                                    return jobInterval;
                                },
                                set: function (v) {
                                    if (jobInterval && jobInterval !== v)
                                        $interval.cancel(jobInterval);
                                    jobInterval = v;
                                    jobMonitor = v ? true : false;
                                }
                            },
                            jobMonitor: {
                                enumerable: true,
                                get: function () {
                                    return jobMonitor;
                                },
                                set: function (v) {
                                    if (this.job)
                                        this.jobInterval = v ? this.monitorJob() : null;
                                    else
                                        jobMonitor = v;
                                }
                            },
                            pullInterval: {
                                enumerable: true,
                                get: () => pullInterval,
                                set: function (v) {
                                    pullInterval = Math.max(v, 1);
                                }
                            },
                            moveAnimation: {
                                enumerable: true,
                                get: () => moveAnimation,
                                set: function (v) {
                                    moveAnimation = v;
                                }
                            },
                            showItems: {
                                enumerable: true,
                                get: function () {
                                    return showItems;
                                },
                                set: function (v) {
                                    showItems = v;
                                    if (stage && this.items)
                                        stage.showItems(v);
                                }
                            },
                            pullItems: {
                                enumerable: true,
                                get: function () {
                                    return pullItems;
                                },
                                set: function (v) {
                                    pullItems = v;
                                    if (stage && this.recipes)
                                        stage.pullItems(v);
                                }
                            },
                            handle: {
                                enumerable: true,
                                get: function () {
                                    return (this.name || "").trim().replace(/[^-a-zA-Z0-9_.]/g, "_");
                                }
                            },
                            name: {
                                enumerable: true,
                                get: function () {
                                    return name;
                                },
                                set: function (v) {
                                    name = v;
                                }
                            },
                            itemSense: {
                                enumerable: true,
                                get: function () {
                                    return itemSense;
                                },
                                set: function (v) {
                                    itemSense = v;
                                    this.baseChanged(v);
                                }
                            },
                            zoom: {
                                enumerable: true,
                                get: function () {
                                    return zoom;
                                },
                                set: function (v) {
                                    zoom = v;
                                    if (stage)
                                        stage.zoom = v;
                                }
                            },
                            floorPlan: {
                                enumerable: true,
                                get: function () {
                                    return floorPlan;
                                },
                                set: function (v) {
                                    floorPlan = v;
                                    floorPlanVersion += 1;
                                    if (stage)
                                        stage.setFloorPlan(this.floorPlanUrl);
                                }
                            },
                            origin: {
                                enumerable: true,
                                get: function () {
                                    return origin;
                                },
                                set: function (v) {
                                    origin = v;
                                    if (stage)
                                        stage.origin = v;
                                }
                            },
                            scale: {
                                enumerable: true,
                                get: function () {
                                    return scale;
                                },
                                set: function (v) {
                                    scale = v;
                                }
                            },
                            recipe: {
                                enumerable: true,
                                get: function () {
                                    return recipe;
                                },
                                set: function (v) {
                                    recipe = v;
                                }
                            },
                            duration: {
                                enumerable: true,
                                get: function () {
                                    return duration;
                                },
                                set: function (v) {
                                    duration = v;
                                }
                            },
                            targets: {
                                enumerable: true,
                                get: function () {
                                    return targets;
                                },
                                set: function (v) {
                                    targets = v;
                                }
                            },
                            symbols: {
                                get: function () {
                                    return targets.symbols;
                                },
                                set: function (v) {
                                    targets.symbols = v;
                                }
                            },
                            itemHash: {
                                get: function () {
                                    return targets.hash;
                                },
                                set: function (v) {
                                    targets.hash = v;
                                }
                            },
                            classes: {
                                get: function () {
                                    return targets.classes;
                                },
                                set: function (v) {
                                    targets.classes = v;
                                }
                            },
                            selection: {
                                get: function () {
                                    return selection;
                                },
                                set: function (v) {
                                    selection = v;
                                }
                            },
                            epcFilter: {
                                enumerable: true,
                                get: function () {
                                    return epcFilter || ".";
                                },
                                set: function (v) {
                                    epcFilter = (v || "").trim() || ".";
                                    if (stage)
                                        stage.setEpcFilter(epcFilter);
                                }
                            },
                            itemSource: {
                                enumerable: true,
                                get: () => itemSource,
                                set: function (v) {
                                    itemSource = v;
                                }
                            },
                            nodeRedEndPoint: {
                                enumerable: true,
                                get: () => nodeRedEndPoint,
                                set: function (v) {
                                    nodeRedEndPoint = v;
                                }
                            }
                        });
                    ProjectZones(project);
                    ProjectReaders(project);
                    PresentationArea(project);
                    origin.project = project;
                    timeLapseData.setProject(project);
                    if (ref.itemSense)
                        itemSense = ref.itemSense; //set itemsense url separately because it resets the object
                    delete ref.origin;
                    delete ref.itemSense;
                    _.each(ref || {}, function (v, k) {
                        try {
                            project[k] = v;
                        } catch (e) {
                            //just skip over read only properties
                        }
                    });
                    return project;
                };
            }])
        .factory("Project", ["_", "ProjectObject", "Server",
            function (_, projectObject, server) {
                return {
                    create: function (ref) {
                        var result = projectObject(ref);
                        _.each(server, function (v, k) {
                            result[k] = v;
                        });
                        return result;
                    },
                    copy: function (ref) {
                        return this.create(ref);
                    },
                    newProject: function () {
                        return this.create({name: ""});
                    },
                    get: function () {
                        var self = this;
                        return server.get.apply(this, arguments).then(function (project) {
                            return self.create(project);
                        }).catch(function (err) {
                            console.log("load error", err);
                        });
                    }
                };
            }]);
})(angular.module(window.mainApp));
