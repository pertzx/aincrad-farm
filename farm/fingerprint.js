const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.0 Edg/126.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.1',
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.0 OPR/111.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.0 Vivaldi/6.8.3381.46'
];

const PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64', 'Win64'];
const LANGUAGES = ['pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7', 'en-US,en;q=0.9', 'pt-PT,pt;q=0.9,en;q=0.8', 'es-ES,es;q=0.9,en;q=0.8', 'fr-FR,fr;q=0.9,en;q=0.8'];
const REFERRERS = [
    'https://www.google.com/search?q=',
    'https://www.bing.com/search?q=',
    'https://www.facebook.com/',
    'https://twitter.com/',
    'https://www.instagram.com/',
    'https://www.youtube.com/results?search_query=',
    'https://www.reddit.com/',
    'https://br.pinterest.com/search/pins/?q=',
    'https://www.tiktok.com/search?q=',
    ''
];

const VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 2560, height: 1440 },
    { width: 1680, height: 1050 },
    { width: 1600, height: 900 }
];

const TIMEZONES = [
    'America/Sao_Paulo',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Australia/Sydney'
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateFingerprint() {
    const ua = randomItem(USER_AGENTS);
    const vp = randomItem(VIEWPORTS);
    const tz = randomItem(TIMEZONES);
    const ref = randomItem(REFERRERS);
    const lang = randomItem(LANGUAGES);
    const plat = randomItem(PLATFORMS);

    return {
        userAgent: ua,
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: randomItem([1, 1.25, 1.5, 2]),
        timezone: tz,
        referrer: ref,
        language: lang,
        platform: plat,
        colorScheme: randomItem(['light', 'dark']),
        hardwareConcurrency: randomItem([2, 4, 6, 8, 12]),
        deviceMemory: randomItem([4, 8, 16]),
        maxTouchPoints: randomItem([0, 0, 0, 5])
    };
}

module.exports = { generateFingerprint, randomInt, randomItem, REFERRERS };
