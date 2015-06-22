# vim: et:ts=2:sw=2:sts=2
first = [
      "Red", "Green", "Blue", "Grey"
      "Happy", "Hungry", "Sleepy", "Healthy"
      "Easy", "Hard", "Quiet", "Loud"
      "Round", "Pointed", "Wavy", "Furry"
      ]
second = [
      "Justice", "Wisdom", "Equality", "Harmony"
      "Lamp", "Table", "Desk", "Couch"
      "Palace", "Shack", "House", "Cave"
      "Bamboo", "Lettuce", "Broccoli", "Raisin"
    ]

verbose = (s) ->
  hash = 0
  if s.length == 0 then return hash
  `for (i = 0, l = s.length; i < l; i++) {
        char = s.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash |= 0 // Convert to 32bit integer
      }`
  return hash&255

hasher= (s) ->
    s.split("").reduce(
      (a,b)->
        a=((a<<5)-a)+b.charCodeAt(0)
        return a&255
      ,0)              

namer= (hash) ->
    a=hash>>4&0xf
    b=hash & 0xf
    return first[a] + ' ' +second[b]
glib= ->
  return (any) =>
    namer hasher(any)

exports.glib =new glib
