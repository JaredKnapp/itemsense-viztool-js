/**
 * Created by ralemy on 12/13/15.
 * experimenting with line geometry
 */

// given a line segment between p1 and p2, does a line starting at c and passing through p continue to intersect with it?
function doesIntersect(p1, p2, c, p) {
    console.log(p1, p2, c, p);
    var r = subtractPoint(p2, p1),
        s = subtractPoint(p, c),
        uNum = crossProduct(subtractPoint(c, p1), r),
        dnom = crossProduct(r, s),
        coefs = getCoeffs();
    return coefs ? {
        x: p1.x + (r.x * coefs.t),
        y: p1.y + (r.y * coefs.t)
    } : null;

    function getCoeffs() {
        if (dnom === 0)
            return null;
        var u = uNum / dnom,
            t = crossProduct(subtractPoint(c, p1), s) / dnom;
        if (u < 0 || t < 0 || t > 1.0)
            return null;
        return {
            u: uNum / dnom,
            t: crossProduct(subtractPoint(c, p1), s) / dnom
        };
    }

    function subtractPoint(p2, p1) {
        return {
            x: p2.x - p1.x,
            y: p2.y - p1.y
        };
    }

    function crossProduct(p1, p2) {
        return (p1.x * p2.y) - (p1.y * p2.x);
    }
}

console.log(doesIntersect({x: 0, y: 5}, {x: 5, y: 0}, {x: 0, y: 0}, {x: 4, y: 1}));
console.log(doesIntersect({x: -2, y: 7}, {x: 5, y: 0}, {x: 0, y: 0}, {x: -1, y: 5}));

var distance ={factory:function(){}};
distance.factory("PresenterZones", ["_", "CreateJS",function (_,createjs) {
    function magnitude(diffX, diffY) {
        return Math.pow(diffX, 2) + Math.pow(diffY, 2);
    }

    function lineObject(p1, p2) {
        var diffX = p2.x - p1.x,
            diffY = p2.y - p1.y,
            m = magnitude(p1, p2);
        return Object.create({
            getCoefficient: function (p) {
                var u = (((p.x - p1.x) * diffX ) + ((p.y - p1.y) * diffY) ) / this.magnitude;
                return u < 0.0 || u > 1.0 ? -1 : u;
            },
            getIntersection: function (p) {
                var u = this.getCoefficient(p);
                if(u<0)
                    return null;
                return {
                    u:u,
                    x: p1.x + (u * diffX),
                    y: p1.y + (u * diffY)
                };
            },
            getDistance: function (p) {
                var intersection = this.getIntersection(p);
                if(!intersection)
                    return null;
                return {
                    p3:p,
                    p4:intersection,
                    distance: magnitude(p.x-intersection.x, p.y-intersection.y)
                };
            }
        }, {
            magnitude: {
                get: function () {
                    if (!m)
                        m = magnitude(this.p1, this.p2);
                    return m;
                }
            },
            p1: {
                get: function () {
                    return p1;
                }
            },
            p2: {
                get: function () {
                    return p2;
                }
            }
        });
    }

    function prepareZone(z) {
        var lines = _.reduce(z.points.concat[z.points[0]], function (r, p, i) {
            if (i === 0)
                return r;
            r.push(lineObject(z.points[i - 1], p));
            return r;
        }, []);
        var shape = new createjs.Shape();
        return Object.create({
            findShortest:function(p){
                return _.min(_.map(lines,function(l){
                    return l.getDistance(p);
                }),"distance");
            },
            hits:function(p){
                return shape.hitTest(p.x, p.y);
            },
            movePoint:function(p1,p2){
                if(p2 === Infinity || !p2)
                    return p1;
                p1.x = p2.x;
                p1.y = p2.y;
                return p1;
            },
            entreat:function(p){
                if(this.hits(p))
                    this.movePoint(p,this.findShortest(p));
                return p;
            }
        }, {
            refZone: {
                get: function () {
                    return z;
                }
            },
            lines:{
                get:function(){
                    return lines;
                }
            },
            shape:{
                get:function(){
                    return shape;
                }
            }
        });
    }

    return {
        prepareBlocker: function (z) {
            return prepareZone(z);
        }
    };
}]);
