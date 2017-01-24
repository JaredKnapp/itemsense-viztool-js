/**
 * Created by ralemy on 1/19/17.
 */
"use strict";

module.exports = (function (app) {
    app.factory("HeatMap", [function () {
        return function (stage) {
            let heatMap = stage.duplicateCanvas(stage.canvas);
            stage.on("connect",function(ev){
                if(ev.project)
                    Object.defineProperties(ev.project,{
                        heatMap:{
                            enumerable:false,
                            get: () => stage.heatMap
                        }
                    });
            });
            stage.on("Zoom",function(){
                stage.syncCoords(heatMap);
            });
            stage.heatMap = {
                hide(){
                    heatMap.style.zIndex = -100;
                    this.visible = false;
                },
                show(){
                    if(!heatMap.added)
                        this.addHeatMap();
                    heatMap.style.zIndex = 100;
                    this.visible = true;
                },
                addHeatMap(){
                    stage.syncCoords(heatMap);
                    stage.canvas.parentNode.appendChild(heatMap);
                    heatMap.added=true;
                }
            };
        };
    }]);
})(angular.module(window.mainApp));
