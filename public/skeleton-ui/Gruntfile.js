module.exports = function(grunt) {

  grunt.initConfig({
    less: {
      development: {
        options: {
          paths: ['less'],
          compress: false
        },
        files: {
          'css/skeleton-ui.css': 'less/skeleton-ui.less'
        }
      },
      production: {
        options: {
          paths: ['less'],
          compress: true,
          optimization: 0
        },
        files: {
          'css/skeleton-ui.min.css': 'less/skeleton-ui.less'
        }
      }
    },
    uglify: {
      options: {
        mangle: true,
        compress: true
      },
      production: {
        files: {
          'js/skeleton-ui.min.js': 'js/skeleton-ui.js'
        }
      }
    },
    watch: {
      options: {
        livereload: false
      },
      styles: {
        files: ['less/**/*.less'],
        tasks: ['less'],
        options: {
          nospawn: true
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.registerTask('default', ['less', 'uglify', 'watch']);

};
