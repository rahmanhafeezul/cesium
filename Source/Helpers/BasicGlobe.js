/*global define,console*/
define([
    '../Core/DeveloperError',
    '../Core/BoundingRectangle',
    '../Core/Ellipsoid',
    '../Core/computeSunPosition',
    '../Core/EventHandler',
    '../Core/FeatureDetection',
    '../Core/MouseEventType',
    '../Core/Cartesian2',
    '../Core/Cartesian3',
    '../Core/JulianDate',
    '../Core/DefaultProxy',
    '../Core/requestAnimationFrame',
    '../Scene/Scene',
    '../Scene/CentralBody',
    '../Scene/BingMapsTileProvider',
    '../Scene/BingMapsStyle',
    '../Scene/SingleTileProvider',
    '../Scene/PerformanceDisplay'
], function(
    DeveloperError,
    BoundingRectangle,
    Ellipsoid,
    computeSunPosition,
    EventHandler,
    FeatureDetection,
    MouseEventType,
    Cartesian2,
    Cartesian3,
    JulianDate,
    DefaultProxy,
    requestAnimationFrame,
    Scene,
    CentralBody,
    BingMapsTileProvider,
    BingMapsStyle,
    SingleTileProvider,
    PerformanceDisplay
) {
    "use strict";

    /**
     * This constructs a simple Cesium scene with the Earth.
     * @alias BasicGlobe
     * @constructor
     */
    var BasicGlobe = function(canvas, options) {
        this.canvas = canvas;
        this.imageBase = 'Images/';
        this.useStreamingImagery = true;
        this.mapStyle = BingMapsStyle.AERIAL;
        this.resizeCanvasOnWindowResize = true;
        this._sunPosition = new Cartesian3();

        // Copy all options to this.
        if (typeof options === 'object') {
            for (var opt in options) {
                if (options.hasOwnProperty(opt)) {
                    this[opt] = options[opt];
                }
            }
        }

        // **** TODO: ADD CESIUM LOGO from the CesiumWidget.html template. ****
        this._setupCesium();
    };

    BasicGlobe.prototype.onSetupError = function(widget, error) {
        console.error(error);
    };

    BasicGlobe.prototype.resize = function() {
        var width = this.canvas.clientWidth, height = this.canvas.clientHeight;

        if (typeof this.scene === 'undefined' || (this.canvas.width === width && this.canvas.height === height)) {
            return;
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.scene.getCamera().frustum.aspectRatio = width / height;
    };

    BasicGlobe.prototype._handleLeftClick = function(e) {
        if (typeof this.onObjectSelected !== 'undefined') {
            // If the user left-clicks, we re-send the selection event, regardless if it's a duplicate,
            // because the client may want to react to re-selection in some way.
            this.selectedObject = this.scene.pick(e.position);
            this.onObjectSelected(this.selectedObject);
        }
    };

    BasicGlobe.prototype._handleRightClick = function(e) {
        if (typeof this.onObjectRightClickSelected !== 'undefined') {
            // If the user right-clicks, we re-send the selection event, regardless if it's a duplicate,
            // because the client may want to react to re-selection in some way.
            this.selectedObject = this.scene.pick(e.position);
            this.onObjectRightClickSelected(this.selectedObject);
        }
    };

    BasicGlobe.prototype._handleMouseMove = function(movement) {
        if (typeof this.onObjectMousedOver !== 'undefined') {
            // Don't fire multiple times for the same object as the mouse travels around the screen.
            var mousedOverObject = this.scene.pick(movement.endPosition);
            if (this.mousedOverObject !== mousedOverObject) {
                this.mousedOverObject = mousedOverObject;
                this.onObjectMousedOver(mousedOverObject);
            }
        }
        if (typeof this.leftDown !== 'undefined' && this.leftDown && typeof this.onLeftDrag !== 'undefined') {
            this.onLeftDrag(movement);
        } else if (typeof this.rightDown !== 'undefined' && this.rightDown && typeof this.onZoom !== 'undefined') {
            this.onZoom(movement);
        }
    };

    BasicGlobe.prototype._handleRightDown = function(e) {
        this.rightDown = true;
        if (typeof this.onRightMouseDown !== 'undefined') {
            this.onRightMouseDown(e);
        }
    };

    BasicGlobe.prototype._handleRightUp = function(e) {
        this.rightDown = false;
        if (typeof this.onRightMouseUp !== 'undefined') {
            this.onRightMouseUp(e);
        }
    };

    BasicGlobe.prototype._handleLeftDown = function(e) {
        this.leftDown = true;
        if (typeof this.onLeftMouseDown !== 'undefined') {
            this.onLeftMouseDown(e);
        }
    };

    BasicGlobe.prototype._handleLeftUp = function(e) {
        this.leftDown = false;
        if (typeof this.onLeftMouseUp !== 'undefined') {
            this.onLeftMouseUp(e);
        }
    };

    BasicGlobe.prototype._handleWheel = function(e) {
        if (typeof this.onZoom !== 'undefined') {
            this.onZoom(e);
        }
    };

    BasicGlobe.prototype._setupCesium = function() {
        this.ellipsoid = Ellipsoid.WGS84;

        var canvas = this.canvas, ellipsoid = this.ellipsoid, scene, widget = this;

        try {
            scene = this.scene = new Scene(canvas);
        } catch (ex) {
            if (typeof this.onSetupError !== 'undefined') {
                this.onSetupError(this, ex);
            }
            return;
        }

        this.resize();

        canvas.oncontextmenu = function() {
            return false;
        };

        var maxTextureSize = scene.getContext().getMaximumTextureSize();
        if (maxTextureSize < 4095) {
            // Mobile, or low-end card
            this.dayImageUrl = this.dayImageUrl || this.imageBase + 'NE2_50M_SR_W_2048.jpg';
            this.nightImageUrl = this.nightImageUrl || this.imageBase + 'land_ocean_ice_lights_512.jpg';
        } else {
            // Desktop
            this.dayImageUrl = this.dayImageUrl || this.imageBase + 'NE2_50M_SR_W_4096.jpg';
            this.nightImageUrl = this.nightImageUrl || this.imageBase + 'land_ocean_ice_lights_2048.jpg';
            this.specularMapUrl = this.specularMapUrl || this.imageBase + 'earthspec1k.jpg';
            this.cloudsMapUrl = this.cloudsMapUrl || this.imageBase + 'earthcloudmaptrans.jpg';
            this.bumpMapUrl = this.bumpMapUrl || this.imageBase + 'earthbump1k.jpg';
        }

        var centralBody = this.centralBody = new CentralBody(ellipsoid);
        centralBody.showSkyAtmosphere = true;
        centralBody.showGroundAtmosphere = true;
        centralBody.logoOffset = new Cartesian2(125, 0);

        this._configureCentralBodyImagery();

        scene.getPrimitives().setCentralBody(centralBody);

        var camera = scene.getCamera();
        camera.position = camera.position.multiplyByScalar(1.5);

        this.centralBodyCameraController = camera.getControllers().addCentralBody();

        var handler = new EventHandler(canvas);
        handler.setMouseAction(function(e) { widget._handleLeftClick(e); }, MouseEventType.LEFT_CLICK);
        handler.setMouseAction(function(e) { widget._handleRightClick(e); }, MouseEventType.RIGHT_CLICK);
        handler.setMouseAction(function(e) { widget._handleMouseMove(e); }, MouseEventType.MOVE);
        handler.setMouseAction(function(e) { widget._handleLeftDown(e); }, MouseEventType.LEFT_DOWN);
        handler.setMouseAction(function(e) { widget._handleLeftUp(e); }, MouseEventType.LEFT_UP);
        handler.setMouseAction(function(e) { widget._handleWheel(e); }, MouseEventType.WHEEL);
        handler.setMouseAction(function(e) { widget._handleRightDown(e); }, MouseEventType.RIGHT_DOWN);
        handler.setMouseAction(function(e) { widget._handleRightUp(e); }, MouseEventType.RIGHT_UP);

        if (widget.resizeCanvasOnWindowResize) {
            window.addEventListener('resize', function() {
                widget.resize();
            }, false);
        }

        if (typeof this.postSetup !== 'undefined') {
            this.postSetup(this);
        }

        this.defaultCamera = camera.clone();
    },

    BasicGlobe.prototype.viewHome = function() {
        var camera = this.scene.getCamera();
        camera.position = this.defaultCamera.position;
        camera.direction = this.defaultCamera.direction;
        camera.up = this.defaultCamera.up;
        camera.transform = this.defaultCamera.transform;
        camera.frustum = this.defaultCamera.frustum.clone();

        var controllers = camera.getControllers();
        controllers.removeAll();
        this.centralBodyCameraController = controllers.addCentralBody();
    };

    BasicGlobe.prototype.areCloudsAvailable = function() {
        return typeof this.centralBody.cloudsMapSource !== 'undefined';
    };

    BasicGlobe.prototype.enableClouds = function(useClouds) {
        if (this.areCloudsAvailable()) {
            this.centralBody.showClouds = useClouds;
            this.centralBody.showCloudShadows = useClouds;
        }
    };

    BasicGlobe.prototype.enableStatistics = function(showStatistics) {
        if (typeof this._performanceDisplay === 'undefined' && showStatistics) {
            this._performanceDisplay = new PerformanceDisplay();
            this.scene.getPrimitives().add(this._performanceDisplay);
        } else if (typeof this._performanceDisplay !== 'undefined' && !showStatistics) {
            this.scene.getPrimitives().remove(this._performanceDisplay);
            this._performanceDisplay = undefined;
        }
    };

    BasicGlobe.prototype.showSkyAtmosphere = function(show) {
        this.centralBody.showSkyAtmosphere = show;
    };

    BasicGlobe.prototype.showGroundAtmosphere = function(show) {
        this.centralBody.showGroundAtmosphere = show;
    };

    BasicGlobe.prototype.enableStreamingImagery = function(value) {
        this.useStreamingImagery = value;
        this._configureCentralBodyImagery();
    };

    BasicGlobe.prototype.setStreamingImageryMapStyle = function(value) {
        this.useStreamingImagery = true;

        if (this.mapStyle !== value) {
            this.mapStyle = value;
            this._configureCentralBodyImagery();
        }
    };

    BasicGlobe.prototype.setLogoOffset = function(logoOffsetX, logoOffsetY) {
        var logoOffset = this.centralBody.logoOffset;
        if ((logoOffsetX !== logoOffset.x) || (logoOffsetY !== logoOffset.y)) {
            this.centralBody.logoOffset = new Cartesian2(logoOffsetX, logoOffsetY);
        }
    };

    BasicGlobe.prototype.update = function(currentTime) {
        this.scene.setSunPosition(computeSunPosition(currentTime, this._sunPosition));
    };

    BasicGlobe.prototype.render = function() {
        this.scene.render();
    };

    BasicGlobe.prototype._configureCentralBodyImagery = function() {
        var centralBody = this.centralBody;

        if (this.useStreamingImagery) {
            centralBody.dayTileProvider = new BingMapsTileProvider({
                server : 'dev.virtualearth.net',
                mapStyle : this.mapStyle,
                // Some versions of Safari support WebGL, but don't correctly implement
                // cross-origin image loading, so we need to load Bing imagery using a proxy.
                proxy : FeatureDetection.supportsCrossOriginImagery() ? undefined : new DefaultProxy('/proxy/')
            });
        } else {
            centralBody.dayTileProvider = new SingleTileProvider(this.dayImageUrl);
        }

        centralBody.nightImageSource = this.nightImageUrl;
        centralBody.specularMapSource = this.specularMapUrl;
        centralBody.cloudsMapSource = this.cloudsMapUrl;
        centralBody.bumpMapSource = this.bumpMapUrl;
    };

    BasicGlobe.prototype.startRenderLoop = function() {
        var widget = this;

        // Note that clients are permitted to use their own custom render loop.
        // At a minimum it should include lines similar to the following:

        function updateAndRender() {
            var currentTime = new JulianDate();
            widget.update(currentTime);
            widget.render();
            requestAnimationFrame(updateAndRender);
        }
        updateAndRender();
    };

    return BasicGlobe;
});
