const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const Redis = require('ioredis');

const DEBUG = (process.env.DEBUG || 'false') === 'true';
const WEBUI_PORT = parseInt(process.env.WEBUI_PORT || '3333');
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || '6379';
const REDIS_USER = process.env.REDIS_USER;
const REDIS_PASS = process.env.REDIS_PASS;
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'rest2redis';
const REDIS_DB = parseInt(process.env.REDIS_DB || '7');
const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL || '5');
const LOGGING_WINDOW = parseInt(process.env.LOGGING_WINDOW || '10') * 1000;

const ALLOWED_API_KEYS = (process.env.ALLOWED_API_KEYS || '').split('|');

let redisClient;
let loggedRequests = [];
let openedWS = 0;

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
        res.sendFile(path.join(__dirname, 'index.html'));
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

    console.log(`Setting up websocket server on port ${WEBUI_PORT+1}...`);
    const wss = new WebSocket.Server({ port: WEBUI_PORT+1 });

    wss.on('connection', socket => {
        if (DEBUG) {
            console.log('Client connected...');
        }

        // Set up a function to handle when the client closes its connection
        socket.onclose = () => {
            if (DEBUG) {
                console.log('Client disconnected...');
            }
        };

        socket.onerror = err => console.error(err);
    });

    wss.on('upgrade', (request, socket) => {
        // Get the client's request headers and cookies
        const headers = request.headers;
        
        // Check if the client is making an upgrade request
        if (headers['Upgrade'] === 'websocket') {
            // Handle the upgrade request
            if (DEBUG) {
                console.log('Client is upgrading to a WebSocket connection');
            }
            
            // Upgrade the socket connection
            socket = new WebSocket(socket, { server: wss });

            // Set up a function to handle when the client closes its connection
            socket.onclose = () => {
                if (DEBUG) {
                    console.log('Upgraded Client disconnected...');
                }
            };
            socket.onerror = err => console.error(err);
        } else {
            if (DEBUG) {
                console.log('Force Close, no upgrade requested...');
            }
            socket.close();
        }
    });

    let refreshInterval = Math.max(REFRESH_INTERVAL, 1);
    setInterval(() => {
        const data = {
            rate: (loggedRequests.length / 10).toFixed(2),
            websocketCount: wss.clients.size,
        };
        wss.clients.forEach(client => {
            client.send(JSON.stringify(data));
        });
    }, refreshInterval * 1000);

    app.listen(WEBUI_PORT)
    console.log('Running...');
}

run();
