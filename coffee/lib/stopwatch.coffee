###
# Javascript Stopwatch class
# http://www.seph.dk
#
# Copyright 2009 Seph soliman
# Released under the CC BY 4.0 (do whatever you want - just leave my name on it)
# https://creativecommons.org/licenses/by/4.0/
###

# * Stopwatch class

module.exports = class Stopwatch
  constructor: (@tickResolution=100, @countUp=true, @listener) ->
    @startTime = 0
    @stopTime = 0
    @totalElapsed = 0
    # * elapsed number of ms in total
    @started = false
    # * function to receive onTick events
    # * how long between each tick in milliseconds
    @tickInterval = null
    # * pretty static vars
    @onehour = 1000 * 60 * 60
    @onemin = 1000 * 60
    @onesec = 1000
    return

  start: ->
    delegate = (that, method) ->
      ->
        method.call that

    if !@started
      @startTime = (new Date).getTime()
      @stopTime = 0
      @started = true
      @tickInterval = setInterval(delegate(this, @onTick), @tickResolution)
    return

  stop: ->
    if @started
      @stopTime = (new Date).getTime()
      @started = false
      elapsed = @stopTime - (@startTime)
      @totalElapsed += elapsed
      if @tickInterval != null
        clearInterval @tickInterval
    @getElapsed()

  reset: ->
    @totalElapsed = 0
    # * if watch is running, reset it to current time
    @startTime = (new Date).getTime()
    @stopTime = @startTime
    if !@countUp
      @totalElapsed = @initialElapsed
    if @tickInterval != null

      delegate = (that, method) ->
        ->
          method.call that

      clearInterval @tickInterval
      @tickInterval = setInterval(delegate(this, @onTick), @tickResolution)
    return

  restart: ->
    @stop()
    @reset()
    @start()
    return

  getElapsed: ->
    # * if watch is stopped, use that date, else use now
    elapsed = 0
    if @started
      elapsed = (new Date).getTime() - (@startTime)
    elapsed += @totalElapsed
    if !@countUp
      elapsed = Math.max(2 * @initialElapsed - elapsed, 0)
    hours = parseInt(elapsed / @onehour)
    elapsed %= @onehour
    mins = parseInt(elapsed / @onemin)
    elapsed %= @onemin
    secs = parseInt(elapsed / @onesec)
    ms = elapsed % @onesec
    {
      hours: hours
      minutes: mins
      seconds: secs
      milliseconds: ms
    }

  setElapsed: (hours, mins, secs) ->
    #	this.reset();
    @totalElapsed = 0
    @startTime = (new Date).getTime()
    @stopTime = @startTime
    @totalElapsed += hours * @onehour
    @totalElapsed += mins * @onemin
    @totalElapsed += if @countUp then secs * @onesec else (secs + 1) * @onesec - 1
    @totalElapsed = Math.max(@totalElapsed, 0)
    # * No negative numbers
    @initialElapsed = @totalElapsed
    if @tickInterval != null

      delegate = (that, method) ->
        ->
          method.call that

      clearInterval @tickInterval
      @tickInterval = setInterval(delegate(this, @onTick), @tickResolution)
    return

  toString: ->

    zpad = (num, digits,pad='0') ->
      num = num.toString()
      while num.length < digits
        num = pad + num
      num

    e = @getElapsed()
    zpad(e.hours, 2,' ') + ':' +
      zpad(e.minutes, 2) + ':' +
      zpad(e.seconds, 2) + ':' +
      parseInt e.milliseconds / 100

  setListener: (listener) ->
    @listener = listener
    return

  # * triggered every <resolution> ms

  onTick: ->
    if @listener != null
      @listener this
    return
