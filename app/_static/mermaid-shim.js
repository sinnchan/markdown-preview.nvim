(function () {
  var root = typeof window !== 'undefined' ? window : globalThis;
  var mermaid = root.mermaid;

  if (!mermaid) {
    return;
  }

  function isThenable(value) {
    return value && typeof value.then === 'function';
  }

  function normalizeNodes(nodes) {
    if (!nodes) {
      return null;
    }

    if (typeof nodes === 'string') {
      return root.document.querySelectorAll(nodes);
    }

    if (typeof nodes.length === 'number') {
      return nodes;
    }

    return [nodes];
  }

  function logError(error) {
    if (root.console && typeof root.console.error === 'function') {
      root.console.error('markdown-preview.nvim: Mermaid render failed', error);
    }
  }

  function withSuppressedErrors(result) {
    if (!isThenable(result)) {
      return result;
    }

    return result.catch(function (error) {
      logError(error);
      return false;
    });
  }

  function applyConfig(config) {
    if (typeof mermaid.initialize !== 'function' || config == null) {
      return;
    }

    mermaid.initialize(
      Object.assign(
        {
          startOnLoad: false,
        },
        config || {}
      )
    );
  }

  function runMermaid(nodes) {
    var normalizedNodes = normalizeNodes(nodes);

    if (typeof mermaid.run === 'function') {
      var runOptions = {
        suppressErrors: true,
      };

      if (normalizedNodes) {
        runOptions.nodes = normalizedNodes;
      }

      return withSuppressedErrors(mermaid.run(runOptions));
    }

    if (typeof originalInit === 'function') {
      return withSuppressedErrors(originalInit(undefined, normalizedNodes));
    }

    return false;
  }

  var originalInit = typeof mermaid.init === 'function' ? mermaid.init.bind(mermaid) : null;
  var originalParse = typeof mermaid.parse === 'function' ? mermaid.parse.bind(mermaid) : null;

  if (typeof originalParse === 'function') {
    mermaid.parse = function (text, parseOptions) {
      try {
        return withSuppressedErrors(
          originalParse(
            text,
            Object.assign({}, parseOptions || {}, {
              suppressErrors: true,
            })
          )
        );
      } catch (error) {
        return false;
      }
    };
  }

  mermaid.init = function (config, nodes, callback) {
    try {
      applyConfig(config);
      var rendered = runMermaid(nodes);

      if (isThenable(rendered)) {
        return rendered.then(function (result) {
          if (typeof callback === 'function') {
            callback();
          }
          return result;
        });
      }

      if (typeof callback === 'function') {
        callback();
      }
      return rendered;
    } catch (error) {
      logError(error);
      return false;
    }
  };

  root.markdownPreviewMermaid = {
    render: function (config, nodes) {
      try {
        applyConfig(
          Object.assign(
            {
              startOnLoad: false,
            },
            config || {}
          )
        );
        return runMermaid(nodes);
      } catch (error) {
        logError(error);
        return false;
      }
    },
  };
})();
