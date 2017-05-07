(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var $, Backbone, Case, TIlog, TIlogger, TiHandler, _, buglog, deviceIdToModel, deviceModel, deviceNameToModel, glib, lastDisplay, pView, reading;

Backbone = require('backbone');

_ = require('underscore');

require('./lib/console');

$ = require('jquery');

glib = require('./lib/glib.coffee').glib;

Case = require('Case');

deviceModel = require('./models/device-model.coffee').deviceModel;

buglog = require('./lib/buglog.coffee');

TIlogger = (TIlog = new buglog("TIhandler")).log;

lastDisplay = 0;

deviceNameToModel = function(name) {
  var pd;
  pd = Pylon.get('devices');
  return pd.findWhere({
    name: name
  });
};

deviceIdToModel = function(id) {
  var pd;
  pd = Pylon.get('devices');
  return pd.get(id);
};

reading = Backbone.Model.extend({
  defaults: {
    sensor: 'gyro'
  },
  initialize: function() {
    var d;
    d = new Date;
    return this.set('time', d.getTime());
  }
});

pView = Backbone.View.extend({
  el: '#scanDevices',
  model: Pylon.get('devices'),
  initialize: function() {
    $('#StatusData').html('Ready to connect');
    $('#FirmwareData').html('?');
    $('#scanActiveReport').html(Pylon.get('pageGen').scanBody());
    Pylon.set('scanActive', false);
    return this.listenTo(this.model, 'add', function(device) {
      var element, ordinal;
      ordinal = this.model.length;
      device.set("rowName", "sensor-" + ordinal);
      element = (Pylon.get('pageGen')).sensorView(device);
      return this;
    });
  },
  events: {
    "click": "changer"
  },
  changer: function() {
    TIlogger("Start Scan button activated");
    Pylon.set('scanActive', true);
    this.render();
    setTimeout((function(_this) {
      return function() {
        Pylon.set('scanActive', false);
        _this.render();
      };
    })(this), 30000);
  },
  render: function() {
    if (Pylon.get('scanActive')) {
      this.$el.prop("disabled", true).removeClass('button-primary').addClass('button-success').text('Scanning');
    } else {
      this.$el.prop("disabled", false).removeClass('button-success').addClass('button-primary').text('Scan Devices');
    }
  }
});

Pylon.set('tagViewer', new pView);

TiHandler = (function() {
  var ble_found, queryHostDevice;

  function TiHandler() {}

  queryHostDevice = function(d) {
    return d.fetch({
      success: function(model, response, options) {
        var name;
        name = (d.get('assignedName')) || 'no Name';
        return TIlogger("DEVICE FETCH from Host: " + name);
      },
      error: function(model, response, options) {
        TIlogger(Pylon.get('hostUrl') + '/sensorTag');
        return TIlogger("sensorTag fetch error: " + response.statusText);
      }
    });
  };

  ble_found = function(device) {
    var d, pd;
    if (!device.name) {
      return;
    }
    pd = Pylon.get('devices');
    if (d = pd.findWhere({
      name: name
    })) {
      d.set(device);
      return;
    }
    TIlogger("got new device");
    d = new deviceModel(device);
    pd.push(d);
  };

  Pylon.on("change:scanActive", function() {
    if (Pylon.get('scanActive')) {
      ble.scan(['AA80'], 20, ble_found, function(e) {
        return alert("scanner error");
      });
    }
  });

  Pylon.on("enableDevice", function(cid) {
    return Pylon.get('TiHandler').attachDevice(cid);
  });

  Pylon.on("disableDevice", function(cid) {
    return Pylon.get('TiHandler').detachDevice(cid);
  });

  TiHandler.prototype.initialize = function(sessionInfo) {
    this.sessionInfo = sessionInfo;
  };

  TiHandler.prototype.detachDevice = function(cid) {
    var d, name, role;
    d = Pylon.get('devices').get(cid);
    if (!d) {
      return;
    }
    name = d.get('name');
    TIlogger("detach " + cid + " -- " + name);
    role = 'Error';
    if (0 < name.search(/\(([Ll]).*\)/)) {
      role = 'Left';
    }
    if (0 < name.search(/\(([Rr]).*\)/)) {
      role = 'Right';
    }
    if (role === 'Error') {
      TIlogger("Bad name for sensor: " + name);
    }
    d.set('role', '---');
    Pylon.unset(role);
    d.set('buttonText', 'connect');
    d.set('connected', false);
    Pylon.trigger('change respondingDevices');
    TIlogger("Device removed from state, attempt dicconnect");
    ble.disconnect(d.get("id"), (function(_this) {
      return function() {
        return TIlogger("disconnection of " + name);
      };
    })(this), function(e) {
      return TIlogger("Failure to connect", e);
    });
  };

  TiHandler.prototype.attachDevice = function(cid) {
    var d, gs, name, role;
    gs = Pylon.get('globalState');
    if (gs.get('recording')) {
      return;
    }
    TIlogger("attach " + cid);
    d = Pylon.get('devices').get(cid);
    name = d.get('name');
    role = 'Error';
    if (0 < name.search(/\(([Ll]).*\)/)) {
      role = 'Left';
    }
    if (0 < name.search(/\(([Rr]).*\)/)) {
      role = 'Right';
    }
    if (role === 'Error') {
      TIlogger("Bad name for sensor: " + name);
    }
    if (d.get('connected')) {
      return;
    }
    d.set('buttonText', 'connecting');
    d.set('role', role);
    d.set('connected', false);
    Pylon.set(role, d);
    Pylon.trigger('change respondingDevices');
    TIlogger("Role of Device set, attempt connect");
    ble.connect(d.get("id"), d.subscribe(), function(e) {
      return TIlogger("Failure to connect", e);
    });
  };

  return TiHandler;

})();


/*
        if statusList.SENSORTAG_ONLINE == s
          sessionInfo = Pylon.get 'sessionInfo'
          sessionInfo.set role+'sensorUUID', d.id
           * add FWLevel to session data per Github issue stagapp 99
          sessionInfo.set "FWLevel#{if role=="Left" then 'L' else 'R'}", d.fwRev
          #why is there no comment on this next line?  Is that what you want to do??
          Pylon.trigger 'connected' unless d.get 'connected'
          d.set {
            connected: true
            buttonText: 'on-line'
            buttonClass: 'button-success'
            deviceStatus: 'Listening'
          }
          newID = sensorInstance.softwareVersion
          $("#LeftSerialNumber").html sensorInstance.serialNumber
          $("#LeftVersion").html sensorInstance.softwareVersion
          d.set 'readings', new EventModel role, d
            
          sessionInfo.set role+'sensorUUID', newID
          d.set 'firmwareVersion', sensorInstance.serialNumber
          if role == "Left"
            sessionInfo.set 'SerialNoL', sensorInstance.serialNumber
            sessionInfo.set 'FWLevelL', sensorInstance.getFirmwareString()
          else
            sessionInfo.set 'SerialNoR', sensorInstance.serialNumber
            sessionInfo.set 'FWLevelR', sensorInstance.getFirmwareString()

          sensorRate = Pylon.get sensorRate
             * default sensorRate is 10ms and may
             * be changed from the log with Pylon.rate(ms)
          askForData sensorInstance, sensorRate
        return
       * error  handler is set -- d.get('sensorInstance').errorCallback (e)-> {something}
      sensorInstance.errorCallback (s)->
        TIlogger "sensor ERROR report: " +s, ' '+d.id
         * evothings status reporting errors often report null, for no reason?
        return if !s
        err=s.split(' ')
        if evothings.easyble.error.CHARACTERISTIC_NOT_FOUND == err[0]
          return
        if evothings.easyble.error.DISCONNECTED == s || s == "No Response"
          d.set 'buttonClass', 'button-warning'
          d.set 'buttonText', 'reconnect'
          d.set 'deviceStatus', 'Disconnected'
          d.unset 'role'
        Pylon.trigger('change respondingDevices')
        return

      TIlogger "Setting Time-out now",Date.now()
      setTimeout ()->
          return if 'Receiving' == d.get 'deviceStatus'
          TIlogger "Device connection 10 second time-out "
          sensorInstance.callErrorCallback "No Response"
          sensorInstance.disconnectDevice()
        ,10000

       * and plug our data handlers into the evothings scheme
      sensorInstance.handlers= @createVisualChain d
      sensorInstance.connectToDevice d.get('rawDevice')
      
      if d.get 'type' == evothings.tisensortag.CC2650_BLUETOOTH_SMART
        sensorInstance.handlers.accel.finalScale = 2
        sensorInstance.handlers.mag.finalScale = 0.15
      askForData sensorInstance, 10
 */

if (typeof window !== "undefined" && window !== null) {
  window.exports = TiHandler;
}

if ((typeof module !== "undefined" && module !== null ? module.exports : void 0) != null) {
  module.exports = TiHandler;
}



},{"./lib/buglog.coffee":3,"./lib/console":4,"./lib/glib.coffee":5,"./models/device-model.coffee":11,"Case":25,"backbone":22,"jquery":29,"underscore":33}],2:[function(require,module,exports){
var $, BV, Backbone, EventModel, Pylon, PylonTemplate, _, aButtonModel, activateNewButtons, admin, adminData, adminEvent, applicationVersion, applog, applogger, buglog, clientCollection, clientModel, clients, clinicCollection, clinicModel, clinicShowedErrors, clinicTimer, clinicianCollection, clinicianModel, clinicians, clinics, enableRecordButtonOK, enterAdmin, enterCalibrate, enterClear, enterLogout, enterRecording, enterUpload, eventModelLoader, exitAdmin, exitCalibrate, exitRecording, externalEvent, getClinics, getProtocol, initAll, loadScript, pageGen, pages, protocol, protocolCollection, protocolTimer, protocols, protocolsShowedErrors, rawSession, ref, sessionInfo, setSensor, startBlueTooth, systemCommunicator, theProtocol, uploader,
  slice = [].slice;

window.$ = $ = require('jquery');

_ = require('underscore');

Backbone = require('backbone');

localStorage.setItem('debug', "app,TIhandler,sensor,logon");

buglog = require('./lib/buglog.coffee');

applogger = (applog = new buglog("app")).log;

window.console = new buglog("logon");

PylonTemplate = Backbone.Model.extend({
  scan: false,
  theSession: function() {
    return this.attributes.sessionInfo;
  },
  theProtocol: function() {
    var protocols;
    protocols = this.attributes.protocols;
    if (!protocols || !sessionInfo.attributes.testID) {
      return {};
    }
    return protocols.findWhere({
      name: sessionInfo.attributes.testID
    });
  }
});

window.Pylon = Pylon = new PylonTemplate;

Pylon.on('all', function() {
  var event, mim, rest;
  event = arguments[0], rest = 2 <= arguments.length ? slice.call(arguments, 1) : [];
  mim = event.match(/((.*):.*):/);
  if (!mim || mim[2] !== 'systemEvent') {
    return null;
  }
  applogger("event " + event);
  Pylon.trigger(mim[1], event, rest);
  Pylon.trigger(mim[2], event, rest);
  return null;
});

Pylon.set('spearCount', 1);

Pylon.set('hostUrl', hostUrl);

Pylon.set('BV', BV = require('./views/button-view.coffee'));

pages = require('./views/pages.coffee');

Pylon.set('adminView', require('./views/adminView.coffee').adminView);

loadScript = require("./lib/loadScript.coffee").loadScript;

loadScript(Pylon.get('hostUrl') + "logon.js", function(status) {
  return applogger("logon.js returns status of " + status);
});

ref = require("./lib/upload.coffee"), uploader = ref.uploader, eventModelLoader = ref.eventModelLoader;


/*
Section: Data Structures
 Routines to create and handle data structures and interfaces to them
 */

systemCommunicator = Backbone.Model.extend({
  defaults: {
    calibrating: false,
    recording: false,
    connected: [],
    calibrate: false,
    loggedIn: false
  }
});

Pylon.set('globalState', new systemCommunicator);

clinicModel = Backbone.Model.extend();

clinicCollection = Backbone.Collection.extend({
  model: clinicModel,
  url: Pylon.get('hostUrl') + 'clinics'
});

clinics = new clinicCollection;

Pylon.set('clinics', clinics);

clinicianModel = Backbone.Model.extend({
  defaults: {
    name: 'Text',
    password: 'Password'
  }
});

clinicianCollection = Backbone.Collection.extend({
  model: clinicianModel
});

clinicians = new clinicianCollection;

Pylon.set('clinicians', clinicians);

clientModel = Backbone.Model.extend({
  defaults: {
    name: 'Text',
    patientOnly: 'Boolean'
  }
});

clientCollection = Backbone.Collection.extend({
  model: clientModel
});

clients = new clientCollection;

Pylon.set('clients', clients);

protocol = Backbone.Model.extend({
  defaults: {
    name: "Other",
    comments: "Other",
    mileStones: "initiation,completion"
  }
});

protocolCollection = Backbone.Collection.extend({
  model: protocol,
  url: Pylon.get('hostUrl') + 'protocols'
});

protocols = new protocolCollection;

Pylon.set('protocols', protocols);

adminData = Backbone.Model.extend();

admin = new adminData({
  clinics: clinics,
  clinicians: clinicians,
  clients: clients,
  protocol: protocols
});

rawSession = Backbone.Model.extend({
  idAttribute: '_id',
  url: Pylon.get('hostUrl') + 'session'
});

applicationVersion = require('./version.coffee');

sessionInfo = new rawSession({
  user: '',
  clinic: '',
  patient: '',
  testID: '',
  leftSensorUUID: '',
  rightSensorUUID: '',
  platformIosVersion: '',
  applicationVersion: applicationVersion
});

applogger("Version:" + (sessionInfo.get('applicationVersion')));

pageGen = new pages.Pages(sessionInfo);

Pylon.set('pageGen', pageGen);

Pylon.set('sessionInfo', sessionInfo);

EventModel = require("./models/event-model.coffee").EventModel;

adminEvent = new EventModel("Action");

externalEvent = new EventModel("External");

Pylon.on('systemEvent', function(what) {
  if (what == null) {
    what = "unknown";
  }
  if (sessionInfo.id) {
    return adminEvent.addSample(what);
  }
});

Pylon.on('externalEvent', function(what) {
  var booBoo, error;
  if (what == null) {
    what = "unknown";
  }
  applogger('externalEvent', what);
  if (sessionInfo.id) {
    try {
      externalEvent.addSample(what);
    } catch (error) {
      booBoo = error;
      applogger(booBoo);
    }
  }
  return true;
});

aButtonModel = Backbone.Model.extend({
  defaults: {
    active: false,
    funct: function() {},
    text: '--',
    selector: 'button'
  }
});

activateNewButtons = function() {
  var ActionButton, AdminButton, CalibrateButton, ClearButton, DebugButton, UploadButton;
  DebugButton = new BV('debug');
  DebugButton.set({
    legend: "Show Log",
    enabled: true
  });
  Pylon.on("systemEvent:debug:show-log", function() {
    DebugButton.set({
      legend: "Hide Log"
    });
    $('#footer').show();
    return false;
  });
  Pylon.on("systemEvent:debug:hide-log", function() {
    DebugButton.set({
      legend: "Show Log"
    });
    $('#footer').hide();
    return false;
  });
  $('#footer').hide();
  AdminButton = new BV('admin');
  AdminButton.set({
    legend: "Wait on Host",
    enabled: false
  });
  Pylon.on('canLogIn', function() {
    return AdminButton.set({
      enabled: true,
      legend: "Log In"
    });
  });
  Pylon.on("systemEvent:admin:log-in", enterAdmin);
  Pylon.on("systemEvent:admin:log-out", exitAdmin);
  Pylon.on("admin:disable", function() {
    return AdminButton.set('enabled', false);
  });
  Pylon.on("admin:enable", function() {
    return AdminButton.set('enabled', true);
  });
  ClearButton = new BV('clear', "u-full-width");
  ClearButton.set({
    legend: "Reject",
    enabled: false
  });
  Pylon.on("systemEvent:clear:reject", enterClear);
  UploadButton = new BV('upload', "u-full-width");
  UploadButton.set({
    legend: "Accept",
    enabled: false
  });
  Pylon.on("systemEvent:upload:accept", enterUpload);
  CalibrateButton = new BV('calibrate');
  CalibrateButton.set({
    legend: "--",
    enabled: false
  });
  Pylon.on("systemEvent:calibrate:backdoor", function() {
    if (!sessionInfo.get('testID')) {
      pageGen.forceTest('red');
    }
    Pylon.trigger('systemEvent:recordCountDown:start', 5);
    return applogger('Recording --- actively recording sensor info');
  });
  Pylon.on("systemEvent:calibrate:exit-calibration", exitCalibrate);
  ActionButton = new BV('action');
  ActionButton.set({
    legend: "Record",
    enabled: false
  });
  Pylon.on("systemEvent:action:record", enterRecording);
  return Pylon.on("systemEvent:action:stop", exitRecording);
};

enterAdmin = function() {
  var e, error;
  try {
    pageGen.activateAdminPage();
  } catch (error) {
    e = error;
    applogger("failure in activatAdminPage", e);
  }
  return false;
};

exitAdmin = function() {
  enterLogout();
  return false;
};

enterLogout = function() {
  var g, model;
  g = Pylon.get('globalState');
  g.set({
    loggedIn: false,
    recording: false
  });
  model = Pylon.get('sessionInfo');
  model.unset('clinic', {
    silent: true
  });
  model.unset('clinician', {
    silent: true
  });
  model.unset('password', {
    silent: true
  });
  model.unset('client', {
    silent: true
  });
  model.unset('testID', {
    silent: true
  });
  $('#password').val('');
  $('option:selected').prop('selected', false);
  $('option.forceSelect').prop('selected', true);
  $('#done').removeClass('button-primary').addClass('disabled').attr('disabled', 'disabled').off('click');
  (Pylon.get('button-action')).set({
    enabled: false
  });
  Pylon.trigger('admin:enable');
  (Pylon.get('button-admin')).set({
    legend: "Log In",
    enabled: true
  });
  (Pylon.get('button-upload')).set('enabled', false);
  (Pylon.get('button-clear')).set('enabled', false);
  return false;
};

initAll = function() {
  var rtemp;
  rtemp = void 0;
  Pylon.trigger("systemEvent:debug:Hide Log");
  $('#uuid').html("Must connect to sensor").css('color', "violet");
  enterAdmin();
};

eventModelLoader = require('./lib/upload.coffee').eventModelLoader;

enterClear = function(accept) {
  if (accept == null) {
    accept = false;
  }
  Pylon.trigger("removeRecorderWindow");
  $('#testID').prop("disabled", false);
  pageGen.forceTest();
  sessionInfo.set({
    accepted: accept
  });
  eventModelLoader(sessionInfo);
  sessionInfo.set('_id', null, {
    silent: true
  });
  (Pylon.get('button-clear')).set('enabled', false);
  (Pylon.get('button-upload')).set('enabled', false);
};

enterUpload = function() {
  return enterClear(true);
};

enterCalibrate = function() {
  var calibrating;
  return;
  applogger('enterCalibrate -- not used currently');
  calibrating = true;
  (Pylon.get('button-action')).set({
    enabled: true,
    legend: "Record"
  });
  (Pylon.get('button-calibrate')).set({
    legend: "Exit Calibration",
    enabled: false
  });
  return false;
};

exitCalibrate = function() {
  var calibrating;
  calibrating = false;
  (Pylon.get('button-calibrate')).set('legend', "Calibrate");
  return false;
};

theProtocol = function() {
  var testID, theTest;
  testID = sessionInfo.get('testID');
  protocol = Pylon.get('protocols');
  if (!testID || !protocol) {
    return {};
  }
  return theTest = protocol.findWhere({
    name: sessionInfo.get('testID')
  });
};

enterRecording = function() {
  var gs, numSensors, testID, theTest;
  testID = sessionInfo.get('testID');
  if (!testID) {
    pageGen.forceTest('red');
    return false;
  }
  numSensors = 0;
  if (Pylon.get("Left")) {
    numSensors++;
  }
  if (Pylon.get("Right")) {
    numSensors++;
  }
  protocol = Pylon.get('protocols');
  theTest = protocol.findWhere({
    name: sessionInfo.get('testID')
  });
  if (numSensors < theTest.get('sensorsNeeded')) {
    pageGen.forceTest('red', "need sensor");
    return false;
  }
  if (!sessionInfo.get('_id')) {
    sessionInfo.save();
  }
  Pylon.set({
    scanActive: false
  });
  (Pylon.get('button-admin')).set('enabled', false);
  gs = Pylon.get('globalState');
  if (gs.get('recording')) {
    return;
  }
  gs.set('recording', true);
  $('#testID').prop("disabled", true);
  Pylon.trigger('systemEvent:recordCountDown:start', 5);
  return applogger('Recording --- actively recording sensor info');
};

Pylon.on('systemEvent:recordCountDown:fail', function() {
  var gs;
  applog("Failure to obtain host session credentials");
  gs = Pylon.get('globalState');
  pageGen.forceTest('orange');
  gs.set('recording', false);
  $('#testID').prop("disabled", true);
});

Pylon.on('systemEvent:recordCountDown:over', function() {
  (Pylon.get('button-action')).set({
    enabled: true,
    legend: "Stop"
  });
  return false;
});

exitRecording = function() {
  var gs;
  gs = Pylon.get('globalState');
  if ('stopping' === gs.get('recording')) {
    return;
  }
  gs.set('recording', 'stopping');
  Pylon.trigger('systemEvent:stopCountDown:start', 5);
  Pylon.get('button-action').set({
    enabled: false
  });
  (Pylon.get('button-admin')).set('enabled', true);
  return false;
};

Pylon.on('systemEvent:stopCountDown:over', function() {
  applogger('Stop -- stop recording');
  Pylon.trigger('systemEvent:endRecording');
  Pylon.get('globalState').set('recording', false);
  (Pylon.get('button-upload')).set('enabled', true);
  (Pylon.get('button-clear')).set('enabled', true);
  (Pylon.get('button-admin')).set('enabled', true);
  return false;
});

startBlueTooth = function() {
  var TiHandler, TiHandlerDef;
  TiHandlerDef = require('./TiHandler.coffee');
  TiHandler = new TiHandlerDef(sessionInfo);
  window.TiHandler = TiHandler;
  return Pylon.set('TiHandler', TiHandler);
};

setSensor = function() {
  pageGen.activateSensorPage();
  return false;
};

enableRecordButtonOK = function() {
  var canRecord, gs, ref1, ref2;
  if ((ref1 = Pylon.get('Left')) != null) {
    ref1.set({
      numReadings: 0
    });
  }
  if ((ref2 = Pylon.get('Right')) != null) {
    ref2.set({
      numReadings: 0
    });
  }
  canRecord = true;
  gs = Pylon.get('globalState');
  if (!gs.get('connected')) {
    canRecord = false;
    (Pylon.get("button-scan")).set({
      enabled: true
    });
  }
  if (!gs.get('loggedIn')) {
    canRecord = false;
    (Pylon.get("button-admin")).set({
      enabled: true,
      legend: "log in"
    });
  }
  if (canRecord) {
    (Pylon.get('button-action')).set({
      enabled: true,
      legend: "Record"
    });
  }
  return false;
};

Pylon.on('sessionUploaded', enableRecordButtonOK);

Pylon.on('connected', function() {
  applogger('enable recording button');
  Pylon.get('globalState').set({
    connected: true
  });
  return enableRecordButtonOK();
});

Pylon.on('adminDone', function() {
  (Pylon.get('button-admin')).set('legend', "Log Out");
  Pylon.get('globalState').set('loggedIn', true);
  pageGen.activateSensorPage();
  return enableRecordButtonOK();
});

protocolsShowedErrors = 1;

protocols.on('fetched', function() {
  var gs;
  gs = Pylon.get('globalState');
  gs.set('protocols', true);
  if (gs.get('clinics')) {
    return Pylon.trigger('canLogIn');
  }
});

clinics.on('fetched', function() {
  var gs;
  gs = Pylon.get('globalState');
  gs.set('clinics', true);
  if (gs.get('protocols')) {
    return Pylon.trigger('canLogIn');
  }
});

getProtocol = function() {
  applogger("protocol request initiate");
  return protocols.fetch({
    success: function(collection, response, options) {
      applogger("protocols request success");
      return collection.trigger('fetched');
    },
    error: function(collection, response, options) {
      protocolsShowedErrors--;
      if (protocolsShowedErrors) {
        return;
      }
      protocolsShowedErrors = 15;
      return applogger(Pylon.get('hostUrl') + 'protocols', "protocols fetch error - response:", response.statusText);
    }
  });
};

getProtocol();

protocolTimer = setInterval(getProtocol, 11000);

protocols.on('fetched', function() {
  return clearInterval(protocolTimer);
});

clinicShowedErrors = 1;

getClinics = function() {
  applogger("clinic request initiate");
  return clinics.fetch({
    success: function(collection, response, options) {
      applogger("clinic request success");
      return collection.trigger('fetched');
    },
    error: function(collection, response, options) {
      clinicShowedErrors--;
      if (clinicShowedErrors) {
        return;
      }
      clinicShowedErrors = 5;
      applogger(Pylon.get('hostUrl') + 'clinics');
      return applogger("clinics fetch error - response:" + response.statusText);
    }
  });
};

getClinics();

clinicTimer = setInterval(getClinics, 10000);

clinics.on('fetched', function() {
  return clearInterval(clinicTimer);
});


/* this is how seen exports things -- it's clean.  we use it as example
#seen = {}
#if window? then window.seen = seen # for the web
#if module?.exports? then module.exports = seen # for node
 *
 *  And since we are in a browser ---
 */

window.$ = $;

window.sessionInfo = sessionInfo;

window.Pages = pageGen;

window.Me = this;

Pylon.test = function(page) {
  if (page == null) {
    page = 'test.html';
  }
  return window.location.assign(page);
};

Pylon.a = function() {
  return window.location.assign('alabaster.html');
};

Pylon.stress = function(percent) {
  if (percent == null) {
    percent = 50;
  }
  return Pylon.set({
    stress: percent / 100
  });
};

Pylon.rate = function(ms) {
  if (ms == null) {
    ms = 10;
  }
  return Pylon.set({
    sensorRate: ms
  });
};

Pylon.rate(10);

$(document).on('deviceready', function() {
  var ref1, ref2;
  sessionInfo.set('platformUUID', ((ref1 = window.device) != null ? ref1.uuid : void 0) || "No ID");
  sessionInfo.set('platformIosVersion', ((ref2 = window.device) != null ? ref2.version : void 0) || "noPlatform");
  $("#platformUUID").text(sessionInfo.attributes.platformUUID);
  $("#platformIosVersion").text("iOS Ver:" + sessionInfo.attributes.platformIosVersion);
  Pylon.on("UploadCount", function(count) {
    return $("#UploadCount").html("Queued:" + count);
  });
  startBlueTooth();
});

$(function() {
  document.addEventListener('resume', function() {
    return window.location.reload();
  });
  document.addEventListener('online', function() {
    return;
    return require('./lib/net-view.coffee');
  });
  pageGen.renderPage();
  activateNewButtons();
  if ($('#console-log') != null) {
    applog.useDiv('console-log');
    Pylon.trigger("systemEvent:debug:Hide Log");
  }
  initAll();
  setSensor();
  return false;
});



},{"./TiHandler.coffee":1,"./lib/buglog.coffee":3,"./lib/loadScript.coffee":6,"./lib/net-view.coffee":7,"./lib/upload.coffee":10,"./models/event-model.coffee":12,"./version.coffee":13,"./views/adminView.coffee":14,"./views/button-view.coffee":15,"./views/pages.coffee":17,"backbone":22,"jquery":29,"underscore":33}],3:[function(require,module,exports){
var buglog, c, localConsole, logger,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  slice = [].slice;

logger = require('debug');

c = window.Console;

require('./console');

localConsole = window.Console;

window.Console = c;

module.exports = buglog = (function() {
  function buglog(nameSpace) {
    this.log = bind(this.log, this);
    var queue;
    queue = [];
    this.yourLogger = new logger(nameSpace);
    logger.formatters.j = require('json-stringify-safe');
    this.yourLogger.useColors = false;
    this.yourLogger.log = function() {
      var stuff;
      stuff = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      queue.push(stuff);
      if ((typeof DDJSLogger !== "undefined" && DDJSLogger !== null) && Pylon.console) {
        queue.map(function(stuff) {
          DDJSLogger.logio(stuff);
          return Pylon.console.log.apply(Pylon.console, stuff);
        });
        queue = [];
      } else {

      }
      return localConsole.log(stuff);
    };
    return;
  }

  buglog.prototype.log = function() {
    return this.yourLogger.apply(this["this"], arguments);
  };

  buglog.prototype.useDiv = function(divID) {
    return Pylon.console = new localConsole(divID, Pylon);
  };

  return buglog;

})();



},{"./console":4,"debug":27,"json-stringify-safe":30}],4:[function(require,module,exports){
/*!
Copyright (C) 2011 by Marty Zalega

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

(function() {
  var consoles = {};

  function create(tagName, attrs) {
    var el = document.createElement(tagName);
    if (attrs)
      for (var k in attrs) el.setAttribute(k, attrs[k]);
    for (var i = 2; i < arguments.length; ++i)
      el.appendChild(arguments[i]);
    return el;
  }

  function text(el, text) {
    if (typeof el === 'string' || typeof el === 'number')
      return document.createTextNode(el);
    el.appendChild(document.createTextNode(text));
    return el;
  }

  function addClass(el) {
    var classes = [];
    for (var i = 1; i < arguments.length; ++i)
      classes = classes.concat(arguments[i].split(/\s+/));
    if (el.classList) {
      for (var i in classes) el.classList.add(classes[i]);
    }
    else {
      classes = el.className.split(/\s+/).concat(classes);
      el.className = classes.join(' ');
    }
    return el;
  }

  function listen(el, event, callback) {
    var onevent = 'on' + event;
    if (el.addEventListener)
      return el.addEventListener(event, callback, false);
    else if (el.attachEvent)
      return el.attachEvent(onevent, callback);
    else if (onevent in el)
      return el[onevent] = callback;
  }

  function extend(src) {
    for (var i = 1; i < arguments.length; ++i) {
      var obj = arguments[i];
      for (var k in obj) src[k] = obj[k];
    }
    return src;
  }

  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function bind(func, inst) {
    var args = toArray(arguments).slice(2);
    return function() {
      func.apply(inst || this, args.concat(toArray(arguments)));
    }
  }

  function typeOf(obj) {
    if (Object.prototype.toString.call(obj) === '[object Array]')
      return 'array';
    else if (Object.prototype.toString.call(obj) === '[object Error]')
      return 'error';
    else if (obj === null)
      return 'null';
    else if (obj && obj.nodeType == 1)
      return 'element';
    else
      return typeof obj;
  }

  function output(result, deep) {
    var type = typeOf(result);
    switch (type) {
      case 'null':
      case 'undefined':
        return create('span', {'class': type}, text(type));
      case 'array':
        var arr = create('ol', {'class': type});
        for (var i in result) {
          var val = result[i];
          arr.appendChild(create('li', null, output(val)));
        }
        return arr;
      case 'object':
        var obj = create('dl', {'class': type});
        for (var k in result) {
          if (!(k in result.__proto__)) {
            var val = deep === false ? text(k) : output(result[k], false);
            obj.appendChild(create('dt', null, text(k)));
            obj.appendChild(create('dd', null, val));
          }
        }
        return obj;
      case 'element':
        var nodeName = result.nodeName.toLowerCase(),
            attrs = create('dl'),
            open = create('div', {'class': 'open'}, text(nodeName), attrs),
            close = create('div', {'class': 'close'}, text(nodeName)),
            html = create('div', {'class': 'content'}, text(result.innerHTML));
        for (var i = 0; i < result.attributes.length; ++i) {
          var attr = result.attributes[i];
          attrs.appendChild(create('dt', null, text(attr.name)));
          attrs.appendChild(create('dd', null, text(attr.value)));
        }
        return create('div', {'class': type}, open, html, close);
      default:
        return create('span', {'class': type}, text(result.toString()));
    }
  }

  var History = function() {
    var index = -1, history = [];
    return extend(this, {
      clear: function() {
        history = [];
      },
      reset: function() {
        index = history.length;
      },
      previous: function() {
        return history[index = Math.max(--index, 0)];
      },
      next: function() {
        return history[index = Math.min(++index, history.length)];
      },
      push: function(data) {
        if (history[history.length - 1] !== data) {
          history.push(data);
          this.reset();
        }
      }
    });
  }

  var Console = function(el, scope) {
    if (typeof el == 'string')
      el = document.getElementById(el);

    var console = consoles[el];
    if (console) {
      console.cd(scope);
      return console;
    }
    else if (!(this instanceof Console)) {
      if (!console)
        console = new Console(el, scope);
      return console;
    }
    consoles[el] = this;

    scope || (scope = window);

    var limbo = create('div');
    while (node = el.childNodes[0])
      limbo.appendChild(node);

    var container      = create('div', {'class': 'console-container'}),
        inputContainer = create('p', {'class': 'console-input'}),
        input          = create('textarea', {row: 1}),
        original       = {className: el.className, tabIndex: el.tabIndex};
    inputContainer.appendChild(input);
    container.appendChild(inputContainer);
    addClass(el, 'console').appendChild(container);

    if (el.tabIndex < 0) el.tabIndex = 0;
    listen(el, 'focus', function() {
      input.focus();
    });

    var history = new History;
    listen(input, 'keydown', function(event) {
      switch (event.keyCode) {
        case 13: // enter
          event.preventDefault();
          exec(this.value);
          this.value = '';
          return false;
        case 38: // up
          if (cmd = history.previous())
            input.value = cmd;
          event.preventDefault();
          return false;
        case 40: // down
          if (cmd = history.next())
            input.value = cmd;
          else
            input.value = '';
          event.preventDefault();
          return false;
      }
    });
    listen(input, 'blur', function() {
      history.reset();
    });
    function jsonize(msg){
        function stringify(obj, replacer, spaces, cycleReplacer) {
          return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces)
        }

      function serializer(replacer, cycleReplacer) {
        var stack = [], keys = []

        if (cycleReplacer == null) cycleReplacer = function(key, value) {
          if (stack[0] === value) return "[Circular ~]"
          return "[Circular ~." + keys.slice(0, stack.indexOf(value)).join(".") + "]"
        }

        return function(key, value) {
          if (stack.length > 0) {
            var thisPos = stack.indexOf(this)
            ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
            ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
            if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value)
          }
          else stack.push(value)

        return replacer == null ? value : replacer.call(this, key, value)
        }
      }
    }
    function log(level) {
      var msg = arguments.length === 2 ? arguments[1] : toArray(arguments).slice(1);
  
      var result = create('div', {'class': 'result'}, output(msg)),
          el = addClass(create('p', null, result), typeOf(msg), level);
      container.insertBefore(el, inputContainer);
      return el;
    }

    function exec(command) {
      if (!command) return;

      var cmd = text(create('div', {'class': 'command'}), command),
          level = 'info', msg;
      try {
        msg = (function() { with(scope) { return eval(command) } }).call(scope);
      }
      catch (err) {
        msg = err; level = 'error';
      }
      var el = log(level, msg)
      el.insertBefore(cmd, el.childNodes[0]);
      el.scrollTop = el.scrollHeight;
      container.scrollTop = container.scrollHeight;
      history.push(command);
    }

    return extend(this, {
      cd: function(s) {
        scope = s;
      },
      log: function() {
        this.info.apply(this, arguments)
      },
      info: bind(log, this, 'info'),
      warn: bind(log, this, 'warn'),
      error: bind(log, this, 'error'),
      clear: function() {
        var prev = inputContainer.previousSibling;
        while (prev) {
          var el = prev;
          prev = el.previousSibling;
          el.parentNode.removeChild(el);
        }
      },
      destroy: function() {
        for (var k in original) el[k] = original[k];
        while (node = el.childNodes[0]) el.removeChild(node);
        while (node = limbo.childNodes[0]) el.appendChild(node);
        // delete limbo;
        // delete output;
        // delete input;
        // delete original;
      }
    });
  }

  Console.log = function(){return;}

  window.Console = Console;
})();

},{}],5:[function(require,module,exports){
var first, glib, hasher, namer, second, verbose;

first = ["Red", "Green", "Blue", "Grey", "Happy", "Hungry", "Sleepy", "Healthy", "Easy", "Hard", "Quiet", "Loud", "Round", "Pointed", "Wavy", "Furry"];

second = ["Justice", "Wisdom", "Equality", "Harmony", "Lamp", "Table", "Desk", "Couch", "Palace", "Shack", "House", "Cave", "Bamboo", "Lettuce", "Broccoli", "Raisin"];

verbose = function(s) {
  var hash;
  hash = 0;
  if (s.length === 0) {
    return hash;
  }
  for (i = 0, l = s.length; i < l; i++) {
        char = s.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash |= 0 // Convert to 32bit integer
      };
  return hash & 255;
};

hasher = function(s) {
  return s.split("").reduce(function(a, b) {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & 255;
  }, 0);
};

namer = function(hash) {
  var a, b;
  a = hash >> 4 & 0xf;
  b = hash & 0xf;
  return first[a] + ' ' + second[b];
};

glib = function() {
  return (function(_this) {
    return function(any) {
      return namer(hasher(any));
    };
  })(this);
};

exports.glib = new glib;



},{}],6:[function(require,module,exports){
var _, loadScript, loadedScripts;

loadedScripts = {};

_ = require('underscore');


/*
    Load a script.
    @param {string} url - URL or path to the script. Relative paths are
    relative to the HTML file that initiated script loading.
    @param {function} callback - Optional function that will
    be called on load or error.
    @public
 */

loadScript = function(url, callback) {
  var script, status;
  if (callback == null) {
    callback = function() {};
  }
  if (!loadedScripts[url]) {
    loadedScripts[url] = {
      status: "",
      callees: []
    };
  }
  status = loadedScripts[url].status;
  if (status === "loading" || status === "error") {
    callback(status);
    return;
  }
  loadedScripts[url].callees.push(callback);
  if (status === "loading") {
    return;
  }
  script = document.createElement("script");
  script.type = "text/javascript";
  script.src = url;
  script.onload = function() {
    loadedScripts[url].status = "loaded";
    _(loadedScripts[url].callees).each(function(callback) {
      return callback("loaded");
    });
    return loadedScripts[url].callees = [];
  };
  script.onerror = function() {
    loadedScripts[url] = "error";
    _(loadedScripts[url].callees).each(function(callback) {
      return callback("error");
    });
    return loadedScripts[url].callees = [];
  };
  return document.head.appendChild(script);
};

exports.loadScript = loadScript;



},{"underscore":33}],7:[function(require,module,exports){
var $, Backbone, CommoState, Teacup, buglog, commoState, implementing, netView, networklog, networklogger,
  slice = [].slice;

$ = require('jquery');

Backbone = require('backbone');

Teacup = require('teacup');

buglog = require('./buglog.coffee');

networklogger = (networklog = new buglog("network")).log;

CommoState = Backbone.Model.extend({
  netState: function() {
    return navigator.connection.type;
  },
  bleState: function() {
    return "Bluetooth OK";
  },
  bleAbility: true,
  initialize: function() {
    var Connection, e, error;
    try {
      Connection = navigator.connection;
      this.states[Connection.UNKNOWN] = 'Unknown connection';
      this.states[Connection.ETHERNET] = 'Ethernet connection';
      this.states[Connection.WIFI] = 'WiFi connection';
      this.states[Connection.CELL_2G] = 'Cell 2G connection';
      this.states[Connection.CELL_3G] = 'Cell 3G connection';
      this.states[Connection.CELL_4G] = 'Cell 4G connection';
      this.states[Connection.CELL] = 'Cell generic connection';
      this.states[Connection.NONE] = 'No network connection';
      this.ability[Connection.UNKNOWN] = false;
      this.ability[Connection.ETHERNET] = true;
      this.ability[Connection.WIFI] = true;
      this.ability[Connection.CELL_2G] = true;
      this.ability[Connection.CELL_3G] = true;
      this.ability[Connection.CELL_4G] = true;
      this.ability[Connection.CELL] = true;
      return this.ability[Connection.NONE] = false;
    } catch (error) {
      e = error;
      networklogger("ERROR IN ONLINE");
      return networklogger(e);
    }
  }
});

commoState = new CommoState;

implementing = function() {
  var classReference, i, j, key, len, mixin, mixins, ref, value;
  mixins = 2 <= arguments.length ? slice.call(arguments, 0, i = arguments.length - 1) : (i = 0, []), classReference = arguments[i++];
  for (j = 0, len = mixins.length; j < len; j++) {
    mixin = mixins[j];
    ref = mixin.prototype;
    for (key in ref) {
      value = ref[key];
      classReference.prototype[key] = value;
    }
  }
  return classReference;
};

netView = (function() {
  var a, body, br, button, canvas, div, doctype, form, h2, h3, h4, h5, head, hr, img, input, label, li, ol, option, p, password, raw, ref, render, renderable, select, span, table, tag, tbody, td, tea, text, th, thead, tr, ul;

  tea = new Teacup.Teacup;

  ref = tea.tags(), table = ref.table, tr = ref.tr, th = ref.th, thead = ref.thead, tbody = ref.tbody, td = ref.td, ul = ref.ul, li = ref.li, ol = ref.ol, a = ref.a, render = ref.render, input = ref.input, renderable = ref.renderable, raw = ref.raw, div = ref.div, img = ref.img, h2 = ref.h2, h3 = ref.h3, h4 = ref.h4, h5 = ref.h5, label = ref.label, button = ref.button, p = ref.p, text = ref.text, span = ref.span, canvas = ref.canvas, option = ref.option, select = ref.select, form = ref.form, body = ref.body, head = ref.head, doctype = ref.doctype, hr = ref.hr, br = ref.br, password = ref.password, tag = ref.tag;

  function netView() {}

  netView.prototype.netViewer = function() {
    var netViewTemplate;
    return netViewTemplate = Backbone.View.extend({
      el: '#net-info',
      model: commoState,
      initialize: function() {
        document.addEventListener("offline", this.render);
        return document.addEventListener("online", this.render);
      },
      events: {
        'change': function() {
          return render();
        }
      },
      render: function() {
        networklogger("Rendering --");
        return false;
      }
    });
  };

  return netView;

})();

exports.netView = new netView;



},{"./buglog.coffee":3,"backbone":22,"jquery":29,"teacup":32}],8:[function(require,module,exports){
var $, Seen, _, buglog, pipeline, pipelinelog, pipelinelogger;

Seen = require('seen-js');

$ = require('jquery');

_ = require('underscore');

buglog = require('./buglog.coffee');

pipelinelogger = (pipelinelog = new buglog("pipeline")).log;


/*
#Pylon's globalStatus looks like this:
#systemCommunicator = Backbone.Model.extend
 *  defaults:
 *    calibrating: false
 *    recording: false
 *    connected: false
 *    calibrate: false
 *
 *  Pylon.set 'globalState',  new systemCommunicator
 */

pipeline = (function() {
  var bufferToHexStr, byteToHexStr, hx, split;

  function pipeline() {}

  pipeline.prototype.calibratorAverage = function(dataCondition, calibrate, calibrating) {
    var e, error1, tH;
    try {
      tH = void 0;
      if (dataCondition.dataHistory.grandTotal === void 0) {
        dataCondition.dataHistory.grandTotal = Seen.P(0, 0, 0);
        dataCondition.dataHistory.grandAverage = Seen.P(0, 0, 0);
        dataCondition.dataHistory.totalReadings = 1;
      }
      tH = dataCondition.dataHistory;
      if (tH.totalReadings === 1000) {
        tH.grandTotal.subtract(tH.grandAverage);
        tH.totalReadings--;
      }
      tH.grandTotal.add(dataCondition.curValue);
      tH.totalReadings++;
      tH.grandAverage = tH.grandTotal.copy().divide(tH.totalReadings);
      dataCondition.cookedValue = dataCondition.curValue.copy().subtract(tH.grandAverage);
    } catch (error1) {
      e = error1;
    }
  };

  split = function(raw, lo, hi) {
    return raw - ((hi + lo) / 2.0);
  };

  pipeline.prototype.calibratorMid = function(dataCondition, calibrate, calibrating) {
    var e, error1, tH;
    try {
      tH = void 0;
      if (dataCondition.dataHistory.max === void 0) {
        dataCondition.dataHistory.max = dataCondition.cookedValue.copy();
        dataCondition.dataHistory.min = dataCondition.cookedValue.copy();
      }
      tH = dataCondition.dataHistory;
      if (dataCondition.cookedValue.x > tH.max.x) {
        tH.max.x = dataCondition.cookedValue.x;
      }
      if (dataCondition.cookedValue.y > tH.max.y) {
        tH.max.y = dataCondition.cookedValue.y;
      }
      if (dataCondition.cookedValue.z > tH.max.z) {
        tH.max.z = dataCondition.cookedValue.z;
      }
      if (dataCondition.cookedValue.x < tH.min.x) {
        tH.min.x = dataCondition.cookedValue.x;
      }
      if (dataCondition.cookedValue.y < tH.min.y) {
        tH.min.y = dataCondition.cookedValue.y;
      }
      if (dataCondition.cookedValue.z < tH.min.z) {
        tH.min.z = dataCondition.cookedValue.z;
      }
      dataCondition.cookedValue.x = split(dataCondition.cookedValue.x, tH.min.x, tH.max.x);
      dataCondition.cookedValue.y = split(dataCondition.cookedValue.y, tH.min.y, tH.max.y);
      dataCondition.cookedValue.z = split(dataCondition.cookedValue.z, tH.min.z, tH.max.z);
    } catch (error1) {
      e = error1;
    }
  };

  pipeline.prototype.calibratorSmooth = function(dataCondition, calibrate, calibrating) {
    var e, error1;
    try {
      if (dataCondition.dataHistory.runningSum === void 0) {
        dataCondition.dataHistory.runningSum = dataCondition.cookedValue.copy();
      }
      dataCondition.cookedValue = dataCondition.dataHistory.runningSum.multiply(0.75).add(dataCondition.cookedValue.copy().multiply(0.25)).copy();
    } catch (error1) {
      e = error1;
    }
  };

  pipeline.prototype.readingHandler = function(o) {
    var dataCondition, lastDisplay;
    lastDisplay = 0;
    dataCondition = {
      curValue: Seen.P(0, 0, 0),
      cookedValue: Seen.P(0, 0, 0),
      dataHistory: {}
    };
    if (!o.calibrator) {
      o.calibrator = function(d) {
        d.cookedValue = d.curValue;
      };
    }
    if (!o.units) {
      o.units = '';
    }
    o.bias = Seen.P(0, 0, 0);
    $('#' + o.debias).click(function() {
      o.bias = o.cookedValue;
    });
    return (function(_this) {
      return function(data) {
        var error, error1, i, m, p, r;
        try {
          p = void 0;
          m = void 0;
          r = Seen.P(data[0], data[1], data[2]);
          r.subtract(o.bias);
          dataCondition.curValue = r.copy();
          dataCondition.cookedValue = r.copy();
          i = 0;
          while (i < o.calibrator.length) {
            o.calibrator[i](dataCondition, 0, 0);
            i++;
          }
          p = dataCondition.cookedValue.multiply(o.finalScale);
          m = dataCondition.dataHistory;
          o.viewer(p.x, p.y, p.z);
        } catch (error1) {
          error = error1;
          pipelinelogger("in readinghandler: " + (error.statusText || error));
        }
      };
    })(this);
  };


  /*
   * Convert byte buffer to hex string.
   * @param buffer - an Uint8Array
   * @param offset - byte offset
   * @param numBytes - number of bytes to read
   * @return string with hex representation of bytes
   */

  hx = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

  bufferToHexStr = function(buffer, offset, numBytes) {
    var hex, i;
    hex = '';
    if (!numBytes) {
      numBytes = buffer.length;
    }
    if (!offset) {
      offset = 0;
    }
    i = 0;
    while (i < numBytes) {
      hex += byteToHexStr(buffer[offset + i]) + ' ';
      ++i;
    }
    return hex;
  };

  byteToHexStr = function(d) {
    var hi, lo;
    lo = hx[d & 0xf];
    hi = hx[(d & 0xf0) >> 4];
    return hi + lo;
  };

  pipeline.prototype.viewSensor = function(viewport, scaleFactor) {
    var cubie, height, model, newValue, scene, spearFromPool, spearPool, width;
    height = 100;
    width = 100;
    model = Seen.Models['default']();
    scene = new Seen.Scene({
      model: model,
      viewport: Seen.Viewports.center(width, height)
    });
    cubie = Seen.Shapes.cube().scale(0.25);
    spearPool = function(many) {
      var colors, context, count, i, j, newArrow, shapes;
      i = void 0;
      j = void 0;
      shapes = new Array(many);
      count = -1;
      colors = new Array(many);
      context = null;
      newArrow = function(model, x, y, z) {
        var alphaDecay;
        alphaDecay = 255;
        count = count + 1;
        if (count === many) {
          count = 0;
        }
        shapes[count].reset();
        j = 0;
        i = count;
        while (i < many) {
          if (shapes[i]) {
            shapes[i].fill(colors[j++]);
          }
          i++;
        }
        i = 0;
        while (i < count) {
          if (shapes[i]) {
            shapes[i].fill(colors[j++]);
          }
          i++;
        }
        return shapes[count];
      };
      i = 0;
      while (i < many) {
        shapes[i] = Seen.Shapes.arrow(1, 18, 0.5, 2, 1).scale(-1, 1, 1).translate(20, 0, 0).scale(height * 0.025);
        model.add(shapes[i].bake());
        colors[i] = new Seen.Material(new Seen.Color(255, 80, 255, 255 - 250 / many * i));
        i++;
      }
      return newArrow;
    };
    newValue = function(x, y, z) {
      var context, cross, dot, error1, leng, m, p1, pBar, pOriginal, problem, q, spear;
      p1 = Seen.P(x, y, z);
      spear = void 0;
      pOriginal = p1.copy();
      pBar = Seen.P(1, 0, 0);
      m = void 0;
      q = void 0;
      cross = void 0;
      dot = void 0;
      leng = p1.magnitude();
      p1 = p1.normalize();
      pBar.add(p1);
      if (pBar.magnitude() < 0.000001) {
        pBar = Seen.P(0, 1, 0);
      }
      pBar.normalize();
      q = Seen.Quaternion.pointAngle(pBar, Math.PI);
      m = q.toMatrix();
      try {
        spear = spearFromPool(model, x, y, z).transform(m).scale(scaleFactor * leng);
      } catch (error1) {
        problem = error1;
        pipelinelogger("Death from spear Pool");
        pipelinelogger(problem.statusText || probem);
      }
      spear.fill(new Seen.Material(new Seen.Color(255, 80, 255)));
      if (!context) {
        context = Seen.Context(viewport, scene);
      }
      context.render();
    };
    spearFromPool = new spearPool(Pylon.get('spearCount'));
    cubie.fill(new Seen.Material(new Seen.Color(25, 200, 200, 100)));
    model.add(cubie);
    return newValue;
  };

  return pipeline;

})();

if (typeof window !== "undefined" && window !== null) {
  window.exports = pipeline;
}

if ((typeof module !== "undefined" && module !== null ? module.exports : void 0) != null) {
  module.exports = pipeline;
}



},{"./buglog.coffee":3,"jquery":29,"seen-js":31,"underscore":33}],9:[function(require,module,exports){

/*
 * Javascript Stopwatch class
 * http://www.seph.dk
 *
 * Copyright 2009 Seph soliman
 * Released under the CC BY 4.0 (do whatever you want - just leave my name on it)
 * https://creativecommons.org/licenses/by/4.0/
 */
var Stopwatch;

module.exports = Stopwatch = (function() {
  function Stopwatch(tickResolution, countUp, listener1) {
    this.tickResolution = tickResolution != null ? tickResolution : 100;
    this.countUp = countUp != null ? countUp : true;
    this.listener = listener1;
    this.startTime = 0;
    this.stopTime = 0;
    this.totalElapsed = 0;
    this.started = false;
    this.tickInterval = null;
    this.onehour = 1000 * 60 * 60;
    this.onemin = 1000 * 60;
    this.onesec = 1000;
    return;
  }

  Stopwatch.prototype.start = function() {
    var delegate;
    delegate = function(that, method) {
      return function() {
        return method.call(that);
      };
    };
    if (!this.started) {
      this.startTime = (new Date).getTime();
      this.stopTime = 0;
      this.started = true;
      this.tickInterval = setInterval(delegate(this, this.onTick), this.tickResolution);
    }
  };

  Stopwatch.prototype.stop = function() {
    var elapsed;
    if (this.started) {
      this.stopTime = (new Date).getTime();
      this.started = false;
      elapsed = this.stopTime - this.startTime;
      this.totalElapsed += elapsed;
      if (this.tickInterval !== null) {
        clearInterval(this.tickInterval);
      }
    }
    return this.getElapsed();
  };

  Stopwatch.prototype.reset = function() {
    var delegate;
    this.totalElapsed = 0;
    this.startTime = (new Date).getTime();
    this.stopTime = this.startTime;
    if (!this.countUp) {
      this.totalElapsed = this.initialElapsed;
    }
    if (this.tickInterval !== null) {
      delegate = function(that, method) {
        return function() {
          return method.call(that);
        };
      };
      clearInterval(this.tickInterval);
      this.tickInterval = setInterval(delegate(this, this.onTick), this.tickResolution);
    }
  };

  Stopwatch.prototype.restart = function() {
    this.stop();
    this.reset();
    this.start();
  };

  Stopwatch.prototype.getElapsed = function() {
    var elapsed, hours, mins, ms, secs;
    elapsed = 0;
    if (this.started) {
      elapsed = (new Date).getTime() - this.startTime;
    }
    elapsed += this.totalElapsed;
    if (!this.countUp) {
      elapsed = Math.max(2 * this.initialElapsed - elapsed, 0);
    }
    hours = parseInt(elapsed / this.onehour);
    elapsed %= this.onehour;
    mins = parseInt(elapsed / this.onemin);
    elapsed %= this.onemin;
    secs = parseInt(elapsed / this.onesec);
    ms = elapsed % this.onesec;
    return {
      hours: hours,
      minutes: mins,
      seconds: secs,
      milliseconds: ms
    };
  };

  Stopwatch.prototype.setElapsed = function(hours, mins, secs) {
    var delegate;
    this.totalElapsed = 0;
    this.startTime = (new Date).getTime();
    this.stopTime = this.startTime;
    this.totalElapsed += hours * this.onehour;
    this.totalElapsed += mins * this.onemin;
    this.totalElapsed += this.countUp ? secs * this.onesec : (secs + 1) * this.onesec - 1;
    this.totalElapsed = Math.max(this.totalElapsed, 0);
    this.initialElapsed = this.totalElapsed;
    if (this.tickInterval !== null) {
      delegate = function(that, method) {
        return function() {
          return method.call(that);
        };
      };
      clearInterval(this.tickInterval);
      this.tickInterval = setInterval(delegate(this, this.onTick), this.tickResolution);
    }
  };

  Stopwatch.prototype.toString = function() {
    var e, zpad;
    zpad = function(num, digits, pad) {
      if (pad == null) {
        pad = '0';
      }
      num = num.toString();
      while (num.length < digits) {
        num = pad + num;
      }
      return num;
    };
    e = this.getElapsed();
    return zpad(e.hours, 2, ' ') + ':' + zpad(e.minutes, 2) + ':' + zpad(e.seconds, 2) + ':' + parseInt(e.milliseconds / 100);
  };

  Stopwatch.prototype.setListener = function(listener) {
    this.listener = listener;
  };

  Stopwatch.prototype.onTick = function() {
    if (this.listener !== null) {
      this.listener(this);
    }
  };

  return Stopwatch;

})();



},{}],10:[function(require,module,exports){
var $, Backbone, MyId, Pylon, _, accessItem, buglog, eventModelLoader, getNextItem, hiWater, localStorage, needs, oldAll, records, removeItem, sendToHost, setNewItem, timeOutScheduled, uploader, uploading, uplog, uplogger;

$ = require('jquery');

_ = require('underscore');

Backbone = require('backbone');

buglog = require('./buglog.coffee');

uplogger = (uplog = new buglog("uploader")).log;

uplogger("initializing");

localStorage = window.localStorage;

Pylon = window.Pylon;

uploading = false;

timeOutScheduled = false;

needs = function(array, key) {
  var i, id, len;
  for (i = 0, len = array.length; i < len; i++) {
    id = array[i];
    if (id === key) {
      return false;
    }
  }
  return true;
};

hiWater = function() {
  var error, high;
  high = localStorage.getItem('hiWater') || 1;
  try {
    high = 1 * high + 1;
  } catch (error) {
    high = 1;
  }
  localStorage.setItem('hiWater', high);
  return high;
};

oldAll = -1;

records = function() {
  var all, l;
  all = localStorage.getItem('all_events');
  all = (all && all.split(",")) || [];
  if ((l = all.length) !== oldAll) {
    Pylon.trigger("UploadCount", all.length);
  }
  oldAll = l;
  return all;
};

setNewItem = function(backboneAttributes) {
  var events;
  events = records();
  uplogger("keys = " + (events.join(',')));
  localStorage.setItem(backboneAttributes.LSid, JSON.stringify(backboneAttributes));
  if (needs(events, backboneAttributes.LSid)) {
    events.push(backboneAttributes.LSid);
    localStorage.setItem('all_events', events.join(','));
  }
  timeOutScheduled = true;
  setTimeout(getNextItem, 50);
};

accessItem = function(lsid) {
  uplogger("accessing item " + lsid);
  return localStorage.getItem(lsid);
};

removeItem = function(lsid) {
  var events, i, id, key, len;
  uplogger("removing item " + lsid);
  events = records();

  /*
  remove item from event array 
  coffee> a=[10,11,12,13,14,15,10,11,12,13,14,15]
    [ 10, 11, 12, 13, 14, 15, 10, 11, 12, 13, 14, 15 ]
  coffee> a.splice(key,1) for id,key in a when id is 13
    [ [ 13 ], [ 13 ] ]
  coffee> a
    [ 10, 11, 12, 14, 15, 10, 11, 12, 14, 15 ]
   */
  for (key = i = 0, len = events.length; i < len; key = ++i) {
    id = events[key];
    if (id === lsid) {
      events.splice(key, 1);
    }
  }
  localStorage.removeItem(lsid);
  localStorage.setItem('all_events', events.join(','));
  uplogger("removeItem set all_events " + (events.join(',')));
};

getNextItem = function() {
  var e, error, events, item, key, uploadDataObject;
  uplogger("Uploader Activated");
  events = records();
  if (!events.length) {
    uplogger("Nothing  to Upload");
    timeOutScheduled = false;
    return null;
  }
  if (!events.length || uploading) {
    uplogger("Busy -- ");
    return null;
  }
  key = events.shift();
  item = accessItem(key);
  try {
    uploadDataObject = JSON.parse(item);
  } catch (error) {
    e = error;
    uplogger("Error in localStorage retrieval- key==" + key);
    uplogger("item discarded -- invalid JSON");
    return null;
  }
  return sendToHost(uploadDataObject);
};

MyId = function() {
  return "Up-" + (hiWater());
};

eventModelLoader = function(uploadDataModel) {
  var item, key, ref, value;
  if (!uploadDataModel.attributes) {
    uplogger("Refusing to upload model with no attributes");
  }
  item = {};
  ref = uploadDataModel.attributes;
  for (key in ref) {
    value = ref[key];
    item[key] = value;
  }
  item.LSid = MyId();
  item.url = uploadDataModel.url;
  item.hostFails = 0;
  uplogger("adding " + item.LSid + " to localStorage");
  setNewItem(item);
};

sendToHost = function(uDM) {
  var hopper, stress, uploadDataObject, url;
  uploading = uDM.LSid;
  url = uDM.url;
  if (!url.match('http[s]?://')) {
    url = (Pylon.get('hostUrl')) + url;
  }
  hopper = Backbone.Model.extend({
    url: url
  });
  uploadDataObject = new hopper(uDM);
  stress = Pylon.get('stress');
  if (stress > Math.random()) {
    uplogger("stress test upload failure, item " + (uploadDataObject.get('LSid')) + ", retry in 5 seconds");
    return;
  }
  uDM = uploadDataObject.attributes;
  if (uDM.session) {
    uplogger("attempt " + uDM.LSid + " ", uDM.url, uDM.readings.substring(0, 30), uDM.role, uDM.session);
  } else {
    uplogger("attempt " + uDM.LSid + " ", uDM.url, uDM._id);
  }
  uploadDataObject.save(null, {
    success: function(a, b, code) {
      var id;
      uDM = a.attributes;
      id = uDM.LSid;
      removeItem(id);
      uploading = false;
      if (uDM.session) {
        uplogger("success " + id + " " + uDM.url + ", " + uDM._id);
      } else {
        uplogger("success " + id + " (session) ");
        Pylon.trigger('sessionUploaded');
      }
      uplogger("upload of " + id + " complete");
      setTimeout(getNextItem, 0);
    },
    error: function(a, b, c) {
      var failCode, fails;
      setTimeout(getNextItem, 5000);
      uDM = a.attributes;
      if (uDM.session) {
        uplogger("failure " + uDM.LSid + " ", uDM.url, uDM.readings.substring(0, 30), uDM.role, uDM.session);
      } else {
        uplogger("failure " + uDM.LSid + " ", uDM.url, uDM.id);
      }
      uploading = false;
      failCode = b.status;
      fails = a.get('hostFails');
      fails += 1;
      uplogger(fails + " failures (" + failCode + ") on " + (a.get('LSid')));
    }
  });
};

uploader = function() {
  alert("Uploader Called!");
};

timeOutScheduled = true;

setTimeout(getNextItem, 5000);


/* this is how seen exports things -- it's clean.  we use it as example
#seen = {}
#if window? then window.seen = seen # for the web
#if module?.exports? then module.exports = seen # for node
 *
 */

module.exports = {
  uploader: uploader,
  eventModelLoader: eventModelLoader
};



},{"./buglog.coffee":3,"backbone":22,"jquery":29,"underscore":33}],11:[function(require,module,exports){
var Backbone, EventModel, Pipeline, ab2str, accelerometer, boilerplate, buglog, deviceCollection, devicelog, devicelogger, infoService, lastDisplay, str2ab;

Backbone = require('Backbone');

EventModel = require('./event-model.coffee').EventModel;

buglog = require('../lib/buglog.coffee');

devicelogger = (devicelog = new buglog("sensor")).log;

Pipeline = require('../lib/pipeline.coffee');

infoService = "0000180a-0000-1000-8000-00805f9b34fb";

infoService = "180a";

boilerplate = {
  firmwareVersion: "2a26",
  modelNumber: "2a24",
  serialNumber: "2a25",
  softwareVersion: "2a28"
};

accelerometer = {
  service: "F000AA80-0451-4000-B000-000000000000",
  data: "F000AA81-0451-4000-B000-000000000000",
  notification: "F0002902-0451-4000-B000-000000000000",
  configuration: "F000AA82-0451-4000-B000-000000000000",
  period: "F000AA83-0451-4000-B000-000000000000"
};

accelerometer.notification = '00002902-0000-1000-8000-00805f9b34fb';

accelerometer.notification = '2902';

accelerometer.period = 'F000AA83-0451-4000-B000-000000000000';

ab2str = function(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
};

lastDisplay = 0;

str2ab = function(str) {
  var buf, bufView, i, j, len;
  buf = new ArrayBuffer(str.length * 2);
  bufView = new Uint16Array(buf);
  for (j = 0, len = str.length; j < len; j++) {
    i = str[j];
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
};

exports.deviceModel = Backbone.Model.extend({
  defaults: {
    buttonText: 'connect',
    buttonClass: 'button-primary',
    deviceStatus: '--',
    rate: 20,
    lastDisplay: Date.now()
  },
  urlRoot: function() {
    return Pylon.get('hostUrl') + 'sensor-tag';
  },
  initialize: function() {
    this.chain = this.createVisualChain(this);
    this.on("change:role", function() {
      return this.set('readings', new EventModel(this.get('role'), this));
    });
    this.on("change:rate", this.subscribe);
    this.on("change:serialNumber", function() {
      var data, role, session;
      data = this.get('serialNumber');
      role = this.get('role');
      $("#" + role + "SerialNumber").html(this.get('serialNumber'));
      session = Pylon.get('sessionInfo');
      if (role === 'Right') {
        session.set('SerialNoR', data);
      }
      if (role === 'Left') {
        session.set('SerialNoL', data);
      }
    });
    this.on("change:firmwareVersion", function() {
      var data, role, session;
      data = this.get('firmwareVersion');
      role = this.get('role');
      $("#" + role + "Version").html(data);
      session = Pylon.get('sessionInfo');
      if (role === 'Right') {
        session.set('FWLevelR', data);
      }
      if (role === 'Left') {
        session.set('FWLevelL', data);
      }
    });
    Pylon.on("speed", function(val) {
      return this.set('rate', val);
    });
    return this;
  },
  getBoilerplate: function() {
    var attribute, plates, promises, uuid;
    plates = [];
    promises = (function() {
      var results;
      results = [];
      for (attribute in boilerplate) {
        uuid = boilerplate[attribute];
        devicelogger("Device " + this.attributes.name + ": getting " + attribute + " at " + uuid);
        results.push(plates.push(new Promise((function(_this) {
          return function(resolve, reject) {
            var attr;
            attr = attribute;
            ble.read(_this.id, infoService, uuid, function(data) {
              var val;
              val = ab2str(data);
              devicelogger("Setting attribute for " + attr + " to " + val);
              _this.set(attr, val);
              return resolve();
            }, function(err) {
              devicelogger("unable to obtain " + attr + " from " + _this.attributes.name);
              return reject();
            });
            return devicelogger("Promised attribute for " + attr);
          };
        })(this))));
      }
      return results;
    }).call(this);
    return plates;
  },
  stopNotification: function() {
    var configData;
    devicelogger("stopNotification entry");
    configData = new Uint16Array(1);
    configData[0] = 0x0000;
    return ble.withPromises.stopNotification(device.id, accelerometer.service, accelerometer.data, (function(_this) {
      return function(whatnot) {
        devicelogger("stopNotification Terminated movement monitor. device " + device.name);
        return resolve();
      };
    })(this), (function(_this) {
      return function(e) {
        devicelogger("stopNotification error terminating movement device " + device.name + " monitor " + e);
        return reject();
      };
    })(this));
  },
  subscribe: function() {
    return (function(_this) {
      return function(device) {
        var activateMovement, e, error, idlePromise, resulting, setPeriod, startNotification, thePromise;
        idlePromise = function() {
          return new Promise(function(resolve, reject) {
            devicelogger("idlePromise entry");
            return setTimeout(resolve, 100);
          });
        };
        startNotification = function() {
          devicelogger("startNotification entry");
          return new Promise(function(resolve, reject) {
            return ble.withPromises.startNotification(device.id, accelerometer.service, accelerometer.data, function(data) {
              return _this.processMovement(new Int16Array(data));
            }, function(xxx) {
              devicelogger("startNotification failure for device " + device.name + ": " + xxx);
              return reject();
            });
          });
        };
        setPeriod = function() {
          devicelogger("setPeriod entry");
          return new Promise(function(resolve, reject) {
            var periodData;
            periodData = new Uint8Array(1);
            periodData[0] = _this.attributes.rate;
            devicelogger("Timing parameter for sensor rate = " + _this.attributes.rate);
            return ble.write(_this.attributes.id, accelerometer.service, accelerometer.period, periodData.buffer, function() {
              devicelogger("setPeriod Configured movement " + (10 * _this.attributes.rate) + "ms period device " + _this.attributes.name + ".");
              return resolve();
            }, function(e) {
              devicelogger("setPeriod error starting movement monitor " + e);
              return reject();
            });
          });
        };
        activateMovement = function() {
          var configData;
          devicelogger("activateMovement entry. device " + device.name);
          configData = new Uint16Array(1);
          configData[0] = 0x017F;
          return ble.withPromises.write(device.id, accelerometer.service, accelerometer.configuration, configData.buffer, (function(_this) {
            return function(whatnot) {
              devicelogger("activateMovement Started movement monitor. device " + device.name);
              return resolve();
            };
          })(this), (function(_this) {
            return function(e) {
              devicelogger("activateMovement error starting movement device " + device.name + " monitor " + e);
              return reject();
            };
          })(this));
        };
        try {
          devicelogger("Device subscribe attempt " + device.name);
          thePromise = Promise.all(_this.getBoilerplate());
          resulting = thePromise.then(idlePromise);
          resulting = resulting.then(activateMovement);
          resulting = resulting.then(idlePromise);
          resulting = resulting.then(setPeriod);
          resulting = resulting.then(idlePromise);
          resulting = resulting.then(startNotification);
          devicelogger("the promise has been built");
          devicelogger(resulting);

          /*
          configData = new Uint16Array(1);
          #Turn off gyro, accel, and mag, 2G range, Disable wake on motion
          configData[0] = 0x0000;
          ble.stopNotification device.id,
            accelerometer.service
            accelerometer.data
            (whatnot)=> 
              devicelogger "Terminated movement monitor. device #{device.name}"
            (e)=> devicelogger "error terminating movement device #{device.name} monitor #{e}"
          ble.startNotification device.id,
            accelerometer.service
            accelerometer.data
             * convert raw iOS data into js and update the device model
            (data)=>
              debugger
              @.set rawData: new Int16Array(data);
            (xxx)=>
              devicelogger "can't start movement service for device #{device.name}: #{xxx}"
              return
              
          
          periodData = new Uint8Array(1);
          periodData[0] = @.attributes.rate;
          devicelogger "Timing parameter for sensor rate = #{@.attributes.rate}"
          ble.write @.attributes.id,
            accelerometer.service
            accelerometer.period
            periodData.buffer
            ()=> devicelogger "Configured movement #{10*@.attributes.rate}ms period device #{@.attributes.name}."
            (e)=> devicelogger "error starting movement monitor #{e}"
              
          
           * turn accelerometer on
          #Turn on gyro, accel, and mag, 2G range, Disable wake on motion
          configData[0] = 0x017F;
          ble.write device.id,
            accelerometer.service
            accelerometer.configuration
            configData.buffer
            (whatnot)=> 
              devicelogger "Started movement monitor. device #{device.name}"
            (e)=> devicelogger "error starting movement device #{device.name} monitor #{e}"
           */
        } catch (error) {
          e = error;
          alert('Error in attachSensor -- check LOG');
          devicelogger("error in attachSensor");
          devicelogger(e);
        }
      };
    })(this);
  },
  createVisualChain: function() {
    var accelerometerHandler, gyroscopeHandler, magnetometerHandler, smoother;
    smoother = new Pipeline;
    accelerometerHandler = smoother.readingHandler({
      debias: 'calibrateAccel',
      units: 'G',
      calibrator: [smoother.calibratorSmooth],
      viewer: (function(_this) {
        return function(x, y, z) {
          var v;
          if (!v) {
            v = smoother.viewSensor("accel-" + (_this.get('rowName')), 1.5);
          }
          v(x, y, z);
        };
      })(this),
      finalScale: 2
    });
    magnetometerHandler = smoother.readingHandler({
      debias: 'calibrateMag',
      calibrator: [smoother.calibratorAverage, smoother.calibratorSmooth],
      units: '&micro;T',
      viewer: (function(_this) {
        return function(x, y, z) {
          var v;
          if (!v) {
            v = smoother.viewSensor("mag-" + (_this.get('rowName')), 1.5);
          }
          v(x, y, z);
        };
      })(this),
      finalScale: 0.15
    });
    gyroscopeHandler = smoother.readingHandler({
      debias: 'calibrateGyro',
      calibrator: [smoother.calibratorAverage, smoother.calibratorSmooth],
      viewer: (function(_this) {
        return function(x, y, z) {
          var v;
          if (!v) {
            v = smoother.viewSensor("gyro-" + (_this.get('rowName')), 1.5);
          }
          v(x, y, z);
        };
      })(this),
      finalScale: 1
    });
    return {
      gyro: gyroscopeHandler,
      accel: accelerometerHandler,
      mag: magnetometerHandler
    };
  },
  sensorMpu9250GyroConvert: function(data) {
    return data / (65536 / 500);
  },
  sensorMpu9250AccConvert: function(data) {
    return data / (32768 / 2);
  },
  processMovement: function(data) {
    if (Pylon.get('globalState').get('recording')) {
      this.attributes.numReadings += 1;
      this.attributes.readings.addSample(data);
    }
    if (this.lastDisplay + 120 > Date.now()) {
      return;
    }
    this.lastDisplay = Date.now();
    this.set({
      gyro: data.slice(0, 3).map(this.sensorMpu9250GyroConvert)
    });
    this.set({
      accel: data.slice(3, 6).map(this.sensorMpu9250AccConvert)
    });
    this.set({
      mag: data.slice(7, 10).map(function(a) {
        return a;
      })
    });
    this.set({
      deviceStatus: 'Receiving'
    });
    this.chain.gyro(this.attributes.gyro);
    this.chain.accel(this.attributes.accel);
    this.chain.mag(this.attributes.mag);
  }
});

deviceCollection = Backbone.Collection.extend({
  model: exports.deviceModel
});

Pylon.set('devices', new deviceCollection);



},{"../lib/buglog.coffee":3,"../lib/pipeline.coffee":8,"./event-model.coffee":12,"Backbone":20}],12:[function(require,module,exports){
var Backbone, EventModel, _, eventModelLoader;

Backbone = require('backbone');

_ = require('underscore');

eventModelLoader = require('../lib/upload.coffee').eventModelLoader;

EventModel = Backbone.Model.extend({
  url: 'event',
  close: function() {
    this.flush();
    if (this.device) {
      return this.unset('session');
    }
  },
  initialize: function(role, device) {
    var sessionInfo;
    this.device = device != null ? device : null;
    this.set('role', role);
    this.flusher = setInterval(_.bind(this.flush, this), 10000);
    Pylon.on('systemEvent:endRecording', _.bind(this.close, this));
    sessionInfo = Pylon.get('sessionInfo');
    this.listenTo(sessionInfo, 'change:_id', function() {
      return this.set('session', sessionInfo.get('_id'));
    });
  },
  flush: function() {
    var flushTime;
    if (this.device) {
      this.set('UUID', this.device.id);
    }
    flushTime = Date.now();
    if ((this.has('session')) && (this.has('readings'))) {
      eventModelLoader(this);
    }
    this.unset('readings');
    this.set('captureDate', flushTime);
  },
  addSample: function(sample) {
    var role, samples;
    role = (this.get('role')).toLowerCase();
    if (role === 'left' || role === 'right') {
      if (samples = this.get('readings')) {
        samples += ';' + sample.toString();
      } else {
        this.set('captureDate', Date.now());
        samples = sample.toString();
      }
      return this.set('readings', samples);
    } else {
      this.set('captureDate', Date.now());
      this.set('readings', sample);
      return this.flush();
    }
  }
});

exports.EventModel = EventModel;



},{"../lib/upload.coffee":10,"backbone":22,"underscore":33}],13:[function(require,module,exports){
module.exports = '1.5.8-pre';



},{}],14:[function(require,module,exports){
var $, Backbone, Teacup, adminView, adminlog, adminlogger, buglog, implementing,
  slice = [].slice,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

$ = require('jquery');

Backbone = require('backbone');

Teacup = require('teacup');

buglog = require('../lib/buglog.coffee');

adminlogger = (adminlog = new buglog("admin")).log;

implementing = function() {
  var classReference, i, j, key, len, mixin, mixins, ref, value;
  mixins = 2 <= arguments.length ? slice.call(arguments, 0, i = arguments.length - 1) : (i = 0, []), classReference = arguments[i++];
  for (j = 0, len = mixins.length; j < len; j++) {
    mixin = mixins[j];
    ref = mixin.prototype;
    for (key in ref) {
      value = ref[key];
      classReference.prototype[key] = value;
    }
  }
  return classReference;
};

adminView = (function() {
  var a, body, br, button, canvas, div, doctype, form, h2, h3, h4, h5, head, hr, img, input, label, li, ol, option, p, password, raw, ref, render, renderable, select, span, table, tag, tbody, td, tea, text, th, thead, tr, ul;

  tea = new Teacup.Teacup;

  ref = tea.tags(), table = ref.table, tr = ref.tr, th = ref.th, thead = ref.thead, tbody = ref.tbody, td = ref.td, ul = ref.ul, li = ref.li, ol = ref.ol, a = ref.a, render = ref.render, input = ref.input, renderable = ref.renderable, raw = ref.raw, div = ref.div, img = ref.img, h2 = ref.h2, h3 = ref.h3, h4 = ref.h4, h5 = ref.h5, label = ref.label, button = ref.button, p = ref.p, text = ref.text, span = ref.span, canvas = ref.canvas, option = ref.option, select = ref.select, form = ref.form, body = ref.body, head = ref.head, doctype = ref.doctype, hr = ref.hr, br = ref.br, password = ref.password, tag = ref.tag;

  function adminView() {
    this.wireAdmin = bind(this.wireAdmin, this);
    this.adminContents = bind(this.adminContents, this);
  }

  adminView.prototype.inspectAdminPage = function() {
    var clientViewTemplate, clinicViewTemplate, clinicianViewTemplate, doneViewTemplate;
    clinicViewTemplate = Backbone.View.extend({
      el: '#desiredClinic',
      collection: Pylon.get('clinics'),
      attributes: {
        session: Pylon.get('sessionInfo')
      },
      initialize: function() {
        return this.listenTo(this.collection, 'change', this.render);
      },
      events: {
        'change': function() {
          var error, error1, temp, theClinic, theOptionCid;
          theOptionCid = this.$el.val();
          if (theOptionCid) {
            theClinic = this.collection.get(theOptionCid);
            try {
              this.attributes.session.set('clinic', theClinic);
            } catch (error1) {
              error = error1;
              adminlogger("Error from setting clinic", error);
            }
          } else {
            theClinic = null;
            this.attributes.session.unset('clinic');
          }
          this.attributes.session.unset('clinician');
          this.attributes.session.unset('client');
          temp = Pylon.get('clinicians');
          temp.reset();
          if (theClinic) {
            temp.add(theClinic.get('clinicians'));
          }
          temp.trigger('change');
          temp = Pylon.get('clients');
          temp.reset();
          if (theClinic) {
            temp.add(theClinic.get('clients'));
          }
          temp.trigger('change');
          this.attributes.session.trigger('change');
          return false;
        }
      },
      render: function() {
        this.$el.html(render((function(_this) {
          return function() {
            var clinic, i, len, ref1, results;
            option("Select ---", {
              value: ''
            });
            ref1 = _this.collection.models;
            results = [];
            for (i = 0, len = ref1.length; i < len; i++) {
              clinic = ref1[i];
              if (clinic.get('force')) {
                results.push(option('.forceSelect.selected', {
                  selected: 'selected',
                  value: clinic.cid
                }, clinic.get('name')));
              } else {
                results.push(option({
                  value: clinic.cid
                }, clinic.get('name')));
              }
            }
            return results;
          };
        })(this)));
        return this;
      }
    });
    clinicianViewTemplate = Backbone.View.extend({
      el: '#desiredClinician',
      collection: Pylon.get('clinicians'),
      attributes: {
        session: Pylon.get('sessionInfo')
      },
      initialize: function() {
        return this.listenTo(this.collection, 'change', this.render);
      },
      events: {
        'change': function() {
          var temp;
          temp = this.$el.val();
          if (temp) {
            this.attributes.session.set('clinician', temp);
          } else {
            this.attributes.session.unset('clinician');
          }
          this.attributes.session.trigger('change');
          return false;
        }
      },
      render: function() {
        var temp;
        temp = render((function(_this) {
          return function() {
            var i, len, n, ref1, results, who;
            option("Select ---", {
              value: ''
            });
            ref1 = _this.collection.models;
            results = [];
            for (i = 0, len = ref1.length; i < len; i++) {
              who = ref1[i];
              n = who.get('name');
              results.push(option({
                value: who.get('_id')
              }, n.first + ' ' + n.last));
            }
            return results;
          };
        })(this));
        this.$el.html(temp);
        return this;
      }
    });
    clientViewTemplate = Backbone.View.extend({
      el: '#desiredClient',
      collection: Pylon.get('clients'),
      attributes: {
        session: Pylon.get('sessionInfo')
      },
      initialize: function() {
        return this.listenTo(this.collection, 'change', this.render);
      },
      events: {
        'change': function() {
          if (this.$el.val()) {
            this.attributes.session.set('client', this.$el.val());
          } else {
            this.attributes.session.unset('client');
          }
          this.attributes.session.trigger('change');
          return false;
        }
      },
      render: function() {
        this.$el.html(render((function(_this) {
          return function() {
            var i, len, n, ref1, results;
            option("Select ---", {
              value: ''
            });
            ref1 = _this.collection.models;
            results = [];
            for (i = 0, len = ref1.length; i < len; i++) {
              p = ref1[i];
              n = p.get('name');
              results.push(option({
                value: p.get('_id')
              }, n.first + ' ' + n.last));
            }
            return results;
          };
        })(this)));
        return this;
      }
    });
    doneViewTemplate = Backbone.View.extend({
      el: '#done',
      model: Pylon.get('sessionInfo'),
      initialize: function() {
        this.listenTo(this.model, 'change', this.render);
        return this;
      },
      events: {
        'click': function() {
          Pylon.trigger('adminDone');
          Pylon.trigger('renderTest');
          return false;
        }
      },
      render: function() {
        var ref1;
        if ((this.model.get('clinic')) && (this.model.get('clinician')) && (this.model.get('client')) && 'retro2017' === ((ref1 = this.model.get('password')) != null ? ref1.slice(0, 9) : void 0)) {
          this.$el.addClass('button-primary').removeClass('disabled').removeAttr('disabled');
          this.$el.text("Done");
          this.$el.show().fadeTo(500, 1);
        } else {
          this.$el.removeClass('button-primary').addClass('disabled').attr('disabled');
          this.$el.show().fadeTo(100, 0.25);
        }
        return this;
      }
    });
    this.doneView = new doneViewTemplate;
    this.clientView = new clientViewTemplate;
    this.clinicView = new clinicViewTemplate;
    this.clinicianView = new clinicianViewTemplate;
    Pylon.get('clinics').trigger('change');
  };

  adminView.prototype.adminContents = function() {
    return render(function() {
      return div('#adminForm.modal', function() {
        tea.h1("Enter Session Information");
        hr();
        return form(function() {
          div('.row', function() {
            return div('.five.columns', function() {
              label('Clinic');
              return select('#desiredClinic.u-full-width', 'Clinic', '');
            });
          });
          div('.row', function() {
            div('.four.columns', function() {
              label({
                "for": 'desiredClinician'
              }, 'Clinician');
              select('#desiredClinician.u-full-width');
              br();
              label({
                "for": "password"
              }, "Password");
              return input("#password", {
                type: 'password'
              });
            });
            return div('.four.columns', function() {
              label({
                "for": 'desiredClient'
              }, 'Client');
              return select('#desiredClient.u-full-width');
            });
          });
          return div('.row', function() {
            div('.nine.columns', function() {
              return raw("&nbsp;");
            });
            return button('#done.three.columns', {
              disabled: true
            }, "Done");
          });
        });
      });
    });
  };

  adminView.prototype.wireAdmin = function() {
    var model;
    model = Pylon.get('sessionInfo');
    $('#password').keypress((function(_this) {
      return function(node) {
        var ref1;
        if (node.keyCode === 13 && !node.shiftKey) {
          node.preventDefault();
          if ((ref1 = $('#password')) != null ? ref1.val : void 0) {
            model.set('password', $('#password').val());
            return false;
          }
        }
      };
    })(this)).on('blur', (function(_this) {
      return function(node) {
        var ref1;
        if ((ref1 = $('#password')) != null ? ref1.val : void 0) {
          model.set('password', $('#password').val());
          return false;
        }
      };
    })(this));
  };

  return adminView;

})();

exports.adminView = new adminView;



},{"../lib/buglog.coffee":3,"backbone":22,"jquery":29,"teacup":32}],15:[function(require,module,exports){
var $, Backbone, T, V;

Backbone = require('backbone');

$ = require('jquery');

T = require('teacup');


/*
DebugButton = new BV 'debug'
 * initialize with legend and enabled boolean
 * BV sets Pylon with the attribute 'button-name'
 *  NB. BV sets Pylon with event triggers like 'systemEvent:name:legend'
DebugButton.set
  legend: "Show Log"
  enabled: true
 * when DebugButton is pressed, the legend above generates this event
Pylon.on "systemEvent:debug:show-log",() ->
  DebugButton.set legend: "Hide Log"
  $('#footer').show()
  return false

 * when DebugButton is pressed, the legend 'Hide Log' above generates this event
Pylon.on "systemEvent:debug:hide-log", ()->
  DebugButton.set legend: "Show Log"
  $('#footer').hide()
  return false
$('#footer').hide()
assert DebugButton == Pylon.get 'debug-button'
 */

V = Backbone.View.extend({
  tagName: "button",
  initialize: function(model, name, classes1) {
    this.model = model;
    this.name = name;
    this.classes = classes1;
    this.model.on('change:legend', this.render, this);
    this.model.on('change:enabled', this.render, this);
    this.render();
    return this;
  },
  render: function() {
    var m, newVisual, old, visual;
    m = this.model;
    if (m.get('enabled')) {
      visual = T.render((function(_this) {
        return function() {
          return T.button("#" + _this.name + "." + _this.classes + ".button-primary", _this.model.get('legend'));
        };
      })(this));
    } else {
      visual = T.render((function(_this) {
        return function() {
          return T.button("#" + _this.name + "." + _this.classes + ".disabled", {
            disabled: "disabled"
          }, _this.model.get('legend'));
        };
      })(this));
    }
    newVisual = $(visual);
    if ((old = this.$el)) {
      this.setElement(newVisual);
      old.replaceWith(newVisual);
    }
    return this;
  },
  events: {
    click: function() {
      if (this.model.get('enabled')) {
        return Pylon.trigger("systemEvent:" + this.model.get('trigger'));
      }
    }
  }
});

module.exports = Backbone.Model.extend({
  defaults: {
    legend: "disabled",
    enabled: false
  },
  setTrigger: function() {
    var trigger;
    trigger = this.get('legend');
    return this.set('trigger', this.name + ":" + (trigger.replace(/ /g, '-').toLocaleLowerCase()));
  },
  initialize: function(name, classes) {
    this.name = name;
    if (classes == null) {
      classes = "three.columns";
    }
    Pylon.set("button-" + this.name, this);
    this.setTrigger();
    this.on("change:legend", this.setTrigger, this);
    this.view = new V(this, this.name, classes);
    this.view.setElement($("#" + this.name));
    this.on("change:enabled", this.view.render, this.view);
    return this;
  }
});



},{"backbone":22,"jquery":29,"teacup":32}],16:[function(require,module,exports){
var $, Backbone, Teacup, a, body, br, buglog, button, canvas, countDownViewTemplate, div, doctype, form, h1, h2, h3, h4, h5, head, hr, img, implementing, input, introlog, intrologger, label, li, ol, option, p, password, raw, recorderViewTemplate, ref, render, renderable, select, span, table, tag, tbody, td, tea, text, th, thead, tr, ul,
  slice = [].slice;

Backbone = require('backbone');

$ = require('jquery');

Teacup = require('teacup');

buglog = require('../lib/buglog.coffee');

intrologger = (introlog = new buglog("intro")).log;

implementing = function() {
  var classReference, i, j, key, len, mixin, mixins, ref, value;
  mixins = 2 <= arguments.length ? slice.call(arguments, 0, i = arguments.length - 1) : (i = 0, []), classReference = arguments[i++];
  for (j = 0, len = mixins.length; j < len; j++) {
    mixin = mixins[j];
    ref = mixin.prototype;
    for (key in ref) {
      value = ref[key];
      classReference.prototype[key] = value;
    }
  }
  return classReference;
};

tea = new Teacup.Teacup;

ref = tea.tags(), table = ref.table, tr = ref.tr, th = ref.th, thead = ref.thead, tbody = ref.tbody, td = ref.td, ul = ref.ul, li = ref.li, ol = ref.ol, a = ref.a, render = ref.render, input = ref.input, renderable = ref.renderable, raw = ref.raw, div = ref.div, img = ref.img, h1 = ref.h1, h2 = ref.h2, h3 = ref.h3, h4 = ref.h4, h5 = ref.h5, label = ref.label, button = ref.button, p = ref.p, text = ref.text, span = ref.span, canvas = ref.canvas, option = ref.option, select = ref.select, form = ref.form, body = ref.body, head = ref.head, doctype = ref.doctype, hr = ref.hr, br = ref.br, password = ref.password, tag = ref.tag;


/*
a modal dialog that counts in the test, and then counts out the test
count duration is five seconds - window to show count-down
This is intended to record five seconds of padding to the actual test
 */

recorderViewTemplate = Backbone.View.extend({
  el: "#recorder",
  render: function() {},
  initialize: function() {
    Pylon.on('systemEvent:recordCountDown:start', (function(_this) {
      return function(time) {
        return _this.$el.addClass('active');
      };
    })(this));
    return Pylon.on('removeRecorderWindow', (function(_this) {
      return function() {
        return _this.$el.removeClass('active');
      };
    })(this));
  }
});

exports.recorderViewTemplate = new recorderViewTemplate;

countDownViewTemplate = Backbone.View.extend({
  el: "#count-down",
  initialize: function() {
    Pylon.on('systemEvent:recordCountDown:start', (function(_this) {
      return function(time) {
        _this.headline = "Test in Progress";
        _this.response = 'systemEvent:recordCountDown:over';
        return _this.render(time);
      };
    })(this));
    Pylon.on('systemEvent:stopCountDown:start', (function(_this) {
      return function(time) {
        _this.headline = "Test Over";
        _this.$el.addClass('active');
        _this.response = 'systemEvent:stopCountDown:over';
        return _this.render(time);
      };
    })(this));
    return Pylon.on('countDown:continue', (function(_this) {
      return function(time) {
        return _this.render(time);
      };
    })(this));
  },
  render: function(t) {
    debugger;
    var sessionID;
    sessionID = Pylon.get('sessionInfo').get('_id');
    intrologger("show time " + t + " with id of " + sessionID);
    this.$el.html(render((function(_this) {
      return function() {
        return tag("section", function() {
          if (t > 0) {
            h3("#downCount", "count down: " + t);
          } else {
            h3(_this.headline);
          }
          if (sessionID) {
            return p("#recorder-active");
          } else {
            return p("Waiting for host credential for protocol...");
          }
        });
      };
    })(this)));
    if (t === 0) {
      if (sessionID) {
        Pylon.trigger("systemEvent:" + this.response);
        Pylon.trigger(this.response);
      } else {
        Pylon.trigger('systemEvent:recordCountdown:fail');
      }
      return;
    }
    if (t > 0) {
      setTimeout(function() {
        return Pylon.trigger('countDown:continue', t - 1);
      }, 1000);
    }
    return this;
  }
});

exports.countDownView = new countDownViewTemplate;



},{"../lib/buglog.coffee":3,"backbone":22,"jquery":29,"teacup":32}],17:[function(require,module,exports){
var $, Backbone, Pages, RssiView, Teacup, buglog, implementing, viewlog, viewlogger,
  slice = [].slice,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

Backbone = require('backbone');

$ = require('jquery');

Teacup = require('teacup');

buglog = require('../lib/buglog.coffee');

viewlogger = (viewlog = new buglog("view")).log;

RssiView = require('./rssi-view.coffee');

implementing = function() {
  var classReference, i, j, key, len, mixin, mixins, ref, value;
  mixins = 2 <= arguments.length ? slice.call(arguments, 0, i = arguments.length - 1) : (i = 0, []), classReference = arguments[i++];
  for (j = 0, len = mixins.length; j < len; j++) {
    mixin = mixins[j];
    ref = mixin.prototype;
    for (key in ref) {
      value = ref[key];
      classReference.prototype[key] = value;
    }
  }
  return classReference;
};

Pylon.set('adminView', require('./adminView.coffee').adminView);

Pages = (function() {
  var a, body, br, button, canvas, div, doctype, form, h2, h3, h4, h5, head, hr, img, input, label, li, ol, option, p, password, raw, ref, render, renderable, select, span, table, tag, tbody, td, tea, text, th, thead, tr, ul;

  tea = new Teacup.Teacup;

  ref = tea.tags(), table = ref.table, tr = ref.tr, th = ref.th, thead = ref.thead, tbody = ref.tbody, td = ref.td, ul = ref.ul, li = ref.li, ol = ref.ol, a = ref.a, render = ref.render, input = ref.input, renderable = ref.renderable, raw = ref.raw, div = ref.div, img = ref.img, h2 = ref.h2, h3 = ref.h3, h4 = ref.h4, h5 = ref.h5, label = ref.label, button = ref.button, p = ref.p, text = ref.text, span = ref.span, canvas = ref.canvas, option = ref.option, select = ref.select, form = ref.form, body = ref.body, head = ref.head, doctype = ref.doctype, hr = ref.hr, br = ref.br, password = ref.password, tag = ref.tag;

  function Pages() {
    this.renderPage = bind(this.renderPage, this);
    this.wireButtons = bind(this.wireButtons, this);
    this.forceTest = bind(this.forceTest, this);
  }

  Pages.prototype.theBody = renderable(function(buttons, contents1) {
    div('#capture-display.container', function() {
      div('.row', function() {
        img("#logo.five.columns", {
          src: './ui/images/logo-final.png',
          width: '100%'
        });
        div('#dud.one.columns', function() {
          return raw('&nbsp;');
        });
        return img(".five.columns", {
          src: './ui/images/movdatcap.png',
          width: '100%'
        });
      });
      div('#net-info.row', function() {
        div('#net-wifi.six.columns');
        return div('#net-ble.six.columns');
      });
      buttons();
      div('.row', function() {
        div('.two.columns', "Right Tag");
        div('#RightVersion.three.columns', ' ');
        return div('#RightSerialNumber.three.columns', ' ');
      });
      div('.row', function() {
        div('.two.columns', "Left Tag");
        div('#LeftVersion.three.columns', ' ');
        return div('#LeftSerialNumber.three.columns', ' ');
      });
      div('.row', function() {
        div('.three.columns', "Platform UUID");
        div('#platformUUID.five.columns', function() {
          return raw('&nbsp;');
        });
        div('#platformIosVersion.two.columns', function() {
          return raw('&nbsp;');
        });
        return div('#UploadCount.two.columns', "Queued:0");
      });
      raw(contents1());
      div("#scanActiveReport");
      return div('#footer', {
        style: "display:none;"
      }, function() {
        hr();
        return div('#console-log.container');
      });
    });
    div("#recorder.modal", function() {
      div("#count-down");
      return div("#protocol-report", {
        style: "display:none;"
      });
    });
  });

  Pages.prototype.scanBody = renderable(function() {
    hr();
    return table(".u-full-width", function() {
      return thead(function() {
        tr(function() {
          th("Available Sensors");
          th("Gyroscope");
          th("Accelerometer");
          return th("Magnetometer");
        });
        tbody("#sensor-1");
        return tbody("#sensor-2");
      });
    });
  });

  Pages.prototype.sensorView = function(device) {
    var domElement, view;
    domElement = '#' + device.get('rowName');
    view = Backbone.View.extend({
      el: domElement,
      initialize: function(device) {
        this.model = device;
        this.$el.html(this.createRow(device));
        new RssiView(device);
        this.render();
        this.listenTo(device, 'change:deviceStatus', function() {
          return this.$('.status').html(device.get('deviceStatus'));
        });
        this.listenTo(device, 'change:firmwareVersion', function() {
          return this.$('.version').html(device.get('firmwareVersion'));
        });
        this.listenTo(device, 'change:role', this.render);
        this.listenTo(Pylon, 'change:Left', this.render);
        this.listenTo(Pylon, 'change:Right', this.render);
        this.listenTo(Pylon, 'change:Guess', this.render);
        this.listenTo(device, 'change:buttonText', this.render);
        return this.listenTo(device, 'change:buttonClass', this.render);
      },
      createRow: function(device) {
        var accelElement, gyroElement, magElement, rowName, svgElement;
        rowName = device.get('rowName');
        svgElement = '#rssi-' + rowName;
        gyroElement = '#gyro-' + rowName;
        accelElement = '#accel-' + rowName;
        magElement = '#mag-' + rowName;
        return render(function() {
          tr(function() {
            td(function() {
              div('.assignedName', device.get('name'));
              span('.version');
              br();
              return span('.status', "advertising");
            });
            td(function() {
              return button('.connect.needsclick.u-full-width.' + device.get('buttonClass'), {
                onClick: "Pylon.trigger('enableDevice', '" + device.cid + "' )"
              }, "Connect");
            });
            td(function() {
              return button('.disconnect.needsclick.u-full-width.' + device.get('buttonClass'), {
                onClick: "Pylon.trigger('disableDevice', '" + device.cid + "' )"
              }, "Disconnect");
            });
            return td(function() {
              return tea.tag("svg", svgElement, {
                height: "1.5em",
                width: "1.5em"
              });
            });
          });
          return tr(function() {
            td("");
            td(function() {
              return canvas(gyroElement, {
                width: '100',
                height: '100',
                style: 'width=100%'
              });
            });
            td(function() {
              return canvas(accelElement, {
                width: '100',
                height: '100',
                style: 'width=100%'
              });
            });
            return td(function() {
              return canvas(magElement, {
                width: '100',
                height: '100',
                style: 'width=100%'
              });
            });
          });
        });
      },
      render: function() {
        var buttonClass, buttonText;
        device = this.model;
        buttonClass = device.get('buttonClass');
        buttonText = device.get('buttonText');
        if ('Guess' === device.get('role')) {
          this.$('.connect').addClass('disabled').prop('disabled', true).html("Active ?");
        }
        if ('Right' === device.get('role')) {
          this.$('.connect').addClass('disabled').prop('disabled', true).html("Active Right");
          return;
        }
        if ('Left' === device.get('role')) {
          this.$('.connect').addClass('disabled').prop('disabled', true).html("Active Left");
          return;
        }
        this.$('.connect').addClass(buttonClass).removeClass('disabled').prop('disabled', false).html(buttonText);
      }
    });
    return new view(device);
  };

  Pages.prototype.topButtons = renderable(function() {
    div('.row', function() {
      button('#admin.three.columns button-primary', 'Admin');
      button('#action.disabled.three.columns', '');
      button('#calibrate.three.columns.disabled.grayonly', 'Calibrate');
      return button('#debug.three.columns.disabled', '');
    });
    return div('.row', function() {
      div('.three.columns', function() {
        button('#scanDevices.u-full-width.button-primary', 'Scan Devices');
        return label('#StatusData', {
          "for": "upload"
        }, 'No connection');
      });
      div('.three.columns', function() {
        label('#ProtocolSelect', {
          "for": "testID"
        }, 'Which Test?');
        return select("#testID.u-full-width");
      });
      div('.three.columns', function() {
        button('#upload.disabled.u-full-width', 'Upload');
        return label('#LeftStat', {
          "for": "clear"
        }, 'Items:0');
      });
      return div('.three.columns', function() {
        button('#clear.u-full-width.disabled', 'Reset');
        return label('#RightStat', {
          "for": "upload"
        }, 'Items:0');
      });
    });
  });

  Pages.prototype.forceTest = function(color, txt) {
    if (color == null) {
      color = 'violet';
    }
    if (txt == null) {
      txt = 'Must Select Test';
    }
    $('#ProtocolSelect').text(txt).css('color', color);
    Pylon.trigger('renderTest');
    return Pylon.get('sessionInfo').unset('testID', {
      silent: true
    });
  };

  Pages.prototype.wireButtons = function() {
    var model;
    model = Pylon.get('sessionInfo');
    return $('#testID').change((function(_this) {
      return function(node) {
        $('#ProtocolSelect').text('Which Protocol?').css('color', '');
        model.set('testID', $('#testID option:selected').val());
        (Pylon.get('button-admin')).set({
          legend: "Session?",
          enable: false
        });
        model.save(null, {
          success: function(model, response, options) {
            viewlogger("session logged with host");
            return (Pylon.get('button-admin')).set({
              legend: "Log Out",
              enable: true
            });
          },
          error: function(model, response, options) {
            viewlogger("Session save Fail: " + response.statusText);
            return (Pylon.get('button-admin')).set({
              legend: "Log Out",
              enable: true
            });
          }
        });
        return false;
      };
    })(this));
  };

  Pages.prototype.renderPage = function() {
    var bodyHtml, protocolViewTemplate;
    bodyHtml = this.theBody(this.topButtons, Pylon.get('adminView').adminContents);
    $('body').html(bodyHtml);
    this.wireButtons();
    require('./count-up-down.coffee');
    require('./protocol-active.coffee');
    protocolViewTemplate = Backbone.View.extend({
      el: '#testID',
      collection: Pylon.get('protocols'),
      attributes: {
        session: Pylon.get('sessionInfo')
      },
      initialize: function() {
        this.listenTo(this.collection, 'change', this.render);
        Pylon.on("renderTest", (function(_this) {
          return function() {
            return _this.render();
          };
        })(this));
        return this.render();
      },
      events: {
        'change': function() {
          this.attributes.session.set('testID', this.$el.val());
          this.attributes.session.set('captureDate', Date.now());
          return false;
        }
      },
      render: function() {
        viewlogger("Rendering Tests");
        this.$el.html(render((function(_this) {
          return function() {
            var i, len, protocol, ref1, results;
            option('.selected', {
              selected: 'selected',
              value: ''
            }, "Select ---");
            ref1 = _this.collection.models;
            results = [];
            for (i = 0, len = ref1.length; i < len; i++) {
              protocol = ref1[i];
              results.push(option({
                value: protocol.get('name')
              }, protocol.get('name')));
            }
            return results;
          };
        })(this)));
        return this;
      }
    });
    this.protocolView = new protocolViewTemplate;
    Pylon.on('change:Right', (function(_this) {
      return function() {
        var dev, old, statusRightViewTemplate;
        dev = Pylon.get('Right');
        if (!dev) {
          return;
        }
        viewlogger("activating Right");
        if (old = Pylon.get('RightView')) {
          old.clearTimer();
        }
        statusRightViewTemplate = Backbone.View.extend({
          model: dev,
          el: "#RightStat",
          clearTimer: function() {
            return clearInterval(this.timeScanner);
          },
          initialize: function() {
            this.timeScanner = setInterval(this.render.bind(this), 40);
            this.model.set('numReadings', 0);
            return this.listenTo(this.model, 'change', this.render);
          },
          render: function() {
            return this.$el.html("Items: " + this.model.get('numReadings'));
          }
        });
        Pylon.set("RightView", new statusRightViewTemplate);
      };
    })(this));
    Pylon.on('change:Left', (function(_this) {
      return function() {
        var dev, statusLeftViewTemplate;
        dev = Pylon.get('Left');
        if (!dev) {
          return;
        }
        viewlogger("activating Left");
        statusLeftViewTemplate = Backbone.View.extend({
          model: dev,
          el: "#LeftStat",
          clearTimer: function() {
            return clearInterval(this.timeScanner);
          },
          initialize: function() {
            this.timeScanner = setInterval(this.render.bind(this), 40);
            this.model.set('numReadings', 0);
            return this.listenTo(this.model, 'change', this.render);
          },
          render: function() {
            return this.$el.html("Items: " + this.model.get('numReadings'));
          }
        });
        Pylon.set("LeftView", new statusLeftViewTemplate);
      };
    })(this));
    Pylon.get('adminView').wireAdmin();
  };

  Pages.prototype.activateAdminPage = function(buttonSpec) {
    $('#adminForm').addClass('active');
    $('#sensorPage').removeClass('active');
    return Pylon.get('adminView').inspectAdminPage();
  };

  Pages.prototype.activateSensorPage = function(buttonSpec) {
    $('#adminForm').removeClass('active');
    return $('#sensorPage').addClass('active');
  };

  return Pages;

})();

exports.Pages = Pages;



},{"../lib/buglog.coffee":3,"./adminView.coffee":14,"./count-up-down.coffee":16,"./protocol-active.coffee":18,"./rssi-view.coffee":19,"backbone":22,"jquery":29,"teacup":32}],18:[function(require,module,exports){
var $, BV, Backbone, Button, ProtocolReportTemplate, Stopwatch, Teacup, a, body, br, button, canvas, div, doctype, form, h1, h2, h3, h4, h5, head, hr, img, implementing, input, label, li, ol, option, p, password, raw, ref, render, renderable, select, span, table, tag, tbody, td, tea, text, th, thead, tr, ul,
  slice = [].slice;

Backbone = require('backbone');

$ = require('jquery');

Teacup = require('teacup');

BV = require('./button-view.coffee');

implementing = function() {
  var classReference, i, j, key, len, mixin, mixins, ref, value;
  mixins = 2 <= arguments.length ? slice.call(arguments, 0, i = arguments.length - 1) : (i = 0, []), classReference = arguments[i++];
  for (j = 0, len = mixins.length; j < len; j++) {
    mixin = mixins[j];
    ref = mixin.prototype;
    for (key in ref) {
      value = ref[key];
      classReference.prototype[key] = value;
    }
  }
  return classReference;
};

tea = new Teacup.Teacup;

ref = tea.tags(), table = ref.table, tr = ref.tr, th = ref.th, thead = ref.thead, tbody = ref.tbody, td = ref.td, ul = ref.ul, li = ref.li, ol = ref.ol, a = ref.a, render = ref.render, input = ref.input, renderable = ref.renderable, raw = ref.raw, div = ref.div, img = ref.img, h1 = ref.h1, h2 = ref.h2, h3 = ref.h3, h4 = ref.h4, h5 = ref.h5, label = ref.label, button = ref.button, p = ref.p, text = ref.text, span = ref.span, canvas = ref.canvas, option = ref.option, select = ref.select, form = ref.form, body = ref.body, head = ref.head, doctype = ref.doctype, hr = ref.hr, br = ref.br, password = ref.password, tag = ref.tag;

Button = require('./button-view.coffee');

Stopwatch = require('../lib/stopwatch.coffee');

ProtocolReportTemplate = Backbone.View.extend({
  el: "#protocol-report",
  initialize: function() {
    this.goTime = 0;
    this.stopwatch = new Stopwatch(100, true, function(stopwatch) {
      return $('#button-go-time').text(stopwatch.toString());
    });
    Pylon.on('systemEvent:goButton:go', (function(_this) {
      return function() {
        return _this.stopwatch.start();
      };
    })(this));
    Pylon.on('systemEvent:recordCountDown:over', (function(_this) {
      return function() {
        var theTest;
        theTest = Pylon.theProtocol();
        if (!theTest.get('showMilestones')) {
          return;
        }
        _this.$el.addClass('active');
        _this.render();
        _this.$('button').prop({
          disabled: true
        });
        return _this.$('#goButton').prop({
          disabled: false
        });
      };
    })(this));
    Pylon.on('systemEvent:goButton:go', (function(_this) {
      return function(time) {
        return _this.$('button').prop({
          disabled: false
        });
      };
    })(this));
    return Pylon.on('systemEvent:stopCountDown:start', (function(_this) {
      return function(time) {
        _this.stopwatch.stop();
        _this.$el.removeClass('active');
        return _this.$('button').prop({
          disabled: true
        });
      };
    })(this));
  },
  render: function() {
    this.$el.html(render((function(_this) {
      return function() {
        var mileStones, ref1, theTest;
        tea.hr;
        tag("section", function() {
          return h3("#protocol-result", "record these events");
        });
        theTest = Pylon.theProtocol();
        if (theTest.get('showMilestones')) {
          mileStones = (ref1 = theTest.get('mileStones')) != null ? ref1.split(',') : void 0;
          return tea.ul(function() {
            var btn, btnName, i, len, results;
            tea.li("#goList", function() {
              tea.button('#goButton.primary.my1', {
                onClick: "Pylon.trigger('systemEvent:goButton:go')"
              }, "Go");
              tea.span("Total Duration");
              return tea.span('#button-go-time.right');
            });
            results = [];
            for (i = 0, len = mileStones.length; i < len; i++) {
              btn = mileStones[i];
              btnName = btn.replace(/ /g, '-').toLocaleLowerCase();
              results.push(tea.li(function() {
                var bound;
                bound = function(who) {
                  return function() {
                    return $(who).text($('#button-go-time').text());
                  };
                };
                Pylon.on("systemEvent:goList:" + btnName, bound("#milestone-" + btnName));
                tea.button('.primary.mx1', {
                  onClick: "Pylon.trigger('systemEvent:goList:" + btnName + "')"
                }, btn);
                return tea.span("#milestone-" + btnName + ".right");
              }));
            }
            return results;
          });
        }
      };
    })(this)));
    return this;
  }
});

exports.ProtocolReportTemplate = new ProtocolReportTemplate;



},{"../lib/stopwatch.coffee":9,"./button-view.coffee":15,"backbone":22,"jquery":29,"teacup":32}],19:[function(require,module,exports){
var $, Backbone, RssiView, T;

Backbone = require('backbone');

$ = require('jquery');

T = require('teacup');

module.exports = RssiView = Backbone.View.extend({
  initialize: function(device) {
    var clearRssi, domElement, i, ref, rowName, rssiTimer, svgElement, t;
    this.device = device;
    rowName = this.device.get('rowName');
    this.element = $("#" + rowName);
    this.setElement(this.element);
    this.limit = 8;
    svgElement = '#rssi-' + this.device.get('rowName');
    $(svgElement).svg({
      initPath: '',
      settings: {
        height: '100',
        width: '100'
      }
    });
    domElement = $(svgElement).svg('get');
    for (t = i = 0, ref = this.limit; 0 <= ref ? i <= ref : i >= ref; t = 0 <= ref ? ++i : --i) {
      domElement.circle(50, 100 - t * 10, t * 5, {
        id: rowName + "-cir-" + (t * 5),
        fill: "none",
        stroke: "gray"
      });
    }
    this.listenTo(this.device, "change:signalStrength", (function(_this) {
      return function(d) {
        var c, j, ref1, sig, v;
        rowName = _this.device.get('rowName');
        svgElement = '#rssi-' + rowName;
        domElement = $(svgElement).svg('get');
        sig = d.get('signalStrength');
        v = 8;
        if (sig < -90) {
          v = 0;
        } else if (sig < -75) {
          v = 2;
        } else if (sig < -60) {
          v = 4;
        } else if (sig < -50) {
          v = 6;
        } else if (sig < -40) {
          v = 7;
        }
        for (c = j = 0, ref1 = _this.limit; 0 <= ref1 ? j <= ref1 : j >= ref1; c = 0 <= ref1 ? ++j : --j) {
          domElement.change(domElement.getElementById(rowName + "-cir-" + (c * 5)), {
            stroke: c <= v ? "black" : "none"
          });
        }
        return null;
      };
    })(this));
    Pylon.on(this.rowName + ":setRSSI", (function(_this) {
      return function(t) {
        var c, j, ref1;
        rowName = _this.device.get('rowName');
        svgElement = '#rssi-' + rowName;
        domElement = $(svgElement).svg('get');
        for (c = j = 0, ref1 = _this.limit; 0 <= ref1 ? j <= ref1 : j >= ref1; c = 0 <= ref1 ? ++j : --j) {
          domElement.change(domElement.getElementById(rowName + "-cir-" + (c * 5)), {
            stroke: c <= t ? "black" : "none"
          });
        }
        return null;
      };
    })(this));
    clearRssi = (function(_this) {
      return function() {
        var signalStrength;
        signalStrength = _this.device.get('signalStrength');
        if (!(signalStrength < -90)) {
          signalStrength -= 5;
        }
        _this.device.set('signalStrength', signalStrength);
      };
    })(this);
    return rssiTimer = setInterval(clearRssi, 1000);
  }
});



},{"backbone":22,"jquery":29,"teacup":32}],20:[function(require,module,exports){
(function (global){
//     Backbone.js 1.3.3

//     (c) 2010-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(factory) {

  // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
  // We use `self` instead of `window` for `WebWorker` support.
  var root = (typeof self == 'object' && self.self === self && self) ||
            (typeof global == 'object' && global.global === global && global);

  // Set up Backbone appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      root.Backbone = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore'), $;
    try { $ = require('jquery'); } catch (e) {}
    factory(root, exports, _, $);

  // Finally, as a browser global.
  } else {
    root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

})(function(root, Backbone, _, $) {

  // Initial Setup
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create a local reference to a common array method we'll want to use later.
  var slice = Array.prototype.slice;

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '1.3.3';

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = $;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... this will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Proxy Backbone class methods to Underscore functions, wrapping the model's
  // `attributes` object or collection's `models` array behind the scenes.
  //
  // collection.filter(function(model) { return model.get('age') > 10 });
  // collection.each(this.addView);
  //
  // `Function#apply` can be slow so we use the method's arg count, if we know it.
  var addMethod = function(length, method, attribute) {
    switch (length) {
      case 1: return function() {
        return _[method](this[attribute]);
      };
      case 2: return function(value) {
        return _[method](this[attribute], value);
      };
      case 3: return function(iteratee, context) {
        return _[method](this[attribute], cb(iteratee, this), context);
      };
      case 4: return function(iteratee, defaultVal, context) {
        return _[method](this[attribute], cb(iteratee, this), defaultVal, context);
      };
      default: return function() {
        var args = slice.call(arguments);
        args.unshift(this[attribute]);
        return _[method].apply(_, args);
      };
    }
  };
  var addUnderscoreMethods = function(Class, methods, attribute) {
    _.each(methods, function(length, method) {
      if (_[method]) Class.prototype[method] = addMethod(length, method, attribute);
    });
  };

  // Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
  var cb = function(iteratee, instance) {
    if (_.isFunction(iteratee)) return iteratee;
    if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
    if (_.isString(iteratee)) return function(model) { return model.get(iteratee); };
    return iteratee;
  };
  var modelMatcher = function(attrs) {
    var matcher = _.matches(attrs);
    return function(model) {
      return matcher(model.attributes);
    };
  };

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // a custom event channel. You may bind a callback to an event with `on` or
  // remove with `off`; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {};

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Iterates over the standard `event, callback` (as well as the fancy multiple
  // space-separated events `"change blur", callback` and jQuery-style event
  // maps `{event: callback}`).
  var eventsApi = function(iteratee, events, name, callback, opts) {
    var i = 0, names;
    if (name && typeof name === 'object') {
      // Handle event maps.
      if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
      for (names = _.keys(name); i < names.length ; i++) {
        events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
      }
    } else if (name && eventSplitter.test(name)) {
      // Handle space-separated event names by delegating them individually.
      for (names = name.split(eventSplitter); i < names.length; i++) {
        events = iteratee(events, names[i], callback, opts);
      }
    } else {
      // Finally, standard events.
      events = iteratee(events, name, callback, opts);
    }
    return events;
  };

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  Events.on = function(name, callback, context) {
    return internalOn(this, name, callback, context);
  };

  // Guard the `listening` argument from the public API.
  var internalOn = function(obj, name, callback, context, listening) {
    obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
      context: context,
      ctx: obj,
      listening: listening
    });

    if (listening) {
      var listeners = obj._listeners || (obj._listeners = {});
      listeners[listening.id] = listening;
    }

    return obj;
  };

  // Inversion-of-control versions of `on`. Tell *this* object to listen to
  // an event in another object... keeping track of what it's listening to
  // for easier unbinding later.
  Events.listenTo = function(obj, name, callback) {
    if (!obj) return this;
    var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
    var listeningTo = this._listeningTo || (this._listeningTo = {});
    var listening = listeningTo[id];

    // This object is not listening to any other events on `obj` yet.
    // Setup the necessary references to track the listening callbacks.
    if (!listening) {
      var thisId = this._listenId || (this._listenId = _.uniqueId('l'));
      listening = listeningTo[id] = {obj: obj, objId: id, id: thisId, listeningTo: listeningTo, count: 0};
    }

    // Bind callbacks on obj, and keep track of them on listening.
    internalOn(obj, name, callback, this, listening);
    return this;
  };

  // The reducing API that adds a callback to the `events` object.
  var onApi = function(events, name, callback, options) {
    if (callback) {
      var handlers = events[name] || (events[name] = []);
      var context = options.context, ctx = options.ctx, listening = options.listening;
      if (listening) listening.count++;

      handlers.push({callback: callback, context: context, ctx: context || ctx, listening: listening});
    }
    return events;
  };

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  Events.off = function(name, callback, context) {
    if (!this._events) return this;
    this._events = eventsApi(offApi, this._events, name, callback, {
      context: context,
      listeners: this._listeners
    });
    return this;
  };

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  Events.stopListening = function(obj, name, callback) {
    var listeningTo = this._listeningTo;
    if (!listeningTo) return this;

    var ids = obj ? [obj._listenId] : _.keys(listeningTo);

    for (var i = 0; i < ids.length; i++) {
      var listening = listeningTo[ids[i]];

      // If listening doesn't exist, this object is not currently
      // listening to obj. Break out early.
      if (!listening) break;

      listening.obj.off(name, callback, this);
    }

    return this;
  };

  // The reducing API that removes a callback from the `events` object.
  var offApi = function(events, name, callback, options) {
    if (!events) return;

    var i = 0, listening;
    var context = options.context, listeners = options.listeners;

    // Delete all events listeners and "drop" events.
    if (!name && !callback && !context) {
      var ids = _.keys(listeners);
      for (; i < ids.length; i++) {
        listening = listeners[ids[i]];
        delete listeners[listening.id];
        delete listening.listeningTo[listening.objId];
      }
      return;
    }

    var names = name ? [name] : _.keys(events);
    for (; i < names.length; i++) {
      name = names[i];
      var handlers = events[name];

      // Bail out if there are no events stored.
      if (!handlers) break;

      // Replace events if there are any remaining.  Otherwise, clean up.
      var remaining = [];
      for (var j = 0; j < handlers.length; j++) {
        var handler = handlers[j];
        if (
          callback && callback !== handler.callback &&
            callback !== handler.callback._callback ||
              context && context !== handler.context
        ) {
          remaining.push(handler);
        } else {
          listening = handler.listening;
          if (listening && --listening.count === 0) {
            delete listeners[listening.id];
            delete listening.listeningTo[listening.objId];
          }
        }
      }

      // Update tail event if the list has any events.  Otherwise, clean up.
      if (remaining.length) {
        events[name] = remaining;
      } else {
        delete events[name];
      }
    }
    return events;
  };

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, its listener will be removed. If multiple events
  // are passed in using the space-separated syntax, the handler will fire
  // once for each event, not once for a combination of all events.
  Events.once = function(name, callback, context) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.off, this));
    if (typeof name === 'string' && context == null) callback = void 0;
    return this.on(events, callback, context);
  };

  // Inversion-of-control versions of `once`.
  Events.listenToOnce = function(obj, name, callback) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.stopListening, this, obj));
    return this.listenTo(obj, events);
  };

  // Reduces the event callbacks into a map of `{event: onceWrapper}`.
  // `offer` unbinds the `onceWrapper` after it has been called.
  var onceMap = function(map, name, callback, offer) {
    if (callback) {
      var once = map[name] = _.once(function() {
        offer(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
    }
    return map;
  };

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  Events.trigger = function(name) {
    if (!this._events) return this;

    var length = Math.max(0, arguments.length - 1);
    var args = Array(length);
    for (var i = 0; i < length; i++) args[i] = arguments[i + 1];

    eventsApi(triggerApi, this._events, name, void 0, args);
    return this;
  };

  // Handles triggering the appropriate event callbacks.
  var triggerApi = function(objEvents, name, callback, args) {
    if (objEvents) {
      var events = objEvents[name];
      var allEvents = objEvents.all;
      if (events && allEvents) allEvents = allEvents.slice();
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, [name].concat(args));
    }
    return objEvents;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId(this.cidPrefix);
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    var defaults = _.result(this, 'defaults');
    attrs = _.defaults(_.extend({}, defaults, attrs), defaults);
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // The prefix is used to create the client id which is used to identify models locally.
    // You may want to override this if you're experiencing name clashes with model ids.
    cidPrefix: 'c',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Special-cased proxy to underscore's `_.matches` method.
    matches: function(attrs) {
      return !!_.iteratee(attrs, this)(this.attributes);
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function(key, val, options) {
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      var attrs;
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      var unset      = options.unset;
      var silent     = options.silent;
      var changes    = [];
      var changing   = this._changing;
      this._changing = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }

      var current = this.attributes;
      var changed = this.changed;
      var prev    = this._previousAttributes;

      // For each `set` attribute, update or delete the current value.
      for (var attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          changed[attr] = val;
        } else {
          delete changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Update the `id`.
      if (this.idAttribute in attrs) this.id = this.get(this.idAttribute);

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0; i < changes.length; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      var changed = {};
      for (var attr in diff) {
        var val = diff[attr];
        if (_.isEqual(old[attr], val)) continue;
        changed[attr] = val;
      }
      return _.size(changed) ? changed : false;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server, merging the response with the model's
    // local attributes. Any changed attributes will trigger a "change" event.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        if (!model.set(serverAttrs, options)) return false;
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      // Handle both `"key", value` and `{key: value}` -style arguments.
      var attrs;
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true, parse: true}, options);
      var wait = options.wait;

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !wait) {
        if (!this.set(attrs, options)) return false;
      } else if (!this._validate(attrs, options)) {
        return false;
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      var model = this;
      var success = options.success;
      var attributes = this.attributes;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        if (wait) serverAttrs = _.extend({}, attrs, serverAttrs);
        if (serverAttrs && !model.set(serverAttrs, options)) return false;
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      // Set temporary attributes if `{wait: true}` to properly find new ids.
      if (attrs && wait) this.attributes = _.extend({}, attributes, attrs);

      var method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch' && !options.attrs) options.attrs = attrs;
      var xhr = this.sync(method, this, options);

      // Restore attributes.
      this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;
      var wait = options.wait;

      var destroy = function() {
        model.stopListening();
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (wait) destroy();
        if (success) success.call(options.context, model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      var xhr = false;
      if (this.isNew()) {
        _.defer(options.success);
      } else {
        wrapError(this, options);
        xhr = this.sync('delete', this, options);
      }
      if (!wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base;
      var id = this.get(this.idAttribute);
      return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.extend({}, options, {validate: true}));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model, mapped to the
  // number of arguments they take.
  var modelMethods = {keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
      omit: 0, chain: 1, isEmpty: 1};

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  addUnderscoreMethods(Model, modelMethods, 'attributes');

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analogous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Splices `insert` into `array` at index `at`.
  var splice = function(array, insert, at) {
    at = Math.min(Math.max(at, 0), array.length);
    var tail = Array(array.length - at);
    var length = insert.length;
    var i;
    for (i = 0; i < tail.length; i++) tail[i] = array[i + at];
    for (i = 0; i < length; i++) array[i + at] = insert[i];
    for (i = 0; i < tail.length; i++) array[i + length + at] = tail[i];
  };

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model) { return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set. `models` may be Backbone
    // Models or raw JavaScript objects to be converted to Models, or any
    // combination of the two.
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      options = _.extend({}, options);
      var singular = !_.isArray(models);
      models = singular ? [models] : models.slice();
      var removed = this._removeModels(models, options);
      if (!options.silent && removed.length) {
        options.changes = {added: [], merged: [], removed: removed};
        this.trigger('update', this, options);
      }
      return singular ? removed[0] : removed;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      if (models == null) return;

      options = _.extend({}, setOptions, options);
      if (options.parse && !this._isModel(models)) {
        models = this.parse(models, options) || [];
      }

      var singular = !_.isArray(models);
      models = singular ? [models] : models.slice();

      var at = options.at;
      if (at != null) at = +at;
      if (at > this.length) at = this.length;
      if (at < 0) at += this.length + 1;

      var set = [];
      var toAdd = [];
      var toMerge = [];
      var toRemove = [];
      var modelMap = {};

      var add = options.add;
      var merge = options.merge;
      var remove = options.remove;

      var sort = false;
      var sortable = this.comparator && at == null && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      var model, i;
      for (i = 0; i < models.length; i++) {
        model = models[i];

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        var existing = this.get(model);
        if (existing) {
          if (merge && model !== existing) {
            var attrs = this._isModel(model) ? model.attributes : model;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            toMerge.push(existing);
            if (sortable && !sort) sort = existing.hasChanged(sortAttr);
          }
          if (!modelMap[existing.cid]) {
            modelMap[existing.cid] = true;
            set.push(existing);
          }
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(model, options);
          if (model) {
            toAdd.push(model);
            this._addReference(model, options);
            modelMap[model.cid] = true;
            set.push(model);
          }
        }
      }

      // Remove stale models.
      if (remove) {
        for (i = 0; i < this.length; i++) {
          model = this.models[i];
          if (!modelMap[model.cid]) toRemove.push(model);
        }
        if (toRemove.length) this._removeModels(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      var orderChanged = false;
      var replace = !sortable && add && remove;
      if (set.length && replace) {
        orderChanged = this.length !== set.length || _.some(this.models, function(m, index) {
          return m !== set[index];
        });
        this.models.length = 0;
        splice(this.models, set, 0);
        this.length = this.models.length;
      } else if (toAdd.length) {
        if (sortable) sort = true;
        splice(this.models, toAdd, at == null ? this.length : at);
        this.length = this.models.length;
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort/update events.
      if (!options.silent) {
        for (i = 0; i < toAdd.length; i++) {
          if (at != null) options.index = at + i;
          model = toAdd[i];
          model.trigger('add', model, this, options);
        }
        if (sort || orderChanged) this.trigger('sort', this, options);
        if (toAdd.length || toRemove.length || toMerge.length) {
          options.changes = {
            added: toAdd,
            removed: toRemove,
            merged: toMerge
          };
          this.trigger('update', this, options);
        }
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options = options ? _.clone(options) : {};
      for (var i = 0; i < this.models.length; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      return this.remove(model, options);
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      return this.remove(model, options);
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id, cid, model object with id or cid
    // properties, or an attributes object that is transformed through modelId.
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj] ||
        this._byId[this.modelId(obj.attributes || obj)] ||
        obj.cid && this._byId[obj.cid];
    },

    // Returns `true` if the model is in the collection.
    has: function(obj) {
      return this.get(obj) != null;
    },

    // Get the model at the given index.
    at: function(index) {
      if (index < 0) index += this.length;
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      return this[first ? 'find' : 'filter'](attrs);
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      var comparator = this.comparator;
      if (!comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      var length = comparator.length;
      if (_.isFunction(comparator)) comparator = _.bind(comparator, this);

      // Run sort based on type of `comparator`.
      if (length === 1 || _.isString(comparator)) {
        this.models = this.sortBy(comparator);
      } else {
        this.models.sort(comparator);
      }
      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return this.map(attr + '');
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success.call(options.context, collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      var wait = options.wait;
      model = this._prepareModel(model, options);
      if (!model) return false;
      if (!wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(m, resp, callbackOpts) {
        if (wait) collection.add(m, callbackOpts);
        if (success) success.call(callbackOpts.context, m, resp, callbackOpts);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models, {
        model: this.model,
        comparator: this.comparator
      });
    },

    // Define how to uniquely identify models in the collection.
    modelId: function(attrs) {
      return attrs[this.model.prototype.idAttribute || 'id'];
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (this._isModel(attrs)) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method called by both remove and set.
    _removeModels: function(models, options) {
      var removed = [];
      for (var i = 0; i < models.length; i++) {
        var model = this.get(models[i]);
        if (!model) continue;

        var index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;

        // Remove references before triggering 'remove' event to prevent an
        // infinite loop. #3693
        delete this._byId[model.cid];
        var id = this.modelId(model.attributes);
        if (id != null) delete this._byId[id];

        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }

        removed.push(model);
        this._removeReference(model, options);
      }
      return removed;
    },

    // Method for checking whether an object should be considered a model for
    // the purposes of adding to the collection.
    _isModel: function(model) {
      return model instanceof Model;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      var id = this.modelId(model.attributes);
      if (id != null) this._byId[id] = model;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model, options) {
      delete this._byId[model.cid];
      var id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id];
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if (model) {
        if ((event === 'add' || event === 'remove') && collection !== this) return;
        if (event === 'destroy') this.remove(model, options);
        if (event === 'change') {
          var prevId = this.modelId(model.previousAttributes());
          var id = this.modelId(model.attributes);
          if (prevId !== id) {
            if (prevId != null) delete this._byId[prevId];
            if (id != null) this._byId[id] = model;
          }
        }
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var collectionMethods = {forEach: 3, each: 3, map: 3, collect: 3, reduce: 0,
      foldl: 0, inject: 0, reduceRight: 0, foldr: 0, find: 3, detect: 3, filter: 3,
      select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 3, includes: 3,
      contains: 3, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
      head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
      without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
      isEmpty: 1, chain: 1, sample: 3, partition: 3, groupBy: 3, countBy: 3,
      sortBy: 3, indexBy: 3, findIndex: 3, findLastIndex: 3};

  // Mix in each Underscore method as a proxy to `Collection#models`.
  addUnderscoreMethods(Collection, collectionMethods, 'models');

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be set as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this._removeElement();
      this.stopListening();
      return this;
    },

    // Remove this view's element from the document and all event listeners
    // attached to it. Exposed for subclasses using an alternative DOM
    // manipulation API.
    _removeElement: function() {
      this.$el.remove();
    },

    // Change the view's element (`this.el` property) and re-delegate the
    // view's events on the new element.
    setElement: function(element) {
      this.undelegateEvents();
      this._setElement(element);
      this.delegateEvents();
      return this;
    },

    // Creates the `this.el` and `this.$el` references for this view using the
    // given `el`. `el` can be a CSS selector or an HTML string, a jQuery
    // context or an element. Subclasses can override this to utilize an
    // alternative DOM manipulation API and are only required to set the
    // `this.el` property.
    _setElement: function(el) {
      this.$el = el instanceof Backbone.$ ? el : Backbone.$(el);
      this.el = this.$el[0];
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    delegateEvents: function(events) {
      events || (events = _.result(this, 'events'));
      if (!events) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[method];
        if (!method) continue;
        var match = key.match(delegateEventSplitter);
        this.delegate(match[1], match[2], _.bind(method, this));
      }
      return this;
    },

    // Add a single event listener to the view's element (or a child element
    // using `selector`). This only works for delegate-able events: not `focus`,
    // `blur`, and not `change`, `submit`, and `reset` in Internet Explorer.
    delegate: function(eventName, selector, listener) {
      this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Clears all callbacks previously bound to the view by `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      if (this.$el) this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // A finer-grained `undelegateEvents` for removing a single delegated event.
    // `selector` and `listener` are both optional.
    undelegate: function(eventName, selector, listener) {
      this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Produces a DOM element to be assigned to your view. Exposed for
    // subclasses using an alternative DOM manipulation API.
    _createElement: function(tagName) {
      return document.createElement(tagName);
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        this.setElement(this._createElement(_.result(this, 'tagName')));
        this._setAttributes(attrs);
      } else {
        this.setElement(_.result(this, 'el'));
      }
    },

    // Set attributes from a hash on this view's element.  Exposed for
    // subclasses using an alternative DOM manipulation API.
    _setAttributes: function(attributes) {
      this.$el.attr(attributes);
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // Pass along `textStatus` and `errorThrown` from jQuery.
    var error = options.error;
    options.error = function(xhr, textStatus, errorThrown) {
      options.textStatus = textStatus;
      options.errorThrown = errorThrown;
      if (error) error.call(options.context, xhr, textStatus, errorThrown);
    };

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch': 'PATCH',
    'delete': 'DELETE',
    'read': 'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        if (router.execute(callback, args, name) !== false) {
          router.trigger.apply(router, ['route:' + name].concat(args));
          router.trigger('route', name, args);
          Backbone.history.trigger('route', router, name, args);
        }
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    execute: function(callback, args, name) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    this.checkUrl = _.bind(this.checkUrl, this);

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Are we at the app root?
    atRoot: function() {
      var path = this.location.pathname.replace(/[^\/]$/, '$&/');
      return path === this.root && !this.getSearch();
    },

    // Does the pathname match the root?
    matchRoot: function() {
      var path = this.decodeFragment(this.location.pathname);
      var rootPath = path.slice(0, this.root.length - 1) + '/';
      return rootPath === this.root;
    },

    // Unicode characters in `location.pathname` are percent encoded so they're
    // decoded for comparison. `%25` should not be decoded since it may be part
    // of an encoded parameter.
    decodeFragment: function(fragment) {
      return decodeURI(fragment.replace(/%25/g, '%2525'));
    },

    // In IE6, the hash fragment and search params are incorrect if the
    // fragment contains `?`.
    getSearch: function() {
      var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
      return match ? match[0] : '';
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the pathname and search params, without the root.
    getPath: function() {
      var path = this.decodeFragment(
        this.location.pathname + this.getSearch()
      ).slice(this.root.length - 1);
      return path.charAt(0) === '/' ? path.slice(1) : path;
    },

    // Get the cross-browser normalized URL fragment from the path or hash.
    getFragment: function(fragment) {
      if (fragment == null) {
        if (this._usePushState || !this._wantsHashChange) {
          fragment = this.getPath();
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error('Backbone.history has already been started');
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._hasHashChange   = 'onhashchange' in window && (document.documentMode === void 0 || document.documentMode > 7);
      this._useHashChange   = this._wantsHashChange && this._hasHashChange;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.history && this.history.pushState);
      this._usePushState    = this._wantsPushState && this._hasPushState;
      this.fragment         = this.getFragment();

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          var rootPath = this.root.slice(0, -1) || '/';
          this.location.replace(rootPath + '#' + this.getPath());
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot()) {
          this.navigate(this.getHash(), {replace: true});
        }

      }

      // Proxy an iframe to handle location events if the browser doesn't
      // support the `hashchange` event, HTML5 history, or the user wants
      // `hashChange` but not `pushState`.
      if (!this._hasHashChange && this._wantsHashChange && !this._usePushState) {
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'javascript:0';
        this.iframe.style.display = 'none';
        this.iframe.tabIndex = -1;
        var body = document.body;
        // Using `appendChild` will throw on IE < 9 if the document is not ready.
        var iWindow = body.insertBefore(this.iframe, body.firstChild).contentWindow;
        iWindow.document.open();
        iWindow.document.close();
        iWindow.location.hash = '#' + this.fragment;
      }

      // Add a cross-platform `addEventListener` shim for older browsers.
      var addEventListener = window.addEventListener || function(eventName, listener) {
        return attachEvent('on' + eventName, listener);
      };

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._usePushState) {
        addEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        addEventListener('hashchange', this.checkUrl, false);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      // Add a cross-platform `removeEventListener` shim for older browsers.
      var removeEventListener = window.removeEventListener || function(eventName, listener) {
        return detachEvent('on' + eventName, listener);
      };

      // Remove window listeners.
      if (this._usePushState) {
        removeEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        removeEventListener('hashchange', this.checkUrl, false);
      }

      // Clean up the iframe if necessary.
      if (this.iframe) {
        document.body.removeChild(this.iframe);
        this.iframe = null;
      }

      // Some environments will throw when clearing an undefined interval.
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();

      // If the user pressed the back button, the iframe's hash will have
      // changed and we should use that for comparison.
      if (current === this.fragment && this.iframe) {
        current = this.getHash(this.iframe.contentWindow);
      }

      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      // If the root doesn't match, no routes can match either.
      if (!this.matchRoot()) return false;
      fragment = this.fragment = this.getFragment(fragment);
      return _.some(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};

      // Normalize the fragment.
      fragment = this.getFragment(fragment || '');

      // Don't include a trailing slash on the root.
      var rootPath = this.root;
      if (fragment === '' || fragment.charAt(0) === '?') {
        rootPath = rootPath.slice(0, -1) || '/';
      }
      var url = rootPath + fragment;

      // Strip the hash and decode for matching.
      fragment = this.decodeFragment(fragment.replace(pathStripper, ''));

      if (this.fragment === fragment) return;
      this.fragment = fragment;

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._usePushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && fragment !== this.getHash(this.iframe.contentWindow)) {
          var iWindow = this.iframe.contentWindow;

          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if (!options.replace) {
            iWindow.document.open();
            iWindow.document.close();
          }

          this._updateHash(iWindow.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function and add the prototype properties.
    child.prototype = _.create(parent.prototype, protoProps);
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error.call(options.context, model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"jquery":29,"underscore":21}],21:[function(require,module,exports){
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],22:[function(require,module,exports){
arguments[4][20][0].apply(exports,arguments)
},{"dup":20,"jquery":29,"underscore":23}],23:[function(require,module,exports){
arguments[4][21][0].apply(exports,arguments)
},{"dup":21}],24:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],25:[function(require,module,exports){
/*! Case - v1.4.2 - 2016-11-11
* Copyright (c) 2016 Nathan Bubna; Licensed MIT, GPL */
(function() {
    "use strict";
    var unicodes = function(s, prefix) {
        prefix = prefix || '';
        return s.replace(/(^|-)/g, '$1\\u'+prefix).replace(/,/g, '\\u'+prefix);
    },
    basicSymbols = unicodes('20-26,28-2F,3A-40,5B-60,7B-7E,A0-BF,D7,F7', '00'),
    baseLowerCase = 'a-z'+unicodes('DF-F6,F8-FF', '00'),
    baseUpperCase = 'A-Z'+unicodes('C0-D6,D8-DE', '00'),
    improperInTitle = 'A|An|And|As|At|But|By|En|For|If|In|Of|On|Or|The|To|Vs?\\.?|Via',
    regexps = function(symbols, lowers, uppers, impropers) {
        symbols = symbols || basicSymbols;
        lowers = lowers || baseLowerCase;
        uppers = uppers || baseUpperCase;
        impropers = impropers || improperInTitle;
        return {
            capitalize: new RegExp('(^|['+symbols+'])(['+lowers+'])', 'g'),
            pascal: new RegExp('(^|['+symbols+'])+(['+lowers+uppers+'])', 'g'),
            fill: new RegExp('['+symbols+']+(.|$)','g'),
            sentence: new RegExp('(^\\s*|[\\?\\!\\.]+"?\\s+"?|,\\s+")(['+lowers+'])', 'g'),
            improper: new RegExp('\\b('+impropers+')\\b', 'g'),
            relax: new RegExp('([^'+uppers+'])(['+uppers+']*)(['+uppers+'])(?=['+lowers+']|$)', 'g'),
            upper: new RegExp('^[^'+lowers+']+$'),
            hole: /[^\s]\s[^\s]/,
            apostrophe: /'/g,
            room: new RegExp('['+symbols+']')
        };
    },
    re = regexps(),
    _ = {
        re: re,
        unicodes: unicodes,
        regexps: regexps,
        types: [],
        up: String.prototype.toUpperCase,
        low: String.prototype.toLowerCase,
        cap: function(s) {
            return _.up.call(s.charAt(0))+s.slice(1);
        },
        decap: function(s) {
            return _.low.call(s.charAt(0))+s.slice(1);
        },
        deapostrophe: function(s) {
            return s.replace(re.apostrophe, '');
        },
        fill: function(s, fill) {
            return !s || fill == null ? s : s.replace(re.fill, function(m, next) {
                return next ? fill + next : '';
            });
        },
        prep: function(s, fill, pascal, upper) {
            if (!s){ return s || ''; }
            if (!upper && re.upper.test(s)) {
                s = _.low.call(s);
            }
            if (!fill && !re.hole.test(s)) {
                var holey = _.fill(s, ' ');
                if (re.hole.test(holey)) {
                    s = holey;
                }
            }
            if (!pascal && !re.room.test(s)) {
                s = s.replace(re.relax, _.relax);
            }
            return s;
        },
        relax: function(m, before, acronym, caps) {
            return before + ' ' + (acronym ? acronym+' ' : '') + caps;
        }
    },
    Case = {
        _: _,
        of: function(s) {
            for (var i=0,m=_.types.length; i<m; i++) {
                if (Case[_.types[i]](s) === s){ return _.types[i]; }
            }
        },
        flip: function(s) {
            return s.replace(/\w/g, function(l) {
                return (l == _.up.call(l) ? _.low : _.up).call(l);
            });
        },
        random: function(s) {
            return s.replace(/\w/g, function(l) {
                return (Math.round(Math.random()) ? _.up : _.low).call(l);
            });
        },
        type: function(type, fn) {
            Case[type] = fn;
            _.types.push(type);
        }
    },
    types = {
        lower: function(s, fill) {
            return _.fill(_.low.call(_.prep(s, fill)), fill);
        },
        snake: function(s) {
            return _.deapostrophe(Case.lower(s, '_'));
        },
        constant: function(s) {
            return _.deapostrophe(Case.upper(s, '_'));
        },
        camel: function(s ) {
            return _.decap(Case.pascal(s));
        },
        kebab: function(s) {
            return _.deapostrophe(Case.lower(s, '-'));
        },
        upper: function(s, fill) {
            return _.fill(_.up.call(_.prep(s, fill, false, true)), fill);
        },
        capital: function(s, fill) {
            return _.fill(_.prep(s).replace(re.capitalize, function(m, border, letter) {
                return border+_.up.call(letter);
            }), fill);
        },
        pascal: function(s) {
            return _.deapostrophe(_.fill(_.prep(s, false, true).replace(re.pascal, function(m, border, letter) {
                return _.up.call(letter);
            }), ''));
        },
        title: function(s) {
            return Case.capital(s).replace(re.improper, function(small, p, i, s) {
                return i > 0 && i < s.lastIndexOf(' ') ? _.low.call(small) : small;
            });
        },
        sentence: function(s, names) {
            s = Case.lower(s).replace(re.sentence, function(m, prelude, letter) {
                return prelude + _.up.call(letter);
            });
            if (names) {
                names.forEach(function(name) {
                    s = s.replace(new RegExp('\\b'+Case.lower(name)+'\\b', "g"), _.cap);
                });
            }
            return s;
        }
    };
    
    // TODO: Remove "squish" in a future breaking release.
    types.squish = types.pascal;

    for (var type in types) {
        Case.type(type, types[type]);
    }
    // export Case (AMD, commonjs, or global)
    var define = typeof define === "function" ? define : function(){};
    define(typeof module === "object" && module.exports ? module.exports = Case : this.Case = Case);

}).call(this);

},{}],26:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000
var m = s * 60
var h = m * 60
var d = h * 24
var y = d * 365.25

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function (val, options) {
  options = options || {}
  var type = typeof val
  if (type === 'string' && val.length > 0) {
    return parse(val)
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ?
			fmtLong(val) :
			fmtShort(val)
  }
  throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(val))
}

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str)
  if (str.length > 10000) {
    return
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str)
  if (!match) {
    return
  }
  var n = parseFloat(match[1])
  var type = (match[2] || 'ms').toLowerCase()
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y
    case 'days':
    case 'day':
    case 'd':
      return n * d
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n
    default:
      return undefined
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd'
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h'
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm'
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's'
  }
  return ms + 'ms'
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms'
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name
  }
  return Math.ceil(ms / n) + ' ' + name + 's'
}

},{}],27:[function(require,module,exports){
(function (process){
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window && typeof window.process !== 'undefined' && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document && 'WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window && window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}

}).call(this,require('_process'))
},{"./debug":28,"_process":24}],28:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":26}],29:[function(require,module,exports){
/*eslint-disable no-unused-vars*/
/*!
 * jQuery JavaScript Library v3.1.0
 * https://jquery.com/
 *
 * Includes Sizzle.js
 * https://sizzlejs.com/
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2016-07-07T21:44Z
 */
( function( global, factory ) {

	"use strict";

	if ( typeof module === "object" && typeof module.exports === "object" ) {

		// For CommonJS and CommonJS-like environments where a proper `window`
		// is present, execute the factory and get jQuery.
		// For environments that do not have a `window` with a `document`
		// (such as Node.js), expose a factory as module.exports.
		// This accentuates the need for the creation of a real `window`.
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
} )( typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Edge <= 12 - 13+, Firefox <=18 - 45+, IE 10 - 11, Safari 5.1 - 9+, iOS 6 - 9.1
// throw exceptions when non-strict code (e.g., ASP.NET 4.5) accesses strict mode
// arguments.callee.caller (trac-13335). But as of jQuery 3.0 (2016), strict mode should be common
// enough that all such attempts are guarded in a try block.
"use strict";

var arr = [];

var document = window.document;

var getProto = Object.getPrototypeOf;

var slice = arr.slice;

var concat = arr.concat;

var push = arr.push;

var indexOf = arr.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var fnToString = hasOwn.toString;

var ObjectFunctionString = fnToString.call( Object );

var support = {};



	function DOMEval( code, doc ) {
		doc = doc || document;

		var script = doc.createElement( "script" );

		script.text = code;
		doc.head.appendChild( script ).parentNode.removeChild( script );
	}
/* global Symbol */
// Defining this global in .eslintrc would create a danger of using the global
// unguarded in another place, it seems safer to define global only for this module



var
	version = "3.1.0",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {

		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android <=4.0 only
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,

	// Matches dashed string for camelizing
	rmsPrefix = /^-ms-/,
	rdashAlpha = /-([a-z])/g,

	// Used by jQuery.camelCase as callback to replace()
	fcamelCase = function( all, letter ) {
		return letter.toUpperCase();
	};

jQuery.fn = jQuery.prototype = {

	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {
		return num != null ?

			// Return just the one element from the set
			( num < 0 ? this[ num + this.length ] : this[ num ] ) :

			// Return all the elements in a clean array
			slice.call( this );
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	each: function( callback ) {
		return jQuery.each( this, callback );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map( this, function( elem, i ) {
			return callback.call( elem, i, elem );
		} ) );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor();
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: arr.sort,
	splice: arr.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[ 0 ] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// Skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !jQuery.isFunction( target ) ) {
		target = {};
	}

	// Extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {

		// Only deal with non-null/undefined values
		if ( ( options = arguments[ i ] ) != null ) {

			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
					( copyIsArray = jQuery.isArray( copy ) ) ) ) {

					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && jQuery.isArray( src ) ? src : [];

					} else {
						clone = src && jQuery.isPlainObject( src ) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend( {

	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	isFunction: function( obj ) {
		return jQuery.type( obj ) === "function";
	},

	isArray: Array.isArray,

	isWindow: function( obj ) {
		return obj != null && obj === obj.window;
	},

	isNumeric: function( obj ) {

		// As of jQuery 3.0, isNumeric is limited to
		// strings and numbers (primitives or objects)
		// that can be coerced to finite numbers (gh-2662)
		var type = jQuery.type( obj );
		return ( type === "number" || type === "string" ) &&

			// parseFloat NaNs numeric-cast false positives ("")
			// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
			// subtraction forces infinities to NaN
			!isNaN( obj - parseFloat( obj ) );
	},

	isPlainObject: function( obj ) {
		var proto, Ctor;

		// Detect obvious negatives
		// Use toString instead of jQuery.type to catch host objects
		if ( !obj || toString.call( obj ) !== "[object Object]" ) {
			return false;
		}

		proto = getProto( obj );

		// Objects with no prototype (e.g., `Object.create( null )`) are plain
		if ( !proto ) {
			return true;
		}

		// Objects with prototype are plain iff they were constructed by a global Object function
		Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
		return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
	},

	isEmptyObject: function( obj ) {

		/* eslint-disable no-unused-vars */
		// See https://github.com/eslint/eslint/issues/6125
		var name;

		for ( name in obj ) {
			return false;
		}
		return true;
	},

	type: function( obj ) {
		if ( obj == null ) {
			return obj + "";
		}

		// Support: Android <=2.3 only (functionish RegExp)
		return typeof obj === "object" || typeof obj === "function" ?
			class2type[ toString.call( obj ) ] || "object" :
			typeof obj;
	},

	// Evaluates a script in a global context
	globalEval: function( code ) {
		DOMEval( code );
	},

	// Convert dashed to camelCase; used by the css and data modules
	// Support: IE <=9 - 11, Edge 12 - 13
	// Microsoft forgot to hump their vendor prefix (#9572)
	camelCase: function( string ) {
		return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
	},

	nodeName: function( elem, name ) {
		return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
	},

	each: function( obj, callback ) {
		var length, i = 0;

		if ( isArrayLike( obj ) ) {
			length = obj.length;
			for ( ; i < length; i++ ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		} else {
			for ( i in obj ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		}

		return obj;
	},

	// Support: Android <=4.0 only
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArrayLike( Object( arr ) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		return arr == null ? -1 : indexOf.call( arr, elem, i );
	},

	// Support: Android <=4.0 only, PhantomJS 1 only
	// push.apply(_, arraylike) throws on ancient WebKit
	merge: function( first, second ) {
		var len = +second.length,
			j = 0,
			i = first.length;

		for ( ; j < len; j++ ) {
			first[ i++ ] = second[ j ];
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, invert ) {
		var callbackInverse,
			matches = [],
			i = 0,
			length = elems.length,
			callbackExpect = !invert;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( ; i < length; i++ ) {
			callbackInverse = !callback( elems[ i ], i );
			if ( callbackInverse !== callbackExpect ) {
				matches.push( elems[ i ] );
			}
		}

		return matches;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var length, value,
			i = 0,
			ret = [];

		// Go through the array, translating each of the items to their new values
		if ( isArrayLike( elems ) ) {
			length = elems.length;
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}

		// Go through every key on the object,
		} else {
			for ( i in elems ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}
		}

		// Flatten any nested arrays
		return concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// Bind a function to a context, optionally partially applying any
	// arguments.
	proxy: function( fn, context ) {
		var tmp, args, proxy;

		if ( typeof context === "string" ) {
			tmp = fn[ context ];
			context = fn;
			fn = tmp;
		}

		// Quick check to determine if target is callable, in the spec
		// this throws a TypeError, but we will just return undefined.
		if ( !jQuery.isFunction( fn ) ) {
			return undefined;
		}

		// Simulated bind
		args = slice.call( arguments, 2 );
		proxy = function() {
			return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
		};

		// Set the guid of unique handler to the same of original handler, so it can be removed
		proxy.guid = fn.guid = fn.guid || jQuery.guid++;

		return proxy;
	},

	now: Date.now,

	// jQuery.support is not used in Core but other projects attach their
	// properties to it so it needs to exist.
	support: support
} );

if ( typeof Symbol === "function" ) {
	jQuery.fn[ Symbol.iterator ] = arr[ Symbol.iterator ];
}

// Populate the class2type map
jQuery.each( "Boolean Number String Function Array Date RegExp Object Error Symbol".split( " " ),
function( i, name ) {
	class2type[ "[object " + name + "]" ] = name.toLowerCase();
} );

function isArrayLike( obj ) {

	// Support: real iOS 8.2 only (not reproducible in simulator)
	// `in` check used to prevent JIT error (gh-2145)
	// hasOwn isn't used here due to false negatives
	// regarding Nodelist length in IE
	var length = !!obj && "length" in obj && obj.length,
		type = jQuery.type( obj );

	if ( type === "function" || jQuery.isWindow( obj ) ) {
		return false;
	}

	return type === "array" || length === 0 ||
		typeof length === "number" && length > 0 && ( length - 1 ) in obj;
}
var Sizzle =
/*!
 * Sizzle CSS Selector Engine v2.3.0
 * https://sizzlejs.com/
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2016-01-04
 */
(function( window ) {

var i,
	support,
	Expr,
	getText,
	isXML,
	tokenize,
	compile,
	select,
	outermostContext,
	sortInput,
	hasDuplicate,

	// Local document vars
	setDocument,
	document,
	docElem,
	documentIsHTML,
	rbuggyQSA,
	rbuggyMatches,
	matches,
	contains,

	// Instance-specific data
	expando = "sizzle" + 1 * new Date(),
	preferredDoc = window.document,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	// Instance methods
	hasOwn = ({}).hasOwnProperty,
	arr = [],
	pop = arr.pop,
	push_native = arr.push,
	push = arr.push,
	slice = arr.slice,
	// Use a stripped-down indexOf as it's faster than native
	// https://jsperf.com/thor-indexof-vs-for/5
	indexOf = function( list, elem ) {
		var i = 0,
			len = list.length;
		for ( ; i < len; i++ ) {
			if ( list[i] === elem ) {
				return i;
			}
		}
		return -1;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",

	// http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
	identifier = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+",

	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +
		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +
		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
		"*\\]",

	pseudos = ":(" + identifier + ")(?:\\((" +
		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rwhitespace = new RegExp( whitespace + "+", "g" ),
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),

	rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		"ID": new RegExp( "^#(" + identifier + ")" ),
		"CLASS": new RegExp( "^\\.(" + identifier + ")" ),
		"TAG": new RegExp( "^(" + identifier + "|[*])" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		"needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
			whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	rnative = /^[^{]+\{\s*\[native \w/,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,

	// CSS escapes
	// http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
	funescape = function( _, escaped, escapedWhitespace ) {
		var high = "0x" + escaped - 0x10000;
		// NaN means non-codepoint
		// Support: Firefox<24
		// Workaround erroneous numeric interpretation of +"0x"
		return high !== high || escapedWhitespace ?
			escaped :
			high < 0 ?
				// BMP codepoint
				String.fromCharCode( high + 0x10000 ) :
				// Supplemental Plane codepoint (surrogate pair)
				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	},

	// CSS string/identifier serialization
	// https://drafts.csswg.org/cssom/#common-serializing-idioms
	rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\x80-\uFFFF\w-]/g,
	fcssescape = function( ch, asCodePoint ) {
		if ( asCodePoint ) {

			// U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
			if ( ch === "\0" ) {
				return "\uFFFD";
			}

			// Control characters and (dependent upon position) numbers get escaped as code points
			return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
		}

		// Other potentially-special ASCII characters get backslash-escaped
		return "\\" + ch;
	},

	// Used for iframes
	// See setDocument()
	// Removing the function wrapper causes a "Permission Denied"
	// error in IE
	unloadHandler = function() {
		setDocument();
	},

	disabledAncestor = addCombinator(
		function( elem ) {
			return elem.disabled === true;
		},
		{ dir: "parentNode", next: "legend" }
	);

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		(arr = slice.call( preferredDoc.childNodes )),
		preferredDoc.childNodes
	);
	// Support: Android<4.0
	// Detect silently failing push.apply
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = { apply: arr.length ?

		// Leverage slice if possible
		function( target, els ) {
			push_native.apply( target, slice.call(els) );
		} :

		// Support: IE<9
		// Otherwise append directly
		function( target, els ) {
			var j = target.length,
				i = 0;
			// Can't trust NodeList.length
			while ( (target[j++] = els[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function Sizzle( selector, context, results, seed ) {
	var m, i, elem, nid, match, groups, newSelector,
		newContext = context && context.ownerDocument,

		// nodeType defaults to 9, since context defaults to document
		nodeType = context ? context.nodeType : 9;

	results = results || [];

	// Return early from calls with invalid selector or context
	if ( typeof selector !== "string" || !selector ||
		nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

		return results;
	}

	// Try to shortcut find operations (as opposed to filters) in HTML documents
	if ( !seed ) {

		if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
			setDocument( context );
		}
		context = context || document;

		if ( documentIsHTML ) {

			// If the selector is sufficiently simple, try using a "get*By*" DOM method
			// (excepting DocumentFragment context, where the methods don't exist)
			if ( nodeType !== 11 && (match = rquickExpr.exec( selector )) ) {

				// ID selector
				if ( (m = match[1]) ) {

					// Document context
					if ( nodeType === 9 ) {
						if ( (elem = context.getElementById( m )) ) {

							// Support: IE, Opera, Webkit
							// TODO: identify versions
							// getElementById can match elements by name instead of ID
							if ( elem.id === m ) {
								results.push( elem );
								return results;
							}
						} else {
							return results;
						}

					// Element context
					} else {

						// Support: IE, Opera, Webkit
						// TODO: identify versions
						// getElementById can match elements by name instead of ID
						if ( newContext && (elem = newContext.getElementById( m )) &&
							contains( context, elem ) &&
							elem.id === m ) {

							results.push( elem );
							return results;
						}
					}

				// Type selector
				} else if ( match[2] ) {
					push.apply( results, context.getElementsByTagName( selector ) );
					return results;

				// Class selector
				} else if ( (m = match[3]) && support.getElementsByClassName &&
					context.getElementsByClassName ) {

					push.apply( results, context.getElementsByClassName( m ) );
					return results;
				}
			}

			// Take advantage of querySelectorAll
			if ( support.qsa &&
				!compilerCache[ selector + " " ] &&
				(!rbuggyQSA || !rbuggyQSA.test( selector )) ) {

				if ( nodeType !== 1 ) {
					newContext = context;
					newSelector = selector;

				// qSA looks outside Element context, which is not what we want
				// Thanks to Andrew Dupont for this workaround technique
				// Support: IE <=8
				// Exclude object elements
				} else if ( context.nodeName.toLowerCase() !== "object" ) {

					// Capture the context ID, setting it first if necessary
					if ( (nid = context.getAttribute( "id" )) ) {
						nid = nid.replace( rcssescape, fcssescape );
					} else {
						context.setAttribute( "id", (nid = expando) );
					}

					// Prefix every selector in the list
					groups = tokenize( selector );
					i = groups.length;
					while ( i-- ) {
						groups[i] = "#" + nid + " " + toSelector( groups[i] );
					}
					newSelector = groups.join( "," );

					// Expand context for sibling selectors
					newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
						context;
				}

				if ( newSelector ) {
					try {
						push.apply( results,
							newContext.querySelectorAll( newSelector )
						);
						return results;
					} catch ( qsaError ) {
					} finally {
						if ( nid === expando ) {
							context.removeAttribute( "id" );
						}
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrim, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {function(string, object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {
		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {
			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return (cache[ key + " " ] = value);
	}
	return cache;
}

/**
 * Mark a function for special use by Sizzle
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created element and returns a boolean result
 */
function assert( fn ) {
	var el = document.createElement("fieldset");

	try {
		return !!fn( el );
	} catch (e) {
		return false;
	} finally {
		// Remove from its parent by default
		if ( el.parentNode ) {
			el.parentNode.removeChild( el );
		}
		// release memory in IE
		el = null;
	}
}

/**
 * Adds the same handler for all of the specified attrs
 * @param {String} attrs Pipe-separated list of attributes
 * @param {Function} handler The method that will be applied
 */
function addHandle( attrs, handler ) {
	var arr = attrs.split("|"),
		i = arr.length;

	while ( i-- ) {
		Expr.attrHandle[ arr[i] ] = handler;
	}
}

/**
 * Checks document order of two siblings
 * @param {Element} a
 * @param {Element} b
 * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
 */
function siblingCheck( a, b ) {
	var cur = b && a,
		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
			a.sourceIndex - b.sourceIndex;

	// Use IE sourceIndex if available on both nodes
	if ( diff ) {
		return diff;
	}

	// Check if b follows a
	if ( cur ) {
		while ( (cur = cur.nextSibling) ) {
			if ( cur === b ) {
				return -1;
			}
		}
	}

	return a ? 1 : -1;
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return name === "input" && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return (name === "input" || name === "button") && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for :enabled/:disabled
 * @param {Boolean} disabled true for :disabled; false for :enabled
 */
function createDisabledPseudo( disabled ) {
	// Known :disabled false positives:
	// IE: *[disabled]:not(button, input, select, textarea, optgroup, option, menuitem, fieldset)
	// not IE: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
	return function( elem ) {

		// Check form elements and option elements for explicit disabling
		return "label" in elem && elem.disabled === disabled ||
			"form" in elem && elem.disabled === disabled ||

			// Check non-disabled form elements for fieldset[disabled] ancestors
			"form" in elem && elem.disabled === false && (
				// Support: IE6-11+
				// Ancestry is covered for us
				elem.isDisabled === disabled ||

				// Otherwise, assume any non-<option> under fieldset[disabled] is disabled
				/* jshint -W018 */
				elem.isDisabled !== !disabled &&
					("label" in elem || !disabledAncestor( elem )) !== disabled
			);
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction(function( argument ) {
		argument = +argument;
		return markFunction(function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ (j = matchIndexes[i]) ] ) {
					seed[j] = !(matches[j] = seed[j]);
				}
			}
		});
	});
}

/**
 * Checks a node for validity as a Sizzle context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== "undefined" && context;
}

// Expose support vars for convenience
support = Sizzle.support = {};

/**
 * Detects XML nodes
 * @param {Element|Object} elem An element or a document
 * @returns {Boolean} True iff elem is a non-HTML XML node
 */
isXML = Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833)
	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [doc] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
setDocument = Sizzle.setDocument = function( node ) {
	var hasCompare, subWindow,
		doc = node ? node.ownerDocument || node : preferredDoc;

	// Return early if doc is invalid or already selected
	if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Update global variables
	document = doc;
	docElem = document.documentElement;
	documentIsHTML = !isXML( document );

	// Support: IE 9-11, Edge
	// Accessing iframe documents after unload throws "permission denied" errors (jQuery #13936)
	if ( preferredDoc !== document &&
		(subWindow = document.defaultView) && subWindow.top !== subWindow ) {

		// Support: IE 11, Edge
		if ( subWindow.addEventListener ) {
			subWindow.addEventListener( "unload", unloadHandler, false );

		// Support: IE 9 - 10 only
		} else if ( subWindow.attachEvent ) {
			subWindow.attachEvent( "onunload", unloadHandler );
		}
	}

	/* Attributes
	---------------------------------------------------------------------- */

	// Support: IE<8
	// Verify that getAttribute really returns attributes and not properties
	// (excepting IE8 booleans)
	support.attributes = assert(function( el ) {
		el.className = "i";
		return !el.getAttribute("className");
	});

	/* getElement(s)By*
	---------------------------------------------------------------------- */

	// Check if getElementsByTagName("*") returns only elements
	support.getElementsByTagName = assert(function( el ) {
		el.appendChild( document.createComment("") );
		return !el.getElementsByTagName("*").length;
	});

	// Support: IE<9
	support.getElementsByClassName = rnative.test( document.getElementsByClassName );

	// Support: IE<10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programmatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert(function( el ) {
		docElem.appendChild( el ).id = expando;
		return !document.getElementsByName || !document.getElementsByName( expando ).length;
	});

	// ID find and filter
	if ( support.getById ) {
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var m = context.getElementById( id );
				return m ? [ m ] : [];
			}
		};
		Expr.filter["ID"] = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute("id") === attrId;
			};
		};
	} else {
		// Support: IE6/7
		// getElementById is not reliable as a find shortcut
		delete Expr.find["ID"];

		Expr.filter["ID"] =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== "undefined" &&
					elem.getAttributeNode("id");
				return node && node.value === attrId;
			};
		};
	}

	// Tag
	Expr.find["TAG"] = support.getElementsByTagName ?
		function( tag, context ) {
			if ( typeof context.getElementsByTagName !== "undefined" ) {
				return context.getElementsByTagName( tag );

			// DocumentFragment nodes don't have gEBTN
			} else if ( support.qsa ) {
				return context.querySelectorAll( tag );
			}
		} :

		function( tag, context ) {
			var elem,
				tmp = [],
				i = 0,
				// By happy coincidence, a (broken) gEBTN appears on DocumentFragment nodes too
				results = context.getElementsByTagName( tag );

			// Filter out possible comments
			if ( tag === "*" ) {
				while ( (elem = results[i++]) ) {
					if ( elem.nodeType === 1 ) {
						tmp.push( elem );
					}
				}

				return tmp;
			}
			return results;
		};

	// Class
	Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
		if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
	rbuggyMatches = [];

	// qSa(:focus) reports false when true (Chrome 21)
	// We allow this because of a bug in IE8/9 that throws an error
	// whenever `document.activeElement` is accessed on an iframe
	// So, we allow :focus to pass through QSA all the time to avoid the IE error
	// See https://bugs.jquery.com/ticket/13378
	rbuggyQSA = [];

	if ( (support.qsa = rnative.test( document.querySelectorAll )) ) {
		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( el ) {
			// Select is set to empty string on purpose
			// This is to test IE's treatment of not explicitly
			// setting a boolean content attribute,
			// since its presence should be enough
			// https://bugs.jquery.com/ticket/12359
			docElem.appendChild( el ).innerHTML = "<a id='" + expando + "'></a>" +
				"<select id='" + expando + "-\r\\' msallowcapture=''>" +
				"<option selected=''></option></select>";

			// Support: IE8, Opera 11-12.16
			// Nothing should be selected when empty strings follow ^= or $= or *=
			// The test attribute must be unknown in Opera but "safe" for WinRT
			// https://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
			if ( el.querySelectorAll("[msallowcapture^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
			}

			// Support: IE8
			// Boolean attributes and "value" are not treated correctly
			if ( !el.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
			}

			// Support: Chrome<29, Android<4.4, Safari<7.0+, iOS<7.0+, PhantomJS<1.9.8+
			if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
				rbuggyQSA.push("~=");
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here and will not see later tests
			if ( !el.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}

			// Support: Safari 8+, iOS 8+
			// https://bugs.webkit.org/show_bug.cgi?id=136851
			// In-page `selector#id sibling-combinator selector` fails
			if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
				rbuggyQSA.push(".#.+[+~]");
			}
		});

		assert(function( el ) {
			el.innerHTML = "<a href='' disabled='disabled'></a>" +
				"<select disabled='disabled'><option/></select>";

			// Support: Windows 8 Native Apps
			// The type and name attributes are restricted during .innerHTML assignment
			var input = document.createElement("input");
			input.setAttribute( "type", "hidden" );
			el.appendChild( input ).setAttribute( "name", "D" );

			// Support: IE8
			// Enforce case-sensitivity of name attribute
			if ( el.querySelectorAll("[name=d]").length ) {
				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here and will not see later tests
			if ( el.querySelectorAll(":enabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Support: IE9-11+
			// IE's :disabled selector does not pick up the children of disabled fieldsets
			docElem.appendChild( el ).disabled = true;
			if ( el.querySelectorAll(":disabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			el.querySelectorAll("*,:x");
			rbuggyQSA.push(",.*:");
		});
	}

	if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector) )) ) {

		assert(function( el ) {
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node (IE 9)
			support.disconnectedMatch = matches.call( el, "*" );

			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( el, "[s!='']:x" );
			rbuggyMatches.push( "!=", pseudos );
		});
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );

	/* Contains
	---------------------------------------------------------------------- */
	hasCompare = rnative.test( docElem.compareDocumentPosition );

	// Element contains another
	// Purposefully self-exclusive
	// As in, an element does not contain itself
	contains = hasCompare || rnative.test( docElem.contains ) ?
		function( a, b ) {
			var adown = a.nodeType === 9 ? a.documentElement : a,
				bup = b && b.parentNode;
			return a === bup || !!( bup && bup.nodeType === 1 && (
				adown.contains ?
					adown.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			));
		} :
		function( a, b ) {
			if ( b ) {
				while ( (b = b.parentNode) ) {
					if ( b === a ) {
						return true;
					}
				}
			}
			return false;
		};

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = hasCompare ?
	function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			(!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {

			// Choose the first element that is related to our preferred document
			if ( a === document || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
				return -1;
			}
			if ( b === document || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	} :
	function( a, b ) {
		// Exit early if the nodes are identical
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var cur,
			i = 0,
			aup = a.parentNode,
			bup = b.parentNode,
			ap = [ a ],
			bp = [ b ];

		// Parentless nodes are either documents or disconnected
		if ( !aup || !bup ) {
			return a === document ? -1 :
				b === document ? 1 :
				aup ? -1 :
				bup ? 1 :
				sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;

		// If the nodes are siblings, we can do a quick check
		} else if ( aup === bup ) {
			return siblingCheck( a, b );
		}

		// Otherwise we need full lists of their ancestors for comparison
		cur = a;
		while ( (cur = cur.parentNode) ) {
			ap.unshift( cur );
		}
		cur = b;
		while ( (cur = cur.parentNode) ) {
			bp.unshift( cur );
		}

		// Walk down the tree looking for a discrepancy
		while ( ap[i] === bp[i] ) {
			i++;
		}

		return i ?
			// Do a sibling check if the nodes have a common ancestor
			siblingCheck( ap[i], bp[i] ) :

			// Otherwise nodes in our document sort first
			ap[i] === preferredDoc ? -1 :
			bp[i] === preferredDoc ? 1 :
			0;
	};

	return document;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	// Make sure that attribute selectors are quoted
	expr = expr.replace( rattributeQuotes, "='$1']" );

	if ( support.matchesSelector && documentIsHTML &&
		!compilerCache[ expr + " " ] &&
		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch (e) {}
	}

	return Sizzle( expr, document, null, [ elem ] ).length > 0;
};

Sizzle.contains = function( context, elem ) {
	// Set document vars if needed
	if ( ( context.ownerDocument || context ) !== document ) {
		setDocument( context );
	}
	return contains( context, elem );
};

Sizzle.attr = function( elem, name ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],
		// Don't get fooled by Object.prototype properties (jQuery #13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	return val !== undefined ?
		val :
		support.attributes || !documentIsHTML ?
			elem.getAttribute( name ) :
			(val = elem.getAttributeNode(name)) && val.specified ?
				val.value :
				null;
};

Sizzle.escape = function( sel ) {
	return (sel + "").replace( rcssescape, fcssescape );
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
Sizzle.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	hasDuplicate = !support.detectDuplicates;
	sortInput = !support.sortStable && results.slice( 0 );
	results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			results.splice( duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( !nodeType ) {
		// If no nodeType, this is expected to be an array
		while ( (node = elem[i++]) ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		// Use textContent for elements
		// innerText usage removed for consistency of new lines (jQuery #11153)
		if ( typeof elem.textContent === "string" ) {
			return elem.textContent;
		} else {
			// Traverse its children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				ret += getText( elem );
			}
		}
	} else if ( nodeType === 3 || nodeType === 4 ) {
		return elem.nodeValue;
	}
	// Do not include comment or processing instruction nodes

	return ret;
};

Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1].slice( 0, 3 ) === "nth" ) {
				// nth-* requires argument
				if ( !match[3] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
				match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );

			// other types prohibit arguments
			} else if ( match[3] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var excess,
				unquoted = !match[6] && match[2];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[3] ) {
				match[2] = match[4] || match[5] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&
				// Get excess from tokenize (recursively)
				(excess = tokenize( unquoted, true )) &&
				// advance to the next closing parenthesis
				(excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

				// excess is a negative index
				match[0] = match[0].slice( 0, excess );
				match[2] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		"TAG": function( nodeNameSelector ) {
			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() { return true; } :
				function( elem ) {
					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
				};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				(pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
				classCache( className, function( elem ) {
					return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "" );
				});
		},

		"ATTR": function( name, operator, check ) {
			return function( elem ) {
				var result = Sizzle.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				return operator === "=" ? result === check :
					operator === "!=" ? result !== check :
					operator === "^=" ? check && result.indexOf( check ) === 0 :
					operator === "*=" ? check && result.indexOf( check ) > -1 :
					operator === "$=" ? check && result.slice( -check.length ) === check :
					operator === "~=" ? ( " " + result.replace( rwhitespace, " " ) + " " ).indexOf( check ) > -1 :
					operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
					false;
			};
		},

		"CHILD": function( type, what, argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, context, xml ) {
					var cache, uniqueCache, outerCache, node, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType,
						diff = false;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( (node = node[ dir ]) ) {
									if ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) {

										return false;
									}
								}
								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {

							// Seek `elem` from a previously-cached index

							// ...in a gzip-friendly way
							node = parent;
							outerCache = node[ expando ] || (node[ expando ] = {});

							// Support: IE <9 only
							// Defend against cloned attroperties (jQuery gh-1709)
							uniqueCache = outerCache[ node.uniqueID ] ||
								(outerCache[ node.uniqueID ] = {});

							cache = uniqueCache[ type ] || [];
							nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
							diff = nodeIndex && cache[ 2 ];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( (node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								(diff = nodeIndex = 0) || start.pop()) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									uniqueCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						} else {
							// Use previously-cached element index if available
							if ( useCache ) {
								// ...in a gzip-friendly way
								node = elem;
								outerCache = node[ expando ] || (node[ expando ] = {});

								// Support: IE <9 only
								// Defend against cloned attroperties (jQuery gh-1709)
								uniqueCache = outerCache[ node.uniqueID ] ||
									(outerCache[ node.uniqueID ] = {});

								cache = uniqueCache[ type ] || [];
								nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
								diff = nodeIndex;
							}

							// xml :nth-child(...)
							// or :nth-last-child(...) or :nth(-last)?-of-type(...)
							if ( diff === false ) {
								// Use the same loop as above to seek `elem` from the start
								while ( (node = ++nodeIndex && node && node[ dir ] ||
									(diff = nodeIndex = 0) || start.pop()) ) {

									if ( ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) &&
										++diff ) {

										// Cache the index of each encountered element
										if ( useCache ) {
											outerCache = node[ expando ] || (node[ expando ] = {});

											// Support: IE <9 only
											// Defend against cloned attroperties (jQuery gh-1709)
											uniqueCache = outerCache[ node.uniqueID ] ||
												(outerCache[ node.uniqueID ] = {});

											uniqueCache[ type ] = [ dirruns, diff ];
										}

										if ( node === elem ) {
											break;
										}
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		"PSEUDO": function( pseudo, argument ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					Sizzle.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as Sizzle does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction(function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf( seed, matched[i] );
							seed[ idx ] = !( matches[ idx ] = matched[i] );
						}
					}) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {
		// Potentially complex pseudos
		"not": markFunction(function( selector ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrim, "$1" ) );

			return matcher[ expando ] ?
				markFunction(function( seed, matches, context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( (elem = unmatched[i]) ) {
							seed[i] = !(matches[i] = elem);
						}
					}
				}) :
				function( elem, context, xml ) {
					input[0] = elem;
					matcher( input, null, xml, results );
					// Don't keep the element (issue #299)
					input[0] = null;
					return !results.pop();
				};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"contains": markFunction(function( text ) {
			text = text.replace( runescape, funescape );
			return function( elem ) {
				return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// http://www.w3.org/TR/selectors/#lang-pseudo
		"lang": markFunction( function( lang ) {
			// lang value must be a valid identifier
			if ( !ridentifier.test(lang || "") ) {
				Sizzle.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( (elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( (elem = elem.parentNode) && elem.nodeType === 1 );
				return false;
			};
		}),

		// Miscellaneous
		"target": function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		"root": function( elem ) {
			return elem === docElem;
		},

		"focus": function( elem ) {
			return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
		},

		// Boolean properties
		"enabled": createDisabledPseudo( false ),
		"disabled": createDisabledPseudo( true ),

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		"empty": function( elem ) {
			// http://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		"parent": function( elem ) {
			return !Expr.pseudos["empty"]( elem );
		},

		// Element/input types
		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"text": function( elem ) {
			var attr;
			return elem.nodeName.toLowerCase() === "input" &&
				elem.type === "text" &&

				// Support: IE<8
				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		"first": createPositionalPseudo(function() {
			return [ 0 ];
		}),

		"last": createPositionalPseudo(function( matchIndexes, length ) {
			return [ length - 1 ];
		}),

		"eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		}),

		"even": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"odd": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		})
	}
};

Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || (match = rcomma.exec( soFar )) ) {
			if ( match ) {
				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[0].length ) || soFar;
			}
			groups.push( (tokens = []) );
		}

		matched = false;

		// Combinators
		if ( (match = rcombinators.exec( soFar )) ) {
			matched = match.shift();
			tokens.push({
				value: matched,
				// Cast descendant combinators to space
				type: match[0].replace( rtrim, " " )
			});
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
				(match = preFilters[ type ]( match ))) ) {
				matched = match.shift();
				tokens.push({
					value: matched,
					type: type,
					matches: match
				});
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	return parseOnly ?
		soFar.length :
		soFar ?
			Sizzle.error( selector ) :
			// Cache the tokens
			tokenCache( selector, groups ).slice( 0 );
};

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[i].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		skip = combinator.next,
		key = skip || dir,
		checkNonElements = base && key === "parentNode",
		doneName = done++;

	return combinator.first ?
		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, uniqueCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
			if ( xml ) {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || (elem[ expando ] = {});

						// Support: IE <9 only
						// Defend against cloned attroperties (jQuery gh-1709)
						uniqueCache = outerCache[ elem.uniqueID ] || (outerCache[ elem.uniqueID ] = {});

						if ( skip && skip === elem.nodeName.toLowerCase() ) {
							elem = elem[ dir ] || elem;
						} else if ( (oldCache = uniqueCache[ key ]) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return (newCache[ 2 ] = oldCache[ 2 ]);
						} else {
							// Reuse newcache so results back-propagate to previous elements
							uniqueCache[ key ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
								return true;
							}
						}
					}
				}
			}
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[i]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[0];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( (elem = unmatched[i]) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction(function( seed, results, context, xml ) {
		var temp, i, elem,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems,

			matcherOut = matcher ?
				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

					// ...intermediate processing is necessary
					[] :

					// ...otherwise use results directly
					results :
				matcherIn;

		// Find primary matches
		if ( matcher ) {
			matcher( matcherIn, matcherOut, context, xml );
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( (elem = temp[i]) ) {
					matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {
					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( (elem = matcherOut[i]) ) {
							// Restore matcherIn since elem is not yet a final match
							temp.push( (matcherIn[i] = elem) );
						}
					}
					postFinder( null, (matcherOut = []), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( (elem = matcherOut[i]) &&
						(temp = postFinder ? indexOf( seed, elem ) : preMap[i]) > -1 ) {

						seed[temp] = !(results[temp] = elem);
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	});
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[0].type ],
		implicitRelative = leadingRelative || Expr.relative[" "],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {
			var ret = ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
				(checkContext = context).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );
			// Avoid hanging onto element (issue #299)
			checkContext = null;
			return ret;
		} ];

	for ( ; i < len; i++ ) {
		if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
			matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
		} else {
			matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {
				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[j].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(
						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
					).replace( rtrim, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,
				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
				len = elems.length;

			if ( outermost ) {
				outermostContext = context === document || context || outermost;
			}

			// Add elements passing elementMatchers directly to results
			// Support: IE<9, Safari
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
			for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;
					if ( !context && elem.ownerDocument !== document ) {
						setDocument( elem );
						xml = !documentIsHTML;
					}
					while ( (matcher = elementMatchers[j++]) ) {
						if ( matcher( elem, context || document, xml) ) {
							results.push( elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {
					// They will have gone through all possible matchers
					if ( (elem = !matcher && elem) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// `i` is now the count of elements visited above, and adding it to `matchedCount`
			// makes the latter nonnegative.
			matchedCount += i;

			// Apply set filters to unmatched elements
			// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
			// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
			// no element matchers and no seed.
			// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
			// case, which will result in a "00" `matchedCount` that differs from `i` but is also
			// numerically zero.
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( (matcher = setMatchers[j++]) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {
					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !(unmatched[i] || setMatched[i]) ) {
								setMatched[i] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					Sizzle.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {
		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[i] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
};

/**
 * A low-level selection function that works with Sizzle's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with Sizzle.compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
select = Sizzle.select = function( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( (selector = compiled.selector || selector) );

	results = results || [];

	// Try to minimize operations if there is only one selector in the list and no seed
	// (the latter of which guarantees us context)
	if ( match.length === 1 ) {

		// Reduce context if the leading compound selector is an ID
		tokens = match[0] = match[0].slice( 0 );
		if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
				support.getById && context.nodeType === 9 && documentIsHTML &&
				Expr.relative[ tokens[1].type ] ) {

			context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[i];

			// Abort if we hit a combinator
			if ( Expr.relative[ (type = token.type) ] ) {
				break;
			}
			if ( (find = Expr.find[ type ]) ) {
				// Search, expanding context for leading sibling combinators
				if ( (seed = find(
					token.matches[0].replace( runescape, funescape ),
					rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
				)) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
};

// One-time assignments

// Sort stability
support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;

// Support: Chrome 14-35+
// Always assume duplicates if they aren't passed to the comparison function
support.detectDuplicates = !!hasDuplicate;

// Initialize against the default document
setDocument();

// Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert(function( el ) {
	// Should return 1, but returns 4 (following)
	return el.compareDocumentPosition( document.createElement("fieldset") ) & 1;
});

// Support: IE<8
// Prevent attribute/property "interpolation"
// https://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !assert(function( el ) {
	el.innerHTML = "<a href='#'></a>";
	return el.firstChild.getAttribute("href") === "#" ;
}) ) {
	addHandle( "type|href|height|width", function( elem, name, isXML ) {
		if ( !isXML ) {
			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
		}
	});
}

// Support: IE<9
// Use defaultValue in place of getAttribute("value")
if ( !support.attributes || !assert(function( el ) {
	el.innerHTML = "<input/>";
	el.firstChild.setAttribute( "value", "" );
	return el.firstChild.getAttribute( "value" ) === "";
}) ) {
	addHandle( "value", function( elem, name, isXML ) {
		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
			return elem.defaultValue;
		}
	});
}

// Support: IE<9
// Use getAttributeNode to fetch booleans when getAttribute lies
if ( !assert(function( el ) {
	return el.getAttribute("disabled") == null;
}) ) {
	addHandle( booleans, function( elem, name, isXML ) {
		var val;
		if ( !isXML ) {
			return elem[ name ] === true ? name.toLowerCase() :
					(val = elem.getAttributeNode( name )) && val.specified ?
					val.value :
				null;
		}
	});
}

return Sizzle;

})( window );



jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;

// Deprecated
jQuery.expr[ ":" ] = jQuery.expr.pseudos;
jQuery.uniqueSort = jQuery.unique = Sizzle.uniqueSort;
jQuery.text = Sizzle.getText;
jQuery.isXMLDoc = Sizzle.isXML;
jQuery.contains = Sizzle.contains;
jQuery.escapeSelector = Sizzle.escape;




var dir = function( elem, dir, until ) {
	var matched = [],
		truncate = until !== undefined;

	while ( ( elem = elem[ dir ] ) && elem.nodeType !== 9 ) {
		if ( elem.nodeType === 1 ) {
			if ( truncate && jQuery( elem ).is( until ) ) {
				break;
			}
			matched.push( elem );
		}
	}
	return matched;
};


var siblings = function( n, elem ) {
	var matched = [];

	for ( ; n; n = n.nextSibling ) {
		if ( n.nodeType === 1 && n !== elem ) {
			matched.push( n );
		}
	}

	return matched;
};


var rneedsContext = jQuery.expr.match.needsContext;

var rsingleTag = ( /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i );



var risSimple = /^.[^:#\[\.,]*$/;

// Implement the identical functionality for filter and not
function winnow( elements, qualifier, not ) {
	if ( jQuery.isFunction( qualifier ) ) {
		return jQuery.grep( elements, function( elem, i ) {
			return !!qualifier.call( elem, i, elem ) !== not;
		} );

	}

	if ( qualifier.nodeType ) {
		return jQuery.grep( elements, function( elem ) {
			return ( elem === qualifier ) !== not;
		} );

	}

	if ( typeof qualifier === "string" ) {
		if ( risSimple.test( qualifier ) ) {
			return jQuery.filter( qualifier, elements, not );
		}

		qualifier = jQuery.filter( qualifier, elements );
	}

	return jQuery.grep( elements, function( elem ) {
		return ( indexOf.call( qualifier, elem ) > -1 ) !== not && elem.nodeType === 1;
	} );
}

jQuery.filter = function( expr, elems, not ) {
	var elem = elems[ 0 ];

	if ( not ) {
		expr = ":not(" + expr + ")";
	}

	return elems.length === 1 && elem.nodeType === 1 ?
		jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [] :
		jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
			return elem.nodeType === 1;
		} ) );
};

jQuery.fn.extend( {
	find: function( selector ) {
		var i, ret,
			len = this.length,
			self = this;

		if ( typeof selector !== "string" ) {
			return this.pushStack( jQuery( selector ).filter( function() {
				for ( i = 0; i < len; i++ ) {
					if ( jQuery.contains( self[ i ], this ) ) {
						return true;
					}
				}
			} ) );
		}

		ret = this.pushStack( [] );

		for ( i = 0; i < len; i++ ) {
			jQuery.find( selector, self[ i ], ret );
		}

		return len > 1 ? jQuery.uniqueSort( ret ) : ret;
	},
	filter: function( selector ) {
		return this.pushStack( winnow( this, selector || [], false ) );
	},
	not: function( selector ) {
		return this.pushStack( winnow( this, selector || [], true ) );
	},
	is: function( selector ) {
		return !!winnow(
			this,

			// If this is a positional/relative selector, check membership in the returned set
			// so $("p:first").is("p:last") won't return true for a doc with two "p".
			typeof selector === "string" && rneedsContext.test( selector ) ?
				jQuery( selector ) :
				selector || [],
			false
		).length;
	}
} );


// Initialize a jQuery object


// A central reference to the root jQuery(document)
var rootjQuery,

	// A simple way to check for HTML strings
	// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
	// Strict HTML recognition (#11290: must start with <)
	// Shortcut simple #id case for speed
	rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,

	init = jQuery.fn.init = function( selector, context, root ) {
		var match, elem;

		// HANDLE: $(""), $(null), $(undefined), $(false)
		if ( !selector ) {
			return this;
		}

		// Method init() accepts an alternate rootjQuery
		// so migrate can support jQuery.sub (gh-2101)
		root = root || rootjQuery;

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			if ( selector[ 0 ] === "<" &&
				selector[ selector.length - 1 ] === ">" &&
				selector.length >= 3 ) {

				// Assume that strings that start and end with <> are HTML and skip the regex check
				match = [ null, selector, null ];

			} else {
				match = rquickExpr.exec( selector );
			}

			// Match html or make sure no context is specified for #id
			if ( match && ( match[ 1 ] || !context ) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[ 1 ] ) {
					context = context instanceof jQuery ? context[ 0 ] : context;

					// Option to run scripts is true for back-compat
					// Intentionally let the error be thrown if parseHTML is not present
					jQuery.merge( this, jQuery.parseHTML(
						match[ 1 ],
						context && context.nodeType ? context.ownerDocument || context : document,
						true
					) );

					// HANDLE: $(html, props)
					if ( rsingleTag.test( match[ 1 ] ) && jQuery.isPlainObject( context ) ) {
						for ( match in context ) {

							// Properties of context are called as methods if possible
							if ( jQuery.isFunction( this[ match ] ) ) {
								this[ match ]( context[ match ] );

							// ...and otherwise set as attributes
							} else {
								this.attr( match, context[ match ] );
							}
						}
					}

					return this;

				// HANDLE: $(#id)
				} else {
					elem = document.getElementById( match[ 2 ] );

					if ( elem ) {

						// Inject the element directly into the jQuery object
						this[ 0 ] = elem;
						this.length = 1;
					}
					return this;
				}

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return ( context || root ).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return this.constructor( context ).find( selector );
			}

		// HANDLE: $(DOMElement)
		} else if ( selector.nodeType ) {
			this[ 0 ] = selector;
			this.length = 1;
			return this;

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( jQuery.isFunction( selector ) ) {
			return root.ready !== undefined ?
				root.ready( selector ) :

				// Execute immediately if ready is not present
				selector( jQuery );
		}

		return jQuery.makeArray( selector, this );
	};

// Give the init function the jQuery prototype for later instantiation
init.prototype = jQuery.fn;

// Initialize central reference
rootjQuery = jQuery( document );


var rparentsprev = /^(?:parents|prev(?:Until|All))/,

	// Methods guaranteed to produce a unique set when starting from a unique set
	guaranteedUnique = {
		children: true,
		contents: true,
		next: true,
		prev: true
	};

jQuery.fn.extend( {
	has: function( target ) {
		var targets = jQuery( target, this ),
			l = targets.length;

		return this.filter( function() {
			var i = 0;
			for ( ; i < l; i++ ) {
				if ( jQuery.contains( this, targets[ i ] ) ) {
					return true;
				}
			}
		} );
	},

	closest: function( selectors, context ) {
		var cur,
			i = 0,
			l = this.length,
			matched = [],
			targets = typeof selectors !== "string" && jQuery( selectors );

		// Positional selectors never match, since there's no _selection_ context
		if ( !rneedsContext.test( selectors ) ) {
			for ( ; i < l; i++ ) {
				for ( cur = this[ i ]; cur && cur !== context; cur = cur.parentNode ) {

					// Always skip document fragments
					if ( cur.nodeType < 11 && ( targets ?
						targets.index( cur ) > -1 :

						// Don't pass non-elements to Sizzle
						cur.nodeType === 1 &&
							jQuery.find.matchesSelector( cur, selectors ) ) ) {

						matched.push( cur );
						break;
					}
				}
			}
		}

		return this.pushStack( matched.length > 1 ? jQuery.uniqueSort( matched ) : matched );
	},

	// Determine the position of an element within the set
	index: function( elem ) {

		// No argument, return index in parent
		if ( !elem ) {
			return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
		}

		// Index in selector
		if ( typeof elem === "string" ) {
			return indexOf.call( jQuery( elem ), this[ 0 ] );
		}

		// Locate the position of the desired element
		return indexOf.call( this,

			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[ 0 ] : elem
		);
	},

	add: function( selector, context ) {
		return this.pushStack(
			jQuery.uniqueSort(
				jQuery.merge( this.get(), jQuery( selector, context ) )
			)
		);
	},

	addBack: function( selector ) {
		return this.add( selector == null ?
			this.prevObject : this.prevObject.filter( selector )
		);
	}
} );

function sibling( cur, dir ) {
	while ( ( cur = cur[ dir ] ) && cur.nodeType !== 1 ) {}
	return cur;
}

jQuery.each( {
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, i, until ) {
		return dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return sibling( elem, "nextSibling" );
	},
	prev: function( elem ) {
		return sibling( elem, "previousSibling" );
	},
	nextAll: function( elem ) {
		return dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, i, until ) {
		return dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, i, until ) {
		return dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return siblings( ( elem.parentNode || {} ).firstChild, elem );
	},
	children: function( elem ) {
		return siblings( elem.firstChild );
	},
	contents: function( elem ) {
		return elem.contentDocument || jQuery.merge( [], elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var matched = jQuery.map( this, fn, until );

		if ( name.slice( -5 ) !== "Until" ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			matched = jQuery.filter( selector, matched );
		}

		if ( this.length > 1 ) {

			// Remove duplicates
			if ( !guaranteedUnique[ name ] ) {
				jQuery.uniqueSort( matched );
			}

			// Reverse order for parents* and prev-derivatives
			if ( rparentsprev.test( name ) ) {
				matched.reverse();
			}
		}

		return this.pushStack( matched );
	};
} );
var rnotwhite = ( /\S+/g );



// Convert String-formatted options into Object-formatted ones
function createOptions( options ) {
	var object = {};
	jQuery.each( options.match( rnotwhite ) || [], function( _, flag ) {
		object[ flag ] = true;
	} );
	return object;
}

/*
 * Create a callback list using the following parameters:
 *
 *	options: an optional list of space-separated options that will change how
 *			the callback list behaves or a more traditional option object
 *
 * By default a callback list will act like an event callback list and can be
 * "fired" multiple times.
 *
 * Possible options:
 *
 *	once:			will ensure the callback list can only be fired once (like a Deferred)
 *
 *	memory:			will keep track of previous values and will call any callback added
 *					after the list has been fired right away with the latest "memorized"
 *					values (like a Deferred)
 *
 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
 *
 *	stopOnFalse:	interrupt callings when a callback returns false
 *
 */
jQuery.Callbacks = function( options ) {

	// Convert options from String-formatted to Object-formatted if needed
	// (we check in cache first)
	options = typeof options === "string" ?
		createOptions( options ) :
		jQuery.extend( {}, options );

	var // Flag to know if list is currently firing
		firing,

		// Last fire value for non-forgettable lists
		memory,

		// Flag to know if list was already fired
		fired,

		// Flag to prevent firing
		locked,

		// Actual callback list
		list = [],

		// Queue of execution data for repeatable lists
		queue = [],

		// Index of currently firing callback (modified by add/remove as needed)
		firingIndex = -1,

		// Fire callbacks
		fire = function() {

			// Enforce single-firing
			locked = options.once;

			// Execute callbacks for all pending executions,
			// respecting firingIndex overrides and runtime changes
			fired = firing = true;
			for ( ; queue.length; firingIndex = -1 ) {
				memory = queue.shift();
				while ( ++firingIndex < list.length ) {

					// Run callback and check for early termination
					if ( list[ firingIndex ].apply( memory[ 0 ], memory[ 1 ] ) === false &&
						options.stopOnFalse ) {

						// Jump to end and forget the data so .add doesn't re-fire
						firingIndex = list.length;
						memory = false;
					}
				}
			}

			// Forget the data if we're done with it
			if ( !options.memory ) {
				memory = false;
			}

			firing = false;

			// Clean up if we're done firing for good
			if ( locked ) {

				// Keep an empty list if we have data for future add calls
				if ( memory ) {
					list = [];

				// Otherwise, this object is spent
				} else {
					list = "";
				}
			}
		},

		// Actual Callbacks object
		self = {

			// Add a callback or a collection of callbacks to the list
			add: function() {
				if ( list ) {

					// If we have memory from a past run, we should fire after adding
					if ( memory && !firing ) {
						firingIndex = list.length - 1;
						queue.push( memory );
					}

					( function add( args ) {
						jQuery.each( args, function( _, arg ) {
							if ( jQuery.isFunction( arg ) ) {
								if ( !options.unique || !self.has( arg ) ) {
									list.push( arg );
								}
							} else if ( arg && arg.length && jQuery.type( arg ) !== "string" ) {

								// Inspect recursively
								add( arg );
							}
						} );
					} )( arguments );

					if ( memory && !firing ) {
						fire();
					}
				}
				return this;
			},

			// Remove a callback from the list
			remove: function() {
				jQuery.each( arguments, function( _, arg ) {
					var index;
					while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
						list.splice( index, 1 );

						// Handle firing indexes
						if ( index <= firingIndex ) {
							firingIndex--;
						}
					}
				} );
				return this;
			},

			// Check if a given callback is in the list.
			// If no argument is given, return whether or not list has callbacks attached.
			has: function( fn ) {
				return fn ?
					jQuery.inArray( fn, list ) > -1 :
					list.length > 0;
			},

			// Remove all callbacks from the list
			empty: function() {
				if ( list ) {
					list = [];
				}
				return this;
			},

			// Disable .fire and .add
			// Abort any current/pending executions
			// Clear all callbacks and values
			disable: function() {
				locked = queue = [];
				list = memory = "";
				return this;
			},
			disabled: function() {
				return !list;
			},

			// Disable .fire
			// Also disable .add unless we have memory (since it would have no effect)
			// Abort any pending executions
			lock: function() {
				locked = queue = [];
				if ( !memory && !firing ) {
					list = memory = "";
				}
				return this;
			},
			locked: function() {
				return !!locked;
			},

			// Call all callbacks with the given context and arguments
			fireWith: function( context, args ) {
				if ( !locked ) {
					args = args || [];
					args = [ context, args.slice ? args.slice() : args ];
					queue.push( args );
					if ( !firing ) {
						fire();
					}
				}
				return this;
			},

			// Call all the callbacks with the given arguments
			fire: function() {
				self.fireWith( this, arguments );
				return this;
			},

			// To know if the callbacks have already been called at least once
			fired: function() {
				return !!fired;
			}
		};

	return self;
};


function Identity( v ) {
	return v;
}
function Thrower( ex ) {
	throw ex;
}

function adoptValue( value, resolve, reject ) {
	var method;

	try {

		// Check for promise aspect first to privilege synchronous behavior
		if ( value && jQuery.isFunction( ( method = value.promise ) ) ) {
			method.call( value ).done( resolve ).fail( reject );

		// Other thenables
		} else if ( value && jQuery.isFunction( ( method = value.then ) ) ) {
			method.call( value, resolve, reject );

		// Other non-thenables
		} else {

			// Support: Android 4.0 only
			// Strict mode functions invoked without .call/.apply get global-object context
			resolve.call( undefined, value );
		}

	// For Promises/A+, convert exceptions into rejections
	// Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
	// Deferred#then to conditionally suppress rejection.
	} catch ( value ) {

		// Support: Android 4.0 only
		// Strict mode functions invoked without .call/.apply get global-object context
		reject.call( undefined, value );
	}
}

jQuery.extend( {

	Deferred: function( func ) {
		var tuples = [

				// action, add listener, callbacks,
				// ... .then handlers, argument index, [final state]
				[ "notify", "progress", jQuery.Callbacks( "memory" ),
					jQuery.Callbacks( "memory" ), 2 ],
				[ "resolve", "done", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 0, "resolved" ],
				[ "reject", "fail", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 1, "rejected" ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				"catch": function( fn ) {
					return promise.then( null, fn );
				},

				// Keep pipe for back-compat
				pipe: function( /* fnDone, fnFail, fnProgress */ ) {
					var fns = arguments;

					return jQuery.Deferred( function( newDefer ) {
						jQuery.each( tuples, function( i, tuple ) {

							// Map tuples (progress, done, fail) to arguments (done, fail, progress)
							var fn = jQuery.isFunction( fns[ tuple[ 4 ] ] ) && fns[ tuple[ 4 ] ];

							// deferred.progress(function() { bind to newDefer or newDefer.notify })
							// deferred.done(function() { bind to newDefer or newDefer.resolve })
							// deferred.fail(function() { bind to newDefer or newDefer.reject })
							deferred[ tuple[ 1 ] ]( function() {
								var returned = fn && fn.apply( this, arguments );
								if ( returned && jQuery.isFunction( returned.promise ) ) {
									returned.promise()
										.progress( newDefer.notify )
										.done( newDefer.resolve )
										.fail( newDefer.reject );
								} else {
									newDefer[ tuple[ 0 ] + "With" ](
										this,
										fn ? [ returned ] : arguments
									);
								}
							} );
						} );
						fns = null;
					} ).promise();
				},
				then: function( onFulfilled, onRejected, onProgress ) {
					var maxDepth = 0;
					function resolve( depth, deferred, handler, special ) {
						return function() {
							var that = this,
								args = arguments,
								mightThrow = function() {
									var returned, then;

									// Support: Promises/A+ section 2.3.3.3.3
									// https://promisesaplus.com/#point-59
									// Ignore double-resolution attempts
									if ( depth < maxDepth ) {
										return;
									}

									returned = handler.apply( that, args );

									// Support: Promises/A+ section 2.3.1
									// https://promisesaplus.com/#point-48
									if ( returned === deferred.promise() ) {
										throw new TypeError( "Thenable self-resolution" );
									}

									// Support: Promises/A+ sections 2.3.3.1, 3.5
									// https://promisesaplus.com/#point-54
									// https://promisesaplus.com/#point-75
									// Retrieve `then` only once
									then = returned &&

										// Support: Promises/A+ section 2.3.4
										// https://promisesaplus.com/#point-64
										// Only check objects and functions for thenability
										( typeof returned === "object" ||
											typeof returned === "function" ) &&
										returned.then;

									// Handle a returned thenable
									if ( jQuery.isFunction( then ) ) {

										// Special processors (notify) just wait for resolution
										if ( special ) {
											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special )
											);

										// Normal processors (resolve) also hook into progress
										} else {

											// ...and disregard older resolution values
											maxDepth++;

											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special ),
												resolve( maxDepth, deferred, Identity,
													deferred.notifyWith )
											);
										}

									// Handle all other returned values
									} else {

										// Only substitute handlers pass on context
										// and multiple values (non-spec behavior)
										if ( handler !== Identity ) {
											that = undefined;
											args = [ returned ];
										}

										// Process the value(s)
										// Default process is resolve
										( special || deferred.resolveWith )( that, args );
									}
								},

								// Only normal processors (resolve) catch and reject exceptions
								process = special ?
									mightThrow :
									function() {
										try {
											mightThrow();
										} catch ( e ) {

											if ( jQuery.Deferred.exceptionHook ) {
												jQuery.Deferred.exceptionHook( e,
													process.stackTrace );
											}

											// Support: Promises/A+ section 2.3.3.3.4.1
											// https://promisesaplus.com/#point-61
											// Ignore post-resolution exceptions
											if ( depth + 1 >= maxDepth ) {

												// Only substitute handlers pass on context
												// and multiple values (non-spec behavior)
												if ( handler !== Thrower ) {
													that = undefined;
													args = [ e ];
												}

												deferred.rejectWith( that, args );
											}
										}
									};

							// Support: Promises/A+ section 2.3.3.3.1
							// https://promisesaplus.com/#point-57
							// Re-resolve promises immediately to dodge false rejection from
							// subsequent errors
							if ( depth ) {
								process();
							} else {

								// Call an optional hook to record the stack, in case of exception
								// since it's otherwise lost when execution goes async
								if ( jQuery.Deferred.getStackHook ) {
									process.stackTrace = jQuery.Deferred.getStackHook();
								}
								window.setTimeout( process );
							}
						};
					}

					return jQuery.Deferred( function( newDefer ) {

						// progress_handlers.add( ... )
						tuples[ 0 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								jQuery.isFunction( onProgress ) ?
									onProgress :
									Identity,
								newDefer.notifyWith
							)
						);

						// fulfilled_handlers.add( ... )
						tuples[ 1 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								jQuery.isFunction( onFulfilled ) ?
									onFulfilled :
									Identity
							)
						);

						// rejected_handlers.add( ... )
						tuples[ 2 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								jQuery.isFunction( onRejected ) ?
									onRejected :
									Thrower
							)
						);
					} ).promise();
				},

				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 5 ];

			// promise.progress = list.add
			// promise.done = list.add
			// promise.fail = list.add
			promise[ tuple[ 1 ] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(
					function() {

						// state = "resolved" (i.e., fulfilled)
						// state = "rejected"
						state = stateString;
					},

					// rejected_callbacks.disable
					// fulfilled_callbacks.disable
					tuples[ 3 - i ][ 2 ].disable,

					// progress_callbacks.lock
					tuples[ 0 ][ 2 ].lock
				);
			}

			// progress_handlers.fire
			// fulfilled_handlers.fire
			// rejected_handlers.fire
			list.add( tuple[ 3 ].fire );

			// deferred.notify = function() { deferred.notifyWith(...) }
			// deferred.resolve = function() { deferred.resolveWith(...) }
			// deferred.reject = function() { deferred.rejectWith(...) }
			deferred[ tuple[ 0 ] ] = function() {
				deferred[ tuple[ 0 ] + "With" ]( this === deferred ? undefined : this, arguments );
				return this;
			};

			// deferred.notifyWith = list.fireWith
			// deferred.resolveWith = list.fireWith
			// deferred.rejectWith = list.fireWith
			deferred[ tuple[ 0 ] + "With" ] = list.fireWith;
		} );

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( singleValue ) {
		var

			// count of uncompleted subordinates
			remaining = arguments.length,

			// count of unprocessed arguments
			i = remaining,

			// subordinate fulfillment data
			resolveContexts = Array( i ),
			resolveValues = slice.call( arguments ),

			// the master Deferred
			master = jQuery.Deferred(),

			// subordinate callback factory
			updateFunc = function( i ) {
				return function( value ) {
					resolveContexts[ i ] = this;
					resolveValues[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
					if ( !( --remaining ) ) {
						master.resolveWith( resolveContexts, resolveValues );
					}
				};
			};

		// Single- and empty arguments are adopted like Promise.resolve
		if ( remaining <= 1 ) {
			adoptValue( singleValue, master.done( updateFunc( i ) ).resolve, master.reject );

			// Use .then() to unwrap secondary thenables (cf. gh-3000)
			if ( master.state() === "pending" ||
				jQuery.isFunction( resolveValues[ i ] && resolveValues[ i ].then ) ) {

				return master.then();
			}
		}

		// Multiple arguments are aggregated like Promise.all array elements
		while ( i-- ) {
			adoptValue( resolveValues[ i ], updateFunc( i ), master.reject );
		}

		return master.promise();
	}
} );


// These usually indicate a programmer mistake during development,
// warn about them ASAP rather than swallowing them by default.
var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;

jQuery.Deferred.exceptionHook = function( error, stack ) {

	// Support: IE 8 - 9 only
	// Console exists when dev tools are open, which can happen at any time
	if ( window.console && window.console.warn && error && rerrorNames.test( error.name ) ) {
		window.console.warn( "jQuery.Deferred exception: " + error.message, error.stack, stack );
	}
};




jQuery.readyException = function( error ) {
	window.setTimeout( function() {
		throw error;
	} );
};




// The deferred used on DOM ready
var readyList = jQuery.Deferred();

jQuery.fn.ready = function( fn ) {

	readyList
		.then( fn )

		// Wrap jQuery.readyException in a function so that the lookup
		// happens at the time of error handling instead of callback
		// registration.
		.catch( function( error ) {
			jQuery.readyException( error );
		} );

	return this;
};

jQuery.extend( {

	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,

	// A counter to track how many items to wait for before
	// the ready event fires. See #6781
	readyWait: 1,

	// Hold (or release) the ready event
	holdReady: function( hold ) {
		if ( hold ) {
			jQuery.readyWait++;
		} else {
			jQuery.ready( true );
		}
	},

	// Handle when the DOM is ready
	ready: function( wait ) {

		// Abort if there are pending holds or we're already ready
		if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
			return;
		}

		// Remember that the DOM is ready
		jQuery.isReady = true;

		// If a normal DOM Ready event fired, decrement, and wait if need be
		if ( wait !== true && --jQuery.readyWait > 0 ) {
			return;
		}

		// If there are functions bound, to execute
		readyList.resolveWith( document, [ jQuery ] );
	}
} );

jQuery.ready.then = readyList.then;

// The ready event handler and self cleanup method
function completed() {
	document.removeEventListener( "DOMContentLoaded", completed );
	window.removeEventListener( "load", completed );
	jQuery.ready();
}

// Catch cases where $(document).ready() is called
// after the browser event has already occurred.
// Support: IE <=9 - 10 only
// Older IE sometimes signals "interactive" too soon
if ( document.readyState === "complete" ||
	( document.readyState !== "loading" && !document.documentElement.doScroll ) ) {

	// Handle it asynchronously to allow scripts the opportunity to delay ready
	window.setTimeout( jQuery.ready );

} else {

	// Use the handy event callback
	document.addEventListener( "DOMContentLoaded", completed );

	// A fallback to window.onload, that will always work
	window.addEventListener( "load", completed );
}




// Multifunctional method to get and set values of a collection
// The value/s can optionally be executed if it's a function
var access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
	var i = 0,
		len = elems.length,
		bulk = key == null;

	// Sets many values
	if ( jQuery.type( key ) === "object" ) {
		chainable = true;
		for ( i in key ) {
			access( elems, fn, i, key[ i ], true, emptyGet, raw );
		}

	// Sets one value
	} else if ( value !== undefined ) {
		chainable = true;

		if ( !jQuery.isFunction( value ) ) {
			raw = true;
		}

		if ( bulk ) {

			// Bulk operations run against the entire set
			if ( raw ) {
				fn.call( elems, value );
				fn = null;

			// ...except when executing function values
			} else {
				bulk = fn;
				fn = function( elem, key, value ) {
					return bulk.call( jQuery( elem ), value );
				};
			}
		}

		if ( fn ) {
			for ( ; i < len; i++ ) {
				fn(
					elems[ i ], key, raw ?
					value :
					value.call( elems[ i ], i, fn( elems[ i ], key ) )
				);
			}
		}
	}

	return chainable ?
		elems :

		// Gets
		bulk ?
			fn.call( elems ) :
			len ? fn( elems[ 0 ], key ) : emptyGet;
};
var acceptData = function( owner ) {

	// Accepts only:
	//  - Node
	//    - Node.ELEMENT_NODE
	//    - Node.DOCUMENT_NODE
	//  - Object
	//    - Any
	return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
};




function Data() {
	this.expando = jQuery.expando + Data.uid++;
}

Data.uid = 1;

Data.prototype = {

	cache: function( owner ) {

		// Check if the owner object already has a cache
		var value = owner[ this.expando ];

		// If not, create one
		if ( !value ) {
			value = {};

			// We can accept data for non-element nodes in modern browsers,
			// but we should not, see #8335.
			// Always return an empty object.
			if ( acceptData( owner ) ) {

				// If it is a node unlikely to be stringify-ed or looped over
				// use plain assignment
				if ( owner.nodeType ) {
					owner[ this.expando ] = value;

				// Otherwise secure it in a non-enumerable property
				// configurable must be true to allow the property to be
				// deleted when data is removed
				} else {
					Object.defineProperty( owner, this.expando, {
						value: value,
						configurable: true
					} );
				}
			}
		}

		return value;
	},
	set: function( owner, data, value ) {
		var prop,
			cache = this.cache( owner );

		// Handle: [ owner, key, value ] args
		// Always use camelCase key (gh-2257)
		if ( typeof data === "string" ) {
			cache[ jQuery.camelCase( data ) ] = value;

		// Handle: [ owner, { properties } ] args
		} else {

			// Copy the properties one-by-one to the cache object
			for ( prop in data ) {
				cache[ jQuery.camelCase( prop ) ] = data[ prop ];
			}
		}
		return cache;
	},
	get: function( owner, key ) {
		return key === undefined ?
			this.cache( owner ) :

			// Always use camelCase key (gh-2257)
			owner[ this.expando ] && owner[ this.expando ][ jQuery.camelCase( key ) ];
	},
	access: function( owner, key, value ) {

		// In cases where either:
		//
		//   1. No key was specified
		//   2. A string key was specified, but no value provided
		//
		// Take the "read" path and allow the get method to determine
		// which value to return, respectively either:
		//
		//   1. The entire cache object
		//   2. The data stored at the key
		//
		if ( key === undefined ||
				( ( key && typeof key === "string" ) && value === undefined ) ) {

			return this.get( owner, key );
		}

		// When the key is not a string, or both a key and value
		// are specified, set or extend (existing objects) with either:
		//
		//   1. An object of properties
		//   2. A key and value
		//
		this.set( owner, key, value );

		// Since the "set" path can have two possible entry points
		// return the expected data based on which path was taken[*]
		return value !== undefined ? value : key;
	},
	remove: function( owner, key ) {
		var i,
			cache = owner[ this.expando ];

		if ( cache === undefined ) {
			return;
		}

		if ( key !== undefined ) {

			// Support array or space separated string of keys
			if ( jQuery.isArray( key ) ) {

				// If key is an array of keys...
				// We always set camelCase keys, so remove that.
				key = key.map( jQuery.camelCase );
			} else {
				key = jQuery.camelCase( key );

				// If a key with the spaces exists, use it.
				// Otherwise, create an array by matching non-whitespace
				key = key in cache ?
					[ key ] :
					( key.match( rnotwhite ) || [] );
			}

			i = key.length;

			while ( i-- ) {
				delete cache[ key[ i ] ];
			}
		}

		// Remove the expando if there's no more data
		if ( key === undefined || jQuery.isEmptyObject( cache ) ) {

			// Support: Chrome <=35 - 45
			// Webkit & Blink performance suffers when deleting properties
			// from DOM nodes, so set to undefined instead
			// https://bugs.chromium.org/p/chromium/issues/detail?id=378607 (bug restricted)
			if ( owner.nodeType ) {
				owner[ this.expando ] = undefined;
			} else {
				delete owner[ this.expando ];
			}
		}
	},
	hasData: function( owner ) {
		var cache = owner[ this.expando ];
		return cache !== undefined && !jQuery.isEmptyObject( cache );
	}
};
var dataPriv = new Data();

var dataUser = new Data();



//	Implementation Summary
//
//	1. Enforce API surface and semantic compatibility with 1.9.x branch
//	2. Improve the module's maintainability by reducing the storage
//		paths to a single mechanism.
//	3. Use the same single mechanism to support "private" and "user" data.
//	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
//	5. Avoid exposing implementation details on user objects (eg. expando properties)
//	6. Provide a clear path for implementation upgrade to WeakMap in 2014

var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
	rmultiDash = /[A-Z]/g;

function dataAttr( elem, key, data ) {
	var name;

	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {
		name = "data-" + key.replace( rmultiDash, "-$&" ).toLowerCase();
		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = data === "true" ? true :
					data === "false" ? false :
					data === "null" ? null :

					// Only convert to a number if it doesn't change the string
					+data + "" === data ? +data :
					rbrace.test( data ) ? JSON.parse( data ) :
					data;
			} catch ( e ) {}

			// Make sure we set the data so it isn't changed later
			dataUser.set( elem, key, data );
		} else {
			data = undefined;
		}
	}
	return data;
}

jQuery.extend( {
	hasData: function( elem ) {
		return dataUser.hasData( elem ) || dataPriv.hasData( elem );
	},

	data: function( elem, name, data ) {
		return dataUser.access( elem, name, data );
	},

	removeData: function( elem, name ) {
		dataUser.remove( elem, name );
	},

	// TODO: Now that all calls to _data and _removeData have been replaced
	// with direct calls to dataPriv methods, these can be deprecated.
	_data: function( elem, name, data ) {
		return dataPriv.access( elem, name, data );
	},

	_removeData: function( elem, name ) {
		dataPriv.remove( elem, name );
	}
} );

jQuery.fn.extend( {
	data: function( key, value ) {
		var i, name, data,
			elem = this[ 0 ],
			attrs = elem && elem.attributes;

		// Gets all values
		if ( key === undefined ) {
			if ( this.length ) {
				data = dataUser.get( elem );

				if ( elem.nodeType === 1 && !dataPriv.get( elem, "hasDataAttrs" ) ) {
					i = attrs.length;
					while ( i-- ) {

						// Support: IE 11 only
						// The attrs elements can be null (#14894)
						if ( attrs[ i ] ) {
							name = attrs[ i ].name;
							if ( name.indexOf( "data-" ) === 0 ) {
								name = jQuery.camelCase( name.slice( 5 ) );
								dataAttr( elem, name, data[ name ] );
							}
						}
					}
					dataPriv.set( elem, "hasDataAttrs", true );
				}
			}

			return data;
		}

		// Sets multiple values
		if ( typeof key === "object" ) {
			return this.each( function() {
				dataUser.set( this, key );
			} );
		}

		return access( this, function( value ) {
			var data;

			// The calling jQuery object (element matches) is not empty
			// (and therefore has an element appears at this[ 0 ]) and the
			// `value` parameter was not undefined. An empty jQuery object
			// will result in `undefined` for elem = this[ 0 ] which will
			// throw an exception if an attempt to read a data cache is made.
			if ( elem && value === undefined ) {

				// Attempt to get data from the cache
				// The key will always be camelCased in Data
				data = dataUser.get( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to "discover" the data in
				// HTML5 custom data-* attrs
				data = dataAttr( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// We tried really hard, but the data doesn't exist.
				return;
			}

			// Set the data...
			this.each( function() {

				// We always store the camelCased key
				dataUser.set( this, key, value );
			} );
		}, null, value, arguments.length > 1, null, true );
	},

	removeData: function( key ) {
		return this.each( function() {
			dataUser.remove( this, key );
		} );
	}
} );


jQuery.extend( {
	queue: function( elem, type, data ) {
		var queue;

		if ( elem ) {
			type = ( type || "fx" ) + "queue";
			queue = dataPriv.get( elem, type );

			// Speed up dequeue by getting out quickly if this is just a lookup
			if ( data ) {
				if ( !queue || jQuery.isArray( data ) ) {
					queue = dataPriv.access( elem, type, jQuery.makeArray( data ) );
				} else {
					queue.push( data );
				}
			}
			return queue || [];
		}
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ),
			startLength = queue.length,
			fn = queue.shift(),
			hooks = jQuery._queueHooks( elem, type ),
			next = function() {
				jQuery.dequeue( elem, type );
			};

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
			startLength--;
		}

		if ( fn ) {

			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift( "inprogress" );
			}

			// Clear up the last queue stop function
			delete hooks.stop;
			fn.call( elem, next, hooks );
		}

		if ( !startLength && hooks ) {
			hooks.empty.fire();
		}
	},

	// Not public - generate a queueHooks object, or return the current one
	_queueHooks: function( elem, type ) {
		var key = type + "queueHooks";
		return dataPriv.get( elem, key ) || dataPriv.access( elem, key, {
			empty: jQuery.Callbacks( "once memory" ).add( function() {
				dataPriv.remove( elem, [ type + "queue", key ] );
			} )
		} );
	}
} );

jQuery.fn.extend( {
	queue: function( type, data ) {
		var setter = 2;

		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
			setter--;
		}

		if ( arguments.length < setter ) {
			return jQuery.queue( this[ 0 ], type );
		}

		return data === undefined ?
			this :
			this.each( function() {
				var queue = jQuery.queue( this, type, data );

				// Ensure a hooks for this queue
				jQuery._queueHooks( this, type );

				if ( type === "fx" && queue[ 0 ] !== "inprogress" ) {
					jQuery.dequeue( this, type );
				}
			} );
	},
	dequeue: function( type ) {
		return this.each( function() {
			jQuery.dequeue( this, type );
		} );
	},
	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	},

	// Get a promise resolved when queues of a certain type
	// are emptied (fx is the type by default)
	promise: function( type, obj ) {
		var tmp,
			count = 1,
			defer = jQuery.Deferred(),
			elements = this,
			i = this.length,
			resolve = function() {
				if ( !( --count ) ) {
					defer.resolveWith( elements, [ elements ] );
				}
			};

		if ( typeof type !== "string" ) {
			obj = type;
			type = undefined;
		}
		type = type || "fx";

		while ( i-- ) {
			tmp = dataPriv.get( elements[ i ], type + "queueHooks" );
			if ( tmp && tmp.empty ) {
				count++;
				tmp.empty.add( resolve );
			}
		}
		resolve();
		return defer.promise( obj );
	}
} );
var pnum = ( /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/ ).source;

var rcssNum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" );


var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

var isHiddenWithinTree = function( elem, el ) {

		// isHiddenWithinTree might be called from jQuery#filter function;
		// in that case, element will be second argument
		elem = el || elem;

		// Inline style trumps all
		return elem.style.display === "none" ||
			elem.style.display === "" &&

			// Otherwise, check computed style
			// Support: Firefox <=43 - 45
			// Disconnected elements can have computed display: none, so first confirm that elem is
			// in the document.
			jQuery.contains( elem.ownerDocument, elem ) &&

			jQuery.css( elem, "display" ) === "none";
	};

var swap = function( elem, options, callback, args ) {
	var ret, name,
		old = {};

	// Remember the old values, and insert the new ones
	for ( name in options ) {
		old[ name ] = elem.style[ name ];
		elem.style[ name ] = options[ name ];
	}

	ret = callback.apply( elem, args || [] );

	// Revert the old values
	for ( name in options ) {
		elem.style[ name ] = old[ name ];
	}

	return ret;
};




function adjustCSS( elem, prop, valueParts, tween ) {
	var adjusted,
		scale = 1,
		maxIterations = 20,
		currentValue = tween ?
			function() {
				return tween.cur();
			} :
			function() {
				return jQuery.css( elem, prop, "" );
			},
		initial = currentValue(),
		unit = valueParts && valueParts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

		// Starting value computation is required for potential unit mismatches
		initialInUnit = ( jQuery.cssNumber[ prop ] || unit !== "px" && +initial ) &&
			rcssNum.exec( jQuery.css( elem, prop ) );

	if ( initialInUnit && initialInUnit[ 3 ] !== unit ) {

		// Trust units reported by jQuery.css
		unit = unit || initialInUnit[ 3 ];

		// Make sure we update the tween properties later on
		valueParts = valueParts || [];

		// Iteratively approximate from a nonzero starting point
		initialInUnit = +initial || 1;

		do {

			// If previous iteration zeroed out, double until we get *something*.
			// Use string for doubling so we don't accidentally see scale as unchanged below
			scale = scale || ".5";

			// Adjust and apply
			initialInUnit = initialInUnit / scale;
			jQuery.style( elem, prop, initialInUnit + unit );

		// Update scale, tolerating zero or NaN from tween.cur()
		// Break the loop if scale is unchanged or perfect, or if we've just had enough.
		} while (
			scale !== ( scale = currentValue() / initial ) && scale !== 1 && --maxIterations
		);
	}

	if ( valueParts ) {
		initialInUnit = +initialInUnit || +initial || 0;

		// Apply relative offset (+=/-=) if specified
		adjusted = valueParts[ 1 ] ?
			initialInUnit + ( valueParts[ 1 ] + 1 ) * valueParts[ 2 ] :
			+valueParts[ 2 ];
		if ( tween ) {
			tween.unit = unit;
			tween.start = initialInUnit;
			tween.end = adjusted;
		}
	}
	return adjusted;
}


var defaultDisplayMap = {};

function getDefaultDisplay( elem ) {
	var temp,
		doc = elem.ownerDocument,
		nodeName = elem.nodeName,
		display = defaultDisplayMap[ nodeName ];

	if ( display ) {
		return display;
	}

	temp = doc.body.appendChild( doc.createElement( nodeName ) ),
	display = jQuery.css( temp, "display" );

	temp.parentNode.removeChild( temp );

	if ( display === "none" ) {
		display = "block";
	}
	defaultDisplayMap[ nodeName ] = display;

	return display;
}

function showHide( elements, show ) {
	var display, elem,
		values = [],
		index = 0,
		length = elements.length;

	// Determine new display value for elements that need to change
	for ( ; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}

		display = elem.style.display;
		if ( show ) {

			// Since we force visibility upon cascade-hidden elements, an immediate (and slow)
			// check is required in this first loop unless we have a nonempty display value (either
			// inline or about-to-be-restored)
			if ( display === "none" ) {
				values[ index ] = dataPriv.get( elem, "display" ) || null;
				if ( !values[ index ] ) {
					elem.style.display = "";
				}
			}
			if ( elem.style.display === "" && isHiddenWithinTree( elem ) ) {
				values[ index ] = getDefaultDisplay( elem );
			}
		} else {
			if ( display !== "none" ) {
				values[ index ] = "none";

				// Remember what we're overwriting
				dataPriv.set( elem, "display", display );
			}
		}
	}

	// Set the display of the elements in a second loop to avoid constant reflow
	for ( index = 0; index < length; index++ ) {
		if ( values[ index ] != null ) {
			elements[ index ].style.display = values[ index ];
		}
	}

	return elements;
}

jQuery.fn.extend( {
	show: function() {
		return showHide( this, true );
	},
	hide: function() {
		return showHide( this );
	},
	toggle: function( state ) {
		if ( typeof state === "boolean" ) {
			return state ? this.show() : this.hide();
		}

		return this.each( function() {
			if ( isHiddenWithinTree( this ) ) {
				jQuery( this ).show();
			} else {
				jQuery( this ).hide();
			}
		} );
	}
} );
var rcheckableType = ( /^(?:checkbox|radio)$/i );

var rtagName = ( /<([a-z][^\/\0>\x20\t\r\n\f]+)/i );

var rscriptType = ( /^$|\/(?:java|ecma)script/i );



// We have to close these tags to support XHTML (#13200)
var wrapMap = {

	// Support: IE <=9 only
	option: [ 1, "<select multiple='multiple'>", "</select>" ],

	// XHTML parsers do not magically insert elements in the
	// same way that tag soup parsers do. So we cannot shorten
	// this by omitting <tbody> or other required elements.
	thead: [ 1, "<table>", "</table>" ],
	col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
	tr: [ 2, "<table><tbody>", "</tbody></table>" ],
	td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

	_default: [ 0, "", "" ]
};

// Support: IE <=9 only
wrapMap.optgroup = wrapMap.option;

wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;


function getAll( context, tag ) {

	// Support: IE <=9 - 11 only
	// Use typeof to avoid zero-argument method invocation on host objects (#15151)
	var ret = typeof context.getElementsByTagName !== "undefined" ?
			context.getElementsByTagName( tag || "*" ) :
			typeof context.querySelectorAll !== "undefined" ?
				context.querySelectorAll( tag || "*" ) :
			[];

	return tag === undefined || tag && jQuery.nodeName( context, tag ) ?
		jQuery.merge( [ context ], ret ) :
		ret;
}


// Mark scripts as having already been evaluated
function setGlobalEval( elems, refElements ) {
	var i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		dataPriv.set(
			elems[ i ],
			"globalEval",
			!refElements || dataPriv.get( refElements[ i ], "globalEval" )
		);
	}
}


var rhtml = /<|&#?\w+;/;

function buildFragment( elems, context, scripts, selection, ignored ) {
	var elem, tmp, tag, wrap, contains, j,
		fragment = context.createDocumentFragment(),
		nodes = [],
		i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		elem = elems[ i ];

		if ( elem || elem === 0 ) {

			// Add nodes directly
			if ( jQuery.type( elem ) === "object" ) {

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

			// Convert non-html into a text node
			} else if ( !rhtml.test( elem ) ) {
				nodes.push( context.createTextNode( elem ) );

			// Convert html into DOM nodes
			} else {
				tmp = tmp || fragment.appendChild( context.createElement( "div" ) );

				// Deserialize a standard representation
				tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
				wrap = wrapMap[ tag ] || wrapMap._default;
				tmp.innerHTML = wrap[ 1 ] + jQuery.htmlPrefilter( elem ) + wrap[ 2 ];

				// Descend through wrappers to the right content
				j = wrap[ 0 ];
				while ( j-- ) {
					tmp = tmp.lastChild;
				}

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, tmp.childNodes );

				// Remember the top-level container
				tmp = fragment.firstChild;

				// Ensure the created nodes are orphaned (#12392)
				tmp.textContent = "";
			}
		}
	}

	// Remove wrapper from fragment
	fragment.textContent = "";

	i = 0;
	while ( ( elem = nodes[ i++ ] ) ) {

		// Skip elements already in the context collection (trac-4087)
		if ( selection && jQuery.inArray( elem, selection ) > -1 ) {
			if ( ignored ) {
				ignored.push( elem );
			}
			continue;
		}

		contains = jQuery.contains( elem.ownerDocument, elem );

		// Append to fragment
		tmp = getAll( fragment.appendChild( elem ), "script" );

		// Preserve script evaluation history
		if ( contains ) {
			setGlobalEval( tmp );
		}

		// Capture executables
		if ( scripts ) {
			j = 0;
			while ( ( elem = tmp[ j++ ] ) ) {
				if ( rscriptType.test( elem.type || "" ) ) {
					scripts.push( elem );
				}
			}
		}
	}

	return fragment;
}


( function() {
	var fragment = document.createDocumentFragment(),
		div = fragment.appendChild( document.createElement( "div" ) ),
		input = document.createElement( "input" );

	// Support: Android 4.0 - 4.3 only
	// Check state lost if the name is set (#11217)
	// Support: Windows Web Apps (WWA)
	// `name` and `type` must use .setAttribute for WWA (#14901)
	input.setAttribute( "type", "radio" );
	input.setAttribute( "checked", "checked" );
	input.setAttribute( "name", "t" );

	div.appendChild( input );

	// Support: Android <=4.1 only
	// Older WebKit doesn't clone checked state correctly in fragments
	support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

	// Support: IE <=11 only
	// Make sure textarea (and checkbox) defaultValue is properly cloned
	div.innerHTML = "<textarea>x</textarea>";
	support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;
} )();
var documentElement = document.documentElement;



var
	rkeyEvent = /^key/,
	rmouseEvent = /^(?:mouse|pointer|contextmenu|drag|drop)|click/,
	rtypenamespace = /^([^.]*)(?:\.(.+)|)/;

function returnTrue() {
	return true;
}

function returnFalse() {
	return false;
}

// Support: IE <=9 only
// See #13393 for more info
function safeActiveElement() {
	try {
		return document.activeElement;
	} catch ( err ) { }
}

function on( elem, types, selector, data, fn, one ) {
	var origFn, type;

	// Types can be a map of types/handlers
	if ( typeof types === "object" ) {

		// ( types-Object, selector, data )
		if ( typeof selector !== "string" ) {

			// ( types-Object, data )
			data = data || selector;
			selector = undefined;
		}
		for ( type in types ) {
			on( elem, type, selector, data, types[ type ], one );
		}
		return elem;
	}

	if ( data == null && fn == null ) {

		// ( types, fn )
		fn = selector;
		data = selector = undefined;
	} else if ( fn == null ) {
		if ( typeof selector === "string" ) {

			// ( types, selector, fn )
			fn = data;
			data = undefined;
		} else {

			// ( types, data, fn )
			fn = data;
			data = selector;
			selector = undefined;
		}
	}
	if ( fn === false ) {
		fn = returnFalse;
	} else if ( !fn ) {
		return elem;
	}

	if ( one === 1 ) {
		origFn = fn;
		fn = function( event ) {

			// Can use an empty set, since event contains the info
			jQuery().off( event );
			return origFn.apply( this, arguments );
		};

		// Use same guid so caller can remove using origFn
		fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
	}
	return elem.each( function() {
		jQuery.event.add( this, types, fn, data, selector );
	} );
}

/*
 * Helper functions for managing events -- not part of the public interface.
 * Props to Dean Edwards' addEvent library for many of the ideas.
 */
jQuery.event = {

	global: {},

	add: function( elem, types, handler, data, selector ) {

		var handleObjIn, eventHandle, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.get( elem );

		// Don't attach events to noData or text/comment nodes (but allow plain objects)
		if ( !elemData ) {
			return;
		}

		// Caller can pass in an object of custom data in lieu of the handler
		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
			selector = handleObjIn.selector;
		}

		// Ensure that invalid selectors throw exceptions at attach time
		// Evaluate against documentElement in case elem is a non-element node (e.g., document)
		if ( selector ) {
			jQuery.find.matchesSelector( documentElement, selector );
		}

		// Make sure that the handler has a unique ID, used to find/remove it later
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure and main handler, if this is the first
		if ( !( events = elemData.events ) ) {
			events = elemData.events = {};
		}
		if ( !( eventHandle = elemData.handle ) ) {
			eventHandle = elemData.handle = function( e ) {

				// Discard the second event of a jQuery.event.trigger() and
				// when an event is called after a page has unloaded
				return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
					jQuery.event.dispatch.apply( elem, arguments ) : undefined;
			};
		}

		// Handle multiple events separated by a space
		types = ( types || "" ).match( rnotwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// There *must* be a type, no attaching namespace-only handlers
			if ( !type ) {
				continue;
			}

			// If event changes its type, use the special event handlers for the changed type
			special = jQuery.event.special[ type ] || {};

			// If selector defined, determine special event api type, otherwise given type
			type = ( selector ? special.delegateType : special.bindType ) || type;

			// Update special based on newly reset type
			special = jQuery.event.special[ type ] || {};

			// handleObj is passed to all event handlers
			handleObj = jQuery.extend( {
				type: type,
				origType: origType,
				data: data,
				handler: handler,
				guid: handler.guid,
				selector: selector,
				needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
				namespace: namespaces.join( "." )
			}, handleObjIn );

			// Init the event handler queue if we're the first
			if ( !( handlers = events[ type ] ) ) {
				handlers = events[ type ] = [];
				handlers.delegateCount = 0;

				// Only use addEventListener if the special events handler returns false
				if ( !special.setup ||
					special.setup.call( elem, data, namespaces, eventHandle ) === false ) {

					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle );
					}
				}
			}

			if ( special.add ) {
				special.add.call( elem, handleObj );

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add to the element's handler list, delegates in front
			if ( selector ) {
				handlers.splice( handlers.delegateCount++, 0, handleObj );
			} else {
				handlers.push( handleObj );
			}

			// Keep track of which events have ever been used, for event optimization
			jQuery.event.global[ type ] = true;
		}

	},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, selector, mappedTypes ) {

		var j, origCount, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.hasData( elem ) && dataPriv.get( elem );

		if ( !elemData || !( events = elemData.events ) ) {
			return;
		}

		// Once for each type.namespace in types; type may be omitted
		types = ( types || "" ).match( rnotwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// Unbind all events (on this namespace, if provided) for the element
			if ( !type ) {
				for ( type in events ) {
					jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
				}
				continue;
			}

			special = jQuery.event.special[ type ] || {};
			type = ( selector ? special.delegateType : special.bindType ) || type;
			handlers = events[ type ] || [];
			tmp = tmp[ 2 ] &&
				new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" );

			// Remove matching events
			origCount = j = handlers.length;
			while ( j-- ) {
				handleObj = handlers[ j ];

				if ( ( mappedTypes || origType === handleObj.origType ) &&
					( !handler || handler.guid === handleObj.guid ) &&
					( !tmp || tmp.test( handleObj.namespace ) ) &&
					( !selector || selector === handleObj.selector ||
						selector === "**" && handleObj.selector ) ) {
					handlers.splice( j, 1 );

					if ( handleObj.selector ) {
						handlers.delegateCount--;
					}
					if ( special.remove ) {
						special.remove.call( elem, handleObj );
					}
				}
			}

			// Remove generic event handler if we removed something and no more handlers exist
			// (avoids potential for endless recursion during removal of special event handlers)
			if ( origCount && !handlers.length ) {
				if ( !special.teardown ||
					special.teardown.call( elem, namespaces, elemData.handle ) === false ) {

					jQuery.removeEvent( elem, type, elemData.handle );
				}

				delete events[ type ];
			}
		}

		// Remove data and the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			dataPriv.remove( elem, "handle events" );
		}
	},

	dispatch: function( nativeEvent ) {

		// Make a writable jQuery.Event from the native event object
		var event = jQuery.event.fix( nativeEvent );

		var i, j, ret, matched, handleObj, handlerQueue,
			args = new Array( arguments.length ),
			handlers = ( dataPriv.get( this, "events" ) || {} )[ event.type ] || [],
			special = jQuery.event.special[ event.type ] || {};

		// Use the fix-ed jQuery.Event rather than the (read-only) native event
		args[ 0 ] = event;

		for ( i = 1; i < arguments.length; i++ ) {
			args[ i ] = arguments[ i ];
		}

		event.delegateTarget = this;

		// Call the preDispatch hook for the mapped type, and let it bail if desired
		if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
			return;
		}

		// Determine handlers
		handlerQueue = jQuery.event.handlers.call( this, event, handlers );

		// Run delegates first; they may want to stop propagation beneath us
		i = 0;
		while ( ( matched = handlerQueue[ i++ ] ) && !event.isPropagationStopped() ) {
			event.currentTarget = matched.elem;

			j = 0;
			while ( ( handleObj = matched.handlers[ j++ ] ) &&
				!event.isImmediatePropagationStopped() ) {

				// Triggered event must either 1) have no namespace, or 2) have namespace(s)
				// a subset or equal to those in the bound event (both can have no namespace).
				if ( !event.rnamespace || event.rnamespace.test( handleObj.namespace ) ) {

					event.handleObj = handleObj;
					event.data = handleObj.data;

					ret = ( ( jQuery.event.special[ handleObj.origType ] || {} ).handle ||
						handleObj.handler ).apply( matched.elem, args );

					if ( ret !== undefined ) {
						if ( ( event.result = ret ) === false ) {
							event.preventDefault();
							event.stopPropagation();
						}
					}
				}
			}
		}

		// Call the postDispatch hook for the mapped type
		if ( special.postDispatch ) {
			special.postDispatch.call( this, event );
		}

		return event.result;
	},

	handlers: function( event, handlers ) {
		var i, matches, sel, handleObj,
			handlerQueue = [],
			delegateCount = handlers.delegateCount,
			cur = event.target;

		// Support: IE <=9
		// Find delegate handlers
		// Black-hole SVG <use> instance trees (#13180)
		//
		// Support: Firefox <=42
		// Avoid non-left-click in FF but don't block IE radio events (#3861, gh-2343)
		if ( delegateCount && cur.nodeType &&
			( event.type !== "click" || isNaN( event.button ) || event.button < 1 ) ) {

			for ( ; cur !== this; cur = cur.parentNode || this ) {

				// Don't check non-elements (#13208)
				// Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
				if ( cur.nodeType === 1 && ( cur.disabled !== true || event.type !== "click" ) ) {
					matches = [];
					for ( i = 0; i < delegateCount; i++ ) {
						handleObj = handlers[ i ];

						// Don't conflict with Object.prototype properties (#13203)
						sel = handleObj.selector + " ";

						if ( matches[ sel ] === undefined ) {
							matches[ sel ] = handleObj.needsContext ?
								jQuery( sel, this ).index( cur ) > -1 :
								jQuery.find( sel, this, null, [ cur ] ).length;
						}
						if ( matches[ sel ] ) {
							matches.push( handleObj );
						}
					}
					if ( matches.length ) {
						handlerQueue.push( { elem: cur, handlers: matches } );
					}
				}
			}
		}

		// Add the remaining (directly-bound) handlers
		if ( delegateCount < handlers.length ) {
			handlerQueue.push( { elem: this, handlers: handlers.slice( delegateCount ) } );
		}

		return handlerQueue;
	},

	addProp: function( name, hook ) {
		Object.defineProperty( jQuery.Event.prototype, name, {
			enumerable: true,
			configurable: true,

			get: jQuery.isFunction( hook ) ?
				function() {
					if ( this.originalEvent ) {
							return hook( this.originalEvent );
					}
				} :
				function() {
					if ( this.originalEvent ) {
							return this.originalEvent[ name ];
					}
				},

			set: function( value ) {
				Object.defineProperty( this, name, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: value
				} );
			}
		} );
	},

	fix: function( originalEvent ) {
		return originalEvent[ jQuery.expando ] ?
			originalEvent :
			new jQuery.Event( originalEvent );
	},

	special: {
		load: {

			// Prevent triggered image.load events from bubbling to window.load
			noBubble: true
		},
		focus: {

			// Fire native event if possible so blur/focus sequence is correct
			trigger: function() {
				if ( this !== safeActiveElement() && this.focus ) {
					this.focus();
					return false;
				}
			},
			delegateType: "focusin"
		},
		blur: {
			trigger: function() {
				if ( this === safeActiveElement() && this.blur ) {
					this.blur();
					return false;
				}
			},
			delegateType: "focusout"
		},
		click: {

			// For checkbox, fire native event so checked state will be right
			trigger: function() {
				if ( this.type === "checkbox" && this.click && jQuery.nodeName( this, "input" ) ) {
					this.click();
					return false;
				}
			},

			// For cross-browser consistency, don't fire native .click() on links
			_default: function( event ) {
				return jQuery.nodeName( event.target, "a" );
			}
		},

		beforeunload: {
			postDispatch: function( event ) {

				// Support: Firefox 20+
				// Firefox doesn't alert if the returnValue field is not set.
				if ( event.result !== undefined && event.originalEvent ) {
					event.originalEvent.returnValue = event.result;
				}
			}
		}
	}
};

jQuery.removeEvent = function( elem, type, handle ) {

	// This "if" is needed for plain objects
	if ( elem.removeEventListener ) {
		elem.removeEventListener( type, handle );
	}
};

jQuery.Event = function( src, props ) {

	// Allow instantiation without the 'new' keyword
	if ( !( this instanceof jQuery.Event ) ) {
		return new jQuery.Event( src, props );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;

		// Events bubbling up the document may have been marked as prevented
		// by a handler lower down the tree; reflect the correct value.
		this.isDefaultPrevented = src.defaultPrevented ||
				src.defaultPrevented === undefined &&

				// Support: Android <=2.3 only
				src.returnValue === false ?
			returnTrue :
			returnFalse;

		// Create target properties
		// Support: Safari <=6 - 7 only
		// Target should not be a text node (#504, #13143)
		this.target = ( src.target && src.target.nodeType === 3 ) ?
			src.target.parentNode :
			src.target;

		this.currentTarget = src.currentTarget;
		this.relatedTarget = src.relatedTarget;

	// Event type
	} else {
		this.type = src;
	}

	// Put explicitly provided properties onto the event object
	if ( props ) {
		jQuery.extend( this, props );
	}

	// Create a timestamp if incoming event doesn't have one
	this.timeStamp = src && src.timeStamp || jQuery.now();

	// Mark it as fixed
	this[ jQuery.expando ] = true;
};

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// https://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	constructor: jQuery.Event,
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse,
	isSimulated: false,

	preventDefault: function() {
		var e = this.originalEvent;

		this.isDefaultPrevented = returnTrue;

		if ( e && !this.isSimulated ) {
			e.preventDefault();
		}
	},
	stopPropagation: function() {
		var e = this.originalEvent;

		this.isPropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopPropagation();
		}
	},
	stopImmediatePropagation: function() {
		var e = this.originalEvent;

		this.isImmediatePropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopImmediatePropagation();
		}

		this.stopPropagation();
	}
};

// Includes all common event props including KeyEvent and MouseEvent specific props
jQuery.each( {
	altKey: true,
	bubbles: true,
	cancelable: true,
	changedTouches: true,
	ctrlKey: true,
	detail: true,
	eventPhase: true,
	metaKey: true,
	pageX: true,
	pageY: true,
	shiftKey: true,
	view: true,
	"char": true,
	charCode: true,
	key: true,
	keyCode: true,
	button: true,
	buttons: true,
	clientX: true,
	clientY: true,
	offsetX: true,
	offsetY: true,
	pointerId: true,
	pointerType: true,
	screenX: true,
	screenY: true,
	targetTouches: true,
	toElement: true,
	touches: true,

	which: function( event ) {
		var button = event.button;

		// Add which for key events
		if ( event.which == null && rkeyEvent.test( event.type ) ) {
			return event.charCode != null ? event.charCode : event.keyCode;
		}

		// Add which for click: 1 === left; 2 === middle; 3 === right
		if ( !event.which && button !== undefined && rmouseEvent.test( event.type ) ) {
			return ( button & 1 ? 1 : ( button & 2 ? 3 : ( button & 4 ? 2 : 0 ) ) );
		}

		return event.which;
	}
}, jQuery.event.addProp );

// Create mouseenter/leave events using mouseover/out and event-time checks
// so that event delegation works in jQuery.
// Do the same for pointerenter/pointerleave and pointerover/pointerout
//
// Support: Safari 7 only
// Safari sends mouseenter too often; see:
// https://bugs.chromium.org/p/chromium/issues/detail?id=470258
// for the description of the bug (it existed in older Chrome versions as well).
jQuery.each( {
	mouseenter: "mouseover",
	mouseleave: "mouseout",
	pointerenter: "pointerover",
	pointerleave: "pointerout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		delegateType: fix,
		bindType: fix,

		handle: function( event ) {
			var ret,
				target = this,
				related = event.relatedTarget,
				handleObj = event.handleObj;

			// For mouseenter/leave call the handler if related is outside the target.
			// NB: No relatedTarget if the mouse left/entered the browser window
			if ( !related || ( related !== target && !jQuery.contains( target, related ) ) ) {
				event.type = handleObj.origType;
				ret = handleObj.handler.apply( this, arguments );
				event.type = fix;
			}
			return ret;
		}
	};
} );

jQuery.fn.extend( {

	on: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn );
	},
	one: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn, 1 );
	},
	off: function( types, selector, fn ) {
		var handleObj, type;
		if ( types && types.preventDefault && types.handleObj ) {

			// ( event )  dispatched jQuery.Event
			handleObj = types.handleObj;
			jQuery( types.delegateTarget ).off(
				handleObj.namespace ?
					handleObj.origType + "." + handleObj.namespace :
					handleObj.origType,
				handleObj.selector,
				handleObj.handler
			);
			return this;
		}
		if ( typeof types === "object" ) {

			// ( types-object [, selector] )
			for ( type in types ) {
				this.off( type, selector, types[ type ] );
			}
			return this;
		}
		if ( selector === false || typeof selector === "function" ) {

			// ( types [, fn] )
			fn = selector;
			selector = undefined;
		}
		if ( fn === false ) {
			fn = returnFalse;
		}
		return this.each( function() {
			jQuery.event.remove( this, types, fn, selector );
		} );
	}
} );


var

	/* eslint-disable max-len */

	// See https://github.com/eslint/eslint/issues/3229
	rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi,

	/* eslint-enable */

	// Support: IE <=10 - 11, Edge 12 - 13
	// In IE/Edge using regex groups here causes severe slowdowns.
	// See https://connect.microsoft.com/IE/feedback/details/1736512/
	rnoInnerhtml = /<script|<style|<link/i,

	// checked="checked" or checked
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
	rscriptTypeMasked = /^true\/(.*)/,
	rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;

function manipulationTarget( elem, content ) {
	if ( jQuery.nodeName( elem, "table" ) &&
		jQuery.nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {

		return elem.getElementsByTagName( "tbody" )[ 0 ] || elem;
	}

	return elem;
}

// Replace/restore the type attribute of script elements for safe DOM manipulation
function disableScript( elem ) {
	elem.type = ( elem.getAttribute( "type" ) !== null ) + "/" + elem.type;
	return elem;
}
function restoreScript( elem ) {
	var match = rscriptTypeMasked.exec( elem.type );

	if ( match ) {
		elem.type = match[ 1 ];
	} else {
		elem.removeAttribute( "type" );
	}

	return elem;
}

function cloneCopyEvent( src, dest ) {
	var i, l, type, pdataOld, pdataCur, udataOld, udataCur, events;

	if ( dest.nodeType !== 1 ) {
		return;
	}

	// 1. Copy private data: events, handlers, etc.
	if ( dataPriv.hasData( src ) ) {
		pdataOld = dataPriv.access( src );
		pdataCur = dataPriv.set( dest, pdataOld );
		events = pdataOld.events;

		if ( events ) {
			delete pdataCur.handle;
			pdataCur.events = {};

			for ( type in events ) {
				for ( i = 0, l = events[ type ].length; i < l; i++ ) {
					jQuery.event.add( dest, type, events[ type ][ i ] );
				}
			}
		}
	}

	// 2. Copy user data
	if ( dataUser.hasData( src ) ) {
		udataOld = dataUser.access( src );
		udataCur = jQuery.extend( {}, udataOld );

		dataUser.set( dest, udataCur );
	}
}

// Fix IE bugs, see support tests
function fixInput( src, dest ) {
	var nodeName = dest.nodeName.toLowerCase();

	// Fails to persist the checked state of a cloned checkbox or radio button.
	if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
		dest.checked = src.checked;

	// Fails to return the selected option to the default selected state when cloning options
	} else if ( nodeName === "input" || nodeName === "textarea" ) {
		dest.defaultValue = src.defaultValue;
	}
}

function domManip( collection, args, callback, ignored ) {

	// Flatten any nested arrays
	args = concat.apply( [], args );

	var fragment, first, scripts, hasScripts, node, doc,
		i = 0,
		l = collection.length,
		iNoClone = l - 1,
		value = args[ 0 ],
		isFunction = jQuery.isFunction( value );

	// We can't cloneNode fragments that contain checked, in WebKit
	if ( isFunction ||
			( l > 1 && typeof value === "string" &&
				!support.checkClone && rchecked.test( value ) ) ) {
		return collection.each( function( index ) {
			var self = collection.eq( index );
			if ( isFunction ) {
				args[ 0 ] = value.call( this, index, self.html() );
			}
			domManip( self, args, callback, ignored );
		} );
	}

	if ( l ) {
		fragment = buildFragment( args, collection[ 0 ].ownerDocument, false, collection, ignored );
		first = fragment.firstChild;

		if ( fragment.childNodes.length === 1 ) {
			fragment = first;
		}

		// Require either new content or an interest in ignored elements to invoke the callback
		if ( first || ignored ) {
			scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
			hasScripts = scripts.length;

			// Use the original fragment for the last item
			// instead of the first because it can end up
			// being emptied incorrectly in certain situations (#8070).
			for ( ; i < l; i++ ) {
				node = fragment;

				if ( i !== iNoClone ) {
					node = jQuery.clone( node, true, true );

					// Keep references to cloned scripts for later restoration
					if ( hasScripts ) {

						// Support: Android <=4.0 only, PhantomJS 1 only
						// push.apply(_, arraylike) throws on ancient WebKit
						jQuery.merge( scripts, getAll( node, "script" ) );
					}
				}

				callback.call( collection[ i ], node, i );
			}

			if ( hasScripts ) {
				doc = scripts[ scripts.length - 1 ].ownerDocument;

				// Reenable scripts
				jQuery.map( scripts, restoreScript );

				// Evaluate executable scripts on first document insertion
				for ( i = 0; i < hasScripts; i++ ) {
					node = scripts[ i ];
					if ( rscriptType.test( node.type || "" ) &&
						!dataPriv.access( node, "globalEval" ) &&
						jQuery.contains( doc, node ) ) {

						if ( node.src ) {

							// Optional AJAX dependency, but won't run scripts if not present
							if ( jQuery._evalUrl ) {
								jQuery._evalUrl( node.src );
							}
						} else {
							DOMEval( node.textContent.replace( rcleanScript, "" ), doc );
						}
					}
				}
			}
		}
	}

	return collection;
}

function remove( elem, selector, keepData ) {
	var node,
		nodes = selector ? jQuery.filter( selector, elem ) : elem,
		i = 0;

	for ( ; ( node = nodes[ i ] ) != null; i++ ) {
		if ( !keepData && node.nodeType === 1 ) {
			jQuery.cleanData( getAll( node ) );
		}

		if ( node.parentNode ) {
			if ( keepData && jQuery.contains( node.ownerDocument, node ) ) {
				setGlobalEval( getAll( node, "script" ) );
			}
			node.parentNode.removeChild( node );
		}
	}

	return elem;
}

jQuery.extend( {
	htmlPrefilter: function( html ) {
		return html.replace( rxhtmlTag, "<$1></$2>" );
	},

	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
		var i, l, srcElements, destElements,
			clone = elem.cloneNode( true ),
			inPage = jQuery.contains( elem.ownerDocument, elem );

		// Fix IE cloning issues
		if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
				!jQuery.isXMLDoc( elem ) ) {

			// We eschew Sizzle here for performance reasons: https://jsperf.com/getall-vs-sizzle/2
			destElements = getAll( clone );
			srcElements = getAll( elem );

			for ( i = 0, l = srcElements.length; i < l; i++ ) {
				fixInput( srcElements[ i ], destElements[ i ] );
			}
		}

		// Copy the events from the original to the clone
		if ( dataAndEvents ) {
			if ( deepDataAndEvents ) {
				srcElements = srcElements || getAll( elem );
				destElements = destElements || getAll( clone );

				for ( i = 0, l = srcElements.length; i < l; i++ ) {
					cloneCopyEvent( srcElements[ i ], destElements[ i ] );
				}
			} else {
				cloneCopyEvent( elem, clone );
			}
		}

		// Preserve script evaluation history
		destElements = getAll( clone, "script" );
		if ( destElements.length > 0 ) {
			setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
		}

		// Return the cloned set
		return clone;
	},

	cleanData: function( elems ) {
		var data, elem, type,
			special = jQuery.event.special,
			i = 0;

		for ( ; ( elem = elems[ i ] ) !== undefined; i++ ) {
			if ( acceptData( elem ) ) {
				if ( ( data = elem[ dataPriv.expando ] ) ) {
					if ( data.events ) {
						for ( type in data.events ) {
							if ( special[ type ] ) {
								jQuery.event.remove( elem, type );

							// This is a shortcut to avoid jQuery.event.remove's overhead
							} else {
								jQuery.removeEvent( elem, type, data.handle );
							}
						}
					}

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataPriv.expando ] = undefined;
				}
				if ( elem[ dataUser.expando ] ) {

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataUser.expando ] = undefined;
				}
			}
		}
	}
} );

jQuery.fn.extend( {
	detach: function( selector ) {
		return remove( this, selector, true );
	},

	remove: function( selector ) {
		return remove( this, selector );
	},

	text: function( value ) {
		return access( this, function( value ) {
			return value === undefined ?
				jQuery.text( this ) :
				this.empty().each( function() {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						this.textContent = value;
					}
				} );
		}, null, value, arguments.length );
	},

	append: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.appendChild( elem );
			}
		} );
	},

	prepend: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.insertBefore( elem, target.firstChild );
			}
		} );
	},

	before: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this );
			}
		} );
	},

	after: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			}
		} );
	},

	empty: function() {
		var elem,
			i = 0;

		for ( ; ( elem = this[ i ] ) != null; i++ ) {
			if ( elem.nodeType === 1 ) {

				// Prevent memory leaks
				jQuery.cleanData( getAll( elem, false ) );

				// Remove any remaining nodes
				elem.textContent = "";
			}
		}

		return this;
	},

	clone: function( dataAndEvents, deepDataAndEvents ) {
		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

		return this.map( function() {
			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
		} );
	},

	html: function( value ) {
		return access( this, function( value ) {
			var elem = this[ 0 ] || {},
				i = 0,
				l = this.length;

			if ( value === undefined && elem.nodeType === 1 ) {
				return elem.innerHTML;
			}

			// See if we can take a shortcut and just use innerHTML
			if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
				!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

				value = jQuery.htmlPrefilter( value );

				try {
					for ( ; i < l; i++ ) {
						elem = this[ i ] || {};

						// Remove element nodes and prevent memory leaks
						if ( elem.nodeType === 1 ) {
							jQuery.cleanData( getAll( elem, false ) );
							elem.innerHTML = value;
						}
					}

					elem = 0;

				// If using innerHTML throws an exception, use the fallback method
				} catch ( e ) {}
			}

			if ( elem ) {
				this.empty().append( value );
			}
		}, null, value, arguments.length );
	},

	replaceWith: function() {
		var ignored = [];

		// Make the changes, replacing each non-ignored context element with the new content
		return domManip( this, arguments, function( elem ) {
			var parent = this.parentNode;

			if ( jQuery.inArray( this, ignored ) < 0 ) {
				jQuery.cleanData( getAll( this ) );
				if ( parent ) {
					parent.replaceChild( elem, this );
				}
			}

		// Force callback invocation
		}, ignored );
	}
} );

jQuery.each( {
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var elems,
			ret = [],
			insert = jQuery( selector ),
			last = insert.length - 1,
			i = 0;

		for ( ; i <= last; i++ ) {
			elems = i === last ? this : this.clone( true );
			jQuery( insert[ i ] )[ original ]( elems );

			// Support: Android <=4.0 only, PhantomJS 1 only
			// .get() because push.apply(_, arraylike) throws on ancient WebKit
			push.apply( ret, elems.get() );
		}

		return this.pushStack( ret );
	};
} );
var rmargin = ( /^margin/ );

var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

var getStyles = function( elem ) {

		// Support: IE <=11 only, Firefox <=30 (#15098, #14150)
		// IE throws on elements created in popups
		// FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
		var view = elem.ownerDocument.defaultView;

		if ( !view || !view.opener ) {
			view = window;
		}

		return view.getComputedStyle( elem );
	};



( function() {

	// Executing both pixelPosition & boxSizingReliable tests require only one layout
	// so they're executed at the same time to save the second computation.
	function computeStyleTests() {

		// This is a singleton, we need to execute it only once
		if ( !div ) {
			return;
		}

		div.style.cssText =
			"box-sizing:border-box;" +
			"position:relative;display:block;" +
			"margin:auto;border:1px;padding:1px;" +
			"top:1%;width:50%";
		div.innerHTML = "";
		documentElement.appendChild( container );

		var divStyle = window.getComputedStyle( div );
		pixelPositionVal = divStyle.top !== "1%";

		// Support: Android 4.0 - 4.3 only, Firefox <=3 - 44
		reliableMarginLeftVal = divStyle.marginLeft === "2px";
		boxSizingReliableVal = divStyle.width === "4px";

		// Support: Android 4.0 - 4.3 only
		// Some styles come back with percentage values, even though they shouldn't
		div.style.marginRight = "50%";
		pixelMarginRightVal = divStyle.marginRight === "4px";

		documentElement.removeChild( container );

		// Nullify the div so it wouldn't be stored in the memory and
		// it will also be a sign that checks already performed
		div = null;
	}

	var pixelPositionVal, boxSizingReliableVal, pixelMarginRightVal, reliableMarginLeftVal,
		container = document.createElement( "div" ),
		div = document.createElement( "div" );

	// Finish early in limited (non-browser) environments
	if ( !div.style ) {
		return;
	}

	// Support: IE <=9 - 11 only
	// Style of cloned element affects source element cloned (#8908)
	div.style.backgroundClip = "content-box";
	div.cloneNode( true ).style.backgroundClip = "";
	support.clearCloneStyle = div.style.backgroundClip === "content-box";

	container.style.cssText = "border:0;width:8px;height:0;top:0;left:-9999px;" +
		"padding:0;margin-top:1px;position:absolute";
	container.appendChild( div );

	jQuery.extend( support, {
		pixelPosition: function() {
			computeStyleTests();
			return pixelPositionVal;
		},
		boxSizingReliable: function() {
			computeStyleTests();
			return boxSizingReliableVal;
		},
		pixelMarginRight: function() {
			computeStyleTests();
			return pixelMarginRightVal;
		},
		reliableMarginLeft: function() {
			computeStyleTests();
			return reliableMarginLeftVal;
		}
	} );
} )();


function curCSS( elem, name, computed ) {
	var width, minWidth, maxWidth, ret,
		style = elem.style;

	computed = computed || getStyles( elem );

	// Support: IE <=9 only
	// getPropertyValue is only needed for .css('filter') (#12537)
	if ( computed ) {
		ret = computed.getPropertyValue( name ) || computed[ name ];

		if ( ret === "" && !jQuery.contains( elem.ownerDocument, elem ) ) {
			ret = jQuery.style( elem, name );
		}

		// A tribute to the "awesome hack by Dean Edwards"
		// Android Browser returns percentage for some values,
		// but width seems to be reliably pixels.
		// This is against the CSSOM draft spec:
		// https://drafts.csswg.org/cssom/#resolved-values
		if ( !support.pixelMarginRight() && rnumnonpx.test( ret ) && rmargin.test( name ) ) {

			// Remember the original values
			width = style.width;
			minWidth = style.minWidth;
			maxWidth = style.maxWidth;

			// Put in the new values to get a computed value out
			style.minWidth = style.maxWidth = style.width = ret;
			ret = computed.width;

			// Revert the changed values
			style.width = width;
			style.minWidth = minWidth;
			style.maxWidth = maxWidth;
		}
	}

	return ret !== undefined ?

		// Support: IE <=9 - 11 only
		// IE returns zIndex value as an integer.
		ret + "" :
		ret;
}


function addGetHookIf( conditionFn, hookFn ) {

	// Define the hook, we'll check on the first run if it's really needed.
	return {
		get: function() {
			if ( conditionFn() ) {

				// Hook not needed (or it's not possible to use it due
				// to missing dependency), remove it.
				delete this.get;
				return;
			}

			// Hook needed; redefine it so that the support test is not executed again.
			return ( this.get = hookFn ).apply( this, arguments );
		}
	};
}


var

	// Swappable if display is none or starts with table
	// except "table", "table-cell", or "table-caption"
	// See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
	rdisplayswap = /^(none|table(?!-c[ea]).+)/,
	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
	cssNormalTransform = {
		letterSpacing: "0",
		fontWeight: "400"
	},

	cssPrefixes = [ "Webkit", "Moz", "ms" ],
	emptyStyle = document.createElement( "div" ).style;

// Return a css property mapped to a potentially vendor prefixed property
function vendorPropName( name ) {

	// Shortcut for names that are not vendor prefixed
	if ( name in emptyStyle ) {
		return name;
	}

	// Check for vendor prefixed names
	var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
		i = cssPrefixes.length;

	while ( i-- ) {
		name = cssPrefixes[ i ] + capName;
		if ( name in emptyStyle ) {
			return name;
		}
	}
}

function setPositiveNumber( elem, value, subtract ) {

	// Any relative (+/-) values have already been
	// normalized at this point
	var matches = rcssNum.exec( value );
	return matches ?

		// Guard against undefined "subtract", e.g., when used as in cssHooks
		Math.max( 0, matches[ 2 ] - ( subtract || 0 ) ) + ( matches[ 3 ] || "px" ) :
		value;
}

function augmentWidthOrHeight( elem, name, extra, isBorderBox, styles ) {
	var i = extra === ( isBorderBox ? "border" : "content" ) ?

		// If we already have the right measurement, avoid augmentation
		4 :

		// Otherwise initialize for horizontal or vertical properties
		name === "width" ? 1 : 0,

		val = 0;

	for ( ; i < 4; i += 2 ) {

		// Both box models exclude margin, so add it if we want it
		if ( extra === "margin" ) {
			val += jQuery.css( elem, extra + cssExpand[ i ], true, styles );
		}

		if ( isBorderBox ) {

			// border-box includes padding, so remove it if we want content
			if ( extra === "content" ) {
				val -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
			}

			// At this point, extra isn't border nor margin, so remove border
			if ( extra !== "margin" ) {
				val -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		} else {

			// At this point, extra isn't content, so add padding
			val += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

			// At this point, extra isn't content nor padding, so add border
			if ( extra !== "padding" ) {
				val += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		}
	}

	return val;
}

function getWidthOrHeight( elem, name, extra ) {

	// Start with offset property, which is equivalent to the border-box value
	var val,
		valueIsBorderBox = true,
		styles = getStyles( elem ),
		isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

	// Support: IE <=11 only
	// Running getBoundingClientRect on a disconnected node
	// in IE throws an error.
	if ( elem.getClientRects().length ) {
		val = elem.getBoundingClientRect()[ name ];
	}

	// Some non-html elements return undefined for offsetWidth, so check for null/undefined
	// svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
	// MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
	if ( val <= 0 || val == null ) {

		// Fall back to computed then uncomputed css if necessary
		val = curCSS( elem, name, styles );
		if ( val < 0 || val == null ) {
			val = elem.style[ name ];
		}

		// Computed unit is not pixels. Stop here and return.
		if ( rnumnonpx.test( val ) ) {
			return val;
		}

		// Check for style in case a browser which returns unreliable values
		// for getComputedStyle silently falls back to the reliable elem.style
		valueIsBorderBox = isBorderBox &&
			( support.boxSizingReliable() || val === elem.style[ name ] );

		// Normalize "", auto, and prepare for extra
		val = parseFloat( val ) || 0;
	}

	// Use the active box-sizing model to add/subtract irrelevant styles
	return ( val +
		augmentWidthOrHeight(
			elem,
			name,
			extra || ( isBorderBox ? "border" : "content" ),
			valueIsBorderBox,
			styles
		)
	) + "px";
}

jQuery.extend( {

	// Add in style property hooks for overriding the default
	// behavior of getting and setting a style property
	cssHooks: {
		opacity: {
			get: function( elem, computed ) {
				if ( computed ) {

					// We should always get a number back from opacity
					var ret = curCSS( elem, "opacity" );
					return ret === "" ? "1" : ret;
				}
			}
		}
	},

	// Don't automatically add "px" to these possibly-unitless properties
	cssNumber: {
		"animationIterationCount": true,
		"columnCount": true,
		"fillOpacity": true,
		"flexGrow": true,
		"flexShrink": true,
		"fontWeight": true,
		"lineHeight": true,
		"opacity": true,
		"order": true,
		"orphans": true,
		"widows": true,
		"zIndex": true,
		"zoom": true
	},

	// Add in properties whose names you wish to fix before
	// setting or getting the value
	cssProps: {
		"float": "cssFloat"
	},

	// Get and set the style property on a DOM Node
	style: function( elem, name, value, extra ) {

		// Don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
			return;
		}

		// Make sure that we're working with the right name
		var ret, type, hooks,
			origName = jQuery.camelCase( name ),
			style = elem.style;

		name = jQuery.cssProps[ origName ] ||
			( jQuery.cssProps[ origName ] = vendorPropName( origName ) || origName );

		// Gets hook for the prefixed version, then unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// Check if we're setting a value
		if ( value !== undefined ) {
			type = typeof value;

			// Convert "+=" or "-=" to relative numbers (#7345)
			if ( type === "string" && ( ret = rcssNum.exec( value ) ) && ret[ 1 ] ) {
				value = adjustCSS( elem, name, ret );

				// Fixes bug #9237
				type = "number";
			}

			// Make sure that null and NaN values aren't set (#7116)
			if ( value == null || value !== value ) {
				return;
			}

			// If a number was passed in, add the unit (except for certain CSS properties)
			if ( type === "number" ) {
				value += ret && ret[ 3 ] || ( jQuery.cssNumber[ origName ] ? "" : "px" );
			}

			// background-* props affect original clone's values
			if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
				style[ name ] = "inherit";
			}

			// If a hook was provided, use that value, otherwise just set the specified value
			if ( !hooks || !( "set" in hooks ) ||
				( value = hooks.set( elem, value, extra ) ) !== undefined ) {

				style[ name ] = value;
			}

		} else {

			// If a hook was provided get the non-computed value from there
			if ( hooks && "get" in hooks &&
				( ret = hooks.get( elem, false, extra ) ) !== undefined ) {

				return ret;
			}

			// Otherwise just get the value from the style object
			return style[ name ];
		}
	},

	css: function( elem, name, extra, styles ) {
		var val, num, hooks,
			origName = jQuery.camelCase( name );

		// Make sure that we're working with the right name
		name = jQuery.cssProps[ origName ] ||
			( jQuery.cssProps[ origName ] = vendorPropName( origName ) || origName );

		// Try prefixed name followed by the unprefixed name
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// If a hook was provided get the computed value from there
		if ( hooks && "get" in hooks ) {
			val = hooks.get( elem, true, extra );
		}

		// Otherwise, if a way to get the computed value exists, use that
		if ( val === undefined ) {
			val = curCSS( elem, name, styles );
		}

		// Convert "normal" to computed value
		if ( val === "normal" && name in cssNormalTransform ) {
			val = cssNormalTransform[ name ];
		}

		// Make numeric if forced or a qualifier was provided and val looks numeric
		if ( extra === "" || extra ) {
			num = parseFloat( val );
			return extra === true || isFinite( num ) ? num || 0 : val;
		}
		return val;
	}
} );

jQuery.each( [ "height", "width" ], function( i, name ) {
	jQuery.cssHooks[ name ] = {
		get: function( elem, computed, extra ) {
			if ( computed ) {

				// Certain elements can have dimension info if we invisibly show them
				// but it must have a current display style that would benefit
				return rdisplayswap.test( jQuery.css( elem, "display" ) ) &&

					// Support: Safari 8+
					// Table columns in Safari have non-zero offsetWidth & zero
					// getBoundingClientRect().width unless display is changed.
					// Support: IE <=11 only
					// Running getBoundingClientRect on a disconnected node
					// in IE throws an error.
					( !elem.getClientRects().length || !elem.getBoundingClientRect().width ) ?
						swap( elem, cssShow, function() {
							return getWidthOrHeight( elem, name, extra );
						} ) :
						getWidthOrHeight( elem, name, extra );
			}
		},

		set: function( elem, value, extra ) {
			var matches,
				styles = extra && getStyles( elem ),
				subtract = extra && augmentWidthOrHeight(
					elem,
					name,
					extra,
					jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
					styles
				);

			// Convert to pixels if value adjustment is needed
			if ( subtract && ( matches = rcssNum.exec( value ) ) &&
				( matches[ 3 ] || "px" ) !== "px" ) {

				elem.style[ name ] = value;
				value = jQuery.css( elem, name );
			}

			return setPositiveNumber( elem, value, subtract );
		}
	};
} );

jQuery.cssHooks.marginLeft = addGetHookIf( support.reliableMarginLeft,
	function( elem, computed ) {
		if ( computed ) {
			return ( parseFloat( curCSS( elem, "marginLeft" ) ) ||
				elem.getBoundingClientRect().left -
					swap( elem, { marginLeft: 0 }, function() {
						return elem.getBoundingClientRect().left;
					} )
				) + "px";
		}
	}
);

// These hooks are used by animate to expand properties
jQuery.each( {
	margin: "",
	padding: "",
	border: "Width"
}, function( prefix, suffix ) {
	jQuery.cssHooks[ prefix + suffix ] = {
		expand: function( value ) {
			var i = 0,
				expanded = {},

				// Assumes a single number if not a string
				parts = typeof value === "string" ? value.split( " " ) : [ value ];

			for ( ; i < 4; i++ ) {
				expanded[ prefix + cssExpand[ i ] + suffix ] =
					parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
			}

			return expanded;
		}
	};

	if ( !rmargin.test( prefix ) ) {
		jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
	}
} );

jQuery.fn.extend( {
	css: function( name, value ) {
		return access( this, function( elem, name, value ) {
			var styles, len,
				map = {},
				i = 0;

			if ( jQuery.isArray( name ) ) {
				styles = getStyles( elem );
				len = name.length;

				for ( ; i < len; i++ ) {
					map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
				}

				return map;
			}

			return value !== undefined ?
				jQuery.style( elem, name, value ) :
				jQuery.css( elem, name );
		}, name, value, arguments.length > 1 );
	}
} );


function Tween( elem, options, prop, end, easing ) {
	return new Tween.prototype.init( elem, options, prop, end, easing );
}
jQuery.Tween = Tween;

Tween.prototype = {
	constructor: Tween,
	init: function( elem, options, prop, end, easing, unit ) {
		this.elem = elem;
		this.prop = prop;
		this.easing = easing || jQuery.easing._default;
		this.options = options;
		this.start = this.now = this.cur();
		this.end = end;
		this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
	},
	cur: function() {
		var hooks = Tween.propHooks[ this.prop ];

		return hooks && hooks.get ?
			hooks.get( this ) :
			Tween.propHooks._default.get( this );
	},
	run: function( percent ) {
		var eased,
			hooks = Tween.propHooks[ this.prop ];

		if ( this.options.duration ) {
			this.pos = eased = jQuery.easing[ this.easing ](
				percent, this.options.duration * percent, 0, 1, this.options.duration
			);
		} else {
			this.pos = eased = percent;
		}
		this.now = ( this.end - this.start ) * eased + this.start;

		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		if ( hooks && hooks.set ) {
			hooks.set( this );
		} else {
			Tween.propHooks._default.set( this );
		}
		return this;
	}
};

Tween.prototype.init.prototype = Tween.prototype;

Tween.propHooks = {
	_default: {
		get: function( tween ) {
			var result;

			// Use a property on the element directly when it is not a DOM element,
			// or when there is no matching style property that exists.
			if ( tween.elem.nodeType !== 1 ||
				tween.elem[ tween.prop ] != null && tween.elem.style[ tween.prop ] == null ) {
				return tween.elem[ tween.prop ];
			}

			// Passing an empty string as a 3rd parameter to .css will automatically
			// attempt a parseFloat and fallback to a string if the parse fails.
			// Simple values such as "10px" are parsed to Float;
			// complex values such as "rotate(1rad)" are returned as-is.
			result = jQuery.css( tween.elem, tween.prop, "" );

			// Empty strings, null, undefined and "auto" are converted to 0.
			return !result || result === "auto" ? 0 : result;
		},
		set: function( tween ) {

			// Use step hook for back compat.
			// Use cssHook if its there.
			// Use .style if available and use plain properties where available.
			if ( jQuery.fx.step[ tween.prop ] ) {
				jQuery.fx.step[ tween.prop ]( tween );
			} else if ( tween.elem.nodeType === 1 &&
				( tween.elem.style[ jQuery.cssProps[ tween.prop ] ] != null ||
					jQuery.cssHooks[ tween.prop ] ) ) {
				jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
			} else {
				tween.elem[ tween.prop ] = tween.now;
			}
		}
	}
};

// Support: IE <=9 only
// Panic based approach to setting things on disconnected nodes
Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
	set: function( tween ) {
		if ( tween.elem.nodeType && tween.elem.parentNode ) {
			tween.elem[ tween.prop ] = tween.now;
		}
	}
};

jQuery.easing = {
	linear: function( p ) {
		return p;
	},
	swing: function( p ) {
		return 0.5 - Math.cos( p * Math.PI ) / 2;
	},
	_default: "swing"
};

jQuery.fx = Tween.prototype.init;

// Back compat <1.8 extension point
jQuery.fx.step = {};




var
	fxNow, timerId,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rrun = /queueHooks$/;

function raf() {
	if ( timerId ) {
		window.requestAnimationFrame( raf );
		jQuery.fx.tick();
	}
}

// Animations created synchronously will run synchronously
function createFxNow() {
	window.setTimeout( function() {
		fxNow = undefined;
	} );
	return ( fxNow = jQuery.now() );
}

// Generate parameters to create a standard animation
function genFx( type, includeWidth ) {
	var which,
		i = 0,
		attrs = { height: type };

	// If we include width, step value is 1 to do all cssExpand values,
	// otherwise step value is 2 to skip over Left and Right
	includeWidth = includeWidth ? 1 : 0;
	for ( ; i < 4; i += 2 - includeWidth ) {
		which = cssExpand[ i ];
		attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
	}

	if ( includeWidth ) {
		attrs.opacity = attrs.width = type;
	}

	return attrs;
}

function createTween( value, prop, animation ) {
	var tween,
		collection = ( Animation.tweeners[ prop ] || [] ).concat( Animation.tweeners[ "*" ] ),
		index = 0,
		length = collection.length;
	for ( ; index < length; index++ ) {
		if ( ( tween = collection[ index ].call( animation, prop, value ) ) ) {

			// We're done with this property
			return tween;
		}
	}
}

function defaultPrefilter( elem, props, opts ) {
	var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display,
		isBox = "width" in props || "height" in props,
		anim = this,
		orig = {},
		style = elem.style,
		hidden = elem.nodeType && isHiddenWithinTree( elem ),
		dataShow = dataPriv.get( elem, "fxshow" );

	// Queue-skipping animations hijack the fx hooks
	if ( !opts.queue ) {
		hooks = jQuery._queueHooks( elem, "fx" );
		if ( hooks.unqueued == null ) {
			hooks.unqueued = 0;
			oldfire = hooks.empty.fire;
			hooks.empty.fire = function() {
				if ( !hooks.unqueued ) {
					oldfire();
				}
			};
		}
		hooks.unqueued++;

		anim.always( function() {

			// Ensure the complete handler is called before this completes
			anim.always( function() {
				hooks.unqueued--;
				if ( !jQuery.queue( elem, "fx" ).length ) {
					hooks.empty.fire();
				}
			} );
		} );
	}

	// Detect show/hide animations
	for ( prop in props ) {
		value = props[ prop ];
		if ( rfxtypes.test( value ) ) {
			delete props[ prop ];
			toggle = toggle || value === "toggle";
			if ( value === ( hidden ? "hide" : "show" ) ) {

				// Pretend to be hidden if this is a "show" and
				// there is still data from a stopped show/hide
				if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
					hidden = true;

				// Ignore all other no-op show/hide data
				} else {
					continue;
				}
			}
			orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );
		}
	}

	// Bail out if this is a no-op like .hide().hide()
	propTween = !jQuery.isEmptyObject( props );
	if ( !propTween && jQuery.isEmptyObject( orig ) ) {
		return;
	}

	// Restrict "overflow" and "display" styles during box animations
	if ( isBox && elem.nodeType === 1 ) {

		// Support: IE <=9 - 11, Edge 12 - 13
		// Record all 3 overflow attributes because IE does not infer the shorthand
		// from identically-valued overflowX and overflowY
		opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

		// Identify a display type, preferring old show/hide data over the CSS cascade
		restoreDisplay = dataShow && dataShow.display;
		if ( restoreDisplay == null ) {
			restoreDisplay = dataPriv.get( elem, "display" );
		}
		display = jQuery.css( elem, "display" );
		if ( display === "none" ) {
			if ( restoreDisplay ) {
				display = restoreDisplay;
			} else {

				// Get nonempty value(s) by temporarily forcing visibility
				showHide( [ elem ], true );
				restoreDisplay = elem.style.display || restoreDisplay;
				display = jQuery.css( elem, "display" );
				showHide( [ elem ] );
			}
		}

		// Animate inline elements as inline-block
		if ( display === "inline" || display === "inline-block" && restoreDisplay != null ) {
			if ( jQuery.css( elem, "float" ) === "none" ) {

				// Restore the original display value at the end of pure show/hide animations
				if ( !propTween ) {
					anim.done( function() {
						style.display = restoreDisplay;
					} );
					if ( restoreDisplay == null ) {
						display = style.display;
						restoreDisplay = display === "none" ? "" : display;
					}
				}
				style.display = "inline-block";
			}
		}
	}

	if ( opts.overflow ) {
		style.overflow = "hidden";
		anim.always( function() {
			style.overflow = opts.overflow[ 0 ];
			style.overflowX = opts.overflow[ 1 ];
			style.overflowY = opts.overflow[ 2 ];
		} );
	}

	// Implement show/hide animations
	propTween = false;
	for ( prop in orig ) {

		// General show/hide setup for this element animation
		if ( !propTween ) {
			if ( dataShow ) {
				if ( "hidden" in dataShow ) {
					hidden = dataShow.hidden;
				}
			} else {
				dataShow = dataPriv.access( elem, "fxshow", { display: restoreDisplay } );
			}

			// Store hidden/visible for toggle so `.stop().toggle()` "reverses"
			if ( toggle ) {
				dataShow.hidden = !hidden;
			}

			// Show elements before animating them
			if ( hidden ) {
				showHide( [ elem ], true );
			}

			/* eslint-disable no-loop-func */

			anim.done( function() {

			/* eslint-enable no-loop-func */

				// The final step of a "hide" animation is actually hiding the element
				if ( !hidden ) {
					showHide( [ elem ] );
				}
				dataPriv.remove( elem, "fxshow" );
				for ( prop in orig ) {
					jQuery.style( elem, prop, orig[ prop ] );
				}
			} );
		}

		// Per-property setup
		propTween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );
		if ( !( prop in dataShow ) ) {
			dataShow[ prop ] = propTween.start;
			if ( hidden ) {
				propTween.end = propTween.start;
				propTween.start = 0;
			}
		}
	}
}

function propFilter( props, specialEasing ) {
	var index, name, easing, value, hooks;

	// camelCase, specialEasing and expand cssHook pass
	for ( index in props ) {
		name = jQuery.camelCase( index );
		easing = specialEasing[ name ];
		value = props[ index ];
		if ( jQuery.isArray( value ) ) {
			easing = value[ 1 ];
			value = props[ index ] = value[ 0 ];
		}

		if ( index !== name ) {
			props[ name ] = value;
			delete props[ index ];
		}

		hooks = jQuery.cssHooks[ name ];
		if ( hooks && "expand" in hooks ) {
			value = hooks.expand( value );
			delete props[ name ];

			// Not quite $.extend, this won't overwrite existing keys.
			// Reusing 'index' because we have the correct "name"
			for ( index in value ) {
				if ( !( index in props ) ) {
					props[ index ] = value[ index ];
					specialEasing[ index ] = easing;
				}
			}
		} else {
			specialEasing[ name ] = easing;
		}
	}
}

function Animation( elem, properties, options ) {
	var result,
		stopped,
		index = 0,
		length = Animation.prefilters.length,
		deferred = jQuery.Deferred().always( function() {

			// Don't match elem in the :animated selector
			delete tick.elem;
		} ),
		tick = function() {
			if ( stopped ) {
				return false;
			}
			var currentTime = fxNow || createFxNow(),
				remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),

				// Support: Android 2.3 only
				// Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (#12497)
				temp = remaining / animation.duration || 0,
				percent = 1 - temp,
				index = 0,
				length = animation.tweens.length;

			for ( ; index < length; index++ ) {
				animation.tweens[ index ].run( percent );
			}

			deferred.notifyWith( elem, [ animation, percent, remaining ] );

			if ( percent < 1 && length ) {
				return remaining;
			} else {
				deferred.resolveWith( elem, [ animation ] );
				return false;
			}
		},
		animation = deferred.promise( {
			elem: elem,
			props: jQuery.extend( {}, properties ),
			opts: jQuery.extend( true, {
				specialEasing: {},
				easing: jQuery.easing._default
			}, options ),
			originalProperties: properties,
			originalOptions: options,
			startTime: fxNow || createFxNow(),
			duration: options.duration,
			tweens: [],
			createTween: function( prop, end ) {
				var tween = jQuery.Tween( elem, animation.opts, prop, end,
						animation.opts.specialEasing[ prop ] || animation.opts.easing );
				animation.tweens.push( tween );
				return tween;
			},
			stop: function( gotoEnd ) {
				var index = 0,

					// If we are going to the end, we want to run all the tweens
					// otherwise we skip this part
					length = gotoEnd ? animation.tweens.length : 0;
				if ( stopped ) {
					return this;
				}
				stopped = true;
				for ( ; index < length; index++ ) {
					animation.tweens[ index ].run( 1 );
				}

				// Resolve when we played the last frame; otherwise, reject
				if ( gotoEnd ) {
					deferred.notifyWith( elem, [ animation, 1, 0 ] );
					deferred.resolveWith( elem, [ animation, gotoEnd ] );
				} else {
					deferred.rejectWith( elem, [ animation, gotoEnd ] );
				}
				return this;
			}
		} ),
		props = animation.props;

	propFilter( props, animation.opts.specialEasing );

	for ( ; index < length; index++ ) {
		result = Animation.prefilters[ index ].call( animation, elem, props, animation.opts );
		if ( result ) {
			if ( jQuery.isFunction( result.stop ) ) {
				jQuery._queueHooks( animation.elem, animation.opts.queue ).stop =
					jQuery.proxy( result.stop, result );
			}
			return result;
		}
	}

	jQuery.map( props, createTween, animation );

	if ( jQuery.isFunction( animation.opts.start ) ) {
		animation.opts.start.call( elem, animation );
	}

	jQuery.fx.timer(
		jQuery.extend( tick, {
			elem: elem,
			anim: animation,
			queue: animation.opts.queue
		} )
	);

	// attach callbacks from options
	return animation.progress( animation.opts.progress )
		.done( animation.opts.done, animation.opts.complete )
		.fail( animation.opts.fail )
		.always( animation.opts.always );
}

jQuery.Animation = jQuery.extend( Animation, {

	tweeners: {
		"*": [ function( prop, value ) {
			var tween = this.createTween( prop, value );
			adjustCSS( tween.elem, prop, rcssNum.exec( value ), tween );
			return tween;
		} ]
	},

	tweener: function( props, callback ) {
		if ( jQuery.isFunction( props ) ) {
			callback = props;
			props = [ "*" ];
		} else {
			props = props.match( rnotwhite );
		}

		var prop,
			index = 0,
			length = props.length;

		for ( ; index < length; index++ ) {
			prop = props[ index ];
			Animation.tweeners[ prop ] = Animation.tweeners[ prop ] || [];
			Animation.tweeners[ prop ].unshift( callback );
		}
	},

	prefilters: [ defaultPrefilter ],

	prefilter: function( callback, prepend ) {
		if ( prepend ) {
			Animation.prefilters.unshift( callback );
		} else {
			Animation.prefilters.push( callback );
		}
	}
} );

jQuery.speed = function( speed, easing, fn ) {
	var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
		complete: fn || !fn && easing ||
			jQuery.isFunction( speed ) && speed,
		duration: speed,
		easing: fn && easing || easing && !jQuery.isFunction( easing ) && easing
	};

	// Go to the end state if fx are off or if document is hidden
	if ( jQuery.fx.off || document.hidden ) {
		opt.duration = 0;

	} else {
		opt.duration = typeof opt.duration === "number" ?
			opt.duration : opt.duration in jQuery.fx.speeds ?
				jQuery.fx.speeds[ opt.duration ] : jQuery.fx.speeds._default;
	}

	// Normalize opt.queue - true/undefined/null -> "fx"
	if ( opt.queue == null || opt.queue === true ) {
		opt.queue = "fx";
	}

	// Queueing
	opt.old = opt.complete;

	opt.complete = function() {
		if ( jQuery.isFunction( opt.old ) ) {
			opt.old.call( this );
		}

		if ( opt.queue ) {
			jQuery.dequeue( this, opt.queue );
		}
	};

	return opt;
};

jQuery.fn.extend( {
	fadeTo: function( speed, to, easing, callback ) {

		// Show any hidden elements after setting opacity to 0
		return this.filter( isHiddenWithinTree ).css( "opacity", 0 ).show()

			// Animate to the value specified
			.end().animate( { opacity: to }, speed, easing, callback );
	},
	animate: function( prop, speed, easing, callback ) {
		var empty = jQuery.isEmptyObject( prop ),
			optall = jQuery.speed( speed, easing, callback ),
			doAnimation = function() {

				// Operate on a copy of prop so per-property easing won't be lost
				var anim = Animation( this, jQuery.extend( {}, prop ), optall );

				// Empty animations, or finishing resolves immediately
				if ( empty || dataPriv.get( this, "finish" ) ) {
					anim.stop( true );
				}
			};
			doAnimation.finish = doAnimation;

		return empty || optall.queue === false ?
			this.each( doAnimation ) :
			this.queue( optall.queue, doAnimation );
	},
	stop: function( type, clearQueue, gotoEnd ) {
		var stopQueue = function( hooks ) {
			var stop = hooks.stop;
			delete hooks.stop;
			stop( gotoEnd );
		};

		if ( typeof type !== "string" ) {
			gotoEnd = clearQueue;
			clearQueue = type;
			type = undefined;
		}
		if ( clearQueue && type !== false ) {
			this.queue( type || "fx", [] );
		}

		return this.each( function() {
			var dequeue = true,
				index = type != null && type + "queueHooks",
				timers = jQuery.timers,
				data = dataPriv.get( this );

			if ( index ) {
				if ( data[ index ] && data[ index ].stop ) {
					stopQueue( data[ index ] );
				}
			} else {
				for ( index in data ) {
					if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
						stopQueue( data[ index ] );
					}
				}
			}

			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this &&
					( type == null || timers[ index ].queue === type ) ) {

					timers[ index ].anim.stop( gotoEnd );
					dequeue = false;
					timers.splice( index, 1 );
				}
			}

			// Start the next in the queue if the last step wasn't forced.
			// Timers currently will call their complete callbacks, which
			// will dequeue but only if they were gotoEnd.
			if ( dequeue || !gotoEnd ) {
				jQuery.dequeue( this, type );
			}
		} );
	},
	finish: function( type ) {
		if ( type !== false ) {
			type = type || "fx";
		}
		return this.each( function() {
			var index,
				data = dataPriv.get( this ),
				queue = data[ type + "queue" ],
				hooks = data[ type + "queueHooks" ],
				timers = jQuery.timers,
				length = queue ? queue.length : 0;

			// Enable finishing flag on private data
			data.finish = true;

			// Empty the queue first
			jQuery.queue( this, type, [] );

			if ( hooks && hooks.stop ) {
				hooks.stop.call( this, true );
			}

			// Look for any active animations, and finish them
			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
					timers[ index ].anim.stop( true );
					timers.splice( index, 1 );
				}
			}

			// Look for any animations in the old queue and finish them
			for ( index = 0; index < length; index++ ) {
				if ( queue[ index ] && queue[ index ].finish ) {
					queue[ index ].finish.call( this );
				}
			}

			// Turn off finishing flag
			delete data.finish;
		} );
	}
} );

jQuery.each( [ "toggle", "show", "hide" ], function( i, name ) {
	var cssFn = jQuery.fn[ name ];
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return speed == null || typeof speed === "boolean" ?
			cssFn.apply( this, arguments ) :
			this.animate( genFx( name, true ), speed, easing, callback );
	};
} );

// Generate shortcuts for custom animations
jQuery.each( {
	slideDown: genFx( "show" ),
	slideUp: genFx( "hide" ),
	slideToggle: genFx( "toggle" ),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" },
	fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return this.animate( props, speed, easing, callback );
	};
} );

jQuery.timers = [];
jQuery.fx.tick = function() {
	var timer,
		i = 0,
		timers = jQuery.timers;

	fxNow = jQuery.now();

	for ( ; i < timers.length; i++ ) {
		timer = timers[ i ];

		// Checks the timer has not already been removed
		if ( !timer() && timers[ i ] === timer ) {
			timers.splice( i--, 1 );
		}
	}

	if ( !timers.length ) {
		jQuery.fx.stop();
	}
	fxNow = undefined;
};

jQuery.fx.timer = function( timer ) {
	jQuery.timers.push( timer );
	if ( timer() ) {
		jQuery.fx.start();
	} else {
		jQuery.timers.pop();
	}
};

jQuery.fx.interval = 13;
jQuery.fx.start = function() {
	if ( !timerId ) {
		timerId = window.requestAnimationFrame ?
			window.requestAnimationFrame( raf ) :
			window.setInterval( jQuery.fx.tick, jQuery.fx.interval );
	}
};

jQuery.fx.stop = function() {
	if ( window.cancelAnimationFrame ) {
		window.cancelAnimationFrame( timerId );
	} else {
		window.clearInterval( timerId );
	}

	timerId = null;
};

jQuery.fx.speeds = {
	slow: 600,
	fast: 200,

	// Default speed
	_default: 400
};


// Based off of the plugin by Clint Helfers, with permission.
// https://web.archive.org/web/20100324014747/http://blindsignals.com/index.php/2009/07/jquery-delay/
jQuery.fn.delay = function( time, type ) {
	time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
	type = type || "fx";

	return this.queue( type, function( next, hooks ) {
		var timeout = window.setTimeout( next, time );
		hooks.stop = function() {
			window.clearTimeout( timeout );
		};
	} );
};


( function() {
	var input = document.createElement( "input" ),
		select = document.createElement( "select" ),
		opt = select.appendChild( document.createElement( "option" ) );

	input.type = "checkbox";

	// Support: Android <=4.3 only
	// Default value for a checkbox should be "on"
	support.checkOn = input.value !== "";

	// Support: IE <=11 only
	// Must access selectedIndex to make default options select
	support.optSelected = opt.selected;

	// Support: IE <=11 only
	// An input loses its value after becoming a radio
	input = document.createElement( "input" );
	input.value = "t";
	input.type = "radio";
	support.radioValue = input.value === "t";
} )();


var boolHook,
	attrHandle = jQuery.expr.attrHandle;

jQuery.fn.extend( {
	attr: function( name, value ) {
		return access( this, jQuery.attr, name, value, arguments.length > 1 );
	},

	removeAttr: function( name ) {
		return this.each( function() {
			jQuery.removeAttr( this, name );
		} );
	}
} );

jQuery.extend( {
	attr: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set attributes on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		// Fallback to prop when attributes are not supported
		if ( typeof elem.getAttribute === "undefined" ) {
			return jQuery.prop( elem, name, value );
		}

		// Attribute hooks are determined by the lowercase version
		// Grab necessary hook if one is defined
		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
			hooks = jQuery.attrHooks[ name.toLowerCase() ] ||
				( jQuery.expr.match.bool.test( name ) ? boolHook : undefined );
		}

		if ( value !== undefined ) {
			if ( value === null ) {
				jQuery.removeAttr( elem, name );
				return;
			}

			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			elem.setAttribute( name, value + "" );
			return value;
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		ret = jQuery.find.attr( elem, name );

		// Non-existent attributes return null, we normalize to undefined
		return ret == null ? undefined : ret;
	},

	attrHooks: {
		type: {
			set: function( elem, value ) {
				if ( !support.radioValue && value === "radio" &&
					jQuery.nodeName( elem, "input" ) ) {
					var val = elem.value;
					elem.setAttribute( "type", value );
					if ( val ) {
						elem.value = val;
					}
					return value;
				}
			}
		}
	},

	removeAttr: function( elem, value ) {
		var name,
			i = 0,
			attrNames = value && value.match( rnotwhite );

		if ( attrNames && elem.nodeType === 1 ) {
			while ( ( name = attrNames[ i++ ] ) ) {
				elem.removeAttribute( name );
			}
		}
	}
} );

// Hooks for boolean attributes
boolHook = {
	set: function( elem, value, name ) {
		if ( value === false ) {

			// Remove boolean attributes when set to false
			jQuery.removeAttr( elem, name );
		} else {
			elem.setAttribute( name, name );
		}
		return name;
	}
};

jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( i, name ) {
	var getter = attrHandle[ name ] || jQuery.find.attr;

	attrHandle[ name ] = function( elem, name, isXML ) {
		var ret, handle,
			lowercaseName = name.toLowerCase();

		if ( !isXML ) {

			// Avoid an infinite loop by temporarily removing this function from the getter
			handle = attrHandle[ lowercaseName ];
			attrHandle[ lowercaseName ] = ret;
			ret = getter( elem, name, isXML ) != null ?
				lowercaseName :
				null;
			attrHandle[ lowercaseName ] = handle;
		}
		return ret;
	};
} );




var rfocusable = /^(?:input|select|textarea|button)$/i,
	rclickable = /^(?:a|area)$/i;

jQuery.fn.extend( {
	prop: function( name, value ) {
		return access( this, jQuery.prop, name, value, arguments.length > 1 );
	},

	removeProp: function( name ) {
		return this.each( function() {
			delete this[ jQuery.propFix[ name ] || name ];
		} );
	}
} );

jQuery.extend( {
	prop: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set properties on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {

			// Fix name and attach hooks
			name = jQuery.propFix[ name ] || name;
			hooks = jQuery.propHooks[ name ];
		}

		if ( value !== undefined ) {
			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			return ( elem[ name ] = value );
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		return elem[ name ];
	},

	propHooks: {
		tabIndex: {
			get: function( elem ) {

				// Support: IE <=9 - 11 only
				// elem.tabIndex doesn't always return the
				// correct value when it hasn't been explicitly set
				// https://web.archive.org/web/20141116233347/http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
				// Use proper attribute retrieval(#12072)
				var tabindex = jQuery.find.attr( elem, "tabindex" );

				return tabindex ?
					parseInt( tabindex, 10 ) :
					rfocusable.test( elem.nodeName ) ||
						rclickable.test( elem.nodeName ) && elem.href ?
							0 :
							-1;
			}
		}
	},

	propFix: {
		"for": "htmlFor",
		"class": "className"
	}
} );

// Support: IE <=11 only
// Accessing the selectedIndex property
// forces the browser to respect setting selected
// on the option
// The getter ensures a default option is selected
// when in an optgroup
if ( !support.optSelected ) {
	jQuery.propHooks.selected = {
		get: function( elem ) {
			var parent = elem.parentNode;
			if ( parent && parent.parentNode ) {
				parent.parentNode.selectedIndex;
			}
			return null;
		},
		set: function( elem ) {
			var parent = elem.parentNode;
			if ( parent ) {
				parent.selectedIndex;

				if ( parent.parentNode ) {
					parent.parentNode.selectedIndex;
				}
			}
		}
	};
}

jQuery.each( [
	"tabIndex",
	"readOnly",
	"maxLength",
	"cellSpacing",
	"cellPadding",
	"rowSpan",
	"colSpan",
	"useMap",
	"frameBorder",
	"contentEditable"
], function() {
	jQuery.propFix[ this.toLowerCase() ] = this;
} );




var rclass = /[\t\r\n\f]/g;

function getClass( elem ) {
	return elem.getAttribute && elem.getAttribute( "class" ) || "";
}

jQuery.fn.extend( {
	addClass: function( value ) {
		var classes, elem, cur, curValue, clazz, j, finalValue,
			i = 0;

		if ( jQuery.isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).addClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		if ( typeof value === "string" && value ) {
			classes = value.match( rnotwhite ) || [];

			while ( ( elem = this[ i++ ] ) ) {
				curValue = getClass( elem );
				cur = elem.nodeType === 1 &&
					( " " + curValue + " " ).replace( rclass, " " );

				if ( cur ) {
					j = 0;
					while ( ( clazz = classes[ j++ ] ) ) {
						if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
							cur += clazz + " ";
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = jQuery.trim( cur );
					if ( curValue !== finalValue ) {
						elem.setAttribute( "class", finalValue );
					}
				}
			}
		}

		return this;
	},

	removeClass: function( value ) {
		var classes, elem, cur, curValue, clazz, j, finalValue,
			i = 0;

		if ( jQuery.isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).removeClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		if ( !arguments.length ) {
			return this.attr( "class", "" );
		}

		if ( typeof value === "string" && value ) {
			classes = value.match( rnotwhite ) || [];

			while ( ( elem = this[ i++ ] ) ) {
				curValue = getClass( elem );

				// This expression is here for better compressibility (see addClass)
				cur = elem.nodeType === 1 &&
					( " " + curValue + " " ).replace( rclass, " " );

				if ( cur ) {
					j = 0;
					while ( ( clazz = classes[ j++ ] ) ) {

						// Remove *all* instances
						while ( cur.indexOf( " " + clazz + " " ) > -1 ) {
							cur = cur.replace( " " + clazz + " ", " " );
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = jQuery.trim( cur );
					if ( curValue !== finalValue ) {
						elem.setAttribute( "class", finalValue );
					}
				}
			}
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var type = typeof value;

		if ( typeof stateVal === "boolean" && type === "string" ) {
			return stateVal ? this.addClass( value ) : this.removeClass( value );
		}

		if ( jQuery.isFunction( value ) ) {
			return this.each( function( i ) {
				jQuery( this ).toggleClass(
					value.call( this, i, getClass( this ), stateVal ),
					stateVal
				);
			} );
		}

		return this.each( function() {
			var className, i, self, classNames;

			if ( type === "string" ) {

				// Toggle individual class names
				i = 0;
				self = jQuery( this );
				classNames = value.match( rnotwhite ) || [];

				while ( ( className = classNames[ i++ ] ) ) {

					// Check each className given, space separated list
					if ( self.hasClass( className ) ) {
						self.removeClass( className );
					} else {
						self.addClass( className );
					}
				}

			// Toggle whole class name
			} else if ( value === undefined || type === "boolean" ) {
				className = getClass( this );
				if ( className ) {

					// Store className if set
					dataPriv.set( this, "__className__", className );
				}

				// If the element has a class name or if we're passed `false`,
				// then remove the whole classname (if there was one, the above saved it).
				// Otherwise bring back whatever was previously saved (if anything),
				// falling back to the empty string if nothing was stored.
				if ( this.setAttribute ) {
					this.setAttribute( "class",
						className || value === false ?
						"" :
						dataPriv.get( this, "__className__" ) || ""
					);
				}
			}
		} );
	},

	hasClass: function( selector ) {
		var className, elem,
			i = 0;

		className = " " + selector + " ";
		while ( ( elem = this[ i++ ] ) ) {
			if ( elem.nodeType === 1 &&
				( " " + getClass( elem ) + " " ).replace( rclass, " " )
					.indexOf( className ) > -1
			) {
				return true;
			}
		}

		return false;
	}
} );




var rreturn = /\r/g,
	rspaces = /[\x20\t\r\n\f]+/g;

jQuery.fn.extend( {
	val: function( value ) {
		var hooks, ret, isFunction,
			elem = this[ 0 ];

		if ( !arguments.length ) {
			if ( elem ) {
				hooks = jQuery.valHooks[ elem.type ] ||
					jQuery.valHooks[ elem.nodeName.toLowerCase() ];

				if ( hooks &&
					"get" in hooks &&
					( ret = hooks.get( elem, "value" ) ) !== undefined
				) {
					return ret;
				}

				ret = elem.value;

				return typeof ret === "string" ?

					// Handle most common string cases
					ret.replace( rreturn, "" ) :

					// Handle cases where value is null/undef or number
					ret == null ? "" : ret;
			}

			return;
		}

		isFunction = jQuery.isFunction( value );

		return this.each( function( i ) {
			var val;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( isFunction ) {
				val = value.call( this, i, jQuery( this ).val() );
			} else {
				val = value;
			}

			// Treat null/undefined as ""; convert numbers to string
			if ( val == null ) {
				val = "";

			} else if ( typeof val === "number" ) {
				val += "";

			} else if ( jQuery.isArray( val ) ) {
				val = jQuery.map( val, function( value ) {
					return value == null ? "" : value + "";
				} );
			}

			hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

			// If set returns undefined, fall back to normal setting
			if ( !hooks || !( "set" in hooks ) || hooks.set( this, val, "value" ) === undefined ) {
				this.value = val;
			}
		} );
	}
} );

jQuery.extend( {
	valHooks: {
		option: {
			get: function( elem ) {

				var val = jQuery.find.attr( elem, "value" );
				return val != null ?
					val :

					// Support: IE <=10 - 11 only
					// option.text throws exceptions (#14686, #14858)
					// Strip and collapse whitespace
					// https://html.spec.whatwg.org/#strip-and-collapse-whitespace
					jQuery.trim( jQuery.text( elem ) ).replace( rspaces, " " );
			}
		},
		select: {
			get: function( elem ) {
				var value, option,
					options = elem.options,
					index = elem.selectedIndex,
					one = elem.type === "select-one",
					values = one ? null : [],
					max = one ? index + 1 : options.length,
					i = index < 0 ?
						max :
						one ? index : 0;

				// Loop through all the selected options
				for ( ; i < max; i++ ) {
					option = options[ i ];

					// Support: IE <=9 only
					// IE8-9 doesn't update selected after form reset (#2551)
					if ( ( option.selected || i === index ) &&

							// Don't return options that are disabled or in a disabled optgroup
							!option.disabled &&
							( !option.parentNode.disabled ||
								!jQuery.nodeName( option.parentNode, "optgroup" ) ) ) {

						// Get the specific value for the option
						value = jQuery( option ).val();

						// We don't need an array for one selects
						if ( one ) {
							return value;
						}

						// Multi-Selects return an array
						values.push( value );
					}
				}

				return values;
			},

			set: function( elem, value ) {
				var optionSet, option,
					options = elem.options,
					values = jQuery.makeArray( value ),
					i = options.length;

				while ( i-- ) {
					option = options[ i ];

					/* eslint-disable no-cond-assign */

					if ( option.selected =
						jQuery.inArray( jQuery.valHooks.option.get( option ), values ) > -1
					) {
						optionSet = true;
					}

					/* eslint-enable no-cond-assign */
				}

				// Force browsers to behave consistently when non-matching value is set
				if ( !optionSet ) {
					elem.selectedIndex = -1;
				}
				return values;
			}
		}
	}
} );

// Radios and checkboxes getter/setter
jQuery.each( [ "radio", "checkbox" ], function() {
	jQuery.valHooks[ this ] = {
		set: function( elem, value ) {
			if ( jQuery.isArray( value ) ) {
				return ( elem.checked = jQuery.inArray( jQuery( elem ).val(), value ) > -1 );
			}
		}
	};
	if ( !support.checkOn ) {
		jQuery.valHooks[ this ].get = function( elem ) {
			return elem.getAttribute( "value" ) === null ? "on" : elem.value;
		};
	}
} );




// Return jQuery for attributes-only inclusion


var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/;

jQuery.extend( jQuery.event, {

	trigger: function( event, data, elem, onlyHandlers ) {

		var i, cur, tmp, bubbleType, ontype, handle, special,
			eventPath = [ elem || document ],
			type = hasOwn.call( event, "type" ) ? event.type : event,
			namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split( "." ) : [];

		cur = tmp = elem = elem || document;

		// Don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// focus/blur morphs to focusin/out; ensure we're not firing them right now
		if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
			return;
		}

		if ( type.indexOf( "." ) > -1 ) {

			// Namespaced trigger; create a regexp to match event type in handle()
			namespaces = type.split( "." );
			type = namespaces.shift();
			namespaces.sort();
		}
		ontype = type.indexOf( ":" ) < 0 && "on" + type;

		// Caller can pass in a jQuery.Event object, Object, or just an event type string
		event = event[ jQuery.expando ] ?
			event :
			new jQuery.Event( type, typeof event === "object" && event );

		// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
		event.isTrigger = onlyHandlers ? 2 : 3;
		event.namespace = namespaces.join( "." );
		event.rnamespace = event.namespace ?
			new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" ) :
			null;

		// Clean up the event in case it is being reused
		event.result = undefined;
		if ( !event.target ) {
			event.target = elem;
		}

		// Clone any incoming data and prepend the event, creating the handler arg list
		data = data == null ?
			[ event ] :
			jQuery.makeArray( data, [ event ] );

		// Allow special events to draw outside the lines
		special = jQuery.event.special[ type ] || {};
		if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
			return;
		}

		// Determine event propagation path in advance, per W3C events spec (#9951)
		// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
		if ( !onlyHandlers && !special.noBubble && !jQuery.isWindow( elem ) ) {

			bubbleType = special.delegateType || type;
			if ( !rfocusMorph.test( bubbleType + type ) ) {
				cur = cur.parentNode;
			}
			for ( ; cur; cur = cur.parentNode ) {
				eventPath.push( cur );
				tmp = cur;
			}

			// Only add window if we got to document (e.g., not plain obj or detached DOM)
			if ( tmp === ( elem.ownerDocument || document ) ) {
				eventPath.push( tmp.defaultView || tmp.parentWindow || window );
			}
		}

		// Fire handlers on the event path
		i = 0;
		while ( ( cur = eventPath[ i++ ] ) && !event.isPropagationStopped() ) {

			event.type = i > 1 ?
				bubbleType :
				special.bindType || type;

			// jQuery handler
			handle = ( dataPriv.get( cur, "events" ) || {} )[ event.type ] &&
				dataPriv.get( cur, "handle" );
			if ( handle ) {
				handle.apply( cur, data );
			}

			// Native handler
			handle = ontype && cur[ ontype ];
			if ( handle && handle.apply && acceptData( cur ) ) {
				event.result = handle.apply( cur, data );
				if ( event.result === false ) {
					event.preventDefault();
				}
			}
		}
		event.type = type;

		// If nobody prevented the default action, do it now
		if ( !onlyHandlers && !event.isDefaultPrevented() ) {

			if ( ( !special._default ||
				special._default.apply( eventPath.pop(), data ) === false ) &&
				acceptData( elem ) ) {

				// Call a native DOM method on the target with the same name as the event.
				// Don't do default actions on window, that's where global variables be (#6170)
				if ( ontype && jQuery.isFunction( elem[ type ] ) && !jQuery.isWindow( elem ) ) {

					// Don't re-trigger an onFOO event when we call its FOO() method
					tmp = elem[ ontype ];

					if ( tmp ) {
						elem[ ontype ] = null;
					}

					// Prevent re-triggering of the same event, since we already bubbled it above
					jQuery.event.triggered = type;
					elem[ type ]();
					jQuery.event.triggered = undefined;

					if ( tmp ) {
						elem[ ontype ] = tmp;
					}
				}
			}
		}

		return event.result;
	},

	// Piggyback on a donor event to simulate a different one
	// Used only for `focus(in | out)` events
	simulate: function( type, elem, event ) {
		var e = jQuery.extend(
			new jQuery.Event(),
			event,
			{
				type: type,
				isSimulated: true
			}
		);

		jQuery.event.trigger( e, null, elem );
	}

} );

jQuery.fn.extend( {

	trigger: function( type, data ) {
		return this.each( function() {
			jQuery.event.trigger( type, data, this );
		} );
	},
	triggerHandler: function( type, data ) {
		var elem = this[ 0 ];
		if ( elem ) {
			return jQuery.event.trigger( type, data, elem, true );
		}
	}
} );


jQuery.each( ( "blur focus focusin focusout resize scroll click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup contextmenu" ).split( " " ),
	function( i, name ) {

	// Handle event binding
	jQuery.fn[ name ] = function( data, fn ) {
		return arguments.length > 0 ?
			this.on( name, null, data, fn ) :
			this.trigger( name );
	};
} );

jQuery.fn.extend( {
	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	}
} );




support.focusin = "onfocusin" in window;


// Support: Firefox <=44
// Firefox doesn't have focus(in | out) events
// Related ticket - https://bugzilla.mozilla.org/show_bug.cgi?id=687787
//
// Support: Chrome <=48 - 49, Safari <=9.0 - 9.1
// focus(in | out) events fire after focus & blur events,
// which is spec violation - http://www.w3.org/TR/DOM-Level-3-Events/#events-focusevent-event-order
// Related ticket - https://bugs.chromium.org/p/chromium/issues/detail?id=449857
if ( !support.focusin ) {
	jQuery.each( { focus: "focusin", blur: "focusout" }, function( orig, fix ) {

		// Attach a single capturing handler on the document while someone wants focusin/focusout
		var handler = function( event ) {
			jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ) );
		};

		jQuery.event.special[ fix ] = {
			setup: function() {
				var doc = this.ownerDocument || this,
					attaches = dataPriv.access( doc, fix );

				if ( !attaches ) {
					doc.addEventListener( orig, handler, true );
				}
				dataPriv.access( doc, fix, ( attaches || 0 ) + 1 );
			},
			teardown: function() {
				var doc = this.ownerDocument || this,
					attaches = dataPriv.access( doc, fix ) - 1;

				if ( !attaches ) {
					doc.removeEventListener( orig, handler, true );
					dataPriv.remove( doc, fix );

				} else {
					dataPriv.access( doc, fix, attaches );
				}
			}
		};
	} );
}
var location = window.location;

var nonce = jQuery.now();

var rquery = ( /\?/ );



// Cross-browser xml parsing
jQuery.parseXML = function( data ) {
	var xml;
	if ( !data || typeof data !== "string" ) {
		return null;
	}

	// Support: IE 9 - 11 only
	// IE throws on parseFromString with invalid input.
	try {
		xml = ( new window.DOMParser() ).parseFromString( data, "text/xml" );
	} catch ( e ) {
		xml = undefined;
	}

	if ( !xml || xml.getElementsByTagName( "parsererror" ).length ) {
		jQuery.error( "Invalid XML: " + data );
	}
	return xml;
};


var
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
	rsubmittable = /^(?:input|select|textarea|keygen)/i;

function buildParams( prefix, obj, traditional, add ) {
	var name;

	if ( jQuery.isArray( obj ) ) {

		// Serialize array item.
		jQuery.each( obj, function( i, v ) {
			if ( traditional || rbracket.test( prefix ) ) {

				// Treat each array item as a scalar.
				add( prefix, v );

			} else {

				// Item is non-scalar (array or object), encode its numeric index.
				buildParams(
					prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
					v,
					traditional,
					add
				);
			}
		} );

	} else if ( !traditional && jQuery.type( obj ) === "object" ) {

		// Serialize object item.
		for ( name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {

		// Serialize scalar item.
		add( prefix, obj );
	}
}

// Serialize an array of form elements or a set of
// key/values into a query string
jQuery.param = function( a, traditional ) {
	var prefix,
		s = [],
		add = function( key, valueOrFunction ) {

			// If value is a function, invoke it and use its return value
			var value = jQuery.isFunction( valueOrFunction ) ?
				valueOrFunction() :
				valueOrFunction;

			s[ s.length ] = encodeURIComponent( key ) + "=" +
				encodeURIComponent( value == null ? "" : value );
		};

	// If an array was passed in, assume that it is an array of form elements.
	if ( jQuery.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {

		// Serialize the form elements
		jQuery.each( a, function() {
			add( this.name, this.value );
		} );

	} else {

		// If traditional, encode the "old" way (the way 1.3.2 or older
		// did it), otherwise encode params recursively.
		for ( prefix in a ) {
			buildParams( prefix, a[ prefix ], traditional, add );
		}
	}

	// Return the resulting serialization
	return s.join( "&" );
};

jQuery.fn.extend( {
	serialize: function() {
		return jQuery.param( this.serializeArray() );
	},
	serializeArray: function() {
		return this.map( function() {

			// Can add propHook for "elements" to filter or add form elements
			var elements = jQuery.prop( this, "elements" );
			return elements ? jQuery.makeArray( elements ) : this;
		} )
		.filter( function() {
			var type = this.type;

			// Use .is( ":disabled" ) so that fieldset[disabled] works
			return this.name && !jQuery( this ).is( ":disabled" ) &&
				rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
				( this.checked || !rcheckableType.test( type ) );
		} )
		.map( function( i, elem ) {
			var val = jQuery( this ).val();

			return val == null ?
				null :
				jQuery.isArray( val ) ?
					jQuery.map( val, function( val ) {
						return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
					} ) :
					{ name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
		} ).get();
	}
} );


var
	r20 = /%20/g,
	rhash = /#.*$/,
	rts = /([?&])_=[^&]*/,
	rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,

	// #7653, #8125, #8152: local protocol detection
	rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
	rnoContent = /^(?:GET|HEAD)$/,
	rprotocol = /^\/\//,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
	prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
	transports = {},

	// Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
	allTypes = "*/".concat( "*" ),

	// Anchor tag for parsing the document origin
	originAnchor = document.createElement( "a" );
	originAnchor.href = location.href;

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

	// dataTypeExpression is optional and defaults to "*"
	return function( dataTypeExpression, func ) {

		if ( typeof dataTypeExpression !== "string" ) {
			func = dataTypeExpression;
			dataTypeExpression = "*";
		}

		var dataType,
			i = 0,
			dataTypes = dataTypeExpression.toLowerCase().match( rnotwhite ) || [];

		if ( jQuery.isFunction( func ) ) {

			// For each dataType in the dataTypeExpression
			while ( ( dataType = dataTypes[ i++ ] ) ) {

				// Prepend if requested
				if ( dataType[ 0 ] === "+" ) {
					dataType = dataType.slice( 1 ) || "*";
					( structure[ dataType ] = structure[ dataType ] || [] ).unshift( func );

				// Otherwise append
				} else {
					( structure[ dataType ] = structure[ dataType ] || [] ).push( func );
				}
			}
		}
	};
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

	var inspected = {},
		seekingTransport = ( structure === transports );

	function inspect( dataType ) {
		var selected;
		inspected[ dataType ] = true;
		jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
			var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
			if ( typeof dataTypeOrTransport === "string" &&
				!seekingTransport && !inspected[ dataTypeOrTransport ] ) {

				options.dataTypes.unshift( dataTypeOrTransport );
				inspect( dataTypeOrTransport );
				return false;
			} else if ( seekingTransport ) {
				return !( selected = dataTypeOrTransport );
			}
		} );
		return selected;
	}

	return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes #9887
function ajaxExtend( target, src ) {
	var key, deep,
		flatOptions = jQuery.ajaxSettings.flatOptions || {};

	for ( key in src ) {
		if ( src[ key ] !== undefined ) {
			( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
		}
	}
	if ( deep ) {
		jQuery.extend( true, target, deep );
	}

	return target;
}

/* Handles responses to an ajax request:
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {

	var ct, type, finalDataType, firstDataType,
		contents = s.contents,
		dataTypes = s.dataTypes;

	// Remove auto dataType and get content-type in the process
	while ( dataTypes[ 0 ] === "*" ) {
		dataTypes.shift();
		if ( ct === undefined ) {
			ct = s.mimeType || jqXHR.getResponseHeader( "Content-Type" );
		}
	}

	// Check if we're dealing with a known content-type
	if ( ct ) {
		for ( type in contents ) {
			if ( contents[ type ] && contents[ type ].test( ct ) ) {
				dataTypes.unshift( type );
				break;
			}
		}
	}

	// Check to see if we have a response for the expected dataType
	if ( dataTypes[ 0 ] in responses ) {
		finalDataType = dataTypes[ 0 ];
	} else {

		// Try convertible dataTypes
		for ( type in responses ) {
			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[ 0 ] ] ) {
				finalDataType = type;
				break;
			}
			if ( !firstDataType ) {
				firstDataType = type;
			}
		}

		// Or just use first one
		finalDataType = finalDataType || firstDataType;
	}

	// If we found a dataType
	// We add the dataType to the list if needed
	// and return the corresponding response
	if ( finalDataType ) {
		if ( finalDataType !== dataTypes[ 0 ] ) {
			dataTypes.unshift( finalDataType );
		}
		return responses[ finalDataType ];
	}
}

/* Chain conversions given the request and the original response
 * Also sets the responseXXX fields on the jqXHR instance
 */
function ajaxConvert( s, response, jqXHR, isSuccess ) {
	var conv2, current, conv, tmp, prev,
		converters = {},

		// Work with a copy of dataTypes in case we need to modify it for conversion
		dataTypes = s.dataTypes.slice();

	// Create converters map with lowercased keys
	if ( dataTypes[ 1 ] ) {
		for ( conv in s.converters ) {
			converters[ conv.toLowerCase() ] = s.converters[ conv ];
		}
	}

	current = dataTypes.shift();

	// Convert to each sequential dataType
	while ( current ) {

		if ( s.responseFields[ current ] ) {
			jqXHR[ s.responseFields[ current ] ] = response;
		}

		// Apply the dataFilter if provided
		if ( !prev && isSuccess && s.dataFilter ) {
			response = s.dataFilter( response, s.dataType );
		}

		prev = current;
		current = dataTypes.shift();

		if ( current ) {

			// There's only work to do if current dataType is non-auto
			if ( current === "*" ) {

				current = prev;

			// Convert response if prev dataType is non-auto and differs from current
			} else if ( prev !== "*" && prev !== current ) {

				// Seek a direct converter
				conv = converters[ prev + " " + current ] || converters[ "* " + current ];

				// If none found, seek a pair
				if ( !conv ) {
					for ( conv2 in converters ) {

						// If conv2 outputs current
						tmp = conv2.split( " " );
						if ( tmp[ 1 ] === current ) {

							// If prev can be converted to accepted input
							conv = converters[ prev + " " + tmp[ 0 ] ] ||
								converters[ "* " + tmp[ 0 ] ];
							if ( conv ) {

								// Condense equivalence converters
								if ( conv === true ) {
									conv = converters[ conv2 ];

								// Otherwise, insert the intermediate dataType
								} else if ( converters[ conv2 ] !== true ) {
									current = tmp[ 0 ];
									dataTypes.unshift( tmp[ 1 ] );
								}
								break;
							}
						}
					}
				}

				// Apply converter (if not an equivalence)
				if ( conv !== true ) {

					// Unless errors are allowed to bubble, catch and return them
					if ( conv && s.throws ) {
						response = conv( response );
					} else {
						try {
							response = conv( response );
						} catch ( e ) {
							return {
								state: "parsererror",
								error: conv ? e : "No conversion from " + prev + " to " + current
							};
						}
					}
				}
			}
		}
	}

	return { state: "success", data: response };
}

jQuery.extend( {

	// Counter for holding the number of active queries
	active: 0,

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {},

	ajaxSettings: {
		url: location.href,
		type: "GET",
		isLocal: rlocalProtocol.test( location.protocol ),
		global: true,
		processData: true,
		async: true,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",

		/*
		timeout: 0,
		data: null,
		dataType: null,
		username: null,
		password: null,
		cache: null,
		throws: false,
		traditional: false,
		headers: {},
		*/

		accepts: {
			"*": allTypes,
			text: "text/plain",
			html: "text/html",
			xml: "application/xml, text/xml",
			json: "application/json, text/javascript"
		},

		contents: {
			xml: /\bxml\b/,
			html: /\bhtml/,
			json: /\bjson\b/
		},

		responseFields: {
			xml: "responseXML",
			text: "responseText",
			json: "responseJSON"
		},

		// Data converters
		// Keys separate source (or catchall "*") and destination types with a single space
		converters: {

			// Convert anything to text
			"* text": String,

			// Text to html (true = no transformation)
			"text html": true,

			// Evaluate text as a json expression
			"text json": JSON.parse,

			// Parse text as xml
			"text xml": jQuery.parseXML
		},

		// For options that shouldn't be deep extended:
		// you can add your own custom options here if
		// and when you create one that shouldn't be
		// deep extended (see ajaxExtend)
		flatOptions: {
			url: true,
			context: true
		}
	},

	// Creates a full fledged settings object into target
	// with both ajaxSettings and settings fields.
	// If target is omitted, writes into ajaxSettings.
	ajaxSetup: function( target, settings ) {
		return settings ?

			// Building a settings object
			ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

			// Extending ajaxSettings
			ajaxExtend( jQuery.ajaxSettings, target );
	},

	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
	ajaxTransport: addToPrefiltersOrTransports( transports ),

	// Main method
	ajax: function( url, options ) {

		// If url is an object, simulate pre-1.5 signature
		if ( typeof url === "object" ) {
			options = url;
			url = undefined;
		}

		// Force options to be an object
		options = options || {};

		var transport,

			// URL without anti-cache param
			cacheURL,

			// Response headers
			responseHeadersString,
			responseHeaders,

			// timeout handle
			timeoutTimer,

			// Url cleanup var
			urlAnchor,

			// Request state (becomes false upon send and true upon completion)
			completed,

			// To know if global events are to be dispatched
			fireGlobals,

			// Loop variable
			i,

			// uncached part of the url
			uncached,

			// Create the final options object
			s = jQuery.ajaxSetup( {}, options ),

			// Callbacks context
			callbackContext = s.context || s,

			// Context for global events is callbackContext if it is a DOM node or jQuery collection
			globalEventContext = s.context &&
				( callbackContext.nodeType || callbackContext.jquery ) ?
					jQuery( callbackContext ) :
					jQuery.event,

			// Deferreds
			deferred = jQuery.Deferred(),
			completeDeferred = jQuery.Callbacks( "once memory" ),

			// Status-dependent callbacks
			statusCode = s.statusCode || {},

			// Headers (they are sent all at once)
			requestHeaders = {},
			requestHeadersNames = {},

			// Default abort message
			strAbort = "canceled",

			// Fake xhr
			jqXHR = {
				readyState: 0,

				// Builds headers hashtable if needed
				getResponseHeader: function( key ) {
					var match;
					if ( completed ) {
						if ( !responseHeaders ) {
							responseHeaders = {};
							while ( ( match = rheaders.exec( responseHeadersString ) ) ) {
								responseHeaders[ match[ 1 ].toLowerCase() ] = match[ 2 ];
							}
						}
						match = responseHeaders[ key.toLowerCase() ];
					}
					return match == null ? null : match;
				},

				// Raw string
				getAllResponseHeaders: function() {
					return completed ? responseHeadersString : null;
				},

				// Caches the header
				setRequestHeader: function( name, value ) {
					if ( completed == null ) {
						name = requestHeadersNames[ name.toLowerCase() ] =
							requestHeadersNames[ name.toLowerCase() ] || name;
						requestHeaders[ name ] = value;
					}
					return this;
				},

				// Overrides response content-type header
				overrideMimeType: function( type ) {
					if ( completed == null ) {
						s.mimeType = type;
					}
					return this;
				},

				// Status-dependent callbacks
				statusCode: function( map ) {
					var code;
					if ( map ) {
						if ( completed ) {

							// Execute the appropriate callbacks
							jqXHR.always( map[ jqXHR.status ] );
						} else {

							// Lazy-add the new callbacks in a way that preserves old ones
							for ( code in map ) {
								statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
							}
						}
					}
					return this;
				},

				// Cancel the request
				abort: function( statusText ) {
					var finalText = statusText || strAbort;
					if ( transport ) {
						transport.abort( finalText );
					}
					done( 0, finalText );
					return this;
				}
			};

		// Attach deferreds
		deferred.promise( jqXHR );

		// Add protocol if not provided (prefilters might expect it)
		// Handle falsy url in the settings object (#10093: consistency with old signature)
		// We also use the url parameter if available
		s.url = ( ( url || s.url || location.href ) + "" )
			.replace( rprotocol, location.protocol + "//" );

		// Alias method option to type as per ticket #12004
		s.type = options.method || options.type || s.method || s.type;

		// Extract dataTypes list
		s.dataTypes = ( s.dataType || "*" ).toLowerCase().match( rnotwhite ) || [ "" ];

		// A cross-domain request is in order when the origin doesn't match the current origin.
		if ( s.crossDomain == null ) {
			urlAnchor = document.createElement( "a" );

			// Support: IE <=8 - 11, Edge 12 - 13
			// IE throws exception on accessing the href property if url is malformed,
			// e.g. http://example.com:80x/
			try {
				urlAnchor.href = s.url;

				// Support: IE <=8 - 11 only
				// Anchor's host property isn't correctly set when s.url is relative
				urlAnchor.href = urlAnchor.href;
				s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !==
					urlAnchor.protocol + "//" + urlAnchor.host;
			} catch ( e ) {

				// If there is an error parsing the URL, assume it is crossDomain,
				// it can be rejected by the transport if it is invalid
				s.crossDomain = true;
			}
		}

		// Convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Apply prefilters
		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

		// If request was aborted inside a prefilter, stop there
		if ( completed ) {
			return jqXHR;
		}

		// We can fire global events as of now if asked to
		// Don't fire events if jQuery.event is undefined in an AMD-usage scenario (#15118)
		fireGlobals = jQuery.event && s.global;

		// Watch for a new set of requests
		if ( fireGlobals && jQuery.active++ === 0 ) {
			jQuery.event.trigger( "ajaxStart" );
		}

		// Uppercase the type
		s.type = s.type.toUpperCase();

		// Determine if request has content
		s.hasContent = !rnoContent.test( s.type );

		// Save the URL in case we're toying with the If-Modified-Since
		// and/or If-None-Match header later on
		// Remove hash to simplify url manipulation
		cacheURL = s.url.replace( rhash, "" );

		// More options handling for requests with no content
		if ( !s.hasContent ) {

			// Remember the hash so we can put it back
			uncached = s.url.slice( cacheURL.length );

			// If data is available, append data to url
			if ( s.data ) {
				cacheURL += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data;

				// #9682: remove data so that it's not used in an eventual retry
				delete s.data;
			}

			// Add anti-cache in uncached url if needed
			if ( s.cache === false ) {
				cacheURL = cacheURL.replace( rts, "" );
				uncached = ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + ( nonce++ ) + uncached;
			}

			// Put hash and anti-cache on the URL that will be requested (gh-1732)
			s.url = cacheURL + uncached;

		// Change '%20' to '+' if this is encoded form body content (gh-2658)
		} else if ( s.data && s.processData &&
			( s.contentType || "" ).indexOf( "application/x-www-form-urlencoded" ) === 0 ) {
			s.data = s.data.replace( r20, "+" );
		}

		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
		if ( s.ifModified ) {
			if ( jQuery.lastModified[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
			}
			if ( jQuery.etag[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
			}
		}

		// Set the correct header, if data is being sent
		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
			jqXHR.setRequestHeader( "Content-Type", s.contentType );
		}

		// Set the Accepts header for the server, depending on the dataType
		jqXHR.setRequestHeader(
			"Accept",
			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[ 0 ] ] ?
				s.accepts[ s.dataTypes[ 0 ] ] +
					( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
				s.accepts[ "*" ]
		);

		// Check for headers option
		for ( i in s.headers ) {
			jqXHR.setRequestHeader( i, s.headers[ i ] );
		}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend &&
			( s.beforeSend.call( callbackContext, jqXHR, s ) === false || completed ) ) {

			// Abort if not done already and return
			return jqXHR.abort();
		}

		// Aborting is no longer a cancellation
		strAbort = "abort";

		// Install callbacks on deferreds
		completeDeferred.add( s.complete );
		jqXHR.done( s.success );
		jqXHR.fail( s.error );

		// Get transport
		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

		// If no transport, we auto-abort
		if ( !transport ) {
			done( -1, "No Transport" );
		} else {
			jqXHR.readyState = 1;

			// Send global event
			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
			}

			// If request was aborted inside ajaxSend, stop there
			if ( completed ) {
				return jqXHR;
			}

			// Timeout
			if ( s.async && s.timeout > 0 ) {
				timeoutTimer = window.setTimeout( function() {
					jqXHR.abort( "timeout" );
				}, s.timeout );
			}

			try {
				completed = false;
				transport.send( requestHeaders, done );
			} catch ( e ) {

				// Rethrow post-completion exceptions
				if ( completed ) {
					throw e;
				}

				// Propagate others as results
				done( -1, e );
			}
		}

		// Callback for when everything is done
		function done( status, nativeStatusText, responses, headers ) {
			var isSuccess, success, error, response, modified,
				statusText = nativeStatusText;

			// Ignore repeat invocations
			if ( completed ) {
				return;
			}

			completed = true;

			// Clear timeout if it exists
			if ( timeoutTimer ) {
				window.clearTimeout( timeoutTimer );
			}

			// Dereference transport for early garbage collection
			// (no matter how long the jqXHR object will be used)
			transport = undefined;

			// Cache response headers
			responseHeadersString = headers || "";

			// Set readyState
			jqXHR.readyState = status > 0 ? 4 : 0;

			// Determine if successful
			isSuccess = status >= 200 && status < 300 || status === 304;

			// Get response data
			if ( responses ) {
				response = ajaxHandleResponses( s, jqXHR, responses );
			}

			// Convert no matter what (that way responseXXX fields are always set)
			response = ajaxConvert( s, response, jqXHR, isSuccess );

			// If successful, handle type chaining
			if ( isSuccess ) {

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					modified = jqXHR.getResponseHeader( "Last-Modified" );
					if ( modified ) {
						jQuery.lastModified[ cacheURL ] = modified;
					}
					modified = jqXHR.getResponseHeader( "etag" );
					if ( modified ) {
						jQuery.etag[ cacheURL ] = modified;
					}
				}

				// if no content
				if ( status === 204 || s.type === "HEAD" ) {
					statusText = "nocontent";

				// if not modified
				} else if ( status === 304 ) {
					statusText = "notmodified";

				// If we have data, let's convert it
				} else {
					statusText = response.state;
					success = response.data;
					error = response.error;
					isSuccess = !error;
				}
			} else {

				// Extract error from statusText and normalize for non-aborts
				error = statusText;
				if ( status || !statusText ) {
					statusText = "error";
					if ( status < 0 ) {
						status = 0;
					}
				}
			}

			// Set data for the fake xhr object
			jqXHR.status = status;
			jqXHR.statusText = ( nativeStatusText || statusText ) + "";

			// Success/Error
			if ( isSuccess ) {
				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
			} else {
				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
			}

			// Status-dependent callbacks
			jqXHR.statusCode( statusCode );
			statusCode = undefined;

			if ( fireGlobals ) {
				globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
					[ jqXHR, s, isSuccess ? success : error ] );
			}

			// Complete
			completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );

				// Handle the global AJAX counter
				if ( !( --jQuery.active ) ) {
					jQuery.event.trigger( "ajaxStop" );
				}
			}
		}

		return jqXHR;
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get( url, data, callback, "json" );
	},

	getScript: function( url, callback ) {
		return jQuery.get( url, undefined, callback, "script" );
	}
} );

jQuery.each( [ "get", "post" ], function( i, method ) {
	jQuery[ method ] = function( url, data, callback, type ) {

		// Shift arguments if data argument was omitted
		if ( jQuery.isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = undefined;
		}

		// The url can be an options object (which then must have .url)
		return jQuery.ajax( jQuery.extend( {
			url: url,
			type: method,
			dataType: type,
			data: data,
			success: callback
		}, jQuery.isPlainObject( url ) && url ) );
	};
} );


jQuery._evalUrl = function( url ) {
	return jQuery.ajax( {
		url: url,

		// Make this explicit, since user can override this through ajaxSetup (#11264)
		type: "GET",
		dataType: "script",
		cache: true,
		async: false,
		global: false,
		"throws": true
	} );
};


jQuery.fn.extend( {
	wrapAll: function( html ) {
		var wrap;

		if ( this[ 0 ] ) {
			if ( jQuery.isFunction( html ) ) {
				html = html.call( this[ 0 ] );
			}

			// The elements to wrap the target around
			wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

			if ( this[ 0 ].parentNode ) {
				wrap.insertBefore( this[ 0 ] );
			}

			wrap.map( function() {
				var elem = this;

				while ( elem.firstElementChild ) {
					elem = elem.firstElementChild;
				}

				return elem;
			} ).append( this );
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( jQuery.isFunction( html ) ) {
			return this.each( function( i ) {
				jQuery( this ).wrapInner( html.call( this, i ) );
			} );
		}

		return this.each( function() {
			var self = jQuery( this ),
				contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		} );
	},

	wrap: function( html ) {
		var isFunction = jQuery.isFunction( html );

		return this.each( function( i ) {
			jQuery( this ).wrapAll( isFunction ? html.call( this, i ) : html );
		} );
	},

	unwrap: function( selector ) {
		this.parent( selector ).not( "body" ).each( function() {
			jQuery( this ).replaceWith( this.childNodes );
		} );
		return this;
	}
} );


jQuery.expr.pseudos.hidden = function( elem ) {
	return !jQuery.expr.pseudos.visible( elem );
};
jQuery.expr.pseudos.visible = function( elem ) {
	return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
};




jQuery.ajaxSettings.xhr = function() {
	try {
		return new window.XMLHttpRequest();
	} catch ( e ) {}
};

var xhrSuccessStatus = {

		// File protocol always yields status code 0, assume 200
		0: 200,

		// Support: IE <=9 only
		// #1450: sometimes IE returns 1223 when it should be 204
		1223: 204
	},
	xhrSupported = jQuery.ajaxSettings.xhr();

support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
support.ajax = xhrSupported = !!xhrSupported;

jQuery.ajaxTransport( function( options ) {
	var callback, errorCallback;

	// Cross domain only allowed if supported through XMLHttpRequest
	if ( support.cors || xhrSupported && !options.crossDomain ) {
		return {
			send: function( headers, complete ) {
				var i,
					xhr = options.xhr();

				xhr.open(
					options.type,
					options.url,
					options.async,
					options.username,
					options.password
				);

				// Apply custom fields if provided
				if ( options.xhrFields ) {
					for ( i in options.xhrFields ) {
						xhr[ i ] = options.xhrFields[ i ];
					}
				}

				// Override mime type if needed
				if ( options.mimeType && xhr.overrideMimeType ) {
					xhr.overrideMimeType( options.mimeType );
				}

				// X-Requested-With header
				// For cross-domain requests, seeing as conditions for a preflight are
				// akin to a jigsaw puzzle, we simply never set it to be sure.
				// (it can always be set on a per-request basis or even using ajaxSetup)
				// For same-domain requests, won't change header if already provided.
				if ( !options.crossDomain && !headers[ "X-Requested-With" ] ) {
					headers[ "X-Requested-With" ] = "XMLHttpRequest";
				}

				// Set headers
				for ( i in headers ) {
					xhr.setRequestHeader( i, headers[ i ] );
				}

				// Callback
				callback = function( type ) {
					return function() {
						if ( callback ) {
							callback = errorCallback = xhr.onload =
								xhr.onerror = xhr.onabort = xhr.onreadystatechange = null;

							if ( type === "abort" ) {
								xhr.abort();
							} else if ( type === "error" ) {

								// Support: IE <=9 only
								// On a manual native abort, IE9 throws
								// errors on any property access that is not readyState
								if ( typeof xhr.status !== "number" ) {
									complete( 0, "error" );
								} else {
									complete(

										// File: protocol always yields status 0; see #8605, #14207
										xhr.status,
										xhr.statusText
									);
								}
							} else {
								complete(
									xhrSuccessStatus[ xhr.status ] || xhr.status,
									xhr.statusText,

									// Support: IE <=9 only
									// IE9 has no XHR2 but throws on binary (trac-11426)
									// For XHR2 non-text, let the caller handle it (gh-2498)
									( xhr.responseType || "text" ) !== "text"  ||
									typeof xhr.responseText !== "string" ?
										{ binary: xhr.response } :
										{ text: xhr.responseText },
									xhr.getAllResponseHeaders()
								);
							}
						}
					};
				};

				// Listen to events
				xhr.onload = callback();
				errorCallback = xhr.onerror = callback( "error" );

				// Support: IE 9 only
				// Use onreadystatechange to replace onabort
				// to handle uncaught aborts
				if ( xhr.onabort !== undefined ) {
					xhr.onabort = errorCallback;
				} else {
					xhr.onreadystatechange = function() {

						// Check readyState before timeout as it changes
						if ( xhr.readyState === 4 ) {

							// Allow onerror to be called first,
							// but that will not handle a native abort
							// Also, save errorCallback to a variable
							// as xhr.onerror cannot be accessed
							window.setTimeout( function() {
								if ( callback ) {
									errorCallback();
								}
							} );
						}
					};
				}

				// Create the abort callback
				callback = callback( "abort" );

				try {

					// Do send the request (this may raise an exception)
					xhr.send( options.hasContent && options.data || null );
				} catch ( e ) {

					// #14683: Only rethrow if this hasn't been notified as an error yet
					if ( callback ) {
						throw e;
					}
				}
			},

			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




// Prevent auto-execution of scripts when no explicit dataType was provided (See gh-2432)
jQuery.ajaxPrefilter( function( s ) {
	if ( s.crossDomain ) {
		s.contents.script = false;
	}
} );

// Install script dataType
jQuery.ajaxSetup( {
	accepts: {
		script: "text/javascript, application/javascript, " +
			"application/ecmascript, application/x-ecmascript"
	},
	contents: {
		script: /\b(?:java|ecma)script\b/
	},
	converters: {
		"text script": function( text ) {
			jQuery.globalEval( text );
			return text;
		}
	}
} );

// Handle cache's special case and crossDomain
jQuery.ajaxPrefilter( "script", function( s ) {
	if ( s.cache === undefined ) {
		s.cache = false;
	}
	if ( s.crossDomain ) {
		s.type = "GET";
	}
} );

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function( s ) {

	// This transport only deals with cross domain requests
	if ( s.crossDomain ) {
		var script, callback;
		return {
			send: function( _, complete ) {
				script = jQuery( "<script>" ).prop( {
					charset: s.scriptCharset,
					src: s.url
				} ).on(
					"load error",
					callback = function( evt ) {
						script.remove();
						callback = null;
						if ( evt ) {
							complete( evt.type === "error" ? 404 : 200, evt.type );
						}
					}
				);

				// Use native DOM manipulation to avoid our domManip AJAX trickery
				document.head.appendChild( script[ 0 ] );
			},
			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




var oldCallbacks = [],
	rjsonp = /(=)\?(?=&|$)|\?\?/;

// Default jsonp settings
jQuery.ajaxSetup( {
	jsonp: "callback",
	jsonpCallback: function() {
		var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce++ ) );
		this[ callback ] = true;
		return callback;
	}
} );

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

	var callbackName, overwritten, responseContainer,
		jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
			"url" :
			typeof s.data === "string" &&
				( s.contentType || "" )
					.indexOf( "application/x-www-form-urlencoded" ) === 0 &&
				rjsonp.test( s.data ) && "data"
		);

	// Handle iff the expected data type is "jsonp" or we have a parameter to set
	if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

		// Get callback name, remembering preexisting value associated with it
		callbackName = s.jsonpCallback = jQuery.isFunction( s.jsonpCallback ) ?
			s.jsonpCallback() :
			s.jsonpCallback;

		// Insert callback into url or form data
		if ( jsonProp ) {
			s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
		} else if ( s.jsonp !== false ) {
			s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
		}

		// Use data converter to retrieve json after script execution
		s.converters[ "script json" ] = function() {
			if ( !responseContainer ) {
				jQuery.error( callbackName + " was not called" );
			}
			return responseContainer[ 0 ];
		};

		// Force json dataType
		s.dataTypes[ 0 ] = "json";

		// Install callback
		overwritten = window[ callbackName ];
		window[ callbackName ] = function() {
			responseContainer = arguments;
		};

		// Clean-up function (fires after converters)
		jqXHR.always( function() {

			// If previous value didn't exist - remove it
			if ( overwritten === undefined ) {
				jQuery( window ).removeProp( callbackName );

			// Otherwise restore preexisting value
			} else {
				window[ callbackName ] = overwritten;
			}

			// Save back as free
			if ( s[ callbackName ] ) {

				// Make sure that re-using the options doesn't screw things around
				s.jsonpCallback = originalSettings.jsonpCallback;

				// Save the callback name for future use
				oldCallbacks.push( callbackName );
			}

			// Call if it was a function and we have a response
			if ( responseContainer && jQuery.isFunction( overwritten ) ) {
				overwritten( responseContainer[ 0 ] );
			}

			responseContainer = overwritten = undefined;
		} );

		// Delegate to script
		return "script";
	}
} );




// Support: Safari 8 only
// In Safari 8 documents created via document.implementation.createHTMLDocument
// collapse sibling forms: the second one becomes a child of the first one.
// Because of that, this security measure has to be disabled in Safari 8.
// https://bugs.webkit.org/show_bug.cgi?id=137337
support.createHTMLDocument = ( function() {
	var body = document.implementation.createHTMLDocument( "" ).body;
	body.innerHTML = "<form></form><form></form>";
	return body.childNodes.length === 2;
} )();


// Argument "data" should be string of html
// context (optional): If specified, the fragment will be created in this context,
// defaults to document
// keepScripts (optional): If true, will include scripts passed in the html string
jQuery.parseHTML = function( data, context, keepScripts ) {
	if ( typeof data !== "string" ) {
		return [];
	}
	if ( typeof context === "boolean" ) {
		keepScripts = context;
		context = false;
	}

	var base, parsed, scripts;

	if ( !context ) {

		// Stop scripts or inline event handlers from being executed immediately
		// by using document.implementation
		if ( support.createHTMLDocument ) {
			context = document.implementation.createHTMLDocument( "" );

			// Set the base href for the created document
			// so any parsed elements with URLs
			// are based on the document's URL (gh-2965)
			base = context.createElement( "base" );
			base.href = document.location.href;
			context.head.appendChild( base );
		} else {
			context = document;
		}
	}

	parsed = rsingleTag.exec( data );
	scripts = !keepScripts && [];

	// Single tag
	if ( parsed ) {
		return [ context.createElement( parsed[ 1 ] ) ];
	}

	parsed = buildFragment( [ data ], context, scripts );

	if ( scripts && scripts.length ) {
		jQuery( scripts ).remove();
	}

	return jQuery.merge( [], parsed.childNodes );
};


/**
 * Load a url into a page
 */
jQuery.fn.load = function( url, params, callback ) {
	var selector, type, response,
		self = this,
		off = url.indexOf( " " );

	if ( off > -1 ) {
		selector = jQuery.trim( url.slice( off ) );
		url = url.slice( 0, off );
	}

	// If it's a function
	if ( jQuery.isFunction( params ) ) {

		// We assume that it's the callback
		callback = params;
		params = undefined;

	// Otherwise, build a param string
	} else if ( params && typeof params === "object" ) {
		type = "POST";
	}

	// If we have elements to modify, make the request
	if ( self.length > 0 ) {
		jQuery.ajax( {
			url: url,

			// If "type" variable is undefined, then "GET" method will be used.
			// Make value of this field explicit since
			// user can override it through ajaxSetup method
			type: type || "GET",
			dataType: "html",
			data: params
		} ).done( function( responseText ) {

			// Save response for use in complete callback
			response = arguments;

			self.html( selector ?

				// If a selector was specified, locate the right elements in a dummy div
				// Exclude scripts to avoid IE 'Permission Denied' errors
				jQuery( "<div>" ).append( jQuery.parseHTML( responseText ) ).find( selector ) :

				// Otherwise use the full result
				responseText );

		// If the request succeeds, this function gets "data", "status", "jqXHR"
		// but they are ignored because response was set above.
		// If it fails, this function gets "jqXHR", "status", "error"
		} ).always( callback && function( jqXHR, status ) {
			self.each( function() {
				callback.apply( this, response || [ jqXHR.responseText, status, jqXHR ] );
			} );
		} );
	}

	return this;
};




// Attach a bunch of functions for handling common AJAX events
jQuery.each( [
	"ajaxStart",
	"ajaxStop",
	"ajaxComplete",
	"ajaxError",
	"ajaxSuccess",
	"ajaxSend"
], function( i, type ) {
	jQuery.fn[ type ] = function( fn ) {
		return this.on( type, fn );
	};
} );




jQuery.expr.pseudos.animated = function( elem ) {
	return jQuery.grep( jQuery.timers, function( fn ) {
		return elem === fn.elem;
	} ).length;
};




/**
 * Gets a window from an element
 */
function getWindow( elem ) {
	return jQuery.isWindow( elem ) ? elem : elem.nodeType === 9 && elem.defaultView;
}

jQuery.offset = {
	setOffset: function( elem, options, i ) {
		var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
			position = jQuery.css( elem, "position" ),
			curElem = jQuery( elem ),
			props = {};

		// Set position first, in-case top/left are set even on static elem
		if ( position === "static" ) {
			elem.style.position = "relative";
		}

		curOffset = curElem.offset();
		curCSSTop = jQuery.css( elem, "top" );
		curCSSLeft = jQuery.css( elem, "left" );
		calculatePosition = ( position === "absolute" || position === "fixed" ) &&
			( curCSSTop + curCSSLeft ).indexOf( "auto" ) > -1;

		// Need to be able to calculate position if either
		// top or left is auto and position is either absolute or fixed
		if ( calculatePosition ) {
			curPosition = curElem.position();
			curTop = curPosition.top;
			curLeft = curPosition.left;

		} else {
			curTop = parseFloat( curCSSTop ) || 0;
			curLeft = parseFloat( curCSSLeft ) || 0;
		}

		if ( jQuery.isFunction( options ) ) {

			// Use jQuery.extend here to allow modification of coordinates argument (gh-1848)
			options = options.call( elem, i, jQuery.extend( {}, curOffset ) );
		}

		if ( options.top != null ) {
			props.top = ( options.top - curOffset.top ) + curTop;
		}
		if ( options.left != null ) {
			props.left = ( options.left - curOffset.left ) + curLeft;
		}

		if ( "using" in options ) {
			options.using.call( elem, props );

		} else {
			curElem.css( props );
		}
	}
};

jQuery.fn.extend( {
	offset: function( options ) {

		// Preserve chaining for setter
		if ( arguments.length ) {
			return options === undefined ?
				this :
				this.each( function( i ) {
					jQuery.offset.setOffset( this, options, i );
				} );
		}

		var docElem, win, rect, doc,
			elem = this[ 0 ];

		if ( !elem ) {
			return;
		}

		// Support: IE <=11 only
		// Running getBoundingClientRect on a
		// disconnected node in IE throws an error
		if ( !elem.getClientRects().length ) {
			return { top: 0, left: 0 };
		}

		rect = elem.getBoundingClientRect();

		// Make sure element is not hidden (display: none)
		if ( rect.width || rect.height ) {
			doc = elem.ownerDocument;
			win = getWindow( doc );
			docElem = doc.documentElement;

			return {
				top: rect.top + win.pageYOffset - docElem.clientTop,
				left: rect.left + win.pageXOffset - docElem.clientLeft
			};
		}

		// Return zeros for disconnected and hidden elements (gh-2310)
		return rect;
	},

	position: function() {
		if ( !this[ 0 ] ) {
			return;
		}

		var offsetParent, offset,
			elem = this[ 0 ],
			parentOffset = { top: 0, left: 0 };

		// Fixed elements are offset from window (parentOffset = {top:0, left: 0},
		// because it is its only offset parent
		if ( jQuery.css( elem, "position" ) === "fixed" ) {

			// Assume getBoundingClientRect is there when computed position is fixed
			offset = elem.getBoundingClientRect();

		} else {

			// Get *real* offsetParent
			offsetParent = this.offsetParent();

			// Get correct offsets
			offset = this.offset();
			if ( !jQuery.nodeName( offsetParent[ 0 ], "html" ) ) {
				parentOffset = offsetParent.offset();
			}

			// Add offsetParent borders
			parentOffset = {
				top: parentOffset.top + jQuery.css( offsetParent[ 0 ], "borderTopWidth", true ),
				left: parentOffset.left + jQuery.css( offsetParent[ 0 ], "borderLeftWidth", true )
			};
		}

		// Subtract parent offsets and element margins
		return {
			top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
			left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
		};
	},

	// This method will return documentElement in the following cases:
	// 1) For the element inside the iframe without offsetParent, this method will return
	//    documentElement of the parent window
	// 2) For the hidden or detached element
	// 3) For body or html element, i.e. in case of the html node - it will return itself
	//
	// but those exceptions were never presented as a real life use-cases
	// and might be considered as more preferable results.
	//
	// This logic, however, is not guaranteed and can change at any point in the future
	offsetParent: function() {
		return this.map( function() {
			var offsetParent = this.offsetParent;

			while ( offsetParent && jQuery.css( offsetParent, "position" ) === "static" ) {
				offsetParent = offsetParent.offsetParent;
			}

			return offsetParent || documentElement;
		} );
	}
} );

// Create scrollLeft and scrollTop methods
jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
	var top = "pageYOffset" === prop;

	jQuery.fn[ method ] = function( val ) {
		return access( this, function( elem, method, val ) {
			var win = getWindow( elem );

			if ( val === undefined ) {
				return win ? win[ prop ] : elem[ method ];
			}

			if ( win ) {
				win.scrollTo(
					!top ? val : win.pageXOffset,
					top ? val : win.pageYOffset
				);

			} else {
				elem[ method ] = val;
			}
		}, method, val, arguments.length );
	};
} );

// Support: Safari <=7 - 9.1, Chrome <=37 - 49
// Add the top/left cssHooks using jQuery.fn.position
// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
// Blink bug: https://bugs.chromium.org/p/chromium/issues/detail?id=589347
// getComputedStyle returns percent when specified for top/left/bottom/right;
// rather than make the css module depend on the offset module, just check for it here
jQuery.each( [ "top", "left" ], function( i, prop ) {
	jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
		function( elem, computed ) {
			if ( computed ) {
				computed = curCSS( elem, prop );

				// If curCSS returns percentage, fallback to offset
				return rnumnonpx.test( computed ) ?
					jQuery( elem ).position()[ prop ] + "px" :
					computed;
			}
		}
	);
} );


// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
	jQuery.each( { padding: "inner" + name, content: type, "": "outer" + name },
		function( defaultExtra, funcName ) {

		// Margin is only for outerHeight, outerWidth
		jQuery.fn[ funcName ] = function( margin, value ) {
			var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
				extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

			return access( this, function( elem, type, value ) {
				var doc;

				if ( jQuery.isWindow( elem ) ) {

					// $( window ).outerWidth/Height return w/h including scrollbars (gh-1729)
					return funcName.indexOf( "outer" ) === 0 ?
						elem[ "inner" + name ] :
						elem.document.documentElement[ "client" + name ];
				}

				// Get document width or height
				if ( elem.nodeType === 9 ) {
					doc = elem.documentElement;

					// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
					// whichever is greatest
					return Math.max(
						elem.body[ "scroll" + name ], doc[ "scroll" + name ],
						elem.body[ "offset" + name ], doc[ "offset" + name ],
						doc[ "client" + name ]
					);
				}

				return value === undefined ?

					// Get width or height on the element, requesting but not forcing parseFloat
					jQuery.css( elem, type, extra ) :

					// Set width or height on the element
					jQuery.style( elem, type, value, extra );
			}, type, chainable ? margin : undefined, chainable );
		};
	} );
} );


jQuery.fn.extend( {

	bind: function( types, data, fn ) {
		return this.on( types, null, data, fn );
	},
	unbind: function( types, fn ) {
		return this.off( types, null, fn );
	},

	delegate: function( selector, types, data, fn ) {
		return this.on( types, selector, data, fn );
	},
	undelegate: function( selector, types, fn ) {

		// ( namespace ) or ( selector, types [, fn] )
		return arguments.length === 1 ?
			this.off( selector, "**" ) :
			this.off( types, selector || "**", fn );
	}
} );

jQuery.parseJSON = JSON.parse;




// Register as a named AMD module, since jQuery can be concatenated with other
// files that may use define, but not via a proper concatenation script that
// understands anonymous AMD modules. A named AMD is safest and most robust
// way to register. Lowercase jquery is used because AMD module names are
// derived from file names, and jQuery is normally delivered in a lowercase
// file name. Do this after creating the global so that if an AMD module wants
// to call noConflict to hide this version of jQuery, it will work.

// Note that for maximum portability, libraries that are not jQuery should
// declare themselves as anonymous modules, and avoid setting a global if an
// AMD loader is present. jQuery is a special case. For more information, see
// https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon

if ( typeof define === "function" && define.amd ) {
	define( "jquery", [], function() {
		return jQuery;
	} );
}





var

	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$;

jQuery.noConflict = function( deep ) {
	if ( window.$ === jQuery ) {
		window.$ = _$;
	}

	if ( deep && window.jQuery === jQuery ) {
		window.jQuery = _jQuery;
	}

	return jQuery;
};

// Expose jQuery and $ identifiers, even in AMD
// (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
// and CommonJS for browser emulators (#13566)
if ( !noGlobal ) {
	window.jQuery = window.$ = jQuery;
}


return jQuery;
} );

},{}],30:[function(require,module,exports){
exports = module.exports = stringify
exports.getSerialize = serializer

function stringify(obj, replacer, spaces, cycleReplacer) {
  return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces)
}

function serializer(replacer, cycleReplacer) {
  var stack = [], keys = []

  if (cycleReplacer == null) cycleReplacer = function(key, value) {
    if (stack[0] === value) return "[Circular ~]"
    return "[Circular ~." + keys.slice(0, stack.indexOf(value)).join(".") + "]"
  }

  return function(key, value) {
    if (stack.length > 0) {
      var thisPos = stack.indexOf(this)
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
      if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value)
    }
    else stack.push(value)

    return replacer == null ? value : replacer.call(this, key, value)
  }
}

},{}],31:[function(require,module,exports){
/** seen.js v0.2.7 | themadcreator.github.io/seen | (c) Bill Dwyer | @license: Apache 2.0 */

(function(){
  var ARRAY_POOL, Ambient, CUBE_COORDINATE_MAP, DEFAULT_FRAME_DELAY, DEFAULT_NORMAL, DiffusePhong, EQUILATERAL_TRIANGLE_ALTITUDE, EYE_NORMAL, F3, Flat, G3, ICOSAHEDRON_COORDINATE_MAP, ICOSAHEDRON_POINTS, ICOS_X, ICOS_Z, IDENTITY, NEXT_UNIQUE_ID, POINT_POOL, PYRAMID_COORDINATE_MAP, Phong, SIMPLEX_PERMUTATIONS_TABLE, TETRAHEDRON_COORDINATE_MAP, TRANSPOSE_INDICES, _svg, grad3, ref, ref1, ref2, requestAnimationFrame, seen,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  slice = [].slice,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

seen = {};

if (typeof window !== "undefined" && window !== null) {
  window.seen = seen;
}

if ((typeof module !== "undefined" && module !== null ? module.exports : void 0) != null) {
  module.exports = seen;
}

NEXT_UNIQUE_ID = 1;

seen.Util = {
  defaults: function(obj, opts, defaults) {
    var prop, results;
    for (prop in opts) {
      if (obj[prop] == null) {
        obj[prop] = opts[prop];
      }
    }
    results = [];
    for (prop in defaults) {
      if (obj[prop] == null) {
        results.push(obj[prop] = defaults[prop]);
      } else {
        results.push(void 0);
      }
    }
    return results;
  },
  arraysEqual: function(a, b) {
    var i, len1, o, val;
    if (!a.length === b.length) {
      return false;
    }
    for (i = o = 0, len1 = a.length; o < len1; i = ++o) {
      val = a[i];
      if (!(val === b[i])) {
        return false;
      }
    }
    return true;
  },
  uniqueId: function(prefix) {
    if (prefix == null) {
      prefix = '';
    }
    return prefix + NEXT_UNIQUE_ID++;
  },
  element: function(elementOrString) {
    if (typeof elementOrString === 'string') {
      return document.getElementById(elementOrString);
    } else {
      return elementOrString;
    }
  }
};

seen.Events = {
  dispatch: function() {
    var arg, dispatch, len1, o;
    dispatch = new seen.Events.Dispatcher();
    for (o = 0, len1 = arguments.length; o < len1; o++) {
      arg = arguments[o];
      dispatch[arg] = seen.Events.Event();
    }
    return dispatch;
  }
};

seen.Events.Dispatcher = (function() {
  function Dispatcher() {
    this.on = bind(this.on, this);
  }

  Dispatcher.prototype.on = function(type, listener) {
    var i, name;
    i = type.indexOf('.');
    name = '';
    if (i > 0) {
      name = type.substring(i + 1);
      type = type.substring(0, i);
    }
    if (this[type] != null) {
      this[type].on(name, listener);
    }
    return this;
  };

  return Dispatcher;

})();

seen.Events.Event = function() {
  var event;
  event = function() {
    var l, name, ref, results;
    ref = event.listenerMap;
    results = [];
    for (name in ref) {
      l = ref[name];
      if (l != null) {
        results.push(l.apply(this, arguments));
      } else {
        results.push(void 0);
      }
    }
    return results;
  };
  event.listenerMap = {};
  event.on = function(name, listener) {
    delete event.listenerMap[name];
    if (listener != null) {
      return event.listenerMap[name] = listener;
    }
  };
  return event;
};

ARRAY_POOL = new Array(16);

IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

TRANSPOSE_INDICES = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];

seen.Matrix = (function() {
  function Matrix(m1) {
    this.m = m1 != null ? m1 : null;
    if (this.m == null) {
      this.m = IDENTITY.slice();
    }
    this.baked = IDENTITY;
  }

  Matrix.prototype.copy = function() {
    return new seen.Matrix(this.m.slice());
  };

  Matrix.prototype.matrix = function(m) {
    var c, i, j, o, u;
    c = ARRAY_POOL;
    for (j = o = 0; o < 4; j = ++o) {
      for (i = u = 0; u < 16; i = u += 4) {
        c[i + j] = m[i] * this.m[j] + m[i + 1] * this.m[4 + j] + m[i + 2] * this.m[8 + j] + m[i + 3] * this.m[12 + j];
      }
    }
    ARRAY_POOL = this.m;
    this.m = c;
    return this;
  };

  Matrix.prototype.reset = function() {
    this.m = this.baked.slice();
    return this;
  };

  Matrix.prototype.bake = function(m) {
    this.baked = (m != null ? m : this.m).slice();
    return this;
  };

  Matrix.prototype.multiply = function(b) {
    return this.matrix(b.m);
  };

  Matrix.prototype.transpose = function() {
    var c, i, len1, o, ti;
    c = ARRAY_POOL;
    for (i = o = 0, len1 = TRANSPOSE_INDICES.length; o < len1; i = ++o) {
      ti = TRANSPOSE_INDICES[i];
      c[i] = this.m[ti];
    }
    ARRAY_POOL = this.m;
    this.m = c;
    return this;
  };

  Matrix.prototype.rotx = function(theta) {
    var ct, rm, st;
    ct = Math.cos(theta);
    st = Math.sin(theta);
    rm = [1, 0, 0, 0, 0, ct, -st, 0, 0, st, ct, 0, 0, 0, 0, 1];
    return this.matrix(rm);
  };

  Matrix.prototype.roty = function(theta) {
    var ct, rm, st;
    ct = Math.cos(theta);
    st = Math.sin(theta);
    rm = [ct, 0, st, 0, 0, 1, 0, 0, -st, 0, ct, 0, 0, 0, 0, 1];
    return this.matrix(rm);
  };

  Matrix.prototype.rotz = function(theta) {
    var ct, rm, st;
    ct = Math.cos(theta);
    st = Math.sin(theta);
    rm = [ct, -st, 0, 0, st, ct, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    return this.matrix(rm);
  };

  Matrix.prototype.translate = function(x, y, z) {
    var rm;
    if (x == null) {
      x = 0;
    }
    if (y == null) {
      y = 0;
    }
    if (z == null) {
      z = 0;
    }
    rm = [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
    return this.matrix(rm);
  };

  Matrix.prototype.scale = function(sx, sy, sz) {
    var rm;
    if (sx == null) {
      sx = 1;
    }
    if (sy == null) {
      sy = sx;
    }
    if (sz == null) {
      sz = sy;
    }
    rm = [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
    return this.matrix(rm);
  };

  return Matrix;

})();

seen.M = function(m) {
  return new seen.Matrix(m);
};

seen.Matrices = {
  identity: function() {
    return seen.M();
  },
  flipX: function() {
    return seen.M().scale(-1, 1, 1);
  },
  flipY: function() {
    return seen.M().scale(1, -1, 1);
  },
  flipZ: function() {
    return seen.M().scale(1, 1, -1);
  }
};

seen.Transformable = (function() {
  function Transformable() {
    var fn, len1, method, o, ref;
    this.m = new seen.Matrix();
    this.baked = IDENTITY;
    ref = ['scale', 'translate', 'rotx', 'roty', 'rotz', 'matrix', 'reset', 'bake'];
    fn = (function(_this) {
      return function(method) {
        return _this[method] = function() {
          var ref1;
          (ref1 = this.m[method]).call.apply(ref1, [this.m].concat(slice.call(arguments)));
          return this;
        };
      };
    })(this);
    for (o = 0, len1 = ref.length; o < len1; o++) {
      method = ref[o];
      fn(method);
    }
  }

  Transformable.prototype.transform = function(m) {
    this.m.multiply(m);
    return this;
  };

  return Transformable;

})();

seen.Point = (function() {
  function Point(x4, y4, z4, w1) {
    this.x = x4 != null ? x4 : 0;
    this.y = y4 != null ? y4 : 0;
    this.z = z4 != null ? z4 : 0;
    this.w = w1 != null ? w1 : 1;
  }

  Point.prototype.copy = function() {
    return new seen.Point(this.x, this.y, this.z, this.w);
  };

  Point.prototype.set = function(p) {
    this.x = p.x;
    this.y = p.y;
    this.z = p.z;
    this.w = p.w;
    return this;
  };

  Point.prototype.add = function(q) {
    this.x += q.x;
    this.y += q.y;
    this.z += q.z;
    return this;
  };

  Point.prototype.subtract = function(q) {
    this.x -= q.x;
    this.y -= q.y;
    this.z -= q.z;
    return this;
  };

  Point.prototype.translate = function(x, y, z) {
    this.x += x;
    this.y += y;
    this.z += z;
    return this;
  };

  Point.prototype.multiply = function(n) {
    this.x *= n;
    this.y *= n;
    this.z *= n;
    return this;
  };

  Point.prototype.divide = function(n) {
    this.x /= n;
    this.y /= n;
    this.z /= n;
    return this;
  };

  Point.prototype.round = function() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    return this;
  };

  Point.prototype.normalize = function() {
    var n;
    n = this.magnitude();
    if (n === 0) {
      this.set(seen.Points.Z());
    } else {
      this.divide(n);
    }
    return this;
  };

  Point.prototype.perpendicular = function() {
    var mag, n;
    n = this.copy().cross(seen.Points.Z());
    mag = n.magnitude();
    if (mag !== 0) {
      return n.divide(mag);
    }
    return this.copy().cross(seen.Points.X()).normalize();
  };

  Point.prototype.transform = function(matrix) {
    var r;
    r = POINT_POOL;
    r.x = this.x * matrix.m[0] + this.y * matrix.m[1] + this.z * matrix.m[2] + this.w * matrix.m[3];
    r.y = this.x * matrix.m[4] + this.y * matrix.m[5] + this.z * matrix.m[6] + this.w * matrix.m[7];
    r.z = this.x * matrix.m[8] + this.y * matrix.m[9] + this.z * matrix.m[10] + this.w * matrix.m[11];
    r.w = this.x * matrix.m[12] + this.y * matrix.m[13] + this.z * matrix.m[14] + this.w * matrix.m[15];
    this.set(r);
    return this;
  };

  Point.prototype.magnitudeSquared = function() {
    return this.dot(this);
  };

  Point.prototype.magnitude = function() {
    return Math.sqrt(this.magnitudeSquared());
  };

  Point.prototype.dot = function(q) {
    return this.x * q.x + this.y * q.y + this.z * q.z;
  };

  Point.prototype.cross = function(q) {
    var r;
    r = POINT_POOL;
    r.x = this.y * q.z - this.z * q.y;
    r.y = this.z * q.x - this.x * q.z;
    r.z = this.x * q.y - this.y * q.x;
    this.set(r);
    return this;
  };

  return Point;

})();

seen.P = function(x, y, z, w) {
  return new seen.Point(x, y, z, w);
};

POINT_POOL = seen.P();

seen.Points = {
  X: function() {
    return seen.P(1, 0, 0);
  },
  Y: function() {
    return seen.P(0, 1, 0);
  },
  Z: function() {
    return seen.P(0, 0, 1);
  },
  ZERO: function() {
    return seen.P(0, 0, 0);
  }
};

seen.Quaternion = (function() {
  Quaternion.pixelsPerRadian = 150;

  Quaternion.xyToTransform = function(x, y) {
    var quatX, quatY;
    quatX = seen.Quaternion.pointAngle(seen.Points.Y(), x / seen.Quaternion.pixelsPerRadian);
    quatY = seen.Quaternion.pointAngle(seen.Points.X(), y / seen.Quaternion.pixelsPerRadian);
    return quatX.multiply(quatY).toMatrix();
  };

  Quaternion.axisAngle = function(x, y, z, angleRads) {
    var scale, w;
    scale = Math.sin(angleRads / 2.0);
    w = Math.cos(angleRads / 2.0);
    return new seen.Quaternion(scale * x, scale * y, scale * z, w);
  };

  Quaternion.pointAngle = function(p, angleRads) {
    var scale, w;
    scale = Math.sin(angleRads / 2.0);
    w = Math.cos(angleRads / 2.0);
    return new seen.Quaternion(scale * p.x, scale * p.y, scale * p.z, w);
  };

  function Quaternion() {
    this.q = seen.P.apply(seen, arguments);
  }

  Quaternion.prototype.multiply = function(q) {
    var r, result;
    r = seen.P();
    r.w = this.q.w * q.q.w - this.q.x * q.q.x - this.q.y * q.q.y - this.q.z * q.q.z;
    r.x = this.q.w * q.q.x + this.q.x * q.q.w + this.q.y * q.q.z - this.q.z * q.q.y;
    r.y = this.q.w * q.q.y + this.q.y * q.q.w + this.q.z * q.q.x - this.q.x * q.q.z;
    r.z = this.q.w * q.q.z + this.q.z * q.q.w + this.q.x * q.q.y - this.q.y * q.q.x;
    result = new seen.Quaternion();
    result.q = r;
    return result;
  };

  Quaternion.prototype.toMatrix = function() {
    var m;
    m = new Array(16);
    m[0] = 1.0 - 2.0 * (this.q.y * this.q.y + this.q.z * this.q.z);
    m[1] = 2.0 * (this.q.x * this.q.y - this.q.w * this.q.z);
    m[2] = 2.0 * (this.q.x * this.q.z + this.q.w * this.q.y);
    m[3] = 0.0;
    m[4] = 2.0 * (this.q.x * this.q.y + this.q.w * this.q.z);
    m[5] = 1.0 - 2.0 * (this.q.x * this.q.x + this.q.z * this.q.z);
    m[6] = 2.0 * (this.q.y * this.q.z - this.q.w * this.q.x);
    m[7] = 0.0;
    m[8] = 2.0 * (this.q.x * this.q.z - this.q.w * this.q.y);
    m[9] = 2.0 * (this.q.y * this.q.z + this.q.w * this.q.x);
    m[10] = 1.0 - 2.0 * (this.q.x * this.q.x + this.q.y * this.q.y);
    m[11] = 0.0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1.0;
    return seen.M(m);
  };

  return Quaternion;

})();

seen.Bounds = (function() {
  Bounds.points = function(points) {
    var box, len1, o, p;
    box = new seen.Bounds();
    for (o = 0, len1 = points.length; o < len1; o++) {
      p = points[o];
      box.add(p);
    }
    return box;
  };

  Bounds.xywh = function(x, y, w, h) {
    return seen.Boundses.xyzwhd(x, y, 0, w, h, 0);
  };

  Bounds.xyzwhd = function(x, y, z, w, h, d) {
    var box;
    box = new seen.Bounds();
    box.add(seen.P(x, y, z));
    box.add(seen.P(x + w, y + h, z + d));
    return box;
  };

  function Bounds() {
    this.maxZ = bind(this.maxZ, this);
    this.maxY = bind(this.maxY, this);
    this.maxX = bind(this.maxX, this);
    this.minZ = bind(this.minZ, this);
    this.minY = bind(this.minY, this);
    this.minX = bind(this.minX, this);
    this.depth = bind(this.depth, this);
    this.height = bind(this.height, this);
    this.width = bind(this.width, this);
    this.min = null;
    this.max = null;
  }

  Bounds.prototype.copy = function() {
    var box, ref, ref1;
    box = new seen.Bounds();
    box.min = (ref = this.min) != null ? ref.copy() : void 0;
    box.max = (ref1 = this.max) != null ? ref1.copy() : void 0;
    return box;
  };

  Bounds.prototype.add = function(p) {
    if (!((this.min != null) && (this.max != null))) {
      this.min = p.copy();
      this.max = p.copy();
    } else {
      this.min.x = Math.min(this.min.x, p.x);
      this.min.y = Math.min(this.min.y, p.y);
      this.min.z = Math.min(this.min.z, p.z);
      this.max.x = Math.max(this.max.x, p.x);
      this.max.y = Math.max(this.max.y, p.y);
      this.max.z = Math.max(this.max.z, p.z);
    }
    return this;
  };

  Bounds.prototype.valid = function() {
    return (this.min != null) && (this.max != null);
  };

  Bounds.prototype.intersect = function(box) {
    if (!this.valid() || !box.valid()) {
      this.min = null;
      this.max = null;
    } else {
      this.min = seen.P(Math.max(this.min.x, box.min.x), Math.max(this.min.y, box.min.y), Math.max(this.min.z, box.min.z));
      this.max = seen.P(Math.min(this.max.x, box.max.x), Math.min(this.max.y, box.max.y), Math.min(this.max.z, box.max.z));
      if (this.min.x > this.max.x || this.min.y > this.max.y || this.min.z > this.max.z) {
        this.min = null;
        this.max = null;
      }
    }
    return this;
  };

  Bounds.prototype.pad = function(x, y, z) {
    var p;
    if (this.valid()) {
      if (y == null) {
        y = x;
      }
      if (z == null) {
        z = y;
      }
      p = seen.P(x, y, z);
      this.min.subtract(p);
      this.max.add(p);
    }
    return this;
  };

  Bounds.prototype.reset = function() {
    this.min = null;
    this.max = null;
    return this;
  };

  Bounds.prototype.contains = function(p) {
    if (!this.valid()) {
      return false;
    } else if (this.min.x > p.x || this.max.x < p.x) {
      return false;
    } else if (this.min.y > p.y || this.max.y < p.y) {
      return false;
    } else if (this.min.z > p.z || this.max.z < p.z) {
      return false;
    } else {
      return true;
    }
  };

  Bounds.prototype.center = function() {
    return seen.P(this.minX() + this.width() / 2, this.minY() + this.height() / 2, this.minZ() + this.depth() / 2);
  };

  Bounds.prototype.width = function() {
    return this.maxX() - this.minX();
  };

  Bounds.prototype.height = function() {
    return this.maxY() - this.minY();
  };

  Bounds.prototype.depth = function() {
    return this.maxZ() - this.minZ();
  };

  Bounds.prototype.minX = function() {
    var ref, ref1;
    return (ref = (ref1 = this.min) != null ? ref1.x : void 0) != null ? ref : 0;
  };

  Bounds.prototype.minY = function() {
    var ref, ref1;
    return (ref = (ref1 = this.min) != null ? ref1.y : void 0) != null ? ref : 0;
  };

  Bounds.prototype.minZ = function() {
    var ref, ref1;
    return (ref = (ref1 = this.min) != null ? ref1.z : void 0) != null ? ref : 0;
  };

  Bounds.prototype.maxX = function() {
    var ref, ref1;
    return (ref = (ref1 = this.max) != null ? ref1.x : void 0) != null ? ref : 0;
  };

  Bounds.prototype.maxY = function() {
    var ref, ref1;
    return (ref = (ref1 = this.max) != null ? ref1.y : void 0) != null ? ref : 0;
  };

  Bounds.prototype.maxZ = function() {
    var ref, ref1;
    return (ref = (ref1 = this.max) != null ? ref1.z : void 0) != null ? ref : 0;
  };

  return Bounds;

})();

seen.Color = (function() {
  function Color(r1, g1, b1, a1) {
    this.r = r1 != null ? r1 : 0;
    this.g = g1 != null ? g1 : 0;
    this.b = b1 != null ? b1 : 0;
    this.a = a1 != null ? a1 : 0xFF;
  }

  Color.prototype.copy = function() {
    return new seen.Color(this.r, this.g, this.b, this.a);
  };

  Color.prototype.scale = function(n) {
    this.r *= n;
    this.g *= n;
    this.b *= n;
    return this;
  };

  Color.prototype.offset = function(n) {
    this.r += n;
    this.g += n;
    this.b += n;
    return this;
  };

  Color.prototype.clamp = function(min, max) {
    if (min == null) {
      min = 0;
    }
    if (max == null) {
      max = 0xFF;
    }
    this.r = Math.min(max, Math.max(min, this.r));
    this.g = Math.min(max, Math.max(min, this.g));
    this.b = Math.min(max, Math.max(min, this.b));
    return this;
  };

  Color.prototype.minChannels = function(c) {
    this.r = Math.min(c.r, this.r);
    this.g = Math.min(c.g, this.g);
    this.b = Math.min(c.b, this.b);
    return this;
  };

  Color.prototype.addChannels = function(c) {
    this.r += c.r;
    this.g += c.g;
    this.b += c.b;
    return this;
  };

  Color.prototype.multiplyChannels = function(c) {
    this.r *= c.r;
    this.g *= c.g;
    this.b *= c.b;
    return this;
  };

  Color.prototype.hex = function() {
    var c;
    c = (this.r << 16 | this.g << 8 | this.b).toString(16);
    while (c.length < 6) {
      c = '0' + c;
    }
    return '#' + c;
  };

  Color.prototype.style = function() {
    return "rgba(" + this.r + "," + this.g + "," + this.b + "," + this.a + ")";
  };

  return Color;

})();

seen.Colors = {
  CSS_RGBA_STRING_REGEX: /rgb(a)?\(([0-9.]+),([0-9.]+),*([0-9.]+)(,([0-9.]+))?\)/,
  parse: function(str) {
    var a, m;
    if (str.charAt(0) === '#' && str.length === 7) {
      return seen.Colors.hex(str);
    } else if (str.indexOf('rgb') === 0) {
      m = seen.Colors.CSS_RGBA_STRING_REGEX.exec(str);
      if (m == null) {
        return seen.Colors.black();
      }
      a = m[6] != null ? Math.round(parseFloat(m[6]) * 0xFF) : void 0;
      return new seen.Color(parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4]), a);
    } else {
      return seen.Colors.black();
    }
  },
  rgb: function(r, g, b, a) {
    if (a == null) {
      a = 255;
    }
    return new seen.Color(r, g, b, a);
  },
  hex: function(hex) {
    if (hex.charAt(0) === '#') {
      hex = hex.substring(1);
    }
    return new seen.Color(parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16));
  },
  hsl: function(h, s, l, a) {
    var b, g, hue2rgb, p, q, r;
    if (a == null) {
      a = 1;
    }
    r = g = b = 0;
    if (s === 0) {
      r = g = b = l;
    } else {
      hue2rgb = function(p, q, t) {
        if (t < 0) {
          t += 1;
        } else if (t > 1) {
          t -= 1;
        }
        if (t < 1 / 6) {
          return p + (q - p) * 6 * t;
        } else if (t < 1 / 2) {
          return q;
        } else if (t < 2 / 3) {
          return p + (q - p) * (2 / 3 - t) * 6;
        } else {
          return p;
        }
      };
      q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return new seen.Color(r * 255, g * 255, b * 255, a * 255);
  },
  randomSurfaces: function(shape, sat, lit) {
    var len1, o, ref, results, surface;
    if (sat == null) {
      sat = 0.5;
    }
    if (lit == null) {
      lit = 0.4;
    }
    ref = shape.surfaces;
    results = [];
    for (o = 0, len1 = ref.length; o < len1; o++) {
      surface = ref[o];
      results.push(surface.fill(seen.Colors.hsl(Math.random(), sat, lit)));
    }
    return results;
  },
  randomSurfaces2: function(shape, drift, sat, lit) {
    var hue, len1, o, ref, results, surface;
    if (drift == null) {
      drift = 0.03;
    }
    if (sat == null) {
      sat = 0.5;
    }
    if (lit == null) {
      lit = 0.4;
    }
    hue = Math.random();
    ref = shape.surfaces;
    results = [];
    for (o = 0, len1 = ref.length; o < len1; o++) {
      surface = ref[o];
      hue += (Math.random() - 0.5) * drift;
      while (hue < 0) {
        hue += 1;
      }
      while (hue > 1) {
        hue -= 1;
      }
      results.push(surface.fill(seen.Colors.hsl(hue, 0.5, 0.4)));
    }
    return results;
  },
  randomShape: function(shape, sat, lit) {
    if (sat == null) {
      sat = 0.5;
    }
    if (lit == null) {
      lit = 0.4;
    }
    return shape.fill(new seen.Material(seen.Colors.hsl(Math.random(), sat, lit)));
  },
  black: function() {
    return this.hex('#000000');
  },
  white: function() {
    return this.hex('#FFFFFF');
  },
  gray: function() {
    return this.hex('#888888');
  }
};

seen.C = function(r, g, b, a) {
  return new seen.Color(r, g, b, a);
};

seen.Material = (function() {
  Material.create = function(value) {
    if (value instanceof seen.Material) {
      return value;
    } else if (value instanceof seen.Color) {
      return new seen.Material(value);
    } else if (typeof value === 'string') {
      return new seen.Material(seen.Colors.parse(value));
    } else {
      return new seen.Material();
    }
  };

  Material.prototype.defaults = {
    color: seen.Colors.gray(),
    metallic: false,
    specularColor: seen.Colors.white(),
    specularExponent: 15,
    shader: null
  };

  function Material(color1, options) {
    this.color = color1;
    if (options == null) {
      options = {};
    }
    seen.Util.defaults(this, options, this.defaults);
  }

  Material.prototype.render = function(lights, shader, renderData) {
    var color, ref, renderShader;
    renderShader = (ref = this.shader) != null ? ref : shader;
    color = renderShader.shade(lights, renderData, this);
    color.a = this.color.a;
    return color;
  };

  return Material;

})();

seen.Light = (function(superClass) {
  extend(Light, superClass);

  Light.prototype.defaults = {
    point: seen.P(),
    color: seen.Colors.white(),
    intensity: 0.01,
    normal: seen.P(1, -1, -1).normalize(),
    enabled: true
  };

  function Light(type1, options) {
    this.type = type1;
    Light.__super__.constructor.apply(this, arguments);
    seen.Util.defaults(this, options, this.defaults);
    this.id = seen.Util.uniqueId('l');
  }

  Light.prototype.render = function() {
    return this.colorIntensity = this.color.copy().scale(this.intensity);
  };

  return Light;

})(seen.Transformable);

seen.Lights = {
  point: function(opts) {
    return new seen.Light('point', opts);
  },
  directional: function(opts) {
    return new seen.Light('directional', opts);
  },
  ambient: function(opts) {
    return new seen.Light('ambient', opts);
  }
};

EYE_NORMAL = seen.Points.Z();

seen.ShaderUtils = {
  applyDiffuse: function(c, light, lightNormal, surfaceNormal, material) {
    var dot;
    dot = lightNormal.dot(surfaceNormal);
    if (dot > 0) {
      return c.addChannels(light.colorIntensity.copy().scale(dot));
    }
  },
  applyDiffuseAndSpecular: function(c, light, lightNormal, surfaceNormal, material) {
    var dot, reflectionNormal, specularColor, specularIntensity;
    dot = lightNormal.dot(surfaceNormal);
    if (dot > 0) {
      c.addChannels(light.colorIntensity.copy().scale(dot));
      reflectionNormal = surfaceNormal.copy().multiply(dot * 2).subtract(lightNormal);
      specularIntensity = Math.pow(0.5 + reflectionNormal.dot(EYE_NORMAL), material.specularExponent);
      specularColor = material.specularColor.copy().scale(specularIntensity * light.intensity / 255.0);
      return c.addChannels(specularColor);
    }
  },
  applyAmbient: function(c, light) {
    return c.addChannels(light.colorIntensity);
  }
};

seen.Shader = (function() {
  function Shader() {}

  Shader.prototype.shade = function(lights, renderModel, material) {};

  return Shader;

})();

Phong = (function(superClass) {
  extend(Phong, superClass);

  function Phong() {
    return Phong.__super__.constructor.apply(this, arguments);
  }

  Phong.prototype.shade = function(lights, renderModel, material) {
    var c, len1, light, lightNormal, o;
    c = new seen.Color();
    for (o = 0, len1 = lights.length; o < len1; o++) {
      light = lights[o];
      switch (light.type) {
        case 'point':
          lightNormal = light.point.copy().subtract(renderModel.barycenter).normalize();
          seen.ShaderUtils.applyDiffuseAndSpecular(c, light, lightNormal, renderModel.normal, material);
          break;
        case 'directional':
          seen.ShaderUtils.applyDiffuseAndSpecular(c, light, light.normal, renderModel.normal, material);
          break;
        case 'ambient':
          seen.ShaderUtils.applyAmbient(c, light);
      }
    }
    c.multiplyChannels(material.color);
    if (material.metallic) {
      c.minChannels(material.specularColor);
    }
    c.clamp(0, 0xFF);
    return c;
  };

  return Phong;

})(seen.Shader);

DiffusePhong = (function(superClass) {
  extend(DiffusePhong, superClass);

  function DiffusePhong() {
    return DiffusePhong.__super__.constructor.apply(this, arguments);
  }

  DiffusePhong.prototype.shade = function(lights, renderModel, material) {
    var c, len1, light, lightNormal, o;
    c = new seen.Color();
    for (o = 0, len1 = lights.length; o < len1; o++) {
      light = lights[o];
      switch (light.type) {
        case 'point':
          lightNormal = light.point.copy().subtract(renderModel.barycenter).normalize();
          seen.ShaderUtils.applyDiffuse(c, light, lightNormal, renderModel.normal, material);
          break;
        case 'directional':
          seen.ShaderUtils.applyDiffuse(c, light, light.normal, renderModel.normal, material);
          break;
        case 'ambient':
          seen.ShaderUtils.applyAmbient(c, light);
      }
    }
    c.multiplyChannels(material.color).clamp(0, 0xFF);
    return c;
  };

  return DiffusePhong;

})(seen.Shader);

Ambient = (function(superClass) {
  extend(Ambient, superClass);

  function Ambient() {
    return Ambient.__super__.constructor.apply(this, arguments);
  }

  Ambient.prototype.shade = function(lights, renderModel, material) {
    var c, len1, light, o;
    c = new seen.Color();
    for (o = 0, len1 = lights.length; o < len1; o++) {
      light = lights[o];
      switch (light.type) {
        case 'ambient':
          seen.ShaderUtils.applyAmbient(c, light);
      }
    }
    c.multiplyChannels(material.color).clamp(0, 0xFF);
    return c;
  };

  return Ambient;

})(seen.Shader);

Flat = (function(superClass) {
  extend(Flat, superClass);

  function Flat() {
    return Flat.__super__.constructor.apply(this, arguments);
  }

  Flat.prototype.shade = function(lights, renderModel, material) {
    return material.color;
  };

  return Flat;

})(seen.Shader);

seen.Shaders = {
  phong: function() {
    return new Phong();
  },
  diffuse: function() {
    return new DiffusePhong();
  },
  ambient: function() {
    return new Ambient();
  },
  flat: function() {
    return new Flat();
  }
};

seen.Affine = {
  ORTHONORMAL_BASIS: function() {
    return [seen.P(0, 0, 0), seen.P(20, 0, 0), seen.P(0, 20, 0)];
  },
  INITIAL_STATE_MATRIX: [[20, 0, 1, 0, 0, 0], [0, 20, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 0, 20, 0, 1], [0, 0, 0, 0, 20, 1], [0, 0, 0, 0, 0, 1]],
  solveForAffineTransform: function(points) {
    var A, b, i, j, n, o, ref, ref1, ref2, u, x;
    A = seen.Affine.INITIAL_STATE_MATRIX;
    b = [points[1].x, points[2].x, points[0].x, points[1].y, points[2].y, points[0].y];
    x = new Array(6);
    n = A.length;
    for (i = o = ref = n - 1; o >= 0; i = o += -1) {
      x[i] = b[i];
      for (j = u = ref1 = i + 1, ref2 = n; ref1 <= ref2 ? u < ref2 : u > ref2; j = ref1 <= ref2 ? ++u : --u) {
        x[i] -= A[i][j] * x[j];
      }
      x[i] /= A[i][i];
    }
    return x;
  }
};

seen.RenderContext = (function() {
  function RenderContext() {
    this.render = bind(this.render, this);
    this.layers = [];
  }

  RenderContext.prototype.render = function() {
    var layer, len1, o, ref;
    this.reset();
    ref = this.layers;
    for (o = 0, len1 = ref.length; o < len1; o++) {
      layer = ref[o];
      layer.context.reset();
      layer.layer.render(layer.context);
      layer.context.cleanup();
    }
    this.cleanup();
    return this;
  };

  RenderContext.prototype.animate = function() {
    return new seen.RenderAnimator(this);
  };

  RenderContext.prototype.layer = function(layer) {
    this.layers.push({
      layer: layer,
      context: this
    });
    return this;
  };

  RenderContext.prototype.sceneLayer = function(scene) {
    this.layer(new seen.SceneLayer(scene));
    return this;
  };

  RenderContext.prototype.reset = function() {};

  RenderContext.prototype.cleanup = function() {};

  return RenderContext;

})();

seen.RenderLayerContext = (function() {
  function RenderLayerContext() {}

  RenderLayerContext.prototype.path = function() {};

  RenderLayerContext.prototype.rect = function() {};

  RenderLayerContext.prototype.circle = function() {};

  RenderLayerContext.prototype.text = function() {};

  RenderLayerContext.prototype.reset = function() {};

  RenderLayerContext.prototype.cleanup = function() {};

  return RenderLayerContext;

})();

seen.Context = function(elementId, scene) {
  var context, ref, tag;
  if (scene == null) {
    scene = null;
  }
  tag = (ref = seen.Util.element(elementId)) != null ? ref.tagName.toUpperCase() : void 0;
  context = (function() {
    switch (tag) {
      case 'SVG':
      case 'G':
        return new seen.SvgRenderContext(elementId);
      case 'CANVAS':
        return new seen.CanvasRenderContext(elementId);
    }
  })();
  if ((context != null) && (scene != null)) {
    context.sceneLayer(scene);
  }
  return context;
};

seen.Painter = (function() {
  function Painter() {}

  Painter.prototype.paint = function(renderModel, context) {};

  return Painter;

})();

seen.PathPainter = (function(superClass) {
  extend(PathPainter, superClass);

  function PathPainter() {
    return PathPainter.__super__.constructor.apply(this, arguments);
  }

  PathPainter.prototype.paint = function(renderModel, context) {
    var painter, ref, ref1;
    painter = context.path().path(renderModel.projected.points);
    if (renderModel.fill != null) {
      painter.fill({
        fill: renderModel.fill == null ? 'none' : renderModel.fill.hex(),
        'fill-opacity': ((ref = renderModel.fill) != null ? ref.a : void 0) == null ? 1.0 : renderModel.fill.a / 255.0
      });
    }
    if (renderModel.stroke != null) {
      return painter.draw({
        fill: 'none',
        stroke: renderModel.stroke == null ? 'none' : renderModel.stroke.hex(),
        'stroke-width': (ref1 = renderModel.surface['stroke-width']) != null ? ref1 : 1
      });
    }
  };

  return PathPainter;

})(seen.Painter);

seen.TextPainter = (function(superClass) {
  extend(TextPainter, superClass);

  function TextPainter() {
    return TextPainter.__super__.constructor.apply(this, arguments);
  }

  TextPainter.prototype.paint = function(renderModel, context) {
    var ref, style, xform;
    style = {
      fill: renderModel.fill == null ? 'none' : renderModel.fill.hex(),
      font: renderModel.surface.font,
      'text-anchor': (ref = renderModel.surface.anchor) != null ? ref : 'middle'
    };
    xform = seen.Affine.solveForAffineTransform(renderModel.projected.points);
    return context.text().fillText(xform, renderModel.surface.text, style);
  };

  return TextPainter;

})(seen.Painter);

seen.Painters = {
  path: new seen.PathPainter(),
  text: new seen.TextPainter()
};

DEFAULT_NORMAL = seen.Points.Z();

seen.RenderModel = (function() {
  function RenderModel(surface1, transform1, projection1, viewport1) {
    this.surface = surface1;
    this.transform = transform1;
    this.projection = projection1;
    this.viewport = viewport1;
    this.points = this.surface.points;
    this.transformed = this._initRenderData();
    this.projected = this._initRenderData();
    this._update();
  }

  RenderModel.prototype.update = function(transform, projection, viewport) {
    if (!this.surface.dirty && seen.Util.arraysEqual(transform.m, this.transform.m) && seen.Util.arraysEqual(projection.m, this.projection.m) && seen.Util.arraysEqual(viewport.m, this.viewport.m)) {

    } else {
      this.transform = transform;
      this.projection = projection;
      this.viewport = viewport;
      return this._update();
    }
  };

  RenderModel.prototype._update = function() {
    var cameraSpace;
    this._math(this.transformed, this.points, this.transform, false);
    cameraSpace = this.transformed.points.map((function(_this) {
      return function(p) {
        return p.copy().transform(_this.projection);
      };
    })(this));
    this.inFrustrum = this._checkFrustrum(cameraSpace);
    this._math(this.projected, cameraSpace, this.viewport, true);
    return this.surface.dirty = false;
  };

  RenderModel.prototype._checkFrustrum = function(points) {
    var len1, o, p;
    for (o = 0, len1 = points.length; o < len1; o++) {
      p = points[o];
      if (p.z <= -2) {
        return false;
      }
    }
    return true;
  };

  RenderModel.prototype._initRenderData = function() {
    var p;
    return {
      points: (function() {
        var len1, o, ref, results;
        ref = this.points;
        results = [];
        for (o = 0, len1 = ref.length; o < len1; o++) {
          p = ref[o];
          results.push(p.copy());
        }
        return results;
      }).call(this),
      bounds: new seen.Bounds(),
      barycenter: seen.P(),
      normal: seen.P(),
      v0: seen.P(),
      v1: seen.P()
    };
  };

  RenderModel.prototype._math = function(set, points, transform, applyClip) {
    var aa, i, len1, len2, len3, o, p, ref, ref1, sp, u;
    if (applyClip == null) {
      applyClip = false;
    }
    for (i = o = 0, len1 = points.length; o < len1; i = ++o) {
      p = points[i];
      sp = set.points[i];
      sp.set(p).transform(transform);
      if (applyClip) {
        sp.divide(sp.w);
      }
    }
    set.barycenter.multiply(0);
    ref = set.points;
    for (u = 0, len2 = ref.length; u < len2; u++) {
      p = ref[u];
      set.barycenter.add(p);
    }
    set.barycenter.divide(set.points.length);
    set.bounds.reset();
    ref1 = set.points;
    for (aa = 0, len3 = ref1.length; aa < len3; aa++) {
      p = ref1[aa];
      set.bounds.add(p);
    }
    if (set.points.length < 2) {
      set.v0.set(DEFAULT_NORMAL);
      set.v1.set(DEFAULT_NORMAL);
      return set.normal.set(DEFAULT_NORMAL);
    } else {
      set.v0.set(set.points[1]).subtract(set.points[0]);
      set.v1.set(set.points[points.length - 1]).subtract(set.points[0]);
      return set.normal.set(set.v0).cross(set.v1).normalize();
    }
  };

  return RenderModel;

})();

seen.LightRenderModel = (function() {
  function LightRenderModel(light1, transform) {
    var origin;
    this.light = light1;
    this.colorIntensity = this.light.color.copy().scale(this.light.intensity);
    this.type = this.light.type;
    this.intensity = this.light.intensity;
    this.point = this.light.point.copy().transform(transform);
    origin = seen.Points.ZERO().transform(transform);
    this.normal = this.light.normal.copy().transform(transform).subtract(origin).normalize();
  }

  return LightRenderModel;

})();

seen.RenderLayer = (function() {
  function RenderLayer() {
    this.render = bind(this.render, this);
  }

  RenderLayer.prototype.render = function(context) {};

  return RenderLayer;

})();

seen.SceneLayer = (function(superClass) {
  extend(SceneLayer, superClass);

  function SceneLayer(scene1) {
    this.scene = scene1;
    this.render = bind(this.render, this);
  }

  SceneLayer.prototype.render = function(context) {
    var len1, o, ref, renderModel, results;
    ref = this.scene.render();
    results = [];
    for (o = 0, len1 = ref.length; o < len1; o++) {
      renderModel = ref[o];
      results.push(renderModel.surface.painter.paint(renderModel, context));
    }
    return results;
  };

  return SceneLayer;

})(seen.RenderLayer);

seen.FillLayer = (function(superClass) {
  extend(FillLayer, superClass);

  function FillLayer(width1, height1, fill1) {
    this.width = width1 != null ? width1 : 500;
    this.height = height1 != null ? height1 : 500;
    this.fill = fill1 != null ? fill1 : '#EEE';
    this.render = bind(this.render, this);
  }

  FillLayer.prototype.render = function(context) {
    return context.rect().rect(this.width, this.height).fill({
      fill: this.fill
    });
  };

  return FillLayer;

})(seen.RenderLayer);

_svg = function(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
};

seen.SvgStyler = (function() {
  SvgStyler.prototype._attributes = {};

  SvgStyler.prototype._svgTag = 'g';

  function SvgStyler(elementFactory) {
    this.elementFactory = elementFactory;
  }

  SvgStyler.prototype.clear = function() {
    this._attributes = {};
    return this;
  };

  SvgStyler.prototype.fill = function(style) {
    if (style == null) {
      style = {};
    }
    this._paint(style);
    return this;
  };

  SvgStyler.prototype.draw = function(style) {
    if (style == null) {
      style = {};
    }
    this._paint(style);
    return this;
  };

  SvgStyler.prototype._paint = function(style) {
    var el, key, ref, str, value;
    el = this.elementFactory(this._svgTag);
    str = '';
    for (key in style) {
      value = style[key];
      str += key + ":" + value + ";";
    }
    el.setAttribute('style', str);
    ref = this._attributes;
    for (key in ref) {
      value = ref[key];
      el.setAttribute(key, value);
    }
    return el;
  };

  return SvgStyler;

})();

seen.SvgPathPainter = (function(superClass) {
  extend(SvgPathPainter, superClass);

  function SvgPathPainter() {
    return SvgPathPainter.__super__.constructor.apply(this, arguments);
  }

  SvgPathPainter.prototype._svgTag = 'path';

  SvgPathPainter.prototype.path = function(points) {
    this._attributes.d = 'M' + points.map(function(p) {
      return p.x + " " + p.y;
    }).join('L');
    return this;
  };

  return SvgPathPainter;

})(seen.SvgStyler);

seen.SvgTextPainter = (function() {
  SvgTextPainter.prototype._svgTag = 'text';

  function SvgTextPainter(elementFactory) {
    this.elementFactory = elementFactory;
  }

  SvgTextPainter.prototype.fillText = function(m, text, style) {
    var el, key, str, value;
    if (style == null) {
      style = {};
    }
    el = this.elementFactory(this._svgTag);
    el.setAttribute('transform', "matrix(" + m[0] + " " + m[3] + " " + (-m[1]) + " " + (-m[4]) + " " + m[2] + " " + m[5] + ")");
    str = '';
    for (key in style) {
      value = style[key];
      if (value != null) {
        str += key + ":" + value + ";";
      }
    }
    el.setAttribute('style', str);
    return el.textContent = text;
  };

  return SvgTextPainter;

})();

seen.SvgRectPainter = (function(superClass) {
  extend(SvgRectPainter, superClass);

  function SvgRectPainter() {
    return SvgRectPainter.__super__.constructor.apply(this, arguments);
  }

  SvgRectPainter.prototype._svgTag = 'rect';

  SvgRectPainter.prototype.rect = function(width, height) {
    this._attributes.width = width;
    this._attributes.height = height;
    return this;
  };

  return SvgRectPainter;

})(seen.SvgStyler);

seen.SvgCirclePainter = (function(superClass) {
  extend(SvgCirclePainter, superClass);

  function SvgCirclePainter() {
    return SvgCirclePainter.__super__.constructor.apply(this, arguments);
  }

  SvgCirclePainter.prototype._svgTag = 'circle';

  SvgCirclePainter.prototype.circle = function(center, radius) {
    this._attributes.cx = center.x;
    this._attributes.cy = center.y;
    this._attributes.r = radius;
    return this;
  };

  return SvgCirclePainter;

})(seen.SvgStyler);

seen.SvgLayerRenderContext = (function(superClass) {
  extend(SvgLayerRenderContext, superClass);

  function SvgLayerRenderContext(group1) {
    this.group = group1;
    this._elementFactory = bind(this._elementFactory, this);
    this.pathPainter = new seen.SvgPathPainter(this._elementFactory);
    this.textPainter = new seen.SvgTextPainter(this._elementFactory);
    this.circlePainter = new seen.SvgCirclePainter(this._elementFactory);
    this.rectPainter = new seen.SvgRectPainter(this._elementFactory);
    this._i = 0;
  }

  SvgLayerRenderContext.prototype.path = function() {
    return this.pathPainter.clear();
  };

  SvgLayerRenderContext.prototype.rect = function() {
    return this.rectPainter.clear();
  };

  SvgLayerRenderContext.prototype.circle = function() {
    return this.circlePainter.clear();
  };

  SvgLayerRenderContext.prototype.text = function() {
    return this.textPainter;
  };

  SvgLayerRenderContext.prototype.reset = function() {
    return this._i = 0;
  };

  SvgLayerRenderContext.prototype.cleanup = function() {
    var children, results;
    children = this.group.childNodes;
    results = [];
    while (this._i < children.length) {
      children[this._i].setAttribute('style', 'display: none;');
      results.push(this._i++);
    }
    return results;
  };

  SvgLayerRenderContext.prototype._elementFactory = function(type) {
    var children, current, path;
    children = this.group.childNodes;
    if (this._i >= children.length) {
      path = _svg(type);
      this.group.appendChild(path);
      this._i++;
      return path;
    }
    current = children[this._i];
    if (current.tagName === type) {
      this._i++;
      return current;
    } else {
      path = _svg(type);
      this.group.replaceChild(path, current);
      this._i++;
      return path;
    }
  };

  return SvgLayerRenderContext;

})(seen.RenderLayerContext);

seen.SvgRenderContext = (function(superClass) {
  extend(SvgRenderContext, superClass);

  function SvgRenderContext(svg) {
    this.svg = svg;
    SvgRenderContext.__super__.constructor.call(this);
    this.svg = seen.Util.element(this.svg);
  }

  SvgRenderContext.prototype.layer = function(layer) {
    var group;
    this.svg.appendChild(group = _svg('g'));
    this.layers.push({
      layer: layer,
      context: new seen.SvgLayerRenderContext(group)
    });
    return this;
  };

  return SvgRenderContext;

})(seen.RenderContext);

seen.SvgContext = function(elementId, scene) {
  var context;
  context = new seen.SvgRenderContext(elementId);
  if (scene != null) {
    context.sceneLayer(scene);
  }
  return context;
};

seen.CanvasStyler = (function() {
  function CanvasStyler(ctx) {
    this.ctx = ctx;
  }

  CanvasStyler.prototype.draw = function(style) {
    if (style == null) {
      style = {};
    }
    if (style.stroke != null) {
      this.ctx.strokeStyle = style.stroke;
    }
    if (style['stroke-width'] != null) {
      this.ctx.lineWidth = style['stroke-width'];
    }
    if (style['text-anchor'] != null) {
      this.ctx.textAlign = style['text-anchor'];
    }
    this.ctx.stroke();
    return this;
  };

  CanvasStyler.prototype.fill = function(style) {
    if (style == null) {
      style = {};
    }
    if (style.fill != null) {
      this.ctx.fillStyle = style.fill;
    }
    if (style['text-anchor'] != null) {
      this.ctx.textAlign = style['text-anchor'];
    }
    if (style['fill-opacity']) {
      this.ctx.globalAlpha = style['fill-opacity'];
    }
    this.ctx.fill();
    return this;
  };

  return CanvasStyler;

})();

seen.CanvasPathPainter = (function(superClass) {
  extend(CanvasPathPainter, superClass);

  function CanvasPathPainter() {
    return CanvasPathPainter.__super__.constructor.apply(this, arguments);
  }

  CanvasPathPainter.prototype.path = function(points) {
    var i, len1, o, p;
    this.ctx.beginPath();
    for (i = o = 0, len1 = points.length; o < len1; i = ++o) {
      p = points[i];
      if (i === 0) {
        this.ctx.moveTo(p.x, p.y);
      } else {
        this.ctx.lineTo(p.x, p.y);
      }
    }
    this.ctx.closePath();
    return this;
  };

  return CanvasPathPainter;

})(seen.CanvasStyler);

seen.CanvasRectPainter = (function(superClass) {
  extend(CanvasRectPainter, superClass);

  function CanvasRectPainter() {
    return CanvasRectPainter.__super__.constructor.apply(this, arguments);
  }

  CanvasRectPainter.prototype.rect = function(width, height) {
    this.ctx.rect(0, 0, width, height);
    return this;
  };

  return CanvasRectPainter;

})(seen.CanvasStyler);

seen.CanvasCirclePainter = (function(superClass) {
  extend(CanvasCirclePainter, superClass);

  function CanvasCirclePainter() {
    return CanvasCirclePainter.__super__.constructor.apply(this, arguments);
  }

  CanvasCirclePainter.prototype.circle = function(center, radius) {
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI, true);
    return this;
  };

  return CanvasCirclePainter;

})(seen.CanvasStyler);

seen.CanvasTextPainter = (function() {
  function CanvasTextPainter(ctx) {
    this.ctx = ctx;
  }

  CanvasTextPainter.prototype.fillText = function(m, text, style) {
    if (style == null) {
      style = {};
    }
    this.ctx.save();
    this.ctx.setTransform(m[0], m[3], -m[1], -m[4], m[2], m[5]);
    if (style.font != null) {
      this.ctx.font = style.font;
    }
    if (style.fill != null) {
      this.ctx.fillStyle = style.fill;
    }
    if (style['text-anchor'] != null) {
      this.ctx.textAlign = this._cssToCanvasAnchor(style['text-anchor']);
    }
    this.ctx.fillText(text, 0, 0);
    this.ctx.restore();
    return this;
  };

  CanvasTextPainter.prototype._cssToCanvasAnchor = function(anchor) {
    if (anchor === 'middle') {
      return 'center';
    }
    return anchor;
  };

  return CanvasTextPainter;

})();

seen.CanvasLayerRenderContext = (function(superClass) {
  extend(CanvasLayerRenderContext, superClass);

  function CanvasLayerRenderContext(ctx) {
    this.ctx = ctx;
    this.pathPainter = new seen.CanvasPathPainter(this.ctx);
    this.ciclePainter = new seen.CanvasCirclePainter(this.ctx);
    this.textPainter = new seen.CanvasTextPainter(this.ctx);
    this.rectPainter = new seen.CanvasRectPainter(this.ctx);
  }

  CanvasLayerRenderContext.prototype.path = function() {
    return this.pathPainter;
  };

  CanvasLayerRenderContext.prototype.rect = function() {
    return this.rectPainter;
  };

  CanvasLayerRenderContext.prototype.circle = function() {
    return this.ciclePainter;
  };

  CanvasLayerRenderContext.prototype.text = function() {
    return this.textPainter;
  };

  return CanvasLayerRenderContext;

})(seen.RenderLayerContext);

seen.CanvasRenderContext = (function(superClass) {
  extend(CanvasRenderContext, superClass);

  function CanvasRenderContext(el1) {
    this.el = el1;
    CanvasRenderContext.__super__.constructor.call(this);
    this.el = seen.Util.element(this.el);
    this.ctx = this.el.getContext('2d');
  }

  CanvasRenderContext.prototype.layer = function(layer) {
    this.layers.push({
      layer: layer,
      context: new seen.CanvasLayerRenderContext(this.ctx)
    });
    return this;
  };

  CanvasRenderContext.prototype.reset = function() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    return this.ctx.clearRect(0, 0, this.el.width, this.el.height);
  };

  return CanvasRenderContext;

})(seen.RenderContext);

seen.CanvasContext = function(elementId, scene) {
  var context;
  context = new seen.CanvasRenderContext(elementId);
  if (scene != null) {
    context.sceneLayer(scene);
  }
  return context;
};

seen.WindowEvents = (function() {
  var dispatch;
  dispatch = seen.Events.dispatch('mouseMove', 'mouseDown', 'mouseUp', 'touchStart', 'touchMove', 'touchEnd', 'touchCancel');
  if (typeof window !== "undefined" && window !== null) {
    window.addEventListener('mouseup', dispatch.mouseUp, true);
    window.addEventListener('mousedown', dispatch.mouseDown, true);
    window.addEventListener('mousemove', dispatch.mouseMove, true);
    window.addEventListener('touchstart', dispatch.touchStart, true);
    window.addEventListener('touchmove', dispatch.touchMove, true);
    window.addEventListener('touchend', dispatch.touchEnd, true);
    window.addEventListener('touchcancel', dispatch.touchCancel, true);
  }
  return {
    on: dispatch.on
  };
})();

seen.MouseEvents = (function() {
  function MouseEvents(el1, options) {
    this.el = el1;
    this._onMouseWheel = bind(this._onMouseWheel, this);
    this._onMouseUp = bind(this._onMouseUp, this);
    this._onMouseDown = bind(this._onMouseDown, this);
    this._onMouseMove = bind(this._onMouseMove, this);
    seen.Util.defaults(this, options, this.defaults);
    this.el = seen.Util.element(this.el);
    this._uid = seen.Util.uniqueId('mouser-');
    this.dispatch = seen.Events.dispatch('dragStart', 'drag', 'dragEnd', 'mouseMove', 'mouseDown', 'mouseUp', 'mouseWheel');
    this.on = this.dispatch.on;
    this._mouseDown = false;
    this.attach();
  }

  MouseEvents.prototype.attach = function() {
    this.el.addEventListener('touchstart', this._onMouseDown);
    this.el.addEventListener('mousedown', this._onMouseDown);
    return this.el.addEventListener('mousewheel', this._onMouseWheel);
  };

  MouseEvents.prototype.detach = function() {
    this.el.removeEventListener('touchstart', this._onMouseDown);
    this.el.removeEventListener('mousedown', this._onMouseDown);
    return this.el.removeEventListener('mousewheel', this._onMouseWheel);
  };

  MouseEvents.prototype._onMouseMove = function(e) {
    this.dispatch.mouseMove(e);
    e.preventDefault();
    e.stopPropagation();
    if (this._mouseDown) {
      return this.dispatch.drag(e);
    }
  };

  MouseEvents.prototype._onMouseDown = function(e) {
    this._mouseDown = true;
    seen.WindowEvents.on("mouseUp." + this._uid, this._onMouseUp);
    seen.WindowEvents.on("mouseMove." + this._uid, this._onMouseMove);
    seen.WindowEvents.on("touchEnd." + this._uid, this._onMouseUp);
    seen.WindowEvents.on("touchCancel." + this._uid, this._onMouseUp);
    seen.WindowEvents.on("touchMove." + this._uid, this._onMouseMove);
    this.dispatch.mouseDown(e);
    return this.dispatch.dragStart(e);
  };

  MouseEvents.prototype._onMouseUp = function(e) {
    this._mouseDown = false;
    seen.WindowEvents.on("mouseUp." + this._uid, null);
    seen.WindowEvents.on("mouseMove." + this._uid, null);
    seen.WindowEvents.on("touchEnd." + this._uid, null);
    seen.WindowEvents.on("touchCancel." + this._uid, null);
    seen.WindowEvents.on("touchMove." + this._uid, null);
    this.dispatch.mouseUp(e);
    return this.dispatch.dragEnd(e);
  };

  MouseEvents.prototype._onMouseWheel = function(e) {
    return this.dispatch.mouseWheel(e);
  };

  return MouseEvents;

})();

seen.InertialMouse = (function() {
  InertialMouse.inertiaExtinction = 0.1;

  InertialMouse.smoothingTimeout = 300;

  InertialMouse.inertiaMsecDelay = 30;

  function InertialMouse() {
    this.reset();
  }

  InertialMouse.prototype.get = function() {
    var scale;
    scale = 1000 / seen.InertialMouse.inertiaMsecDelay;
    return [this.x * scale, this.y * scale];
  };

  InertialMouse.prototype.reset = function() {
    this.xy = [0, 0];
    return this;
  };

  InertialMouse.prototype.update = function(xy) {
    var msec, t;
    if (this.lastUpdate != null) {
      msec = new Date().getTime() - this.lastUpdate.getTime();
      xy = xy.map(function(x) {
        return x / Math.max(msec, 1);
      });
      t = Math.min(1, msec / seen.InertialMouse.smoothingTimeout);
      this.x = t * xy[0] + (1.0 - t) * this.x;
      this.y = t * xy[1] + (1.0 - t) * this.y;
    } else {
      this.x = xy[0], this.y = xy[1];
    }
    this.lastUpdate = new Date();
    return this;
  };

  InertialMouse.prototype.damp = function() {
    this.x *= 1.0 - seen.InertialMouse.inertiaExtinction;
    this.y *= 1.0 - seen.InertialMouse.inertiaExtinction;
    return this;
  };

  return InertialMouse;

})();

seen.Drag = (function() {
  Drag.prototype.defaults = {
    inertia: false
  };

  function Drag(el1, options) {
    var mouser;
    this.el = el1;
    this._stopInertia = bind(this._stopInertia, this);
    this._startInertia = bind(this._startInertia, this);
    this._onInertia = bind(this._onInertia, this);
    this._onDrag = bind(this._onDrag, this);
    this._onDragEnd = bind(this._onDragEnd, this);
    this._onDragStart = bind(this._onDragStart, this);
    this._getPageCoords = bind(this._getPageCoords, this);
    seen.Util.defaults(this, options, this.defaults);
    this.el = seen.Util.element(this.el);
    this._uid = seen.Util.uniqueId('dragger-');
    this._inertiaRunning = false;
    this._dragState = {
      dragging: false,
      origin: null,
      last: null,
      inertia: new seen.InertialMouse()
    };
    this.dispatch = seen.Events.dispatch('drag', 'dragStart', 'dragEnd', 'dragEndInertia');
    this.on = this.dispatch.on;
    mouser = new seen.MouseEvents(this.el);
    mouser.on("dragStart." + this._uid, this._onDragStart);
    mouser.on("dragEnd." + this._uid, this._onDragEnd);
    mouser.on("drag." + this._uid, this._onDrag);
  }

  Drag.prototype._getPageCoords = function(e) {
    var ref, ref1;
    if (((ref = e.touches) != null ? ref.length : void 0) > 0) {
      return [e.touches[0].pageX, e.touches[0].pageY];
    } else if (((ref1 = e.changedTouches) != null ? ref1.length : void 0) > 0) {
      return [e.changedTouches[0].pageX, e.changedTouches[0].pageY];
    } else {
      return [e.pageX, e.pageY];
    }
  };

  Drag.prototype._onDragStart = function(e) {
    this._stopInertia();
    this._dragState.dragging = true;
    this._dragState.origin = this._getPageCoords(e);
    this._dragState.last = this._getPageCoords(e);
    return this.dispatch.dragStart(e);
  };

  Drag.prototype._onDragEnd = function(e) {
    var dragEvent, page;
    this._dragState.dragging = false;
    if (this.inertia) {
      page = this._getPageCoords(e);
      dragEvent = {
        offset: [page[0] - this._dragState.origin[0], page[1] - this._dragState.origin[1]],
        offsetRelative: [page[0] - this._dragState.last[0], page[1] - this._dragState.last[1]]
      };
      this._dragState.inertia.update(dragEvent.offsetRelative);
      this._startInertia();
    }
    return this.dispatch.dragEnd(e);
  };

  Drag.prototype._onDrag = function(e) {
    var dragEvent, page;
    page = this._getPageCoords(e);
    dragEvent = {
      offset: [page[0] - this._dragState.origin[0], page[1] - this._dragState.origin[1]],
      offsetRelative: [page[0] - this._dragState.last[0], page[1] - this._dragState.last[1]]
    };
    this.dispatch.drag(dragEvent);
    if (this.inertia) {
      this._dragState.inertia.update(dragEvent.offsetRelative);
    }
    return this._dragState.last = page;
  };

  Drag.prototype._onInertia = function() {
    var intertia;
    if (!this._inertiaRunning) {
      return;
    }
    intertia = this._dragState.inertia.damp().get();
    if (Math.abs(intertia[0]) < 1 && Math.abs(intertia[1]) < 1) {
      this._stopInertia();
      this.dispatch.dragEndInertia();
      return;
    }
    this.dispatch.drag({
      offset: [this._dragState.last[0] - this._dragState.origin[0], this._dragState.last[0] - this._dragState.origin[1]],
      offsetRelative: intertia
    });
    this._dragState.last = [this._dragState.last[0] + intertia[0], this._dragState.last[1] + intertia[1]];
    return this._startInertia();
  };

  Drag.prototype._startInertia = function() {
    this._inertiaRunning = true;
    return setTimeout(this._onInertia, seen.InertialMouse.inertiaMsecDelay);
  };

  Drag.prototype._stopInertia = function() {
    this._dragState.inertia.reset();
    return this._inertiaRunning = false;
  };

  return Drag;

})();

seen.Zoom = (function() {
  Zoom.prototype.defaults = {
    speed: 0.25
  };

  function Zoom(el1, options) {
    var mouser;
    this.el = el1;
    this._onMouseWheel = bind(this._onMouseWheel, this);
    seen.Util.defaults(this, options, this.defaults);
    this.el = seen.Util.element(this.el);
    this._uid = seen.Util.uniqueId('zoomer-');
    this.dispatch = seen.Events.dispatch('zoom');
    this.on = this.dispatch.on;
    mouser = new seen.MouseEvents(this.el);
    mouser.on("mouseWheel." + this._uid, this._onMouseWheel);
  }

  Zoom.prototype._onMouseWheel = function(e) {
    var sign, zoom, zoomFactor;
    e.preventDefault();
    sign = e.wheelDelta / Math.abs(e.wheelDelta);
    zoomFactor = Math.abs(e.wheelDelta) / 120 * this.speed;
    zoom = Math.pow(2, sign * zoomFactor);
    return this.dispatch.zoom({
      zoom: zoom
    });
  };

  return Zoom;

})();

seen.Surface = (function() {
  Surface.prototype.cullBackfaces = true;

  Surface.prototype.fillMaterial = new seen.Material(seen.C.gray);

  Surface.prototype.strokeMaterial = null;

  function Surface(points1, painter1) {
    this.points = points1;
    this.painter = painter1 != null ? painter1 : seen.Painters.path;
    this.id = 's' + seen.Util.uniqueId();
  }

  Surface.prototype.fill = function(fill) {
    this.fillMaterial = seen.Material.create(fill);
    return this;
  };

  Surface.prototype.stroke = function(stroke) {
    this.strokeMaterial = seen.Material.create(stroke);
    return this;
  };

  return Surface;

})();

seen.Shape = (function(superClass) {
  extend(Shape, superClass);

  function Shape(type1, surfaces1) {
    this.type = type1;
    this.surfaces = surfaces1;
    Shape.__super__.constructor.call(this);
  }

  Shape.prototype.eachSurface = function(f) {
    this.surfaces.forEach(f);
    return this;
  };

  Shape.prototype.fill = function(fill) {
    this.eachSurface(function(s) {
      return s.fill(fill);
    });
    return this;
  };

  Shape.prototype.stroke = function(stroke) {
    this.eachSurface(function(s) {
      return s.stroke(stroke);
    });
    return this;
  };

  return Shape;

})(seen.Transformable);

seen.Model = (function(superClass) {
  extend(Model, superClass);

  function Model() {
    Model.__super__.constructor.call(this);
    this.children = [];
    this.lights = [];
  }

  Model.prototype.add = function() {
    var child, childs, len1, o;
    childs = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    for (o = 0, len1 = childs.length; o < len1; o++) {
      child = childs[o];
      if (child instanceof seen.Shape || child instanceof seen.Model) {
        this.children.push(child);
      } else if (child instanceof seen.Light) {
        this.lights.push(child);
      }
    }
    return this;
  };

  Model.prototype.remove = function() {
    var child, childs, i, len1, o, results;
    childs = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    results = [];
    for (o = 0, len1 = childs.length; o < len1; o++) {
      child = childs[o];
      while ((i = this.children.indexOf(child)) >= 0) {
        this.children.splice(i, 1);
      }
      results.push((function() {
        var results1;
        results1 = [];
        while ((i = this.lights.indexOf(child)) >= 0) {
          results1.push(this.lights.splice(i, 1));
        }
        return results1;
      }).call(this));
    }
    return results;
  };

  Model.prototype.append = function() {
    var model;
    model = new seen.Model;
    this.add(model);
    return model;
  };

  Model.prototype.eachShape = function(f) {
    var child, len1, o, ref, results;
    ref = this.children;
    results = [];
    for (o = 0, len1 = ref.length; o < len1; o++) {
      child = ref[o];
      if (child instanceof seen.Shape) {
        f.call(this, child);
      }
      if (child instanceof seen.Model) {
        results.push(child.eachShape(f));
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  Model.prototype.eachRenderable = function(lightFn, shapeFn) {
    return this._eachRenderable(lightFn, shapeFn, [], this.m);
  };

  Model.prototype._eachRenderable = function(lightFn, shapeFn, lightModels, transform) {
    var child, len1, len2, light, o, ref, ref1, results, u;
    if (this.lights.length > 0) {
      lightModels = lightModels.slice();
    }
    ref = this.lights;
    for (o = 0, len1 = ref.length; o < len1; o++) {
      light = ref[o];
      if (!light.enabled) {
        continue;
      }
      lightModels.push(lightFn.call(this, light, light.m.copy().multiply(transform)));
    }
    ref1 = this.children;
    results = [];
    for (u = 0, len2 = ref1.length; u < len2; u++) {
      child = ref1[u];
      if (child instanceof seen.Shape) {
        shapeFn.call(this, child, lightModels, child.m.copy().multiply(transform));
      }
      if (child instanceof seen.Model) {
        results.push(child._eachRenderable(lightFn, shapeFn, lightModels, child.m.copy().multiply(transform)));
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  return Model;

})(seen.Transformable);

seen.Models = {
  "default": function() {
    var model;
    model = new seen.Model();
    model.add(seen.Lights.directional({
      normal: seen.P(-1, 1, 1).normalize(),
      color: seen.Colors.hsl(0.1, 0.3, 0.7),
      intensity: 0.004
    }));
    model.add(seen.Lights.directional({
      normal: seen.P(1, 1, -1).normalize(),
      intensity: 0.003
    }));
    model.add(seen.Lights.ambient({
      intensity: 0.0015
    }));
    return model;
  }
};

if (typeof window !== "undefined" && window !== null) {
  requestAnimationFrame = (ref = (ref1 = (ref2 = window.requestAnimationFrame) != null ? ref2 : window.mozRequestAnimationFrame) != null ? ref1 : window.webkitRequestAnimationFrame) != null ? ref : window.msRequestAnimationFrame;
}

DEFAULT_FRAME_DELAY = 30;

seen.Animator = (function() {
  function Animator() {
    this.frame = bind(this.frame, this);
    this.dispatch = seen.Events.dispatch('beforeFrame', 'afterFrame', 'frame');
    this.on = this.dispatch.on;
    this.timestamp = 0;
    this._running = false;
    this.frameDelay = null;
  }

  Animator.prototype.start = function() {
    this._running = true;
    if (this.frameDelay != null) {
      this._lastTime = new Date().valueOf();
      this._delayCompensation = 0;
    }
    this.animateFrame();
    return this;
  };

  Animator.prototype.stop = function() {
    this._running = false;
    return this;
  };

  Animator.prototype.animateFrame = function() {
    var delta, frameDelay, ref3;
    if ((requestAnimationFrame != null) && (this.frameDelay == null)) {
      requestAnimationFrame(this.frame);
    } else {
      delta = new Date().valueOf() - this._lastTime;
      this._lastTime += delta;
      this._delayCompensation += delta;
      frameDelay = (ref3 = this.frameDelay) != null ? ref3 : DEFAULT_FRAME_DELAY;
      setTimeout(this.frame, frameDelay - this._delayCompensation);
    }
    return this;
  };

  Animator.prototype.frame = function(t) {
    var deltaTimestamp, ref3;
    if (!this._running) {
      return;
    }
    this._timestamp = t != null ? t : this._timestamp + ((ref3 = this._msecDelay) != null ? ref3 : DEFAULT_FRAME_DELAY);
    deltaTimestamp = this._lastTimestamp != null ? this._timestamp - this._lastTimestamp : this._timestamp;
    this.dispatch.beforeFrame(this._timestamp, deltaTimestamp);
    this.dispatch.frame(this._timestamp, deltaTimestamp);
    this.dispatch.afterFrame(this._timestamp, deltaTimestamp);
    this._lastTimestamp = this._timestamp;
    this.animateFrame();
    return this;
  };

  Animator.prototype.onBefore = function(handler) {
    this.on("beforeFrame." + (seen.Util.uniqueId('animator-')), handler);
    return this;
  };

  Animator.prototype.onAfter = function(handler) {
    this.on("afterFrame." + (seen.Util.uniqueId('animator-')), handler);
    return this;
  };

  Animator.prototype.onFrame = function(handler) {
    this.on("frame." + (seen.Util.uniqueId('animator-')), handler);
    return this;
  };

  return Animator;

})();

seen.RenderAnimator = (function(superClass) {
  extend(RenderAnimator, superClass);

  function RenderAnimator(context) {
    RenderAnimator.__super__.constructor.apply(this, arguments);
    this.onFrame(context.render);
  }

  return RenderAnimator;

})(seen.Animator);

seen.Transition = (function() {
  Transition.prototype.defaults = {
    duration: 100
  };

  function Transition(options) {
    if (options == null) {
      options = {};
    }
    seen.Util.defaults(this, options, this.defaults);
  }

  Transition.prototype.update = function(t) {
    if (this.t == null) {
      this.firstFrame();
      this.startT = t;
    }
    this.t = t;
    this.tFrac = (this.t - this.startT) / this.duration;
    this.frame();
    if (this.tFrac >= 1.0) {
      this.lastFrame();
      return false;
    }
    return true;
  };

  Transition.prototype.firstFrame = function() {};

  Transition.prototype.frame = function() {};

  Transition.prototype.lastFrame = function() {};

  return Transition;

})();

seen.TransitionAnimator = (function(superClass) {
  extend(TransitionAnimator, superClass);

  function TransitionAnimator() {
    this.update = bind(this.update, this);
    TransitionAnimator.__super__.constructor.apply(this, arguments);
    this.queue = [];
    this.transitions = [];
    this.onFrame(this.update);
  }

  TransitionAnimator.prototype.add = function(txn) {
    return this.transitions.push(txn);
  };

  TransitionAnimator.prototype.keyframe = function() {
    this.queue.push(this.transitions);
    return this.transitions = [];
  };

  TransitionAnimator.prototype.update = function(t) {
    var transitions;
    if (!this.queue.length) {
      return;
    }
    transitions = this.queue.shift();
    transitions = transitions.filter(function(transition) {
      return transition.update(t);
    });
    if (transitions.length) {
      return this.queue.unshift(transitions);
    }
  };

  return TransitionAnimator;

})(seen.Animator);

TETRAHEDRON_COORDINATE_MAP = [[0, 2, 1], [0, 1, 3], [3, 2, 0], [1, 2, 3]];

CUBE_COORDINATE_MAP = [[0, 1, 3, 2], [5, 4, 6, 7], [1, 0, 4, 5], [2, 3, 7, 6], [3, 1, 5, 7], [0, 2, 6, 4]];

PYRAMID_COORDINATE_MAP = [[1, 0, 2, 3], [0, 1, 4], [2, 0, 4], [3, 2, 4], [1, 3, 4]];

EQUILATERAL_TRIANGLE_ALTITUDE = Math.sqrt(3.0) / 2.0;

ICOS_X = 0.525731112119133606;

ICOS_Z = 0.850650808352039932;

ICOSAHEDRON_POINTS = [seen.P(-ICOS_X, 0.0, -ICOS_Z), seen.P(ICOS_X, 0.0, -ICOS_Z), seen.P(-ICOS_X, 0.0, ICOS_Z), seen.P(ICOS_X, 0.0, ICOS_Z), seen.P(0.0, ICOS_Z, -ICOS_X), seen.P(0.0, ICOS_Z, ICOS_X), seen.P(0.0, -ICOS_Z, -ICOS_X), seen.P(0.0, -ICOS_Z, ICOS_X), seen.P(ICOS_Z, ICOS_X, 0.0), seen.P(-ICOS_Z, ICOS_X, 0.0), seen.P(ICOS_Z, -ICOS_X, 0.0), seen.P(-ICOS_Z, -ICOS_X, 0.0)];

ICOSAHEDRON_COORDINATE_MAP = [[0, 4, 1], [0, 9, 4], [9, 5, 4], [4, 5, 8], [4, 8, 1], [8, 10, 1], [8, 3, 10], [5, 3, 8], [5, 2, 3], [2, 7, 3], [7, 10, 3], [7, 6, 10], [7, 11, 6], [11, 0, 6], [0, 1, 6], [6, 1, 10], [9, 0, 11], [9, 11, 2], [9, 2, 5], [7, 2, 11]];

seen.Shapes = {
  cube: (function(_this) {
    return function() {
      var points;
      points = [seen.P(-1, -1, -1), seen.P(-1, -1, 1), seen.P(-1, 1, -1), seen.P(-1, 1, 1), seen.P(1, -1, -1), seen.P(1, -1, 1), seen.P(1, 1, -1), seen.P(1, 1, 1)];
      return new seen.Shape('cube', seen.Shapes.mapPointsToSurfaces(points, CUBE_COORDINATE_MAP));
    };
  })(this),
  unitcube: (function(_this) {
    return function() {
      var points;
      points = [seen.P(0, 0, 0), seen.P(0, 0, 1), seen.P(0, 1, 0), seen.P(0, 1, 1), seen.P(1, 0, 0), seen.P(1, 0, 1), seen.P(1, 1, 0), seen.P(1, 1, 1)];
      return new seen.Shape('unitcube', seen.Shapes.mapPointsToSurfaces(points, CUBE_COORDINATE_MAP));
    };
  })(this),
  rectangle: (function(_this) {
    return function(point1, point2) {
      var compose, points;
      compose = function(x, y, z) {
        return seen.P(x(point1.x, point2.x), y(point1.y, point2.y), z(point1.z, point2.z));
      };
      points = [compose(Math.min, Math.min, Math.min), compose(Math.min, Math.min, Math.max), compose(Math.min, Math.max, Math.min), compose(Math.min, Math.max, Math.max), compose(Math.max, Math.min, Math.min), compose(Math.max, Math.min, Math.max), compose(Math.max, Math.max, Math.min), compose(Math.max, Math.max, Math.max)];
      return new seen.Shape('rect', seen.Shapes.mapPointsToSurfaces(points, CUBE_COORDINATE_MAP));
    };
  })(this),
  pyramid: (function(_this) {
    return function() {
      var points;
      points = [seen.P(0, 0, 0), seen.P(0, 0, 1), seen.P(1, 0, 0), seen.P(1, 0, 1), seen.P(0.5, 1, 0.5)];
      return new seen.Shape('pyramid', seen.Shapes.mapPointsToSurfaces(points, PYRAMID_COORDINATE_MAP));
    };
  })(this),
  tetrahedron: (function(_this) {
    return function() {
      var points;
      points = [seen.P(1, 1, 1), seen.P(-1, -1, 1), seen.P(-1, 1, -1), seen.P(1, -1, -1)];
      return new seen.Shape('tetrahedron', seen.Shapes.mapPointsToSurfaces(points, TETRAHEDRON_COORDINATE_MAP));
    };
  })(this),
  icosahedron: function() {
    return new seen.Shape('icosahedron', seen.Shapes.mapPointsToSurfaces(ICOSAHEDRON_POINTS, ICOSAHEDRON_COORDINATE_MAP));
  },
  sphere: function(subdivisions) {
    var i, o, ref3, triangles;
    if (subdivisions == null) {
      subdivisions = 2;
    }
    triangles = ICOSAHEDRON_COORDINATE_MAP.map(function(coords) {
      return coords.map(function(c) {
        return ICOSAHEDRON_POINTS[c];
      });
    });
    for (i = o = 0, ref3 = subdivisions; 0 <= ref3 ? o < ref3 : o > ref3; i = 0 <= ref3 ? ++o : --o) {
      triangles = seen.Shapes._subdivideTriangles(triangles);
    }
    return new seen.Shape('sphere', triangles.map(function(triangle) {
      return new seen.Surface(triangle.map(function(v) {
        return v.copy();
      }));
    }));
  },
  pipe: function(point1, point2, radius, segments) {
    var axis, o, perp, points, quat, results, theta;
    if (radius == null) {
      radius = 1;
    }
    if (segments == null) {
      segments = 8;
    }
    axis = point2.copy().subtract(point1);
    perp = axis.perpendicular().multiply(radius);
    theta = -Math.PI * 2.0 / segments;
    quat = seen.Quaternion.pointAngle(axis.copy().normalize(), theta).toMatrix();
    points = (function() {
      results = [];
      for (var o = 0; 0 <= segments ? o < segments : o > segments; 0 <= segments ? o++ : o--){ results.push(o); }
      return results;
    }).apply(this).map(function(i) {
      var p;
      p = point1.copy().add(perp);
      perp.transform(quat);
      return p;
    });
    return seen.Shapes.extrude(points, axis);
  },
  patch: function(nx, ny) {
    var aa, ab, ac, column, len1, len2, len3, o, p, pts, pts0, pts1, ref3, ref4, ref5, ref6, surfaces, u, x, y;
    if (nx == null) {
      nx = 20;
    }
    if (ny == null) {
      ny = 20;
    }
    nx = Math.round(nx);
    ny = Math.round(ny);
    surfaces = [];
    for (x = o = 0, ref3 = nx; 0 <= ref3 ? o < ref3 : o > ref3; x = 0 <= ref3 ? ++o : --o) {
      column = [];
      for (y = u = 0, ref4 = ny; 0 <= ref4 ? u < ref4 : u > ref4; y = 0 <= ref4 ? ++u : --u) {
        pts0 = [seen.P(x, y), seen.P(x + 1, y - 0.5), seen.P(x + 1, y + 0.5)];
        pts1 = [seen.P(x, y), seen.P(x + 1, y + 0.5), seen.P(x, y + 1)];
        ref5 = [pts0, pts1];
        for (aa = 0, len1 = ref5.length; aa < len1; aa++) {
          pts = ref5[aa];
          for (ab = 0, len2 = pts.length; ab < len2; ab++) {
            p = pts[ab];
            p.x *= EQUILATERAL_TRIANGLE_ALTITUDE;
            p.y += x % 2 === 0 ? 0.5 : 0;
          }
          column.push(pts);
        }
      }
      if (x % 2 !== 0) {
        ref6 = column[0];
        for (ac = 0, len3 = ref6.length; ac < len3; ac++) {
          p = ref6[ac];
          p.y += ny;
        }
        column.push(column.shift());
      }
      surfaces = surfaces.concat(column);
    }
    return new seen.Shape('patch', surfaces.map(function(s) {
      return new seen.Surface(s);
    }));
  },
  text: function(text, surfaceOptions) {
    var key, surface, val;
    if (surfaceOptions == null) {
      surfaceOptions = {};
    }
    surface = new seen.Surface(seen.Affine.ORTHONORMAL_BASIS(), seen.Painters.text);
    surface.text = text;
    for (key in surfaceOptions) {
      val = surfaceOptions[key];
      surface[key] = val;
    }
    return new seen.Shape('text', [surface]);
  },
  extrude: function(points, offset) {
    var back, front, i, len, o, p, ref3, surfaces;
    surfaces = [];
    front = new seen.Surface((function() {
      var len1, o, results;
      results = [];
      for (o = 0, len1 = points.length; o < len1; o++) {
        p = points[o];
        results.push(p.copy());
      }
      return results;
    })());
    back = new seen.Surface((function() {
      var len1, o, results;
      results = [];
      for (o = 0, len1 = points.length; o < len1; o++) {
        p = points[o];
        results.push(p.add(offset));
      }
      return results;
    })());
    for (i = o = 1, ref3 = points.length; 1 <= ref3 ? o < ref3 : o > ref3; i = 1 <= ref3 ? ++o : --o) {
      surfaces.push(new seen.Surface([front.points[i - 1].copy(), back.points[i - 1].copy(), back.points[i].copy(), front.points[i].copy()]));
    }
    len = points.length;
    surfaces.push(new seen.Surface([front.points[len - 1].copy(), back.points[len - 1].copy(), back.points[0].copy(), front.points[0].copy()]));
    back.points.reverse();
    surfaces.push(front);
    surfaces.push(back);
    return new seen.Shape('extrusion', surfaces);
  },
  arrow: function(thickness, tailLength, tailWidth, headLength, headPointiness) {
    var htw, points;
    if (thickness == null) {
      thickness = 1;
    }
    if (tailLength == null) {
      tailLength = 1;
    }
    if (tailWidth == null) {
      tailWidth = 1;
    }
    if (headLength == null) {
      headLength = 1;
    }
    if (headPointiness == null) {
      headPointiness = 0;
    }
    htw = tailWidth / 2;
    points = [seen.P(0, 0, 0), seen.P(headLength + headPointiness, 1, 0), seen.P(headLength, htw, 0), seen.P(headLength + tailLength, htw, 0), seen.P(headLength + tailLength, -htw, 0), seen.P(headLength, -htw, 0), seen.P(headLength + headPointiness, -1, 0)];
    return seen.Shapes.extrude(points, seen.P(0, 0, thickness));
  },
  path: function(points) {
    return new seen.Shape('path', [new seen.Surface(points)]);
  },
  custom: function(s) {
    var f, len1, o, p, ref3, surfaces;
    surfaces = [];
    ref3 = s.surfaces;
    for (o = 0, len1 = ref3.length; o < len1; o++) {
      f = ref3[o];
      surfaces.push(new seen.Surface((function() {
        var len2, results, u;
        results = [];
        for (u = 0, len2 = f.length; u < len2; u++) {
          p = f[u];
          results.push(seen.P.apply(seen, p));
        }
        return results;
      })()));
    }
    return new seen.Shape('custom', surfaces);
  },
  mapPointsToSurfaces: function(points, coordinateMap) {
    var c, coords, len1, o, spts, surfaces;
    surfaces = [];
    for (o = 0, len1 = coordinateMap.length; o < len1; o++) {
      coords = coordinateMap[o];
      spts = (function() {
        var len2, results, u;
        results = [];
        for (u = 0, len2 = coords.length; u < len2; u++) {
          c = coords[u];
          results.push(points[c].copy());
        }
        return results;
      })();
      surfaces.push(new seen.Surface(spts));
    }
    return surfaces;
  },
  _subdivideTriangles: function(triangles) {
    var len1, newTriangles, o, tri, v01, v12, v20;
    newTriangles = [];
    for (o = 0, len1 = triangles.length; o < len1; o++) {
      tri = triangles[o];
      v01 = tri[0].copy().add(tri[1]).normalize();
      v12 = tri[1].copy().add(tri[2]).normalize();
      v20 = tri[2].copy().add(tri[0]).normalize();
      newTriangles.push([tri[0], v01, v20]);
      newTriangles.push([tri[1], v12, v01]);
      newTriangles.push([tri[2], v20, v12]);
      newTriangles.push([v01, v12, v20]);
    }
    return newTriangles;
  }
};

seen.MocapModel = (function() {
  function MocapModel(model1, frames1, frameDelay1) {
    this.model = model1;
    this.frames = frames1;
    this.frameDelay = frameDelay1;
  }

  MocapModel.prototype.applyFrameTransforms = function(frameIndex) {
    var frame, len1, o, transform;
    frame = this.frames[frameIndex];
    for (o = 0, len1 = frame.length; o < len1; o++) {
      transform = frame[o];
      transform.shape.reset().transform(transform.transform);
    }
    return (frameIndex + 1) % this.frames.length;
  };

  return MocapModel;

})();

seen.MocapAnimator = (function(superClass) {
  extend(MocapAnimator, superClass);

  function MocapAnimator(mocap) {
    this.mocap = mocap;
    this.renderFrame = bind(this.renderFrame, this);
    MocapAnimator.__super__.constructor.apply(this, arguments);
    this.frameIndex = 0;
    this.frameDelay = this.mocap.frameDelay;
    this.onFrame(this.renderFrame);
  }

  MocapAnimator.prototype.renderFrame = function() {
    return this.frameIndex = this.mocap.applyFrameTransforms(this.frameIndex);
  };

  return MocapAnimator;

})(seen.Animator);

seen.Mocap = (function() {
  Mocap.DEFAULT_SHAPE_FACTORY = function(joint, endpoint) {
    return seen.Shapes.pipe(seen.P(), endpoint);
  };

  Mocap.parse = function(source) {
    return new seen.Mocap(seen.BvhParser.parse(source));
  };

  function Mocap(bvh) {
    this.bvh = bvh;
  }

  Mocap.prototype.createMocapModel = function(shapeFactory) {
    var frames, joints, model;
    if (shapeFactory == null) {
      shapeFactory = seen.Mocap.DEFAULT_SHAPE_FACTORY;
    }
    model = new seen.Model();
    joints = [];
    this._attachJoint(model, this.bvh.root, joints, shapeFactory);
    frames = this.bvh.motion.frames.map((function(_this) {
      return function(frame) {
        return _this._generateFrameTransforms(frame, joints);
      };
    })(this));
    return new seen.MocapModel(model, frames, this.bvh.motion.frameTime * 1000);
  };

  Mocap.prototype._generateFrameTransforms = function(frame, joints) {
    var fi, transforms;
    fi = 0;
    transforms = joints.map((function(_this) {
      return function(joint) {
        var ai, m;
        m = seen.M();
        ai = joint.channels.length;
        while (ai > 0) {
          ai -= 1;
          _this._applyChannelTransform(joint.channels[ai], m, frame[fi + ai]);
        }
        fi += joint.channels.length;
        m.multiply(joint.offset);
        return {
          shape: joint.shape,
          transform: m
        };
      };
    })(this));
    return transforms;
  };

  Mocap.prototype._applyChannelTransform = function(channel, m, v) {
    switch (channel) {
      case 'Xposition':
        m.translate(v, 0, 0);
        break;
      case 'Yposition':
        m.translate(0, v, 0);
        break;
      case 'Zposition':
        m.translate(0, 0, v);
        break;
      case 'Xrotation':
        m.rotx(v * Math.PI / 180.0);
        break;
      case 'Yrotation':
        m.roty(v * Math.PI / 180.0);
        break;
      case 'Zrotation':
        m.rotz(v * Math.PI / 180.0);
    }
    return m;
  };

  Mocap.prototype._attachJoint = function(model, joint, joints, shapeFactory) {
    var child, childShapes, len1, o, offset, p, ref3, ref4, ref5, ref6, ref7, ref8, ref9;
    offset = seen.M().translate((ref3 = joint.offset) != null ? ref3.x : void 0, (ref4 = joint.offset) != null ? ref4.y : void 0, (ref5 = joint.offset) != null ? ref5.z : void 0);
    model.transform(offset);
    if (joint.channels != null) {
      joints.push({
        shape: model,
        offset: offset,
        channels: joint.channels
      });
    }
    if (joint.joints != null) {
      childShapes = model.append();
      ref6 = joint.joints;
      for (o = 0, len1 = ref6.length; o < len1; o++) {
        child = ref6[o];
        p = seen.P((ref7 = child.offset) != null ? ref7.x : void 0, (ref8 = child.offset) != null ? ref8.y : void 0, (ref9 = child.offset) != null ? ref9.z : void 0);
        childShapes.add(shapeFactory(joint, p));
        if (child.type === 'JOINT') {
          this._attachJoint(childShapes.append(), child, joints, shapeFactory);
        }
      }
    }
  };

  return Mocap;

})();

seen.ObjParser = (function() {
  function ObjParser() {
    this.vertices = [];
    this.faces = [];
    this.commands = {
      v: (function(_this) {
        return function(data) {
          return _this.vertices.push(data.map(function(d) {
            return parseFloat(d);
          }));
        };
      })(this),
      f: (function(_this) {
        return function(data) {
          return _this.faces.push(data.map(function(d) {
            return parseInt(d);
          }));
        };
      })(this)
    };
  }

  ObjParser.prototype.parse = function(contents) {
    var command, data, len1, line, o, ref3, results;
    ref3 = contents.split(/[\r\n]+/);
    results = [];
    for (o = 0, len1 = ref3.length; o < len1; o++) {
      line = ref3[o];
      data = line.trim().split(/[ ]+/);
      if (data.length < 2) {
        continue;
      }
      command = data.slice(0, 1)[0];
      data = data.slice(1);
      if (command.charAt(0) === '#') {
        continue;
      }
      if (this.commands[command] == null) {
        console.log("OBJ Parser: Skipping unknown command '" + command + "'");
        continue;
      }
      results.push(this.commands[command](data));
    }
    return results;
  };

  ObjParser.prototype.mapFacePoints = function(faceMap) {
    return this.faces.map((function(_this) {
      return function(face) {
        var points;
        points = face.map(function(v) {
          return seen.P.apply(seen, _this.vertices[v - 1]);
        });
        return faceMap.call(_this, points);
      };
    })(this));
  };

  return ObjParser;

})();

seen.Shapes.obj = function(objContents, cullBackfaces) {
  var parser;
  if (cullBackfaces == null) {
    cullBackfaces = true;
  }
  parser = new seen.ObjParser();
  parser.parse(objContents);
  return new seen.Shape('obj', parser.mapFacePoints(function(points) {
    var surface;
    surface = new seen.Surface(points);
    surface.cullBackfaces = cullBackfaces;
    return surface;
  }));
};

seen.Projections = {
  perspectiveFov: function(fovyInDegrees, front) {
    var tan;
    if (fovyInDegrees == null) {
      fovyInDegrees = 50;
    }
    if (front == null) {
      front = 1;
    }
    tan = front * Math.tan(fovyInDegrees * Math.PI / 360.0);
    return seen.Projections.perspective(-tan, tan, -tan, tan, front, 2 * front);
  },
  perspective: function(left, right, bottom, top, near, far) {
    var dx, dy, dz, m, near2;
    if (left == null) {
      left = -1;
    }
    if (right == null) {
      right = 1;
    }
    if (bottom == null) {
      bottom = -1;
    }
    if (top == null) {
      top = 1;
    }
    if (near == null) {
      near = 1;
    }
    if (far == null) {
      far = 100;
    }
    near2 = 2 * near;
    dx = right - left;
    dy = top - bottom;
    dz = far - near;
    m = new Array(16);
    m[0] = near2 / dx;
    m[1] = 0.0;
    m[2] = (right + left) / dx;
    m[3] = 0.0;
    m[4] = 0.0;
    m[5] = near2 / dy;
    m[6] = (top + bottom) / dy;
    m[7] = 0.0;
    m[8] = 0.0;
    m[9] = 0.0;
    m[10] = -(far + near) / dz;
    m[11] = -(far * near2) / dz;
    m[12] = 0.0;
    m[13] = 0.0;
    m[14] = -1.0;
    m[15] = 0.0;
    return seen.M(m);
  },
  ortho: function(left, right, bottom, top, near, far) {
    var dx, dy, dz, m, near2;
    if (left == null) {
      left = -1;
    }
    if (right == null) {
      right = 1;
    }
    if (bottom == null) {
      bottom = -1;
    }
    if (top == null) {
      top = 1;
    }
    if (near == null) {
      near = 1;
    }
    if (far == null) {
      far = 100;
    }
    near2 = 2 * near;
    dx = right - left;
    dy = top - bottom;
    dz = far - near;
    m = new Array(16);
    m[0] = 2 / dx;
    m[1] = 0.0;
    m[2] = 0.0;
    m[3] = (right + left) / dx;
    m[4] = 0.0;
    m[5] = 2 / dy;
    m[6] = 0.0;
    m[7] = -(top + bottom) / dy;
    m[8] = 0.0;
    m[9] = 0.0;
    m[10] = -2 / dz;
    m[11] = -(far + near) / dz;
    m[12] = 0.0;
    m[13] = 0.0;
    m[14] = 0.0;
    m[15] = 1.0;
    return seen.M(m);
  }
};

seen.Viewports = {
  center: function(width, height, x, y) {
    var postscale, prescale;
    if (width == null) {
      width = 500;
    }
    if (height == null) {
      height = 500;
    }
    if (x == null) {
      x = 0;
    }
    if (y == null) {
      y = 0;
    }
    prescale = seen.M().translate(-x, -y, -height).scale(1 / width, 1 / height, 1 / height);
    postscale = seen.M().scale(width, -height, height).translate(x + width / 2, y + height / 2, height);
    return {
      prescale: prescale,
      postscale: postscale
    };
  },
  origin: function(width, height, x, y) {
    var postscale, prescale;
    if (width == null) {
      width = 500;
    }
    if (height == null) {
      height = 500;
    }
    if (x == null) {
      x = 0;
    }
    if (y == null) {
      y = 0;
    }
    prescale = seen.M().translate(-x, -y, -1).scale(1 / width, 1 / height, 1 / height);
    postscale = seen.M().scale(width, -height, height).translate(x, y);
    return {
      prescale: prescale,
      postscale: postscale
    };
  }
};

seen.Camera = (function(superClass) {
  extend(Camera, superClass);

  Camera.prototype.defaults = {
    projection: seen.Projections.perspective()
  };

  function Camera(options) {
    seen.Util.defaults(this, options, this.defaults);
    Camera.__super__.constructor.apply(this, arguments);
  }

  return Camera;

})(seen.Transformable);

seen.Scene = (function() {
  Scene.prototype.defaults = function() {
    return {
      model: new seen.Model(),
      camera: new seen.Camera(),
      viewport: seen.Viewports.origin(1, 1),
      shader: seen.Shaders.phong(),
      cullBackfaces: true,
      fractionalPoints: false,
      cache: true
    };
  };

  function Scene(options) {
    this.flushCache = bind(this.flushCache, this);
    this.render = bind(this.render, this);
    seen.Util.defaults(this, options, this.defaults());
    this._renderModelCache = {};
  }

  Scene.prototype.render = function() {
    var projection, renderModels, viewport;
    projection = this.camera.m.copy().multiply(this.viewport.prescale).multiply(this.camera.projection);
    viewport = this.viewport.postscale;
    renderModels = [];
    this.model.eachRenderable(function(light, transform) {
      return new seen.LightRenderModel(light, transform);
    }, (function(_this) {
      return function(shape, lights, transform) {
        var len1, len2, o, p, ref3, ref4, ref5, ref6, renderModel, results, surface, u;
        ref3 = shape.surfaces;
        results = [];
        for (o = 0, len1 = ref3.length; o < len1; o++) {
          surface = ref3[o];
          renderModel = _this._renderSurface(surface, transform, projection, viewport);
          if ((!_this.cullBackfaces || !surface.cullBackfaces || renderModel.projected.normal.z < 0) && renderModel.inFrustrum) {
            renderModel.fill = (ref4 = surface.fillMaterial) != null ? ref4.render(lights, _this.shader, renderModel.transformed) : void 0;
            renderModel.stroke = (ref5 = surface.strokeMaterial) != null ? ref5.render(lights, _this.shader, renderModel.transformed) : void 0;
            if (_this.fractionalPoints !== true) {
              ref6 = renderModel.projected.points;
              for (u = 0, len2 = ref6.length; u < len2; u++) {
                p = ref6[u];
                p.round();
              }
            }
            results.push(renderModels.push(renderModel));
          } else {
            results.push(void 0);
          }
        }
        return results;
      };
    })(this));
    renderModels.sort(function(a, b) {
      return b.projected.barycenter.z - a.projected.barycenter.z;
    });
    return renderModels;
  };

  Scene.prototype._renderSurface = function(surface, transform, projection, viewport) {
    var renderModel;
    if (!this.cache) {
      return new seen.RenderModel(surface, transform, projection, viewport);
    }
    renderModel = this._renderModelCache[surface.id];
    if (renderModel == null) {
      renderModel = this._renderModelCache[surface.id] = new seen.RenderModel(surface, transform, projection, viewport);
    } else {
      renderModel.update(transform, projection, viewport);
    }
    return renderModel;
  };

  Scene.prototype.flushCache = function() {
    return this._renderModelCache = {};
  };

  return Scene;

})();

seen.Grad = (function() {
  function Grad(x4, y4, z4) {
    this.x = x4;
    this.y = y4;
    this.z = z4;
  }

  Grad.prototype.dot = function(x, y, z) {
    return this.x * x + this.y * y + this.z * z;
  };

  return Grad;

})();

grad3 = [new seen.Grad(1, 1, 0), new seen.Grad(-1, 1, 0), new seen.Grad(1, -1, 0), new seen.Grad(-1, -1, 0), new seen.Grad(1, 0, 1), new seen.Grad(-1, 0, 1), new seen.Grad(1, 0, -1), new seen.Grad(-1, 0, -1), new seen.Grad(0, 1, 1), new seen.Grad(0, -1, 1), new seen.Grad(0, 1, -1), new seen.Grad(0, -1, -1)];

SIMPLEX_PERMUTATIONS_TABLE = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];

F3 = 1 / 3;

G3 = 1 / 6;

seen.Simplex3D = (function() {
  function Simplex3D(seed) {
    if (seed == null) {
      seed = 0;
    }
    this.perm = new Array(512);
    this.gradP = new Array(512);
    this.seed(seed);
  }

  Simplex3D.prototype.seed = function(seed) {
    var i, o, results, v;
    if (seed > 0 && seed < 1) {
      seed *= 65536;
    }
    seed = Math.floor(seed);
    if (seed < 256) {
      seed |= seed << 8;
    }
    results = [];
    for (i = o = 0; o < 256; i = ++o) {
      v = 0;
      if (i & 1) {
        v = SIMPLEX_PERMUTATIONS_TABLE[i] ^ (seed & 255);
      } else {
        v = SIMPLEX_PERMUTATIONS_TABLE[i] ^ ((seed >> 8) & 255);
      }
      this.perm[i] = this.perm[i + 256] = v;
      results.push(this.gradP[i] = this.gradP[i + 256] = grad3[v % 12]);
    }
    return results;
  };

  Simplex3D.prototype.noise = function(x, y, z) {
    var gi0, gi1, gi2, gi3, i, i1, i2, j, j1, j2, k, k1, k2, n0, n1, n2, n3, s, t, t0, t1, t2, t3, x0, x1, x2, x3, y0, y1, y2, y3, z0, z1, z2, z3;
    s = (x + y + z) * F3;
    i = Math.floor(x + s);
    j = Math.floor(y + s);
    k = Math.floor(z + s);
    t = (i + j + k) * G3;
    x0 = x - i + t;
    y0 = y - j + t;
    z0 = z - k + t;
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1;
        j1 = 0;
        k1 = 0;
        i2 = 1;
        j2 = 1;
        k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1;
        j1 = 0;
        k1 = 0;
        i2 = 1;
        j2 = 0;
        k2 = 1;
      } else {
        i1 = 0;
        j1 = 0;
        k1 = 1;
        i2 = 1;
        j2 = 0;
        k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0;
        j1 = 0;
        k1 = 1;
        i2 = 0;
        j2 = 1;
        k2 = 1;
      } else if (x0 < z0) {
        i1 = 0;
        j1 = 1;
        k1 = 0;
        i2 = 0;
        j2 = 1;
        k2 = 1;
      } else {
        i1 = 0;
        j1 = 1;
        k1 = 0;
        i2 = 1;
        j2 = 1;
        k2 = 0;
      }
    }
    x1 = x0 - i1 + G3;
    y1 = y0 - j1 + G3;
    z1 = z0 - k1 + G3;
    x2 = x0 - i2 + 2 * G3;
    y2 = y0 - j2 + 2 * G3;
    z2 = z0 - k2 + 2 * G3;
    x3 = x0 - 1 + 3 * G3;
    y3 = y0 - 1 + 3 * G3;
    z3 = z0 - 1 + 3 * G3;
    i &= 0xFF;
    j &= 0xFF;
    k &= 0xFF;
    gi0 = this.gradP[i + this.perm[j + this.perm[k]]];
    gi1 = this.gradP[i + i1 + this.perm[j + j1 + this.perm[k + k1]]];
    gi2 = this.gradP[i + i2 + this.perm[j + j2 + this.perm[k + k2]]];
    gi3 = this.gradP[i + 1 + this.perm[j + 1 + this.perm[k + 1]]];
    t0 = 0.5 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot(x0, y0, z0);
    }
    t1 = 0.5 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot(x1, y1, z1);
    }
    t2 = 0.5 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot(x2, y2, z2);
    }
    t3 = 0.5 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) {
      n3 = 0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * gi3.dot(x3, y3, z3);
    }
    return 32 * (n0 + n1 + n2 + n3);
  };

  return Simplex3D;

})();

  seen.BvhParser = (function() {
  "use strict";

  

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function peg$SyntaxError(message, expected, found, location) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.location = location;
    this.name     = "SyntaxError";

    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, peg$SyntaxError);
    }
  }

  peg$subclass(peg$SyntaxError, Error);

  function peg$parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},
        parser  = this,

        peg$FAILED = {},

        peg$startRuleFunctions = { program: peg$parseprogram },
        peg$startRuleFunction  = peg$parseprogram,

        peg$c0 = "hierarchy",
        peg$c1 = { type: "literal", value: "HIERARCHY", description: "\"HIERARCHY\"" },
        peg$c2 = function(root, motion) { return {root:root, motion:motion} },
        peg$c3 = "root",
        peg$c4 = { type: "literal", value: "ROOT", description: "\"ROOT\"" },
        peg$c5 = "{",
        peg$c6 = { type: "literal", value: "{", description: "\"{\"" },
        peg$c7 = "}",
        peg$c8 = { type: "literal", value: "}", description: "\"}\"" },
        peg$c9 = function(id, offset, channels, joints) { return {id:id, offset:offset, channels:channels, joints:joints}},
        peg$c10 = "joint",
        peg$c11 = { type: "literal", value: "JOINT", description: "\"JOINT\"" },
        peg$c12 = function(id, offset, channels, joints) { return {type:'JOINT', id:id, offset:offset, channels:channels, joints:joints} },
        peg$c13 = "end site",
        peg$c14 = { type: "literal", value: "END SITE", description: "\"END SITE\"" },
        peg$c15 = function(offset) { return {type:'END SITE', offset:offset}},
        peg$c16 = "offset",
        peg$c17 = { type: "literal", value: "OFFSET", description: "\"OFFSET\"" },
        peg$c18 = function(x, y, z) { return {x:x, y:y, z:z} },
        peg$c19 = "channels",
        peg$c20 = { type: "literal", value: "CHANNELS", description: "\"CHANNELS\"" },
        peg$c21 = /^[0-9]/,
        peg$c22 = { type: "class", value: "[0-9]", description: "[0-9]" },
        peg$c23 = function(count, channels) { return channels },
        peg$c24 = "xposition",
        peg$c25 = { type: "literal", value: "Xposition", description: "\"Xposition\"" },
        peg$c26 = "yposition",
        peg$c27 = { type: "literal", value: "Yposition", description: "\"Yposition\"" },
        peg$c28 = "zposition",
        peg$c29 = { type: "literal", value: "Zposition", description: "\"Zposition\"" },
        peg$c30 = "xrotation",
        peg$c31 = { type: "literal", value: "Xrotation", description: "\"Xrotation\"" },
        peg$c32 = "yrotation",
        peg$c33 = { type: "literal", value: "Yrotation", description: "\"Yrotation\"" },
        peg$c34 = "zrotation",
        peg$c35 = { type: "literal", value: "Zrotation", description: "\"Zrotation\"" },
        peg$c36 = function(channel_type) { return channel_type },
        peg$c37 = "motion",
        peg$c38 = { type: "literal", value: "MOTION", description: "\"MOTION\"" },
        peg$c39 = "frames:",
        peg$c40 = { type: "literal", value: "Frames:", description: "\"Frames:\"" },
        peg$c41 = "frame time:",
        peg$c42 = { type: "literal", value: "Frame Time:", description: "\"Frame Time:\"" },
        peg$c43 = function(frameCount, frameTime, frames) { return {frameCount:frameCount, frameTime:frameTime, frames:frames} },
        peg$c44 = /^[\n\r]/,
        peg$c45 = { type: "class", value: "[\\n\\r]", description: "[\\n\\r]" },
        peg$c46 = function(frameValues) { return frameValues },
        peg$c47 = /^[ ]/,
        peg$c48 = { type: "class", value: "[ ]", description: "[ ]" },
        peg$c49 = function(value) { return value },
        peg$c50 = /^[a-zA-Z0-9\-_]/,
        peg$c51 = { type: "class", value: "[a-zA-Z0-9-_]", description: "[a-zA-Z0-9-_]" },
        peg$c52 = /^[\-0-9.e]/,
        peg$c53 = { type: "class", value: "[-0-9.e]", description: "[-0-9.e]" },
        peg$c54 = function(value) { return parseFloat(value.join('')) },
        peg$c55 = /^[\-0-9e]/,
        peg$c56 = { type: "class", value: "[-0-9e]", description: "[-0-9e]" },
        peg$c57 = function(value) { return parseInt(value.join('')) },
        peg$c58 = /^[ \t\n\r]/,
        peg$c59 = { type: "class", value: "[ \\t\\n\\r]", description: "[ \\t\\n\\r]" },
        peg$c60 = function() { return undefined },

        peg$currPos          = 0,
        peg$savedPos         = 0,
        peg$posDetailsCache  = [{ line: 1, column: 1, seenCR: false }],
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }

    function text() {
      return input.substring(peg$savedPos, peg$currPos);
    }

    function location() {
      return peg$computeLocation(peg$savedPos, peg$currPos);
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        input.substring(peg$savedPos, peg$currPos),
        peg$computeLocation(peg$savedPos, peg$currPos)
      );
    }

    function error(message) {
      throw peg$buildException(
        message,
        null,
        input.substring(peg$savedPos, peg$currPos),
        peg$computeLocation(peg$savedPos, peg$currPos)
      );
    }

    function peg$computePosDetails(pos) {
      var details = peg$posDetailsCache[pos],
          p, ch;

      if (details) {
        return details;
      } else {
        p = pos - 1;
        while (!peg$posDetailsCache[p]) {
          p--;
        }

        details = peg$posDetailsCache[p];
        details = {
          line:   details.line,
          column: details.column,
          seenCR: details.seenCR
        };

        while (p < pos) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }

          p++;
        }

        peg$posDetailsCache[pos] = details;
        return details;
      }
    }

    function peg$computeLocation(startPos, endPos) {
      var startPosDetails = peg$computePosDetails(startPos),
          endPosDetails   = peg$computePosDetails(endPos);

      return {
        start: {
          offset: startPos,
          line:   startPosDetails.line,
          column: startPosDetails.column
        },
        end: {
          offset: endPos,
          line:   endPosDetails.line,
          column: endPosDetails.column
        }
      };
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, found, location) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0100-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1000-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new peg$SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        location
      );
    }

    function peg$parseprogram() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 9).toLowerCase() === peg$c0) {
        s1 = input.substr(peg$currPos, 9);
        peg$currPos += 9;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c1); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseroot();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parsemotion();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c2(s3, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      return s0;
    }

    function peg$parseroot() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c3) {
        s1 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c4); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseid();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 123) {
                s5 = peg$c5;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c6); }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseoffset();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parse_();
                    if (s8 !== peg$FAILED) {
                      s9 = peg$parsechannels();
                      if (s9 !== peg$FAILED) {
                        s10 = peg$parse_();
                        if (s10 !== peg$FAILED) {
                          s11 = [];
                          s12 = peg$parsejoint();
                          while (s12 !== peg$FAILED) {
                            s11.push(s12);
                            s12 = peg$parsejoint();
                          }
                          if (s11 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 125) {
                              s12 = peg$c7;
                              peg$currPos++;
                            } else {
                              s12 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$c8); }
                            }
                            if (s12 !== peg$FAILED) {
                              peg$savedPos = s0;
                              s1 = peg$c9(s3, s7, s9, s11);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      return s0;
    }

    function peg$parsejoint() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c10) {
        s1 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c11); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseid();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 123) {
                s5 = peg$c5;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c6); }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseoffset();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parse_();
                    if (s8 !== peg$FAILED) {
                      s9 = peg$parsechannels();
                      if (s9 !== peg$FAILED) {
                        s10 = peg$parse_();
                        if (s10 !== peg$FAILED) {
                          s11 = [];
                          s12 = peg$parsejoint();
                          while (s12 !== peg$FAILED) {
                            s11.push(s12);
                            s12 = peg$parsejoint();
                          }
                          if (s11 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 125) {
                              s12 = peg$c7;
                              peg$currPos++;
                            } else {
                              s12 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$c8); }
                            }
                            if (s12 !== peg$FAILED) {
                              s13 = peg$parse_();
                              if (s13 !== peg$FAILED) {
                                peg$savedPos = s0;
                                s1 = peg$c12(s3, s7, s9, s11);
                                s0 = s1;
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 8).toLowerCase() === peg$c13) {
          s1 = input.substr(peg$currPos, 8);
          peg$currPos += 8;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c14); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse_();
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 123) {
              s3 = peg$c5;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c6); }
            }
            if (s3 !== peg$FAILED) {
              s4 = peg$parse_();
              if (s4 !== peg$FAILED) {
                s5 = peg$parseoffset();
                if (s5 !== peg$FAILED) {
                  s6 = peg$parse_();
                  if (s6 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 125) {
                      s7 = peg$c7;
                      peg$currPos++;
                    } else {
                      s7 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c8); }
                    }
                    if (s7 !== peg$FAILED) {
                      s8 = peg$parse_();
                      if (s8 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$c15(s5);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }

      return s0;
    }

    function peg$parseoffset() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6).toLowerCase() === peg$c16) {
        s1 = input.substr(peg$currPos, 6);
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c17); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsefloat();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parsefloat();
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parsefloat();
                  if (s7 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c18(s3, s5, s7);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      return s0;
    }

    function peg$parsechannels() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 8).toLowerCase() === peg$c19) {
        s1 = input.substr(peg$currPos, 8);
        peg$currPos += 8;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c20); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (peg$c21.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c22); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = [];
              s6 = peg$parsechannel_type();
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                s6 = peg$parsechannel_type();
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c23(s3, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      return s0;
    }

    function peg$parsechannel_type() {
      var s0, s1, s2;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 9).toLowerCase() === peg$c24) {
        s1 = input.substr(peg$currPos, 9);
        peg$currPos += 9;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c25); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 9).toLowerCase() === peg$c26) {
          s1 = input.substr(peg$currPos, 9);
          peg$currPos += 9;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c27); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 9).toLowerCase() === peg$c28) {
            s1 = input.substr(peg$currPos, 9);
            peg$currPos += 9;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c29); }
          }
          if (s1 === peg$FAILED) {
            if (input.substr(peg$currPos, 9).toLowerCase() === peg$c30) {
              s1 = input.substr(peg$currPos, 9);
              peg$currPos += 9;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c31); }
            }
            if (s1 === peg$FAILED) {
              if (input.substr(peg$currPos, 9).toLowerCase() === peg$c32) {
                s1 = input.substr(peg$currPos, 9);
                peg$currPos += 9;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c33); }
              }
              if (s1 === peg$FAILED) {
                if (input.substr(peg$currPos, 9).toLowerCase() === peg$c34) {
                  s1 = input.substr(peg$currPos, 9);
                  peg$currPos += 9;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c35); }
                }
              }
            }
          }
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c36(s1);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      return s0;
    }

    function peg$parsemotion() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6).toLowerCase() === peg$c37) {
        s1 = input.substr(peg$currPos, 6);
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c38); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 7).toLowerCase() === peg$c39) {
            s3 = input.substr(peg$currPos, 7);
            peg$currPos += 7;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c40); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseinteger();
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  if (input.substr(peg$currPos, 11).toLowerCase() === peg$c41) {
                    s7 = input.substr(peg$currPos, 11);
                    peg$currPos += 11;
                  } else {
                    s7 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c42); }
                  }
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parse_();
                    if (s8 !== peg$FAILED) {
                      s9 = peg$parsefloat();
                      if (s9 !== peg$FAILED) {
                        s10 = peg$parse_();
                        if (s10 !== peg$FAILED) {
                          s11 = [];
                          s12 = peg$parseframe_data();
                          while (s12 !== peg$FAILED) {
                            s11.push(s12);
                            s12 = peg$parseframe_data();
                          }
                          if (s11 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s1 = peg$c43(s5, s9, s11);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      return s0;
    }

    function peg$parseframe_data() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parseframe_value();
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = peg$parseframe_value();
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        if (peg$c44.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c45); }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            if (peg$c44.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c45); }
            }
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c46(s1);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      return s0;
    }

    function peg$parseframe_value() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      s1 = peg$parsefloat();
      if (s1 !== peg$FAILED) {
        s2 = [];
        if (peg$c47.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c48); }
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$c47.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c48); }
          }
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c49(s1);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      return s0;
    }

    function peg$parseid() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (peg$c50.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c51); }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          if (peg$c50.test(input.charAt(peg$currPos))) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c51); }
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s0 = input.substring(s0, peg$currPos);
      } else {
        s0 = s1;
      }

      return s0;
    }

    function peg$parsefloat() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (peg$c52.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c53); }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          if (peg$c52.test(input.charAt(peg$currPos))) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c53); }
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c54(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parseinteger() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (peg$c55.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c56); }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          if (peg$c55.test(input.charAt(peg$currPos))) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c56); }
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c57(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parse_() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (peg$c58.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c59); }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (peg$c58.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c59); }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c60();
      }
      s0 = s1;

      return s0;
    }

    peg$result = peg$startRuleFunction();

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(
        null,
        peg$maxFailExpected,
        peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
        peg$maxFailPos < input.length
          ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
          : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
      );
    }
  }

  return {
    SyntaxError: peg$SyntaxError,
    parse:       peg$parse
  };
})();

})(this);
},{}],32:[function(require,module,exports){
// Generated by CoffeeScript 1.9.3
(function() {
  var Teacup, doctypes, elements, fn1, fn2, fn3, fn4, i, j, l, len, len1, len2, len3, m, merge_elements, ref, ref1, ref2, ref3, tagName,
    slice = [].slice,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  doctypes = {
    'default': '<!DOCTYPE html>',
    '5': '<!DOCTYPE html>',
    'xml': '<?xml version="1.0" encoding="utf-8" ?>',
    'transitional': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    'strict': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">',
    'frameset': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Frameset//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd">',
    '1.1': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">',
    'basic': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML Basic 1.1//EN" "http://www.w3.org/TR/xhtml-basic/xhtml-basic11.dtd">',
    'mobile': '<!DOCTYPE html PUBLIC "-//WAPFORUM//DTD XHTML Mobile 1.2//EN" "http://www.openmobilealliance.org/tech/DTD/xhtml-mobile12.dtd">',
    'ce': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "ce-html-1.0-transitional.dtd">'
  };

  elements = {
    regular: 'a abbr address article aside audio b bdi bdo blockquote body button canvas caption cite code colgroup datalist dd del details dfn div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup html i iframe ins kbd label legend li map mark menu meter nav noscript object ol optgroup option output p pre progress q rp rt ruby s samp section select small span strong sub summary sup table tbody td textarea tfoot th thead time title tr u ul video',
    raw: 'style',
    script: 'script',
    "void": 'area base br col command embed hr img input keygen link meta param source track wbr',
    obsolete: 'applet acronym bgsound dir frameset noframes isindex listing nextid noembed plaintext rb strike xmp big blink center font marquee multicol nobr spacer tt',
    obsolete_void: 'basefont frame'
  };

  merge_elements = function() {
    var a, args, element, i, j, len, len1, ref, result;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    result = [];
    for (i = 0, len = args.length; i < len; i++) {
      a = args[i];
      ref = elements[a].split(' ');
      for (j = 0, len1 = ref.length; j < len1; j++) {
        element = ref[j];
        if (indexOf.call(result, element) < 0) {
          result.push(element);
        }
      }
    }
    return result;
  };

  Teacup = (function() {
    function Teacup() {
      this.htmlOut = null;
    }

    Teacup.prototype.resetBuffer = function(html) {
      var previous;
      if (html == null) {
        html = null;
      }
      previous = this.htmlOut;
      this.htmlOut = html;
      return previous;
    };

    Teacup.prototype.render = function() {
      var args, previous, result, template;
      template = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      previous = this.resetBuffer('');
      try {
        template.apply(null, args);
      } finally {
        result = this.resetBuffer(previous);
      }
      return result;
    };

    Teacup.prototype.cede = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this.render.apply(this, args);
    };

    Teacup.prototype.renderable = function(template) {
      var teacup;
      teacup = this;
      return function() {
        var args, result;
        args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
        if (teacup.htmlOut === null) {
          teacup.htmlOut = '';
          try {
            template.apply(this, args);
          } finally {
            result = teacup.resetBuffer();
          }
          return result;
        } else {
          return template.apply(this, args);
        }
      };
    };

    Teacup.prototype.renderAttr = function(name, value) {
      var k, v;
      if (value == null) {
        return " " + name;
      }
      if (value === false) {
        return '';
      }
      if (name === 'data' && typeof value === 'object') {
        return ((function() {
          var results;
          results = [];
          for (k in value) {
            v = value[k];
            results.push(this.renderAttr("data-" + k, v));
          }
          return results;
        }).call(this)).join('');
      }
      if (value === true) {
        value = name;
      }
      return " " + name + "=" + (this.quote(this.escape(value.toString())));
    };

    Teacup.prototype.attrOrder = ['id', 'class'];

    Teacup.prototype.renderAttrs = function(obj) {
      var i, len, name, ref, result, value;
      result = '';
      ref = this.attrOrder;
      for (i = 0, len = ref.length; i < len; i++) {
        name = ref[i];
        if (name in obj) {
          result += this.renderAttr(name, obj[name]);
        }
      }
      for (name in obj) {
        value = obj[name];
        if (indexOf.call(this.attrOrder, name) >= 0) {
          continue;
        }
        result += this.renderAttr(name, value);
      }
      return result;
    };

    Teacup.prototype.renderContents = function() {
      var contents, rest, result;
      contents = arguments[0], rest = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      if (contents == null) {

      } else if (typeof contents === 'function') {
        result = contents.apply(this, rest);
        if (typeof result === 'string') {
          return this.text(result);
        }
      } else {
        return this.text(contents);
      }
    };

    Teacup.prototype.isSelector = function(string) {
      var ref;
      return string.length > 1 && ((ref = string.charAt(0)) === '#' || ref === '.');
    };

    Teacup.prototype.parseSelector = function(selector) {
      var classes, i, id, klass, len, ref, ref1, token;
      id = null;
      classes = [];
      ref = selector.split('.');
      for (i = 0, len = ref.length; i < len; i++) {
        token = ref[i];
        token = token.trim();
        if (id) {
          classes.push(token);
        } else {
          ref1 = token.split('#'), klass = ref1[0], id = ref1[1];
          if (klass !== '') {
            classes.push(token);
          }
        }
      }
      return {
        id: id,
        classes: classes
      };
    };

    Teacup.prototype.normalizeArgs = function(args) {
      var arg, attrs, classes, contents, i, id, index, len, parsedSelector, selector;
      attrs = {};
      selector = null;
      contents = null;
      for (index = i = 0, len = args.length; i < len; index = ++i) {
        arg = args[index];
        if (arg != null) {
          switch (typeof arg) {
            case 'string':
              if (index === 0 && this.isSelector(arg)) {
                selector = arg;
                parsedSelector = this.parseSelector(arg);
              } else {
                contents = arg;
              }
              break;
            case 'function':
            case 'number':
            case 'boolean':
              contents = arg;
              break;
            case 'object':
              if (arg.constructor === Object) {
                attrs = arg;
              } else {
                contents = arg;
              }
              break;
            default:
              contents = arg;
          }
        }
      }
      if (parsedSelector != null) {
        id = parsedSelector.id, classes = parsedSelector.classes;
        if (id != null) {
          attrs.id = id;
        }
        if (classes != null ? classes.length : void 0) {
          if (attrs["class"]) {
            classes.push(attrs["class"]);
          }
          attrs["class"] = classes.join(' ');
        }
      }
      return {
        attrs: attrs,
        contents: contents,
        selector: selector
      };
    };

    Teacup.prototype.tag = function() {
      var args, attrs, contents, ref, tagName;
      tagName = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      ref = this.normalizeArgs(args), attrs = ref.attrs, contents = ref.contents;
      this.raw("<" + tagName + (this.renderAttrs(attrs)) + ">");
      this.renderContents(contents);
      return this.raw("</" + tagName + ">");
    };

    Teacup.prototype.rawTag = function() {
      var args, attrs, contents, ref, tagName;
      tagName = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      ref = this.normalizeArgs(args), attrs = ref.attrs, contents = ref.contents;
      this.raw("<" + tagName + (this.renderAttrs(attrs)) + ">");
      this.raw(contents);
      return this.raw("</" + tagName + ">");
    };

    Teacup.prototype.scriptTag = function() {
      var args, attrs, contents, ref, tagName;
      tagName = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      ref = this.normalizeArgs(args), attrs = ref.attrs, contents = ref.contents;
      this.raw("<" + tagName + (this.renderAttrs(attrs)) + ">");
      this.renderContents(contents);
      return this.raw("</" + tagName + ">");
    };

    Teacup.prototype.selfClosingTag = function() {
      var args, attrs, contents, ref, tag;
      tag = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      ref = this.normalizeArgs(args), attrs = ref.attrs, contents = ref.contents;
      if (contents) {
        throw new Error("Teacup: <" + tag + "/> must not have content.  Attempted to nest " + contents);
      }
      return this.raw("<" + tag + (this.renderAttrs(attrs)) + " />");
    };

    Teacup.prototype.coffeescript = function(fn) {
      return this.raw("<script type=\"text/javascript\">(function() {\n  var __slice = [].slice,\n      __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },\n      __hasProp = {}.hasOwnProperty,\n      __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };\n  (" + (this.escape(fn.toString())) + ")();\n})();</script>");
    };

    Teacup.prototype.comment = function(text) {
      return this.raw("<!--" + (this.escape(text)) + "-->");
    };

    Teacup.prototype.doctype = function(type) {
      if (type == null) {
        type = 5;
      }
      return this.raw(doctypes[type]);
    };

    Teacup.prototype.ie = function(condition, contents) {
      this.raw("<!--[if " + (this.escape(condition)) + "]>");
      this.renderContents(contents);
      return this.raw("<![endif]-->");
    };

    Teacup.prototype.text = function(s) {
      if (this.htmlOut == null) {
        throw new Error("Teacup: can't call a tag function outside a rendering context");
      }
      this.htmlOut += (s != null) && this.escape(s.toString()) || '';
      return null;
    };

    Teacup.prototype.raw = function(s) {
      if (s == null) {
        return;
      }
      this.htmlOut += s;
      return null;
    };

    Teacup.prototype.escape = function(text) {
      return text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    Teacup.prototype.quote = function(value) {
      return "\"" + value + "\"";
    };

    Teacup.prototype.use = function(plugin) {
      return plugin(this);
    };

    Teacup.prototype.tags = function() {
      var bound, boundMethodNames, fn1, i, len, method;
      bound = {};
      boundMethodNames = [].concat('cede coffeescript comment component doctype escape ie normalizeArgs raw render renderable script tag text use'.split(' '), merge_elements('regular', 'obsolete', 'raw', 'void', 'obsolete_void'));
      fn1 = (function(_this) {
        return function(method) {
          return bound[method] = function() {
            var args;
            args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
            return _this[method].apply(_this, args);
          };
        };
      })(this);
      for (i = 0, len = boundMethodNames.length; i < len; i++) {
        method = boundMethodNames[i];
        fn1(method);
      }
      return bound;
    };

    Teacup.prototype.component = function(func) {
      return (function(_this) {
        return function() {
          var args, attrs, contents, ref, renderContents, selector;
          args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
          ref = _this.normalizeArgs(args), selector = ref.selector, attrs = ref.attrs, contents = ref.contents;
          renderContents = function() {
            var args;
            args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
            args.unshift(contents);
            return _this.renderContents.apply(_this, args);
          };
          return func.apply(_this, [selector, attrs, renderContents]);
        };
      })(this);
    };

    return Teacup;

  })();

  ref = merge_elements('regular', 'obsolete');
  fn1 = function(tagName) {
    return Teacup.prototype[tagName] = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this.tag.apply(this, [tagName].concat(slice.call(args)));
    };
  };
  for (i = 0, len = ref.length; i < len; i++) {
    tagName = ref[i];
    fn1(tagName);
  }

  ref1 = merge_elements('raw');
  fn2 = function(tagName) {
    return Teacup.prototype[tagName] = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this.rawTag.apply(this, [tagName].concat(slice.call(args)));
    };
  };
  for (j = 0, len1 = ref1.length; j < len1; j++) {
    tagName = ref1[j];
    fn2(tagName);
  }

  ref2 = merge_elements('script');
  fn3 = function(tagName) {
    return Teacup.prototype[tagName] = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this.scriptTag.apply(this, [tagName].concat(slice.call(args)));
    };
  };
  for (l = 0, len2 = ref2.length; l < len2; l++) {
    tagName = ref2[l];
    fn3(tagName);
  }

  ref3 = merge_elements('void', 'obsolete_void');
  fn4 = function(tagName) {
    return Teacup.prototype[tagName] = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this.selfClosingTag.apply(this, [tagName].concat(slice.call(args)));
    };
  };
  for (m = 0, len3 = ref3.length; m < len3; m++) {
    tagName = ref3[m];
    fn4(tagName);
  }

  if (typeof module !== "undefined" && module !== null ? module.exports : void 0) {
    module.exports = new Teacup().tags();
    module.exports.Teacup = Teacup;
  } else if (typeof define === 'function' && define.amd) {
    define('teacup', [], function() {
      return new Teacup().tags();
    });
  } else {
    window.teacup = new Teacup().tags();
    window.teacup.Teacup = Teacup;
  }

}).call(this);

},{}],33:[function(require,module,exports){
arguments[4][21][0].apply(exports,arguments)
},{"dup":21}]},{},[2]);
