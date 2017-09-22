(function ($) {
  Drupal.behaviors.exampleModule = {
    /**
     * Constructor.
     *
     * @param context
     * @param settings
     */
    attach: function (context, settings) {
      if (typeof settings.remotes === 'undefined' || typeof settings.action === 'undefined') {
        return;
      }

      if (typeof this[settings.action] !== 'function') {
        throw new Error('Undefined action');
      }

      this.axios   = window.axios.create({
        baseURL: '/elasticsearch/api/v1',
        timeout: 20000,
        headers: {
          'Accept'          : 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      this.remotes = settings.remotes;
      this.state   = {
        resultsCount: 0,
        sitesCount  : 0,
        emptySites  : [],
        footerBlock : $('<div />')
      };

      this[settings.action]();
    },

    /**
     * Reset state
     */
    resetState: function () {
      this.state = {
        resultsCount: 0,
        sitesCount  : 0,
        emptySites  : [],
        footerBlock : $('<div />')
      };
    },

    /**
     * Gets the status of a remote server and updates the status table.
     */
    getStatus: function () {
      this.remotes.map(function (remote) {
        this.axios.defaults.baseURL = '';
        this.axios.get(remote.url + '/elasticsearch/api/v1/status').then(function (response) {
          var data = response.data.data;

          if (typeof data.status === 'undefined') {
            data.status = 'No Elasticsearch Instance found';
          }

          $('#remote-host-' + remote.id).html(data.status);
          $('#remote-host-' + remote.id + '-circle').addClass('is-success');
        }).catch(function (error) {
          var response = error.response;
          if (response) {
            if (response.status === 404) {
              $('#remote-host-' + remote.id).html('Host Not Found');
            }
            else if (response.status === 500) {
              $('#remote-host-' + remote.id).html('Server Error');
            }
            else {
              var data = response.data.data;
              $('#remote-host-' + remote.id).html(data.status);
            }
          }
          else {
            $('#remote-host-' + remote.id).html('Invalid Host');
          }

          $('#remote-host-' + remote.id + '-circle').addClass('is-danger');
        });
      }.bind(this));
    },

    getCategories: function() {

    },

    /**
     * Respond to search events in search from.
     * This method is called by this[action]() in the constructor (attach
     * method).
     */
    setupSearchPage: function () {
      $('#tripal-elasticsearch-search-button').click(function (e) {
        e.preventDefault();
        var form     = {};
        var category = $('#tripal-elasticsearch-search-category').val();

        form.terms    = $('#tripal-elasticsearch-search-field').val();
        form.category = category === 'Any Type' ? null : category;
        this.sendSearchRequest(form);
      }.bind(this));
    },

    /**
     * Update results stats.
     */
    updateStats: function () {
      var content = 'Found ' + this.state.resultsCount + ' results from ' + this.state.sitesCount + ' websites';
      $('.elastic-stats-block').html(content);

      var footer = $('<div />').css('margin-top', '20px');

      if (this.state.emptySites.length > 0) {
        footer.html('<h3>Sites that returned no results</h3>');
        this.state.emptySites.map(function (site) {
          site.block.find('.elastic-result-block-content').html('No results found');
          site.block.find('.elastic-result-block-count').html('<a href="' + site.remote.url + '">Visit Site</a>');
          footer.append(site.block);
        }.bind(this));
      }
      this.state.footerBlock.html(footer);
    },

    /**
     * Sends a cross site search request.
     *
     * @param form
     */
    sendSearchRequest: function (form) {
      this.resetState();
      var block        = $('#tripal-elasticsearch-results-block');
      var resultsBlock = $('<div />');
      var statsBlock   = $('<div />', {'class': 'elastic-stats-block'});
      block.html(statsBlock);
      block.append(resultsBlock);
      block.append(this.state.footerBlock);

      this.remotes.map(function (remote) {
        var block = this.createSiteBlock(remote);
        resultsBlock.append(block);

        this.axios.get('/search/' + remote.id, {
          params: {
            terms   : form.terms,
            category: form.category,
            size    : 2
          }
        }).then(function (response) {
          var data = response.data.data;

          if (data.count === 0 || data.count === null) {
            data.markup = 'No results found';
            if (remote.id !== 0) {
              this.state.emptySites.push({block: block, remote: remote});
              return;
            }
          }
          else {
            var footer = $('<div />', {
              'class': 'elastic-result-block-footer'
            }).append('<a href="' + data.url + '">See All Results</a>');
            block.append(footer);
          }

          this.state.resultsCount += data.count || 0;
          this.state.sitesCount++;
          block.find('.elastic-result-block-content').html(data.markup);
          block.find('.elastic-result-block-count').html((data.count || 0) + ' total results');
        }.bind(this)).catch(function (error) {
          console.log(error);
          //block.slideUp();
        }.bind(this)).then(this.updateStats.bind(this));
      }.bind(this));
    },

    /**
     * Create a result block.
     *
     * @param remote
     * @returns {*|HTMLElement}
     */
    createSiteBlock: function (remote) {
      var block = $('<div />', {
        'class': 'elastic-result-block'
      });

      var title = $('<h3 />', {
        'class': 'elastic-result-block-title'
      }).append(remote.label);
      block.append(title);

      var count = $('<div />', {
        'class': 'elastic-result-block-count'
      });
      block.append(count);

      var content = $('<div />', {
        'class': 'elastic-result-block-content'
      }).append('Searching <div class="ajax-progress ajax-progress-throbber"><div class="throbber">&nbsp;</div></div>');
      block.append(content);

      return block;
    }
  };
}(jQuery));