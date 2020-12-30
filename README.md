# StagApp: Bluetooth and gesture recording app for medical and diagnostic use
---------
Author: James A. Hinds, TI instruments, Evothings and many others

Level: Development

Technologies: Static hosted app, git, javascript, coffeescript, TI SensorTag, BLE

Summary: Record clinical data of SensorTag movements, bluetooth timers and patient gesture capture for medical use

Target Product: Medical application for iOS and Android devices to record movement data from TI Sensortag via Bluetooth 4.0

Product Versions: 4.x.x 

Source: https://github.com/jahbini/stagapp

## installation
1. Clone this repository to apple development system
1. run build via npm `npm run-script development|testing|production` to populate public` directory
1. build a new application 'ips' file with npm run make-app to start up xCode.  Place archived IPA in 'app' subdirectory.
1. Upload whole subdirectory to server directory ate /home/retro/stagapp. server will use /home/retro/stagapp/public for html reqquests



