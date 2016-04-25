/**
 * Created by ralemy on 11/19/15.
 * Item sense interface implementation
 *
 */
"use strict";

var q = require("q"),
    _ = require("lodash"),
    request = require("request"),
    util = require("./util"),
    project = null;


function wrapResults() {
    var counter = 0,
        items = {0: {}};
    return Object.create({}, {
        items: {
            get: function () {
                return items;
            }
        },
        last: {
            get: function () {
                return items[counter];
            },
            set: function (v) {
                counter = counter > 100 ? 1 : counter + 1;
                items[counter] = v;
            }
        },
        first: {
            get: function () {
                var v = items[counter + 1] || items[1];
            }
        }
    })

}

function createResultItem(data, tp) {
    var timePoint = {at: null, from: null, to: null};
    timePoint[tp] = new Date().getTime();
    return Object.create({}, {
        data: {
            enumerable: true,
            get: function () {
                return data;
            },
            set: function (v) {
                data = v;
            }
        }
        , at: {
            enumerable: true,
            get: function () {
                return timePoint.at;
            }
        }
        , from: {
            enumarable: true,
            get: function () {
                return timePoint.from;
            }
        }
        , to: {
            enumerable: true,
            get: function () {
                return timePoint.to;
            },
            set: function () {
                timePoint.to = new Date().getTime();
            }
        },
        isError: {
            enumerable: false,
            get: function () {
                return !!timePoint.from;
            }
        }
    });
}

class ConfigDump {

    constructor(itemsenseApi, project) {
        this.itemsenseApi = itemsenseApi;
        this.project = project;
        this.readerConfigs = {};
        this.readerDefinitions = {};
    }

    static createTemplate(type) {
        return type === "job" ? {
            signature: "",
            timestamp: new Date().toUTCString(),
            job: null,
            currentZoneMaps: [],
            recipe: null,
            readerConfigurations: [],
            readerDefinitions: [],
            zoneMaps: []
        } : {
            signature: "",
            timestamp: new Date().toUTCString(),
            recipes: null,
            readerConfigurations: null,
            readerDefinitions: null,
            zoneMaps: null,
            facilities: null,
            currentZoneMaps: []
        };
    }

    dumpAll() {
        const result = ConfigDump.createTemplate("all");
        result.signature = `Dump configuration for Itemsense Instance: ${this.project.itemSense}`;
        return this.itemsenseApi.recipes.getAll()
            .then((recipes) => {
                result.recipes = recipes;
                return this.itemsenseApi.readerConfigurations.getAll();
            })
            .then((readerConfigurations) => {
                result.readerConfigurations = readerConfigurations;
                return this.itemsenseApi.readerDefinitions.getAll();
            })
            .then((readerDefinitions) => {
                result.readerDefinitions = readerDefinitions;
                return this.itemsenseApi.zoneMaps.getAll();
            })
            .then((zoneMaps) => {
                result.zoneMaps = zoneMaps;
                return this.itemsenseApi.facilities.getAll();
            })
            .then((facilities) => {
                result.facilities = facilities;
                return q.all(this.saveCurrentZoneMaps(result, facilities));
            }).then(()=>result);

    }

    dumpJob(id) {
        const result = ConfigDump.createTemplate("job");
        result.signature = `Dump configuration for job: ${id} running on ${this.project.itemSense}`;
        return this.itemsenseApi.jobs.get(id).then((job) => {
                result.job = job;
                return this.itemsenseApi.recipes.get(job.job.recipeName);
            })
            .then((recipe)=> {
                result.recipe = recipe;
                return this.populateReaderInfo(result);
            })
            .then(()=> q.all(this.saveReaderInfo(result)))
            .then(()=> q.all(this.saveCurrentZoneMaps(result, result.job.facilities)))
            .then(()=> q.all(this.saveZoneMaps(result)))
            .then(()=> result);
    }

    populateReaderInfo(data) {
        const recipe = data.recipe, job = data.job;
        if (recipe.readerConfigurationName) {
            this.readerConfigs[recipe.readerConfigurationName] = true;
            _.each(job.readerNames, reader => this.readerDefinitions[reader] = true);
        }
        _.each(recipe.readerConfigurations, (readerConfig, name) => {
            this.readerConfigs[readerConfig] = true;
            this.readerDefinitions[name] = true;
        });
    }

    saveReaderInfo(result) {
        const promises = [],
            readerConfigs = this.readerConfigs,
            readerDefinitions = this.readerDefinitions,
            itemsense = this.itemsenseApi;
        _.each(readerConfigs, (v, configName) => {
            promises.push(itemsense.readerConfigurations.get(configName)
                .then(conf=> result.readerConfigurations.push(conf)));
        });
        _.each(readerDefinitions, (v, readerName) => {
            promises.push(itemsense.readerDefinitions.get(readerName)
                .then(def => result.readerDefinitions.push(def)));
        });
        return promises;
    }

    saveCurrentZoneMaps(result, facilities) {
        return _.map(facilities, (facility) => {
            return this.itemsenseApi.currentZoneMap.get(facility.name)
                .then((zonemap) => result.currentZoneMaps.push({
                    facility: facility,
                    zoneMap: zonemap
                }));

        });
    }

    saveZoneMaps(result) {
        return _.map(result.currentZoneMap, (zone) => this.itemsenseApi.zoneMaps.get(zone.zoneMap.name)
            .then(zoneMap => result.zoneMaps.push(zoneMap)));
    }
}

function startProject(project) {
    const itemsenseApi = util.connectToItemsense(project.itemSense.trim(), project.user, project.password);
    var readPromise = null, interval = null, itemSenseJob = null,
        results = wrapResults(),
        wrapper = Object.create({
                stash: function (promise) {

                    return promise.then(function (data) {
                        var now = new Date().getTime();
                        results.last = createResultItem(data.items, "at");
                        return results.last;
                    }, function (error) {
                        if (results.last.at)
                            results.last.to = true;
                        else
                            results.last = createResultItem(error, "from");
                        return q.reject(error);
                    }).finally(function () {
                        readPromise = null;
                    });
                },
                restCall(opts, user, password){
                    const defer = q.defer(),
                        options = _.extend({method: "GET", json: true}, opts),
                        req = request(options, function (err, response, body) {
                            if (err)
                                defer.reject(err);
                            else if (response.statusCode > 399)
                                defer.reject(response);
                            else
                                defer.resolve(body);
                        });
                    if (user)
                        req.auth(user, password);
                    return defer.promise;
                },
                getNodeRedFlow(){
                    readPromise = wrapper.stash(wrapper.restCall({url: project.nodeRedEndPoint}))
                        .catch(error=> {
                            console.log(error);
                            return q.reject(error)
                        });
                    return readPromise;
                },
                getDirect(){
                    readPromise = wrapper.stash(itemsenseApi.items.get({pageSize: 1000})).then(function (items) {
                        if (!itemSenseJob)
                            return q.reject({statusCode: 500, response: {body: "Job not started"}});
                        items.data = _.filter(items.data, function (i) {
                            return i.lastModifiedTime > itemSenseJob.creationTime
                        });
                        return items;
                    });
                    return readPromise;
                },
                getItems: function () {
                    if (readPromise)
                        return readPromise;
                    return project.itemSource === "Direct Connection" ? this.getDirect() : this.getNodeRedFlow();
                },
                dumpConfig(){
                    const worker = new ConfigDump(itemsenseApi, project);
                    if (itemSenseJob && !this.isComplete(itemSenseJob))
                        return worker.dumpJob(itemSenseJob.id);
                    return worker.dumpAll();
                },
                startJob: function (opts) {
                    var job = _.merge({
                        "recipeName": "RTL",
                        "durationSeconds": 20,
                        "playbackLoggingEnabled": false,
                        "presenceLoggingEnabled": false,
                        "startDelay": "PT0S"
                    }, opts);

                    return itemsenseApi.jobs.start(job).then(function (job) {
                        itemSenseJob = job;
                        return job;
                    });

                },
                postReaders: function (data) {
                    return itemsenseApi.readerDefinitions.update(data);
                },
                getReaders: function () {
                    return itemsenseApi.readerDefinitions.get().then(list => _.filter(list || [], this.inProject));
                },
                getRecipes: function (recipeName) {
                    return itemsenseApi.recipes.get(recipeName);
                },
                addZoneMap: function (data) {
                    var self = this;
                    return itemsenseApi.zoneMaps.update(data).then(function (zmap) {
                        if (!itemSenseJob)
                            return self.setCurrentZoneMap(zmap.name).then(function () {
                                return zmap;
                            });
                        return zmap;
                    });
                },
                deleteZoneMap: function (data) {
                    return itemsenseApi.zoneMaps.delete(data);
                },
                setCurrentZoneMap: function (name) {
                    return itemsenseApi.currentZoneMap.update(name);
                },
                getCurrentZoneMap() {
                    return itemsenseApi.currentZoneMap.get(project.facility);
                },
                getZoneMap(data) {
                    return data ? itemsenseApi.zoneMaps.get(data) : itemsenseApi.zoneMaps.getAll();
                },
                getFacilities: ()=> itemsenseApi.facilities.get(),
                getJobs: function (id) {
                    return itemsenseApi.jobs.get(id);
                },
                getRunningJob: function () {
                    return this.getJobs().then(function (jobs) {
                        return _.find(jobs, function (j) {
                            return j.status.indexOf("RUNNING") !== -1 && j.job.facility === project.facility;
                        });
                    });
                },
                getJobReaders: (job, recipe) => recipe.readerConfigurationName ? job.readerNames : Object.keys(recipe.readerConfigurations),
                inProject: reader => reader.facility === project.facility && reader.placement.floor === project.floorName,
                getLLRPStatus() {
                    const result = {};
                    return this.getReaders().then(readers=> {
                        result.readers = readers;
                        return this.getRunningJob();
                    }).then(job => {
                        result.job = itemSenseJob = job;
                        return job ? this.getRecipes(job.job.recipeName) : null;
                    }).then(recipe => {
                        if (!recipe) return {};
                        const jobReaders = this.getJobReaders(result.job, recipe);
                        return _.reduce(jobReaders, function (r, reader) {
                            r[reader] = "engage";
                            return r;
                        }, {});
                    }).then(inJob => {
                        const notInJob = _.filter(result.readers, reader => !inJob[reader.name]);
                        result.status = inJob;
                        return q.all(_.map(notInJob, reader => this.isReaderConnected(reader)));
                    }).then(occupied =>
                        _.reduce(occupied, function (r, reader) {
                            if (reader)
                                r[reader.name] = reader.status || "occupied";
                            return r;
                        }, result.status)
                    ).then(status =>
                        _.reduce(result.readers, function (r, reader) {
                            if (!r[reader.name]) r[reader.name] = "disengage";
                            return r;
                        }, status)
                    );
                },
                isReaderConnected(reader){
                    return this.getReaderHomePage(reader)
                        .then(homePage => this.isReaderOccupied(homePage) ? {name: reader.name} : null)
                        .catch(err => {
                            console.log("Error reading home page", err, err.message, reader);
                            return (err.message === "ETIMEDOUT") ?
                            {name: reader.name, status: "disconnected"} :
                            {name: reader.name, status: err.message};
                        })
                },
                getReaderHomePage(reader) {
                    return this.restCall({
                        url: `http://${reader.address}/cgi-bin/index.cgi`,
                        method: "GET",
                        timeout: 10000
                    }, project.readerUser || "root", project.readerPassword || "impinj");
                },
                isReaderOccupied(homePage) {
                    const match = homePage.match(/Table_Contents_Left..LLRP Status[^T]+Table_Contents_Right..([^<]+)/);
                    return !match || match[1] !== "Disconnected";
                },
                isComplete: function (job) {
                    return job ? _.find(["COMPLETE", "STOPPED"], function (c) {
                        return job.status.startsWith(c);
                    }) : true;
                },
                stopInterval: function () {
                    if (interval)
                        clearInterval(interval);
                    interval = null;
                },
                monitorJob: function (id) {
                    var self = this;

                    return this.getJobs(id).then(function (job) {
                        if (itemSenseJob && job.id === itemSenseJob.id)
                            if (self.isComplete(job)) {
                                self.stopInterval();
                                itemSenseJob = null
                            }
                        return job;
                    });
                },
                stopJob: function (id) {
                    return itemsenseApi.jobs.stop(id).then(()=> {
                        if (id === itemSenseJob.id)
                            itemSenseJob = null;
                    });
                }
            },
            {
                project: {
                    get: function () {
                        return project;
                    },
                    set: function (v) {
                        project = v;
                    }
                },
                results: {
                    get: function () {
                        return results;
                    }
                },
                lastResult: {
                    get: function () {
                        return results.last;
                    }
                },
                itemSenseJob: {
                    set: function (v) {
                        itemSenseJob = v;
                    }
                }
            });
    return wrapper;
}

const notStarted = ()=> project ? null : q.reject({
    statusCode: 500,
    response: {body: "Server error: Project Not Started"}
});

var md = {

    init: function (p) {
        project = startProject(p);
        return project;
    },

    connect: function () {
        var payload = {};
        return project.getRecipes().then(function (r) {
            payload.recipes = r;
            return project.getRunningJob();
        }).then(function (job) {
            project.itemSenseJob = job;
            payload.job = job;
            return project.getZoneMap();
        }).then(function (zoneMaps) {
            payload.zoneMaps = _.filter(zoneMaps, function (z) {
                return z.facility === project.project.facility;
            });
            return project.getCurrentZoneMap();
        }).then(function (currentZoneMap) {
            payload.currentZoneMap = currentZoneMap;
            return project.getFacilities();
        }).then(function (facilities) {
            payload.facilities = facilities;
            return payload;
        });
    },

    monitorJob: data => notStarted() || project.monitorJob(data),
    stopJob: data => notStarted() || project.stopJob(data),
    startJob: data => notStarted() || project.startJob(data),
    dumpConfig: () => notStarted() || project.dumpConfig(),
    getReaders: () => notStarted() || project.getReaders(),
    getItems: () => notStarted() || project.getItems(),
    postReaders: data => notStarted() || project.postReaders(data),
    getZoneMap: (data) => notStarted() || project.getZoneMap(data),
    deleteZoneMap: (data) => notStarted() || project.deleteZoneMap(data),
    addZoneMap: data => notStarted() || project.addZoneMap(data),
    setCurrentZoneMap: data => notStarted() || project.setCurrentZoneMap(data),
    getLLRPStatus: () => notStarted() || project.getLLRPStatus(),
    getFacilities: () => notStarted() || project.getFacilities()
};

module.exports = md;
