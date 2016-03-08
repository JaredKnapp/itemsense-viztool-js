/**
 * Created by rezaalemy on 15-03-29.
 * Gulp file to gather Js and Sass files under ./gulp/js, ./gulp/sass
 */
var gulp = require("gulp"),
    path = require("path"),
    sass = require("gulp-sass"),
    rename = require("gulp-rename"),
    jshint = require("gulp-jshint"),
    gutil = require("gulp-util"),
    source = require("vinyl-source-stream"),
    browserify = require("browserify-string"),
    walk = require("walk").walkSync;

var base = path.resolve(__dirname, "gulp"),
    PATHS = {
        base: base,
        src: {
            app: path.resolve(base, "js"),
            js: path.resolve(base, "js/**/*.js"),
            sass: path.resolve(base, "sass/**/*.*css"),
            sassMain: path.resolve(base, "sass/style.scss")
        },
        dest: {
            mainJs: "app.js",
            mainCss: "app.css",
            js: path.resolve(__dirname, "public/javascripts"),
            css: path.resolve(__dirname, "public/stylesheets")
        }
    };


gulp.task("lint", function () {
    return gulp.src(PATHS.src.js)
        .pipe(jshint())
        .pipe(jshint.reporter("jshint-stylish"));
});
gulp.task("browserify", ["lint"], function () {
    function angulify(path) {
        var result = "(function angularify(){\n";
        walk(path, {
            listeners: {
                file: function (root, stat, next) {
                    if(stat.name.match(/[.]js$/))
                            result += "require('" + root + "/" + stat.name + "');\n";
                    next();
                }
            }
        });
        return result + "\n})();";
    }

    return browserify(angulify(PATHS.src.app))
        .on("log", gutil.log)
        .bundle()
        .on("error", function(err){
            gutil.log(gutil.colors.magenta("Error in Browserify\n\n"), err.message,gutil.colors.magenta("\n\nBundle Cancelled\n"));
            this.emit("end");
        })
        .pipe(source(PATHS.dest.mainJs))
        .pipe(gulp.dest(PATHS.dest.js));
});

gulp.task("sass", function () {
    return gulp.src(PATHS.src.sassMain)
        .pipe(sass().on("error", function(err){
            gutil.log(gutil.colors.magenta("Error in Sass\n\n"), err.message,gutil.colors.magenta("\n\nBundle Cancelled\n"));
            this.emit("end");
        }))
        .pipe(rename(PATHS.dest.mainCss))
        .pipe(gulp.dest(PATHS.dest.css));
});

// Watch Files For Changes
gulp.task("watch", function () {
    gulp.watch(PATHS.src.js, ["compile"]);
    gulp.watch(PATHS.src.sass, ["sass"]);
});

// Default Task
gulp.task("compile", ["browserify", "sass"]);
gulp.task("default", ["compile", "watch"]);
