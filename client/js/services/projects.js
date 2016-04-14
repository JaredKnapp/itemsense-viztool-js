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
                            return Math.round10(this.x, -3);
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
                            return Math.round10(this.y, -3);
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
                                return Math.round10(this.x / this.project.scale, -3);
                        },
                        set: function (v) {
                            this._x = v * (this.project.scale || 1.0);
                        }
                    },
                    Y: {
                        get: function () {
                            if (this.project.scale)
                                return Math.round10(this.y / this.project.scale, -3);
                        },
                        set: function (v) {
                            this._y = v * (this.project.scale || 1.0);
                        }
                    }
                });
            };
        }])
        .factory("ProjectObject", ["_", "ProjectOrigin", "$interval", function (_, projectOrigin, $interval) {
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
                    floorName = null,
                    origin = projectOrigin(ref),
                    shouldSave = true,
                    name = "",
                    itemSense = "",
                    rulerLength = 1,
                    scale = 1.0,
                    zones = [],
                    zone = null,
                    zoneMaps = null,
                    zoneMap = null,
                    readers = null,
                    reader = null,
                    readerLLRP = {},
                    items = null,
                    item = null,
                    showReaders = false,
                    showReaderFields = 0,
                    showLLRP = false,
                    showItems = false,
                    pullItems = false,
                    stage = null,
                    mouse = null,
                    recipes = null,
                    recipe = null,
                    duration = 20,
                    job = null,
                    jobInterval = null,
                    jobMonitor = false,
                    targets = {},
                    selection = {},
                    facility = "DEFAULT",
                    facilities = null,
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
                    cloneZone: function () {
                        stage.cloneZone();
                    },
                    deleteZone: function () {
                        stage.deleteZone();
                    },
                    setTolerance: function () {
                        if (!this.zone.tolerance)
                            return;
                        stage.setTolerance(this.zone.tolerance);
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
                        if (stage)
                            stage.setOrigin(x, y);
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
                    },
                    updateReader: function (reader) {
                        if (stage)
                            stage.updateReader(reader);
                    },
                    newZoneMap: function (name) {
                        var zoneMap = {
                            name: name,
                            facility: this.facility,
                            zones: this.zoneMap ? [] : this.zones || []
                        };
                        this.addZoneMap(zoneMap);
                    }
                }, {
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
                            return "/projects/" + this.handle + "/" + floorPlan + "?v=" + floorPlanVersion;
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
                            return Math.round10(this.rulerLength, -3);
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
                            return Math.round10(this.rulerLength / this.scale, -3);
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
                            return Math.round10(this.scale, -3);
                        },
                        set: function (v) {
                            this.scale = v;
                        }
                    },
                    readers: {
                        get: function () {
                            return readers;
                        },
                        set: function (v) {
                            readers = v;
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
                    headMapFlag: {
                        get: function () {
                            return timeLapseFlag;
                        },
                        set: function (v) {
                            timeLapseFlag = v;
                        }
                    },
                    timeLapse: {
                        enumerable: true,
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
                    mouse: {
                        get: function () {
                            return mouse;
                        },
                        set: function (v) {
                            mouse = v;
                        }
                    },
                    reader: {
                        get: function () {
                            return reader;
                        },
                        set: function (v) {
                            reader = v;
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
                    zone: {
                        get: function () {
                            return zone;
                        },
                        set: function (v) {
                            zone = v;
                        }
                    },
                    floorName: {
                        enumerable: true,
                        get: function () {
                            return floorName;
                        },
                        set: function (v) {
                            floorName = v;
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
                            this.shouldSave = true;
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
                    zones: {
                        get: function () {
                            return zones;
                        },
                        set: function (v) {
                            zones = v;
                        }
                    },
                    zoneMaps: {
                        get: function () {
                            return zoneMaps;
                        },
                        set: function (v) {
                            zoneMaps = v;
                        }
                    },
                    _zoneMap: {
                        get: function () {
                            return this.zoneMap;
                        },
                        set: function (v) {
                            this.zoneMap = v;
                            this.setCurrentZoneMap(zoneMap.name);
                        }
                    },
                    zoneMap: {
                        get: function () {
                            return zoneMap;
                        },
                        set: function (v) {
                            zoneMap = v;
                            if (v)
                                this.zones = zoneMap.zones;
                            if (stage)
                                stage.replaceZoneCollection();
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
                            this.shouldSave = true;
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
                            this.shouldSave = true;
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
                    showReaders: {
                        enumerable: true,
                        get: function () {
                            return showReaders;
                        },
                        set: function (v) {
                            showReaders = v;
                            if (v && !readers && this.recipes)
                                this.getReaders().catch(function () {
                                    showReaders = false;
                                });
                            else if (stage)
                                stage.showReaders(v);
                        }
                    },
                    showLLRP: {
                        enumerable: true,
                        get: function () {
                            return showLLRP;
                        },
                        set: function (v) {
                            showLLRP = v;
                            if (v)
                                this.getLLRPStatus().then(status => {
                                    this.readerLLRP = status;
                                });
                            else
                                this.readerLLRP = {};
                        }
                    },
                    readerLLRP: {
                        get: function () {
                            return readerLLRP;
                        },
                        set: function (v) {
                            readerLLRP = v;
                            if (stage)
                                stage.markEngagedReaders(v);
                        }
                    },
                    showReaderFields: {
                        enumerable: true,
                        get: function () {
                            return showReaderFields;
                        },
                        set: function (v) {
                            showReaderFields = v;
                            if (stage && showReaders)
                                stage.showReaders(true);
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
                    facility: {
                        enumerable: true,
                        get: function () {
                            return facility || "DEFAULT";
                        },
                        set: function (v) {
                            facility = v;
                        }
                    },
                    facilities: {
                        get: ()=> facilities,
                        set: v => facilities = v
                    }
                });
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
        .factory("Server", ["_", "$http", "$q", "$rootScope", "$interval", function (_, $http, $q, $rootScope, $interval) {
            function errorDescription(response) {
                if (response.data)
                    if (response.data.msg)
                        if (response.data.msg.message)
                            return response.data.msg.message;
                        else
                            return response.data.msg;
                    else
                        return response.data;
                else
                    return response.statusText;
            }

            function restCall(opts) {
                var options = _.merge({
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    responseType: "json",
                    silent: {}
                }, opts);
                return $http(options).then(function (r) {
                    return r.data;
                }, function (response) {
                    var description = errorDescription(response);
                    if (!options.silent[response.status] && !options.silentAll)
                        $rootScope.alert = {
                            type: "warning",
                            msg: "Server error " + response.status + " " + description
                        };
                    return $q.reject(response);
                });
            }

            return {
                get: function (id) {
                    return restCall({
                        url: "/project/" + id
                    });
                },
                save: function () {
                    var self = this;
                    return restCall({
                        method: "POST",
                        url: "/project/",
                        data: self
                    }).then(function (data) {
                        if (self.zoneMap)
                            return self.addZoneMap(self.zoneMap).then(function () {
                                return data;
                            });
                        return data;
                    });
                },
                connect: function () {
                    var self = this;
                    return restCall({
                        method: "POST",
                        url: "/project/" + self.handle + "/connect",
                        data: self
                    }).then(function (data) {
                        self.recipes = data.recipes || [];
                        self.job = data.job;
                        self.facilities = _.map(data.facilities, f=>f.name);
                        self.zoneMaps = data.zoneMaps || [];
                        self.zoneMap = _.find(data.zoneMaps, function (z) {
                            return z.name === data.currentZoneMap.name;
                        });
                        self.recipe = data.job ? _.find(self.recipes, function (r) {
                            return r.name === data.job.job.recipeName;
                        }) : null;
                        self.duration = data.job ? data.job.job.durationSeconds : 20;
                        if (self.job) {
                            self.jobMonitor = self.jobMonitor;
                            self.pullItems = self.pullItems;
                        }
                        if (self.showReaders && !self.readers)
                            return self.getReaders();
                        return self;
                    });
                },
                getReaders: function () {
                    var self = this;
                    return restCall({
                        url: "/project/" + self.handle + "/readers"
                    }).then(function (readers) {
                        if (self.floorName)
                            readers = _.filter(readers, function (r) {
                                return r.placement.floor === self.floorName;
                            });
                        self.readers = readers;
                        if (self.stage)
                            self.stage.showReaders(self.showReaders);
                        return self;
                    });
                },
                postReaders: function (reader) {
                    var self = this;
                    return restCall({
                        url: "/project/" + self.handle + "/readers",
                        method: "POST",
                        data: reader
                    }).then(function () {
                        self.showReaders = false;
                        return self.getReaders().then(function () {
                            self.showReaders = true;
                        });
                    });
                },
                getRecipes: function () {
                    var self = this;
                    return restCall({
                        method: "POST",
                        url: "/project/" + self.handle + "/recipes",
                        data: self
                    }).then(function (recipes) {
                        self.recipes = recipes;
                        return self;
                    });
                },
                startJob: function () {
                    var self = this;
                    return restCall({
                        method: "POST",
                        url: "/project/" + self.handle + "/job",
                        data: {
                            recipeName: self.recipe.name,
                            durationSeconds: self.duration,
                            facility: self.facility
                        },
                        silent: {400: true}
                    }).then(function (job) {
                        self.job = job;
                        self.jobMonitor = true;
                        return self;
                    }, function (response) {
                        if (response.status === 400)
                            $rootScope.alert = {
                                type: "warning",
                                msg: response.data.msg.message
                            };
                        return $q.reject(response);
                    });
                },
                checkJob: function () {
                    var self = this;
                    if (self.job)
                        restCall({
                            url: "/project/" + self.handle + "/job/" + self.job.id,
                            silent: {all: true}
                        }).then(function (job) {
                            self.job = job;
                            if (!self.isJobRunning())
                                self.jobInterval = null;
                        });
                    else
                        self.jobInterval = null;
                },
                monitorJob: function () {
                    var self = this;
                    this.checkJob();
                    return (this.job) ?
                        $interval(function () {
                            self.checkJob();
                        }, 1000) : null;
                },
                stopJob: function () {
                    var self = this;
                    return restCall({
                        method: "DELETE",
                        url: "/project/" + self.handle + "/job/" + self.job.id
                    });
                },
                getItems: function (opts) {
                    var self = this;
                    return restCall(_.merge({
                        url: "/project/" + self.handle + "/items"
                    }, opts)).then(function (items) {
                        self.items = items;
                        self.showItems = self.showItems;
                        if (!self.isJobRunning())
                            self.pullItems = false;
                        return items;
                    });
                },
                addZoneMap: function (data) {
                    var self = this;
                    return restCall({
                        method: "POST",
                        url: "/project/" + self.handle + "/zones",
                        data: data
                    }).then(function (zoneMap) {
                        self.zoneMap = zoneMap;
                        self.zones = zoneMap.zones;
                    });
                },
                setCurrentZoneMap: function (name) {
                    var self = this;
                    return restCall({
                        method: "POST",
                        url: "/project/" + self.handle + "/zones/" + name
                    });
                },
                getLLRPStatus(){
                    return restCall({
                        url: `/project/${this.handle}/llrp`
                    });
                },
                getFacilities(){
                    return restCall({
                        method:"POST",
                        data:{
                            url:this.itemSense,
                            user: this.user,
                            password: this.password
                        },
                        url: `/project/${this.handle}/facilities`
                    }).then(facilities => this.facilities = _.map(facilities, f=> f.name));
                }
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
})
(angular.module(window.mainApp));
