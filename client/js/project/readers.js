/**
 * Created by ralemy on 4/16/16.
 * Project information about readers
 */
"use strict";
function correctDegrees(yaw) {
    return (yaw > 180) ? yaw - 360 : (yaw < -180) ? yaw + 360 : yaw;
}
module.exports = (function (app) {
    app.factory("ProjectReaders", ["_", function (_) {
        function wrap(project) {
            return {
                updateReader(reader) {
                    if (!reader.placement) return;
                    if (reader.placement.yaw)
                        reader.placement.yaw = correctDegrees((reader.placement.yaw || 0) % 360);
                    if (project.stage)
                        project.stage.updateReader(reader);
                },
                getChangedReaders(){
                    return _.reduce(_.filter(project.changedReaders, r => r.address.trim()), (result, reader) => {
                        result[reader.address] = reader;
                        return result;
                    }, {});
                },
                addReaderMetadata(readers){
                    return _.map(readers, reader => _.merge(reader,project.readerMetadata[reader.address]));
                }
            };
        }

        return function (project) {
            let readers = null,
                reader = null,
                showReaders = false,
                changedReaders = [],
                showReaderFields = 0,
                showLLRP = false,
                readerLLRP = {},
                readerMetadata = {};
            _.each(wrap(project), (fn, key) => project[key] = fn);
            Object.defineProperties(project, {
                readers: {
                    get: () => readers,
                    set: v => readers = v
                },
                reader: {
                    get: () => reader,
                    set: v => reader = v
                },
                readerMetadata: {
                    enumerable:true,
                    get: () => readerMetadata,
                    set: function (v) {
                        readerMetadata = v;
                    }
                },
                showReaders: {
                    enumerable: true,
                    get: () => showReaders,
                    set: function (v) {
                        showReaders = v;
                        if (v && !readers && this.recipes)
                            this.getReaders().catch(function () {
                                showReaders = false;
                            });
                        else if (project.stage)
                            project.stage.showReaders(v);
                    }
                },
                showLLRP: {
                    get: () => showLLRP,
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
                    get: () => readerLLRP,
                    set: function (v) {
                        readerLLRP = v;
                        if (project.stage)
                            project.stage.markEngagedReaders(v);
                    }
                },
                showReaderFields: {
                    enumerable: true,
                    get: () => showReaderFields,
                    set: function (v) {
                        showReaderFields = v;
                        if (project.stage && showReaders)
                            project.stage.showReaders(true);
                    }
                },
                changedReaders: {
                    get: () => changedReaders,
                    set: (v) => changedReaders = v
                }
            });
        };
    }]);
}(angular.module(window.mainApp)));
