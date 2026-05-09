(function () {
  var markdownFilePattern = /\.(md|markdown|mkd|mkdn|mdown|mdwn)$/i
  var schemePattern = /^[a-z][a-z0-9+.-]*:/i

  function closestAnchor (node) {
    while (node && node !== document) {
      if (node.tagName && node.tagName.toLowerCase() === 'a') {
        return node
      }
      node = node.parentNode
    }
    return null
  }

  function shouldOpenLocalMarkdown (href) {
    if (!href || href[0] === '#') {
      return false
    }
    if (href.indexOf('/_') === 0 || href.indexOf('/page/') === 0) {
      return false
    }
    if (schemePattern.test(href) || href.indexOf('//') === 0) {
      return false
    }

    var pathname = href.split('#')[0].split('?')[0]
    return markdownFilePattern.test(pathname)
  }

  function getBufnr () {
    var match = window.location.pathname.match(/^\/(?:page\/)?(\d+)/)
    return match ? match[1] : ''
  }

  function normalizePreviewUrl (url) {
    if (typeof url !== 'string') {
      return url
    }
    return url.replace(/^\/(\d+)([?#].*)?$/, '/page/$1$2')
  }

  if (window.history && window.history.replaceState) {
    var originalReplaceState = window.history.replaceState
    window.history.replaceState = function (state, title, url) {
      if (arguments.length > 2) {
        return originalReplaceState.call(window.history, state, title, normalizePreviewUrl(url))
      }
      return originalReplaceState.apply(window.history, arguments)
    }

    var currentUrl = window.location.pathname + window.location.search + window.location.hash
    var normalizedCurrentUrl = normalizePreviewUrl(currentUrl)
    if (normalizedCurrentUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', normalizedCurrentUrl)
    }
  }

  function openLocalMarkdown (href) {
    var requestPath = '/_local_markdown_' + encodeURIComponent(href)
    if (!window.fetch) {
      window.location.href = requestPath
      return
    }

    window.fetch(requestPath, {
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        'X-Mkdp-Bufnr': getBufnr(),
        'X-Mkdp-Local-Link': '1'
      }
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to open local markdown link')
        }
        return response.json()
      })
      .then(function (data) {
        if (data && data.url) {
          window.location.href = data.url
        }
      })
      .catch(function () {
        window.location.href = requestPath
      })
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    var anchor = closestAnchor(event.target)
    if (!anchor || anchor.target) {
      return
    }

    var href = anchor.getAttribute('href')
    if (!shouldOpenLocalMarkdown(href)) {
      return
    }

    event.preventDefault()
    openLocalMarkdown(href)
  })
})()
