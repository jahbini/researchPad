cordova.define("org.chromium.sockets.tcp.sockets.tcp", function(require, exports, module) { // Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var Event = require('org.chromium.common.events');
var platform = cordova.require('cordova/platform');
var exec = cordova.require('cordova/exec');
var callbackWithError = require('org.chromium.common.errors').callbackWithError;

exports.create = function(properties, callback) {
    if (typeof properties == 'function') {
        callback = properties;
        properties = {};
    }
    var win = callback && function(socketId) {
        var createInfo = {
            socketId: socketId
        };
        callback(createInfo);
    };
    exec(win, null, 'ChromeSocketsTcp', 'create', [properties]);
};

exports.update = function(socketId, properties, callback) {
    exec(callback, null, 'ChromeSocketsTcp', 'update', [socketId, properties]);
};

exports.setPaused = function(socketId, paused, callback) {
    exec(callback, null, 'ChromeSocketsTcp', 'setPaused', [socketId, paused]);
};

exports.setKeepAlive = function(socketId, enabled, delay, callback) {
    if (typeof delay == 'function') {
        callback = delay;
        delay = 0;
    }
    if (platform.id == 'android') {
        var win = callback && function() {
            callback(0);
        };
        var fail = callback && function(error) {
            callbackWithError(error.message, callback, error.resultCode);
        };
        exec(win, fail, 'ChromeSocketsTcp', 'setKeepAlive', [socketId, enabled, delay]);
    } else {
        console.warn('chrome.sockets.tcp.setKeepAlive not implemented yet, issue #391');
    }
};

exports.setNoDelay = function(socketId, noDelay, callback) {
    if (platform.id == 'android') {
        var win = callback && function() {
            callback(0);
        };
        var fail = callback && function(error) {
            callbackWithError(error.message, callback, error.resultCode);
        };
        exec(win, fail, 'ChromeSocketsTcp', 'setNoDelay', [socketId, noDelay]);
    } else {
        console.warn('chrome.sockets.tcp.setNoDelay not implemented yet, issue #391');
    }
};

exports.connect = function(socketId, peerAddress, peerPort, callback) {
    var win = callback && function() {
        callback(0);
    };
    var fail = callback && function(error) {
        callbackWithError(error.message, callback, error.resultCode);
    };
    exec(win, fail, 'ChromeSocketsTcp', 'connect', [socketId, peerAddress, peerPort]);
};

exports.disconnect = function(socketId, callback) {
    exec(callback, null, 'ChromeSocketsTcp', 'disconnect', [socketId]);
};

exports.secure = function(socketId, options, callback) {
    if (typeof options == 'function') {
        callback = options;
        options = {};
    }
    var win = callback && function() {
        callback(0);
    };
    var fail = callback && function(error) {
        callbackWithError(error.message, callback, error.resultCode);
    };
    exec(win, fail, 'ChromeSocketsTcp', 'secure', [socketId, options]);
};

exports.send = function(socketId, data, callback) {
    var type = Object.prototype.toString.call(data).slice(8, -1);
    if (type != 'ArrayBuffer') {
        throw new Error('chrome.sockets.tcp.send - data is not an Array Buffer! (Got: ' + type + ')');
    }
    var win = callback && function(bytesSent) {
        var sendInfo = {
            bytesSent: bytesSent,
            resultCode: 0
        };
        callback(sendInfo);
    };
    var fail = callback && function(error) {
        var sendInfo = {
            bytesSent: 0,
            resultCode: error.resultCode
        };
        callbackWithError(error.message, callback, sendInfo);
    };
    exec(win, fail, 'ChromeSocketsTcp', 'send', [socketId, data]);
};

exports.close = function(socketId, callback) {
    exec(callback, null, 'ChromeSocketsTcp', 'close', [socketId]);
};

exports.getInfo = function(socketId, callback) {
    var win = callback && function(result) {
        result.persistent = !!result.persistent;
        result.paused = !!result.paused;
        callback(result);
    };
    exec(win, null, 'ChromeSocketsTcp', 'getInfo', [socketId]);
};

exports.getSockets = function(callback) {
    var win = callback && function(results) {
        for (var result in results) {
            result.persistent = !!result.persistent;
            result.paused = !!result.paused;
        }
        callback(results);
    };
    exec(win, null, 'ChromeSocketsTcp', 'getSockets', []);
};

exports.onReceive = new Event('onReceive');
exports.onReceiveError = new Event('onReceiveError');

function registerReceiveEvents() {
    var win = function() {
        var info = {
            socketId: arguments[0],
            data: arguments[1]
        };
        exports.onReceive.fire(info);
        exec(null, null, 'ChromeSocketsTcp', 'readyToRead', []);
    };

    // TODO: speical callback for android, DELETE when multipart result for
    // android is avaliable
    if (platform.id == 'android') {
        win = (function() {
            var data;
            var call = 0;
            return function(arg) {
                if (call === 0) {
                    data = arg;
                    call++;
                } else  {
                    var info = {
                        socketId: arg.socketId,
                        data: data
                    };

                    call = 0;

                    exports.onReceive.fire(info);
                    exec(null, null, 'ChromeSocketsTcp', 'readyToRead', []);
                }
            };
        })();
    }

    var fail = function(info) {
        callbackWithError(info.message, exports.onReceiveError.fire, info);
    };

    exec(win, fail, 'ChromeSocketsTcp', 'registerReceiveEvents', []);
}

require('org.chromium.common.helpers').runAtStartUp(registerReceiveEvents);

});
