const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const DEBUG = (process.env.DEBUG || 'false') === 'true';
const WEBUI_PORT = parseInt(process.env.WEBUI_PORT || '3333');
// redis://user:pass@server:port
const REDIS_HOST_PORT = process.env.REDIS_HOST_PORT || 'localhost:6379';
const REDIS_USER = process.env.REDIS_USER;
const REDIS_PASS = process.env.REDIS_PASS;
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'rest2redis';
const REDIS_DB = parseInt(process.env.REDIS_DB || '7');

let UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL || '1000');
if (UPDATE_INTERVAL < 250) {
    UPDATE_INTERVAL = 250;
}

let redisClient;
let loggedRequests = [];
const windowWidth = 10 * 1000; // aka 10 seconds

setInterval(() => {
    const windowEnd = Date.now() - windowWidth;
    loggedRequests = loggedRequests.filter(r => r.ts > windowEnd);
}, 1000);

const run = async () => {
    console.log(`Connecting to ${REDIS_HOST_PORT}...`);
    let redisUserPass = '';
    if (REDIS_USER) {
        redisUserPass = REDIS_USER;
    }
    if (REDIS_PASS) {
        redisUserPass = `${redisUserPass}:${REDIS_PASS}`;
    }
    // Connect to 127.0.0.1:6380, db 4, using password "authpassword":
    redisClient = new Redis(`redis://${redisUserPass}@${REDIS_HOST_PORT}/${REDIS_DB}`);
    redisClient.on('error', err => console.log('Redis Client Error', err));
    console.log('REDIS server connected...');

    console.log(`Setting up express server on port ${WEBUI_PORT}...`);
    const app = express();
    app.use(express.json());
    app.use(cors());

    app.get('/', function (req, res) {
        res.sendfile('index.html');
    });

    app.get('/throughput', function (req, res) {
        res.status(200);
        res.json({
            rate: (loggedRequests.length / 10).toFixed(2),
        });
    });

    app.post('/:cmd/*', function (req, res) {
        const cmd = req.params.cmd.toLowerCase();
        const url = req.url.split('/', -1).slice(2).join('/').replace(/\/+$/, '');

        const topic = `${REDIS_PREFIX}/url`;
        switch (cmd) {
            case 'publish':
                redisClient.publish(topic, req.body);
                loggedRequests.push({
                    ts: Date.now(),
                    topic: url,
                    type: cmd,
                });
                break;
            case 'set':
                redisClient.set(topic, req.body);
                loggedRequests.push({
                    ts: Date.now(),
                    topic: url,
                    type: cmd,
                });
                break;
            default:
                res.status(400);
                return;
        }
        res.status(200);
    });

    app.listen(WEBUI_PORT)
    console.log('Done...');
}

run();
