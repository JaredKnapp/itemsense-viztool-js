/**
 * Created by ralemy on 4/16/16.
 * Project information about readers
 */
"use strict";
module.exports = (function (app) {
    app.factory("ProjectReaders", ["_", function (_) {
        function wrap(project) {
            return {
                updateReader(reader) {
                    if (project.stage)
                        project.stage.updateReader(reader);
                }
            };
        }

        return function (project) {
            let readers = null,
                reader = null,
                showReaders = false,
                showReaderFields = 0,
                showLLRP = false,
                readerLLRP = {};
            _.each(wrap(project), (fn, key)=>project[key] = fn);
            Object.defineProperties(project, {
                readers: {
                    get: ()=> readers,
                    set: v=> readers = v
                },
                reader: {
                    get: () => reader,
                    set: v => reader =v
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
                    enumerable: true,
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
                }
                
            });
        };
    }]);
}(angular.module(window.mainApp)));