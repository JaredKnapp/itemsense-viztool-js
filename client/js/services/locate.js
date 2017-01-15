/**
 * Created by ralemy on 1/14/17.
 */
"use strict";

module.exports = (function (app) {
    app.factory("LocateFactory", ["_", function (_) {

        function collectImages(root) {
            let images = [];
            _.each(root.children, v => images = images.concat(collectImages(v)));
            root.images = _.uniq(root.ImageId ? images.concat(root.ImageId) : images);
            return root.images;
        }

        return {
            constructTree(areaArray) {
                let hashMap = _.reduce(areaArray, (result, area) => {
                    result[area.AreaId] = area;
                    return result;
                }, {});
                let tree = _.reduce(areaArray, (tree, area) => {
                    let parentId = area.ParentId;
                    if (!parentId) tree[area.AreaId] = area;
                    else {
                        let parent = hashMap[parentId];
                        if (!parent.children)
                            parent.children = {};
                        parent.children[area.AreaId] = area;
                    }
                    return tree;
                }, {});
                _.each(tree, v => collectImages(v));
                return tree;
            },
            importFromLocate(project, node){
                console.log("importing from locate node ", node);
            }
        };
    }]);
})(angular.module(window.mainApp));