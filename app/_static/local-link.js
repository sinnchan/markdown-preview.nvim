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
    window.location.href = '/_local_markdown_' + encodeURIComponent(href)
  })
})()
