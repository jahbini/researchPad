# vim: et:ts=2:sw=2:sts=2
loadedScripts={}
_=require('underscore')
###
    Load a script.
    @param {string} url - URL or path to the script. Relative paths are
    relative to the HTML file that initiated script loading.
    @param {function} callback - Optional function that will
    be called on load or error.
    @public
###

loadScript = (url, callback = ()-> ) ->
  # If script is already loaded call callback directly and return.
  if !loadedScripts[url]
    loadedScripts[url] = status: "" , callees:[ ]

  status = loadedScripts[url].status
  if status == "loading" || status == "error"
    callback(status);
    return;

  # Add script to dictionary of loading clients.
  loadedScripts[url].callees.push callback
  return if status == "loading"

  # Create script tag.
  script = document.createElement("script");
  script.type = "text/javascript";
  script.src = url;

  # Bind the onload event and set callbacks on complete
  script.onload = ()->
    # Mark as loaded.
    loadedScripts[url].status = "loaded"
    _(loadedScripts[url].callees).each (callback)->
      callback "loaded"
    loadedScripts[url].callees = []

  #onerror fires for things like malformed URLs and 404"s.
  script.onerror = ()->
    loadedScripts[url] = "error"
    _(loadedScripts[url].callees).each (callback)->
      callback "error"
    loadedScripts[url].callees = []

  # Attaching the script tag to the document starts loading the script.
  document.head.appendChild script

exports.loadScript = loadScript
