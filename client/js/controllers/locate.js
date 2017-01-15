/**
 * Created by ralemy on 1/14/17.
 */
"use strict";

module.exports = (function (app) {
    app.controller("Locate", ["$scope", "LocateFactory",function ($scope, factory) {

        $scope.tree = factory.lastLocateAreas();

        $scope.mainTab = {locate: true};
        $scope.getLocateAreas = function () {
            factory.getLocateAreas($scope.project).then(success => $scope.tree = success);
        };

        $scope.selectNode = function (v) {
            $scope.selectedNode = v;
        };

        $scope.reportImages = function (v) {
            if (v.children)
                if (!v.images.length)
                    return "(<small>No images</small>)";
                else if (v.images.length === 1)
                    return `<small>${v.images[0]}</small>`;
                else
                    return `<small>${v.images.length} images</small>`;
            return "";
        };
        $scope.notSuitable=function(){
            if(!$scope.project.recipes)
                return "Not Connected to ItemSense";
            if(!$scope.selectedNode)
                return "No Area Selected";
            if($scope.selectedNode.Level !== "Floor")
                return "Not a Floor Level Node";
            if($scope.selectedNode.images.length !== 1)
                return "Must have one image";
            return false;
        };
        $scope.importFromLocate = function(){
            factory.importFromLocate($scope.project,$scope.selectedNode);
        };
    }]);
})(angular.module(window.mainApp));