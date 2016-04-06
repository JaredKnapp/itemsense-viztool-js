/**
 * Created by ralemy on 11/19/15.
 * Item sense interface implementation
 *
 */

var q = require("q"),
    _ = require("lodash"),
    ItemSense = require("itemsense-node"),
    project = null;


function makeUrl(u) {
    if (u.indexOf("http") === -1)
        u = "http://" + u;
    if (u.lastIndexOf("/") === u.length - 1)
        u = u.substr(0, u.length - 1);
    return u;
}

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
            set: function(v){
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

function reportError(error) {
    return error.statusCode ? error : {statusCode: 500, body: "OS error " + error.name + ": " + error.description};
}

function startProject(project) {
    var itemsenseApi = new ItemSense({
        itemsenseUrl: makeUrl(project.itemSense.trim() + '/itemsense'),
        username: project.user || 'admin',
        password: project.password || 'admindefault'
    });

    var readPromise = null, interval = null, itemSenseJob = {},
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
                        return q.reject(reportError(error));
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
                        console.log("after filter", items.data.length);
                        return items;
                    });
                    return readPromise;
                },
                startClock: function () {
                    interval = setInterval(wrapper.readItems, 1000);
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
                    return itemsenseApi.readerDefinitions.get();
                },
                getRecipes: function () {
                    return itemsenseApi.recipes.get();
                },
                addZoneMap:function(data){
                    return itemsenseApi.zoneMaps.update(data);
                },
                getCurrentZoneMap:function(){
                    return itemsenseApi.currentZoneMap.get(project.facility);
                },
                getAllZoneMaps:function(){
                    return itemsenseApi.zoneMaps.getAll();
                },
                getJobs: function (id) {
                    return itemsenseApi.jobs.get(id);
                },
                getRunningJob: function () {
                    return this.getJobs().then(function (jobs) {
                        return _.find(jobs, function (j) {
                            return j.status.indexOf("RUNNING")!==-1;
                        });
                    });
                },
                isComplete: function (job) {
                    return job ? _.find(["COMPLETE", "STOPPED"], function (c) {
                        return job.status.indexOf(c)!==-1;
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
        }).then(function(zoneMaps){
            payload.zoneMaps = _.filter(zoneMaps,function(z){
                return z.facility === project.project.facility;
            });
            return project.getCurrentZoneMap();
        }).then(function(currentZoneMap){
            payload.currentZoneMap = currentZoneMap;
            return payload;
        });
    },

    monitorJob: function (data) {
        if (!project)
            return q.reject({statusCode: 500, body: "Server error: Project Not Started"});
        return project.monitorJob(data);
    },

    stopJob: function (data) {
        if (!project)
            return q.reject({statusCode: 500, body: "Server error: Project Not Started"});
        return project.stopJob(data);
    },

    startJob: function (data) {
        if (!project)
            return q.reject({statusCode: 500, body: "Server error: Project Not Started"});
        return project.startJob(data);
    },

    getReaders: function () {
        if (!project)
            return q.reject({statusCode: 500, body: "Server error: Project Not Started"});
        return project.getReaders().then(function (list) {
            return list || [];
        });
    },

    getItems: function () {
        if (!project)
            return q.reject({statusCode: 500, body: "Server error: Project Not Started"});
        return project.getItems();
    },
    postReaders: function (data) {
        if (!project)
            return q.reject({statusCode: 500, body: "Server error: Project Not Started"});
        return project.postReaders(data);
    },
    getZoneMaps:function(){
        if (!project)
            return q.reject({statusCode: 500, body: "Server error: Project Not Started"});
        return project.getAllZoneMaps();
    },
    addZoneMap:function(data){
        if (!project)
            return q.reject({statusCode: 500, body: "Server error: Project Not Started"});
        return project.addZoneMap(data);
    }
};

module.exports = md;
