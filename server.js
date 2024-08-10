const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');

const WEBUI_PORT = parseInt(process.env.WEBUI_PORT || '3333');
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || '6379';
const REDIS_USER = process.env.REDIS_USER;
const REDIS_PASS = process.env.REDIS_PASS;
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'rest2redis';
const REDIS_DB = parseInt(process.env.REDIS_DB || '7');
const LOGGING_WINDOW = parseInt(process.env.LOGGING_WINDOW || '10') * 1000;

const ALLOWED_API_KEYS = (process.env.ALLOWED_API_KEYS || '').split('|');

let redisClient;
let loggedRequests = [];

setInterval(() => {
    const windowEnd = Date.now() - LOGGING_WINDOW;
    loggedRequests = loggedRequests.filter(r => r.ts > windowEnd);
}, 1000);

const run = async () => {
    console.log(`Connecting to ${REDIS_HOST}:${REDIS_PORT}...`);
    const connectionConfig = {
        host: REDIS_HOST,
        port: REDIS_PORT,
        db: REDIS_DB,
    };
    if (REDIS_USER) {
        connectionConfig.username = REDIS_USER;
    }
    if (REDIS_PASS) {
        connectionConfig.password = REDIS_PASS;
    }
    redisClient = new Redis(connectionConfig);
    redisClient.on('error', err => console.log('Redis Client Error', err));
    console.log('REDIS server connected...');

    console.log(`Setting up express server on port ${WEBUI_PORT}...`);
    const app = express();
    app.use(express.json());
    app.use(cors());

    app.get('/', function (req, res) {
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        const data = {
            rate: (loggedRequests.length / 10).toFixed(2),
        };
        res.json(data);
    });

    app.post('/:cmd/*', function (req, res) {
        if (ALLOWED_API_KEYS.length > 0) {
            const apiKey = req.header('x-api-key');
            if (!ALLOWED_API_KEYS.includes(apiKey)) {
                res.status(401);
                return;
            }
        }

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
                res.status(404);
                return;
        }
        res.status(200);
    });

    app.listen(WEBUI_PORT)
    console.log('Running...');
}

run();
