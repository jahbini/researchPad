/*
 * skeleton-extras.js - A set of UI components built on Skeleton
 *
 * Florian Dejonckheere <florian@floriandejonckheere.be>
 *
 * */

$(document).ready(function() {

  /**
   * Dismissable alerts
   *
   * */
  $('[data-toggle="dismiss"]').click(function(ev) {
    $(ev.target).parents('.alert')
        .css('opacity', '0')
        .delay(500)
        .queue(function(next) {
          $(this).hide();
        });
  });

})
