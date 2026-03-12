const fs = require('fs');
const https = require('https');
const path = require('path');

const METADATA_URL = 'https://cdn.jsdelivr.net/npm/mermaid/package.json';
const TARGET = path.join(__dirname, '..', '_static', 'mermaid.min.js');
const VERSION_FILE = path.join(__dirname, '..', '_static', 'mermaid.version.json');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'user-agent': 'markdown-preview.nvim',
        },
      },
      (response) => {
        const { statusCode = 0, headers } = response;

        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          response.resume();
          fetchText(headers.location).then(resolve, reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${statusCode} for ${url}`));
          return;
        }

        response.setEncoding('utf8');
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => resolve(body));
      }
    );

    request.on('error', reject);
  });
}

async function main() {
  const metadata = JSON.parse(await fetchText(METADATA_URL));
  const version = metadata.version;

  if (!version) {
    throw new Error('Could not resolve Mermaid version from CDN metadata.');
  }

  const downloadUrl = `https://cdn.jsdelivr.net/npm/mermaid@${version}/dist/mermaid.min.js`;
  const script = await fetchText(downloadUrl);

  fs.writeFileSync(TARGET, script);
  fs.writeFileSync(
    VERSION_FILE,
    `${JSON.stringify({ version, url: downloadUrl }, null, 2)}\n`
  );

  process.stdout.write(`Updated Mermaid to ${version}\n`);
}

main().catch((error) => {
  if (fs.existsSync(TARGET)) {
    process.stderr.write(
      `Could not refresh Mermaid from jsDelivr. Keeping bundled Mermaid.\n${error.message}\n`
    );
    process.exit(0);
  }

  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
