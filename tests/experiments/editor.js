(function () {

    const
        MAX_IMG_ADD_SIZE = 450,
        MAX_ICON_ADD_SIZE = 75,
        MAG_TN_WIDTH = 75,
        IMG_LIST_MASK_SIZE = 855,
        MAG_LIST_MASK_SIZE = 934,
        SHIFT = 50,
        D_MOVE = 10,
        FPS = 25,
        DEFAULT_FONT = "Trebuchet MS",
        DEFAULT_FONT_SIZE = 20,
        DEFAULT_COLOR = "000000",
        DEFAULT_BOLD = false,
        DEFAULT_ITALIC = false,
        MAX_FONT_SIZE = 120;
    MIN_FONT_SIZE = 8;

    var j = jQuery.noConflict();

    /** APPLICATION
     * Manages the general information
     */
    app = {
        stage: null,
        canvas: null,
        layers: [],
        activeLayer: null,
        mask: null,
        customer: "",
        session: "",
        images: [],
        magnets: [],
        icons: [],
        masks: [],
        ln: null,
        fonts: {},
        mc: null,
        addLayerToStage: function (layer) {
            var i = this.stage.getNumChildren();
            if (null != this.mask)
                i--;
            this.stage.addChildAt(layer.getGlobalContainer(), i);
            this.stage.update();
        },
        addMaskToStage: function (mask) {
            if (null != this.mask)
                this.stage.removeChildAt(this.stage.getNumChildren() - 1);
            this.stage.addChild(mask.getImage());
            this.mask = mask;
        },
        removeLayerFromStage: function (layer) {
            this.stage.removeChild(layer.getGlobalContainer());
            this.stage.update();
        },
        // Activate a selected layer
        activateLayer: function (layerP) {
            if(null != this.activeLayer) {
                this.activeLayer.deactivate();
            }
            if(null != layerP) {
                this.activeLayer = this.layers[layerP];
                this.layers[layerP].activate();
                j('#ui_rotate').val(this.activeLayer.getRotation());
                j('#transparency').slider("value", this.activeLayer.getAlpha());
                if(layer.type.TEXT == this.activeLayer.getType()) {
                    // Update font
                    ui.setFont(this.activeLayer.getFontName());
                    // Update font size
                    j('#ui_fontsize').val(this.activeLayer.getFontSize());
                    // Update bold
                    if(this.activeLayer.getBold())
                        j('#ui_bold').attr("checked", "checked");
                    else
                        j('#ui_bold').removeAttr("checked");
                    j('#ui_bold').button("refresh");
                    // Update italic
                    if(this.activeLayer.getItalic())
                        j('#ui_italic').attr("checked", "checked");
                    else
                        j('#ui_italic').removeAttr("checked");
                    j('#ui_italic').button("refresh");
                    // Update Color
                    colorPicker.setColor(this.activeLayer.getColor());
                }
            }
            else
                this.activeLayer = null;
        },
        save: function(e) {
            ui.startProgressBar();
            ui.openLoader();

            // Create the object describing the magnet
            var magnetObject = {
                layers: [],
                shape: app.mask.getShape(),
            };
            j.each(app.layers, function(key, layer) {
                magnetObject.layers.push(layer.getObject());
            });

            // Sending the save request
            j.post("/creation/editor/save" + app.getGetInfo(),
                {"photomagnet_user_magnet[object]": magnetObject}
            ).done(function(resultJson) {
                var result = j.parseJSON(resultJson);
                ui.stopProgressBar();
                ui.closeLoader();
                if("ok" == result.result) {
                    alert(app.ln.mag_save);
                    app.magnets[result.content.magnet_id] = new customerMagnet(result.content.magnet_id);
                    ui.reset();
                    ui.activeTab(ui.currentUserTab, j('#user_magnets_list_button'), j('#user_magnets_list'));
                }
                else
                    alert(app.ln.mag_save_error + result.error_code);
            }).fail(function(data) {
                ui.stopProgressBar();
                ui.closeLoader();
                alert(app.ln.mag_save_error + app.ln.unreachable);
            });
        },
        // Info for the requests, session id or client id
        getGetInfo: function() {
            return "?phtm_sessid=" + app.session + "&customer=" + app.customer;
        },
        getImageList: function() {
            j.ajax("/creation/editor/list")
                .done(function(resultJson) {
                    var result = j.parseJSON(resultJson);
                    for (var i = 0; i<result.content.length; i++) {
                        app.images[result.content[i]] = new customerImage(result.content[i]);
                    }
                });
        },
        getMagnetList: function() {
            j.ajax("/creation/editor/magnets")
                .done(function(resultJson) {
                    var result = j.parseJSON(resultJson);
                    for (var i = 0; i<result.content.length; i++) {
                        app.magnets[result.content[i]] = new customerMagnet(result.content[i]);
                    }
                });
        },
        getFonts: function() {
            // s=standard b=bold i=italic bi=bold italic
            // e=exist a,b,c=shift calcul coefficients
            this.fonts = {
                "Algerian": {s:{e:true,a:0.025,b:0.5,c:8.3}, b:{e:false}, i:{e:false}, bi:{e:false}},
                "Arial": {s:{e:true,a:-0.09,b:0,c:-2.5}, b:{e:true,a:-0.09,b:0,c:-2.5}, i:{e:true,a:-0.09,b:0,c:-2.5}, bi:{e:true,a:-0.09,b:0,c:-2.5}},
                "Calibri": {s:{e:true,a:-0.06,b:-0.5,c:-4.4}, b:{e:true,a:-0.07,b:-1,c:-3.6}, i:{e:true,a:-0.06,b:-0.5,c:-4.4}, bi:{e:true,a:-0.07,b:-1,c:-3.6}},
                "Curlz MT": {s:{e:true,a:0.033,b:0,c:9.5}, b:{e:false}, i:{e:false}, bi:{e:false}},
                "Forte": {s:{e:true,a:-0.4,b:1,c:-0.55}, b:{e:false}, i:{e:false}, bi:{e:false}},
                "Jokerman": {s:{e:true,a:0.033,b:0,c:11.5}, b:{e:false}, i:{e:false}, bi:{e:false}},
                "MedievalSharp": {s:{e:true,a:-0.12,b:0.5,c:-2.5}, b:{e:false}, i:{e:false}, bi:{e:false}},
                "Monofett": {s:{e:true,a:0.283,b:1,c:0.6}, b:{e:false}, i:{e:false}, bi:{e:false}},
                "Monoton": {s:{e:true,a:0.065,b:0.5,c:6}, b:{e:false}, i:{e:false}, bi:{e:false}},
                "Monotype Corsiva": {s:{e:true,a:-0.21,b:0.5,c:-1.5}, b:{e:false}, i:{e:false}, bi:{e:false}},
                "Ravie": {s:{e:true,a:-0.48,b:2,c:-0.7}, b:{e:false}, i:{e:false}, bi:{e:false}},
                "Sansita One": {s:{e:true,a:-0.13,b:-0.5,c:-2}, b:{e:false}, i:{e:false}, bi:{e:false}},
                "Segoe Script": {s:{e:true,a:-0.1,b:0,c:-5}, b:{e:true,a:-0.1,b:0,c:-5}, i:{e:false}, bi:{e:false}},
                "Trebuchet MS": {s:{e:true,a:0.1,b:1,c:2.3}, b:{e:true,a:0.05,b:1,c:4}, i:{e:true,a:0.04,b:0.3,c:5.5}, bi:{e:true,a:0.02,b:0.2,c:12}},
                "Viner Hand ITC": {s:{e:true,a:-0.1,b:0,c:-6.5}, b:{e:false}, i:{e:false}, bi:{e:false}}};
        },
        tick: function () {
            app.stage.update();
        },
        disableMultitouch: function() {
            this.mc.off("panmove",  ui.onPan);
            this.mc.off("panstart", ui.onPanStart);
            this.mc.off("rotatemove",  ui.onRotate);
            this.mc.off("rotatestart", ui.onRotateStart);
            this.mc.off("pinchmove",  ui.onPinch);
            this.mc.off("pinchstart", ui.onPinchStart);
        },
        enableMultitouch: function() {
            this.mc.on("panmove",  ui.onPan);
            this.mc.on("panstart", ui.onPanStart);
            this.mc.on("rotatemove",  ui.onRotate);
            this.mc.on("rotatestart", ui.onRotateStart);
            this.mc.on("pinchmove",  ui.onPinch);
            this.mc.on("pinchstart", ui.onPinchStart);
        },
        initialize: function() {
            this.getFonts();
            this.customer = customer;
            this.session = session;
            this.ln = ln;

            this.canvas = j('canvas')[0];

            document.onselectstart = function () { return false; };
            createjs.Ticker.setFPS(FPS);

            this.getImageList();
            this.getMagnetList();
            this.stage = new createjs.Stage(this.canvas);
            this.stage.regX = 0;
            this.stage.regY = 0;

            this.stage.enableMouseOver(FPS);

            createjs.Touch.enable(this.stage);

            createjs.Ticker.addEventListener("tick", app.tick);

            // Multitouch events, we have to simulate it on the canvas since we cannot do it on easeljs containers
            this.mc = new Hammer.Manager(j("canvas")[0]);
            this.mc.add(new Hammer.Pan({ threshold: 0 }));
            this.mc.add(new Hammer.Rotate({ threshold: 0 })).recognizeWith(this.mc.get('pan'));
            this.mc.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith([this.mc.get('pan'), this.mc.get('rotate')]);
            this.enableMultitouch();

            ui.initialize();
        }
    }

    /** USER INTERFACE
     * UI management and linked events
     */
    ui = {
        currentIconTab: null,
        currentUserTab: null,
        imgListShift: 0,
        imgListSize: 0,
        magListShift: 0,
        magListSize: 0,
        nbrLoading: 0,
        openedOverlay: null,
        textCreation: null,
        initialize: function() {
            this.currentIconTab = { btn : j('#general_icons_button'), tab : j('#general_icons_tab')};
            this.currentUserTab = { btn : j('#user_images_list_button'), tab : j('#user_images_list')};

            j('#general_icons_button').click(function() {
                ui.activeTab(ui.currentIconTab, j('#general_icons_button'), j('#general_icons_tab'))});
            j('#child_icons_button').click(function() {
                ui.activeTab(ui.currentIconTab, j('#child_icons_button'), j('#child_icons_tab'))});
            j('#wedding_icons_button').click(function() {
                ui.activeTab(ui.currentIconTab, j('#wedding_icons_button'), j('#wedding_icons_tab'))});

            j('#user_images_list_button').click(function() {
                ui.activeTab(ui.currentUserTab, j('#user_images_list_button'), j('#user_images_list'));
            });
            j('#user_magnets_list_button').click(function() {
                ui.activeTab(ui.currentUserTab, j('#user_magnets_list_button'), j('#user_magnets_list'));
            });

            j('#arrow_left_images_list').click(this.moveImgListLeft);
            j('#arrow_right_images_list').click(this.moveImgListRight);
            j('#arrow_left_magnets_list').click(this.moveMagListLeft);
            j('#arrow_right_magnets_list').click(this.moveMagListRight);

            j('#add_photos input').change(file.openImage);

            j('#canvas').droppable({drop: this.dropOnCanvas});

            j('#ui_rotate').spinner({min: -1, max:361, change: this.rotateLayer, spin: this.rotateLayer, stop: this.rotateLayer});
            j('#transparency').slider({min: 0, max:100, value:100, range: "min", change: this.transpLayer, slide: this.transpLayer});
            j('#ui_rotate_left').click(this.rotateLayer);
            j('#ui_rotate_right').click(this.rotateLayer);
            j('#move_top').click(this.moveLayer);
            j('#move_left').click(this.moveLayer);
            j('#move_right').click(this.moveLayer);
            j('#move_bottom').click(this.moveLayer);
            j('#ui_zoom_plus').click(this.zoomLayer);
            j('#ui_zoom_minus').click(this.zoomLayer);

            j('#ui_delete_layer').click(this.deleteLayer);
            j('#ui_foreground').click(this.changeOrder);
            j('#ui_background').click(this.changeOrder);

            j('#ui_add_text').button();
            j('#ui_add_text').click(this.createText);
            j('#ui_fontsize').spinner({min: MIN_FONT_SIZE, max:MAX_FONT_SIZE, change: this.changeFontSize, spin: this.changeFontSize, stop: this.changeFontSize});
            j('#ui_bold').button();
            j('#ui_bold').click(this.setBold);
            j('.page').click(this.clickOutOfStage);
            j('#ui_italic').button();
            j('#ui_italic').click(this.setItalic);
            colorPicker.initialize(j('#ui_color'), DEFAULT_COLOR);
            j('#ui_color').click(colorPicker.open);
            app.stage.addEventListener("colorChanged", this.setColor);

            this.setFonts();
            j('#ui_fonts').selectmenu({change: this.changeFont, select: this.changeFont, open: this.setupFontMenu, width: "200px"});
            this.setFont(DEFAULT_FONT);

            j('#text_cancel').click(this.hideTextInput);
            j('#text_validate').click(this.validateText);
            j('#text_input_field').keypress(function (e) {if (13 == e.which) ui.validateText()});

            // Icons Management
            var icons = j('.icon_btn');
            j.each(icons, function(index, value) {
                j("#" + value.id).draggable({
                    start : function(e,ui) {
                        j("#" + value.id).css("top", "auto").css("left", "auto").css("z-index", "1000");
                    },
                    stop : function(e,ui) {
                        j("#" + value.id).css("top", "auto").css("left", "auto").css("z-index", "auto");
                    },
                });
            });

            j('#ui_reset').click(this.reset);
            j('#ui_new').click(this.reset);
            j('#ui_cart').click(function(e) {window.location.href = "/checkout/cart";});
            j('#ui_save').click(this.launchSave);

            j('#instructions').click(this.closeWarning);
            j('#ok_instructions').click(this.closeWarning);
            j('#editor_overlay').bind("click", ui.closeWarning);

            j('#warning_rectify').click(function(e) {
                j('#editor_overlay').css("display","none");
                j('#warning').css("display","none");
            });
            j('#warning_validate').click(function(e) {
                j('#editor_overlay').css("display","none");
                j('#warning').css("display","none");
                app.save();
            });

            // Masks Management
            var masks = j('.mask_btn');
            j.each(masks, function(index, value) {
                j("#" + value.id).click(ui.selectMask);
            });

            app.stage.addEventListener("stagemousedown", this.clickOnStage);

            app.stage.addEventListener("mouseenter", this.dimMask);
            app.stage.addEventListener("mouseleave", this.showMask);
        },
        createText: function(e) {
            ui.textCreation = true;
            ui.showTextInput();
        },
        validateText: function(e) {
            if(ui.textCreation) {
                app.layers.push(new textLayer(j("canvas")[0].width/2, j("canvas")[0].height/2, j('#text_input_field').val(), DEFAULT_FONT, DEFAULT_FONT_SIZE, DEFAULT_COLOR, DEFAULT_BOLD, DEFAULT_ITALIC));
                app.activateLayer(app.layers.length-1);
                app.addLayerToStage(app.layers[app.layers.length-1]);

                app.stage.dispatchEvent("layerAdded");
                ui.textCreation = false;
            }
            else {
                app.activeLayer.setText(j('#text_input_field').val());
            }
            ui.hideTextInput();
        },
        showTextInput: function() {
            j('#text_input').css("display", "block");
            j('#editor_overlay').css("display", "block");
            j('#text_input_field').val("");
            setTimeout(function(){j('#text_input_field').focus();},0);
        },
        hideTextInput: function() {
            j('#text_input').css("display", "none");
            j('#editor_overlay').css("display", "none");
        },
        changeFontSize: function(e) {
            if(app.activeLayer != null && layer.type.TEXT == app.activeLayer.getType()) {
                if(isNaN(e.target.value) || '' == e.target.value)
                    return;
                app.activeLayer.setFontSize(e.target.value);
            }
        },
        setBold: function(e) {
            if(app.activeLayer != null && layer.type.TEXT == app.activeLayer.getType()) {
                app.activeLayer.setBold(!!j('#ui_bold').attr('checked'));
            }
        },
        setItalic: function(e) {
            if(app.activeLayer != null && layer.type.TEXT == app.activeLayer.getType()) {
                app.activeLayer.setItalic(!!j('#ui_italic').attr('checked'));
            }
        },
        setColor: function(e) {
            if(app.activeLayer != null && layer.type.TEXT == app.activeLayer.getType()) {
                app.activeLayer.setColor(colorPicker.color);
            }
        },
        setFonts: function() {
            var addInitText = function(f) {
                var text = new createjs.Text("t", f, "#000000");
                text.x = -40;
                text.y = -40;
                app.stage.addChild(text);
            }
            j.each(app.fonts, function(k,v) {
                j("<option>" + k + "</option>").appendTo('#ui_fonts');

                // Add a small text of each font to stage to prevent shifting at the first time they appear
                if(v.s.e)
                    addInitText("20px " + k);
                if(v.b.e)
                    addInitText("bold 20px " + k);
                if(v.bi.e)
                    addInitText("bold italic 20px " + k);
                if(v.i.e)
                    addInitText("italic 20px " + k);
            });
        },
        setupFontMenu: function() {
            j.each(j('#ui_fonts-menu li'), function(k,v) {
                j(v).css("font-family", j(v).html());
            });
            j('#ui_text .ui-selectmenu-text').css("font-family", j('#ui_text .ui-selectmenu-text').html());
        },
        changeFont: function(e) {
            j('#ui_text .ui-selectmenu-text').css("font-family", e.target.value);
            if(app.activeLayer != null && layer.type.TEXT == app.activeLayer.getType()) {
                app.activeLayer.setFont(e.target.value);
            }
            ui.updateBoldItalic( e.target.value);
        },
        setFont: function(f) {
            j('#ui_fonts').val(f);
            j('#ui_fonts').selectmenu('refresh', true);
            j('#ui_text .ui-selectmenu-text').css("font-family", f);
            this.updateBoldItalic(f);
        },
        updateBoldItalic: function(f) {
            if(app.fonts[f].b.e)
                j('#ui_bold').button("enable");
            else
                j('#ui_bold').button("disable");
            if(app.fonts[f].i.e)
                j('#ui_italic').button("enable");
            else
                j('#ui_italic').button("disable");
        },
        closeLoader: function(e) {
            j('#loader').css("display", "none");
            j('#editor_overlay').css("display", "none");
        },
        openLoader: function(e) {
            j('#loader').css("display", "block");
            j('#editor_overlay').css("display", "block");
        },
        closeWarning: function(e) {
            j('#editor_overlay').unbind("click", ui.closeWarning);
            j('#instructions').css("display", "none");
            j('#editor_overlay').css("display", "none");
        },
        openWarning: function(e) {
            j('#editor_overlay').bind("click", ui.closeWarning);
            j('#instructions').css("display", "block");
            j('#editor_overlay').css("display", "block");
        },
        launchSave: function(e) {
            if(null == app.mask) {
                alert(app.ln.shape_before_save);
                return;
            }
            else if(!j('#stop_display_warning')[0].checked) {
                j('#editor_overlay').css("display","block");
                j('#warning').css("display","block");
            }
            else {
                app.save();
            }
        },
        reset: function(e) {
            app.activateLayer(null);
            app.stage.removeAllChildren();
            app.layers = [];
            ui.activeTab(ui.currentUserTab, j('#user_images_list_button'), j('#user_images_list'));
            app.mask = null;
        },
        dimMask: function() {
            if(null != app.mask)
                ui.setMaskAlpha(0.5);
        },
        showMask: function() {
            if(null != app.mask)
                ui.setMaskAlpha(1);
        },
        setMaskAlpha: function(v) {
            app.mask.getImage().removeAllEventListeners("tick");
            app.mask.getImage().addEventListener("tick", function() {
                if(0.5 == v && v <= app.mask.getImage().alpha || 1 == v && v >= app.mask.getImage().alpha)
                    app.mask.getImage().alpha += (1 == v) ? 0.1 : -0.1;
                else
                    app.mask.getImage().removeAllEventListeners("tick");
            });
        },
        // Deselect all
        clickOnStage: function(e) {
            ui.dimMask();
            if(0 == app.stage.getObjectsUnderPoint(e.stageX, e.stageY).length) {
                ui.clickOut();
            }
        },
        clickOutOfStage: function(e) {
            if("div" == e.target.localName && "transparency" != e.target.id || "p" == e.target.localName) {
                ui.showMask();
                ui.clickOut();
            }
        },
        clickOut: function() {
            app.activateLayer(null);
        },
        dropOnCanvas: function(event, ui) {
            // IE
            if (event.srcElement != undefined)
                var elem = event.srcElement;
            // Chrome
            else if (event.toElement != undefined)
                var elem = event.toElement;
            // Firefox
            else
                var elem = event.originalEvent.target;

            // Add an image
            if("image_thumb" == elem.id.substr(0, 11)) {
                app.images[parseInt(elem.id.substr(12))]
                    .addLayer(ui.offset.left + event.layerX - j('#canvas').offset().left,
                        ui.offset.top + event.layerY - j('#canvas').offset().top);
            }
            // Add an icon
            else if("icon_btn" == elem.id.substr(0, 8)) {
                if(null == app.icons[elem.id.substr(9)])
                    app.icons[elem.id.substr(9)] = new icon(elem.id.substr(9));
                app.icons[elem.id.substr(9)].addLayer(ui.offset.left + event.layerX - j('#canvas').offset().left,
                    ui.offset.top + event.layerY - j('#canvas').offset().top);
            }
        },
        selectMask: function(e,ui) {
            if(null == app.masks[e.target.id.substr(9)])
                app.masks[e.target.id.substr(9)] = new mask(e.target.id.substr(9));
            else
                app.masks[e.target.id.substr(9)].addMask();
        },
        zoomLayer: function(e) {
            if(app.activeLayer != null && layer.type.TEXT != app.activeLayer.getType()) {
                if("ui_zoom_plus" == e.target.id)
                    app.activeLayer.setScale(1.07,1.07,true);
                if("ui_zoom_minus" == e.target.id)
                    app.activeLayer.setScale(0.93,0.93,true);
            }
        },
        changeOrder: function(e) {
            if(app.activeLayer != null) {
                var change = ("ui_background" == e.target.id) ? -1 : 1;
                var index = app.stage.getChildIndex(app.activeLayer.getGlobalContainer());
                if(-1 == change && 0 == index)
                    return;
                // If no mask, move to foreground
                if(null == app.mask) {
                    if(1 == change && app.stage.getNumChildren() == index + 1)
                        return;
                }
                // If mask, move one before foreground
                else
                if(1 == change && app.stage.getNumChildren() == index + 2)
                    return;
                app.stage.swapChildrenAt(index, index + change);
                var temp = app.layers[index];
                app.layers[index] = app.layers[index + change];
                app.layers[index + change] = temp;
                app.stage.update();
            }
        },
        deleteLayer: function(e) {
            if(app.activeLayer != null) {
                app.removeLayerFromStage(app.activeLayer);
                var index = app.layers.indexOf(app.activeLayer);
                if (index > -1) {
                    app.layers.splice(index, 1);
                }
                app.activateLayer(null);
            }
        },
        rotateLayer: function(e) {
            if(app.activeLayer != null) {
                var v = 0;
                if('ui_rotate_right' == e.target.id)
                    v = app.activeLayer.getRotation() + 1;
                else if('ui_rotate_left' == e.target.id)
                    v = app.activeLayer.getRotation() - 1;
                else {
                    if(isNaN(e.target.value) || '' == e.target.value)
                        return v = app.activeLayer.getRotation();
                    v = e.target.value;
                }
                app.activeLayer.setRotation(v);
            }
        },
        moveLayer: function(e) {
            if(app.activeLayer != null) {

                var v = 0;
                switch(e.target.id) {
                    case ('move_top'):
                        app.activeLayer.getGlobalContainer().y -= D_MOVE;
                        break;
                    case ('move_left'):
                        app.activeLayer.getGlobalContainer().x -= D_MOVE;
                        break;
                    case ('move_right'):
                        app.activeLayer.getGlobalContainer().x += D_MOVE;
                        break;
                    case ('move_bottom'):
                        app.activeLayer.getGlobalContainer().y += D_MOVE;
                        break;
                }
            }
        },
        transpLayer: function(e, ui) {
            if(app.activeLayer != null)
                app.activeLayer.setAlpha(ui.value);
        },
        activeTab: function(cur, btn, tab) {
            cur.tab.css('display', 'none');
            cur.tab = tab;
            cur.tab.css('display', 'block');
            cur.btn.css('color', '#336699');
            cur.btn.css('background', 'white');
            cur.btn = btn;
            cur.btn.css('color', 'white');
            cur.btn.css('background', '#AA0070');
            if('#user_images_list' == tab.selector) {
                j('#validate_1').css('display', 'block');
                j('#validate_2').css('display', 'none');
            }
            else if('#user_magnets_list' == tab.selector) {
                j('#validate_2').css('display', 'block');
                j('#validate_1').css('display', 'none');
            }
        },
        stopProgressBar: function() {
            this.nbrLoading--;
            if(this.nbrLoading == 0)
                j('#ajax_loader').attr("src", "/skin/editor/ajax-loader.png");
        },
        startProgressBar: function() {
            this.nbrLoading++;
            if(this.nbrLoading == 1)
                j('#ajax_loader').attr("src", "/skin/editor/ajax-loader.gif");
        },
        setStatusBarText: function(text) {
            j('#status').text(text);
        },
        setMagnetTabName: function(nbMagnets) {
            if(nbMagnets > 1)
                j('#user_magnets_list_button').text(app.ln.mags_created + nbMagnets);
            else
                j('#user_magnets_list_button').text(app.ln.mag_created + nbMagnets);
        },
        moveImgListLeft: function (e) {
            if(ui.imgListShift < 0) {
                ui.imgListShift += SHIFT;
                j('#user_images_list_container').animate({ left: "+=" + SHIFT }, 400);
            }
        },
        moveImgListRight: function (e) {
            if(ui.imgListSize + ui.imgListShift >= IMG_LIST_MASK_SIZE) {
                ui.imgListShift -= SHIFT;
                j('#user_images_list_container').animate({ left: "-=" + SHIFT }, 400);
            }
        },
        moveMagListLeft: function (e) {
            if(ui.magListShift < 0) {
                ui.magListShift += SHIFT;
                j('#user_magnets_list_container').animate({ left: "+=" + SHIFT }, 400);
            }
        },
        moveMagListRight: function (e) {
            if(ui.magListSize + ui.magListShift >= MAG_LIST_MASK_SIZE) {
                ui.magListShift -= SHIFT;
                j('#user_magnets_list_container').animate({ left: "-=" + SHIFT }, 400);
            }
        },
        updateImgListSize: function(val) {
            this.imgListSize += val + (val < 0 ? -4 : 4);
        },
        updateMagListSize: function(val) {
            this.magListSize += val + (val < 0 ? -4 : 4);
        },
        onRotateStart: function(e) {
            if(null == app.activeLayer)
                return;
            app.activeLayer.setOrigRotate();
        },
        onRotate: function(e) {
            app.activeLayer.setRotation(app.activeLayer.getOrigRotate() + e.rotation);
        },
        onPinchStart: function(e) {
            if(null == app.activeLayer)
                return;
            if(layer.type.TEXT == app.activeLayer.getType())
                app.activeLayer.setOrigFontSize();
            else
                app.activeLayer.setOrigScale();
        },
        onPinch: function(e) {
            if(layer.type.TEXT == app.activeLayer.getType()) {
                var s = Math.round(e.scale * app.activeLayer.getOrigFontSize());
                s = (s > MAX_FONT_SIZE) ? MAX_FONT_SIZE : s;
                s = (s < MIN_FONT_SIZE) ? MIN_FONT_SIZE : s;
                app.activeLayer.setFontSize(s);
            }
            else
                app.activeLayer.setScale(e.scale*app.activeLayer.getOrigScale().x, e.scale*app.activeLayer.getOrigScale().y, false);
        },
        onPanStart: function(e) {
            if(null == app.activeLayer)
                return;
            app.activeLayer.setOrigCoord();
        },
        onPan: function(e) {
            if(null == app.activeLayer)
                return;
            app.activeLayer.getGlobalContainer().x = app.activeLayer.getOrigCoord().x + e.deltaX;
            app.activeLayer.getGlobalContainer().y = app.activeLayer.getOrigCoord().y + e.deltaY;
        }
    }

    /** COLOR PICKER
     * UI element to pick text color
     * See https://gist.github.com/robtarr/1199770
     */
    colorPicker = {
        canvas: null,
        context: null,
        disp: null,
        color: "",
        savedColors: [],
        initialize: function(p, colorP) {
            this.disp = p;
            this.setColor(colorP);
            this.disp.css("background", "#" + this.color);
            j('<div id="color_palette"><canvas width="230" height="155" id="color_canvas"></canvas>' +
                '<div class="saved_color" id="saved_color_0"></div>' +
                '<div class="saved_color" id="saved_color_1"></div>' +
                '<div class="saved_color" id="saved_color_2"></div>' +
                '<div class="saved_color" id="saved_color_3"></div>' +
                '<div class="saved_color" id="saved_color_4"></div>' +
                '<div class="saved_color" id="saved_color_5"></div>' +
                '<div class="saved_color" id="saved_color_6"></div>' +
                '<div class="saved_color" id="saved_color_7"></div>' +
                '<input type="text" size="3" id="colorR" class="input_color" />' +
                '<input type="text" size="3" id="colorG" class="input_color" />' +
                '<input type="text" size="3" id="colorB" class="input_color" /> <br/>' +
                '<label>#<input type="text" size="6" id="colorH" class="input_color" /></label></div>').appendTo('body');

            this.canvas = j('canvas#color_canvas');
            this.context = this.canvas[0].getContext('2d');
            var gradient = this.context.createLinearGradient(0, 0, this.canvas.width(), 0);

            // Create color gradient
            gradient.addColorStop(0,    "rgb(255,   0,   0)");
            gradient.addColorStop(0.15, "rgb(255,   0, 255)");
            gradient.addColorStop(0.33, "rgb(0,     0, 255)");
            gradient.addColorStop(0.49, "rgb(0,   255, 255)");
            gradient.addColorStop(0.67, "rgb(0,   255,   0)");
            gradient.addColorStop(0.84, "rgb(255, 255,   0)");
            gradient.addColorStop(1,    "rgb(255,   0,   0)");

            // Apply gradient to canvas
            this.context.fillStyle = gradient;
            this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height);

            // Create semi transparent gradient (white -> trans. -> black)
            gradient = this.context.createLinearGradient(0, 0, 0, this.canvas.height());
            gradient.addColorStop(0,   "rgba(255, 255, 255, 1)");
            gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
            gradient.addColorStop(0.5, "rgba(0,     0,   0, 0)");
            gradient.addColorStop(1,   "rgba(0,     0,   0, 1)");

            // Apply gradient to canvas
            this.context.fillStyle = gradient;
            this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height);

            j("#color_palette").css("display", "none");
            for(var i=0; i<8; i++) {
                colorPicker.savedColors.push("FFFFFF");
            }
        },
        open: function(e) {
            if("none" == j('#color_palette').css("display")) {
                j('#color_palette').css("display", "block");
                j('#color_palette').css("left", (colorPicker.disp.offset().left + colorPicker.disp.width() - j('#color_palette').width() - 10) + "px");
                j('#color_palette').css("top", (colorPicker.disp.offset().top + colorPicker.disp.height()) + "px");
                j('#color_canvas').bind("click", colorPicker.selectColor);
                j('.saved_color').bind("click", colorPicker.selectColor);
                j('.saved_color').bind("mouseenter", colorPicker.setSavedColor);
                colorPicker.canvas.bind("mousemove", colorPicker.getColorData);
                j('.input_color').bind("keypress", colorPicker.enterColor);
                colorPicker.setColor(colorPicker.color);
            }
            else {
                j('#color_palette').css('display', 'none');
                j('#color_canvas').unbind("click", colorPicker.selectColor);
                j('.saved_color').unbind("click", colorPicker.selectColor);
                j('.saved_color').unbind("mouseenter", colorPicker.setSavedColor);
                colorPicker.canvas.unbind("mousemove", colorPicker.getColorData);
                j('.input_color').unbind("keypress", colorPicker.enterColor);
            }
        },
        enterColor: function (e) {
            if (13 == e.which)
                colorPicker.open();
            else {
                var c = "";
                var minV = function(v) {return "" == v ? "0" : v;}
                if("colorH" == e.target.id) {
                    c = minV(j(e.target).val()).substr(0,6);
                    c = parseInt(c, 16).toString(16);
                }
                else {
                    c = colorPicker.toHex({
                        r: parseInt(minV(j('#colorR').val()).substr(0,3)),
                        g: parseInt(minV(j('#colorG').val()).substr(0,3)),
                        b: parseInt(minV(j('#colorB').val()).substr(0,3))});
                }
                colorPicker.setColor(c);
            }
        },
        setColor: function(color) {
            colorPicker.color = color;
            colorPicker.disp.css("background", "#" + colorPicker.color);
            var c = colorPicker.toRGB(colorPicker.color);
            j('#colorR').val(c.r);
            j('#colorG').val(c.g);
            j('#colorB').val(c.b);
            j('#colorH').val(colorPicker.color);
            app.stage.dispatchEvent("colorChanged");
        },
        setSavedColor: function(e) {
            colorPicker.setColor(colorPicker.toHex(j(e.target).css("background-color")));
        },
        getColorData: function(e) {
            var imageData = colorPicker.context.getImageData(Math.round(e.pageX - colorPicker.canvas.offset().left), Math.round(e.pageY - colorPicker.canvas.offset().top), 1, 1);
            colorPicker.setColor(colorPicker.toHex({r: imageData.data[0], g: imageData.data[1], b: imageData.data[2]}));
        },
        selectColor: function() {
            if(-1 == colorPicker.savedColors.indexOf(colorPicker.color)) {
                for(var i=7; i>0 ; i--) {
                    colorPicker.savedColors[i] = colorPicker.savedColors[i-1];
                    j("#saved_color_"+i).css("background", "#" + colorPicker.savedColors[i-1]);
                }
                colorPicker.savedColors[0] = colorPicker.color;
                j("#saved_color_"+i).css("background", "#" + colorPicker.color);
            }
            colorPicker.open();
        },
        toHex: function(c) {
            var pad = function(s) {s="00"+s.toString(16);return s.substr(s.length-2);};
            if("string" != j.type(c))
                return pad(c.r) + pad(c.g) + pad(c.b);
            else {
                c = c.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                return pad(parseInt(c[1])) + pad(parseInt(c[2])) + pad(parseInt(c[3]));
            }
        },
        toRGB: function(h, base) {
            base = (undefined == base) ? 16 : base;
            h = parseInt(h, base);
            var c = {r:0, g:0, b:0};
            c.b = h % 256;
            c.g = Math.floor(h/256) % 256;
            c.r = Math.floor(h/(256*256)) % 256;
            return c;
        }
    }

    /** FILE
     * Manages the file selecting and downloading
     */
    file = {
        openImage: function (e) {
            var image = e.target.files[0],
                self = this;

            if (!image || !image.type.match('image.*'))
                return false;

            var reader = new FileReader();
            reader.onload = function(e) {
                file.uploadImage(e.target.result, image.name, image.size);
            };

            reader.readAsDataURL(image);
        },
        uploadImage: function (e, name, size) {
            j.post("/creation/editor/upload" + app.getGetInfo(),
                {"uploadType": "ajax", "name": name, "size": size, "photomagnet_user_picture[filename]": e}
                )
                .done(
                    function(resultJson){
                        var result = j.parseJSON(resultJson);
                        if("ok" != result.result)
                            alert(app.ln.img_up_err +  result.error_code);
                        else {
                            app.images[result.content.pid] = new customerImage(result.content.pid);
                        }
                        ui.stopProgressBar();
                        ui.closeLoader();
                        j('#add_photos input').val('');
                    })
                .fail(function() {
                    alert(app.ln.img_up_err + app.ln.unreachable);
                    ui.stopProgressBar();
                    ui.closeLoader();
                });
            ui.startProgressBar();
            ui.openLoader();
        },
    }

    /** CUSTOMER IMAGE
     * Image of a customer, loading, thumbnail
     */
    var customerImage = (function () {

        var cls = function (idP) {
            // Public methods
            this.getThumbnail = function() {
                j("<div id=\"image_thumb_div_" + id + "\" class=\"image_thumb\"><img id=\"image_thumb_" + id + "\" src=\"" + "/creation/editor/thumbnail/id/" + id
                    + "\" title=\"" + app.ln.drag_image + "\" alt=\"Image thumbnail " + id + "\" /><img id=\"dlt_img" + id + "\" class=\"dlt_small\" "
                    + "src=\"/skin/editor/deletesmall.png\" alt=\"" + app.ln.delete_ + "\" title=\"" + app.ln.delete_ + "\"></div>")
                    .appendTo("#user_images_list_container");

                // Once the thumbnail is loaded
                var self = this;
                j("#image_thumb_" + id).load(this.addThumbnail);
                ui.stopProgressBar();
            }

            this.addThumbnail = function(e){
                // Get image width
                thumbnailWidth = j(this).width();
                ui.updateImgListSize(j(this).width());

                // Preload the big image
                self.getCrea(id);

                // Thumbnail dragging
                j("#image_thumb_" + id).draggable({
                    start : function(e,ui) {
                        j("#user_images_list_mask").css("height", "560px").css("margin-top", "-482px");
                        j("#user_images_list_container").css("height", "560px").css("margin-top", "483px");
                        j("#image_thumb_" + id).css("z-index", "1000");
                        j("#dlt_img" + id).css("visibility", "hidden");
                    },
                    stop : function(e,ui) {
                        j("#user_images_list_mask").css("height", "auto").css("margin-top", "1px");
                        j("#user_images_list_container").css("height", "78px").css("margin-top", "auto");
                        j("#image_thumb_" + id).css("top", "auto").css("left", "auto").css("z-index", "auto");
                        j("#dlt_img" + id).css("visibility", "visible");
                    },
                });

                // Delete the image
                j("#dlt_img" + id).click(self.deleteImage);
            }

            this.deleteImage = function(e){
                // Check if the image is not being used
                var i=0, found = false;
                while(!found && i<app.layers.length) {
                    found = (layer.type.IMAGE == app.layers[i].getType() && app.layers[i].getImageId() == id) ? true : false;
                    i++;
                }
                if(found){
                    alert(app.ln.img_used);
                    return;
                }
                ui.startProgressBar();

                // Delete image
                j.ajax("/creation/editor/deleteImage/id/" + id)
                    .done(function(resultJson) {
                        ui.stopProgressBar();
                        var result = j.parseJSON(resultJson);
                        if("ok" != result.result)
                            alert(app.ln.err_delete_img +  result.error_code);
                        else {
                            ui.updateImgListSize(-1 * thumbnailWidth);
                            j("#image_thumb_div_" + id).remove();
                        }
                    }).fail(function() {
                    ui.stopProgressBar();
                    alert(app.ln.err_delete_img + app.ln.unreachable);
                });
            }

            // Get the image at the creation format
            this.getCrea = function(id, x, y) {
                crea = new Image();
                crea.src = "/creation/editor/crea/id/" + id;
                crea.onload = function () {
                    self.loaded = true;
                };
            }

            // Wait for the creation image to be loaded
            this.waitImage = function(x, y) {
                ui.startProgressBar();
                crea.onload = function () {
                    self.loaded = true;
                    ui.stopProgressBar();
                    self.addLayer(x,y);
                };
            }

            // Add a layer of this image
            this.addLayer = function(x, y) {
                if(!self.loaded)
                    return this.waitImage(x, y);

                var bm = new createjs.Bitmap(crea);
                app.layers.push(new imageLayer(bm, id, x, y, crea.height, crea.height));
                app.activateLayer(app.layers.length-1);
                app.addLayerToStage(app.layers[app.layers.length-1]);

                app.stage.dispatchEvent("layerAdded");
            }

            // Constructor
            var id = idP;
            var crea = null;
            var self = this;
            var thumbnailWidth = 0;
            var loaded = false;
            // First load the thumbnail
            ui.startProgressBar();
            this.getThumbnail();
        };

        return cls;
    })();

    /** CUSTOMER MAGNET
     * Image of a customer, loading, thumbnail
     */
    var customerMagnet = (function () {
        var nbMagnets = 0;

        var cls = function (idP) {
            // Public methods
            this.getThumbnail = function() {
                j("<div id=\"magnet_thumb_div_" + id + "\" class=\"magnet_thumb\"><img id=\"magnet_thumb_" + id + "\" src=\"" + "/creation/editor/magnetTn/id/" + id
                    + "\" alt=\"Magnet thumbnail " + id + "\" /><img id=\"dlt_mag" + id + "\" class=\"dlt_small\" "
                    + "src=\"/skin/editor/deletesmall.png\" alt=\"" + app.ln.delete_ + "\" title=\"" + app.ln.delete_ + "\"></div>")
                    .appendTo("#user_magnets_list_container");

                // Once the thumbnail is loaded
                var self = this;
                j("#magnet_thumb_" + id).load(this.addThumbnail);
                ui.stopProgressBar();
            }

            this.addThumbnail = function(e){
                ui.updateMagListSize(MAG_TN_WIDTH);
                ui.setMagnetTabName(++nbMagnets);

                // Magnet displaying
                self.getContent(false);

                // Delete the magnet
                j("#dlt_mag" + id).click(self.deleteMagnet);
                // Load the magnet
                j("#magnet_thumb_" + id).click(self.loadMagnet);
            }

            this.deleteMagnet = function(e){
                ui.startProgressBar();

                // Delete the magnet
                j.ajax("/creation/editor/delete/id/" + id)
                    .done(function(resultJson) {
                        ui.stopProgressBar();
                        var result = j.parseJSON(resultJson);
                        if("ok" != result.result)
                            alert(app.ln.err_delete_mag +  result.error_code);
                        else {
                            ui.updateMagListSize(-1 * MAG_TN_WIDTH);
                            ui.setMagnetTabName(--nbMagnets);
                            j("#magnet_thumb_div_" + id).remove();
                        }
                    }).fail(function() {
                    ui.stopProgressBar();
                    alert(app.ln.err_delete_mag + app.ln.unreachable);
                });
            }

            // Get the structure of the magnet
            this.getContent = function(load) {
                j.ajax("/creation/editor/magnet/id/" + id)
                    .done(function(resultJson) {
                        //ui.stopProgressBar();
                        var result = j.parseJSON(resultJson);
                        if("ok" != result.result)
                            error = app.ln.mag_dn_err +  result.error_code;
                        else {
                            self.content = customerMagnet.parseContent(result.content);
                            if(load)
                                self.loadMagnet();
                        }
                    }).fail(function() {
                    //ui.stopProgressBar();
                    error = app.ln.mag_dn_err + app.ln.unreachable;
                });
            }

            // Load the magnet to stage
            this.loadMagnet = function(e) {
                if(null != self.error) {
                    alert(self.error);
                    self.error = null;
                    return;
                }
                if(null == self.content)
                    return self.getContent(true);
                ui.reset();

                if(null == app.masks[self.content.shape])
                    app.masks[self.content.shape] = new mask(self.content.shape);
                else
                    app.masks[self.content.shape].addMask();

                self.currentLayer = 0;
                app.stage.addEventListener("layerAdded", self.layerLoaded);
                self.loadLayer();
            }

            this.loadLayer = function() {
                if(this.content.layers.length <= this.currentLayer) {
                    app.stage.removeEventListener("layerAdded", self.layerLoaded);
                    return;
                }
                var v = this.content.layers[this.currentLayer];
                if("image" == self.content.layers[this.currentLayer].type) {
                    app.images[v.image_id].addLayer(v.x + v.width / 2, v.y + v.height / 2);
                }
                else if("icon" == v.type) {
                    if(null == app.icons[v.icon_id])
                        app.icons[v.icon_id] = new icon(v.icon_id);
                    app.icons[v.icon_id].addLayer(v.x + v.width / 2, v.y + v.height / 2);
                }
                else if("text" == v.type) {
                    app.layers.push(new textLayer(v.x, v.y, v.text, v.font, v.font_size, v.color, ('1' == v.bold), ('1' == v.italic)));
                    app.activateLayer(app.layers.length-1);
                    app.addLayerToStage(app.layers[app.layers.length-1]);

                    app.stage.dispatchEvent("layerAdded");
                }
            }

            this.layerLoaded = function(e) {
                var v = self.content.layers[self.currentLayer];
                app.layers[self.currentLayer].setRotation(v.angle);
                app.layers[self.currentLayer].setAlpha(v.alpha);
                if("text" != v.type)
                    app.layers[self.currentLayer].setSize(v.width, v.height);
                else {
                    var size = app.layers[self.currentLayer].getBoxRectangle();
                    app.layers[self.currentLayer].setCoord(v.x + size.w / 2, v.y + size.h / 2);
                }
                app.layers[self.currentLayer].adjustHandles();
                self.loadLayer(++self.currentLayer);
            }

            cls.parseContent = function(c) {
                c.id = parseInt(c.id);
                j.each(c.layers, function(k, v) {
                    v.object_id = parseInt(v.object_id);
                    v.x = parseInt(v.x), v.y = parseInt(v.y);
                    v.width = parseInt(v.width), v.height = parseInt(v.height);
                    v.angle = parseInt(v.angle), v.alpha = parseInt(v.alpha);
                    if(undefined != v.icon_id);
                    else if(undefined != v.image_id)
                        v.image_id = parseInt(v.image_id);
                    else {
                        v.bold = parseInt(v.bold), v.italic = parseInt(v.italic), v.font_size = parseInt(v.font_size);
                        v.text_height = parseInt(v.text_height), v.text_width = parseInt(v.text_width);
                        v.color = colorPicker.toHex(colorPicker.toRGB(v.color, 10));
                    }
                });
                return c;
            };

            // Constructor
            var id = idP;
            var crea = null;
            var self = this;
            var error = null;
            var currentLayer = 0;
            var content = null;
            // First load the thumbnail
            ui.startProgressBar();
            this.getThumbnail();
        };

        return cls;
    })();

    /** ICON
     * Illustration
     */
    var icon = (function () {

        var cls = function (idP) {

            // Wait for the creation icon to be loaded
            this.waitImage = function(x, y) {
                ui.startProgressBar();
                crea.onload = function () {
                    loaded = true;
                    ui.stopProgressBar();
                    self.addLayer(x,y);
                };
            }

            // Add a layer of this icon
            this.addLayer = function(x, y) {
                if(!loaded)
                    return this.waitImage(x, y);

                var bm = new createjs.Bitmap(crea);
                app.layers.push(new iconLayer(bm, id, x, y, crea.height, crea.height));
                app.activateLayer(app.layers.length-1);
                app.addLayerToStage(app.layers[app.layers.length-1]);

                app.stage.dispatchEvent("layerAdded");
            }

            if("string" == j.type(idP) && 1 == idP.length || "string" != j.type(idP) && idP < 10)
                var id = '0' + idP;
            else
                var id = idP;
            var loaded = false;
            var self = this;
            var crea = new Image();
            crea.src = "/creation/editor/icon/id/" + id;
            crea.onload = function(e) {
                self.loaded = true;
            };
        }

        return cls;
    })();

    /** MASK
     * Mask image
     */
    var mask = (function () {

        var cls = function (shapeP) {

            // Add the mask on stage
            this.addMask = function(e) {
                // If the mask wasn't already loaded
                if(null != e) {
                    ui.stopProgressBar();
                    bm = new createjs.Bitmap(crea);
                }
                app.addMaskToStage(self);
            }
            this.getImage = function() {
                return bm;
            }
            this.getShape = function() {
                return shape;
            }

            var shape = shapeP;
            var crea = new Image();
            var bm = null;
            var self = this;
            ui.startProgressBar();
            crea.src = "/creation/editor/mask/shape/" + shape;
            crea.onload = this.addMask;
        }

        return cls;
    })();

    /** LAYER
     * Layer in the editor
     * All the transfomations
     */
    var layer = (function () {

        var cls = function (contentP, typeP, scaleP) {
            var content = contentP;
            var globalContainer = new createjs.Container();
            var resizeContainer = new createjs.Container();
            var type = typeP;
            var handles = [];
            var active = false;
            var self = this;
            var origMouseX = 0;
            var origMouseY = 0;
            var origX = globalContainer.x;
            var origY = globalContainer.y;
            var origScaleX = resizeContainer.scaleX;
            var origScaleY = resizeContainer.scaleY;
            var prevRotate = content.rotate;
            var origRotate = 0;
            var ratio = 1;
            var updateMouseCoord = false;

            // Public methods
            this.activate = function() {
                active = true;
                this.showHandles();
            }
            this.deactivate = function() {
                active = false;
                this.hideHandles();
            }
            this.drawHandles = function() {
                for(var i=0; i<3; i++) {
                    for(var k=0; k<3; k++) {
                        var handle = new createjs.Container();
                        if(i*3 + k != 4) {
                            var handleSh = new createjs.Shape();
                            handleSh.graphics.s("#555").f("#fff").dr(0, 0, 10, 10);
                            handle.addChild(handleSh);
                            handle.hitArea = new createjs.Shape();
                            handle.hitArea.graphics.clear().s("#555").f("#fff").dr(0, 0, 10, 10);
                        }
                        else if(layer.type.TEXT != type) {
                            var handleSmallSh = new createjs.Shape();
                            var handleBigSh = new createjs.Shape();
                            handleBigSh.graphics.f("rgba(0,0,0,0.7)").dc(0, 0, 24, 24);
                            handle.addChild(handleBigSh);
                            handleSmallSh.graphics.s("#555").f("#fff").dc(0, 0, 5, 5);
                            handle.addChild(handleSmallSh);

                        }
                        handle.handleNbr = i*3 + k;
                        globalContainer.addChild(handle);
                        handles.push(handle);
                    }
                }
                this.adjustHandles();
            }
            this.adjustHandles = function() {
                var size = this.getBoxRectangle();
                for(var i=0; i<3; i++) {
                    for(var k=0; k<3; k++) {
                        if(i*3 + k != 4) {
                            handles[i*3 + k].x = (k - 1) * size.w * resizeContainer.scaleX /2 - 5;
                            handles[i*3 + k].y = (i - 1) * size.h * resizeContainer.scaleY /2 - 5;
                        }
                        else {
                            handles[i*3 + k].x = (k - 1) * size.w * resizeContainer.scaleX /2;
                            handles[i*3 + k].y = (i - 1) * size.h * resizeContainer.scaleY /2;
                        }
                    }
                }
            }
            this.showHandles = function() {
                for(var i=0; i<3; i++) {
                    for(var k=0; k<3; k++) {
                        var handle = new createjs.Container();
                        if(i*3 + k != 4) {
                            if(layer.type.TEXT != type) {
                                handles[i*3 + k].addEventListener("mousedown", this.handleResizeClick);
                                handles[i*3 + k].addEventListener("pressmove", this.handleResizing);
                                handles[i*3 + k].addEventListener("pressup", this.handleStopResizing);
                            }
                            handles[i*3 + k].visible = true;
                        }
                        else if(layer.type.TEXT != type) {
                            handles[i*3 + k].getChildAt(0).addEventListener("mouseover", function(e) {e.target.alpha = 0.7;});
                            handles[i*3 + k].getChildAt(0).addEventListener("mouseout", function(e) {e.target.alpha = 0.1;});
                            handles[i*3 + k].addEventListener("mousedown", this.handleRotateClick);
                            handles[i*3 + k].addEventListener("pressmove", this.handleRotating);
                            handles[i*3 + k].addEventListener("pressup", this.handleStopRotating);
                            handles[i*3 + k].visible = true;
                        }
                    }
                }
            }
            this.hideHandles = function() {
                for(var i=0; i<3; i++) {
                    for(var k=0; k<3; k++) {
                        var handle = new createjs.Container();
                        if(i*3 + k != 4) {
                            if(layer.type.TEXT != type) {
                                handles[i*3 + k].removeEventListener("mousedown", this.handleResizeClick);
                                handles[i*3 + k].removeEventListener("pressmove", this.handleResizing);
                                handles[i*3 + k].removeEventListener("pressup", this.handleStopResizing);
                            }
                            handles[i*3 + k].visible = false;
                        }
                        else if(layer.type.TEXT != type) {
                            handles[i*3 + k].getChildAt(0).removeAllEventListeners("mouseover");
                            handles[i*3 + k].getChildAt(0).removeAllEventListeners("mouseout");
                            handles[i*3 + k].removeEventListener("mousedown", this.handleRotateClick);
                            handles[i*3 + k].removeEventListener("pressmove", this.handleRotating);
                            handles[i*3 + k].removeEventListener("pressup", this.handleStopRotating);
                            handles[i*3 + k].visible = false;
                        }
                    }
                }
            }
            this.setCoord = function(x, y) {

                globalContainer.x = x;
                globalContainer.y = y;
            }
            this.setOrigCoord = function() {
                origX = globalContainer.x;
                origY = globalContainer.y;
            }
            this.getOrigCoord = function() {
                return {x: origX, y: origY};
            }
            this.setAlpha = function(a) {
                content.alpha = a/100;
            }
            this.getAlpha = function(a) {
                return content.alpha * 100;
            }
            this.getOrigRotate = function() {
                return this.origRotate;
            }
            this.setOrigRotate = function() {
                this.origRotate = content.rotation;
            }
            this.setRotation = function(r) {
                content.rotation = (parseInt(r) + 360) % 360;
                self.adjustHandles();
                j('#ui_rotate').val(content.rotation);
            }
            this.getRotation = function(a) {
                return (content.rotation + 360) % 360;
            }
            this.handleRotateClick = function(event) {
                prevRotate = content.rotation % 360;
                origRotate = Math.atan2((event.stageY - globalContainer.y), (event.stageX - globalContainer.x)) * 360 / (2 * Math.PI);

                self.adjustHandles();
                app.disableMultitouch();
            }
            this.handleRotating = function(event) {
                self.adjustHandles();

                content.rotation = Math.round((Math.atan2((event.stageY - globalContainer.y), (event.stageX - globalContainer.x)) * 360 / (2 * Math.PI)) + prevRotate - origRotate);
                j('#ui_rotate').val((content.rotation + 360) % 360);
            }
            this.handleStopRotating = function() {
                app.enableMultitouch();
            }
            this.getOrigScale = function() {
                return {x: this.origScaleX, y: this.origScaleY};
            }
            this.setOrigScale = function() {
                this.origScaleX = resizeContainer.scaleX;
                this.origScaleY = resizeContainer.scaleY;
            }
            this.getScale = function() {
                return {x: resizeContainer.scaleX, y: resizeContainer.scaleY};
            }
            this.setScale = function(x,y,increment) {
                if(increment != undefined && increment){
                    resizeContainer.scaleX *= x;
                    resizeContainer.scaleY *= y;
                }
                else {
                    resizeContainer.scaleX = x;
                    resizeContainer.scaleY = y;
                }
                this.adjustHandles();
            }
            this.setSize = function(w, h) {
                var size = this.getBoxRectangle();
                resizeContainer.scaleX = w / size.w;
                resizeContainer.scaleY = h / size.h;
            }
            this.handleResizeClick = function(event) {
                app.disableMultitouch();
                origMouseX = event.stageX;
                origMouseY = event.stageY;
                origX = globalContainer.x;
                origY = globalContainer.y;
                origScaleX = resizeContainer.scaleX;
                origScaleY = resizeContainer.scaleY;
                var size = self.getBoxRectangle();
                ratio = size.h/size.w;
            }
            this.handleResizing = function(event) {

                var n = event.currentTarget.handleNbr;
                if(4 == n)
                    return;
                // Size delta
                var dX = event.stageX - origMouseX;
                var dY = event.stageY - origMouseY;

                var size = self.getBoxRectangle();

                var p = j("#ui_proportions")[0].checked;

                cY = (n < 3) ? -1 : 1;
                cX = (n % 3 == 0) ? -1 : 1;

                // For the edges handles with prop
                if(p && n%2 == 0) {
                    // We keep the delta of the smallest
                    // Bottom right and top left have the same sign, the others the opposite
                    if (Math.abs(dX) > Math.abs(dY))
                        dX = (n % 4 == 2 ? -1 : 1) * dY / ratio;
                    if (Math.abs(dY) > Math.abs(dX))
                        dY = (n % 4 == 2 ? -1 : 1) * dX * ratio;
                }
                // For the middle ones with prop
                if(n%2 == 1) {
                    // We just keep one axis and apply the ratio to the other one
                    if (n == 1 || n == 7) {
                        if(p)
                            dX = (n == 1 ? -1 : 1) * dY / ratio;
                        else dX = 0;
                    }
                    if (n == 3 || n == 5)
                        if(p)
                            dY = (n == 3 ? -1 : 1) * dX * ratio;
                        else dY = 0;
                }

                var sX = resizeContainer.scaleX;
                var sY = resizeContainer.scaleY;

                // Scale. just one side for the middle handle except with prop
                if(p || (n != 1 && n != 7))
                    sX = (origScaleX * size.w + cX * (dX)) / size.w;
                if(p || (n != 3 && n != 5))
                    sY = (origScaleY * size.h + cY * (dY)) / size.h;

                // No scale if value under 0
                if(sX * size.w > 5 && sY * size.h > 5) {
                    // Scale
                    resizeContainer.scaleX = sX;
                    resizeContainer.scaleY = sY;
                    // Shift if needed
                    globalContainer.x = dX / 2 + origX;
                    globalContainer.y = dY / 2 + origY;
                }

                self.adjustHandles();
            }
            this.handleStopResizing = function() {
                app.enableMultitouch();
            }
            this.getGlobalContainer = function() {
                return globalContainer;
            }
            this.getResizeContainer = function() {
                return resizeContainer;
            }
            this.getContent = function() {
                return content;
            }
            this.getType = function() {
                return type;
            }
            this.getBoxRectangle = function() {
                var h = (layer.type.TEXT == type) ? this.getTextHeight() : content.image.height;
                var w = (layer.type.TEXT == type) ? this.getTextWidth() : content.image.width;

                // Angle of the diagonal of the image
                var da = Math.atan(h / w);
                // Size of the diagonal of the image
                var d = Math.sqrt(h * h + w * w);
                var c = -1;
                if((content.rotation + 360) %180 <= 90)
                    c = 1;
                return {w: d * Math.abs(Math.cos(content.rotation * 2 * Math.PI / 360 - c * da)), h: d * Math.abs(Math.sin(content.rotation * 2 * Math.PI / 360 + c * da))} ;
            }
            this.clickOnLayer = function(event) {
                if(!active) {
                    self.activate();
                    app.activateLayer(app.layers.indexOf(self));
                }
            }
            this.getObjectRoot = function() {
                var box = this.getBoxRectangle();
                return {
                    width: Math.round(box.w * this.getResizeContainer().scaleX),
                    height: Math.round(box.h * this.getResizeContainer().scaleY),
                    alpha: this.getAlpha(),
                    x: Math.round(this.getGlobalContainer().x - box.w * this.getResizeContainer().scaleX / 2),
                    y: Math.round(this.getGlobalContainer().y - box.h * this.getResizeContainer().scaleY / 2),
                    angle: this.getContent().rotation
                };
            }

            // constructor
            var scale = 1;
            if (scaleP != undefined)
                scale = scaleP;

            resizeContainer.scaleX = scale;
            resizeContainer.scaleY = scale;

            resizeContainer.addChild(content);
            globalContainer.addChild(resizeContainer);

            content.addEventListener("mousedown", this.clickOnLayer);

            this.drawHandles();
            this.activate();
        };

        // public static
        cls.type = {
            IMAGE : 0,
            TEXT : 1,
            ICON : 2
        }

        return cls;
    })();

    /** IMAGE LAYER
     * Contains the image id
     */
    var imageLayer = (function () {
        var cls = function (contentP, idP, x, y, w, h) {

            this.getObject = function() {
                var obj = this.getObjectRoot();
                obj.layerType = "image";
                obj.imageId = id;
                return obj;
            }

            this.getImageId = function() {
                return id;
            }

            // constructor
            var id=idP;
            var scale = 1;
            // Set a maximum size for the image
            if((w > MAX_IMG_ADD_SIZE) || (h > MAX_IMG_ADD_SIZE))
                scale = (w > h) ? MAX_IMG_ADD_SIZE / w : MAX_IMG_ADD_SIZE / h;

            contentP.regX = contentP.image.width / 2;
            contentP.regY = contentP.image.height / 2;

            this.constructor._super.call(this, contentP, layer.type.IMAGE, scale);

            this.getGlobalContainer().x += x;
            this.getGlobalContainer().y += y;

        };
        inherit(cls, layer);

        return cls;
    })();

    /** TEXT LAYER
     * Text container
     */
    var textLayer = (function () {
        var cls = function (x, y, textP, fontNameP, fontSizeP, colorP, boldP, italicP) {

            this.getObject = function() {
                var c = colorPicker.toRGB(color);
                var obj = this.getObjectRoot();
                obj.layerType = "text";
                obj.text = text;
                obj.textWidth = Math.round(this.getTextWidth());
                obj.textHeight = Math.round(this.getTextHeight());
                obj.font = fontName;
                obj.fontSize = fontSize;
                obj.color = c.r*256*256 + c.g*256 + c.b;
                obj.bold = (bold ? 1 : '');
                obj.italic = (italic ? 1 : '');
                return obj;
            }
            this.getStyle = function() {
                return (bold ? "bold " : "") + (italic ? "italic " : "") + fontSize + "px " + fontName;
            }
            this.getBold = function() {
                return bold;
            }
            this.setBold = function(v) {
                bold = v;
                this.getContent().font = this.getStyle();
                this.updateLayer();
            }
            this.getColor = function() {
                return color;
            }
            this.setColor = function(v) {
                color = v;
                this.getContent().color = '#' + color;
            }
            this.getItalic = function() {
                return italic;
            }
            this.setItalic = function(v) {
                italic = v;
                this.getContent().font = this.getStyle();
                this.updateLayer();
            }
            this.getText = function() {
                return text;
            }
            this.setText = function(v) {
                text = v;
                this.checkSpecialCase();
                this.updateLayer();
            }
            this.getFontSize = function(v) {
                return fontSize;
            }
            this.setFontSize = function(v) {
                fontSize = parseInt(v);
                if (fontSize > MAX_FONT_SIZE)
                    fontSize = MAX_FONT_SIZE;
                else if (fontSize < MIN_FONT_SIZE)
                    fontSize = MIN_FONT_SIZE;
                else
                    j('#ui_fontsize').val(fontSize);
                this.getContent().font = this.getStyle();
                this.updateLayer();
            }
            this.getOrigFontSize = function(v) {
                return origFontSize;
            }
            this.setOrigFontSize = function(s) {
                origFontSize = fontSize;
            }
            this.setFont = function(v) {
                fontName = v;
                // Check if we do not put bold with a non bold font etc
                if(!this.getFontInfo().e) {
                    bold = false;
                    j('#ui_bold').removeAttr("checked");
                    j('#ui_bold').button("refresh");
                    italic = false;
                    j('#ui_italic').removeAttr("checked");
                    j('#ui_italic').button("refresh");
                }
                this.checkSpecialCase();
                this.getContent().font = this.getStyle();
                this.updateLayer();
            }
            this.checkSpecialCase = function() {
                // Algerian has to be uppercase
                if("Algerian" != fontName)
                    this.getContent().text = text;
                else
                    this.getContent().text = text.toUpperCase();
            }
            this.getFontInfo = function() {
                if(bold && italic)
                    return app.fonts[fontName].bi;
                else if(bold)
                    return app.fonts[fontName].b;
                else if(italic)
                    return app.fonts[fontName].i;
                else
                    return app.fonts[fontName].s;
            }
            this.getFontName = function(v) {
                return fontName;
            }
            this.updateLayer = function() {
                var i = this.getFontInfo();
                this.getContent().regX = this.getTextWidth() / 2;
                this.getContent().regY = (- this.getTextHeight() / 2) + i.c * (i.a * fontSize + i.b);
                this.adjustHandles();
                this.getContent().y = 0;
                contentP.hitArea.graphics.clear().f("#FFF").dr(0,-this.getTextHeight() + i.c * (i.a * fontSize + i.b),this.getTextWidth(),this.getTextHeight());
            }
            this.getTextHeight = function() {
                var i = this.getFontInfo();
                return contentP.getMeasuredHeight() + (i.c + 1) * (i.a * fontSize + i.b);
            }
            this.getTextWidth = function() {
                return contentP.getMeasuredWidth();
            }

            // constructor
            var text = textP;
            var fontName = fontNameP;
            var fontSize = fontSizeP;
            var origFontSize = fontSizeP;
            var color = colorP;
            var bold = boldP;
            var italic = italicP;
            var self = this;
            var contentP = new createjs.Text(text, this.getStyle(), "#" + color);
            contentP.textBaseline = "alphabetic";

            contentP.hitArea = new createjs.Shape();

            this.constructor._super.call(this, contentP, layer.type.TEXT, 1);
            this.checkSpecialCase();
            // Ensures we have an allowed font weight or decoration
            this.setFont(fontName);

            this.updateLayer();

            var size = this.getBoxRectangle();
            this.getGlobalContainer().x += x + size.w / 2;
            this.getGlobalContainer().y += y + size.h / 2;

            this.updateLayer();

            this.getGlobalContainer().addEventListener("dblclick", function() {ui.showTextInput();j('#text_input_field').val(text);});
        };
        inherit(cls, layer);

        return cls;
    })();

    /** ICON LAYER
     * Contains the image id
     */
    var iconLayer = (function () {
        var cls = function (contentP, idP, x, y, w, h) {

            this.getObject = function() {
                var obj = this.getObjectRoot();
                obj.layerType = "icon";
                obj.iconId = id;
                return obj;
            }

            // constructor
            var id=idP;
            var scale = 1;
            // Set a maximum size for the image
            if((w > MAX_ICON_ADD_SIZE) || (h > MAX_ICON_ADD_SIZE))
                scale = (w > h) ? MAX_ICON_ADD_SIZE / w : MAX_ICON_ADD_SIZE / h;

            contentP.regX = contentP.image.width / 2;
            contentP.regY = contentP.image.height / 2;

            this.constructor._super.call(this, contentP, layer.type.ICON, scale);

            this.getGlobalContainer().x += x;
            this.getGlobalContainer().y += y;

        };
        inherit(cls, layer);

        return cls;
    })();

    /**
     * Inheritance
     */
    function inherit(cls, superCls) {
        var construct = function () {};
        construct.prototype = superCls.prototype;
        cls.prototype = new construct;
        cls.prototype.constructor = cls;
        cls._super = superCls;
    }

    /**
     * Launches the app
     */
    j(document).ready(function () {
        // Rehabilitates console.log
        var i = document.createElement('iframe');
        i.style.display = 'none';
        document.body.appendChild(i);
        window.console = i.contentWindow.console;

        app.initialize();
    });

}());