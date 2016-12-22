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
                const overlay = circle.cloneNode();
                overlay.style.top = 0;
                overlay.style.position = "absolute";
                overlay.style.backgroundColor = "initial";
                overlay.setAttribute("class", "pnj-panel-btn pnj-overlay-btn");
                el[0].appendChild(overlay);
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
                    scope.$watch(()=> circle[0].offsetWidth,
                        () => el.children().eq(2).css("width", circle[0].offsetWidth));
                    circle.html(content.element);
                    el.children().eq(2).css("width", circle[0].offsetWidth);
                }
            };
        }])
        .directive("contenteditable", [function () {
            function ignoreEvent(ev) {
                ev.stopPropagation();
                ev.preventDefault();
            }

            return {
                restrict: "A",
                require: "ngModel",
                link: function (scope, element, attrs, ngModel) {
                    const step = isNaN(attrs.step) ? 1 : parseFloat(attrs.step);

                    function read() {
			let v = element.html().match(/[0-9.-]+/);
                        ngModel.$setViewValue(v ? v[0] : 0);
                    }

                    function val() {
                        const value = element.html();
                        return isNaN(value) ? 0 : parseFloat(value);
                    }

                    ngModel.$render = function () {
                        element.html(ngModel.$viewValue || 0);
                    };

                    element.bind("blur", function () {
                        scope.$apply(read);
                    });
                    element.bind("keydown", function (ev) {
                        if (ev.keyCode === 38) { //arrow up
                            element.html(Math.round10(val() + step, -2));
                            scope.$apply(read);
                        }
                        else if (ev.keyCode === 40) { //arrow down
                            element.html(Math.round10(val() - step, -2));
                            scope.$apply(read);
                        }
                        else if (ev.keyCode === 13 || ev.keyCode === 9) {
                            element[0].blur();
                            ignoreEvent(ev);
                        }
                        else if (ev.keyCode === 27) {
                            element.html(ngModel.$viewValue);
                            element[0].blur();
                            ignoreEvent(ev);
                        }
                    });

                    element.bind("keypress", function (ev) {
			if(ev.charCode)                        
			if (ev.charCode < 45 || ev.charCode > 57 || ev.charCode === 47)
                            return ignoreEvent(ev);
                    });
                }
            };
        }]);
})(angular.module(window.mainApp));

