const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Descarga una URL siguiendo redirecciones y la devuelve como stream
const fetchWithRedirects = (targetUrl, callback, redirectCount = 0) => {
    if (redirectCount > 5) return callback(new Error('Demasiadas redirecciones'));

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        return callback(e);
    }

    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    protocol.get(targetUrl, (res) => {
        // Seguir redirecciones 301/302/307/308
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            res.resume(); // descartar body de redirección
            const nextUrl = res.headers.location.startsWith('http')
                ? res.headers.location
                : `${parsedUrl.protocol}//${parsedUrl.host}${res.headers.location}`;
            return fetchWithRedirects(nextUrl, callback, redirectCount + 1);
        }
        callback(null, res);
    }).on('error', callback);
};

// GET /api/download?url=<cloudinary_url>&name=<filename>
router.get('/', (req, res) => {
    const { url, name } = req.query;

    if (!url) return res.status(400).json({ msg: 'Parámetro url requerido.' });

    let fileUrl;
    try {
        fileUrl = new URL(url);
    } catch {
        return res.status(400).json({ msg: 'URL inválida.' });
    }

    const fileName = name || fileUrl.pathname.split('/').pop() || 'archivo';

    // Para Cloudinary: agregar fl_attachment para que devuelva el archivo ORIGINAL
    // sin conversión de formato (crítico para PDFs almacenados como image resource)
    let fetchUrl = url;
    if (url.includes('cloudinary.com') && !url.includes('fl_attachment')) {
        fetchUrl = url.replace('/upload/', '/upload/fl_attachment/');
    }

    fetchWithRedirects(fetchUrl, (err, fileRes) => {
        if (err) {
            console.error('Error en proxy de descarga:', err);
            return res.status(500).json({ msg: 'Error al descargar el archivo.' });
        }

        if (fileRes.statusCode !== 200) {
            fileRes.resume();
            return res.status(fileRes.statusCode).json({ msg: `Error al obtener archivo: ${fileRes.statusCode}` });
        }

        const contentType = fileRes.headers['content-type'] || 'application/octet-stream';

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        // No reenviar Content-Length: podría ser incorrecto tras transformaciones de Cloudinary

        fileRes.pipe(res);

        fileRes.on('error', (pipeErr) => {
            console.error('Error en pipe:', pipeErr);
            if (!res.headersSent) res.status(500).end();
        });
    });
});

module.exports = router;
