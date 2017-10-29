/**********************************************************************************
 * (c) 2016-2017, Master Technology
 * Licensed under the MIT license or contact me for a Support or Commercial License
 *
 * I do contract work in most languages, so let me solve your problems!
 *
 * Any questions please feel free to email me or put a issue up on the github repo
 * Version 2.0.0                                      Nathan@master-technology.com
 *********************************************************************************/
"use strict";

/* jshint camelcase: false */
/* global UIDevice, UIDeviceOrientation, UIView, getElementsByTagName, android */

var application = require('application');
var view = require('ui/core/view');
var enums = require('ui/enums');
var frame = require('ui/frame');
var Page = require('ui/page').Page;
var utils = require('utils/utils');

// Load the helper plugins
require('nativescript-globalevents');
require('nativescript-dom');

var allowRotation = true, forceRotation = false;
var orientation = { };

module.exports = orientation;

/**
 * Helper function hooked to the Application to get the current orientation
 */
if (global.android) {
	orientation.getOrientation = function () {
        var context = getContext();

        // These both lie on Tablets, The orientation is opposite, so it is safer to use .orientation value
        // context.getSystemService("window").getDefaultDisplay().getOrientation();
        // context.getSystemService("window").getDefaultDisplay().getRotation();

        var orientation = getContext().getResources().getConfiguration().orientation;

        switch (orientation) {
            case 2: /* LANDSCAPE */
                return enums.DeviceOrientation.landscape;
            case 1: /* PORTRAIT */
                return enums.DeviceOrientation.portrait;
            default:
                break;
        }


        // If for some reason the orientation code above doesn't figure it out; we use sizes
        const metrics = new android.util.DisplayMetrics();
        context.getSystemService(android.content.Context.WINDOW_SERVICE).getDefaultDisplay().getRealMetrics(metrics);
        if (metrics.widthPixels > metrics.heightPixels) {
            return enums.DeviceOrientation.landscape;
        }
        return enums.DeviceOrientation.portrait;

    };

	orientation.enableRotation = function() {
		if (!application.android || !application.android.foregroundActivity) {
			setTimeout(orientation.enableRotation, 100);
			return;
		}

		var activity = application.android.foregroundActivity;
		activity.setRequestedOrientation(13);  // SCREEN_ORIENTATION_FULL_USER = 13
	};

	orientation.disableRotation = function() {
		if (!application.android || !application.android.foregroundActivity) {
			setTimeout(orientation.disableRotation, 100);
			return;
		}

		var activity = application.android.foregroundActivity;
        activity.setRequestedOrientation(14); // SCREEN_ORIENTATION_LOCKED = 14
	};

	orientation.setOrientation = function(value, animation) {
		if (!application.android || !application.android.foregroundActivity) {
			setTimeout(function() { orientation.setOrientation(value, animation); }, 100);
			return;
		}

		var activity = application.android.foregroundActivity;

		var val = value.toLowerCase();
		var orientation;
		switch (val) {
			case 'landscape':
                orientation = 6; // SCREEN_ORIENTATION_SENSOR_LANDSCAPE = 6
                break;

			case 'landscaperight':
				orientation = 0; // SCREEN_ORIENTATION_LANDSCAPE = 0
				break;

			case 'landscapeleft':
				orientation = 8; // SCREEN_ORIENTATION_REVERSE_LANDSCAPE = 9
				break;

			case 'portrait':
			default:
				orientation = 1; // SCREEN_ORIENTATION_PORTRAIT = 1
				break;
		}
		activity.setRequestedOrientation(orientation);

		// Animation: https://developer.android.com/reference/android/view/WindowManager.LayoutParams.html#ROTATION_ANIMATION_JUMPCUT
		// and https://developer.android.com/reference/android/view/WindowManager.LayoutParams.html#rotationAnimation

	};

} else if (global.NSObject && global.UIDevice) {

	setupiOSController();
	orientation.getOrientation = function () {
		var device = utils.ios.getter(UIDevice, UIDevice.currentDevice);

		switch (device.orientation) {
			case UIDeviceOrientation.UIDeviceOrientationLandscapeRight:
			case UIDeviceOrientation.UIDeviceOrientationLandscapeLeft:
				return enums.DeviceOrientation.landscape;
			case UIDeviceOrientation.UIDeviceOrientationPortraitUpsideDown:
			case UIDeviceOrientation.UIDeviceOrientationPortrait:
				return enums.DeviceOrientation.portrait;
			default:
				// Since we have a up/Down orientation, we need to see what the statusbar is set to to get the actual current device orientation
				var appOrientation = utils.ios.getter(UIApplication, UIApplication.sharedApplication).statusBarOrientation;
				if (appOrientation === 1 || appOrientation === 2) { return enums.DeviceOrientation.portrait; }
				else { return enums.DeviceOrientation.landscape; }
		}
	};

	orientation.setOrientation = function(value, animation) {
		var newOrientation, val = value.toLowerCase();
		if (val === 'landscape' || val === 'landscaperight') {
			newOrientation = NSNumber.numberWithInt(UIInterfaceOrientationLandscapeRight);
		} else if (val === 'landscapeleft') {
			newOrientation = NSNumber.numberWithInt(UIInterfaceOrientationLandscapeLeft);
		} else {
			newOrientation = NSNumber.numberWithInt(UIInterfaceOrientationPortrait);
		}
		var device = utils.ios.getter(UIDevice, UIDevice.currentDevice);
		if (animation === false) {
			UIView.setAnimationsEnabled(false);
		}
		allowRotation = false; // disable rotations...

		forceRotation = true;
		var currentOrientation = device.orientation;
		// We have to swap to a different orientation FIRST, if the current orientation matches
		if (newOrientation === currentOrientation) {
			var tempOrientation = newOrientation-1;
			if (tempOrientation < 1) { tempOrientation += 2; }
			device.setValueForKey(tempOrientation, "orientation");
		}
		device.setValueForKey(newOrientation, "orientation");
		forceRotation = false;


		if (animation === false) {
			UIView.setAnimationsEnabled(true);
		}
	};

	orientation.enableRotation = function() { allowRotation = true; };

	orientation.disableRotation = function() { allowRotation = false; };

	var resetLandscapedLock = false;
	application.on('suspend', function() {
		if (allowRotation === false && orientation.getOrientation() === 'landscape') {
			allowRotation = true;
			resetLandscapedLock = true;
		}
	});

	application.on('resume', function() {
		if (resetLandscapedLock) {
			resetLandscapedLock = false;
			orientation.setOrientation('landscape',false);
		}
	});


}

// Depreciated; but supported for backwards compatibility
application.getOrientation = orientation.getOrientation;


/**
 * Searchs for a prototype in the prototype chain
 * @param source - Source element
 * @param name - the name of the element
 * @returns {*}
 */
function findRootPrototype(source, name) {
	var proto = source;
	do {
		proto = Object.getPrototypeOf(proto);
	} while (proto !== null && !proto.hasOwnProperty(name) );
	return proto;
}

/**
 * Sets up the iOS Controller configuration
 */
function setupiOSController() {
	var curFrame = frame.topmost();
	if (!curFrame) {
		setTimeout(setupiOSController, 100);
		return;
	}

	try {

		var app = curFrame.ios.controller;
		var proto = findRootPrototype(app, "shouldAutorotate");
		if (proto ===  null) {
			console.log("Unable to find rotations system, disabling orientation system.");
			return;
		}
		Object.defineProperty(proto, "shouldAutorotate", {
			get: function() {
				//console.log("Should rotate", forceRotation, allowRotation);
				return forceRotation || allowRotation;
			}, enumerable: true, configurable: true
		});
	} catch (err) {
		console.log("Unable to setup Rotation",err);
	}
}

/**
 * Helper function to look for children that have refresh (i.e. like ListView's) and call their refresh since the
 * CSS changes will probably impact them
 * @param child
 * @returns {boolean}
 */
function resetChildrenRefreshes(child) {
	if (typeof child.refresh === 'function') {
		child.refresh();
	}
	return true;
}

/**
 * Function that does the majority of the work
 * @param page
 * @param args
 */
var applyOrientationToPage = function(page, args){
	var currentOrientation = orientation.getOrientation();

	// If somehow we didn't get the orientation we don't do anything!
	if (!currentOrientation) return;

	// Check what the current rotation vs the existing page rotation is
	var isLandscape = currentOrientation === enums.DeviceOrientation.landscape;
	if (!args || !args.force) {
		var containsLandScape = page.classList.contains("landscape");

		// No need to run the swap if it already has the correct orientation
		if (isLandscape === containsLandScape) { return; }
	}

	// Change Orientation
	page.classList.toggle('landscape', isLandscape);

	// Unfortunately there is a bug in the NS CSS parser, so we have to work around it
	var i;
	if (page.classList.contains('android')) {
		for (i=0;i<page.classList.length;i++) {
			if (page.classList[i].indexOf('android') === 0) {
				if (page.classList[i].indexOf('.') >= 0) { continue; }
				page.classList.toggle(page.classList[i]+".landscape", isLandscape);
			}
		}
	} else if (page.classList.contains('ios')) {
		for (i=0;i<page.classList.length;i++) {
			if (page.classList[i].indexOf('ios') === 0) {
				if (page.classList[i].indexOf('.') >= 0) { continue; }
				page.classList.toggle(page.classList[i]+".landscape", isLandscape);
			}
		}
	} else if (page.classList.contains('windows')) {
		page.classList.toggle('windows.landscape', isLandscape);
	}
	// --- End NS Bug Patch ---

    // _refreshCSS will verify against the Scope to make sure all the correct styles are
    // applied. If they are already applied, it will short circuit and not
    // do anything more.
	page._refreshCss();

	if (args != null) {
		view.eachDescendant(page, resetChildrenRefreshes);
	}
	if (page.exports && typeof page.exports.orientation === "function") {
		page.exports.orientation({landscape: isLandscape, object: page});
	}
};

/**
 * This handles a Orientation change event
 * @param args
 */
var handleOrientationChange = function(args) {

	// If the topmost frame doesn't exist we can't do anything...
	if (!frame.topmost()) { return; }
	var currentPage = frame.topmost().currentPage;

	if (currentPage) {
		applyOrientationToPage(currentPage, args);
	}
};

var handleNavigatingTo = function(args){
	var targetPage = args.object;

	if(targetPage){
		applyOrientationToPage(targetPage, {force: true});
	}

};

function getContext() {
	var ctx = java.lang.Class.forName("android.app.AppGlobals").getMethod("getInitialApplication", null).invoke(null, null);
	if (ctx) { return ctx; }

	return java.lang.Class.forName("android.app.ActivityThread").getMethod("currentApplication", null).invoke(null, null);
}


// Setup Events
Page.on(Page.navigatingToEvent, handleNavigatingTo);
application.on(application.orientationChangedEvent, handleOrientationChange);

