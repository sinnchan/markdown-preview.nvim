const fs = require('fs')
const path = require('path')
const logger = require('./lib/util/logger')('app/routes')

const routes = []

const use = function (route) {
  routes.unshift((req, res, next) => () => route(req, res, next))
}

const localMarkdownReg = /^\/_local_markdown_/
const markdownFileReg = /\.(md|markdown|mkd|mkdn|mdown|mdwn)$/i
const localMarkdownScriptTag = '<script type="text/javascript" src="/_static/local-link.js"></script>'

function decodeLocalPath (asPath, reg) {
  const targetPath = decodeURIComponent(decodeURIComponent(asPath.replace(reg, '')))
  return targetPath.replace(/\\ /g, ' ')
}

function splitLinkTarget (target) {
  const hashIndex = target.indexOf('#')
  const targetWithoutHash = hashIndex === -1 ? target : target.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : target.slice(hashIndex)
  const queryIndex = targetWithoutHash.indexOf('?')
  const pathname = queryIndex === -1 ? targetWithoutHash : targetWithoutHash.slice(0, queryIndex)
  return { pathname, hash }
}

async function getBufferDir (plugin, bufnr, fallbackPath) {
  let fileDir = fallbackPath || await plugin.nvim.call('expand', `#${bufnr}:p:h`)

  const mingw_home = process.env.MINGW_HOME
  if (mingw_home) {
    if (!fileDir.includes(':')) {
      // fileDir is unix-like: /Z/x/y/..., where 'Z' means Z:
      const cygpath = 'cygpath.exe'
      const cmd = cygpath + ' -w' + ' -a ' + fileDir
      logger.info('cmd', cmd)

      const { execSync } = require('node:child_process')
      const result = execSync(cmd)
      fileDir = result.toString('utf8').replace('\n', '')

      logger.info('New fileDir', fileDir)
    }
  }

  return fileDir
}

function resolveLocalPath (fileDir, targetPath) {
  let localPath = targetPath
  if (localPath[0] !== '/' && localPath[0] !== '\\') {
    localPath = path.join(fileDir, localPath)
  } else if (!fs.existsSync(localPath)) {
    let tmpDirPath = fileDir
    while (tmpDirPath !== '/' && tmpDirPath !== '\\') {
      tmpDirPath = path.normalize(path.join(tmpDirPath, '..'))
      const tmpPath = path.join(tmpDirPath, localPath)
      if (fs.existsSync(tmpPath)) {
        localPath = tmpPath
        break
      }
    }
  }
  return localPath
}

function servePreviewPage (res) {
  const page = fs.readFileSync('./out/index.html', 'utf-8')
  res.setHeader('content-type', 'text/html; charset=utf-8')
  if (page.includes('/_static/local-link.js')) {
    res.end(page)
    return
  }
  res.end(page.replace('</head>', `${localMarkdownScriptTag}</head>`))
}

// /page/:number
use((req, res, next) => {
  if (/^\/(?:page\/)?\d+$/.test(req.asPath)) {
    return servePreviewPage(res)
  }
  next()
})

// /_next/path
use((req, res, next) => {
  if (/\/_next/.test(req.asPath)) {
    return fs.createReadStream(path.join('./out', req.asPath)).pipe(res)
  }
  next()
})

// /_static/markdown.css
// /_static/highlight.css
use((req, res, next) => {
  try {
    if (req.mkcss && req.asPath === '/_static/markdown.css') {
      if (fs.existsSync(req.mkcss)) {
        return fs.createReadStream(req.mkcss).pipe(res)
      }
    } else if (req.hicss && req.asPath === '/_static/highlight.css') {
      if (fs.existsSync(req.hicss)) {
        return fs.createReadStream(req.hicss).pipe(res)
      }
    }
  } catch (e) {
    logger.error('load diy css fail: ', req.asPath, req.mkcss, req.hicss)
  }
  next()
})

// /_static/path
use((req, res, next) => {
  if (/\/_static/.test(req.asPath)) {
    const fpath = path.join('./', req.asPath)
    if (fs.existsSync(fpath)) {
      return fs.createReadStream(fpath).pipe(res)
    } else {
      logger.error('No such file:', req.asPath, req.mkcss, req.hicss)
    }
  }
  next()
})

// images
use(async (req, res, next) => {
  logger.info('image route: ', req.asPath)
  const reg = /^\/_local_image_/
  if (reg.test(req.asPath) && req.asPath !== '') {
    const plugin = req.plugin
    const buffers = await plugin.nvim.buffers
    const buffer = buffers.find(b => b.id === Number(req.bufnr))
    if (buffer) {
      const fileDir = await getBufferDir(plugin, req.bufnr, req.custImgPath !== '' ? req.custImgPath : '')

      logger.info('fileDir', fileDir)

      const imgPath = resolveLocalPath(fileDir, decodeLocalPath(req.asPath, reg))
      logger.info('imgPath', imgPath);
      
      if (fs.existsSync(imgPath) && !fs.statSync(imgPath).isDirectory()) {
        if (imgPath.endsWith('svg')) {
          res.setHeader('content-type', 'image/svg+xml')
        }
        return fs.createReadStream(imgPath).pipe(res)
      }
      logger.error('image not exists: ', imgPath)
    }
  }
  next()
})

// local markdown links
use(async (req, res, next) => {
  logger.info('local markdown route: ', req.asPath)
  if (localMarkdownReg.test(req.asPath) && req.asPath !== '') {
    const plugin = req.plugin
    const bufnr = req.headers['x-mkdp-bufnr'] || req.bufnr
    const buffers = await plugin.nvim.buffers
    const buffer = buffers.find(b => b.id === Number(bufnr))
    if (buffer) {
      const fileDir = await getBufferDir(plugin, bufnr)
      const target = decodeLocalPath(req.asPath, localMarkdownReg)
      const { pathname, hash } = splitLinkTarget(target)
      if (!markdownFileReg.test(pathname)) {
        return next()
      }

      const filePath = resolveLocalPath(fileDir, pathname)

      logger.info('filePath', filePath)

      if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        const escapedPath = await plugin.nvim.call('fnameescape', filePath)
        await plugin.nvim.command(`hide edit ${escapedPath}`)
        const currentBuffer = await plugin.nvim.buffer
        const location = `/page/${currentBuffer.id}${hash ? encodeURI(hash) : ''}`

        if (req.headers['x-mkdp-local-link'] === '1') {
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ url: location }))
          return
        }

        res.statusCode = 302
        res.setHeader('Location', location)
        res.end()
        return
      }
      logger.error('local markdown not exists: ', filePath)
    }
  }
  next()
})

// 404
use((req, res) => {
  res.statusCode = 404
  return fs.createReadStream(path.join('./out', '404.html')).pipe(res)
})

module.exports = function (req, res, next) {
  return routes.reduce((next, route) => route(req, res, next), next)()
}
