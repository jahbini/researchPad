# StagApp: Sensor Tag app for medical and diagnostic use
---------
Author: James A. Hinds, TI instruments, Evothings and many others

Level: Development

Technologies: Static hosted app, git, javascript, coffeescript, TI SensorTag, BLE

Summary: Record clinical data of SensorTag movements for medical use

Target Product: Medical application for iOS and Android devices to record movement data from TI Sensortag via Bluetooth 4.0

Product Versions: 0.1.0

Source: https://github.com/jahbini/stagapp

## installation
1. Clone this repository to target system
1. run build via npm `npm run-script development|testing|production` to populate public` directory
1. Clone server (https://github.com/jahbini/stagserv )
1. create a symbolic link from stagserv/public to resolve to stagapp/public


