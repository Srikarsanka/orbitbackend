const express = require('express');
const router = express.Router();
// node-fetch v3 requires dynamic import in CommonJS
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// GET /api/books?q=...
router.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, message: 'Query parameter "q" is required' });
    }

    try {
        // 1. Search Gutendex (Project Gutenberg)
        const gutendexUrl = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
        const gutenPromise = fetch(gutendexUrl).then(r => r.json()).catch(() => ({results: []}));

        // 2. Search OpenLibrary
        const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`;
        const olPromise = fetch(olUrl).then(r => r.json()).catch(() => ({docs: []}));

        // 3. Search Google Books
        const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`;
        const gbPromise = fetch(gbUrl).then(r => r.json()).catch(() => ({items: []}));

        const [gutenData, olData, gbData] = await Promise.all([gutenPromise, olPromise, gbPromise]);

        // Map Gutendex results
        const gutenBooks = (gutenData.results || []).map(book => ({
            id: `guten_${book.id}`,
            title: book.title,
            author_name: book.authors.map(a => a.name),
            source: 'Project Gutenberg',
            full_text_url: book.formats['text/html'] || book.formats['text/plain; charset=utf-8'],
            cover_url: book.formats['image/jpeg'],
            type: 'gutenberg',
            has_full_text: !!book.formats['text/html'],
            description: 'Public domain classic available for full reading.'
        }));

        // Map OpenLibrary results
        const olBooks = (olData.docs || []).map(book => ({
            id: `ol_${book.key ? book.key.split('/').pop() : Math.random()}`,
            title: book.title,
            author_name: book.author_name || [],
            source: 'Open Library',
            key: book.key,
            ia: book.ia || [],
            cover_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null,
            type: 'openlibrary',
            has_full_text: !!(book.ia && book.ia.length > 0),
            description: 'Extensive metadata and borrowing options via Internet Archive.'
        }));

        // Map Google Books results
        const gbBooks = (gbData.items || []).map(book => {
            const info = book.volumeInfo;
            const access = book.accessInfo;
            const isEmbeddable = access ? access.embeddable : false;
            const hasFullText = access ? (access.viewability === 'ALL_PAGES' || access.viewability === 'PARTIAL') : false;
            
            return {
                id: `gb_${book.id}`,
                title: info.title,
                author_name: info.authors || [],
                source: 'Google Books',
                link: info.infoLink,
                preview_link: info.previewLink,
                cover_url: info.imageLinks ? info.imageLinks.thumbnail : null,
                type: 'googlebooks',
                has_full_text: hasFullText,
                is_embeddable: isEmbeddable,
                description: info.description ? info.description.substring(0, 150) + '...' : 'No description available.',
                embed_id: book.id
            };
        });

        // Combine results: Prioritize Gutenberg and embeddable Google Books
        const combined = [...gutenBooks, ...gbBooks, ...olBooks];

        res.status(200).json({
            success: true,
            count: combined.length,
            books: combined
        });

    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch books' });
    }
});

module.exports = router;
