const os = require('os');
const path = require('path');
const http = require('../lib/http');

process.env.LASTFM_API_KEY = 'test-key';
process.env.NEXTTRACK_CACHE_FILE = path.join(os.tmpdir(), `nexttrack-test-cache-${process.pid}.json`);
http.configure({ rateLimit: false, persist: false });
