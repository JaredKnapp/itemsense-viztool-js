/**
 * Created by ralemy on 11/1/15.
 * Collection of miscellaneous directives used in the app
 */

"use strict";

module.exports = (function (app) {
    app.directive("fromTemplate", [function () {
            return {
                templateUrl: function (element, attrs) {
                    return "/templates/" + attrs.fromTemplate;
                }
            };
        }])
        .directive("easel", ["Stage", function (stage) {
            return {
                restrict: "A",
                link: function (scope, el) {
                    stage.link(scope, el);
                }
            };
        }])
        .directive("presentation", ["Presenter", function (presenter) {
            return {
                restrict: "A",
                link: function (scope, el) {
                    var scene = presenter(scope, el);
                    scene.update();
                }
            };
        }])
        .directive("circleIcon", [function () {
            function appendCircle(el, label, content) {
                var circle = document.createElement("div");
                el[0].appendChild(circle);
                var w = circle.offsetWidth;
                w -= content.borderWidth;
                circle.setAttribute("class", "pnj-panel-btn");
                circle.style.height = w + "px";
                circle.style.borderRadius = Math.floor(w / 2) + "px";
                circle.style.border = content.borderWidth + "px solid " + content.borderColor;
                circle.style.backgroundColor = content.backgroundColor;
                if (label)
                    el.append("<div class='pnj-icon-label'>" + label + "</div>");
                return angular.element(circle);
            }

            function contrast(color) {
                return angular.contrastColor(color);
            }

            function image(scope, fileName) {
                return "<img class='pnj-presenter-image' src='" +
                    scope.$root.project.symbolImage(fileName) + "' alt='" + fileName + "'>";
            }

            function getElement(scope, icon) {
                if (icon.Image)
                    return image(scope, icon.Image);
                else if (icon.Color)
                    return (icon.Color === "white") ? icon.Property : "";
                return icon.Property;
            }

            function circleContent(scope, text) {
                if (scope.circleIcon)
                    return {
                        borderColor: scope.circleIcon.Color ? contrast(scope.circleIcon.Color) : "black",
                        borderWidth: 5, //ToDo: thicker border for bigger circles,
                        backgroundColor: scope.circleIcon.Color || "white",
                        element: getElement(scope, scope.circleIcon)
                    };
                return {
                    borderColor: "black",
                    borderWidth: 5,
                    backgroundColor: "white",
                    element: text
                };
            }

            return {
                restrict: "A",
                scope: {
                    circleIcon: "="
                },
                link: function (scope, el, attrs) {
                    var content = circleContent(scope, attrs.iconText),
                        circle = appendCircle(el, attrs.iconLabel, content);
                    circle.html(content.element);
                }
            };
        }])
        .directive("contenteditable", [function () {
            return {
                restrict: "A",
                require: "ngModel",
                link: function (scope, element, attrs, ngModel) {
                    const step = isNaN(attrs.step) ? 1 : parseFloat(attrs.step);

                    function read() {
                        ngModel.$setViewValue(element.html());
                    }

                    function val() {
                        const value = element.html();
                        return isNaN(value) ? 0 : parseFloat(value);
                    }

                    ngModel.$render = function () {
                        element.html(ngModel.$viewValue || "");
                    };

                    element.bind("blur", function () {
                        scope.$apply(read);
                    });
                    element.bind("keyup", function (ev) {
                        if (ev.keyCode === 38) { //arrow up
                            element.html(val() + step);
                            scope.$apply(read);
                        }
                        else if (ev.keyCode === 40){ //arrow down
                            element.html(val() - step);
                            scope.$apply(read);
                        }
                    });
                }
            };
        }]);
})(angular.module(window.mainApp));

