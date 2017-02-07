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
                    _.each(["x", "y", "z", "yaw", "pitch", "roll"],
                        item => reader.placement[item] ? item : reader.placement[item] = 0.0);
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
                    return _.map(readers, reader => {
                        let metadata = project.readerMetadata[reader.address] || {};
                        if (metadata.placement) reader.placement = metadata.placement;
                        if (metadata.extraType) reader.type = metadata.extraType;
                        return reader;
                    });
                },
                updateReaderMetadata(){
                    let newMetadata = _.reduce(project.changedReaders, (result, reader) => {
                        if (reader.address.trim())
                            result[reader.address.trim()] = project.getMetadata(reader);
                        return result;
                    }, {});
                    project.readerMetadata = _.merge(project.readerMetadata, newMetadata);
                },
                getMetadata(reader){
                    let metadata = {};
                    if (reader.type !== "XARRAY") {
                        metadata = _.merge(metadata, {placement: reader.placement});
                        delete reader.placement;
                    }
                    if (reader.type === "XSPAN") {
                        metadata = _.merge(metadata, {extraType: "XSPAN"});
                        reader.type = "UNKNOWN";
                    }
                    return metadata;
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
                    enumerable: true,
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
