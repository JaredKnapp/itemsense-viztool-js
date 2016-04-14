/**
 * Created by ralemy on 11/19/15.
 * Item sense interface implementation
 *
 */

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
                        console.log("item promise failed", error);
                        if (results.last.at)
                            results.last.to = true;
                        else
                            results.last = createResultItem(error, "from");
                        return q.reject(error);
                    }).finally(function () {
                        readPromise = null;
                    });
                },
                getItems: function () {
                    if (readPromise)
                        return readPromise;
                    readPromise = wrapper.stash(itemsenseApi.items.get({pageSize: 1000})).then(function (items) {
                        if (!itemSenseJob)
                            return q.reject({statusCode: 500, body: "Job not started"});
                        items.data = _.filter(items.data, function (i) {
                            return i.lastModifiedTime > itemSenseJob.creationTime
                        });
                        return items;
                    });
                    return readPromise;
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
                    return itemsenseApi.readerDefinitions.get().then(list => list || []);
                },
                getRecipes: function (recipeName) {
                    return itemsenseApi.recipes.get(recipeName);
                },
                addZoneMap: function (data) {
                    var self = this;
                    return itemsenseApi.zoneMaps.update(data).then(function (zmap) {
                        return self.setCurrentZoneMap(zmap.name).then(function () {
                            return zmap;
                        });
                    });
                },
                setCurrentZoneMap: function (name) {
                    return itemsenseApi.currentZoneMap.update(name);
                },
                getCurrentZoneMap: function () {
                    return itemsenseApi.currentZoneMap.get(project.facility);
                },
                getAllZoneMaps: function () {
                    return itemsenseApi.zoneMaps.getAll();
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
                        result.readers = _.filter(readers, this.inProject);
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
                            if (reader)  r[reader] = "occupied";
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
                        .then(homePage => this.isReaderOccupied(homePage) ? reader.name : null)
                },
                getReaderHomePage(reader) {
                    var defer = q.defer();
                    request({
                        url: `http://${reader.address}/cgi-bin/index.cgi`,
                        method: "GET"
                    }, function (err, response, body) {
                        if (err)
                            defer.reject(err);
                        if (response.statusCode > 399)
                            defer.reject(response);
                        else
                            defer.resolve(body);
                    }).auth(project.readerUser || "root", project.readerPassword || "impinj");
                    return defer.promise;
                },
                isReaderOccupied(homePage) {
                    const match = homePage.match(/Table_Contents_Left..LLRP Status[^T]+Table_Contents_Right..([^<]+)/);
                    return !match || match[1] !== "Disconnected";
                },
                isComplete: function (job) {
                    return job ? _.find(["COMPLETE", "STOPPED"], function (c) {
                        return job.status.indexOf(c) !== -1;
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
                            if (self.isComplete(job))
                                self.stopInterval();
                        return job;
                    });
                },
                stopJob: function (id) {
                    return itemsenseApi.jobs.stop(id);
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

const notStarted = ()=> project ? null : q.reject({statusCode: 500, body: "Server error: Project Not Started"});

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
            return project.getAllZoneMaps();
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
    getReaders: () => notStarted() || project.getReaders(),
    getItems: () => notStarted() || project.getItems(),
    postReaders: data => notStarted() || project.postReaders(data),
    getZoneMaps: () => notStarted() || project.getAllZoneMaps(),
    addZoneMap: data => notStarted() || project.addZoneMap(data),
    setCurrentZoneMap: data => notStarted() || project.setCurrentZoneMap(data),
    getLLRPStatus: () => notStarted() || project.getLLRPStatus(),
    getFacilities: () => notStarted() || project.getFacilities()
};

module.exports = md;
