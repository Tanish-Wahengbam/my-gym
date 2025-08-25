import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

let cachedToken = null;
let tokenExpiryTime = null;

// POST /api/token
router.get('/token', async (req, res) => {
    try {
        if (cachedToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
            console.log('Using cached token');
            return res.json({ token: cachedToken, cached: true });
        }

        const payload = {
            email_id: 'hadi@fitnessforce.com',
            password: 'Grip@123',
            company_uuid: '8a25b0b1-e8ac-4d71-b0e2-9476645043e4',
        };

        const apiUrl = 'https://api.staging.ufp.ai/token';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            const { token } = data;
            // Set expiry to 1 hour (3600000 ms)
            const expiryDurationInMs = 60 * 60 * 1000;
            cachedToken = token;
            tokenExpiryTime = Date.now() + expiryDurationInMs;
            return res.json({ token, cached: false });
        } else {
            const errorText = await response.text();
            console.error('API did not return JSON:', errorText);
            return res.status(502).json({ error: 'API did not return JSON', details: errorText });
        }
    } catch (error) {
        console.error('Token fetch error:', error);
        return res.status(500).json({ error: 'Something went wrong', details: error.message });
    }
});

// Helper to get a valid token (refresh if needed)
async function getValidToken() {
    if (cachedToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
        return cachedToken;
    }
    const payload = {
        email_id: 'hadi@fitnessforce.com',
        password: 'Grip@123',
        company_uuid: '908b3875-a74c-4113-95eb-909bd27d90ea',
    };
    const apiUrl = 'https://api.staging.ufp.ai/token';
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await response.json();
    const { token } = data;
    const expiryDurationInMs = 60 * 60 * 1000;
    cachedToken = token;
    tokenExpiryTime = Date.now() + expiryDurationInMs;
    return token;
}

// GET /tenants - fetch tenants using the token

let tenantsCache = {
    data: null,
    timestamp: null,
    expiry: 30 * 60 * 1000
};

router.get('/tenants', async (req, res) => {
    try {
        const now = Date.now();

        if (tenantsCache.data && tenantsCache.timestamp &&
            (now - tenantsCache.timestamp) < tenantsCache.expiry) {
            return res.json(tenantsCache.data);
        }

        const token = await getValidToken();
        const response = await fetch('https://api.staging.ufp.ai/tenants', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();

            tenantsCache.data = data;
            tenantsCache.timestamp = now;

            return res.json(data);
        } else {

            if (tenantsCache.data) {
                return res.json(tenantsCache.data);
            }

            const errorText = await response.text();
            return res.status(502).json({ error: 'API did not return JSON', details: errorText });
        }
    } catch (error) {
        // Return cached data on error if available
        if (tenantsCache.data) {
            return res.json(tenantsCache.data);
        }

        return res.status(500).json({ error: 'Something went wrong', details: error.message });
    }
});


// POST /leads - handle leads form submission

router.post('/leads', async (req, res) => {
    try {
        const { fname, lname, email, mobile, location, tenant_uuid, client_representative_id } = req.body;

        const finalCompanyUuid = "908b3875-a74c-4113-95eb-909bd27d90ea";

        const api_url = `https://api.staging.ufp.ai/open/companies/${finalCompanyUuid}/tenants/${tenant_uuid}/prospect`;

        const data = {
            full_name: fname + ' ' + lname,
            mobile_number: mobile.replace(/\s+/g, ''),
            mobile_country_code: '+91',
            email_id: email,
            location,
            source: 'Website',
            channel: 'Online',
        };

        if (client_representative_id) {
            data.client_representative_id = client_representative_id;
        }

        const response = await fetch(api_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const responseBody = await response.text();
        let decodedResponse;
        try {
            decodedResponse = JSON.parse(responseBody);
        } catch {
            decodedResponse = responseBody;
        }

        console.log({ api_url, data, response: decodedResponse });

        if (response.ok && decodedResponse.id) {
            return res.json({ success: true, id: decodedResponse.id, response: decodedResponse });
        } else {
            return res.status(400).json({ success: false, error: decodedResponse });
        }
    } catch (error) {
        console.error('Leads form error:', error);
        return res.status(500).json({ error: 'Something went wrong', details: error.message });
    }
});


// POST /referral - handle referral form submission
router.post('/referral', async (req, res) => {
    try {
        // Expecting JSON body with: location, referralmobile, friends (array of { full_name, mobile_number, email_id })
        const { location, referralmobile, friends, tenant_uuid } = req.body;
        const finalCompanyUuid = "908b3875-a74c-4113-95eb-909bd27d90ea";

        const api_url = `https://api.staging.ufp.ai/open/companies/${finalCompanyUuid}/tenants/${tenant_uuid}/prospect`;
        const results = [];
        for (const friend of friends) {
            if (!friend.full_name || !friend.mobile_number || !friend.email_id) {
                results.push({ success: false, error: 'Missing required fields', friend });
                continue;
            }
            const data = {
                full_name: friend.full_name,
                mobile_number: friend.mobile_number.replace(/\s+/g, ''),
                mobile_country_code: '+91',
                email_id: friend.email_id,
                location,
                source: 'Website',
                channel: 'Online',
                referred_by: referralmobile.replace(/\s+/g, ''),
            };
            try {
                const response = await fetch(api_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                const responseBody = await response.text();
                let decodedResponse;
                try { decodedResponse = JSON.parse(responseBody); } catch { decodedResponse = responseBody; }
                // Log to console (replace with DB or file logging as needed)
                console.log({ api_url, data, response: decodedResponse });
                if (response.ok && decodedResponse.id) {
                    results.push({ success: true, id: decodedResponse.id, response: decodedResponse });
                } else {
                    results.push({ success: false, error: decodedResponse });
                }
            } catch (err) {
                results.push({ success: false, error: err.message, friend });
            }
        }
        return res.json({ results });
    } catch (error) {
        console.error('Referral form error:', error);
        return res.status(500).json({ error: 'Something went wrong', details: error.message });
    }
});

export default router;
